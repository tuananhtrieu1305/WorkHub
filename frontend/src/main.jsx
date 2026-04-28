import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes/route.jsx";
import { GoogleOAuthProvider } from '@react-oauth/google';

try {
  const cfModule = "@cloudflare/realtimekit-ui/loader";
  const { defineCustomElements } = await import(/* @vite-ignore */ cfModule);
  defineCustomElements(window);
} catch {
  // Cloudflare RealtimeKit UI not available
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <RouterProvider router={router} />
    </GoogleOAuthProvider>
  </StrictMode>,
);
