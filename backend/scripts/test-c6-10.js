// Test C6-10: API công khai Tin tức + Quy trình khám (không đăng nhập)
//   GET /api/public/news, GET /api/public/news/:id, GET /api/public/procedure-steps
// Chạy: bật server (npm run dev) rồi `npm run api:test-c6-10`. Script tự tạo và tự dọn dữ liệu test (tiền tố ZZC610).
// Dữ liệu thật do Admin nhập trong cùng bảng KHÔNG bị ảnh hưởng: script chỉ kiểm tra các dòng của chính nó.
const pool = require("../src/config/db");

const BASE = "http://localhost:3000/api";
const P = `ZZC610 ${Date.now().toString().slice(-6)}`;
let pass = 0, fail = 0;

const check = (label, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} ${ok ? "" : extra}`);
};
const get = async (p, token) => {
  const res = await fetch(BASE + p, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: res.status, data: await res.json().catch(() => ({})), res };
};

const addNews = async (tieuDe, noiDung, ngayDang, trangThai) =>
  (
    await pool.query(
      `INSERT INTO "TinTuc" (tieu_de, noi_dung, ngay_dang, trang_thai) VALUES ($1,$2,$3::timestamptz,$4) RETURNING id`,
      [`${P} ${tieuDe}`, noiDung, ngayDang, trangThai]
    )
  ).rows[0].id;
const addStep = async (tieuDe, moTa, thuTu) =>
  (
    await pool.query(`INSERT INTO "QuyTrinhKham" (tieu_de_buoc, mo_ta, thu_tu) VALUES ($1,$2,$3) RETURNING id`, [
      `${P} ${tieuDe}`,
      moTa,
      thuTu,
    ])
  ).rows[0].id;

const cleanup = async () => {
  try {
    await pool.query(`DELETE FROM "TinTuc" WHERE tieu_de LIKE $1`, [`${P} %`]);
    await pool.query(`DELETE FROM "QuyTrinhKham" WHERE tieu_de_buoc LIKE $1`, [`${P} %`]);
    console.log("\nĐã dọn dữ liệu test.");
  } catch (e) {
    console.error("LỖI khi dọn dữ liệu, hãy dọn tay:", e.message);
  }
};

(async () => {
  try {
    const wasNewsEmpty = Number((await pool.query(`SELECT COUNT(*) c FROM "TinTuc"`)).rows[0].c) === 0;
    const wasStepsEmpty = Number((await pool.query(`SELECT COUNT(*) c FROM "QuyTrinhKham"`)).rows[0].c) === 0;

    // ---------- Không dữ liệu -> rỗng, không lỗi (chỉ kiểm tra khi bảng đang trống) ----------
    if (wasNewsEmpty) {
      const e = await get("/public/news");
      check("Không có tin -> 200, data = []", e.status === 200 && Array.isArray(e.data.data) && e.data.data.length === 0, JSON.stringify(e.data));
    } else console.log("SKIP  Bảng TinTuc đã có dữ liệu thật -> bỏ qua kiểm tra danh sách rỗng");
    if (wasStepsEmpty) {
      const e = await get("/public/procedure-steps");
      check("Không có bước nào -> 200, data = []", e.status === 200 && Array.isArray(e.data.data) && e.data.data.length === 0, JSON.stringify(e.data));
    } else console.log("SKIP  Bảng QuyTrinhKham đã có dữ liệu thật -> bỏ qua kiểm tra danh sách rỗng");

    // ---------- Tin tức ----------
    const XSS = "<script>alert(1)</script>\nDòng 2 có & ký tự đặc biệt";
    const nOld = await addNews("Tin cũ", "Nội dung tin cũ", "2026-01-01T03:00:00Z", "HienThi");
    const nNew = await addNews("Tin mới", XSS, "2026-03-01T03:00:00Z", "HienThi");
    const nTie = await addNews("Tin cùng giờ (id lớn hơn)", "Nội dung tie", "2026-03-01T03:00:00Z", "HienThi");
    const nHid = await addNews("Tin ẨN", "Nội dung bí mật tin ẩn", "2026-02-01T03:00:00Z", "An");
    const nNull = await addNews("Tin trạng thái rỗng", "Nội dung null", "2026-02-02T03:00:00Z", null);
    const nOdd = await addNews("Tin sai giá trị trạng thái", "Nội dung odd", "2026-02-03T03:00:00Z", "hienthi");

    // Không đăng nhập
    const l1 = await get("/public/news");
    const ids = (l1.data.data || []).map((x) => x.id);
    check("Không đăng nhập: GET /public/news -> 200", l1.status === 200 && l1.data.success === true);
    check("Token rác trong header cũng không bị 401 (public)", (await get("/public/news", "token-khong-hop-le")).status === 200);
    check("Tin Hiển thị xuất hiện trong danh sách", ids.includes(nOld) && ids.includes(nNew) && ids.includes(nTie));
    check("Tin Ẩn / trạng thái rỗng / sai giá trị KHÔNG xuất hiện", !ids.includes(nHid) && !ids.includes(nNull) && !ids.includes(nOdd));
    check("Mới nhất trước (ngay_dang giảm dần)", ids.indexOf(nNew) < ids.indexOf(nOld) && ids.indexOf(nTie) < ids.indexOf(nOld));
    check("Cùng ngay_dang: id lớn hơn đứng trước", ids.indexOf(nTie) < ids.indexOf(nNew));
    const item = (l1.data.data || []).find((x) => x.id === nNew) || {};
    check("Mỗi tin trả id, tieu_de, ngay_dang; KHÔNG trả noi_dung / trang_thai",
      item.tieu_de === `${P} Tin mới` && !!item.ngay_dang && !("noi_dung" in item) && !("trang_thai" in item), JSON.stringify(item));
    check("Danh sách không lộ nội dung / tiêu đề tin ẩn", !JSON.stringify(l1.data).includes("bí mật") && !JSON.stringify(l1.data).includes("Tin ẨN"));
    check("Phản hồi no-store (Admin đổi là thấy ngay khi tải lại)", /no-store/.test(l1.res.headers.get("cache-control") || ""));

    // Chi tiết
    const d1 = await get(`/public/news/${nNew}`);
    check("Chi tiết tin Hiển thị -> 200, đủ tieu_de + noi_dung + ngay_dang",
      d1.status === 200 && d1.data.data?.tieu_de === `${P} Tin mới` && d1.data.data?.noi_dung === XSS && !!d1.data.data?.ngay_dang, JSON.stringify(d1.data));
    check("Chi tiết không trả trang_thai", !("trang_thai" in (d1.data.data || {})));
    const dHid = await get(`/public/news/${nHid}`);
    const dNone = await get("/public/news/2147483000");
    check("Gọi trực tiếp tin Ẩn -> 404, không lộ nội dung", dHid.status === 404 && !JSON.stringify(dHid.data).includes("bí mật"), JSON.stringify(dHid.data));
    check("ID không tồn tại -> 404, cùng thông báo với tin ẩn", dNone.status === 404 && dNone.data.message === dHid.data.message);
    check("Tin trạng thái rỗng / sai giá trị -> 404", (await get(`/public/news/${nNull}`)).status === 404 && (await get(`/public/news/${nOdd}`)).status === 404);
    check("ID sai định dạng (abc, 0, -1, quá lớn) -> 400",
      (await get("/public/news/abc")).status === 400 && (await get("/public/news/0")).status === 400 &&
      (await get("/public/news/-1")).status === 400 && (await get("/public/news/99999999999")).status === 400);

    // ---------- Admin ẩn / hiện / sửa -> Public cập nhật ngay (mô phỏng thao tác của C6-09 bằng SQL) ----------
    await pool.query(`UPDATE "TinTuc" SET trang_thai = 'An' WHERE id = $1`, [nOld]);
    const lH = await get("/public/news");
    check("Admin chuyển tin sang Ẩn -> biến khỏi danh sách và chi tiết 404",
      !(lH.data.data || []).some((x) => x.id === nOld) && (await get(`/public/news/${nOld}`)).status === 404);
    await pool.query(`UPDATE "TinTuc" SET trang_thai = 'HienThi' WHERE id = $1`, [nOld]);
    check("Admin chuyển lại Hiển thị -> xuất hiện lại", (await get("/public/news")).data.data.some((x) => x.id === nOld) && (await get(`/public/news/${nOld}`)).status === 200);
    await pool.query(`UPDATE "TinTuc" SET tieu_de = $2, noi_dung = $3 WHERE id = $1`, [nOld, `${P} Tin cũ ĐÃ SỬA`, "Nội dung mới sau khi sửa"]);
    const dEdit = await get(`/public/news/${nOld}`);
    check("Admin sửa tin -> Public thấy nội dung mới", dEdit.data.data?.tieu_de === `${P} Tin cũ ĐÃ SỬA` && dEdit.data.data?.noi_dung === "Nội dung mới sau khi sửa");
    check("Danh sách cũng thấy tiêu đề mới", (await get("/public/news")).data.data.find((x) => x.id === nOld)?.tieu_de === `${P} Tin cũ ĐÃ SỬA`);
    const dTmp = await addNews("Tin mới đăng", "Nội dung vừa đăng", "2026-04-01T03:00:00Z", "HienThi");
    check("Admin tạo tin Hiển thị -> Public thấy ngay, đứng đầu danh sách",
      (await get("/public/news")).data.data.map((x) => x.id).indexOf(dTmp) < (await get("/public/news")).data.data.map((x) => x.id).indexOf(nNew));

    // ---------- Quy trình khám ----------
    // Chèn KHÔNG theo thứ tự thu_tu để chứng minh Backend tự sắp xếp; thu_tu có khoảng trống (như sau khi Admin xóa bước)
    const sC = await addStep("Bước C", "Mô tả C", 9003);
    const sA = await addStep("Bước A", "Mô tả A", 9001);
    const sD = await addStep("Bước D (không mô tả)", null, 9010);
    const sB = await addStep("Bước B", "Mô tả B", 9002);
    const p1 = await get("/public/procedure-steps");
    const steps = (p1.data.data || []).filter((x) => x.tieu_de_buoc.startsWith(P));
    check("Không đăng nhập: GET /public/procedure-steps -> 200", p1.status === 200 && p1.data.success === true);
    check("Sắp xếp thu_tu tăng dần (A, B, C, D) dù chèn lộn xộn", JSON.stringify(steps.map((x) => x.id)) === JSON.stringify([sA, sB, sC, sD]), JSON.stringify(steps.map((x) => [x.id, x.thu_tu])));
    check("Giữ nguyên thu_tu có khoảng trống (không đánh số lại)", JSON.stringify(steps.map((x) => x.thu_tu)) === JSON.stringify([9001, 9002, 9003, 9010]));
    check("Mỗi bước có id, thu_tu, tieu_de_buoc, mo_ta (mo_ta rỗng = null)",
      steps[0].tieu_de_buoc === `${P} Bước A` && steps[0].mo_ta === "Mô tả A" && steps[3].mo_ta === null && steps.every((x) => "id" in x && "thu_tu" in x));
    check("Phản hồi no-store", /no-store/.test(p1.res.headers.get("cache-control") || ""));
    // Admin đổi thứ tự + sửa nội dung
    await pool.query(`UPDATE "QuyTrinhKham" SET thu_tu = 9000 WHERE id = $1`, [sD]);
    await pool.query(`UPDATE "QuyTrinhKham" SET tieu_de_buoc = $2, mo_ta = $3 WHERE id = $1`, [sA, `${P} Bước A ĐÃ SỬA`, "Mô tả A mới"]);
    const p2 = await get("/public/procedure-steps");
    const steps2 = (p2.data.data || []).filter((x) => x.tieu_de_buoc.startsWith(P));
    check("Admin đổi thứ tự -> Public sắp xếp lại đúng (D, A, B, C)", JSON.stringify(steps2.map((x) => x.id)) === JSON.stringify([sD, sA, sB, sC]));
    check("Admin sửa tiêu đề / mô tả -> Public nhận dữ liệu mới", steps2[1].tieu_de_buoc === `${P} Bước A ĐÃ SỬA` && steps2[1].mo_ta === "Mô tả A mới");
    await pool.query(`DELETE FROM "QuyTrinhKham" WHERE id = $1`, [sB]);
    check("Admin xóa bước -> biến khỏi Public", !(await get("/public/procedure-steps")).data.data.some((x) => x.id === sB));

    // ---------- Không ảnh hưởng API khác ----------
    check("API cần đăng nhập vẫn yêu cầu token (GET /appointments -> 401)", (await get("/appointments")).status === 401);
    check("Master API công khai cũ vẫn chạy (GET /master/chuyen-khoa -> 200)", (await get("/master/chuyen-khoa")).status === 200);
    check("Health vẫn chạy", (await get("/health")).status === 200);

    console.log(`\nKết quả: ${pass} PASS / ${fail} FAIL`);
  } catch (e) {
    fail++;
    console.log("FAIL  Lỗi không mong đợi:", e.message);
    console.log(`\nKết quả: ${pass} PASS / ${fail} FAIL`);
  } finally {
    await cleanup();
    await pool.end();
    process.exitCode = fail > 0 ? 1 : 0;
  }
})();
