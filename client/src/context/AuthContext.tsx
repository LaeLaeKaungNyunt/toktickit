import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { AuthUser, loginApi, logoutApi, getMeApi, changePasswordApi } from "../api.js";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string, confirmPassword: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const TOKEN_KEY = "toktickit_auth_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || null;
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function restoreSession() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await getMeApi(token);
        setUser(currentUser);
      } catch {
        // Token is invalid/expired/invalidated
        sessionStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, [token]);

  async function login(email: string, password: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await loginApi(email, password);
      setUser(res.user);
      setToken(res.token);
      sessionStorage.setItem(TOKEN_KEY, res.token);
    } catch (err: any) {
      setError(err.message || "Failed to log in");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);
    if (token) {
      try {
        await logoutApi(token);
      } catch {
        // Ignore logout network errors
      }
    }
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setLoading(false);
  }

  async function changePassword(newPassword: string, confirmPassword: string) {
    if (!token) throw new Error("No active session");
    setLoading(true);
    setError(null);
    try {
      const res = await changePasswordApi(token, newPassword, confirmPassword);
      setUser(res.user);
      setToken(res.token);
      sessionStorage.setItem(TOKEN_KEY, res.token);
    } catch (err: any) {
      setError(err.message || "Failed to change password");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  function clearError() {
    setError(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        logout,
        changePassword,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
