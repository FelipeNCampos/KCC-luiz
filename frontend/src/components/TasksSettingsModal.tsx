import { FormEvent, useEffect, useState } from "react";
import { AxiosError } from "axios";
import { Settings2, Upload, Users, X } from "lucide-react";

import { EmployeeRecord, tasksService } from "../services/tasks";

type EmployeeForm = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  jobTitle: string;
  isActive: boolean;
  profilePhoto: File | null;
};

const defaultEmployeeForm: EmployeeForm = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  jobTitle: "",
  isActive: true,
  profilePhoto: null
};

export function TasksSettingsModal({
  open,
  onClose,
  initialModuleActive,
  onSettingsChanged
}: {
  open: boolean;
  onClose: () => void;
  initialModuleActive: boolean;
  onSettingsChanged: () => void;
}) {
  const [moduleActive, setModuleActive] = useState(initialModuleActive);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [savingModule, setSavingModule] = useState(false);
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(defaultEmployeeForm);
  const [employeePreviewUrl, setEmployeePreviewUrl] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    setModuleActive(initialModuleActive);
  }, [initialModuleActive]);

  useEffect(() => {
    if (!open) return;
    void refreshEmployees();
  }, [open]);

  useEffect(() => {
    return () => {
      if (employeePreviewUrl) URL.revokeObjectURL(employeePreviewUrl);
    };
  }, [employeePreviewUrl]);

  async function refreshEmployees() {
    setLoadingEmployees(true);
    try {
      const items = await tasksService.listEmployees();
      setEmployees(items);
    } catch (error) {
      const requestError = error as AxiosError<{ detail?: string }>;
      setFeedback({ type: "error", message: requestError.response?.data?.detail ?? "Unable to load employees." });
    } finally {
      setLoadingEmployees(false);
    }
  }

  async function handleModuleToggle() {
    setSavingModule(true);
    try {
      const response = await tasksService.updateModuleSettings(!moduleActive);
      setModuleActive(response.is_active);
      setFeedback({ type: "success", message: response.is_active ? "Tasks module enabled." : "Tasks module disabled." });
      onSettingsChanged();
    } catch (error) {
      const requestError = error as AxiosError<{ detail?: string }>;
      setFeedback({ type: "error", message: requestError.response?.data?.detail ?? "Unable to update the module." });
    } finally {
      setSavingModule(false);
    }
  }

  async function handleEmployeeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmployeeError(null);
    setFeedback(null);

    if (!employeeForm.fullName.trim() || !employeeForm.email.trim()) {
      setEmployeeError("Please complete the required employee details.");
      return;
    }
    if (!editingEmployeeId && !employeeForm.password) {
      setEmployeeError("Please set a password.");
      return;
    }
    if (employeeForm.password !== employeeForm.confirmPassword) {
      setEmployeeError("Passwords do not match.");
      return;
    }

    setSavingEmployee(true);
    try {
      if (editingEmployeeId) {
        await tasksService.updateEmployee(editingEmployeeId, {
          fullName: employeeForm.fullName.trim(),
          email: employeeForm.email.trim(),
          password: employeeForm.password || undefined,
          jobTitle: employeeForm.jobTitle.trim(),
          isActive: employeeForm.isActive,
          profilePhoto: employeeForm.profilePhoto
        });
        setFeedback({ type: "success", message: "Employee updated." });
      } else {
        await tasksService.createEmployee({
          fullName: employeeForm.fullName.trim(),
          email: employeeForm.email.trim(),
          password: employeeForm.password,
          jobTitle: employeeForm.jobTitle.trim(),
          profilePhoto: employeeForm.profilePhoto
        });
        setFeedback({ type: "success", message: "Employee created." });
      }

      setEditingEmployeeId(null);
      setEmployeeForm(defaultEmployeeForm);
      if (employeePreviewUrl) {
        URL.revokeObjectURL(employeePreviewUrl);
        setEmployeePreviewUrl(null);
      }
      await refreshEmployees();
      onSettingsChanged();
    } catch (error) {
      const requestError = error as AxiosError<{ detail?: string }>;
      setEmployeeError(requestError.response?.data?.detail ?? "Unable to save the employee.");
    } finally {
      setSavingEmployee(false);
    }
  }

  function startEditingEmployee(employee: EmployeeRecord) {
    setEditingEmployeeId(employee.id);
    setEmployeeError(null);
    setEmployeeForm({
      fullName: employee.name,
      email: employee.email,
      password: "",
      confirmPassword: "",
      jobTitle: employee.job_title ?? "",
      isActive: employee.is_active,
      profilePhoto: null
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
      <article className="tasks-modal-shell grid w-full max-w-5xl gap-0 overflow-hidden md:grid-cols-[360px_minmax(0,1fr)]">
        <section className="border-b border-oak-border bg-oak-surface/50 p-6 md:border-b-0 md:border-r">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="oak-label">Tasks</p>
              <h2 className="mt-2 text-xl font-extrabold text-oak-coffee">Settings</h2>
              <p className="tasks-muted mt-2 text-sm">Manage module access and employee accounts.</p>
            </div>
            <button className="tasks-icon-button" type="button" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          <div className="tasks-surface grid gap-4 p-5">
            <div className="flex items-center gap-3">
              <Settings2 size={18} className="text-oak-taupe" />
              <div>
                <h3 className="text-base font-extrabold text-oak-coffee">Module activation</h3>
                <p className="tasks-muted text-sm">Enable or disable the Tasks module for all users.</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-oak-border p-4">
              <div>
                <p className="text-sm font-bold text-oak-coffee">{moduleActive ? "Module active" : "Module disabled"}</p>
                <p className="tasks-muted text-sm">{moduleActive ? "The board is available to administrators and employees." : "The board is blocked for everyone."}</p>
              </div>
              <button className="tasks-button-primary" disabled={savingModule} type="button" onClick={handleModuleToggle}>
                {savingModule ? "Saving..." : moduleActive ? "Disable" : "Enable"}
              </button>
            </div>
          </div>

          {feedback ? (
            <section className={`mt-4 tasks-alert ${feedback.type === "error" ? "tasks-alert-error" : "tasks-alert-success"}`}>
              {feedback.message}
            </section>
          ) : null}
        </section>

        <section className="grid gap-6 p-6">
          <div className="flex items-center gap-3">
            <Users size={18} className="text-oak-taupe" />
            <div>
              <h3 className="text-lg font-extrabold text-oak-coffee">Employee access</h3>
              <p className="tasks-muted text-sm">Create and manage employee logins for the Tasks module.</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
            <form className="grid gap-4" onSubmit={handleEmployeeSubmit}>
              <label className="grid gap-2">
                <span className="oak-label">Full name</span>
                <input
                  className="tasks-input"
                  value={employeeForm.fullName}
                  onChange={(event) => setEmployeeForm((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder="Full name"
                />
              </label>

              <label className="grid gap-2">
                <span className="oak-label">Email address</span>
                <input
                  className="tasks-input"
                  type="email"
                  value={employeeForm.email}
                  onChange={(event) => setEmployeeForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="name@example.com"
                />
              </label>

              <label className="grid gap-2">
                <span className="oak-label">Job title</span>
                <input
                  className="tasks-input"
                  value={employeeForm.jobTitle}
                  onChange={(event) => setEmployeeForm((current) => ({ ...current, jobTitle: event.target.value }))}
                  placeholder="Job title"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="oak-label">{editingEmployeeId ? "New password" : "Password"}</span>
                  <input
                    className="tasks-input"
                    type="password"
                    value={employeeForm.password}
                    onChange={(event) => setEmployeeForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder={editingEmployeeId ? "Leave blank to keep it" : "Password"}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="oak-label">Confirm password</span>
                  <input
                    className="tasks-input"
                    type="password"
                    value={employeeForm.confirmPassword}
                    onChange={(event) => setEmployeeForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                    placeholder="Confirm password"
                  />
                </label>
              </div>

              <div className="grid gap-2">
                <span className="oak-label">Profile photo</span>
                <label className="tasks-upload">
                  <Upload size={16} />
                  <span>{employeeForm.profilePhoto?.name ?? "Choose profile photo"}</span>
                  <input
                    className="hidden"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      if (employeePreviewUrl) URL.revokeObjectURL(employeePreviewUrl);
                      setEmployeeForm((current) => ({ ...current, profilePhoto: file }));
                      setEmployeePreviewUrl(file ? URL.createObjectURL(file) : null);
                    }}
                  />
                </label>
                {employeePreviewUrl ? (
                  <img alt="Profile preview" className="h-24 w-24 rounded-xl border border-oak-border object-cover" src={employeePreviewUrl} />
                ) : null}
              </div>

              {editingEmployeeId ? (
                <label className="flex items-center gap-3 text-sm font-semibold text-oak-coffee">
                  <input
                    checked={employeeForm.isActive}
                    type="checkbox"
                    onChange={(event) => setEmployeeForm((current) => ({ ...current, isActive: event.target.checked }))}
                  />
                  Active employee
                </label>
              ) : null}

              {employeeError ? <p className="text-sm font-bold text-oak-danger">{employeeError}</p> : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button className="tasks-button-primary" disabled={savingEmployee} type="submit">
                  {savingEmployee ? "Saving..." : editingEmployeeId ? "Update employee" : "Create employee"}
                </button>
                {editingEmployeeId ? (
                  <button
                    className="tasks-button-secondary"
                    type="button"
                    onClick={() => {
                      setEditingEmployeeId(null);
                      setEmployeeForm(defaultEmployeeForm);
                      setEmployeeError(null);
                    }}
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-oak-border text-xs uppercase tracking-normal text-oak-taupe">
                    <th className="px-0 py-3 font-bold">Full name</th>
                    <th className="px-0 py-3 font-bold">Email address</th>
                    <th className="px-0 py-3 font-bold">Job title</th>
                    <th className="px-0 py-3 font-bold">Status</th>
                    <th className="px-0 py-3 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingEmployees ? (
                    <tr>
                      <td className="py-6 text-sm font-semibold text-black/60" colSpan={5}>
                        Loading employees...
                      </td>
                    </tr>
                  ) : employees.length > 0 ? (
                    employees.map((employee) => (
                      <tr key={employee.id} className="border-b border-oak-border/70 last:border-b-0">
                        <td className="py-4 text-sm font-bold text-oak-coffee">{employee.name}</td>
                        <td className="py-4 text-sm text-black/65">{employee.email}</td>
                        <td className="py-4 text-sm text-black/65">{employee.job_title || "Not set"}</td>
                        <td className="py-4 text-sm font-semibold text-black/65">{employee.is_active ? "Active" : "Inactive"}</td>
                        <td className="py-4 text-right">
                          <button className="tasks-button-secondary !min-h-9 !px-3" type="button" onClick={() => startEditingEmployee(employee)}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-6 text-sm font-semibold text-black/60" colSpan={5}>
                        No employees have been added yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}
