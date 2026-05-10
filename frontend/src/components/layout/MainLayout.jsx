import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import RightSidebar from "./RightSidebar";
import { SocketProvider } from "../../context/SocketContext";
import { CallProvider } from "../../modules/call/CallProvider";
import { isImmersiveRoomRoute, shouldShowRightSidebar } from "./layoutState";

const MainLayout = () => {
  const location = useLocation();
  const isChatRoute = location.pathname.startsWith("/messages");
  const isImmersiveRoute = isImmersiveRoomRoute(location.pathname);
  const showRightSidebar = shouldShowRightSidebar(location.pathname);

  return (
    <SocketProvider>
      <CallProvider>
        <div className="bg-[#f8f9fc] text-slate-900 h-screen overflow-hidden flex flex-col">
          <Header />
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <Sidebar />
            <main
              className={`flex-1 min-w-0 min-h-0 bg-transparent ${
                isChatRoute || isImmersiveRoute ? "overflow-hidden" : "overflow-y-auto"
              }`}
            >
              <Outlet />
            </main>
            {showRightSidebar && <RightSidebar />}
          </div>
        </div>
      </CallProvider>
    </SocketProvider>
  );
};

export default MainLayout;
