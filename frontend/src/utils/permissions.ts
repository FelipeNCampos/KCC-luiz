import { User } from "../services/auth";

const CASH_FLOW_ROLES = new Set(["admin", "manager"]);
const TASK_ROLES = new Set(["admin", "employee"]);
const OVERVIEW_ROLES = new Set(["admin", "manager", "user"]);
const OAKHILL_ROLES = new Set(["admin", "manager"]);

export function canAccessOverview(user: User | null) {
  if (!user) return false;
  return OVERVIEW_ROLES.has(user.role);
}

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

export function canManageUsers(user: User | null) {
  return user?.role === "admin";
}

export function canAccessOakHill(user: User | null) {
  if (!user) return false;
  return OAKHILL_ROLES.has(user.role) || (user.cargo !== null && user.cargo !== undefined && user.cargo >= 2);
}
