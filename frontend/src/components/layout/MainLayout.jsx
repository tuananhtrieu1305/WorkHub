import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import OrganizationRequiredState from "./OrganizationRequiredState";
import { useAuth } from "../../context/AuthContext";
import { SocketProvider } from "../../context/SocketContext";
import { CallProvider } from "../../modules/call/CallProvider";

const MainLayout = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isChatRoute = location.pathname.startsWith("/messages");
  const isOrganizationRoute = location.pathname.startsWith("/organization");
  const hasActiveOrganization = Boolean(user?.activeOrganization?.id);

  return (
    <SocketProvider>
      <CallProvider>
        <div className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-[#f8f9fc] text-slate-900">
          <Header />
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <Sidebar />
            <main
              className={`min-h-0 min-w-0 flex-1 bg-transparent ${
                isChatRoute ? "overflow-hidden" : "overflow-y-auto"
              }`}
            >
              {!hasActiveOrganization && !isOrganizationRoute ? (
                <OrganizationRequiredState />
              ) : (
                <Outlet key={user?.activeOrganization?.id || "no-organization"} />
              )}
            </main>
          </div>
        </div>
      </CallProvider>
    </SocketProvider>
  );
};

export default MainLayout;
