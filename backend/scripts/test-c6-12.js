/**
 * Test C6-12: Reception Home & Navigation Closure Audit Test
 * Verifies:
 * 1. ReceptionistHomePage is a functional dashboard (not placeholder)
 * 2. 3 essential reception flows are linked with clear title, description, and CTA:
 *    - Online Check-in (/receptionist/check-in-online)
 *    - Offline Check-in (/receptionist/walk-in)
 *    - Reception Queue (/receptionist/queue)
 * 3. AppRoutes.jsx has all routes and aliases protected by role "Lễ tân"
 * 4. sidebarMenus.js has valid routes for receptionist
 * 5. Scope control audit: flags unmerged C6 modules (e.g. /doctor/schedule)
 */

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

const ROOT_DIR = path.resolve(__dirname, "../..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend/src");

const homePagePath = path.join(FRONTEND_DIR, "pages/receptionist/ReceptionistHomePage.jsx");
const homeCssPath = path.join(FRONTEND_DIR, "pages/receptionist/receptionHome.css");
const appRoutesPath = path.join(FRONTEND_DIR, "routes/AppRoutes.jsx");
const sidebarMenusPath = path.join(FRONTEND_DIR, "components/layout/sidebarMenus.js");

console.log("=== Bắt đầu kiểm tra C6-12: Reception Home & Navigation Closure ===\n");

// 1. Kiểm tra ReceptionistHomePage.jsx
if (!fs.existsSync(homePagePath)) {
  check("File ReceptionistHomePage.jsx tồn tại", false, "(Không tìm thấy file)");
} else {
  check("File ReceptionistHomePage.jsx tồn tại", true);
  const homeContent = fs.readFileSync(homePagePath, "utf-8");

  check("Placeholder cũ đã được gỡ bỏ hoàn toàn", !homeContent.includes("Page kiểm tra Layout."));
  check("Có shortcut đến Check-in Online (/receptionist/check-in-online)", homeContent.includes("/receptionist/check-in-online"));
  check("Có shortcut đến Tiếp đón Offline (/receptionist/walk-in)", homeContent.includes("/receptionist/walk-in"));
  check("Có shortcut đến Hàng đợi tiếp đón (/receptionist/queue)", homeContent.includes("/receptionist/queue"));

  check("Card Check-in Online có tên, mô tả và CTA", 
    homeContent.includes("Check-in Online") && 
    homeContent.includes("Vào Check-in Online") &&
    homeContent.includes("Luồng A"));

  check("Card Tiếp đón Offline có tên, mô tả và CTA", 
    homeContent.includes("Tiếp đón & Đăng ký Offline") && 
    homeContent.includes("Vào Tiếp đón Offline") &&
    homeContent.includes("Luồng B"));

  check("Card Hàng đợi có tên, mô tả và CTA", 
    homeContent.includes("Hàng đợi & Điều phối") && 
    homeContent.includes("Mở Hàng đợi khám"));

  check("Có quy trình tiếp đón tiêu chuẩn hỗ trợ nghiệp vụ lễ tân", 
    homeContent.includes("Quy trình tiếp đón bệnh nhân tiêu chuẩn"));
}

// 2. Kiểm tra CSS Reception Home
if (!fs.existsSync(homeCssPath)) {
  check("File receptionHome.css tồn tại", false, "(Không tìm thấy file)");
} else {
  check("File receptionHome.css tồn tại", true);
  const cssContent = fs.readFileSync(homeCssPath, "utf-8");
  check("CSS tái sử dụng Figma design tokens chuẩn (var(--surface), var(--primary), v.v.)", 
    cssContent.includes("var(--surface") && cssContent.includes("var(--primary"));
}

// 3. Kiểm tra AppRoutes.jsx
if (!fs.existsSync(appRoutesPath)) {
  check("File AppRoutes.jsx tồn tại", false);
} else {
  const routesContent = fs.readFileSync(appRoutesPath, "utf-8");

  check("Route lễ tân được bảo vệ bởi role 'Lễ tân'", 
    routesContent.includes('<ProtectedRoute role="Lễ tân">'));

  check("Route chính /receptionist -> ReceptionistHomePage", 
    routesContent.includes('path="/receptionist"') && routesContent.includes("<ReceptionistHomePage />"));

  check("Route /receptionist/check-in-online -> OnlineCheckinPage", 
    routesContent.includes('path="/receptionist/check-in-online"') && routesContent.includes("<OnlineCheckinPage />"));

  check("Route /receptionist/walk-in -> OfflineCheckinPage", 
    routesContent.includes('path="/receptionist/walk-in"') && routesContent.includes("<OfflineCheckinPage />"));

  check("Route /receptionist/queue -> ReceptionQueuePage", 
    routesContent.includes('path="/receptionist/queue"') && routesContent.includes("<ReceptionQueuePage />"));

  check("Có alias redirect /receptionist/checkin/online đóng navigation gap", 
    routesContent.includes('path="/receptionist/checkin/online"'));

  check("Có alias redirect /receptionist/offline đóng navigation gap", 
    routesContent.includes('path="/receptionist/offline"'));
}

// 4. Kiểm tra sidebarMenus.js
if (!fs.existsSync(sidebarMenusPath)) {
  check("File sidebarMenus.js tồn tại", false);
} else {
  const menuContent = fs.readFileSync(sidebarMenusPath, "utf-8");
  check("Sidebar Lễ tân có vai trò LỄ TÂN", menuContent.includes('roleLabel: "LỄ TÂN"'));
  check("Sidebar Lễ tân có link /receptionist", menuContent.includes('path: "/receptionist"'));
  check("Sidebar Lễ tân có link /receptionist/check-in-online", menuContent.includes('path: "/receptionist/check-in-online"'));
  check("Sidebar Lễ tân có link /receptionist/walk-in", menuContent.includes('path: "/receptionist/walk-in"'));
  check("Sidebar Lễ tân có link /receptionist/queue", menuContent.includes('path: "/receptionist/queue"'));
}

// 5. Scope Control Audit
console.log("\n=== Scope Control & Navigation Audit ===");
const menuContent = fs.readFileSync(sidebarMenusPath, "utf-8");
const routesContent = fs.readFileSync(appRoutesPath, "utf-8");

// Kiểm tra các link trong sidebarMenus có tồn tại trong AppRoutes không
const pathRegex = /path:\s*"([^"]+)"/g;
let match;
const allMenuPaths = [];
while ((match = pathRegex.exec(menuContent)) !== null) {
  allMenuPaths.push(match[1]);
}

const unmappedPaths = [];
allMenuPaths.forEach((menuPath) => {
  if (!routesContent.includes(`path="${menuPath}"`)) {
    unmappedPaths.push(menuPath);
  }
});

if (unmappedPaths.length > 0) {
  console.log(`\n[GHI NHẬN SCOPE CONTROL] Phát hiện menu Staff chưa có route trong AppRoutes:`);
  unmappedPaths.forEach((p) => console.log(`  - ${p} (Chưa merge từ module khác, ví dụ C6-07/C6-08)`));
  check("Tất cả menu của RECEPTIONIST đều có route thật trong AppRoutes", 
    !unmappedPaths.some((p) => p.startsWith("/receptionist")));
} else {
  check("Tất cả menu Staff đều có route trong AppRoutes", true);
}

console.log(`\n========================================`);
console.log(`KẾT QUẢ: ${pass} PASS / ${fail} FAIL`);
console.log(`========================================\n`);

if (fail > 0) {
  process.exit(1);
}
