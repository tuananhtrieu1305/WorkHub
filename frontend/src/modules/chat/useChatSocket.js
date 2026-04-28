import { useEffect, useMemo } from "react";
import { io } from "socket.io-client";
import { getAccessToken } from "../../api/axiosClient";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";

export const useChatSocket = (enabled = true) => {
  const token = enabled
    ? getAccessToken() || localStorage.getItem("workhub_token")
    : null;

  const socket = useMemo(() => {
    if (!token) return null;

    return io(API_URL, {
      auth: { token },
      autoConnect: false,
    });
  }, [token]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleConnect = () => {
      console.log("Socket.IO connected");
    };
    const handleConnectError = (error) => {
      console.error("Socket.IO connection error:", error.message);
    };
    const handleDisconnect = (reason) => {
      console.log("Socket.IO disconnected:", reason);
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);
    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      socket.disconnect();
    };
  }, [socket]);

  return { socket, isAuthenticated: Boolean(token) };
};
