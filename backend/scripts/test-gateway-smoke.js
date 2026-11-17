/**
 * Automated smoke test for MEDICARE Public Entry & Auth Context Architecture
 * - Public entry at / (PublicEntryRedirect: /news for guest, /patient for patient, role workspace for staff)
 * - Patient Login (/login) with back link to /
 * - Hospital Staff Login (/staff/login) with direct access
 * - Unified MEDICARE Brand Component
 * - Portal Boundary protection with immediate auth cleanup
 */

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

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

console.log("=== BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG MEDICARE ENTRY & AUTH CONTEXT ===\n");

// 1. Unified Brand Component
console.log("1. Kiểm tra Unified Brand Component (MedicareBrand):");
const brandPath = path.join(rootDir, "frontend/src/components/brand/MedicareBrand.jsx");
const brandCssPath = path.join(rootDir, "frontend/src/components/brand/MedicareBrand.css");
assert(fs.existsSync(brandPath), "File MedicareBrand.jsx tồn tại");
assert(fs.existsSync(brandCssPath), "File MedicareBrand.css tồn tại");

const brandContent = fs.readFileSync(brandPath, "utf8");
assert(brandContent.includes("MEDICARE"), "Chứa wordmark MEDICARE");
assert(brandContent.includes("viewBox=\"0 0 18 18\""), "Sử dụng geometry SVG chữ thập chuẩn y tế");
assert(brandContent.includes("medicare-brand--${size}"), "Hỗ trợ các variant size");

const brandCss = fs.readFileSync(brandCssPath, "utf8");
assert(brandCss.includes("#4F8C87"), "Sử dụng màu Muted Teal (#4F8C87) cho chữ thập");
assert(brandCss.includes("#0B1F33"), "Sử dụng màu Deep Navy (#0B1F33) cho wordmark");

// 2. Public Entry Redirect (/)
console.log("\n2. Kiểm tra Public Entry Redirect (/):");
const entryPath = path.join(rootDir, "frontend/src/routes/PublicEntryRedirect.jsx");
assert(fs.existsSync(entryPath), "File PublicEntryRedirect.jsx tồn tại");

const entryContent = fs.readFileSync(entryPath, "utf8");
assert(entryContent.includes("user?.role === \"Bệnh nhân\""), "Bệnh nhân đã đăng nhập được chuyển hướng vào /patient");
assert(entryContent.includes("getPostLoginPath(user.role)"), "Nhân viên y tế được chuyển hướng theo đúng vai trò");
assert(entryContent.includes("Navigate to=\"/news\" replace"), "Khách / chưa đăng nhập vào an toàn trang công khai /news");

// GatewayPage should NOT be present in active routing
const appRoutesPath = path.join(rootDir, "frontend/src/routes/AppRoutes.jsx");
const appRoutesContent = fs.readFileSync(appRoutesPath, "utf8");
assert(!appRoutesContent.includes("GatewayPage"), "Không còn dependency GatewayPage trong AppRoutes");
assert(appRoutesContent.includes("path=\"/\" element={<PublicEntryRedirect />}"), "Route / sử dụng PublicEntryRedirect");

// 3. Reusable LoginForm & Boundary Check
console.log("\n3. Kiểm tra LoginForm & Portal Boundary Safety:");
const authProviderPath = path.join(rootDir, "frontend/src/auth/AuthProvider.jsx");
const authProviderContent = fs.readFileSync(authProviderPath, "utf8");
assert(authProviderContent.includes("!allowedRoles.includes(tempUser.role)"), "AuthProvider kiểm tra Portal Boundary TRƯỚC KHI lưu token và TRƯỚC KHI set user");

const loginFormPath = path.join(rootDir, "frontend/src/components/auth/LoginForm.jsx");
assert(fs.existsSync(loginFormPath), "File LoginForm.jsx tồn tại");

const loginFormContent = fs.readFileSync(loginFormPath, "utf8");
assert(loginFormContent.includes("login(trimmedUsername, form.password, allowedRoles)"), "LoginForm truyền allowedRoles vào login để ngăn automatic role redirect");
assert(loginFormContent.includes("allowedRoles.includes(loggedInUser.role)"), "Có cơ chế kiểm tra Portal Boundary theo role");
assert(loginFormContent.includes("await logout()"), "Critical safety: Gọi logout() ngay khi mismatch để unauthenticate hoàn toàn");
assert(loginFormContent.includes("setMismatch"), "Lưu mismatch state để hiển thị thông báo chuyển trang đăng nhập");
assert(loginFormContent.includes("backTo && backLabel"), "Hỗ trợ nút back linh hoạt về /");
assert(!loginFormContent.includes("Quay lại chọn cổng"), "Đã loại bỏ hoàn toàn wording 'Quay lại chọn cổng'");

// 4. Patient Login Context (/login)
console.log("\n4. Kiểm tra Patient Login Context (/login):");
const loginPagePath = path.join(rootDir, "frontend/src/pages/common/LoginPage.jsx");
const loginPageContent = fs.readFileSync(loginPagePath, "utf8");
assert(loginPageContent.includes("portalType=\"patient\""), "Cấu hình đúng context patient");
assert(loginPageContent.includes("CỔNG BỆNH NHÂN"), "Badge CỔNG BỆNH NHÂN");
assert(loginPageContent.includes("PATIENT_ROLES"), "Ràng buộc role Bệnh nhân");
assert(loginPageContent.includes("showRegisterLink={true}"), "Hiển thị link Đăng ký tài khoản");
assert(loginPageContent.includes("backLabel=\"Về trang chủ\""), "Wording nút back 'Về trang chủ'");
assert(!loginPageContent.includes("switchPortalTo=\"/staff/login\""), "Không quảng bá link Staff Login trên Cổng Bệnh nhân theo kiến trúc cuối");
assert(loginFormContent.includes("targetUrl: \"/staff/login\""), "Vẫn giữ contextual recovery tới /staff/login khi có mismatch");

// 5. Hospital Login Context (/staff/login)
console.log("\n5. Kiểm tra Hospital Login Context (/staff/login):");
const staffLoginPath = path.join(rootDir, "frontend/src/pages/common/StaffLoginPage.jsx");
assert(fs.existsSync(staffLoginPath), "File StaffLoginPage.jsx tồn tại");

const staffLoginContent = fs.readFileSync(staffLoginPath, "utf8");
assert(staffLoginContent.includes("portalType=\"staff\""), "Cấu hình đúng context staff");
assert(staffLoginContent.includes("CỔNG BỆNH VIỆN"), "Badge CỔNG BỆNH VIỆN");
assert(staffLoginContent.includes("STAFF_ROLES"), "Ràng buộc role Staff");
assert(staffLoginContent.includes("showRegisterLink={false}"), "KHÔNG hiển thị link Đăng ký tài khoản");
assert(staffLoginContent.includes("backLabel=\"Về trang MEDICARE\""), "Wording nút back 'Về trang MEDICARE'");
assert(!staffLoginContent.includes("switchPortalTo=\"/login\""), "Không quảng bá link Patient Login mặc định trên Staff Login");
assert(!loginFormContent.includes("LƯU Ý ĐĂNG NHẬP"), "Đã bỏ badge 'LƯU Ý ĐĂNG NHẬP' khỏi mismatch panel");
assert(loginFormContent.includes("auth__mismatch"), "Sử dụng informational mismatch panel");
assert(staffLoginContent.includes("Quản trị viên"), "Chứa thông báo tài khoản do Admin quản lý");

// 6. Auth Paths & Role Definitions
console.log("\n6. Kiểm tra authPaths.js:");
const authPathsPath = path.join(rootDir, "frontend/src/auth/authPaths.js");
assert(fs.existsSync(authPathsPath), "File authPaths.js tồn tại");

const authPathsContent = fs.readFileSync(authPathsPath, "utf8");
assert(authPathsContent.includes("\"Bệnh nhân\", \"/patient\""), "Mapping Bệnh nhân -> /patient");
assert(authPathsContent.includes("\"Bác sĩ\", \"/doctor\""), "Mapping Bác sĩ -> /doctor");
assert(authPathsContent.includes("\"Lễ tân\", \"/receptionist\""), "Mapping Lễ tân -> /receptionist");
assert(authPathsContent.includes("\"Xét nghiệm\", \"/lab\""), "Mapping Xét nghiệm -> /lab");
assert(authPathsContent.includes("\"Quản trị viên\", \"/admin\""), "Mapping Quản trị viên -> /admin");

// 7. Route Configuration in AppRoutes.jsx
console.log("\n7. Kiểm tra Route Configuration trong AppRoutes.jsx:");
assert(appRoutesContent.includes("path=\"/login\" element={<LoginPage />}"), "Route /login trỏ về LoginPage (Patient Login)");
assert(appRoutesContent.includes("path=\"/staff/login\" element={<StaffLoginPage />}"), "Route /staff/login trỏ về StaffLoginPage (Hospital Login)");
assert(appRoutesContent.includes("path=\"/register\" element={<RegisterPage />}"), "Route /register vẫn giữ nguyên");
assert(appRoutesContent.includes("path=\"/patient\""), "Route /patient vẫn giữ nguyên");
assert(appRoutesContent.includes("path=\"/doctor\""), "Route /doctor vẫn giữ nguyên");
assert(appRoutesContent.includes("path=\"/receptionist\""), "Route /receptionist vẫn giữ nguyên");

// 8. Register Page Safety & CSS
console.log("\n8. Kiểm tra Register Page & CSS:");
const authCssPath = path.join(rootDir, "frontend/src/pages/common/auth.css");
const authCss = fs.readFileSync(authCssPath, "utf8");
assert(authCss.includes(".auth__screen--register"), "Vẫn giữ CSS chuyên biệt cho RegisterPage");
assert(authCss.includes(".auth__alert--mismatch"), "Có CSS cho Portal Mismatch Alert");
assert(authCss.includes("#FBFAF7"), "Nền Warm White chuẩn Patient Portal");

// 9. Logout Redirection & Consistency (Cổng Bệnh nhân -> /login, Cổng Bệnh viện -> /staff/login)
console.log("\n9. Kiểm tra Logout Redirection & Consistency:");
const { getPostLogoutPath, POST_LOGOUT_PATHS } = await import(pathToFileURL(path.join(rootDir, "frontend/src/auth/authPaths.js")).href);
assert(POST_LOGOUT_PATHS.PATIENT === "/login", "POST_LOGOUT_PATHS.PATIENT trỏ về /login");
assert(POST_LOGOUT_PATHS.STAFF === "/staff/login", "POST_LOGOUT_PATHS.STAFF trỏ về /staff/login");
assert(getPostLogoutPath("Bệnh nhân") === "/login", "Logout Bệnh nhân -> /login");
assert(getPostLogoutPath("patient") === "/login", "Logout role prop patient -> /login");
assert(getPostLogoutPath("Bác sĩ") === "/staff/login", "Logout Bác sĩ -> /staff/login");
assert(getPostLogoutPath("doctor") === "/staff/login", "Logout role prop doctor -> /staff/login");
assert(getPostLogoutPath("Lễ tân") === "/staff/login", "Logout Lễ tân -> /staff/login");
assert(getPostLogoutPath("receptionist") === "/staff/login", "Logout role prop receptionist -> /staff/login");
assert(getPostLogoutPath("Xét nghiệm") === "/staff/login", "Logout Xét nghiệm -> /staff/login");
assert(getPostLogoutPath("lab") === "/staff/login", "Logout role prop lab -> /staff/login");
assert(getPostLogoutPath("Quản trị viên") === "/staff/login", "Logout Quản trị viên -> /staff/login");
assert(getPostLogoutPath("admin") === "/staff/login", "Logout role prop admin -> /staff/login");

const mainLayoutPath = path.join(rootDir, "frontend/src/components/layout/MainLayout.jsx");
const mainLayoutContent = fs.readFileSync(mainLayoutPath, "utf8");
assert(mainLayoutContent.includes("getPostLogoutPath"), "MainLayout import và sử dụng getPostLogoutPath");
assert(!mainLayoutContent.includes('navigate("/login", { replace: true })'), "MainLayout KHÔNG còn hardcode navigate('/login')");

const patientLayoutPath = path.join(rootDir, "frontend/src/components/layout/PatientLayout.jsx");
const patientLayoutContent = fs.readFileSync(patientLayoutPath, "utf8");
assert(patientLayoutContent.includes('logout("Bệnh nhân")'), "PatientLayout gọi logout với context Bệnh nhân");

assert(authProviderContent.includes("roleBeforeLogout"), "AuthProvider ghi nhận role trước khi clear state");
assert(authProviderContent.includes("getPostLogoutPath(roleBeforeLogout)"), "AuthProvider tính toán redirectPath theo role trước đó");

const protectedRoutePath = path.join(rootDir, "frontend/src/routes/ProtectedRoute.jsx");
const protectedRouteContent = fs.readFileSync(protectedRoutePath, "utf8");
assert(protectedRouteContent.includes("getPostLogoutPath(role)"), "ProtectedRoute sử dụng getPostLogoutPath theo role của route");
assert(!protectedRouteContent.includes('return <Navigate to="/login" replace />;'), "ProtectedRoute KHÔNG còn hardcode redirect /login cho staff");



console.log(`\n=== TỔNG KẾT: ${passCount} PASSED, ${failCount} FAILED ===`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log("Tất cả tiêu chí kiểm thử tự động đều ĐẠT!");
}
