import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "../pages/common/LoginPage";
import RegisterPage from "../pages/common/RegisterPage";
import NotFoundPage from "../pages/common/NotFoundPage";
import PatientHomePage from "../pages/patient/PatientHomePage";
import DoctorHomePage from "../pages/doctor/DoctorHomePage";
import ReceptionistHomePage from "../pages/receptionist/ReceptionistHomePage";
import AdminHomePage from "../pages/admin/AdminHomePage";
import AdminPlaceholderPage from "../pages/admin/AdminPlaceholderPage";
import AdminAccountsPage from "../pages/admin/AdminAccountsPage";
import AdminSpecialtiesPage from "../pages/admin/AdminSpecialtiesPage";
import AdminDoctorsPage from "../pages/admin/AdminDoctorsPage";
import MainLayout from "../components/layout/MainLayout";
import ProtectedRoute from "./ProtectedRoute";
import SelectSpecialtyPage from "../pages/patient/booking/SelectSpecialtyPage";
import SelectDoctorPage from "../pages/patient/booking/SelectDoctorPage";
import SelectSlotPage from "../pages/patient/booking/SelectSlotPage";
import PatientInfoPage from "../pages/patient/booking/PatientInfoPage";
import ConfirmBookingPage from "../pages/patient/booking/ConfirmBookingPage";
import BookingSuccessPage from "../pages/patient/booking/BookingSuccessPage";
import AppointmentListPage from "../pages/patient/appointments/AppointmentListPage";
import AppointmentDetailPage from "../pages/patient/appointments/AppointmentDetailPage";
import OnlineCheckinPage from "../pages/receptionist/checkin/OnlineCheckinPage";
import OfflineCheckinPage from "../pages/receptionist/checkin/OfflineCheckinPage";
import ReceptionQueuePage from "../pages/receptionist/ReceptionQueuePage";
import CallPatientPage from "../pages/doctor/call/CallPatientPage";
import ExaminationPage from "../pages/doctor/examination/ExaminationPage";
import LabOrderListPage from "../pages/lab/LabOrderListPage";
import LabOrderDetailPage from "../pages/lab/LabOrderDetailPage";
import PublicLayout from "../components/layout/PublicLayout";
import NewsListPage from "../pages/public/NewsListPage";
import NewsDetailPage from "../pages/public/NewsDetailPage";
import ProcedurePage from "../pages/public/ProcedurePage";
import QueueSettingsPage from "../pages/admin/QueueSettingsPage";
import AdminContentPage from "../pages/admin/AdminContentPage";

function AppRoutes() {
    return (
        <Routes>
            {/* Trang chung */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Công khai: KHÔNG cần đăng nhập (C6-10, UC-035/036) */}
            <Route element={<PublicLayout />}>
                <Route path="/news" element={<NewsListPage />} />
                <Route path="/news/:id" element={<NewsDetailPage />} />
                <Route path="/procedure" element={<ProcedurePage />} />
            </Route>

            {/* Bệnh nhân: phải đăng nhập với vai trò Bệnh nhân */}
            <Route
                element={
                    <ProtectedRoute role="Bệnh nhân">
                        <MainLayout role="patient" />
                    </ProtectedRoute>
                }
            >
                <Route path="/patient" element={<PatientHomePage />} />
                <Route
                    path="/patient/booking/specialty"
                    element={<SelectSpecialtyPage />}
                />
                <Route
                    path="/patient/booking/doctor"
                    element={<SelectDoctorPage />}
                />
                <Route
                    path="/patient/booking/slot"
                    element={<SelectSlotPage />}
                />
                <Route
                    path="/patient/booking/patient-info"
                    element={<PatientInfoPage />}
                />
                <Route
                    path="/patient/booking/confirm"
                    element={<ConfirmBookingPage />}
                />
                <Route
                    path="/patient/booking/success"
                    element={<BookingSuccessPage />}
                />
                <Route
                    path="/patient/appointments"
                    element={<AppointmentListPage />}
                />
                <Route
                    path="/patient/appointments/:id"
                    element={<AppointmentDetailPage />}
                />
            </Route>

            {/* Bác sĩ: phải đăng nhập với vai trò Bác sĩ */}
            <Route
                element={
                    <ProtectedRoute role="Bác sĩ">
                        <MainLayout role="doctor" />
                    </ProtectedRoute>
                }
            >
                <Route path="/doctor" element={<DoctorHomePage />} />
                <Route path="/doctor/call" element={<CallPatientPage />} />
                <Route
                    path="/doctor/examination/:hoSoId"
                    element={<ExaminationPage />}
                />
            </Route>

            {/* Lễ tân: phải đăng nhập với vai trò Lễ tân */}
            <Route
                element={
                    <ProtectedRoute role="Lễ tân">
                        <MainLayout
                            role="receptionist"
                            userTitle="Nhân viên lễ tân"
                        />
                    </ProtectedRoute>
                }
            >
                <Route
                    path="/receptionist"
                    element={<ReceptionistHomePage />}
                />
                <Route
                    path="/receptionist/check-in-online"
                    element={<OnlineCheckinPage />}
                />
                <Route
                    path="/receptionist/walk-in"
                    element={<OfflineCheckinPage />}
                />
                <Route
                    path="/receptionist/queue"
                    element={<ReceptionQueuePage />}
                />
            </Route>

            {/* Nhân viên phòng xét nghiệm: phải đăng nhập với vai trò Xét nghiệm */}
            <Route
                element={
                    <ProtectedRoute role="Xét nghiệm">
                        <MainLayout role="lab" />
                    </ProtectedRoute>
                }
            >
                <Route path="/lab" element={<LabOrderListPage />} />
                <Route
                    path="/lab/orders/:id"
                    element={<LabOrderDetailPage />}
                />
            </Route>

            {/* Quản trị viên: phải đăng nhập với vai trò Quản trị viên */}
            <Route
                element={
                    <ProtectedRoute role="Quản trị viên">
                        <MainLayout role="admin" userTitle="Quản trị viên" />
                    </ProtectedRoute>
                }
            >
                <Route path="/admin" element={<AdminHomePage />} />
                <Route
                    path="/admin/accounts"
                    element={<AdminAccountsPage />}
                />
                <Route
                    path="/admin/specialties"
                    element={<AdminSpecialtiesPage />}
                />
                <Route
                    path="/admin/doctors"
                    element={<AdminDoctorsPage />}
                />
                <Route
                    path="/admin/rooms"
                    element={
                        <AdminPlaceholderPage
                            title="Quản lý phòng"
                            taskCode="C6-04"
                            description="Quản lý danh mục phòng khám bệnh và các phòng xét nghiệm, chẩn đoán hình ảnh."
                        />
                    }
                />
                <Route
                    path="/admin/schedules"
                    element={
                        <AdminPlaceholderPage
                            title="Quản lý lịch trực"
                            taskCode="C6-07"
                            description="Phân công ca khám và lịch làm việc của bác sĩ theo ngày, ca và phòng khám."
                        />
                    }
                />
                <Route
                    path="/admin/time-slots"
                    element={
                        <AdminPlaceholderPage
                            title="Cấu hình khung giờ & Slot"
                            taskCode="C6-06"
                            description="Cấu hình khung giờ hoạt động và thiết lập phân bổ số lượng slot đặt khám."
                        />
                    }
                />
                <Route
                    path="/admin/queue-settings"
                    element={<QueueSettingsPage />}
                />
                <Route
                    path="/admin/overview"
                    element={
                        <AdminPlaceholderPage
                            title="Tổng quan lịch khám"
                            taskCode="C6-07"
                            description="Xem bức tranh tổng thể lịch khám của tất cả bác sĩ theo ngày hoặc tuần."
                        />
                    }
                />
                <Route
                    path="/admin/content"
                    element={<AdminContentPage />}
                />
            </Route>

            {/* URL không tồn tại: phải nằm cuối cùng */}
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
}

export default AppRoutes;
