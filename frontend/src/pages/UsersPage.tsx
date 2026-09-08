import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AxiosError } from "axios";
import { Check, Plus, Search, ShieldCheck, UsersRound, X } from "lucide-react";

import { DashboardShell } from "../components/DashboardShell";
import { useAuth } from "../hooks/useAuth";
import { SystemUser, SystemUserRole, usersService } from "../services/users";

const roleOptions: Array<{ value: SystemUserRole; label: string; description: string; access: string }> = [
  { value: "admin", label: "Admin", description: "Full access", access: "All modules and user management" },
  { value: "manager", label: "Manager", description: "Financial and operational access", access: "Overview, cashflow, and operations" },
  { value: "employee", label: "Employee", description: "Tasks access", access: "Assigned tasks" },
  { value: "user", label: "User", description: "Overview access", access: "Overview only" }
];

type UserDraft = {
  role: SystemUserRole;
  jobTitle: string;
  isActive: boolean;
};

type CreateUserDraft = {
  name: string;
  email: string;
  password: string;
  role: SystemUserRole;
  jobTitle: string;
  isActive: boolean;
};

const initialCreateDraft: CreateUserDraft = {
  name: "",
  email: "",
  password: "",
  role: "user",
  jobTitle: "",
  isActive: true
};

function normalizeRole(role: string): SystemUserRole {
  if (role === "admin" || role === "manager" || role === "employee" || role === "user") return role;
  return "user";
}

function toDraft(user: SystemUser): UserDraft {
  return {
    role: normalizeRole(user.role),
    jobTitle: user.job_title ?? "",
    isActive: user.is_active
  };
}

function formatRole(role: string) {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [drafts, setDrafts] = useState<Record<number, UserDraft>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateUserDraft>(initialCreateDraft);
  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFeedback(null);

    usersService
      .listUsers()
      .then((response) => {
        if (!active) return;
        setUsers(response);
        setDrafts(Object.fromEntries(response.map((item) => [item.id, toDraft(item)])));
      })
      .catch((requestError: AxiosError<{ detail?: string }>) => {
        if (!active) return;
        setFeedback({ type: "error", message: requestError.response?.data?.detail ?? "Unable to load users." });
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((item) => {
      return (
        item.name.toLowerCase().includes(term) ||
        item.email.toLowerCase().includes(term) ||
        item.role.toLowerCase().includes(term) ||
        (item.job_title ?? "").toLowerCase().includes(term)
      );
    });
  }, [query, users]);

  const roleCounts = useMemo(() => {
    return roleOptions.map((option) => ({
      ...option,
      count: users.filter((item) => item.role === option.value).length
    }));
  }, [users]);

  function updateDraft(userId: number, patch: Partial<UserDraft>) {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        ...patch
      }
    }));
  }

  async function saveUser(item: SystemUser) {
    const draft = drafts[item.id];
    if (!draft) return;

    setSavingId(item.id);
    setFeedback(null);

    try {
      const updated = await usersService.updateUser(item.id, {
        role: draft.role,
        job_title: draft.jobTitle.trim(),
        is_active: draft.isActive
      });
      setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
      setDrafts((current) => ({ ...current, [updated.id]: toDraft(updated) }));
      setFeedback({ type: "success", message: `${updated.name} updated.` });
    } catch (error) {
      const requestError = error as AxiosError<{ detail?: string }>;
      setFeedback({ type: "error", message: requestError.response?.data?.detail ?? "Unable to update user." });
    } finally {
      setSavingId(null);
    }
  }

  function openCreateUser() {
    setCreateDraft(initialCreateDraft);
    setFeedback(null);
    setIsCreateOpen(true);
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setFeedback(null);

    try {
      const created = await usersService.createUser({
        name: createDraft.name.trim(),
        email: createDraft.email.trim(),
        password: createDraft.password,
        role: createDraft.role,
        job_title: createDraft.jobTitle.trim() || null,
        is_active: createDraft.isActive
      });
      setUsers((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setDrafts((current) => ({ ...current, [created.id]: toDraft(created) }));
      setIsCreateOpen(false);
      setFeedback({ type: "success", message: `${created.name} created with ${formatRole(created.role)} access.` });
    } catch (error) {
      const requestError = error as AxiosError<{ detail?: string }>;
      setFeedback({ type: "error", message: requestError.response?.data?.detail ?? "Unable to create user." });
    } finally {
      setIsCreating(false);
    }
  }

  const selectedRole = roleOptions.find((option) => option.value === createDraft.role) ?? roleOptions[3];

  return (
    <DashboardShell title="Users" subtitle="Edit system access and roles">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="oak-card p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="oak-label">System accounts</p>
              <h2 className="mt-2 text-xl font-extrabold text-oak-coffee">Role management</h2>
              <p className="mt-1 max-w-[58ch] text-sm font-semibold leading-6 text-black/55">
                Change a user between admin, manager, employee, and regular access.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="grid min-w-0 gap-2 md:w-80">
                <span className="oak-label">Search</span>
                <span className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-oak-taupe" size={17} />
                  <input
                    className="oak-input pl-10"
                    value={query}
                    placeholder="Name, email, role"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </span>
              </label>
              <button className="oak-button-primary" type="button" onClick={openCreateUser}>
                <Plus size={17} />
                Add user
              </button>
            </div>
          </div>
        </div>

        <div className="oak-card grid gap-3 p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-oak-panel text-oak-taupe">
              <ShieldCheck size={19} />
            </div>
            <div>
              <p className="oak-label">Access mix</p>
              <p className="text-sm font-bold text-black/55">{users.length} total users</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {roleCounts.map((item) => (
              <div key={item.value} className="rounded-xl border border-oak-border bg-oak-panel p-3">
                <p className="text-lg font-extrabold text-oak-coffee">{item.count}</p>
                <p className="text-xs font-bold text-black/55">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {feedback ? (
        <section className={`tasks-alert ${feedback.type === "success" ? "tasks-alert-success" : "tasks-alert-error"}`}>
          {feedback.message}
        </section>
      ) : null}

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation" onMouseDown={() => !isCreating && setIsCreateOpen(false)}>
          <form
            className="w-full max-w-2xl rounded-2xl border border-oak-border bg-white p-6 shadow-oakLg"
            aria-labelledby="create-user-title"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => void createUser(event)}
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="oak-label">New account</p>
                <h2 id="create-user-title" className="mt-2 text-xl font-extrabold text-oak-coffee">Create user</h2>
                <p className="mt-1 text-sm font-semibold text-black/55">Choose the access profile before sending the account details.</p>
              </div>
              <button className="grid size-10 place-items-center rounded-lg text-oak-taupe hover:bg-oak-panel" type="button" aria-label="Close" disabled={isCreating} onClick={() => setIsCreateOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 sm:col-span-2">
                <span className="oak-label">Full name</span>
                <input className="oak-input" required minLength={2} value={createDraft.name} placeholder="User name" onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label className="grid gap-2">
                <span className="oak-label">Email</span>
                <input className="oak-input" required type="email" value={createDraft.email} placeholder="name@example.com" onChange={(event) => setCreateDraft((current) => ({ ...current, email: event.target.value }))} />
              </label>
              <label className="grid gap-2">
                <span className="oak-label">Password</span>
                <input className="oak-input" required minLength={8} type="password" value={createDraft.password} placeholder="At least 8 characters" onChange={(event) => setCreateDraft((current) => ({ ...current, password: event.target.value }))} />
              </label>
              <label className="grid gap-2">
                <span className="oak-label">Access profile</span>
                <select className="oak-input" value={createDraft.role} onChange={(event) => setCreateDraft((current) => ({ ...current, role: event.target.value as SystemUserRole }))}>
                  {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label} — {option.description}</option>)}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="oak-label">Job title</span>
                <input className="oak-input" value={createDraft.jobTitle} placeholder="Optional" onChange={(event) => setCreateDraft((current) => ({ ...current, jobTitle: event.target.value }))} />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-oak-border bg-oak-panel p-4">
              <p className="oak-label">Selected access</p>
              <p className="mt-1 font-extrabold text-oak-coffee">{selectedRole.label}: {selectedRole.access}</p>
            </div>
            <label className="mt-4 flex min-h-11 items-center gap-3 rounded-lg border border-oak-border px-3.5 text-sm font-bold text-oak-coffee">
              <input type="checkbox" checked={createDraft.isActive} onChange={(event) => setCreateDraft((current) => ({ ...current, isActive: event.target.checked }))} />
              Activate account immediately
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button className="oak-button-secondary" type="button" disabled={isCreating} onClick={() => setIsCreateOpen(false)}>Cancel</button>
              <button className="oak-button-primary" type="submit" disabled={isCreating}>{isCreating ? "Creating..." : "Create user"}<Plus size={16} /></button>
            </div>
          </form>
        </div>
      ) : null}

      <section className="oak-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse">
            <thead className="bg-oak-surface">
              <tr className="text-left">
                <th className="px-5 py-4 text-xs font-extrabold uppercase tracking-normal text-oak-taupe">User</th>
                <th className="px-5 py-4 text-xs font-extrabold uppercase tracking-normal text-oak-taupe">Role</th>
                <th className="px-5 py-4 text-xs font-extrabold uppercase tracking-normal text-oak-taupe">Job title</th>
                <th className="px-5 py-4 text-xs font-extrabold uppercase tracking-normal text-oak-taupe">Status</th>
                <th className="px-5 py-4 text-right text-xs font-extrabold uppercase tracking-normal text-oak-taupe">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index} className="border-t border-oak-border">
                    <td className="px-5 py-4">
                      <div className="h-5 w-44 animate-pulse rounded-lg bg-oak-panel" />
                      <div className="mt-2 h-4 w-56 animate-pulse rounded-lg bg-oak-panel" />
                    </td>
                    <td className="px-5 py-4"><div className="h-11 animate-pulse rounded-lg bg-oak-panel" /></td>
                    <td className="px-5 py-4"><div className="h-11 animate-pulse rounded-lg bg-oak-panel" /></td>
                    <td className="px-5 py-4"><div className="h-11 animate-pulse rounded-lg bg-oak-panel" /></td>
                    <td className="px-5 py-4"><div className="ml-auto h-11 w-28 animate-pulse rounded-lg bg-oak-panel" /></td>
                  </tr>
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((item) => {
                  const draft = drafts[item.id] ?? toDraft(item);
                  const isSelf = currentUser?.id === item.id;
                  const isDirty =
                    draft.role !== normalizeRole(item.role) ||
                    draft.jobTitle !== (item.job_title ?? "") ||
                    draft.isActive !== item.is_active;

                  return (
                    <tr key={item.id} className="border-t border-oak-border align-top">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-oak-panel text-sm font-extrabold text-oak-coffee">
                            {item.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-extrabold text-oak-coffee">{item.name}</p>
                            <p className="truncate text-sm font-semibold text-black/55">{item.email}</p>
                            <p className="mt-1 text-xs font-bold text-oak-taupe">Current: {formatRole(item.role)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <label className="grid gap-2">
                          <span className="sr-only">Role for {item.name}</span>
                          <select
                            className="oak-input"
                            value={draft.role}
                            disabled={isSelf}
                            onChange={(event) => updateDraft(item.id, { role: event.target.value as SystemUserRole })}
                          >
                            {roleOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label} - {option.description}
                              </option>
                            ))}
                          </select>
                          {isSelf ? <span className="text-xs font-bold text-black/45">Own role is locked</span> : null}
                        </label>
                      </td>
                      <td className="px-5 py-4">
                        <input
                          className="oak-input"
                          value={draft.jobTitle}
                          placeholder="Optional"
                          onChange={(event) => updateDraft(item.id, { jobTitle: event.target.value })}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-oak-border bg-white px-3.5 text-sm font-bold text-oak-coffee">
                          <input
                            type="checkbox"
                            checked={draft.isActive}
                            disabled={isSelf}
                            onChange={(event) => updateDraft(item.id, { isActive: event.target.checked })}
                          />
                          Active
                        </label>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          className="oak-button-primary min-w-28"
                          type="button"
                          disabled={!isDirty || savingId === item.id}
                          onClick={() => void saveUser(item)}
                        >
                          {savingId === item.id ? "Saving..." : "Save"}
                          {savingId !== item.id ? <Check size={16} /> : null}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-10">
                    <div className="tasks-empty-state">
                      <div className="flex items-center gap-3">
                        <UsersRound size={20} className="text-oak-taupe" />
                        <p className="font-extrabold text-oak-coffee">No users found</p>
                      </div>
                      <p className="text-sm font-semibold text-black/55">Try another name, email, role, or job title.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
