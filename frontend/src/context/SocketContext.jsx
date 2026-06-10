import { createContext, useContext, useEffect, useMemo } from "react";
import { io } from "socket.io-client";
import { getAccessToken } from "../api/axiosClient";
import { API_URL } from "../config/api";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value);
};

export const SocketProvider = ({ children }) => {
  const { user, updateCurrentUser } = useAuth();

  const token = user
    ? getAccessToken() || localStorage.getItem("workhub_token")
    : null;

  const socket = useMemo(() => {
    if (!token) return null;

    return io(API_URL, {
      auth: { token },
      autoConnect: false,
    });
  }, [token]);

  // Global socket lifecycle
  useEffect(() => {
    if (!socket) return undefined;

    const handleConnect = () => {
      console.log("Socket.IO connected (global)");
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

  // Global listener: activity_status_changed
  // This runs on every page, ensuring the current user's status is always up-to-date
  useEffect(() => {
    if (!socket || !user) return undefined;

    const handleActivityStatusChanged = (event) => {
      if (toComparableId(event.userId) === toComparableId(user._id)) {
        updateCurrentUser?.({
          activityStatus: event.activityStatus,
          activityStatusExpiresAt: event.activityStatusExpiresAt,
          isOnline: event.isOnline,
        });
      }
    };

    socket.on("activity_status_changed", handleActivityStatusChanged);

    return () => {
      socket.off("activity_status_changed", handleActivityStatusChanged);
    };
  }, [socket, user?._id, updateCurrentUser]);

  const value = useMemo(
    () => ({
      socket,
      isAuthenticated: Boolean(token),
    }),
    [socket, token],
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
