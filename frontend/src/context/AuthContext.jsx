import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  loginUser,
  googleLoginUser,
  registerUser,
  getMe,
  verifyEmail as verifyEmailAPI,
  logoutUser,
} from "../api/authApi";
import { setTokens, getRefreshToken, clearTokens } from "../api/axiosClient";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const initAuth = useCallback(async () => {
    const storedToken = localStorage.getItem("workhub_token");
    const storedRefreshToken = getRefreshToken();

    if (storedToken) {
      setTokens(storedToken, storedRefreshToken);
      try {
        const userData = await getMe();
        setUser(userData);
      } catch {
        clearTokens();
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    const handleForceLogout = () => {
      clearTokens();
      setUser(null);
    };
    window.addEventListener("workhub:logout", handleForceLogout);
    return () => window.removeEventListener("workhub:logout", handleForceLogout);
  }, []);

  const login = async (email, password) => {
    const data = await loginUser(email, password);
    localStorage.setItem("workhub_token", data.token);
    setTokens(data.token, data.refreshToken);
    setUser(data);
    return data;
  };

  const googleLogin = async (googleToken) => {
    const data = await googleLoginUser(googleToken);
    localStorage.setItem("workhub_token", data.token);
    setTokens(data.token, data.refreshToken);
    setUser(data);
    return data;
  };

  const register = async (fullName, email, password) => {
    const data = await registerUser(fullName, email, password);
    return data;
  };

  const verifyAndLogin = async (email, otp) => {
    const data = await verifyEmailAPI(email, otp);
    if (data.token) {
      localStorage.setItem("workhub_token", data.token);
      setTokens(data.token, data.refreshToken);
      setUser(data);
    }
    return data;
  };

  const logout = async () => {
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await logoutUser(refreshToken);
      }
    } catch {
      // Proceed with client-side cleanup regardless
    }
    clearTokens();
    setUser(null);
  };

  const updateCurrentUser = useCallback((updates) => {
    setUser((currentUser) =>
      currentUser ? { ...currentUser, ...updates } : currentUser
    );
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        googleLogin,
        register,
        verifyAndLogin,
        logout,
        updateCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
