import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { sidebarMenus } from "./sidebarMenus";
import { useAuth } from "../../auth/useAuth";
import "./MainLayout.css";

function MainLayout({ role, userName, userTitle }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const menu = sidebarMenus[role] || { roleLabel: "", items: [] };
  const current = menu.items.find((item) => item.path === pathname);

  // Mobile (<= 900px): sidebar là drawer. Lưu pathname lúc mở nên khi đổi trang
  // drawer tự đóng mà không cần useEffect. Desktop không dùng các class này.
  const [navOpenFor, setNavOpenFor] = useState(null);
  const navOpen = navOpenFor === pathname;
  const openNav = () => setNavOpenFor(pathname);
  const closeNav = () => setNavOpenFor(null);

  // Ưu tiên user thật; props chỉ còn cho các role chưa làm Auth (C1)
  const displayName = userName ?? user?.ho_ten ?? user?.username ?? "";
  const displayTitle = userTitle ?? user?.role ?? "";

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="layout">
      <Sidebar
        roleLabel={menu.roleLabel}
        items={menu.items}
        userName={displayName}
        userTitle={displayTitle}
        onLogout={handleLogout}
        open={navOpen}
        onClose={closeNav}
      />
      <div
        className={`layout__backdrop${navOpen ? " layout__backdrop--show" : ""}`}
        onClick={closeNav}
        aria-hidden="true"
      />
      <div className="layout__main">
        <Topbar
          title={current?.title ?? current?.label ?? ""}
          userName={displayName}
          navOpen={navOpen}
          onOpenNav={openNav}
        />
        <main className="layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;