import { useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import { authApi } from "../api/auth";
import { getToken, setToken, clearToken } from "./tokenStorage";
import { getPostLogoutPath } from "./authPaths";

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

  const login = async (username, password, allowedRoles = null) => {
    const res = await authApi.login({ username, password });
    const tempUser = res.data?.user;

    // Portal Boundary Validation: kiểm tra role TRƯỚC KHI lưu token và TRƯỚC KHI set user
    if (
      allowedRoles &&
      Array.isArray(allowedRoles) &&
      allowedRoles.length > 0 &&
      tempUser &&
      !allowedRoles.includes(tempUser.role)
    ) {
      clearToken();
      setUser(null);
      return { mismatch: true, role: tempUser.role, user: tempUser };
    }

    setToken(res.data.token);
    try {
      const me = await authApi.me(); // lấy đủ thông tin (ho_ten...)
      setUser(me.data.user);
      return me.data.user;
    } catch (err) {
      clearToken();
      setUser(null);
      throw err;
    }
  };

  const logout = async (fallbackRole) => {
    const roleBeforeLogout = user?.role || fallbackRole;
    try {
      await authApi.logout();
    } catch {
      // token hết hạn vẫn cho đăng xuất ở client
    }
    clearToken();
    setUser(null);
    return {
      redirectPath: getPostLogoutPath(roleBeforeLogout),
      role: roleBeforeLogout,
    };
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
