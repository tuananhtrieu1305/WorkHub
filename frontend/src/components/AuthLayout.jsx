import { Outlet } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { MeetingProvider } from "../modules/meeting/MeetingContext";

const AuthLayout = () => {
  return (
    <AuthProvider>
      <MeetingProvider>
        <Outlet />
      </MeetingProvider>
    </AuthProvider>
  );
};

export default AuthLayout;
