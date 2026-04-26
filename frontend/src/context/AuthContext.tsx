import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { AuthContext, AuthStatus } from "./auth-context";
import { authService, LoginPayload, RegisterPayload, User } from "../services/auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let active = true;

    authService
      .refresh()
      .then((response) => {
        if (!active) return;
        setUser(response.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setStatus("anonymous");
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await authService.login(payload);
    setUser(response.user);
    setStatus("authenticated");
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const response = await authService.register(payload);
    setUser(response.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
