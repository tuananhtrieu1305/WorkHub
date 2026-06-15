/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  loginUser,
  googleLoginUser,
  registerUser,
  getMe,
  verifyEmail as verifyEmailAPI,
  logoutUser,
} from "../api/authApi";
import {
  setTokens,
  getRefreshToken,
  clearTokens,
  setActiveOrganizationId,
} from "../api/axiosClient";
import {
  createOrganization as createOrganizationApi,
  getMyOrganizations,
  joinOrganization as joinOrganizationApi,
  leaveOrganization as leaveOrganizationApi,
  switchOrganization as switchOrganizationApi,
  updateOrganization as updateOrganizationApi,
  updateOrganizationBanner as updateOrganizationBannerApi,
  updateOrganizationLogo as updateOrganizationLogoApi,
} from "../api/organizationApi";

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

  const applyUser = useCallback((userData) => {
    setUser(userData);
    setActiveOrganizationId(userData?.activeOrganization?.id || null);
  }, []);

  const initAuth = useCallback(async () => {
    const storedToken = localStorage.getItem("workhub_token");
    const storedRefreshToken = getRefreshToken();

    if (storedToken) {
      setTokens(storedToken, storedRefreshToken);
      try {
        const userData = await getMe();
        applyUser(userData);
      } catch {
        clearTokens();
        setUser(null);
      }
    }
    setLoading(false);
  }, [applyUser]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    applyUser(data);
    return data;
  };

  const googleLogin = async (googleToken) => {
    const data = await googleLoginUser(googleToken);
    localStorage.setItem("workhub_token", data.token);
    setTokens(data.token, data.refreshToken);
    applyUser(data);
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
      applyUser(data);
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

  const refreshOrganizations = useCallback(async () => {
    const context = await getMyOrganizations();
    setActiveOrganizationId(context.activeOrganization?.id || null);
    setUser((currentUser) =>
      currentUser ? { ...currentUser, ...context } : currentUser
    );
    return context;
  }, []);

  const createOrganization = useCallback(async (payload) => {
    const context = await createOrganizationApi(payload);
    setActiveOrganizationId(context.activeOrganization?.id || null);
    setUser((currentUser) =>
      currentUser ? { ...currentUser, ...context } : currentUser
    );
    return context;
  }, []);

  const joinOrganization = useCallback(async (inviteLink, payload = {}) => {
    const context = await joinOrganizationApi(inviteLink, payload);
    setActiveOrganizationId(context.activeOrganization?.id || null);
    setUser((currentUser) =>
      currentUser ? { ...currentUser, ...context } : currentUser
    );
    return context;
  }, []);

  const switchActiveOrganization = useCallback(async (organizationId) => {
    const context = await switchOrganizationApi(organizationId);
    setActiveOrganizationId(context.activeOrganization?.id || null);
    setUser((currentUser) =>
      currentUser ? { ...currentUser, ...context } : currentUser
    );
    return context;
  }, []);

  const updateOrganization = useCallback(async (organizationId, payload) => {
    const organization = await updateOrganizationApi(organizationId, payload);
    setUser((currentUser) => {
      if (!currentUser) return currentUser;
      const nextOrganizations = (currentUser.organizations || []).map((item) =>
        item.id === organization.id ? organization : item
      );
      const nextActiveOrganization =
        currentUser.activeOrganization?.id === organization.id
          ? organization
          : currentUser.activeOrganization;

      return {
        ...currentUser,
        organizations: nextOrganizations,
        activeOrganization: nextActiveOrganization,
        activeOrganizationId: nextActiveOrganization?.id || null,
      };
    });
    return organization;
  }, []);

  const applyOrganizationUpdate = useCallback((organization) => {
    setUser((currentUser) => {
      if (!currentUser) return currentUser;
      const nextOrganizations = (currentUser.organizations || []).map((item) =>
        item.id === organization.id ? organization : item
      );
      const nextActiveOrganization =
        currentUser.activeOrganization?.id === organization.id
          ? organization
          : currentUser.activeOrganization;

      return {
        ...currentUser,
        organizations: nextOrganizations,
        activeOrganization: nextActiveOrganization,
        activeOrganizationId: nextActiveOrganization?.id || null,
      };
    });
    return organization;
  }, []);

  const updateOrganizationLogo = useCallback(
    async (organizationId, file) => {
      const organization = await updateOrganizationLogoApi(organizationId, file);
      return applyOrganizationUpdate(organization);
    },
    [applyOrganizationUpdate],
  );

  const updateOrganizationBanner = useCallback(
    async (organizationId, file) => {
      const organization = await updateOrganizationBannerApi(organizationId, file);
      return applyOrganizationUpdate(organization);
    },
    [applyOrganizationUpdate],
  );

  const leaveOrganization = useCallback(async (organizationId) => {
    const context = await leaveOrganizationApi(organizationId);
    setActiveOrganizationId(context.activeOrganization?.id || null);
    setUser((currentUser) =>
      currentUser ? { ...currentUser, ...context } : currentUser
    );
    return context;
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
        refreshOrganizations,
        createOrganization,
        joinOrganization,
        switchActiveOrganization,
        updateOrganization,
        updateOrganizationLogo,
        updateOrganizationBanner,
        leaveOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
