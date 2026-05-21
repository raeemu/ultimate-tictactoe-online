import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentUser, login as loginRequest, register as registerRequest } from "../api/authApi";
import { clearAuthToken, getAuthToken, setAuthToken } from "../../../shared/auth/tokenStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getAuthToken());
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(Boolean(token));

  const logout = useCallback(() => {
    clearAuthToken();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      if (!token) {
        setInitializing(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser(token);
        if (!cancelled) {
          setUser(currentUser);
        }
      } catch (_err) {
        if (!cancelled) {
          logout();
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [logout, token]);

  const login = useCallback(async (username, password) => {
    const data = await loginRequest(username, password);
    const accessToken = data?.access_token;

    if (!accessToken) {
      throw new Error("Сервер не вернул токен доступа");
    }

    setAuthToken(accessToken);
    setToken(accessToken);
    const currentUser = await getCurrentUser(accessToken);
    setUser(currentUser);
    return currentUser;
  }, []);

  const register = useCallback((username, email, password) => {
    return registerRequest(username, email, password);
  }, []);

  const value = useMemo(
    () => ({
      initializing,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
      register,
      token,
      user,
    }),
    [initializing, login, logout, register, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
