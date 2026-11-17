// C6-09 - Admin quản lý Tin tức và Quy trình khám
// Chạy: node scripts/test-c6-09.js   (backend phải đang chạy ở localhost:3000)

const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");
const { STATUS, MO_TA_REQUIRED, THU_TU_MAX, TITLE_MAX } = require("../src/controllers/adminContent.controller");

const BASE = "http://localhost:3000/api";
const STATUS_ACTIVE = "HoatDong";
const sfx = Date.now().toString().slice(-6);
const P = `ZZN${sfx}`;
const N = "/admin/content/news";
const S = "/admin/content/procedure-steps";
let pass = 0, fail = 0, pwHash;

const check = (label, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} ${extra}`);
};

const api = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const get = (p, t) => api("GET", p, undefined, t);
const post = (p, t, b) => api("POST", p, b === undefined ? {} : b, t);
const put = (p, t, b) => api("PUT", p, b === undefined ? {} : b, t);
const patch = (p, t, b) => api("PATCH", p, b === undefined ? {} : b, t);
const del = (p, t) => api("DELETE", p, undefined, t);

const mkUser = async (roleName, tag) => {
  const roleId = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = $1`, [roleName])).rows[0].id;
  const username = `zzn${sfx}_${tag}`;
  await pool.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai) VALUES ($1,$2,$3,$4)`,
    [username, pwHash, roleId, STATUS_ACTIVE]
  );
  return (await api("POST", "/auth/login", { username, password: "123456" })).data?.data?.token;
};

const cnt = async (sql, args) => Number((await pool.query(sql, args)).rows[0].count);
const countNews = () => cnt(`SELECT COUNT(*) FROM "TinTuc" WHERE tieu_de LIKE $1`, [`${P}%`]);
const countSteps = () => cnt(`SELECT COUNT(*) FROM "QuyTrinhKham" WHERE tieu_de_buoc LIKE $1`, [`${P}%`]);
const maxOrder = async () => Number((await pool.query(`SELECT COALESCE(MAX(thu_tu),0) AS m FROM "QuyTrinhKham"`)).rows[0].m);
const dbNews = async (id) => (await pool.query(`SELECT tieu_de, noi_dung, trang_thai FROM "TinTuc" WHERE id = $1`, [id])).rows[0];
const dbStep = async (id) => (await pool.query(`SELECT tieu_de_buoc, mo_ta, thu_tu FROM "QuyTrinhKham" WHERE id = $1`, [id])).rows[0];

const cleanup = async () => {
  try {
    // Dọn cả dữ liệu rác của các lần chạy hỏng trước đó (tiền tố ZZN / zzn)
    await pool.query(`DELETE FROM "TinTuc" WHERE tieu_de LIKE 'ZZN%'`);
    await pool.query(`DELETE FROM "QuyTrinhKham" WHERE tieu_de_buoc LIKE 'ZZN%'`);
    await pool.query(`DELETE FROM "BenhNhan" WHERE tai_khoan_id IN (SELECT id FROM "TaiKhoan" WHERE ten_dang_nhap LIKE 'zzn%')`);
    await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE 'zzn%'`);
    const l = {
      tt: await cnt(`SELECT COUNT(*) FROM "TinTuc" WHERE tieu_de LIKE 'ZZN%'`),
      qt: await cnt(`SELECT COUNT(*) FROM "QuyTrinhKham" WHERE tieu_de_buoc LIKE 'ZZN%'`),
      tk: await cnt(`SELECT COUNT(*) FROM "TaiKhoan" WHERE ten_dang_nhap LIKE 'zzn%'`),
    };
    console.log(`\nDọn dữ liệu xong. Còn sót: TinTuc=${l.tt}, QuyTrinhKham=${l.qt}, TaiKhoan=${l.tk} (phải = 0)`);
  } catch (e) {
    console.error("LỖI khi dọn dữ liệu, hãy dọn tay:", e.message);
  }
};

(async () => {
  try {
    pwHash = await bcrypt.hash("123456", 10);
    const ad = await mkUser("Quản trị viên", "ad");
    const docT = await mkUser("Bác sĩ", "doc");
    const ltT = await mkUser("Lễ tân", "lt");
    const xnT = await mkUser("Xét nghiệm", "xn");
    const ptName = `zzn${sfx}_pt`;
    await api("POST", "/auth/register", { username: ptName, password: "123456", ho_ten: "ZZ Test Patient" });
    const ptT = (await api("POST", "/auth/login", { username: ptName, password: "123456" })).data.data.token;

    // ================= 1. Xác thực và vai trò =================
    let r = await get(`${N}`);
    check("GET news - không đăng nhập -> 401", r.status === 401, `(nhận ${r.status})`);
    r = await get(`${S}`);
    check("GET procedure-steps - không đăng nhập -> 401", r.status === 401, `(nhận ${r.status})`);
    for (const [tag, tok] of [["bệnh nhân", ptT], ["bác sĩ", docT], ["lễ tân", ltT], ["xét nghiệm", xnT]]) {
      const codes = [
        (await get(N, tok)).status,
        (await post(N, tok, { tieu_de: `${P} forbid`, noi_dung: "x" })).status,
        (await put(`${N}/1`, tok, { tieu_de: `${P} forbid` })).status,
        (await patch(`${N}/1/status`, tok, { trang_thai: STATUS.HIDE })).status,
        (await del(`${N}/1`, tok)).status,
        (await get(S, tok)).status,
        (await post(S, tok, { tieu_de_buoc: `${P} forbid`, mo_ta: "x", thu_tu: 1 })).status,
        (await put(`${S}/1`, tok, { tieu_de_buoc: `${P} forbid` })).status,
        (await del(`${S}/1`, tok)).status,
      ];
      check(`Vai trò ${tag}: mọi API content -> 403`, codes.every((c) => c === 403), JSON.stringify(codes));
    }
    check("Bị từ chối thì không tạo dữ liệu", (await countNews()) === 0 && (await countSteps()) === 0);

    // ================= 2. TIN TỨC =================
    r = await post(N, ad, { tieu_de: `  ${P} Tin 1  `, noi_dung: "  Noi dung 1  ", ngay_dang: "2026-01-01" });
    check("Tạo tin tức -> 201", r.status === 201, `(nhận ${r.status}) ${JSON.stringify(r.data?.message || "")}`);
    const n1 = r.data?.data;
    check("Tin có đủ id, tieu_de, noi_dung, ngay_dang, trang_thai; trim; mặc định Hiển thị", n1?.id > 0 && n1.tieu_de === `${P} Tin 1` && n1.noi_dung === "Noi dung 1" && !!n1.ngay_dang && n1.trang_thai === STATUS.SHOW, JSON.stringify(n1));
    r = await post(N, ad, { tieu_de: `${P} Tin 2`, noi_dung: "Noi dung 2", ngay_dang: "2026-02-01", trang_thai: STATUS.HIDE });
    check("Tạo tin với trang_thai Ẩn -> 201", r.status === 201 && r.data?.data?.trang_thai === STATUS.HIDE, `(nhận ${r.status})`);
    const n2 = r.data?.data;
    r = await post(N, ad, { tieu_de: `${P} Tin 3`, noi_dung: "Noi dung 3" });
    check("Tạo tin không gửi ngay_dang -> tự gán ngày đăng", r.status === 201 && !!r.data?.data?.ngay_dang, `(nhận ${r.status})`);
    const n3 = r.data?.data;

    const nBefore = await countNews();
    const badNews = [
      [{ noi_dung: "x" }, "thiếu tiêu đề"],
      [{ tieu_de: "   ", noi_dung: "x" }, "tiêu đề toàn khoảng trắng"],
      [{ tieu_de: 123, noi_dung: "x" }, "tiêu đề sai kiểu"],
      [{ tieu_de: `${P} ${"a".repeat(TITLE_MAX)}`, noi_dung: "x" }, "tiêu đề quá dài"],
      [{ tieu_de: `${P} X` }, "thiếu nội dung"],
      [{ tieu_de: `${P} X`, noi_dung: "   " }, "nội dung toàn khoảng trắng"],
      [{ tieu_de: `${P} X`, noi_dung: 123 }, "nội dung sai kiểu"],
      [{ tieu_de: `${P} X`, noi_dung: "x", trang_thai: "ABC" }, "trạng thái không hợp lệ"],
      [{ tieu_de: `${P} X`, noi_dung: "x", ngay_dang: "khong-phai-ngay" }, "ngay_dang không hợp lệ"],
      [{ tieu_de: `${P} X`, noi_dung: "x", ngay_dang: "2026-13-45" }, "ngay_dang vô lý"],
      [[], "body là mảng"],
    ];
    for (const [body, tag] of badNews) {
      r = await post(N, ad, body);
      check(`Tạo tin - ${tag} -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    check("Input lỗi không tạo thêm tin", (await countNews()) === nBefore);

    // ---- Đọc ----
    r = await get(`${N}?q=${encodeURIComponent(P)}`, ad);
    const items = r.data?.data?.items || [];
    const pos = (id) => items.findIndex((x) => x.id === id);
    check("Danh sách có đủ 3 tin vừa tạo", r.status === 200 && [n1.id, n2.id, n3.id].every((i) => pos(i) >= 0), `(nhận ${r.status})`);
    check("Danh sách sắp xếp tin mới nhất trước (ngay_dang giảm dần)", pos(n3.id) < pos(n2.id) && pos(n2.id) < pos(n1.id), JSON.stringify(items.map((x) => x.id)));
    check("Mỗi item đủ field contract", items.every((x) => ["id", "tieu_de", "noi_dung", "ngay_dang", "trang_thai"].every((k) => k in x)));
    r = await get(`${N}?trang_thai=${STATUS.HIDE}&q=${encodeURIComponent(P)}`, ad);
    check("Lọc trang_thai = Ẩn chỉ trả tin Ẩn (để Public phân biệt)", JSON.stringify((r.data?.data?.items || []).map((x) => x.id)) === JSON.stringify([n2.id]), JSON.stringify((r.data?.data?.items || []).map((x) => x.id)));
    r = await get(`${N}?trang_thai=${STATUS.SHOW}&q=${encodeURIComponent(P)}`, ad);
    const showIds = (r.data?.data?.items || []).map((x) => x.id);
    check("Lọc trang_thai = Hiển thị chỉ trả tin Hiển thị", showIds.includes(n1.id) && showIds.includes(n3.id) && !showIds.includes(n2.id));
    r = await get(`${N}?q=${encodeURIComponent(`${P} Tin 1`)}`, ad);
    check("Tìm theo tiêu đề", (r.data?.data?.items || []).length === 1 && r.data.data.items[0].id === n1.id);
    r = await get(`${N}?q=%25`, ad);
    check("q=% được coi là ký tự thường, không khớp tất cả", r.status === 200 && (r.data?.data?.items || []).length === 0, `(nhận ${r.status})`);
    r = await get(`${N}?trang_thai=ABC`, ad);
    check("Lọc trang_thai không hợp lệ -> 400", r.status === 400, `(nhận ${r.status})`);
    r = await get(`${N}?limit=0`, ad);
    check("limit=0 -> 400", r.status === 400, `(nhận ${r.status})`);
    r = await get(`${N}/${n1.id}`, ad);
    check("Chi tiết tin -> 200", r.status === 200 && r.data?.data?.id === n1.id, `(nhận ${r.status})`);
    r = await get(`${N}/999999999`, ad);
    check("Chi tiết tin không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await get(`${N}/abc`, ad);
    check("Chi tiết id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);

    // ---- Sửa ----
    r = await put(`${N}/${n1.id}`, ad, { tieu_de: `${P} Tin 1 sua` });
    check("Sửa tiêu đề -> 200, nội dung giữ nguyên", r.status === 200 && r.data?.data?.tieu_de === `${P} Tin 1 sua` && r.data.data.noi_dung === "Noi dung 1", `(nhận ${r.status})`);
    r = await put(`${N}/${n1.id}`, ad, { noi_dung: "Noi dung sua" });
    check("Sửa nội dung -> 200", r.status === 200 && r.data?.data?.noi_dung === "Noi dung sua", `(nhận ${r.status})`);
    check("DB: dữ liệu tin đúng sau khi sửa", (await dbNews(n1.id)).tieu_de === `${P} Tin 1 sua` && (await dbNews(n1.id)).noi_dung === "Noi dung sua");
    for (const [body, tag] of [[{}, "body rỗng"], [{ tieu_de: "   " }, "tiêu đề trống"], [{ noi_dung: "" }, "nội dung trống"], [{ trang_thai: "XYZ" }, "trạng thái sai"], [{ ngay_dang: "abc" }, "ngay_dang sai"]]) {
      r = await put(`${N}/${n1.id}`, ad, body);
      check(`Sửa tin - ${tag} -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    check("  -> dữ liệu không bị đổi bởi request lỗi", (await dbNews(n1.id)).tieu_de === `${P} Tin 1 sua`);
    r = await put(`${N}/999999999`, ad, { tieu_de: "x" });
    check("Sửa tin không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await put(`${N}/abc`, ad, { tieu_de: "x" });
    check("Sửa id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);

    // ---- Hiển thị / Ẩn ----
    r = await patch(`${N}/${n1.id}/status`, ad, { trang_thai: STATUS.HIDE });
    check("Chuyển Hiển thị -> Ẩn -> 200", r.status === 200 && r.data?.data?.trang_thai === STATUS.HIDE, `(nhận ${r.status})`);
    check("DB: trạng thái Ẩn", (await dbNews(n1.id)).trang_thai === STATUS.HIDE);
    r = await patch(`${N}/${n1.id}/status`, ad, { trang_thai: STATUS.HIDE });
    check("Ẩn lại tin đã Ẩn -> 200 (idempotent)", r.status === 200 && r.data?.data?.trang_thai === STATUS.HIDE, `(nhận ${r.status})`);
    r = await patch(`${N}/${n1.id}/status`, ad, { trang_thai: STATUS.SHOW });
    check("Chuyển Ẩn -> Hiển thị -> 200", r.status === 200 && r.data?.data?.trang_thai === STATUS.SHOW, `(nhận ${r.status})`);
    check("DB: trạng thái Hiển thị", (await dbNews(n1.id)).trang_thai === STATUS.SHOW);
    for (const [body, tag] of [[{}, "thiếu trang_thai"], [{ trang_thai: "ABC" }, "trang_thai không hợp lệ"], [{ trang_thai: 1 }, "sai kiểu"]]) {
      r = await patch(`${N}/${n1.id}/status`, ad, body);
      check(`Đổi trạng thái - ${tag} -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    r = await patch(`${N}/999999999/status`, ad, { trang_thai: STATUS.HIDE });
    check("Đổi trạng thái tin không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await patch(`${N}/abc/status`, ad, { trang_thai: STATUS.HIDE });
    check("Đổi trạng thái id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);

    // ---- Xóa ----
    r = await del(`${N}/${n2.id}`, ad);
    check("Xóa tin -> 200", r.status === 200, `(nhận ${r.status})`);
    check("DB: tin đã bị xóa", !(await dbNews(n2.id)));
    r = await del(`${N}/${n2.id}`, ad);
    check("Xóa lại tin đã xóa -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await del(`${N}/abc`, ad);
    check("Xóa id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);
    check("Xóa một tin không ảnh hưởng tin khác", !!(await dbNews(n1.id)) && !!(await dbNews(n3.id)));

    // ================= 3. QUY TRÌNH KHÁM =================
    const base = await maxOrder();
    const mkStep = (tag, thuTu, extra = {}) => post(S, ad, { tieu_de_buoc: `${P} ${tag}`, mo_ta: `Mo ta ${tag}`, ...(thuTu !== undefined ? { thu_tu: thuTu } : {}), ...extra });

    // tạo lộn xộn thứ tự để kiểm tra sort
    r = await mkStep("Buoc C", base + 3);
    check("Tạo bước -> 201", r.status === 201, `(nhận ${r.status}) ${JSON.stringify(r.data?.message || "")}`);
    const sC = r.data?.data;
    r = await mkStep("Buoc A", base + 1);
    const sA = r.data?.data;
    r = await mkStep("Buoc B", base + 2);
    const sB = r.data?.data;
    check("Bước có đủ id, tieu_de_buoc, mo_ta, thu_tu", sA?.id > 0 && sA.tieu_de_buoc === `${P} Buoc A` && sA.mo_ta === "Mo ta Buoc A" && sA.thu_tu === base + 1, JSON.stringify(sA));
    r = await post(S, ad, { tieu_de_buoc: `  ${P} Trim  `, mo_ta: "  mo ta  " });
    const sT = r.data?.data;
    check("Không gửi thu_tu -> tự gán, có trim", r.status === 201 && sT?.tieu_de_buoc === `${P} Trim` && sT.mo_ta === "mo ta" && sT.thu_tu > base + 3, `(nhận ${r.status}) ${JSON.stringify(sT)}`);

    // ---- Danh sách + sort ----
    r = await get(S, ad);
    const steps = r.data?.data?.items || [];
    const own = steps.filter((x) => x.tieu_de_buoc.startsWith(P) && [sA.id, sB.id, sC.id].includes(x.id)).map((x) => x.thu_tu);
    check("Danh sách trả đủ field contract", r.status === 200 && steps.every((x) => ["id", "tieu_de_buoc", "mo_ta", "thu_tu"].every((k) => k in x)), `(nhận ${r.status})`);
    check("Danh sách sort thu_tu ASC (3 bước tạo lộn xộn ra A, B, C)", JSON.stringify(own) === JSON.stringify([base + 1, base + 2, base + 3]), JSON.stringify(own));
    check("Toàn bộ danh sách tăng dần theo thu_tu", steps.every((x, i) => i === 0 || steps[i - 1].thu_tu <= x.thu_tu));

    // ---- Trùng thu_tu ----
    const cBefore = await countSteps();
    r = await mkStep("Trung", base + 1);
    check("thu_tu trùng bước vừa tạo -> 409 DUPLICATE_ORDER", r.status === 409 && r.data.code === "DUPLICATE_ORDER", `(nhận ${r.status})`);
    check("  -> không tạo thêm bước", (await countSteps()) === cBefore);
    const seed = (await pool.query(`SELECT thu_tu FROM "QuyTrinhKham" WHERE tieu_de_buoc NOT LIKE $1 LIMIT 1`, [`${P}%`])).rows[0];
    if (seed) {
      r = await mkStep("Trung seed", seed.thu_tu);
      check("thu_tu trùng bước có sẵn trong hệ thống -> 409", r.status === 409, `(nhận ${r.status})`);
    }
    const rsC = await Promise.all([1, 2, 3, 4].map((i) => mkStep(`Race ${i}`, base + 10)));
    check("Tạo trùng thu_tu đồng thời: đúng 1 thành công, 3 bị 409", rsC.filter((x) => x.status === 201).length === 1 && rsC.filter((x) => x.status === 409).length === 3, JSON.stringify(rsC.map((x) => x.status)));
    check("Đồng thời: DB chỉ có 1 bước ở thu_tu đó", (await cnt(`SELECT COUNT(*) FROM "QuyTrinhKham" WHERE thu_tu = $1`, [base + 10])) === 1);

    // ---- Validate ----
    const cBefore2 = await countSteps();
    const badSteps = [
      [{ mo_ta: "x", thu_tu: base + 20 }, "thiếu tiêu đề"],
      [{ tieu_de_buoc: "   ", mo_ta: "x", thu_tu: base + 20 }, "tiêu đề toàn khoảng trắng"],
      [{ tieu_de_buoc: 123, mo_ta: "x", thu_tu: base + 20 }, "tiêu đề sai kiểu"],
      [{ tieu_de_buoc: `${P} X`, mo_ta: 123, thu_tu: base + 20 }, "mo_ta sai kiểu"],
      [{ tieu_de_buoc: `${P} X`, mo_ta: "x", thu_tu: 0 }, "thu_tu = 0"],
      [{ tieu_de_buoc: `${P} X`, mo_ta: "x", thu_tu: -1 }, "thu_tu âm"],
      [{ tieu_de_buoc: `${P} X`, mo_ta: "x", thu_tu: 1.5 }, "thu_tu không nguyên"],
      [{ tieu_de_buoc: `${P} X`, mo_ta: "x", thu_tu: "abc" }, "thu_tu không phải số"],
      [{ tieu_de_buoc: `${P} X`, mo_ta: "x", thu_tu: true }, "thu_tu sai kiểu"],
      [{ tieu_de_buoc: `${P} X`, mo_ta: "x", thu_tu: THU_TU_MAX + 1 }, "thu_tu quá lớn"],
      [[], "body là mảng"],
    ];
    if (MO_TA_REQUIRED) {
      badSteps.push([{ tieu_de_buoc: `${P} X`, thu_tu: base + 20 }, "thiếu mô tả"], [{ tieu_de_buoc: `${P} X`, mo_ta: "  ", thu_tu: base + 20 }, "mô tả toàn khoảng trắng"]);
    }
    for (const [body, tag] of badSteps) {
      r = await post(S, ad, body);
      check(`Tạo bước - ${tag} -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    check("Input lỗi không tạo thêm bước", (await countSteps()) === cBefore2);

    // ---- Sửa ----
    r = await put(`${S}/${sA.id}`, ad, { tieu_de_buoc: `${P} Buoc A sua` });
    check("Sửa tiêu đề bước -> 200, mô tả và thu_tu giữ nguyên", r.status === 200 && r.data?.data?.tieu_de_buoc === `${P} Buoc A sua` && r.data.data.mo_ta === "Mo ta Buoc A" && r.data.data.thu_tu === base + 1, `(nhận ${r.status})`);
    r = await put(`${S}/${sA.id}`, ad, { mo_ta: "Mo ta moi" });
    check("Sửa mô tả -> 200", r.status === 200 && r.data?.data?.mo_ta === "Mo ta moi", `(nhận ${r.status})`);
    r = await put(`${S}/${sA.id}`, ad, { thu_tu: base + 1 });
    check("Giữ nguyên thu_tu của chính nó -> 200", r.status === 200, `(nhận ${r.status})`);
    r = await put(`${S}/${sA.id}`, ad, { thu_tu: base + 2 });
    check("Sửa thu_tu thành số đã có -> 409 DUPLICATE_ORDER", r.status === 409 && r.data.code === "DUPLICATE_ORDER", `(nhận ${r.status})`);
    check("  -> thu_tu cũ không bị đổi", (await dbStep(sA.id)).thu_tu === base + 1);
    r = await put(`${S}/${sA.id}`, ad, { thu_tu: base + 15 });
    check("Sửa thu_tu sang số trống -> 200", r.status === 200 && r.data?.data?.thu_tu === base + 15, `(nhận ${r.status})`);
    r = await mkStep("Dung cho cu", base + 1);
    check("Số thu_tu vừa nhường ra dùng lại được -> 201", r.status === 201, `(nhận ${r.status})`);
    for (const [body, tag] of [[{}, "body rỗng"], [{ tieu_de_buoc: "   " }, "tiêu đề trống"], [{ thu_tu: 0 }, "thu_tu = 0"], [{ thu_tu: "abc" }, "thu_tu không phải số"]]) {
      r = await put(`${S}/${sA.id}`, ad, body);
      check(`Sửa bước - ${tag} -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    r = await put(`${S}/999999999`, ad, { mo_ta: "x" });
    check("Sửa bước không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await put(`${S}/abc`, ad, { mo_ta: "x" });
    check("Sửa id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);

    // ---- Xóa: không làm hỏng thứ tự các bước còn lại ----
    const bOrder = (await dbStep(sB.id)).thu_tu;
    const cOrder = (await dbStep(sC.id)).thu_tu;
    r = await del(`${S}/${sB.id}`, ad);
    check("Xóa bước -> 200", r.status === 200, `(nhận ${r.status})`);
    check("DB: bước đã bị xóa", !(await dbStep(sB.id)));
    check("Xóa bước không đổi thu_tu của bước còn lại", (await dbStep(sC.id)).thu_tu === cOrder && (await dbStep(sA.id)).thu_tu === base + 15);
    r = await get(S, ad);
    const after = r.data?.data?.items || [];
    check("Sau khi xóa, danh sách vẫn sort ASC và không còn bước đã xóa", !after.some((x) => x.id === sB.id) && after.every((x, i) => i === 0 || after[i - 1].thu_tu <= x.thu_tu));
    r = await mkStep("Dung lai", bOrder);
    check("Thứ tự của bước đã xóa dùng lại được -> 201", r.status === 201, `(nhận ${r.status})`);
    r = await del(`${S}/${sB.id}`, ad);
    check("Xóa lại bước đã xóa -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await del(`${S}/abc`, ad);
    check("Xóa id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);

    // ================= 4. Regression =================
    r = await get("/health");
    check("Regression /health -> 200", r.status === 200);
    r = await get("/auth/me", ptT);
    check("Regression /auth/me -> 200", r.status === 200);
  } catch (e) {
    fail++;
    console.error("SCRIPT LỖI:", e);
  } finally {
    await cleanup();
    console.log(`\nKẾT QUẢ: ${pass} PASS, ${fail} FAIL`);
    await pool.end();
    process.exit(fail > 0 ? 1 : 0);
  }
})();