import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import MainLayout from "../components/layout/MainLayout";
import ProtectedRoute from "./ProtectedRoute";
import GuestRoute from "./GuestRoute";
import LoginPage from "../modules/auth/LoginPage";
import RegisterPage from "../modules/auth/RegisterPage";
import VerifyEmailPage from "../modules/auth/VerifyEmailPage";
import ForgotPasswordPage from "../modules/auth/ForgotPasswordPage";
import ResetPasswordPage from "../modules/auth/ResetPasswordPage";

const MeetingPage = lazy(() => import("../modules/meeting/MeetingPage"));
const MeetingRoomPage = lazy(() => import("../modules/meeting/MeetingRoomPage"));
const FeedPage = lazy(() => import("../modules/feed/FeedPage"));

const LazyFallback = () => (
  <div className="route-loading-screen">
    <div className="route-loading-spinner" />
    <p>Đang tải...</p>
  </div>
);

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        path: "/",
        element: (
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LazyFallback />}>
                <FeedPage />
              </Suspense>
            ),
          },
          {
            path: "meetings",
            element: (
              <Suspense fallback={<LazyFallback />}>
                <MeetingPage />
              </Suspense>
            ),
          },
          {
            path: "meetings/:id",
            element: (
              <Suspense fallback={<LazyFallback />}>
                <MeetingRoomPage />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: "/login",
        element: (
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        ),
      },
      {
        path: "/register",
        element: (
          <GuestRoute>
            <RegisterPage />
          </GuestRoute>
        ),
      },
      {
        path: "/verify-email",
        element: <VerifyEmailPage />,
      },
      {
        path: "/forgot-password",
        element: (
          <GuestRoute>
            <ForgotPasswordPage />
          </GuestRoute>
        ),
      },
      {
        path: "/reset-password/:token",
        element: (
          <GuestRoute>
            <ResetPasswordPage />
          </GuestRoute>
        ),
      },
    ],
  },
]);
