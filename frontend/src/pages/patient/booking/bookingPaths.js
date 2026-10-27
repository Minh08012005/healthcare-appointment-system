export const BOOKING_PATHS = {
  home: "/patient",
  specialty: "/patient/booking/specialty",
  doctor: "/patient/booking/doctor",
  slot: "/patient/booking/slot",
  patientInfo: "/patient/booking/patient-info", // BN11
  confirm: "/patient/booking/confirm", // BN12
  success: "/patient/booking/success", // BN13
  appointments: "/patient/appointments", // BN14 — C2-08B
  appointmentDetail: (id) => `/patient/appointments/${id}`, // BN15 — C2-08B
};