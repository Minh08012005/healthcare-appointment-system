const pool = require("../config/db");

const ROLE_BAC_SI = "Bác sĩ";
const LANE_ONLINE = "ONLINE";
const LANE_OFFLINE = "OFFLINE";
const ST_CHO_KHAM = "CHO_KHAM";
const ST_DANG_GOI = "DANG_GOI";
const ST_DANG_KHAM = "DANG_KHAM";
const ST_BO_LUOT = "BO_LUOT";
const ST_VANG_MAT = "VANG_MAT";

// Chỉ lượt đã gọi THÀNH CÔNG (bệnh nhân vào khám) mới tiêu thụ lượt A/B.
const CONSUMED_STATES = ["DANG_KHAM", "DA_XONG"];
const LOCK_NS = 3008; // namespace cho advisory lock của C3-08

const NOW_VN = `(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
const TODAY_VN = `${NOW_VN}::date`;
const CHECKIN_DAY = `(h.thoi_gian_check_in AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;

const LANE_LABEL = { [LANE_ONLINE]: "A", [LANE_OFFLINE]: "B" };

// Chọn hàng theo tỷ lệ a:b. Với 1:1 -> A, B, A, B...
const chooseLane = (onlineCalled, offlineCalled, a, b) =>
  (onlineCalled + 1) * b <= (offlineCalled + 1) * a ? LANE_ONLINE : LANE_OFFLINE;

const positiveOr1 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? n : 1;
};

// POST /api/queue/next
const callNextPatient = async (req, res) => {
  if (!req.user || req.user.role !== ROLE_BAC_SI) {
    return res
      .status(403)
      .json({ success: false, message: "Chỉ bác sĩ mới được gọi bệnh nhân tiếp theo" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fail = async (status, message) => {
      await client.query("ROLLBACK");
      return res.status(status).json({ success: false, message });
    };

    // 1. Xác định bác sĩ từ token
    const bs = await client.query(`SELECT id FROM "BacSi" WHERE tai_khoan_id = $1`, [req.user.id]);
    if (bs.rowCount === 0) {
      return fail(403, "Tài khoản chưa gắn với hồ sơ bác sĩ");
    }
    const bacSiId = bs.rows[0].id;

    // 2. Xác định phòng của bác sĩ hôm nay
    const roomRes = await client.query(
      `SELECT l.phong_kham_id
       FROM "LichKhamBacSi" l
       WHERE l.bac_si_id = $1 AND l.ngay = ${TODAY_VN}
         AND l.phong_kham_id IS NOT NULL AND l.trang_thai <> 'DaHuy'
       ORDER BY
         (CASE WHEN (l.ngay + l.gio_bat_dau) <= ${NOW_VN}
                AND (l.ngay + l.gio_ket_thuc) > ${NOW_VN} THEN 0 ELSE 1 END),
         ABS(EXTRACT(EPOCH FROM ((l.ngay + l.gio_bat_dau) - ${NOW_VN})))
       LIMIT 1`,
      [bacSiId]
    );
    if (roomRes.rowCount === 0) {
      return fail(404, "Hôm nay bác sĩ không có lịch khám nên không xác định được phòng");
    }
    const roomId = roomRes.rows[0].phong_kham_id;

    // 3. Khóa theo phòng
    await client.query(`SELECT pg_advisory_xact_lock($1::int, $2::int)`, [LOCK_NS, roomId]);

    // 4. Bác sĩ đang có bệnh nhân DANG_GOI thì chưa được gọi người tiếp theo
    const calling = await client.query(
      `SELECT h.id, h.loai, h.so_thu_tu, h.so_lan_goi, bn.ho_ten
       FROM "HangDoi" h
       JOIN "BenhNhan" bn ON bn.id = h.benh_nhan_id
       WHERE h.bac_si_id = $1 AND h.trang_thai = $2 AND ${CHECKIN_DAY} = ${TODAY_VN}
       ORDER BY h.id
       LIMIT 1`,
      [bacSiId, ST_DANG_GOI]
    );
    if (calling.rowCount > 0) {
      await client.query("ROLLBACK");
      const c = calling.rows[0];
      return res.status(409).json({
        success: false,
        code: "ALREADY_CALLING",
        message: "Đang gọi một bệnh nhân. Hãy xử lý bệnh nhân này trước khi gọi người tiếp theo",
        data: {
          current: {
            id: c.id,
            loai: c.loai,
            so_thu_tu: c.so_thu_tu,
            nhan_stt: `${LANE_LABEL[c.loai] || ""}${c.so_thu_tu}`,
            so_lan_goi: c.so_lan_goi,
            ho_ten: c.ho_ten,
          },
        },
      });
    }

    // 5. Tỷ lệ A:B từ CauHinhHeThong
    const cfg = await client.query(
      `SELECT ti_le_online, ti_le_offline FROM "CauHinhHeThong" ORDER BY id LIMIT 1`
    );
    const a = positiveOr1(cfg.rows[0]?.ti_le_online);
    const b = positiveOr1(cfg.rows[0]?.ti_le_offline);

    // 6. Số lượt đã gọi thành công hôm nay
    const counts = await client.query(
      `SELECT h.loai, COUNT(*)::int AS n
       FROM "HangDoi" h
       WHERE h.phong_kham_id = $1 AND h.bac_si_id = $2
         AND ${CHECKIN_DAY} = ${TODAY_VN}
         AND h.trang_thai = ANY($3)
       GROUP BY h.loai`,
      [roomId, bacSiId, CONSUMED_STATES]
    );
    const called = { [LANE_ONLINE]: 0, [LANE_OFFLINE]: 0 };
    counts.rows.forEach((r) => {
      if (called[r.loai] !== undefined) called[r.loai] = r.n;
    });

    // 7. Chọn hàng theo tỷ lệ
    const preferred = chooseLane(called[LANE_ONLINE], called[LANE_OFFLINE], a, b);
    const lanes = [preferred, preferred === LANE_ONLINE ? LANE_OFFLINE : LANE_ONLINE];

    let picked = null;
    for (const lane of lanes) {
      const cand = await client.query(
        `SELECT h.id
         FROM "HangDoi" h
         WHERE h.phong_kham_id = $1 AND h.loai = $2 AND h.trang_thai = $3
           AND (h.bac_si_id = $4 OR h.bac_si_id IS NULL)
           AND ${CHECKIN_DAY} = ${TODAY_VN}
         ORDER BY h.so_thu_tu ASC, h.thoi_gian_check_in ASC, h.id ASC
         LIMIT 1
         FOR UPDATE`,
        [roomId, lane, ST_CHO_KHAM, bacSiId]
      );
      if (cand.rowCount > 0) {
        picked = cand.rows[0].id;
        break;
      }
    }

    // 8. Không có ai chờ
    if (picked === null) {
      await client.query("COMMIT");
      return res.json({
        success: true,
        data: {
          called: false,
          message: "Hiện không có bệnh nhân chờ khám",
          room_id: roomId,
          queue: null,
          patient: null,
          appointment: null,
          trieu_chung: null,
        },
      });
    }

    // 9. CHO_KHAM -> DANG_GOI
    const upd = await client.query(
      `UPDATE "HangDoi"
       SET trang_thai = $2,
           so_lan_goi = COALESCE(so_lan_goi, 0) + 1,
           bac_si_id = COALESCE(bac_si_id, $4)
       WHERE id = $1 AND trang_thai = $3
       RETURNING id`,
      [picked, ST_DANG_GOI, ST_CHO_KHAM, bacSiId]
    );
    if (upd.rowCount === 0) {
      return fail(409, "Lượt khám vừa được xử lý, vui lòng thử lại");
    }

    // 10. Dữ liệu trả về
    const info = await client.query(
      `SELECT h.id, h.so_thu_tu, h.loai, h.trang_thai, h.so_lan_goi, h.so_lan_bo_luot,
              h.thoi_gian_check_in, h.dat_lich_id, h.phong_kham_id, h.bac_si_id,
              bn.id AS bn_id, bn.ho_ten, to_char(bn.ngay_sinh, 'YYYY-MM-DD') AS ngay_sinh,
              bn.gioi_tinh, bn.ma_bhyt,
              d.ma_dat_lich, to_char(d.gio_kham, 'HH24:MI:SS') AS gio_kham,
              pk.ten_phong,
              COALESCE(d.trieu_chung, kq.trieu_chung_ghi_nhan) AS trieu_chung_hien_thi
       FROM "HangDoi" h
       JOIN "BenhNhan" bn ON bn.id = h.benh_nhan_id
       LEFT JOIN "DatLichKham" d ON d.id = h.dat_lich_id
       LEFT JOIN "PhongKham" pk ON pk.id = h.phong_kham_id
       LEFT JOIN LATERAL (
         SELECT k.trieu_chung_ghi_nhan
         FROM "HoSoBenhAn" hs
         JOIN "KetQuaKham" k ON k.ho_so_id = hs.id
         WHERE hs.hang_doi_id = h.id
         ORDER BY k.id DESC LIMIT 1
       ) kq ON true
       WHERE h.id = $1`,
      [picked]
    );
    const i = info.rows[0];

    await client.query("COMMIT");
    return res.json({
      success: true,
      data: {
        called: true,
        message: null,
        queue: {
          id: i.id,
          loai: i.loai,
          so_thu_tu: i.so_thu_tu,
          nhan_stt: `${LANE_LABEL[i.loai] || ""}${i.so_thu_tu}`,
          trang_thai: i.trang_thai,
          so_lan_goi: i.so_lan_goi,
          so_lan_bo_luot: i.so_lan_bo_luot,
          thoi_gian_check_in: i.thoi_gian_check_in,
          dat_lich_id: i.dat_lich_id,
          bac_si_id: i.bac_si_id,
        },
        patient: {
          id: i.bn_id,
          ho_ten: i.ho_ten,
          ngay_sinh: i.ngay_sinh,
          gioi_tinh: i.gioi_tinh,
          ma_bhyt: i.ma_bhyt,
        },
        appointment: i.ma_dat_lich
          ? { ma_dat_lich: i.ma_dat_lich, gio_kham: i.gio_kham }
          : null,
        room: { id: i.phong_kham_id, ten_phong: i.ten_phong },
        trieu_chung: i.trieu_chung_hien_thi,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    client.release();
  }
};

// ==========================================
// BỔ SUNG CHO ISSUE #51: RECALL, SKIP, START
// ==========================================

const recallPatient = async (req, res) => {
  if (!req.user || req.user.role !== ROLE_BAC_SI) {
    return res.status(403).json({ success: false, message: "Chỉ bác sĩ mới được gọi lại bệnh nhân" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const bs = await client.query(`SELECT id FROM "BacSi" WHERE tai_khoan_id = $1`, [req.user.id]);
    if (bs.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({ success: false, message: "Tài khoản chưa gắn với hồ sơ bác sĩ" });
    }
    const bacSiId = bs.rows[0].id;

    // Lấy cấu hình số lần gọi tối đa từ CauHinhHeThong (mặc định 3 nếu chưa có)
    let maxCalls = 3;
    try {
      const cfg = await client.query(`SELECT so_lan_goi_toi_da FROM "CauHinhHeThong" ORDER BY id LIMIT 1`);
      if (cfg.rowCount > 0 && cfg.rows[0].so_lan_goi_toi_da) {
        maxCalls = cfg.rows[0].so_lan_goi_toi_da;
      }
    } catch (e) {
      // Bỏ qua nếu chưa có bảng cấu hình, giữ mặc định 3
    }

    // Tìm bệnh nhân đang DANG_GOI của bác sĩ này
    const calling = await client.query(
      `SELECT h.id, h.so_thu_tu, h.loai, h.so_lan_goi, h.phong_kham_id, h.dat_lich_id, h.benh_nhan_id
       FROM "HangDoi" h
       WHERE h.bac_si_id = $1 AND h.trang_thai = $2
       ORDER BY h.id DESC
       LIMIT 1
       FOR UPDATE`,
      [bacSiId, ST_DANG_GOI]
    );

    if (calling.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Không có bệnh nhân nào đang ở trạng thái gọi để gọi lại" });
    }

    const current = calling.rows[0];

    if (current.so_lan_goi >= maxCalls) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        code: "MAX_CALLS_REACHED",
        message: `Đã đạt số lần gọi tối đa (${maxCalls} lần). Vui lòng chọn Bỏ lượt / Vắng mặt.`,
      });
    }

    // Tăng số lần gọi lên 1
    await client.query(
      `UPDATE "HangDoi" SET so_lan_goi = so_lan_goi + 1 WHERE id = $1`,
      [current.id]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: `Đã phát tín hiệu gọi lại lần thứ ${current.so_lan_goi + 1}`,
      data: {
        queue: {
          id: current.id,
          loai: current.loai,
          so_thu_tu: current.so_thu_tu,
          nhan_stt: `${LANE_LABEL[current.loai] || ""}${current.so_thu_tu}`,
          trang_thai: ST_DANG_GOI,
          so_lan_goi: current.so_lan_goi + 1,
        },
      },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Lỗi recallPatient:", err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    client.release();
  }
};


const skipPatient = async (req, res) => {
  if (!req.user || req.user.role !== ROLE_BAC_SI) {
    return res.status(403).json({ success: false, message: "Chỉ bác sĩ mới được thao tác bỏ lượt" });
  }

  const queueId = Number(req.params.id);
  if (!Number.isInteger(queueId) || queueId <= 0) {
    return res.status(400).json({ success: false, message: "ID hàng đợi không hợp lệ" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fail = async (status, message) => {
      await client.query("ROLLBACK");
      return res.status(status).json({ success: false, message });
    };

    const bs = await client.query(`SELECT id FROM "BacSi" WHERE tai_khoan_id = $1`, [req.user.id]);
    if (bs.rowCount === 0) return fail(403, "Tài khoản chưa gắn với hồ sơ bác sĩ");
    const bacSiId = bs.rows[0].id;

    const hd = await client.query(
      `SELECT h.id, h.trang_thai, h.so_lan_bo_luot, h.bac_si_id
       FROM "HangDoi" h
       WHERE h.id = $1 FOR UPDATE`,
      [queueId]
    );

    if (hd.rowCount === 0) {
      return fail(404, "Không tìm thấy lượt khám trong hàng đợi");
    }

    const row = hd.rows[0];
    if (row.bac_si_id && row.bac_si_id !== bacSiId) {
      return fail(403, "Bạn không có quyền xử lý lượt khám của bác sĩ khác");
    }

    const newSkipCount = row.so_lan_bo_luot + 1;
    const nextStatus = newSkipCount >= 2 ? ST_VANG_MAT : ST_BO_LUOT;

    await client.query(
      `UPDATE "HangDoi"
       SET trang_thai = $1, so_lan_bo_luot = $2
       WHERE id = $3`,
      [nextStatus, newSkipCount, queueId]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: newSkipCount >= 2 
        ? "Bệnh nhân vắng mặt lần 2, đã chuyển trạng thái thành VANG_MAT (đóng lượt)" 
        : "Đã ghi nhận bỏ lượt lần 1 (BO_LUOT), chờ lễ tân xử lý xếp lại hoặc chuyển vắng mặt",
      data: {
        id: queueId,
        trang_thai: nextStatus,
        so_lan_bo_luot: newSkipCount,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Lỗi skipPatient:", err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    client.release();
  }
};

const startExamination = async (req, res) => {
  if (!req.user || req.user.role !== ROLE_BAC_SI) {
    return res.status(403).json({ success: false, message: "Chỉ bác sĩ mới được bắt đầu khám" });
  }

  const queueId = Number(req.params.id);
  if (!Number.isInteger(queueId) || queueId <= 0) {
    return res.status(400).json({ success: false, message: "ID hàng đợi không hợp lệ" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fail = async (status, message) => {
      await client.query("ROLLBACK");
      return res.status(status).json({ success: false, message });
    };

    const bs = await client.query(`SELECT id FROM "BacSi" WHERE tai_khoan_id = $1`, [req.user.id]);
    if (bs.rowCount === 0) return fail(403, "Tài khoản chưa gắn với hồ sơ bác sĩ");
    const bacSiId = bs.rows[0].id;

    const hd = await client.query(
      `SELECT h.id, h.benh_nhan_id, h.bac_si_id, h.trang_thai, h.phong_kham_id
       FROM "HangDoi" h
       WHERE h.id = $1 FOR UPDATE`,
      [queueId]
    );

    if (hd.rowCount === 0) return fail(404, "Không tìm thấy lượt khám trong hàng đợi");
    const row = hd.rows[0];

    if (row.bac_si_id && row.bac_si_id !== bacSiId) {
      return fail(403, "Bạn không có quyền khám bệnh nhân này");
    }

    if (row.trang_thai !== ST_DANG_GOI && row.trang_thai !== ST_CHO_KHAM) {
      return fail(400, `Không thể bắt đầu khám từ trạng thái hiện tại (${row.trang_thai})`);
    }

    await client.query(
      `UPDATE "HangDoi"
       SET trang_thai = $1, bac_si_id = COALESCE(bac_si_id, $3)
       WHERE id = $2`,
      [ST_DANG_KHAM, queueId, bacSiId]
    );

    let hs = await client.query(`SELECT id FROM "HoSoBenhAn" WHERE hang_doi_id = $1`, [queueId]);
    let hoSoId;
    if (hs.rowCount === 0) {
      const newHs = await client.query(
        `INSERT INTO "HoSoBenhAn" (hang_doi_id, benh_nhan_id, bac_si_id, ngay_kham, trang_thai)
         VALUES ($1, $2, $3, ${TODAY_VN}, $4)
         RETURNING id`,
        [queueId, row.benh_nhan_id, bacSiId, ST_DANG_KHAM]
      );
      hoSoId = newHs.rows[0].id;
    } else {
      hoSoId = hs.rows[0].id;
      await client.query(`UPDATE "HoSoBenhAn" SET trang_thai = $1 WHERE id = $2`, [ST_DANG_KHAM, hoSoId]);
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Đã bắt đầu khám bệnh nhân",
      data: {
        queue_id: queueId,
        trang_thai: ST_DANG_KHAM,
        ho_so_id: hoSoId,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Lỗi startExamination:", err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    client.release();
  }
};

const getCurrentCalling = async (req, res) => {
  if (!req.user || req.user.role !== ROLE_BAC_SI) {
    return res.status(403).json({ success: false, message: "Chỉ bác sĩ mới được xem thông tin gọi khám" });
  }

  const client = await pool.connect();
  try {
    const bs = await client.query(`SELECT id FROM "BacSi" WHERE tai_khoan_id = $1`, [req.user.id]);
    if (bs.rowCount === 0) {
      return res.status(403).json({ success: false, message: "Tài khoản chưa gắn với hồ sơ bác sĩ" });
    }
    const bacSiId = bs.rows[0].id;

    // Tìm bệnh nhân đang DANG_GOI của bác sĩ hôm nay
    const info = await client.query(
      `SELECT h.id, h.so_thu_tu, h.loai, h.trang_thai, h.so_lan_goi, h.so_lan_bo_luot,
              h.thoi_gian_check_in, h.dat_lich_id, h.phong_kham_id, h.bac_si_id,
              bn.id AS bn_id, bn.ho_ten, to_char(bn.ngay_sinh, 'YYYY-MM-DD') AS ngay_sinh,
              bn.gioi_tinh, bn.ma_bhyt,
              d.ma_dat_lich, to_char(d.gio_kham, 'HH24:MI:SS') AS gio_kham,
              pk.ten_phong,
              COALESCE(d.trieu_chung, kq.trieu_chung_ghi_nhan) AS trieu_chung_hien_thi
       FROM "HangDoi" h
       JOIN "BenhNhan" bn ON bn.id = h.benh_nhan_id
       LEFT JOIN "DatLichKham" d ON d.id = h.dat_lich_id
       LEFT JOIN "PhongKham" pk ON pk.id = h.phong_kham_id
       LEFT JOIN LATERAL (
         SELECT k.trieu_chung_ghi_nhan
         FROM "HoSoBenhAn" hs
         JOIN "KetQuaKham" k ON k.ho_so_id = hs.id
         WHERE hs.hang_doi_id = h.id
         ORDER BY k.id DESC LIMIT 1
       ) kq ON true
       WHERE h.bac_si_id = $1 AND h.trang_thai = $2 AND ${CHECKIN_DAY} = ${TODAY_VN}
       ORDER BY h.id DESC
       LIMIT 1`,
      [bacSiId, ST_DANG_GOI]
    );

    if (info.rowCount === 0) {
      return res.json({
        success: true,
        data: { has_calling: false, queue: null, patient: null, appointment: null, room: null, trieu_chung: null }
      });
    }

    const i = info.rows[0];
    return res.json({
      success: true,
      data: {
        has_calling: true,
        queue: {
          id: i.id,
          loai: i.loai,
          so_thu_tu: i.so_thu_tu,
          nhan_stt: `${LANE_LABEL[i.loai] || ""}${i.so_thu_tu}`,
          trang_thai: i.trang_thai,
          so_lan_goi: i.so_lan_goi,
          so_lan_bo_luot: i.so_lan_bo_luot,
          thoi_gian_check_in: i.thoi_gian_check_in,
          dat_lich_id: i.dat_lich_id,
          bac_si_id: i.bac_si_id,
        },
        patient: {
          id: i.bn_id,
          ho_ten: i.ho_ten,
          ngay_sinh: i.ngay_sinh,
          gioi_tinh: i.gioi_tinh,
          ma_bhyt: i.ma_bhyt,
        },
        appointment: i.ma_dat_lich ? { ma_dat_lich: i.ma_dat_lich, gio_kham: i.gio_kham } : null,
        room: { id: i.phong_kham_id, ten_phong: i.ten_phong },
        trieu_chung: i.trieu_chung_hien_thi,
      },
    });
  } catch (err) {
    console.error("Lỗi getCurrentCalling:", err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    client.release();
  }
};

module.exports = { 
  callNextPatient, 
  recallPatient, 
  skipPatient, 
  startExamination,
  getCurrentCalling
};