/**
 * Post-login routing paths and role definitions
 */
export const POST_LOGIN_PATHS = new Map([
  ["Bệnh nhân", "/patient"],
  ["Bác sĩ", "/doctor"],
  ["Lễ tân", "/receptionist"],
  ["Xét nghiệm", "/lab"],
  ["Quản trị viên", "/admin"],
]);

export const getPostLoginPath = (role) => POST_LOGIN_PATHS.get(role) || "/not-found";

export const PATIENT_ROLES = ["Bệnh nhân"];
export const STAFF_ROLES = ["Bác sĩ", "Lễ tân", "Xét nghiệm", "Quản trị viên"];

export const POST_LOGOUT_PATHS = {
  PATIENT: "/login",
  STAFF: "/staff/login",
};

export const getPostLogoutPath = (role) => {
  if (
    STAFF_ROLES.includes(role) ||
    ["doctor", "receptionist", "lab", "admin"].includes(role)
  ) {
    return POST_LOGOUT_PATHS.STAFF;
  }
  return POST_LOGOUT_PATHS.PATIENT;
};

