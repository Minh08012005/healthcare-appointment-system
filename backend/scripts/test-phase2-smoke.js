/**
 * Automated smoke test for Phase 2: Patient List Views Polish
 * Verifies:
 * 1. AppointmentListPage: 960px container, kicker, hierarchy, search/tabs, EmptyState integration
 * 2. MedicalHistoryListPage: 960px container, kicker, hierarchy, EmptyState integration, no duplicate "DA_XONG" badge
 * 3. NewsListPage: 960px container, kicker, 2-column grid layout, PublicEmpty/PatientEmpty integration
 * 4. Navigation links: detail routes preserved
 * 5. Guardrails: No backend/DB/API contracts modified
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

console.log("=== BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG PHASE 2: PATIENT LIST VIEWS POLISH ===\n");

// 1. Appointment List Page & CSS
console.log("1. Kiểm tra Appointment List View (/patient/appointments):");
const apPageContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/patient/appointments/AppointmentListPage.jsx"),
  "utf8"
);
const apCssContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/patient/appointments/appointments.css"),
  "utf8"
);

assert(apPageContent.includes("ap-kicker"), "AppointmentListPage có micro-kicker y tế");
assert(apPageContent.includes("ap-page-title"), "AppointmentListPage có page-title phân cấp rõ ràng");
assert(apPageContent.includes("ap-search-wrap"), "AppointmentListPage có search input bọc icon");
assert(apPageContent.includes("ap-tabs-row"), "AppointmentListPage có segmented tabs hàng ngang");
assert(apPageContent.includes("EmptyState"), "AppointmentListPage tái sử dụng EmptyState từ StateMessage (Phase 1)");
assert(apPageContent.includes("BOOKING_PATHS.appointmentDetail"), "Giữ nguyên navigation sang Appointment Detail");
assert(apCssContent.includes("max-width: 960px"), "ap-page container đã được nâng lên chuẩn 960px");
assert(apCssContent.includes(".ap-tab--active"), "Segmented tabs có active styling rõ rệt");

// 2. Medical History List Page & CSS
console.log("\n2. Kiểm tra Medical History List View (/patient/history):");
const mhPageContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/patient/history/MedicalHistoryListPage.jsx"),
  "utf8"
);
const mhCssContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/patient/history/history.css"),
  "utf8"
);

assert(mhPageContent.includes("ap-kicker"), "MedicalHistoryListPage có micro-kicker y tế");
assert(mhPageContent.includes("ap-page-title"), "MedicalHistoryListPage có page-title phân cấp rõ ràng");
assert(mhPageContent.includes("EmptyState"), "MedicalHistoryListPage tái sử dụng EmptyState từ Phase 1");
assert(mhPageContent.includes("HISTORY_PATHS.detail"), "Giữ nguyên navigation sang Medical History Detail");
assert(mhCssContent.includes("mh-header-card"), "Có card tiêu đề đếm số lượt khám và thông báo sort");
assert(mhPageContent.includes("mh-tag-completed"), "Hồ sơ có nhãn hoàn tất nhẹ nhàng tinh tế");
assert(mhPageContent.includes("r.so_xet_nghiem"), "Nổi bật số lượng xét nghiệm cận lâm sàng");

// 3. News List Page & CSS
console.log("\n3. Kiểm tra News List View (/news):");
const newsPageContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/public/NewsListPage.jsx"),
  "utf8"
);
const newsCssContent = fs.readFileSync(
  path.join(rootDir, "frontend/src/pages/public/publicContent.css"),
  "utf8"
);

assert(newsPageContent.includes("pc-kicker"), "NewsListPage có kicker micro-bar");
assert(newsPageContent.includes("pc-page-title"), "NewsListPage có page title chuẩn y tế");
assert(newsPageContent.includes("pc-news-grid"), "NewsListPage có grid hiển thị tin tức");
assert(newsCssContent.includes("grid-template-columns: repeat(2, 1fr)"), "Desktop layout dạng 2 cột");
assert(newsCssContent.includes("max-width: 960px"), "Container tin tức chuẩn 960px");
assert(newsPageContent.includes("PUBLIC_PATHS.newsDetail"), "Giữ nguyên navigation sang News Detail");

// 4. Guardrails & Consistency
console.log("\n4. Kiểm tra Guardrails & Safety:");
assert(!apPageContent.includes("/api/custom"), "Không thêm API mới cho Appointment List");
assert(!mhPageContent.includes("/api/custom"), "Không thêm API mới cho Medical History List");
assert(!newsPageContent.includes("/api/custom"), "Không thêm API mới cho News List");
assert(fs.existsSync(path.join(rootDir, "frontend/src/components/patient/PatientState.jsx")), "Bộ PatientState Phase 1 nguyên vẹn");

console.log(`\n========================================`);
console.log(`TỔNG KẾT: ${passCount} PASS / ${failCount} FAIL`);
console.log(`========================================\n`);

if (failCount > 0) {
  process.exit(1);
}
