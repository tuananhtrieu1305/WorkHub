/* eslint-disable react-refresh/only-export-components */
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
import { RoutePageSkeleton } from "../components/common/Skeleton";

const MeetingPage = lazy(() => import("../modules/meeting/MeetingPage"));
const MeetingRoomPage = lazy(() => import("../modules/meeting/MeetingRoomPage"));
const CallRoomPage = lazy(() => import("../modules/call/CallRoomPage"));
const FeedPage = lazy(() => import("../modules/feed/FeedPage"));
const ChatPage = lazy(() => import("../modules/chat/ChatPage"));
const ProfilePage = lazy(() => import("../modules/profile/ProfilePage"));
const OrganizationPage = lazy(() => import("../modules/organization/OrganizationPage"));
const OrganizationDetailPage = lazy(
  () => import("../modules/organization/OrganizationDetailPage"),
);

const LazyFallback = () => (
  <RoutePageSkeleton />
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
            path: "messages",
            element: (
              <Suspense fallback={<LazyFallback />}>
                <ChatPage />
              </Suspense>
            ),
          },
          {
            path: "messages/:conversationId",
            element: (
              <Suspense fallback={<LazyFallback />}>
                <ChatPage />
              </Suspense>
            ),
          },
          {
            path: "profile",
            element: (
              <Suspense fallback={<LazyFallback />}>
                <ProfilePage />
              </Suspense>
            ),
          },
          {
            path: "profile/me",
            element: (
              <Suspense fallback={<LazyFallback />}>
                <ProfilePage />
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
          {
            path: "calls/:id",
            element: (
              <Suspense fallback={<LazyFallback />}>
                <CallRoomPage />
              </Suspense>
            ),
          },
          {
            path: "organization",
            element: (
              <Suspense fallback={<LazyFallback />}>
                <OrganizationPage />
              </Suspense>
            ),
          },
          {
            path: "organization/:organizationId",
            element: (
              <Suspense fallback={<LazyFallback />}>
                <OrganizationDetailPage />
              </Suspense>
            ),
          },
          {
            path: "organization/join/:inviteCode",
            element: (
              <Suspense fallback={<LazyFallback />}>
                <OrganizationPage />
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
