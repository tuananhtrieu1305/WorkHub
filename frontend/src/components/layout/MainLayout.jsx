import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import RightSidebar from "./RightSidebar";

const MainLayout = () => {
  return (
    <div className="bg-[#f8f9fc] text-slate-900 min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-transparent">
          <Outlet />
        </main>
        <RightSidebar />
      </div>
    </div>
  );
};

export default MainLayout;
