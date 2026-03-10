import { createContext, useContext, useState, useEffect } from "react";
import {
  loginUser,
  registerUser,
  getMe,
  verifyEmail as verifyEmailAPI,
} from "../services/authService";

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
  const [token, setToken] = useState(localStorage.getItem("workhub_token"));
  const [loading, setLoading] = useState(true);

  // On mount, check if we have a stored token and fetch user
  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const userData = await getMe();
          setUser(userData);
        } catch {
          // Token is invalid, clear it
          localStorage.removeItem("workhub_token");
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [token]);

  const login = async (email, password) => {
    const data = await loginUser(email, password);
    localStorage.setItem("workhub_token", data.token);
    setToken(data.token);
    setUser(data);
    return data;
  };

  const register = async (fullName, email, password) => {
    // Registration no longer returns a token — user must verify email first
    const data = await registerUser(fullName, email, password);
    return data; // { message, email }
  };

  const verifyAndLogin = async (email, otp) => {
    const data = await verifyEmailAPI(email, otp);
    if (data.token) {
      localStorage.setItem("workhub_token", data.token);
      setToken(data.token);
      setUser(data);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem("workhub_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, verifyAndLogin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
