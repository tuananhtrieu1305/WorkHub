import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes/route.jsx";
import { defineCustomElements } from "@cloudflare/realtimekit-ui/loader";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { App as AntdApp } from "antd";

defineCustomElements(window);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <AntdApp>
        <RouterProvider router={router} />
      </AntdApp>
    </GoogleOAuthProvider>
  </StrictMode>,
);
