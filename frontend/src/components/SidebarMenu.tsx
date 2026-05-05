import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Building2,
  BookOpen,
  CircleDollarSign,
  HardHat,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Package,
  QrCode,
  Settings2,
  Sparkles,
  UsersRound
} from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import { TasksSettingsModal } from "./TasksSettingsModal";
import { tasksService } from "../services/tasks";
import {
  canAccessCashFlow,
  canAccessOakHill,
  canAccessOverview,
  canAccessTasks,
  canManageTasks,
  canManageUsers
} from "../utils/permissions";

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-bold transition-all duration-200 ${
    isActive
      ? "bg-white text-oak-coffee shadow-oak"
      : "text-oak-muted hover:bg-white/70 hover:text-oak-coffee"
  }`;

export function SidebarMenu() {
  const { user, logout } = useAuth();
  const [tasksModuleActive, setTasksModuleActive] = useState(true);
  const [isTasksSettingsOpen, setIsTasksSettingsOpen] = useState(false);

  useEffect(() => {
    if (!canAccessTasks(user)) return;
    let active = true;
    tasksService
      .getModuleSettings()
      .then((response) => {
        if (!active) return;
        setTasksModuleActive(response.is_active);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <>
      <aside className="hidden border-r border-oak-border bg-[#faf8f6] lg:block">
        <div className="sticky top-0 flex h-[100dvh] flex-col p-4">
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-oak">
          <div className="grid size-11 place-items-center rounded-xl bg-oak-panel text-oak-coffee">
            <Building2 size={22} />
          </div>
          <div className="min-w-0">
            <p className="oak-label">KCC Flats</p>
            <h1 className="truncate text-lg font-extrabold text-oak-coffee">Controll</h1>
          </div>
        </div>

        <nav className="grid gap-1">
          {canAccessOverview(user) ? (
            <NavLink to="/" className={navItemClass}>
              <LayoutDashboard size={18} strokeWidth={2.1} />
              <span>Overview</span>
            </NavLink>
          ) : null}

          {canAccessCashFlow(user) ? (
            <>
              <NavLink to="/cash-flow" className={navItemClass}>
                <CircleDollarSign size={18} strokeWidth={2.1} />
                <span>Cashflow</span>
              </NavLink>
              <NavLink to="/cash-flow-52" className={navItemClass}>
                <CircleDollarSign size={18} strokeWidth={2.1} />
                <span>Cashflow 52</span>
              </NavLink>
            </>
          ) : null}

          {canAccessTasks(user) ? (
            <div
              className={`flex items-center gap-2 rounded-lg ${tasksModuleActive ? "" : "opacity-65"}`}
            >
              <NavLink
                to="/tasks"
                className={({ isActive }) => `${navItemClass({ isActive })} min-w-0 flex-1`}
              >
                <ListChecks size={18} strokeWidth={2.1} />
                <span>Tasks</span>
              </NavLink>
              {canManageTasks(user) ? (
                <button
                  className="grid size-11 shrink-0 place-items-center rounded-lg border border-oak-border bg-white text-oak-taupe transition-all duration-200 hover:border-oak-taupe hover:text-oak-coffee"
                  type="button"
                  aria-label="Open task settings"
                  onClick={() => setIsTasksSettingsOpen(true)}
                >
                  <Settings2 size={16} strokeWidth={2.1} />
                </button>
              ) : null}
            </div>
          ) : null}

          {canAccessOakHill(user) ? (
            <>
              <p className="px-3 pt-3 text-[10px] font-extrabold uppercase tracking-normal text-oak-taupe">
                QR Codes
              </p>
              <NavLink to="/qr-codes" className={navItemClass}>
                <QrCode size={18} strokeWidth={2.1} />
                <span>QR Codes</span>
              </NavLink>

              <p className="px-3 pt-3 text-[10px] font-extrabold uppercase tracking-normal text-oak-taupe">
                Management
              </p>
              <NavLink to="/cleaner" className={navItemClass}>
                <Sparkles size={18} strokeWidth={2.1} />
                <span>Cleaner</span>
              </NavLink>

              <NavLink to="/checklist" className={navItemClass}>
                <ListChecks size={18} strokeWidth={2.1} />
                <span>Checklist</span>
              </NavLink>

              <NavLink to="/contractor" className={navItemClass}>
                <HardHat size={18} strokeWidth={2.1} />
                <span>Contractor</span>
              </NavLink>

              <NavLink to="/stock" className={navItemClass}>
                <Package size={18} strokeWidth={2.1} />
                <span>Stock</span>
              </NavLink>

              <NavLink to="/instructions" className={navItemClass}>
                <BookOpen size={18} strokeWidth={2.1} />
                <span>Guide Video</span>
              </NavLink>
            </>
          ) : null}

          {canManageUsers(user) ? (
            <NavLink to="/users" className={navItemClass}>
              <UsersRound size={18} strokeWidth={2.1} />
              <span>Users</span>
            </NavLink>
          ) : null}
        </nav>

        <div className="mt-auto rounded-2xl border border-oak-border bg-white p-4">
          <p className="oak-label">Signed in</p>
          <p className="mt-2 truncate text-sm font-extrabold text-oak-coffee">{user?.name}</p>
          <p className="truncate text-xs font-semibold text-black/55">{user?.email}</p>
          <button className="oak-button-secondary mt-4 w-full" type="button" onClick={logout}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
        </div>
      </aside>

      {canAccessTasks(user) && canManageTasks(user) ? (
        <TasksSettingsModal
          open={isTasksSettingsOpen}
          initialModuleActive={tasksModuleActive}
          onClose={() => setIsTasksSettingsOpen(false)}
          onSettingsChanged={() => {
            void tasksService.getModuleSettings().then((response) => setTasksModuleActive(response.is_active));
            window.dispatchEvent(new CustomEvent("tasks-settings-sync"));
          }}
        />
      ) : null}
    </>
  );
}
