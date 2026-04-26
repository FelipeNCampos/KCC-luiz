import { api, setAccessToken } from "./api";

export type User = {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  role: "admin" | "employee" | "user" | string;
  job_title?: string | null;
  profile_photo_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: User;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = LoginPayload & {
  name: string;
};

function persistAccessToken(response: AuthResponse) {
  setAccessToken(response.access_token);
  return response;
}

export const authService = {
  async login(payload: LoginPayload) {
    const { data } = await api.post<AuthResponse>("/auth/login", payload);
    return persistAccessToken(data);
  },

  async register(payload: RegisterPayload) {
    const { data } = await api.post<AuthResponse>("/auth/register", payload);
    return persistAccessToken(data);
  },

  async refresh() {
    const { data } = await api.post<AuthResponse>("/auth/refresh");
    return persistAccessToken(data);
  },

  async logout() {
    await api.post("/auth/logout");
    setAccessToken(null);
  },

  async me() {
    const { data } = await api.get<User>("/auth/me");
    return data;
  }
};
