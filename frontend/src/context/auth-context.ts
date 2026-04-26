import { createContext } from "react";

import { LoginPayload, RegisterPayload, User } from "../services/auth";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
