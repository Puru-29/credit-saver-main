import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext } from "@/contexts/auth-context";
import {
  clearAuthToken,
  getAuthToken,
  getCurrentUser,
  login as loginRequest,
  register as registerRequest,
  updateCurrentUser,
} from "@/services/auth-api";
import type { AuthUser } from "@/services/auth-api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    setToken(getAuthToken());
    setSessionReady(true);
  }, []);

  const acceptSession = useCallback((authenticatedUser: AuthUser) => {
    setToken(getAuthToken());
    setUser(authenticatedUser);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => acceptSession(await loginRequest(email, password)),
    [acceptSession],
  );
  const register = useCallback(
    async (name: string, email: string, password: string) =>
      acceptSession(await registerRequest(name, email, password)),
    [acceptSession],
  );

  const refreshUser = useCallback(async () => {
    const activeToken = getAuthToken();
    if (!activeToken) throw new Error("Sign in to view your account profile.");
    try {
      const currentUser = await getCurrentUser(activeToken);
      setToken(activeToken);
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 401) {
        clearAuthToken();
        setToken(null);
        setUser(null);
      }
      throw error;
    }
  }, []);

  const saveName = useCallback(async (name: string) => {
    const activeToken = getAuthToken();
    if (!activeToken) throw new Error("Sign in to update your profile.");
    const updatedUser = await updateCurrentUser(activeToken, name);
    setToken(activeToken);
    setUser(updatedUser);
    return updatedUser;
  }, []);

  const signOut = useCallback(() => {
    clearAuthToken();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      sessionReady,
      setUser,
      login,
      register,
      refreshUser,
      saveName,
      signOut,
    }),
    [token, user, sessionReady, login, register, refreshUser, saveName, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
