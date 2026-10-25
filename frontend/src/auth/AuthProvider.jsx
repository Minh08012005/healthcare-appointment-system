import { useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import { authApi } from "../api/auth";
import { getToken, setToken, clearToken } from "./tokenStorage";

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Có token thì phải hỏi /me trước khi biết đã đăng nhập hay chưa
  const [loading, setLoading] = useState(() => !!getToken());

  // F5 trang: dùng token cũ để lấy lại user
  useEffect(() => {
    if (!getToken()) return;
    authApi
      .me()
      .then((res) => setUser(res.data.user))
      .catch((err) => {
        // Chỉ xoá token khi Backend xác nhận phiên không còn hợp lệ (401/403).
        // Lỗi mạng / Backend tạm thời không được xoá token, để lần sau thử lại.
        if (err?.status === 401 || err?.status === 403) {
          clearToken();
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const res = await authApi.login({ username, password });
    setToken(res.data.token);
    try {
      const me = await authApi.me(); // lấy đủ thông tin (ho_ten...)
      setUser(me.data.user);
    } catch (err) {
      clearToken();
      throw err;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // token hết hạn vẫn cho đăng xuất ở client
    }
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;