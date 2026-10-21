import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "../pages/common/LoginPage";
import RegisterPage from "../pages/common/RegisterPage";
import NotFoundPage from "../pages/common/NotFoundPage";
import PatientHomePage from "../pages/patient/PatientHomePage";
import DoctorHomePage from "../pages/doctor/DoctorHomePage";
import ReceptionistHomePage from "../pages/receptionist/ReceptionistHomePage";
import LabHomePage from "../pages/lab/LabHomePage";
import AdminHomePage from "../pages/admin/AdminHomePage";

function AppRoutes() {
  return (
    <Routes>
      {/* Trang chung */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Bệnh nhân */}
      <Route path="/patient" element={<PatientHomePage />} />

      {/* Bác sĩ */}
      <Route path="/doctor" element={<DoctorHomePage />} />

      {/* Lễ tân */}
      <Route path="/receptionist" element={<ReceptionistHomePage />} />

      {/* Nhân viên phòng xét nghiệm */}
      <Route path="/lab" element={<LabHomePage />} />

      {/* Quản trị */}
      <Route path="/admin" element={<AdminHomePage />} />

      {/* URL không tồn tại: phải nằm cuối cùng */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;