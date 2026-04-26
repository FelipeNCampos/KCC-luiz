import { User } from "./auth";
import { api } from "./api";

export type SystemUserRole = "admin" | "manager" | "employee" | "user";

export type SystemUser = User & {
  role: SystemUserRole | string;
};

export type UserAdminUpdatePayload = {
  role?: SystemUserRole;
  job_title?: string | null;
  is_active?: boolean;
};

export const usersService = {
  async listUsers() {
    const { data } = await api.get<SystemUser[]>("/users");
    return data;
  },

  async updateUser(userId: number, payload: UserAdminUpdatePayload) {
    const { data } = await api.patch<SystemUser>(`/users/${userId}`, payload);
    return data;
  }
};
