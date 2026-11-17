// Đường dẫn công khai (C6-10): khách chưa đăng nhập vẫn vào được
export const PUBLIC_PATHS = {
  news: "/news", // UC-035
  newsDetail: (id) => `/news/${id}`,
  procedure: "/procedure", // UC-036
};
