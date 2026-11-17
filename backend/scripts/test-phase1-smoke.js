const fs = require("fs");
const path = require("path");

let pass = 0;
let fail = 0;

function check(label, ok, extra = "") {
  if (ok) {
    pass++;
    console.log(`PASS  ${label}`);
  } else {
    fail++;
    console.log(`FAIL  ${label} ${extra}`);
  }
}

const ROOT = path.resolve(__dirname, "../..");
const FRONTEND = path.join(ROOT, "frontend/src");

console.log("=== Bắt đầu kiểm tra Phase 1 — Shared Patient UI Foundation ===\n");

// 1. Shared Foundation CSS
const foundationCssPath = path.join(FRONTEND, "components/patient/patientFoundation.css");
check("patientFoundation.css tồn tại", fs.existsSync(foundationCssPath));
if (fs.existsSync(foundationCssPath)) {
  const css = fs.readFileSync(foundationCssPath, "utf-8");
  check("Có .patient-container (chuẩn 960px)", css.includes("max-width: 960px"));
  check("Có .patient-kicker và .patient-kicker__bar", css.includes(".patient-kicker") && css.includes(".patient-kicker__bar"));
  check("Có .patient-page-title", css.includes(".patient-page-title"));
  check("Có .patient-btn--primary và .patient-btn--secondary", css.includes(".patient-btn--primary") && css.includes(".patient-btn--secondary"));
  check("Có .patient-card", css.includes(".patient-card"));
}

// 2. Shared State Components
const stateJsxPath = path.join(FRONTEND, "components/patient/PatientState.jsx");
const stateCssPath = path.join(FRONTEND, "components/patient/PatientState.css");
check("PatientState.jsx tồn tại", fs.existsSync(stateJsxPath));
check("PatientState.css tồn tại", fs.existsSync(stateCssPath));
if (fs.existsSync(stateJsxPath)) {
  const jsx = fs.readFileSync(stateJsxPath, "utf-8");
  check("Export PatientLoading", jsx.includes("export function PatientLoading"));
  check("Export PatientEmpty", jsx.includes("export function PatientEmpty"));
  check("Export PatientError", jsx.includes("export function PatientError"));
  check("PatientLoading có role='status'", jsx.includes('role="status"'));
  check("PatientError có role='alert'", jsx.includes('role="alert"'));
}

// 3. PatientLayout mobile improvements
const layoutJsxPath = path.join(FRONTEND, "components/layout/PatientLayout.jsx");
const layoutCssPath = path.join(FRONTEND, "components/layout/PatientLayout.css");
if (fs.existsSync(layoutJsxPath)) {
  const jsx = fs.readFileSync(layoutJsxPath, "utf-8");
  check("PatientLayout có pl-mobile-backdrop", jsx.includes("pl-mobile-backdrop"));
  check("PatientLayout có xử lý phím Escape đóng menu", jsx.includes('"Escape"'));
  check("Hamburger có aria-controls='pl-mobile-nav'", jsx.includes('aria-controls="pl-mobile-nav"'));
  check("Nav mobile có id='pl-mobile-nav'", jsx.includes('id="pl-mobile-nav"'));
}
if (fs.existsSync(layoutCssPath)) {
  const css = fs.readFileSync(layoutCssPath, "utf-8");
  check("Hamburger có tap target 42px", css.includes("width: 42px") && css.includes("height: 42px"));
  check("CSS có class .pl-mobile-backdrop", css.includes(".pl-mobile-backdrop"));
  check("PatientLayout import patientFoundation.css", css.includes("patientFoundation.css"));
}

// 4. PublicLayout mobile backdrop & escape
const pubLayoutJsxPath = path.join(FRONTEND, "components/layout/PublicLayout.jsx");
if (fs.existsSync(pubLayoutJsxPath)) {
  const jsx = fs.readFileSync(pubLayoutJsxPath, "utf-8");
  check("PublicLayout có pl-mobile-backdrop", jsx.includes("pl-mobile-backdrop"));
  check("PublicLayout có xử lý phím Escape", jsx.includes('"Escape"'));
}

// 5. StateMessage & PublicState bridges
const stateMessagePath = path.join(FRONTEND, "pages/patient/appointments/StateMessage.jsx");
if (fs.existsSync(stateMessagePath)) {
  const sm = fs.readFileSync(stateMessagePath, "utf-8");
  check("StateMessage.jsx tái sử dụng PatientLoading và PatientError", 
    sm.includes("PatientLoading") && sm.includes("PatientError"));
}
const publicStatePath = path.join(FRONTEND, "pages/public/PublicState.jsx");
if (fs.existsSync(publicStatePath)) {
  const ps = fs.readFileSync(publicStatePath, "utf-8");
  check("PublicState.jsx tái sử dụng PatientLoading, PatientError, PatientEmpty", 
    ps.includes("PatientLoading") && ps.includes("PatientError") && ps.includes("PatientEmpty"));
}

// 6. SelectSpecialtyPage uses shared state
const selectSpecialtyPath = path.join(FRONTEND, "pages/patient/booking/SelectSpecialtyPage.jsx");
if (fs.existsSync(selectSpecialtyPath)) {
  const ss = fs.readFileSync(selectSpecialtyPath, "utf-8");
  check("SelectSpecialtyPage dùng PatientLoading thay vì text trần", ss.includes("<PatientLoading"));
  check("SelectSpecialtyPage dùng PatientError thay vì booking__message", ss.includes("<PatientError"));
}

// 7. Guardrail checks
const homePath = path.join(FRONTEND, "pages/patient/PatientHomePage.jsx");
const homeContent = fs.readFileSync(homePath, "utf-8");
check("Guardrail: Patient Home không bị đụng chạm / sửa đổi", homeContent.includes("Chăm sóc sức khỏe") && homeContent.includes("ph-hero"));

console.log(`\n========================================`);
console.log(`KẾT QUẢ SMOKE CHECK: ${pass} PASS / ${fail} FAIL`);
console.log(`========================================\n`);

if (fail > 0) process.exit(1);
