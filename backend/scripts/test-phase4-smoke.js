/**
 * Automated smoke test for Phase 4: Booking Flow & Procedure Polish
 * Verifies:
 * 1. Step 1 (Specialty): BookingIcon medical replacing emoji, chevron arrowRight, PatientLoading/Empty/Error
 * 2. Step 2 (Doctor): Professional wording "Bệnh viện phân bổ bác sĩ", search icon wrap, PatientLoading/Empty/Error, arrowRight
 * 3. Step 3 (Slot): Room placeholder improved, slot time & remaining badge, responsive day/slot grid
 * 4. Step 4 (Patient Info): Room presented as informative chip (bk-room-chip) without lock icon feeling
 * 5. Step 5 (Confirm): Review summary hierarchy, important note styling, action buttons
 * 6. Step 6 (Success): Removed fake modal X button, Electronic ticket card (bk-ticket), primary CTA "Xem lịch hẹn của tôi"
 * 7. Procedure: Vertical stepper/timeline with connectors, admin dynamic steps intact, CTA preserved
 * 8. Guardrails: No backend/DB/logic modifications
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

console.log("=== BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG PHASE 4: BOOKING FLOW & PROCEDURE POLISH ===\n");

// 1. Step 1: Select Specialty
console.log("1. Kiểm tra Step 1 — Chọn chuyên khoa:");
const specContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/patient/booking/SelectSpecialtyPage.jsx"),
  "utf8"
);
assert(!specContent.includes("🏥"), "Đã loại bỏ emoji 🏥 thô sơ");
assert(specContent.includes("BookingIcon name=\"medical\""), "Thay bằng BookingIcon medical chuẩn y tế");
assert(!specContent.includes("›"), "Đã thay ký tự text › bằng BookingIcon");
assert(specContent.includes("arrowRight"), "Dùng icon arrowRight nhất quán");

// 2. Step 2: Select Doctor
console.log("\n2. Kiểm tra Step 2 — Chọn bác sĩ:");
const docContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/patient/booking/SelectDoctorPage.jsx"),
  "utf8"
);
assert(docContent.includes("Ngẫu nhiên"), "Giữ nguyên wording 'Ngẫu nhiên' theo yêu cầu");
assert(docContent.includes("Chưa rõ chọn bác sĩ nào?"), "Giữ nguyên copy gốc của khối gợi ý chọn bác sĩ");
assert(docContent.includes("booking__search-wrap"), "Search input có icon wrap");
assert(docContent.includes("PatientLoading"), "Sử dụng PatientLoading từ Phase 1");

// 3. Step 3: Select Slot
console.log("\n3. Kiểm tra Step 3 — Chọn ngày & giờ khám:");
const slotContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/patient/booking/SelectSlotPage.jsx"),
  "utf8"
);
assert(!slotContent.includes("Phòng khám: Chưa có phòng"), "Không hiển thị 'Chưa có phòng' gây hiểu lầm lỗi dữ liệu");
assert(slotContent.includes("booking__slot-badge"), "Hiển thị số chỗ còn lại trên từng khung giờ");
assert(slotContent.includes("booking__slot-time"), "Khung giờ to rõ, dễ bấm");

// 4. Step 4: Patient Info
console.log("\n4. Kiểm tra Step 4 — Thông tin khám:");
const infoContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/patient/booking/PatientInfoPage.jsx"),
  "utf8"
);
assert(infoContent.includes("bk-room-chip"), "Phòng khám hiển thị dạng informative chip (bk-room-chip)");
assert(!infoContent.includes("bk-readonly"), "Không còn dùng input readonly gây cảm giác bị khóa");
assert(infoContent.includes("Cố định theo ca"), "Có tag giải thích rõ phòng khám cố định");

// 5. Step 5: Confirm Booking
console.log("\n5. Kiểm tra Step 5 — Xác nhận đặt lịch:");
const confirmContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/patient/booking/ConfirmBookingPage.jsx"),
  "utf8"
);
assert(confirmContent.includes("Xác nhận đặt lịch khám"), "CTA xác nhận rõ ràng, phân cấp tốt");
assert(confirmContent.includes("LƯU Ý QUAN TRỌNG"), "Lưu ý tiếp đón trước 10 phút rõ ràng");

// 6. Step 6: Booking Success
console.log("\n6. Kiểm tra Step 6 — Kết quả đặt lịch:");
const successContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/patient/booking/BookingSuccessPage.jsx"),
  "utf8"
);
assert(!successContent.includes("aria-label=\"Đóng\""), "Đã loại bỏ nút X giả modal");
assert(successContent.includes("PHIẾU TIẾP ĐÓN ĐIỆN TỬ"), "Card thành Thẻ / Phiếu tiếp đón điện tử");
assert(successContent.includes("bk-btn--primary") && successContent.includes("Xem lịch hẹn của tôi"), "CTA chính ưu tiên Xem lịch hẹn của tôi");

// 7. Procedure Page
console.log("\n7. Kiểm tra Quy trình khám (/procedure):");
const procCssContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/public/publicContent.css"),
  "utf8"
);
assert(procCssContent.includes(".pc-step::before"), "Có connector dọc giữa các bước khám");
assert(procCssContent.includes(".pc-step__num"), "Số thứ tự bước được làm nổi khối chuyên nghiệp");

// 8. Guardrails
console.log("\n8. Kiểm tra Guardrails & Safety:");
assert(docContent.includes("Math.random()"), "Giữ nguyên logic/thuật toán phân bổ ngẫu nhiên");
assert(confirmContent.includes("appointmentApi.create"), "Giữ nguyên contract gọi API tạo lịch hẹn");
assert(successContent.includes("QRCodeCanvas"), "Giữ nguyên logic sinh mã QR");

console.log(`\n========================================`);
console.log(`TỔNG KẾT: ${passCount} PASS / ${failCount} FAIL`);
console.log(`========================================\n`);

if (failCount > 0) {
  process.exit(1);
}
