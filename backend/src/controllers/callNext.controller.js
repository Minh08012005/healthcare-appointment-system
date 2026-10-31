const pool = require("../config/db");

const ROLE_BAC_SI = "Bác sĩ";
const LANE_ONLINE = "ONLINE";
const LANE_OFFLINE = "OFFLINE";
const ST_CHO_KHAM = "CHO_KHAM";
const ST_DANG_GOI = "DANG_GOI";
// Lượt đã "tiêu thụ" 1A:1B. BO_LUOT / VANG_MAT (gọi thất bại) KHÔNG tính.
const CONSUMED_STATES = ["DANG_GOI", "DANG_KHAM", "DA_XONG"];
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

    // 1. Xác định bác sĩ từ token (client không được truyền benh_nhan_id)
    const bs = await client.query(`SELECT id FROM "BacSi" WHERE tai_khoan_id = $1`, [req.user.id]);
    if (bs.rowCount === 0) {
      return fail(403, "Tài khoản chưa gắn với hồ sơ bác sĩ");
    }
    const bacSiId = bs.rows[0].id;

    // 2. Xác định phòng của bác sĩ hôm nay (khung giờ đang diễn ra, không có thì khung gần nhất)
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

    // 3. Khóa theo phòng: các request "tiếp theo" của cùng phòng chạy lần lượt
    await client.query(`SELECT pg_advisory_xact_lock($1::int, $2::int)`, [LOCK_NS, roomId]);

    // 4. Tỷ lệ A:B từ CauHinhHeThong (không có thì mặc định 1:1)
    const cfg = await client.query(
      `SELECT ti_le_online, ti_le_offline FROM "CauHinhHeThong" ORDER BY id LIMIT 1`
    );
    const a = positiveOr1(cfg.rows[0]?.ti_le_online);
    const b = positiveOr1(cfg.rows[0]?.ti_le_offline);

    // 5. Số lượt đã gọi hôm nay của từng hàng trong phòng
    const counts = await client.query(
      `SELECT h.loai, COUNT(*)::int AS n
       FROM "HangDoi" h
       WHERE h.phong_kham_id = $1 AND ${CHECKIN_DAY} = ${TODAY_VN}
         AND h.trang_thai = ANY($2)
       GROUP BY h.loai`,
      [roomId, CONSUMED_STATES]
    );
    const called = { [LANE_ONLINE]: 0, [LANE_OFFLINE]: 0 };
    counts.rows.forEach((r) => {
      if (called[r.loai] !== undefined) called[r.loai] = r.n;
    });

    // 6. Chọn hàng theo tỷ lệ; hàng đó rỗng thì lấy hàng còn lại
    const preferred = chooseLane(called[LANE_ONLINE], called[LANE_OFFLINE], a, b);
    const lanes = [preferred, preferred === LANE_ONLINE ? LANE_OFFLINE : LANE_ONLINE];

    let picked = null;
    for (const lane of lanes) {
      const cand = await client.query(
        `SELECT h.id
         FROM "HangDoi" h
         WHERE h.phong_kham_id = $1 AND h.loai = $2 AND h.trang_thai = $3
           AND ${CHECKIN_DAY} = ${TODAY_VN}
         ORDER BY h.so_thu_tu ASC, h.thoi_gian_check_in ASC, h.id ASC
         LIMIT 1
         FOR UPDATE`,
        [roomId, lane, ST_CHO_KHAM]
      );
      if (cand.rowCount > 0) {
        picked = cand.rows[0].id;
        break;
      }
    }

    // 7. Không có ai chờ: trả kết quả hợp lệ
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
        },
      });
    }

    // 8. CHO_KHAM -> DANG_GOI, tăng so_lan_goi
    const upd = await client.query(
      `UPDATE "HangDoi"
       SET trang_thai = $2, so_lan_goi = COALESCE(so_lan_goi, 0) + 1
       WHERE id = $1 AND trang_thai = $3
       RETURNING id`,
      [picked, ST_DANG_GOI, ST_CHO_KHAM]
    );
    if (upd.rowCount === 0) {
      return fail(409, "Lượt khám vừa được xử lý, vui lòng thử lại");
    }

    // 9. Dữ liệu trả về
    const info = await client.query(
      `SELECT h.id, h.so_thu_tu, h.loai, h.trang_thai, h.so_lan_goi, h.so_lan_bo_luot,
              h.thoi_gian_check_in, h.dat_lich_id, h.phong_kham_id,
              bn.id AS bn_id, bn.ho_ten, to_char(bn.ngay_sinh, 'YYYY-MM-DD') AS ngay_sinh,
              bn.gioi_tinh, bn.ma_bhyt,
              d.ma_dat_lich, to_char(d.gio_kham, 'HH24:MI:SS') AS gio_kham, d.trieu_chung,
              pk.ten_phong
       FROM "HangDoi" h
       JOIN "BenhNhan" bn ON bn.id = h.benh_nhan_id
       LEFT JOIN "DatLichKham" d ON d.id = h.dat_lich_id
       LEFT JOIN "PhongKham" pk ON pk.id = h.phong_kham_id
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
        },
        patient: {
          id: i.bn_id,
          ho_ten: i.ho_ten,
          ngay_sinh: i.ngay_sinh,
          gioi_tinh: i.gioi_tinh,
          ma_bhyt: i.ma_bhyt,
        },
        appointment: i.ma_dat_lich
          ? { ma_dat_lich: i.ma_dat_lich, gio_kham: i.gio_kham, trieu_chung: i.trieu_chung }
          : null,
        room: { id: i.phong_kham_id, ten_phong: i.ten_phong },
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

module.exports = { callNextPatient };