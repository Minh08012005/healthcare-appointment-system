import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { sidebarMenus } from "./sidebarMenus";
import "./MainLayout.css";

function MainLayout({ role, userName, userTitle }) {
  const { pathname } = useLocation();
  const menu = sidebarMenus[role];
  const current = menu.items.find((item) => item.path === pathname);

  return (
    <div className="layout">
      <Sidebar
        roleLabel={menu.roleLabel}
        items={menu.items}
        userName={userName}
        userTitle={userTitle}
      />
      <div className="layout__main">
        <Topbar title={current?.title ?? current?.label ?? ""} userName={userName} />
        <main className="layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;