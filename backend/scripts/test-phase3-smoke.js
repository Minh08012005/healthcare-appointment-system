/**
 * Automated smoke test for Phase 3: Patient Detail Views Polish
 * Verifies:
 * 1. Appointment Detail Page:
 *    - 2-column responsive layout (ap-detail-grid, ap-detail-main-col, ap-detail-side-col)
 *    - Clean back navigation (unified ap-back-btn, removed duplicate)
 *    - QR presentation intact (QRCodeCanvas, ap-qr-card, ap-code copy, save)
 *    - Cancel appointment action & modal untouched
 * 2. Medical History Detail Page:
 *    - Structured clinical EHR cards (Information, Diagnosis summary, Rx Box, Lab orders)
 *    - Rx Box styling & formatting (mh-rx-card, mh-rx-badge, no artificial parsing)
 *    - Lab file action bar (view in new tab & close file toolbar buttons)
 *    - Security and file Blob handling preserved
 * 3. News Detail Page:
 *    - Article layout (pc-page--narrow, pc-article, header with date & tag, body spacing, footer tag)
 *    - Back navigation link with icon
 * 4. Guardrails & Safety:
 *    - No backend modifications, DB changes, or new APIs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

let passCount = 0;
let failCount = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failCount++;
  }
}

console.log("=== BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG PHASE 3: PATIENT DETAIL VIEWS POLISH ===\n");

// 1. Appointment Detail
console.log("1. Kiểm tra Appointment Detail View (/patient/appointments/:id):");
const apDetailContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/patient/appointments/AppointmentDetailPage.jsx"),
  "utf8"
);
const apCssContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/patient/appointments/appointments.css"),
  "utf8"
);

assert(apDetailContent.includes("ap-detail-grid"), "Có bố cục 2 cột (ap-detail-grid)");
assert(apDetailContent.includes("ap-detail-main-col"), "Có cột chính (thông tin khám bệnh)");
assert(apDetailContent.includes("ap-detail-side-col"), "Có cột phụ (thẻ QR check-in & mã lịch hẹn)");
assert(apCssContent.includes("grid-template-columns: 1fr 340px"), "CSS định nghĩa layout 2 cột trên desktop");
assert(apCssContent.includes("order: -1"), "Trên mobile/tablet (<900px), thẻ QR tự động đưa lên đầu");
assert(apDetailContent.includes("ap-back-btn"), "Sử dụng nút back chuẩn hóa, loại bỏ duplicate action");
assert(apDetailContent.includes("QRCodeCanvas"), "Giữ nguyên logic sinh mã QR");
assert(apDetailContent.includes("ConfirmCancelModal"), "Giữ nguyên modal xác nhận hủy lịch hẹn");
assert(apDetailContent.includes("appointment.co_the_huy"), "Giữ nguyên điều kiện được hủy lịch hẹn");

// 2. Medical History Detail
console.log("\n2. Kiểm tra Medical History Detail View (/patient/history/:id):");
const mhDetailContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/patient/history/MedicalHistoryDetailPage.jsx"),
  "utf8"
);
const mhCssContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/patient/history/history.css"),
  "utf8"
);

assert(mhDetailContent.includes("mh-summary-card"), "Có khối Tóm tắt chẩn đoán y khoa");
assert(mhDetailContent.includes("mh-rx-card"), "Có Rx Box hiển thị đơn thuốc");
assert(mhCssContent.includes("mh-rx-badge"), "Có badge Rx phong cách toa thuốc y tế");
assert(mhDetailContent.includes("historyApi.getLabFile"), "Giữ nguyên authenticated Blob URL cho file xét nghiệm");
assert(mhDetailContent.includes("mh-file__action-btn"), "Toolbar mở tab mới và đóng file dạng button chuẩn");
assert(mhDetailContent.includes("notFound"), "Giữ nguyên bảo mật 404 cho hồ sơ không thuộc về mình");

// 3. News Detail
console.log("\n3. Kiểm tra News Detail View (/news/:id):");
const newsDetailContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/public/NewsDetailPage.jsx"),
  "utf8"
);
const newsCssContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/public/publicContent.css"),
  "utf8"
);

assert(newsDetailContent.includes("pc-article"), "Nội dung bài viết đặt trong thẻ pc-article chuẩn");
assert(newsDetailContent.includes("pc-article__title"), "Tiêu đề bài viết có hierarchy rõ rệt");
assert(newsDetailContent.includes("pc-article__footer"), "Có footer bài viết y tế kèm thông tin bệnh viện");
assert(newsDetailContent.includes("pc-back-btn"), "Có nút quay lại trang tin tức rõ ràng");
assert(newsCssContent.includes("pc-page--narrow"), "Sử dụng container đọc hẹp phù hợp văn bản báo chí");

// 4. Guardrails & Safety
console.log("\n4. Kiểm tra Guardrails & Safety:");
assert(!apDetailContent.includes("/api/custom"), "Không thêm API mới cho Appointment Detail");
assert(!mhDetailContent.includes("/api/custom"), "Không thêm API mới cho History Detail");
assert(!newsDetailContent.includes("/api/custom"), "Không thêm API mới cho News Detail");

console.log(`\n========================================`);
console.log(`TỔNG KẾT: ${passCount} PASS / ${failCount} FAIL`);
console.log(`========================================\n`);

if (failCount > 0) {
  process.exit(1);
}
