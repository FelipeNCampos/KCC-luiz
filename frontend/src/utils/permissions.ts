import { User } from "../services/auth";

const CASH_FLOW_ROLES = new Set(["admin", "manager"]);
const TASK_ROLES = new Set(["admin", "employee"]);

export function canAccessCashFlow(user: User | null) {
  if (!user) return false;
  return CASH_FLOW_ROLES.has(user.role);
}

export function canAccessTasks(user: User | null) {
  if (!user) return false;
  return TASK_ROLES.has(user.role);
}

export function canManageTasks(user: User | null) {
  return user?.role === "admin";
}
