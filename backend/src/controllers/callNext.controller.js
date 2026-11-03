const pool = require("../config/db");

const ROLE_BAC_SI = "Bác sĩ";
const ROLE_LE_TAN = "Lễ tân";
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
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
};

const getQueueConfig = async (db = pool, { requireRecallConfig = false } = {}) => {
  const cfg = await db.query(
    `SELECT ti_le_online, ti_le_offline, so_lan_goi_toi_da, khoang_cach_goi_phut, chu_ky_quet_phut
     FROM "CauHinhHeThong"
     ORDER BY id LIMIT 1`
  );
  const row = cfg.rows[0];
  if (!row && requireRecallConfig) {
    throw new Error("C3-09 config error: no row found in CauHinhHeThong");
  }

  if (requireRecallConfig) {
    for (const [key, value] of [
      ["so_lan_goi_toi_da", row.so_lan_goi_toi_da],
      ["khoang_cach_goi_phut", row.khoang_cach_goi_phut],
    ]) {
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`C3-09 config error: ${key} must be a positive integer`);
      }
    }
  }

  return {
    a: positiveOr1(row?.ti_le_online),
    b: positiveOr1(row?.ti_le_offline),
    maxCalls: row?.so_lan_goi_toi_da,
    callIntervalMinutes: row?.khoang_cach_goi_phut,
    scanCycleMinutes: positiveOr1(row?.chu_ky_quet_phut ?? 1),
  };
};

// Xác định bác sĩ và phòng khám trong ca làm việc hôm nay
const getDoctorAndRoom = async (client, taiKhoanId) => {
  const bs = await client.query(`SELECT id FROM "BacSi" WHERE tai_khoan_id = $1`, [taiKhoanId]);
  if (bs.rowCount === 0) {
    return { errorStatus: 403, errorMessage: "Tài khoản chưa gắn với hồ sơ bác sĩ" };
  }
  const bacSiId = bs.rows[0].id;

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
    return {
      bacSiId,
      roomId: null,
      errorStatus: 404,
      errorMessage: "Hôm nay bác sĩ không có lịch khám nên không xác định được phòng",
    };
  }

  return { bacSiId, roomId: roomRes.rows[0].phong_kham_id, errorStatus: null, errorMessage: null };
};

// Truy vấn chi tiết 1 lượt khám trong hàng đợi
const fetchQueueDetail = async (db, queueId) => {
  const info = await db.query(
    `SELECT h.id, h.so_thu_tu, h.loai, h.trang_thai, h.so_lan_goi, h.so_lan_bo_luot,
            h.thoi_gian_check_in, h.thoi_gian_goi_gan_nhat, h.dat_lich_id, h.phong_kham_id, h.bac_si_id,
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
    [queueId]
  );
  if (info.rowCount === 0) return null;
  const i = info.rows[0];
  return {
    queue: {
      id: i.id,
      loai: i.loai,
      so_thu_tu: i.so_thu_tu,
      nhan_stt: `${LANE_LABEL[i.loai] || ""}${i.so_thu_tu}`,
      trang_thai: i.trang_thai,
      so_lan_goi: i.so_lan_goi,
      so_lan_bo_luot: i.so_lan_bo_luot,
      thoi_gian_check_in: i.thoi_gian_check_in,
      thoi_gian_goi_gan_nhat: i.thoi_gian_goi_gan_nhat,
      dat_lich_id: i.dat_lich_id,
      bac_si_id: i.bac_si_id,
      phong_kham_id: i.phong_kham_id,
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
  };
};

// ============================================================================
// 1. AUTO-RECALL THEO CẤU HÌNH N/M TRONG CauHinhHeThong
// ============================================================================
// Tự động tăng so_lan_goi thêm 1 cho các lượt DANG_GOI trong ngày khi:
// - so_lan_goi < so_lan_goi_toi_da (N)
// - Thời gian từ thoi_gian_goi_gan_nhat đến hiện tại >= khoang_cach_goi_phut (M)
const xuLyTuDongGoiLai = async (onlyIds = null) => {
  const { maxCalls, callIntervalMinutes } = await getQueueConfig(pool, { requireRecallConfig: true });

  const ung = await pool.query(
    `SELECT h.id
     FROM "HangDoi" h
     WHERE h.trang_thai = $1
       AND ${CHECKIN_DAY} = ${TODAY_VN}
       AND h.so_lan_goi < $2
       AND h.thoi_gian_goi_gan_nhat
           <= NOW() - ($3::int * interval '1 minute')
       AND ($4::int[] IS NULL OR h.id = ANY($4::int[]))
     ORDER BY h.id ASC`,
    [ST_DANG_GOI, maxCalls, callIntervalMinutes, onlyIds]
  );

  if (process.env.C3_JOB_DRY_RUN === "true") {
    if (ung.rowCount > 0) {
      console.log(`[C3-09][DRY-RUN] Sẽ tự động gọi lại ${ung.rowCount} lượt:`, ung.rows);
    }
    return 0;
  }

  let daGoiLai = 0;
  for (const { id } of ung.rows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const upd = await client.query(
        `UPDATE "HangDoi" h
         SET so_lan_goi = h.so_lan_goi + 1,
             thoi_gian_goi_gan_nhat = NOW()
         WHERE h.id = $1
           AND h.trang_thai = $2
           AND ${CHECKIN_DAY} = ${TODAY_VN}
           AND h.so_lan_goi < $3
           AND h.thoi_gian_goi_gan_nhat
               <= NOW() - ($4::int * interval '1 minute')
         RETURNING h.id, h.so_lan_goi`,
        [id, ST_DANG_GOI, maxCalls, callIntervalMinutes]
      );
      await client.query("COMMIT");
      if (upd.rowCount > 0) daGoiLai += 1;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`[AutoRecall] Lỗi tự động gọi lại lượt #${id}:`, err.message);
    } finally {
      client.release();
    }
  }
  return daGoiLai;
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

    // 1 & 2. Xác định bác sĩ và phòng khám hôm nay
    const { bacSiId, roomId, errorStatus, errorMessage } = await getDoctorAndRoom(client, req.user.id);
    if (errorStatus) return fail(errorStatus, errorMessage);

    // 3. Khóa theo phòng
    await client.query(`SELECT pg_advisory_xact_lock($1::int, $2::int)`, [LOCK_NS, roomId]);

    // 4. Bác sĩ đang có bệnh nhân DANG_GOI tại phòng thì chưa được gọi người tiếp theo
    const calling = await client.query(
      `SELECT h.id, h.loai, h.so_thu_tu, h.so_lan_goi, h.thoi_gian_goi_gan_nhat, bn.ho_ten
       FROM "HangDoi" h
       JOIN "BenhNhan" bn ON bn.id = h.benh_nhan_id
       WHERE h.bac_si_id = $1 AND h.phong_kham_id = $2
         AND h.trang_thai = $3 AND ${CHECKIN_DAY} = ${TODAY_VN}
       ORDER BY h.id
       LIMIT 1`,
      [bacSiId, roomId, ST_DANG_GOI]
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
            thoi_gian_goi_gan_nhat: c.thoi_gian_goi_gan_nhat,
            ho_ten: c.ho_ten,
          },
        },
      });
    }

    // 5. Tỷ lệ A:B từ CauHinhHeThong
    const { a, b } = await getQueueConfig(client);

    // 6. Số lượt đã gọi thành công hôm nay (chỉ tính DANG_KHAM, DA_XONG)
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

    // 9. CHO_KHAM -> DANG_GOI (khởi tạo so_lan_goi = 1 và lưu thoi_gian_goi_gan_nhat = NOW())
    const upd = await client.query(
      `UPDATE "HangDoi"
       SET trang_thai = $2,
           so_lan_goi = 1,
           thoi_gian_goi_gan_nhat = NOW(),
           bac_si_id = COALESCE(bac_si_id, $4)
       WHERE id = $1 AND trang_thai = $3
       RETURNING id`,
      [picked, ST_DANG_GOI, ST_CHO_KHAM, bacSiId]
    );
    if (upd.rowCount === 0) {
      return fail(409, "Lượt khám vừa được xử lý, vui lòng thử lại");
    }

    // 10. Dữ liệu trả về
    const detail = await fetchQueueDetail(client, picked);
    await client.query("COMMIT");

    return res.json({
      success: true,
      data: {
        called: true,
        message: null,
        ...detail,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Lỗi callNextPatient:", err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    client.release();
  }
};

// GET /api/queue/current — API ĐỌC RIÊNG (Read-Only, đúng scope Bác sĩ + Phòng hôm nay)
const getCurrentCalling = async (req, res) => {
  if (!req.user || req.user.role !== ROLE_BAC_SI) {
    return res.status(403).json({ success: false, message: "Chỉ bác sĩ mới được xem thông tin gọi khám" });
  }
  const client = await pool.connect();
  try {
    const { bacSiId, roomId, errorStatus, errorMessage } = await getDoctorAndRoom(client, req.user.id);
    if (errorStatus === 403) {
      return res.status(403).json({ success: false, message: errorMessage });
    }
    if (!roomId) {
      return res.json({
        success: true,
        data: { has_calling: false, queue: null, patient: null, appointment: null, room: null, trieu_chung: null },
      });
    }

    const calling = await client.query(
      `SELECT h.id
       FROM "HangDoi" h
       WHERE h.bac_si_id = $1
         AND h.phong_kham_id = $2
         AND h.trang_thai = $3
         AND ${CHECKIN_DAY} = ${TODAY_VN}
       ORDER BY h.id DESC
       LIMIT 1`,
      [bacSiId, roomId, ST_DANG_GOI]
    );

    if (calling.rowCount === 0) {
      return res.json({
        success: true,
        data: { has_calling: false, queue: null, patient: null, appointment: null, room: null, trieu_chung: null },
      });
    }

    const detail = await fetchQueueDetail(client, calling.rows[0].id);
    return res.json({
      success: true,
      data: {
        has_calling: true,
        ...detail,
      },
    });
  } catch (err) {
    console.error("Lỗi getCurrentCalling:", err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    client.release();
  }
};

// POST /api/queue/recall — Kích hoạt kiểm tra auto-recall theo đúng quy tắc N/M & khoảng cách gọi
const recallPatient = async (req, res) => {
  if (!req.user || req.user.role !== ROLE_BAC_SI) {
    return res.status(403).json({ success: false, message: "Chỉ bác sĩ mới được gọi lại bệnh nhân" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { bacSiId, roomId, errorStatus, errorMessage } = await getDoctorAndRoom(client, req.user.id);
    if (errorStatus) {
      await client.query("ROLLBACK");
      return res.status(errorStatus).json({ success: false, message: errorMessage });
    }

    const { maxCalls, callIntervalMinutes } = await getQueueConfig(client, { requireRecallConfig: true });

    const calling = await client.query(
      `SELECT h.id, h.so_thu_tu, h.loai, h.so_lan_goi, h.thoi_gian_goi_gan_nhat,
              (COALESCE(h.thoi_gian_goi_gan_nhat, h.thoi_gian_check_in)
               <= NOW() - ($4::int * interval '1 minute')) AS du_khoang_cach
       FROM "HangDoi" h
       WHERE h.bac_si_id = $1 AND h.phong_kham_id = $2
         AND h.trang_thai = $3 AND ${CHECKIN_DAY} = ${TODAY_VN}
       ORDER BY h.id DESC
       LIMIT 1
       FOR UPDATE`,
      [bacSiId, roomId, ST_DANG_GOI, callIntervalMinutes]
    );

    if (calling.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Không có bệnh nhân nào đang ở trạng thái gọi tại phòng của bác sĩ",
      });
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

    if (!current.du_khoang_cach) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        code: "CALL_INTERVAL_NOT_REACHED",
        message: `Chưa đủ khoảng cách tối thiểu giữa các lần gọi (${callIntervalMinutes} phút).`,
      });
    }

    const upd = await client.query(
      `UPDATE "HangDoi"
       SET so_lan_goi = so_lan_goi + 1,
           thoi_gian_goi_gan_nhat = NOW()
       WHERE id = $1
       RETURNING so_lan_goi, thoi_gian_goi_gan_nhat`,
      [current.id]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: `Đã tự động phát tín hiệu gọi lại lần thứ ${upd.rows[0].so_lan_goi}`,
      data: {
        queue: {
          id: current.id,
          loai: current.loai,
          so_thu_tu: current.so_thu_tu,
          nhan_stt: `${LANE_LABEL[current.loai] || ""}${current.so_thu_tu}`,
          trang_thai: ST_DANG_GOI,
          so_lan_goi: upd.rows[0].so_lan_goi,
          thoi_gian_goi_gan_nhat: upd.rows[0].thoi_gian_goi_gan_nhat,
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

// ============================================================================
// 2. BỎ LƯỢT / VẮNG MẶT (POST /api/queue/:id/skip)
// ============================================================================
const skipPatient = async (req, res) => {
  if (!req.user || req.user.role !== ROLE_BAC_SI) {
    return res.status(403).json({ success: false, message: "Chỉ bác sĩ mới được thao tác bỏ lượt" });
  }

  const queueId = Number(req.params.id);
  if (!Number.isInteger(queueId) || queueId <= 0) {
    return res.status(400).json({ success: false, message: "ID hàng đợi không hợp lệ" });
  }
  // Đồng bộ auto-recall nếu đã đủ thời gian trước khi kiểm tra skip
  await xuLyTuDongGoiLai([queueId]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fail = async (status, message, code = undefined) => {
      await client.query("ROLLBACK");
      return res.status(status).json({ success: false, ...(code ? { code } : {}), message });
    };

    const { bacSiId, roomId, errorStatus, errorMessage } = await getDoctorAndRoom(client, req.user.id);
    if (errorStatus) return fail(errorStatus, errorMessage);

    await client.query(`SELECT pg_advisory_xact_lock($1::int, $2::int)`, [LOCK_NS, roomId]);

    const hd = await client.query(
      `SELECT h.id, h.trang_thai, h.so_lan_goi, h.so_lan_bo_luot, h.bac_si_id, h.phong_kham_id,
              (${CHECKIN_DAY} = ${TODAY_VN}) AS la_hom_nay
       FROM "HangDoi" h
       WHERE h.id = $1
       FOR UPDATE`,
      [queueId]
    );

    if (hd.rowCount === 0) {
      return fail(404, "Không tìm thấy lượt khám trong hàng đợi");
    }

    const row = hd.rows[0];

    // Kiểm tra đúng bác sĩ, đúng phòng và đúng ngày
    if (!row.la_hom_nay || row.phong_kham_id !== roomId || row.bac_si_id !== bacSiId) {
      return fail(403, "Bạn không có quyền xử lý lượt khám của bác sĩ hoặc phòng khám khác", "FORBIDDEN_OWNERSHIP");
    }

    // Chỉ cho phép từ DANG_GOI, chặn gọi lặp trên BO_LUOT, VANG_MAT, DANG_KHAM, CHO_KHAM...
    if (row.trang_thai !== ST_DANG_GOI) {
      return fail(
        400,
        `Chỉ được chuyển bỏ lượt/vắng mặt từ trạng thái DANG_GOI (trạng thái hiện tại: ${row.trang_thai})`,
        "INVALID_STATE"
      );
    }

    // Chỉ được xử lý sau khi đã gọi đủ số lần tối đa (N)
    const { maxCalls } = await getQueueConfig(client, { requireRecallConfig: true });
    if (row.so_lan_goi < maxCalls) {
      return fail(
        400,
        `Chưa gọi đủ số lần tối đa (${row.so_lan_goi}/${maxCalls} lần). Không thể chuyển bỏ lượt/vắng mặt.`,
        "CALLS_NOT_EXHAUSTED"
      );
    }

    const newSkipCount = (row.so_lan_bo_luot || 0) + 1;
    const nextStatus = newSkipCount >= 2 ? ST_VANG_MAT : ST_BO_LUOT;

    await client.query(
      `UPDATE "HangDoi"
       SET trang_thai = $1,
           so_lan_bo_luot = $2
       WHERE id = $3`,
      [nextStatus, newSkipCount, queueId]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message:
        newSkipCount >= 2
          ? "Bệnh nhân vắng mặt lần 2, đã chuyển trạng thái thành VANG_MAT (đóng lượt)"
          : "Đã ghi nhận bỏ lượt lần 1 (BO_LUOT), chờ lễ tân xử lý xếp lại hoặc đóng lượt",
      data: {
        id: queueId,
        trang_thai: nextStatus,
        so_lan_goi: row.so_lan_goi,
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

// ============================================================================
// 3. LỄ TÂN XẾP LẠI HÀNG ĐỢI (POST /api/queue/:id/requeue)
// ============================================================================
const requeuePatient = async (req, res) => {
  if (!req.user || req.user.role !== ROLE_LE_TAN) {
    return res
      .status(403)
      .json({ success: false, message: "Chỉ Lễ tân mới được xếp lại bệnh nhân bỏ lượt vào hàng đợi" });
  }

  const queueId = Number(req.params.id);
  if (!Number.isInteger(queueId) || queueId <= 0) {
    return res.status(400).json({ success: false, message: "ID hàng đợi không hợp lệ" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fail = async (status, message, code = undefined) => {
      await client.query("ROLLBACK");
      return res.status(status).json({ success: false, ...(code ? { code } : {}), message });
    };

    const hd = await client.query(
      `SELECT h.id, h.benh_nhan_id, h.phong_kham_id, h.bac_si_id, h.loai, h.so_thu_tu,
              h.trang_thai, h.so_lan_goi, h.so_lan_bo_luot,
              (${CHECKIN_DAY} = ${TODAY_VN}) AS la_hom_nay
       FROM "HangDoi" h
       WHERE h.id = $1
       FOR UPDATE`,
      [queueId]
    );

    if (hd.rowCount === 0) {
      return fail(404, "Không tìm thấy lượt khám trong hàng đợi");
    }

    const row = hd.rows[0];
    if (!row.la_hom_nay) {
      return fail(400, "Chỉ được xếp lại lượt khám trong ngày hôm nay", "NOT_TODAY");
    }

    if (row.trang_thai !== ST_BO_LUOT || row.so_lan_bo_luot !== 1) {
      return fail(
        400,
        `Chỉ được xếp lại lượt khám đang ở trạng thái BO_LUOT lần 1 (hiện tại: ${row.trang_thai}, bỏ lượt: ${row.so_lan_bo_luot})`,
        "INVALID_REQUEUE_STATE"
      );
    }

    // Khóa dòng PhongKham để cấp STT OFFLINE mới không bao giờ trùng
    await client.query(`SELECT id FROM "PhongKham" WHERE id = $1 FOR UPDATE`, [row.phong_kham_id]);

    const sttRes = await client.query(
      `SELECT COALESCE(MAX(h.so_thu_tu) FILTER (WHERE h.loai = $2), 0) + 1 AS so_thu_tu
       FROM "HangDoi" h
       WHERE h.phong_kham_id = $1 AND ${CHECKIN_DAY} = ${TODAY_VN}`,
      [row.phong_kham_id, LANE_OFFLINE]
    );
    const newSoThuTu = Number(sttRes.rows[0].so_thu_tu);

    // Chuyển xuống cuối hàng OFFLINE, cấp STT mới, về CHO_KHAM, giữ so_lan_bo_luot = 1, reset so_lan_goi = 0
    await client.query(
      `UPDATE "HangDoi"
       SET loai = $1,
           so_thu_tu = $2,
           trang_thai = $3,
           so_lan_goi = 0,
           thoi_gian_goi_gan_nhat = NULL,
           so_lan_bo_luot = 1
       WHERE id = $4`,
      [LANE_OFFLINE, newSoThuTu, ST_CHO_KHAM, queueId]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: `Đã xếp lại bệnh nhân xuống cuối hàng OFFLINE với STT B${newSoThuTu}`,
      data: {
        queue: {
          id: queueId,
          loai: LANE_OFFLINE,
          so_thu_tu: newSoThuTu,
          nhan_stt: `B${newSoThuTu}`,
          stt_hien_thi: `B${newSoThuTu}`,
          trang_thai: ST_CHO_KHAM,
          so_lan_goi: 0,
          so_lan_bo_luot: 1,
          phong_kham_id: row.phong_kham_id,
          bac_si_id: row.bac_si_id,
        },
      },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Lỗi requeuePatient:", err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    client.release();
  }
};

// ============================================================================
// 4. BẮT ĐẦU KHÁM (POST /api/queue/:id/start)
// ============================================================================
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

    const fail = async (status, message, code = undefined) => {
      await client.query("ROLLBACK");
      return res.status(status).json({ success: false, ...(code ? { code } : {}), message });
    };

    const { bacSiId, roomId, errorStatus, errorMessage } = await getDoctorAndRoom(client, req.user.id);
    if (errorStatus) return fail(errorStatus, errorMessage);

    await client.query(`SELECT pg_advisory_xact_lock($1::int, $2::int)`, [LOCK_NS, roomId]);

    const hd = await client.query(
      `SELECT h.id, h.benh_nhan_id, h.bac_si_id, h.trang_thai, h.phong_kham_id,
              (${CHECKIN_DAY} = ${TODAY_VN}) AS la_hom_nay
       FROM "HangDoi" h
       WHERE h.id = $1
       FOR UPDATE`,
      [queueId]
    );

    if (hd.rowCount === 0) return fail(404, "Không tìm thấy lượt khám trong hàng đợi");
    const row = hd.rows[0];

    // Kiểm tra chặt ownership: đúng bác sĩ đang gọi, đúng phòng ca trực hôm nay
    if (!row.la_hom_nay || row.phong_kham_id !== roomId || row.bac_si_id !== bacSiId) {
      return fail(403, "Bạn không có quyền bắt đầu khám cho lượt khám của bác sĩ hoặc phòng khám khác", "FORBIDDEN_OWNERSHIP");
    }

    // Chỉ cho phép DANG_GOI -> DANG_KHAM (không cho phép CHO_KHAM -> DANG_KHAM)
    if (row.trang_thai !== ST_DANG_GOI) {
      return fail(
        400,
        `Chỉ có thể bắt đầu khám từ trạng thái DANG_GOI (trạng thái hiện tại: ${row.trang_thai})`,
        "INVALID_STATE"
      );
    }

    await client.query(
      `UPDATE "HangDoi"
       SET trang_thai = $1
       WHERE id = $2`,
      [ST_DANG_KHAM, queueId]
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
      await client.query(
        `UPDATE "HoSoBenhAn" SET trang_thai = $1, bac_si_id = COALESCE(bac_si_id, $3) WHERE id = $2`,
        [ST_DANG_KHAM, hoSoId, bacSiId]
      );
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

module.exports = {
  callNextPatient,
  getCurrentCalling,
  recallPatient,
  skipPatient,
  requeuePatient,
  startExamination,
  getQueueConfig,
  xuLyTuDongGoiLai,
};
