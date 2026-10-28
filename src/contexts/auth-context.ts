import { createContext } from "react";
import type { AuthUser } from "@/services/auth-api";

export interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  sessionReady: boolean;
  setUser: (user: AuthUser) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  refreshUser: () => Promise<AuthUser>;
  saveName: (name: string) => Promise<AuthUser>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
