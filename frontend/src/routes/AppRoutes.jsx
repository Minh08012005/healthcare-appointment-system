import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "../pages/common/LoginPage";
import RegisterPage from "../pages/common/RegisterPage";
import NotFoundPage from "../pages/common/NotFoundPage";
import PatientHomePage from "../pages/patient/PatientHomePage";
import DoctorHomePage from "../pages/doctor/DoctorHomePage";
import ReceptionistHomePage from "../pages/receptionist/ReceptionistHomePage";
import LabHomePage from "../pages/lab/LabHomePage";
import AdminHomePage from "../pages/admin/AdminHomePage";
import MainLayout from "../components/layout/MainLayout";
import ProtectedRoute from "./ProtectedRoute";
import SelectSpecialtyPage from "../pages/patient/booking/SelectSpecialtyPage";
import SelectDoctorPage from "../pages/patient/booking/SelectDoctorPage";
import SelectSlotPage from "../pages/patient/booking/SelectSlotPage";
import PatientInfoPage from "../pages/patient/booking/PatientInfoPage";
import ConfirmBookingPage from "../pages/patient/booking/ConfirmBookingPage";
import BookingSuccessPage from "../pages/patient/booking/BookingSuccessPage";
function AppRoutes() {
    return (
        <Routes>
            {/* Trang chung */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Bệnh nhân: phải đăng nhập với vai trò Bệnh nhân */}
<Route
    element={
        <ProtectedRoute role="Bệnh nhân">
            <MainLayout role="patient" />
        </ProtectedRoute>
    }
>
    <Route path="/patient" element={<PatientHomePage />} />
    <Route path="/patient/booking/specialty" element={<SelectSpecialtyPage />} />
    <Route path="/patient/booking/doctor" element={<SelectDoctorPage />} />
    <Route path="/patient/booking/slot" element={<SelectSlotPage />} />
    <Route path="/patient/booking/patient-info" element={<PatientInfoPage />} />
    <Route path="/patient/booking/confirm" element={<ConfirmBookingPage />} />
    <Route path="/patient/booking/success" element={<BookingSuccessPage />} />
</Route>

            {/* Bác sĩ */}
            <Route path="/doctor" element={<DoctorHomePage />} />

            {/* Lễ tân */}
            <Route
                element={
                    <MainLayout
                        role="receptionist"
                        userName="Nguyễn Minh"
                        userTitle="Nhân viên lễ tân"
                    />
                }
            >
                <Route
                    path="/receptionist"
                    element={<ReceptionistHomePage />}
                />
            </Route>

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