import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import AuthLayout from "../components/AuthLayout";
import LoginPage from "../modules/auth/LoginPage";
import RegisterPage from "../modules/auth/RegisterPage";
import VerifyEmailPage from "../modules/auth/VerifyEmailPage";
import ForgotPasswordPage from "../modules/auth/ForgotPasswordPage";
import ResetPasswordPage from "../modules/auth/ResetPasswordPage";
import MeetingPage from "../modules/meeting/MeetingPage";
import MeetingRoomPage from "../modules/meeting/MeetingRoomPage";

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        path: "/",
        element: <App />,
        children: [
          {
            index: true,
            element: (
              <div className="p-8 text-center text-gray-500 text-lg">
                Welcome to WorkHub! 🎉
              </div>
            ),
          },
          {
            path: "meetings",
            element: <MeetingPage />,
          },
          {
            path: "meetings/:id",
            element: <MeetingRoomPage />,
          },
        ],
      },
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        path: "/register",
        element: <RegisterPage />,
      },
      {
        path: "/verify-email",
        element: <VerifyEmailPage />,
      },
      {
        path: "/forgot-password",
        element: <ForgotPasswordPage />,
      },
      {
        path: "/reset-password/:token",
        element: <ResetPasswordPage />,
      },
    ],
  },
]);
