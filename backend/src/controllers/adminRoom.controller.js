const pool = require("../config/db");

// C6-04 (UC-029): Admin quản lý phòng khám / phòng xét nghiệm và gán nhân viên vào phòng.
// Dùng mô hình hiện tại: PhongKham + TaiKhoan.phong_kham_id (1 tài khoản tối đa 1 phòng).
// Không sửa schema, không sửa Lab C5 (Lab đọc TaiKhoan.phong_kham_id ở mỗi request).
const ROLE_ADMIN = "Quản trị viên";
const STATUS_ACTIVE = "HoatDong";
const LOAI_KHAM = "Phòng khám";
const LOAI_XN = "Phòng xét nghiệm"; // giữ đúng chuỗi seed: C4-07 lọc phòng XN theo chữ "xét nghiệm"
const LOAI_PHONG = [LOAI_KHAM, LOAI_XN];
// Vai trò được gán phòng (theo bàn giao C6-03) -> loại phòng được phép
const ROLE_ROOM_TYPE = { "Xét nghiệm": LOAI_XN, "Lễ tân": LOAI_KHAM };
const MAX_TEN = 100; // khớp VARCHAR(100)
const INT_MAX = 2147483647;
const LOCK_KEY = 6004; // serialize ghi phòng/gán nhân viên (chống trùng tên, gán đồng thời)

const parseId = (v) => {
  const s = typeof v === "number" ? String(v) : v;
  if (typeof s !== "string" || !/^[1-9]\d{0,9}$/.test(s)) return null;
  const n = Number(s);
  return n <= INT_MAX ? n : null;
};

const fail = (res, status, message, code, data) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}), ...(data ? { data } : {}) });
const bad = (status, message, code, data) => ({
  status,
  body: { success: false, message, ...(code ? { code } : {}), ...(data ? { data } : {}) },
});
const ok = (status, data) => ({ status, body: { success: true, data } });

const onlyAdmin = (req, res) => {
  if (!req.user || req.user.role !== ROLE_ADMIN) {
    fail(res, 403, "Chỉ quản trị viên mới được thực hiện thao tác này");
    return false;
  }
  return true;
};

const SELECT_ROOMS = `
  SELECT pk.id, pk.ten_phong, pk.loai_phong, pk.chuyen_khoa_id, ck.ten_chuyen_khoa,
         COALESCE(
           json_agg(
             json_build_object('id', tk.id, 'ten_dang_nhap', tk.ten_dang_nhap,
                               'vai_tro', vt.ten_vai_tro, 'trang_thai', tk.trang_thai)
             ORDER BY tk.ten_dang_nhap
           ) FILTER (WHERE tk.id IS NOT NULL),
           '[]'
         ) AS nhan_vien
  FROM "PhongKham" pk
  LEFT JOIN "ChuyenKhoa" ck ON ck.id = pk.chuyen_khoa_id
  LEFT JOIN "TaiKhoan" tk ON tk.phong_kham_id = pk.id
  LEFT JOIN "VaiTro" vt ON vt.id = tk.vai_tro_id`;

const toDto = (r) => ({
  id: r.id,
  ten_phong: r.ten_phong,
  loai_phong: r.loai_phong,
  chuyen_khoa: r.chuyen_khoa_id ? { id: r.chuyen_khoa_id, ten_chuyen_khoa: r.ten_chuyen_khoa } : null,
  so_nhan_vien: r.nhan_vien.length,
  nhan_vien: r.nhan_vien,
});

const findRoom = async (db, id) => {
  const r = await db.query(`${SELECT_ROOMS} WHERE pk.id = $1 GROUP BY pk.id, ck.ten_chuyen_khoa`, [id]);
  return r.rowCount ? toDto(r.rows[0]) : null;
};

// Số dữ liệu đang liên kết tới phòng (FK thường, không có ON DELETE CASCADE)
const countRefs = async (db, id) =>
  (
    await db.query(
      `SELECT (SELECT COUNT(*)::int FROM "LichKhamBacSi" WHERE phong_kham_id = $1) AS so_lich_truc,
              (SELECT COUNT(*)::int FROM "DatLichKham" WHERE phong_kham_id = $1) AS so_lich_hen,
              (SELECT COUNT(*)::int FROM "HangDoi" WHERE phong_kham_id = $1) AS so_luot_kham,
              (SELECT COUNT(*)::int FROM "ChiDinhXetNghiem" WHERE phong_kham_id = $1) AS so_chi_dinh,
              (SELECT COUNT(*)::int FROM "TaiKhoan" WHERE phong_kham_id = $1) AS so_nhan_vien`,
      [id]
    )
  ).rows[0];

// Trả { value } hoặc { message }
const parseBody = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { message: "Body phải là JSON object" };
  if (typeof body.ten_phong !== "string" || body.ten_phong.trim() === "") {
    return { message: "ten_phong là bắt buộc và không được để trống" };
  }
  const ten = body.ten_phong.trim().replace(/\s+/g, " ");
  if (ten.length > MAX_TEN) return { message: `ten_phong không được vượt quá ${MAX_TEN} ký tự` };
  if (!LOAI_PHONG.includes(body.loai_phong)) {
    return { message: `loai_phong chỉ nhận "${LOAI_KHAM}" hoặc "${LOAI_XN}"` };
  }

  let chuyenKhoaId = null;
  const raw = body.chuyen_khoa_id;
  if (body.loai_phong === LOAI_KHAM) {
    chuyenKhoaId = parseId(raw);
    if (!chuyenKhoaId) return { message: "Phòng khám bắt buộc chọn chuyên khoa hợp lệ (chuyen_khoa_id)" };
  } else if (raw !== undefined && raw !== null && raw !== "") {
    return { message: "Phòng xét nghiệm không gắn chuyên khoa (chuyen_khoa_id phải để trống)" };
  }
  return { value: { ten, loai: body.loai_phong, chuyenKhoaId } };
};

// Chạy trong transaction có khóa ghi phòng
const withWriteTx = async (res, fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock($1::bigint)`, [LOCK_KEY]);
    const out = await fn(client);
    await client.query(out.status >= 400 ? "ROLLBACK" : "COMMIT");
    return res.status(out.status).json(out.body);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23503") {
      return fail(res, 409, "Phòng còn dữ liệu liên kết, không thể thực hiện thao tác", "HAS_REFERENCES");
    }
    console.error(err);
    return fail(res, 500, "Lỗi server");
  } finally {
    client.release();
  }
};

// Kiểm tra trùng tên (không phân biệt hoa/thường, bỏ khoảng trắng thừa) + chuyên khoa tồn tại
const checkNameAndSpecialty = async (c, value, excludeId) => {
  const dup = await c.query(
    `SELECT id FROM "PhongKham"
     WHERE lower(regexp_replace(btrim(ten_phong), '\\s+', ' ', 'g')) = lower($1)
       AND ($2::int IS NULL OR id <> $2)
     LIMIT 1`,
    [value.ten, excludeId]
  );
  if (dup.rowCount) return bad(409, "Tên phòng đã tồn tại. Vui lòng nhập tên khác.", "DUPLICATE_NAME");
  if (value.chuyenKhoaId) {
    const ck = await c.query(`SELECT id FROM "ChuyenKhoa" WHERE id = $1`, [value.chuyenKhoaId]);
    if (!ck.rowCount) return bad(400, "Chuyên khoa không tồn tại", "INVALID_SPECIALTY");
  }
  return null;
};

// GET /api/admin/rooms?loai_phong=
const listRooms = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  const loai = req.query.loai_phong;
  if (loai !== undefined && loai !== "" && !LOAI_PHONG.includes(loai)) {
    return fail(res, 400, `loai_phong chỉ nhận "${LOAI_KHAM}" hoặc "${LOAI_XN}"`);
  }
  try {
    const r = await pool.query(
      `${SELECT_ROOMS}
       WHERE ($1::text IS NULL OR pk.loai_phong = $1)
       GROUP BY pk.id, ck.ten_chuyen_khoa
       ORDER BY pk.loai_phong, pk.ten_phong, pk.id`,
      [loai || null]
    );
    return res.json({ success: true, data: { items: r.rows.map(toDto) } });
  } catch (err) {
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

// GET /api/admin/rooms/:id
const getRoom = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "id phòng không hợp lệ");
  try {
    const room = await findRoom(pool, id);
    if (!room) return fail(res, 404, "Không tìm thấy phòng");
    return res.json({ success: true, data: room });
  } catch (err) {
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

// POST /api/admin/rooms { ten_phong, loai_phong, chuyen_khoa_id? }
const createRoom = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  const parsed = parseBody(req.body);
  if (parsed.message) return fail(res, 400, parsed.message);
  const v = parsed.value;

  return withWriteTx(res, async (c) => {
    const err = await checkNameAndSpecialty(c, v, null);
    if (err) return err;
    const r = await c.query(
      `INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong) VALUES ($1, $2, $3) RETURNING id`,
      [v.ten, v.chuyenKhoaId, v.loai]
    );
    return ok(201, await findRoom(c, r.rows[0].id));
  });
};

// PUT /api/admin/rooms/:id { ten_phong, loai_phong, chuyen_khoa_id? }
const updateRoom = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "id phòng không hợp lệ");
  const parsed = parseBody(req.body);
  if (parsed.message) return fail(res, 400, parsed.message);
  const v = parsed.value;

  return withWriteTx(res, async (c) => {
    const cur = await c.query(`SELECT id, loai_phong, chuyen_khoa_id FROM "PhongKham" WHERE id = $1 FOR UPDATE`, [id]);
    if (!cur.rowCount) return bad(404, "Không tìm thấy phòng");
    const old = cur.rows[0];

    const err = await checkNameAndSpecialty(c, v, id);
    if (err) return err;

    const typeChanged = old.loai_phong !== v.loai;
    const specialtyChanged = (old.chuyen_khoa_id ?? null) !== v.chuyenKhoaId;
    if (typeChanged || specialtyChanged) {
      const refs = await countRefs(c, id);
      const usedBySchedule = refs.so_lich_truc + refs.so_lich_hen + refs.so_luot_kham;
      // Đổi loại: phòng đã có lịch/lượt khám/chỉ định/nhân viên -> dữ liệu cũ sẽ sai loại
      if (typeChanged && usedBySchedule + refs.so_chi_dinh + refs.so_nhan_vien > 0) {
        return bad(
          409,
          "Không thể đổi loại phòng vì phòng đã có lịch trực, lịch hẹn, lượt khám, chỉ định xét nghiệm hoặc nhân viên được gán",
          "ROOM_TYPE_LOCKED",
          refs
        );
      }
      // Đổi chuyên khoa: phòng đã có lịch trực/lịch hẹn/lượt khám -> lệch chuyên khoa với dữ liệu cũ
      if (!typeChanged && specialtyChanged && usedBySchedule > 0) {
        return bad(
          409,
          "Không thể đổi chuyên khoa vì phòng đã có lịch trực, lịch hẹn hoặc lượt khám",
          "SPECIALTY_LOCKED",
          refs
        );
      }
    }

    await c.query(`UPDATE "PhongKham" SET ten_phong = $1, chuyen_khoa_id = $2, loai_phong = $3 WHERE id = $4`, [
      v.ten,
      v.chuyenKhoaId,
      v.loai,
      id,
    ]);
    return ok(200, await findRoom(c, id));
  });
};

// DELETE /api/admin/rooms/:id — chặn nếu còn bất kỳ dữ liệu liên kết nào
const deleteRoom = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "id phòng không hợp lệ");

  return withWriteTx(res, async (c) => {
    // FOR UPDATE xung đột với FOR KEY SHARE của FK -> không ai gắn dữ liệu mới vào phòng lúc đang xóa
    const cur = await c.query(`SELECT id, ten_phong FROM "PhongKham" WHERE id = $1 FOR UPDATE`, [id]);
    if (!cur.rowCount) return bad(404, "Không tìm thấy phòng");

    const refs = await countRefs(c, id);
    const reasons = [];
    if (refs.so_lich_truc) reasons.push(`${refs.so_lich_truc} lịch trực`);
    if (refs.so_lich_hen) reasons.push(`${refs.so_lich_hen} lịch hẹn`);
    if (refs.so_luot_kham) reasons.push(`${refs.so_luot_kham} lượt khám`);
    if (refs.so_chi_dinh) reasons.push(`${refs.so_chi_dinh} chỉ định xét nghiệm`);
    if (refs.so_nhan_vien) reasons.push(`${refs.so_nhan_vien} nhân viên được gán`);
    if (reasons.length) {
      return bad(
        409,
        `Không thể xóa phòng ${cur.rows[0].ten_phong}: phòng còn ${reasons.join(", ")}`,
        "HAS_REFERENCES",
        refs
      );
    }
    await c.query(`DELETE FROM "PhongKham" WHERE id = $1`, [id]);
    return ok(200, { id, message: "Đã xóa phòng" });
  });
};

// PUT /api/admin/rooms/:id/staff/:accountId { confirm_transfer?: true } — gán / chuyển nhân viên
const assignStaff = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  const roomId = parseId(req.params.id);
  const accountId = parseId(req.params.accountId);
  if (!roomId) return fail(res, 400, "id phòng không hợp lệ");
  if (!accountId) return fail(res, 400, "id tài khoản không hợp lệ");
  const confirm = req.body?.confirm_transfer === true;

  return withWriteTx(res, async (c) => {
    const room = await c.query(`SELECT id, ten_phong, loai_phong FROM "PhongKham" WHERE id = $1 FOR UPDATE`, [roomId]);
    if (!room.rowCount) return bad(404, "Không tìm thấy phòng");
    const target = room.rows[0];

    const acc = await c.query(
      `SELECT tk.id, tk.ten_dang_nhap, tk.trang_thai, tk.phong_kham_id, vt.ten_vai_tro, pk.ten_phong AS ten_phong_hien_tai
       FROM "TaiKhoan" tk
       JOIN "VaiTro" vt ON vt.id = tk.vai_tro_id
       LEFT JOIN "PhongKham" pk ON pk.id = tk.phong_kham_id
       WHERE tk.id = $1
       FOR UPDATE OF tk`,
      [accountId]
    );
    if (!acc.rowCount) return bad(404, "Không tìm thấy tài khoản");
    const a = acc.rows[0];

    const allowedType = ROLE_ROOM_TYPE[a.ten_vai_tro];
    if (!allowedType) {
      return bad(400, `Vai trò "${a.ten_vai_tro}" không được gán vào phòng`, "ROLE_NOT_ASSIGNABLE");
    }
    if (target.loai_phong !== allowedType) {
      return bad(
        400,
        `Tài khoản vai trò "${a.ten_vai_tro}" chỉ được gán vào ${allowedType.toLowerCase()}`,
        "ROOM_TYPE_MISMATCH"
      );
    }
    if (a.trang_thai !== STATUS_ACTIVE) {
      return bad(400, "Tài khoản đang bị khóa, không thể gán vào phòng", "ACCOUNT_INACTIVE");
    }

    const dto = (phongId, tenPhong) => ({
      tai_khoan: { id: a.id, ten_dang_nhap: a.ten_dang_nhap, vai_tro: a.ten_vai_tro },
      phong_cu: a.phong_kham_id ? { id: a.phong_kham_id, ten_phong: a.ten_phong_hien_tai } : null,
      phong_moi: { id: phongId, ten_phong: tenPhong },
    });

    if (a.phong_kham_id === roomId) {
      return ok(200, { ...dto(roomId, target.ten_phong), message: "Nhân viên đã thuộc phòng này" });
    }
    if (a.phong_kham_id && !confirm) {
      return bad(
        409,
        `Tài khoản ${a.ten_dang_nhap} đang thuộc phòng ${a.ten_phong_hien_tai}. Xác nhận để chuyển sang phòng ${target.ten_phong}.`,
        "ACCOUNT_IN_OTHER_ROOM",
        { phong_hien_tai: { id: a.phong_kham_id, ten_phong: a.ten_phong_hien_tai } }
      );
    }

    // 1 cột phong_kham_id -> gán phòng mới đồng nghĩa không còn thuộc phòng cũ
    await c.query(`UPDATE "TaiKhoan" SET phong_kham_id = $1 WHERE id = $2`, [roomId, accountId]);
    return ok(200, dto(roomId, target.ten_phong));
  });
};

// DELETE /api/admin/rooms/:id/staff/:accountId — gỡ nhân viên khỏi phòng
const unassignStaff = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  const roomId = parseId(req.params.id);
  const accountId = parseId(req.params.accountId);
  if (!roomId) return fail(res, 400, "id phòng không hợp lệ");
  if (!accountId) return fail(res, 400, "id tài khoản không hợp lệ");

  return withWriteTx(res, async (c) => {
    const acc = await c.query(`SELECT id, phong_kham_id FROM "TaiKhoan" WHERE id = $1 FOR UPDATE`, [accountId]);
    if (!acc.rowCount) return bad(404, "Không tìm thấy tài khoản");
    if (acc.rows[0].phong_kham_id !== roomId) {
      return bad(409, "Tài khoản không thuộc phòng này", "NOT_IN_ROOM");
    }
    await c.query(`UPDATE "TaiKhoan" SET phong_kham_id = NULL WHERE id = $1`, [accountId]);
    return ok(200, { tai_khoan_id: accountId, phong_kham_id: roomId, message: "Đã gỡ nhân viên khỏi phòng" });
  });
};

module.exports = { listRooms, getRoom, createRoom, updateRoom, deleteRoom, assignStaff, unassignStaff };