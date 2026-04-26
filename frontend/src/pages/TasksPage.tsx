import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AxiosError } from "axios";
import {
  CheckSquare,
  CirclePlay,
  ListChecks,
  MessageSquareText,
  Paperclip,
  Search,
  Trash2,
  Upload,
  X
} from "lucide-react";

import { DashboardShell } from "../components/DashboardShell";
import { useAuth } from "../hooks/useAuth";
import {
  EmployeeRecord,
  TaskCard,
  TaskDetail,
  TaskFilters,
  TaskMedia,
  TaskStatus,
  tasksService
} from "../services/tasks";
import { canManageTasks } from "../utils/permissions";

type FeedbackState = { type: "success" | "error"; message: string } | null;

type CreateTaskForm = {
  name: string;
  description: string;
  initialStatus: TaskStatus;
  assignedUserIds: number[];
  coverPhoto: File | null;
};

const STATUS_META: Record<TaskStatus, { label: string; icon: typeof ListChecks }> = {
  todo: { label: "To Do", icon: ListChecks },
  in_progress: { label: "In Progress", icon: CirclePlay },
  done: { label: "Done", icon: CheckSquare }
};

const defaultFilters: TaskFilters = {
  search: "",
  status: "all",
  created_from: "",
  created_to: "",
  modified_from: "",
  modified_to: "",
  sort: "created_desc"
};

const defaultCreateTaskForm: CreateTaskForm = {
  name: "",
  description: "",
  initialStatus: "todo",
  assignedUserIds: [],
  coverPhoto: null
};

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en-GB").format(new Date(value));
}

function formatDisplayDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function truncateDescription(value: string | null) {
  if (!value) return "No description added yet.";
  return value;
}

function isImageMime(value: string | undefined) {
  return Boolean(value && value.startsWith("image/"));
}

export function TasksPage() {
  const { user } = useAuth();
  const isAdmin = canManageTasks(user);

  const [moduleActive, setModuleActive] = useState(false);
  const [loadingModule, setLoadingModule] = useState(true);
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(defaultFilters);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTaskForm, setCreateTaskForm] = useState<CreateTaskForm>(defaultCreateTaskForm);
  const [createTaskPreviewUrl, setCreateTaskPreviewUrl] = useState<string | null>(null);
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);
  const [savingTask, setSavingTask] = useState(false);

  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null);
  const [selectedTaskCoverUrl, setSelectedTaskCoverUrl] = useState<string | null>(null);
  const [loadingTaskDetail, setLoadingTaskDetail] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [savingInline, setSavingInline] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaskDetail | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);

  const [coverUrls, setCoverUrls] = useState<Record<number, string>>({});
  const coverUrlsRef = useRef<Record<number, string>>({});

  useEffect(() => {
    let active = true;
    setLoadingModule(true);
    tasksService
      .getModuleSettings()
      .then((response) => {
        if (!active) return;
        setModuleActive(response.is_active);
      })
      .catch((error: AxiosError<{ detail?: string }>) => {
        if (!active) return;
        setFeedback({ type: "error", message: error.response?.data?.detail ?? "Unable to load module settings." });
      })
      .finally(() => {
        if (!active) return;
        setLoadingModule(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    coverUrlsRef.current = coverUrls;
  }, [coverUrls]);

  useEffect(() => {
    return () => {
      Object.values(coverUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      if (createTaskPreviewUrl) URL.revokeObjectURL(createTaskPreviewUrl);
      if (selectedTaskCoverUrl) URL.revokeObjectURL(selectedTaskCoverUrl);
    };
  }, [createTaskPreviewUrl, selectedTaskCoverUrl]);

  useEffect(() => {
    if (!moduleActive) {
      setTasks([]);
      return;
    }

    let active = true;
    setLoadingTasks(true);
    tasksService
      .listTasks(filters)
      .then((items) => {
        if (!active) return;
        setTasks(items);
      })
      .catch((error: AxiosError<{ detail?: string }>) => {
        if (!active) return;
        setFeedback({ type: "error", message: error.response?.data?.detail ?? "Unable to load tasks." });
      })
      .finally(() => {
        if (!active) return;
        setLoadingTasks(false);
      });

    return () => {
      active = false;
    };
  }, [filters, moduleActive]);

  useEffect(() => {
    if (!moduleActive || !isAdmin) {
      setEmployees([]);
      return;
    }

    let active = true;
    tasksService
      .listEmployees()
      .then((items) => {
        if (!active) return;
        setEmployees(items);
      })
      .catch((error: AxiosError<{ detail?: string }>) => {
        if (!active) return;
        setFeedback({ type: "error", message: error.response?.data?.detail ?? "Unable to load employees." });
      });

    return () => {
      active = false;
    };
  }, [isAdmin, moduleActive]);

  useEffect(() => {
    const handleSync = () => {
      tasksService
        .getModuleSettings()
        .then((response) => {
          setModuleActive(response.is_active);
          if (response.is_active && isAdmin) {
            void tasksService.listEmployees().then((items) => setEmployees(items));
          }
        })
        .catch(() => undefined);
    };

    window.addEventListener("tasks-settings-sync", handleSync);
    return () => {
      window.removeEventListener("tasks-settings-sync", handleSync);
    };
  }, [isAdmin]);

  useEffect(() => {
    const taskIdsToFetch = tasks.filter((task) => task.has_cover_photo && !coverUrls[task.id]);
    if (taskIdsToFetch.length === 0) return;

    let active = true;
    void Promise.all(
      taskIdsToFetch.map(async (task) => {
        const blob = await tasksService.getCoverPhoto(task.id);
        return { id: task.id, url: URL.createObjectURL(blob) };
      })
    )
      .then((items) => {
        if (!active) return;
        setCoverUrls((current) => {
          const next = { ...current };
          items.forEach((item) => {
            next[item.id] = item.url;
          });
          return next;
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [tasks, coverUrls]);

  useEffect(() => {
    if (!selectedTask?.has_cover_photo) {
      if (selectedTaskCoverUrl) {
        URL.revokeObjectURL(selectedTaskCoverUrl);
        setSelectedTaskCoverUrl(null);
      }
      return;
    }

    let active = true;
    tasksService
      .getCoverPhoto(selectedTask.id)
      .then((blob) => {
        if (!active) return;
        if (selectedTaskCoverUrl) URL.revokeObjectURL(selectedTaskCoverUrl);
        setSelectedTaskCoverUrl(URL.createObjectURL(blob));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [selectedTask]);

  const tasksByStatus = useMemo(
    () => ({
      todo: tasks.filter((task) => task.status === "todo"),
      in_progress: tasks.filter((task) => task.status === "in_progress"),
      done: tasks.filter((task) => task.status === "done")
    }),
    [tasks]
  );

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.search ||
          (filters.status && filters.status !== "all") ||
          filters.created_from ||
          filters.created_to ||
          filters.modified_from ||
          filters.modified_to ||
          (filters.sort && filters.sort !== "created_desc")
      ),
    [filters]
  );

  const canChatInTask = useMemo(() => {
    if (!user || !selectedTask) return false;
    return user.role === "admin" || selectedTask.assignees.some((assignee) => assignee.id === user.id);
  }, [selectedTask, user]);

  async function refreshTasks() {
    if (!moduleActive) return;
    const items = await tasksService.listTasks(filters);
    setTasks(items);
  }

  async function openTask(taskId: number) {
    setLoadingTaskDetail(true);
    try {
      const detail = await tasksService.getTask(taskId);
      setSelectedTask(detail);
      setMessageDraft("");
    } catch (error) {
      const requestError = error as AxiosError<{ detail?: string }>;
      setFeedback({ type: "error", message: requestError.response?.data?.detail ?? "Unable to open the task." });
    } finally {
      setLoadingTaskDetail(false);
    }
  }

  function closeTask() {
    setSelectedTask(null);
    setMessageDraft("");
    if (selectedTaskCoverUrl) {
      URL.revokeObjectURL(selectedTaskCoverUrl);
      setSelectedTaskCoverUrl(null);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateTaskError(null);
    setFeedback(null);

    if (!createTaskForm.name.trim()) {
      setCreateTaskError("Please add a task name.");
      return;
    }

    setSavingTask(true);
    try {
      await tasksService.createTask({
        name: createTaskForm.name.trim(),
        description: createTaskForm.description.trim(),
        initialStatus: createTaskForm.initialStatus,
        assignedUserIds: createTaskForm.assignedUserIds,
        coverPhoto: createTaskForm.coverPhoto
      });
      setIsCreateOpen(false);
      if (createTaskPreviewUrl) {
        URL.revokeObjectURL(createTaskPreviewUrl);
        setCreateTaskPreviewUrl(null);
      }
      setCreateTaskForm(defaultCreateTaskForm);
      setFeedback({ type: "success", message: "Task created." });
      await refreshTasks();
    } catch (error) {
      const requestError = error as AxiosError<{ detail?: string }>;
      setCreateTaskError(requestError.response?.data?.detail ?? "Unable to create the task.");
    } finally {
      setSavingTask(false);
    }
  }

  async function handleInlineTaskSave(payload: { name?: string; description?: string | null; status?: TaskStatus; assigned_user_ids?: number[] }) {
    if (!selectedTask) return;

    setSavingInline(true);
    try {
      const updated = await tasksService.updateTask(selectedTask.id, payload);
      setSelectedTask(updated);
      setTasks((current) => current.map((task) => (task.id === updated.id ? updated : task)));
    } catch (error) {
      const requestError = error as AxiosError<{ detail?: string }>;
      setFeedback({ type: "error", message: requestError.response?.data?.detail ?? "Unable to save the task." });
    } finally {
      setSavingInline(false);
    }
  }

  async function handleTaskDrop(taskId: number, nextStatus: TaskStatus) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === nextStatus) return;
    try {
      const updated = await tasksService.updateTask(taskId, { status: nextStatus });
      setTasks((current) => current.map((item) => (item.id === taskId ? updated : item)));
      if (selectedTask?.id === taskId) setSelectedTask(updated);
    } catch (error) {
      const requestError = error as AxiosError<{ detail?: string }>;
      setFeedback({ type: "error", message: requestError.response?.data?.detail ?? "Unable to move the task." });
    }
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask || !messageDraft.trim()) return;
    setSendingMessage(true);
    try {
      const message = await tasksService.addMessage(selectedTask.id, messageDraft.trim());
      setSelectedTask((current) => (current ? { ...current, messages: [...current.messages, message] } : current));
      setMessageDraft("");
    } catch (error) {
      const requestError = error as AxiosError<{ detail?: string }>;
      setFeedback({ type: "error", message: requestError.response?.data?.detail ?? "Unable to send the message." });
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleMediaUpload(file: File | null) {
    if (!selectedTask || !file) return;
    setUploadingMedia(true);
    try {
      const media = await tasksService.addMedia(selectedTask.id, file);
      setSelectedTask((current) => (current ? { ...current, media: [...current.media, media] } : current));
    } catch (error) {
      const requestError = error as AxiosError<{ detail?: string }>;
      setFeedback({ type: "error", message: requestError.response?.data?.detail ?? "Unable to upload the file." });
    } finally {
      setUploadingMedia(false);
    }
  }

  async function openMedia(taskId: number, media: TaskMedia) {
    try {
      const response = await tasksService.getMedia(taskId, media.id);
      const objectUrl = URL.createObjectURL(response.blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
    } catch (error) {
      const requestError = error as AxiosError<{ detail?: string }>;
      setFeedback({ type: "error", message: requestError.response?.data?.detail ?? "Unable to open the file." });
    }
  }

  async function confirmDeleteTask() {
    if (!deleteTarget) return;
    setDeletingTask(true);
    try {
      await tasksService.deleteTask(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedTask(null);
      setFeedback({ type: "success", message: "Task deleted." });
      await refreshTasks();
    } catch (error) {
      const requestError = error as AxiosError<{ detail?: string }>;
      setFeedback({ type: "error", message: requestError.response?.data?.detail ?? "Unable to delete the task." });
    } finally {
      setDeletingTask(false);
    }
  }

  const rightSlot = (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
      <span className="tasks-chip">{moduleActive ? "Module active" : "Module disabled"}</span>
      {isAdmin && moduleActive ? (
        <button className="tasks-button-primary" type="button" onClick={() => setIsCreateOpen(true)}>
          <ListChecks size={16} />
          Create task
        </button>
      ) : null}
    </div>
  );

  return (
    <DashboardShell title="Tasks" subtitle="Task board and employee access" rightSlot={rightSlot}>
      <div className="tasks-page grid max-h-[calc(100dvh-10rem)] gap-6 overflow-y-auto pr-1">
        {feedback ? (
          <section className={`tasks-alert ${feedback.type === "error" ? "tasks-alert-error" : "tasks-alert-success"}`}>
            {feedback.message}
          </section>
        ) : null}

        {!moduleActive ? (
          <section className="tasks-surface grid gap-4 p-8">
            <p className="oak-label">Tasks</p>
            <h2 className="text-2xl font-extrabold text-oak-coffee">Module disabled</h2>
            <p className="tasks-muted max-w-[58ch] text-sm">
              The task board is currently disabled. {isAdmin ? "Open task settings from the sidebar to enable the module." : "Please contact an administrator."}
            </p>
          </section>
        ) : (
          <>
            <section className="tasks-surface grid gap-4 p-6">
              <div className="flex items-center gap-3">
                <Search size={18} className="text-oak-taupe" />
                <div>
                  <h2 className="text-lg font-extrabold text-oak-coffee">Board filters</h2>
                  <p className="tasks-muted text-sm">Search, filter and sort tasks in real time.</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-6">
                <label className="grid gap-2 xl:col-span-2">
                  <span className="oak-label">Text search</span>
                  <input
                    className="tasks-input"
                    placeholder="Search by task name or code"
                    value={filters.search}
                    onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="oak-label">Status</span>
                  <select
                    className="tasks-input"
                    value={filters.status}
                    onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as TaskFilters["status"] }))}
                  >
                    <option value="all">All</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="oak-label">Date created from</span>
                  <input
                    className="tasks-input"
                    type="date"
                    value={filters.created_from}
                    onChange={(event) => setFilters((current) => ({ ...current, created_from: event.target.value }))}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="oak-label">Date created to</span>
                  <input
                    className="tasks-input"
                    type="date"
                    value={filters.created_to}
                    onChange={(event) => setFilters((current) => ({ ...current, created_to: event.target.value }))}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="oak-label">Sort</span>
                  <select
                    className="tasks-input"
                    value={filters.sort}
                    onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value as TaskFilters["sort"] }))}
                  >
                    <option value="created_desc">Date created · newest first</option>
                    <option value="created_asc">Date created · oldest first</option>
                    <option value="name_asc">Name · A to Z</option>
                    <option value="name_desc">Name · Z to A</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="oak-label">Last modified from</span>
                  <input
                    className="tasks-input"
                    type="date"
                    value={filters.modified_from}
                    onChange={(event) => setFilters((current) => ({ ...current, modified_from: event.target.value }))}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="oak-label">Last modified to</span>
                  <input
                    className="tasks-input"
                    type="date"
                    value={filters.modified_to}
                    onChange={(event) => setFilters((current) => ({ ...current, modified_to: event.target.value }))}
                  />
                </label>
              </div>

              {hasActiveFilters ? (
                <div>
                  <button className="tasks-button-secondary" type="button" onClick={() => setFilters(defaultFilters)}>
                    Clear filters
                  </button>
                </div>
              ) : null}
            </section>

            <section className="overflow-x-auto">
              <div className="grid min-w-[1020px] gap-4 lg:grid-cols-3">
                {(["todo", "in_progress", "done"] as TaskStatus[]).map((statusKey) => {
                  const meta = STATUS_META[statusKey];
                  const Icon = meta.icon;
                  const items = tasksByStatus[statusKey];

                  return (
                    <article
                      key={statusKey}
                      className="tasks-surface min-h-[480px] p-4"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const taskId = Number(event.dataTransfer.getData("text/plain"));
                        if (taskId) void handleTaskDrop(taskId, statusKey);
                      }}
                    >
                      <header className="mb-4 flex items-center justify-between gap-3 border-b border-oak-border pb-3">
                        <div className="flex items-center gap-2">
                          <Icon size={16} className="text-oak-taupe" />
                          <h3 className="text-sm font-extrabold text-oak-coffee">
                            {meta.label} · {items.length}
                          </h3>
                        </div>
                      </header>

                      <div className="grid gap-3">
                        {loadingTasks ? (
                          Array.from({ length: 3 }).map((_, index) => (
                            <div key={`${statusKey}-${index}`} className="rounded-xl border border-oak-border bg-oak-panel/70 p-4">
                              <div className="mb-3 h-28 animate-pulse rounded-lg bg-oak-panel" />
                              <div className="mb-2 h-3 w-20 animate-pulse rounded bg-oak-panel" />
                              <div className="mb-2 h-5 w-2/3 animate-pulse rounded bg-oak-panel" />
                              <div className="h-4 w-full animate-pulse rounded bg-oak-panel" />
                            </div>
                          ))
                        ) : items.length > 0 ? (
                          items.map((task) => (
                            <button
                              key={task.id}
                              className="tasks-task-card w-full text-left"
                              draggable
                              type="button"
                              onDragStart={(event) => event.dataTransfer.setData("text/plain", String(task.id))}
                              onClick={() => void openTask(task.id)}
                            >
                              <div className="tasks-task-cover">
                                {coverUrls[task.id] ? (
                                  <img alt={`${task.name} cover`} className="h-full w-full object-cover" src={coverUrls[task.id]} />
                                ) : (
                                  <div className="grid h-full place-items-center text-xs font-semibold text-black/45">No cover photo</div>
                                )}
                              </div>
                              <p className="mt-4 text-xs font-semibold uppercase tracking-normal text-oak-taupe">{task.code}</p>
                              <h4 className="mt-2 text-base font-extrabold text-oak-coffee">{task.name}</h4>
                              <p className="tasks-task-excerpt mt-2 text-sm text-black/65">{truncateDescription(task.description)}</p>
                              <div className="mt-4 grid gap-1 text-xs font-semibold text-black/50">
                                <span>Date created {formatDisplayDate(task.created_at)}</span>
                                <span>Last modified {formatDisplayDate(task.updated_at)}</span>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="tasks-empty-state">
                            <p className="text-sm font-bold text-oak-coffee">No tasks here</p>
                            <p className="tasks-muted text-sm">
                              {statusKey === "todo"
                                ? "Create a task to begin."
                                : statusKey === "in_progress"
                                  ? "Move a task here when work begins."
                                  : "Move a task here once it has been completed."}
                            </p>
                            {isAdmin ? (
                              <button className="tasks-button-secondary" type="button" onClick={() => setIsCreateOpen(true)}>
                                Create task
                              </button>
                            ) : (
                              <button className="tasks-button-secondary" type="button" onClick={() => void refreshTasks()}>
                                Refresh board
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {isCreateOpen ? (
          <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4">
            <article className="tasks-modal-shell w-full max-w-3xl">
              <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
                <div>
                  <p className="oak-label">Tasks</p>
                  <h2 className="text-xl font-extrabold text-oak-coffee">Create task</h2>
                </div>
                <button className="tasks-icon-button" type="button" onClick={() => setIsCreateOpen(false)}>
                  <X size={16} />
                </button>
              </header>

              <form className="grid gap-4 p-6" onSubmit={handleCreateTask}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 sm:col-span-2">
                    <span className="oak-label">Name</span>
                    <input
                      className="tasks-input"
                      maxLength={80}
                      placeholder="Task name"
                      value={createTaskForm.name}
                      onChange={(event) => setCreateTaskForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </label>

                  <label className="grid gap-2 sm:col-span-2">
                    <span className="oak-label">Description</span>
                    <textarea
                      className="tasks-input min-h-28 resize-none py-3"
                      maxLength={1000}
                      placeholder="Add a helpful description"
                      value={createTaskForm.description}
                      onChange={(event) => setCreateTaskForm((current) => ({ ...current, description: event.target.value }))}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="oak-label">Initial column</span>
                    <select
                      className="tasks-input"
                      value={createTaskForm.initialStatus}
                      onChange={(event) => setCreateTaskForm((current) => ({ ...current, initialStatus: event.target.value as TaskStatus }))}
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </label>

                  <div className="grid gap-2">
                    <span className="oak-label">Cover photo</span>
                    <label className="tasks-upload">
                      <Upload size={16} />
                      <span>{createTaskForm.coverPhoto?.name ?? "Choose JPG, PNG or WebP"}</span>
                      <input
                        className="hidden"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          if (createTaskPreviewUrl) URL.revokeObjectURL(createTaskPreviewUrl);
                          setCreateTaskForm((current) => ({ ...current, coverPhoto: file }));
                          setCreateTaskPreviewUrl(file ? URL.createObjectURL(file) : null);
                        }}
                      />
                    </label>
                  </div>

                  {createTaskPreviewUrl ? (
                    <img alt="Cover preview" className="h-44 w-full rounded-xl border border-oak-border object-cover sm:col-span-2" src={createTaskPreviewUrl} />
                  ) : null}

                  <div className="grid gap-2 sm:col-span-2">
                    <span className="oak-label">Assigned employees</span>
                    <div className="grid gap-2 rounded-xl border border-oak-border p-3">
                      {employees.length > 0 ? (
                        employees.map((employee) => (
                          <label key={employee.id} className="flex items-center gap-3 text-sm font-semibold text-oak-coffee">
                            <input
                              checked={createTaskForm.assignedUserIds.includes(employee.id)}
                              type="checkbox"
                              onChange={(event) =>
                                setCreateTaskForm((current) => ({
                                  ...current,
                                  assignedUserIds: event.target.checked
                                    ? [...current.assignedUserIds, employee.id]
                                    : current.assignedUserIds.filter((id) => id !== employee.id)
                                }))
                              }
                            />
                            <span>{employee.name}</span>
                            <span className="text-black/45">{employee.job_title || "No job title"}</span>
                          </label>
                        ))
                      ) : (
                        <p className="text-sm font-semibold text-black/55">Create employees first to assign them to tasks.</p>
                      )}
                    </div>
                  </div>
                </div>

                {createTaskError ? <p className="text-sm font-bold text-oak-danger">{createTaskError}</p> : null}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button className="tasks-button-secondary" type="button" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </button>
                  <button className="tasks-button-primary" disabled={savingTask} type="submit">
                    {savingTask ? "Creating..." : "Create task"}
                  </button>
                </div>
              </form>
            </article>
          </div>
        ) : null}

        {loadingTaskDetail ? (
          <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4">
            <div className="tasks-modal-shell w-full max-w-5xl p-8">
              <div className="h-8 w-44 animate-pulse rounded bg-oak-panel" />
              <div className="mt-4 h-96 animate-pulse rounded-xl bg-oak-panel" />
            </div>
          </div>
        ) : null}

        {selectedTask ? (
          <div className="fixed inset-0 z-40 bg-black/40 p-0 md:p-4">
            <article className="tasks-modal-shell grid h-[100dvh] w-full md:h-auto md:max-h-[92dvh] md:grid-cols-[minmax(0,1.2fr)_360px] overflow-hidden">
              <section className="overflow-y-auto border-b border-oak-border md:border-b-0 md:border-r">
                <header className="flex items-start justify-between gap-4 border-b border-oak-border px-6 py-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-normal text-oak-taupe">{selectedTask.code}</p>
                    <h2 className="mt-2 text-2xl font-extrabold text-oak-coffee">Task details</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin ? (
                      <button className="tasks-icon-button" type="button" onClick={() => setDeleteTarget(selectedTask)}>
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                    <button className="tasks-icon-button" type="button" onClick={closeTask}>
                      <X size={16} />
                    </button>
                  </div>
                </header>

                <div className="grid gap-5 p-6">
                  <div className="tasks-cover-large">
                    {selectedTaskCoverUrl ? (
                      <img alt={`${selectedTask.name} cover`} className="h-full w-full object-cover" src={selectedTaskCoverUrl} />
                    ) : (
                      <div className="grid h-full place-items-center text-sm font-semibold text-black/45">No cover photo</div>
                    )}
                  </div>

                  <label className="grid gap-2">
                    <span className="oak-label">Name</span>
                    <input
                      className="tasks-input"
                      disabled={!isAdmin || savingInline}
                      maxLength={80}
                      value={selectedTask.name}
                      onChange={(event) => setSelectedTask((current) => (current ? { ...current, name: event.target.value } : current))}
                      onBlur={(event) => {
                        if (!isAdmin) return;
                        const value = event.target.value.trim();
                        if (value) void handleInlineTaskSave({ name: value });
                      }}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="oak-label">Description</span>
                    <textarea
                      className="tasks-input min-h-32 resize-none py-3"
                      disabled={!isAdmin || savingInline}
                      maxLength={1000}
                      value={selectedTask.description ?? ""}
                      onChange={(event) => setSelectedTask((current) => (current ? { ...current, description: event.target.value } : current))}
                      onBlur={(event) => {
                        if (!isAdmin) return;
                        void handleInlineTaskSave({ description: event.target.value.trim() || null });
                      }}
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="oak-label">Status</span>
                      <select
                        className="tasks-input"
                        disabled={savingInline}
                        value={selectedTask.status}
                        onChange={(event) => {
                          const value = event.target.value as TaskStatus;
                          setSelectedTask((current) => (current ? { ...current, status: value } : current));
                          void handleInlineTaskSave({ status: value });
                        }}
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </label>

                    <div className="grid gap-2">
                      <span className="oak-label">Dates</span>
                      <div className="tasks-inline-meta">
                        <span>Date created {formatDisplayDate(selectedTask.created_at)}</span>
                        <span>Last modified {formatDisplayDate(selectedTask.updated_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <span className="oak-label">Assigned employees</span>
                    <div className="grid gap-2 rounded-xl border border-oak-border p-3">
                      {employees.length > 0 ? (
                        employees.map((employee) => {
                          const checked = selectedTask.assignees.some((assignee) => assignee.id === employee.id);
                          return (
                            <label key={employee.id} className="flex items-center gap-3 text-sm font-semibold text-oak-coffee">
                              <input
                                checked={checked}
                                disabled={!isAdmin || savingInline}
                                type="checkbox"
                                onChange={(event) => {
                                  const currentIds = selectedTask.assignees.map((assignee) => assignee.id);
                                  const nextIds = event.target.checked
                                    ? [...currentIds, employee.id]
                                    : currentIds.filter((id) => id !== employee.id);
                                  setSelectedTask((current) =>
                                    current
                                      ? {
                                          ...current,
                                          assignees: employees
                                            .filter((item) => nextIds.includes(item.id))
                                            .map((item) => ({
                                              id: item.id,
                                              name: item.name,
                                              email: item.email,
                                              job_title: item.job_title,
                                              is_active: item.is_active
                                            }))
                                        }
                                      : current
                                  );
                                  if (isAdmin) void handleInlineTaskSave({ assigned_user_ids: nextIds });
                                }}
                              />
                              <span>{employee.name}</span>
                              <span className="text-black/45">{employee.job_title || "No job title"}</span>
                            </label>
                          );
                        })
                      ) : (
                        <p className="text-sm font-semibold text-black/55">No employees available yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="oak-label">Media</span>
                        <p className="tasks-muted text-sm">Images, PDFs and videos. Maximum 10 files per task.</p>
                      </div>
                      {isAdmin ? (
                        <label className="tasks-upload">
                          <Paperclip size={16} />
                          <span>{uploadingMedia ? "Uploading..." : "Upload file"}</span>
                          <input
                            className="hidden"
                            type="file"
                            accept="image/*,application/pdf,video/*"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              void handleMediaUpload(file);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                      ) : null}
                    </div>

                    <div className="grid gap-3">
                      {selectedTask.media.length > 0 ? (
                        selectedTask.media.map((media) => (
                          <button
                            key={media.id}
                            className="tasks-media-item text-left"
                            type="button"
                            onClick={() => void openMedia(selectedTask.id, media)}
                          >
                            <div>
                              <p className="text-sm font-bold text-oak-coffee">{media.file_name}</p>
                              <p className="tasks-muted text-xs">
                                Added by {media.uploaded_by.name} on {formatDisplayDate(media.created_at)}
                              </p>
                            </div>
                            <span className="text-xs font-bold uppercase tracking-normal text-oak-taupe">Open</span>
                          </button>
                        ))
                      ) : (
                        <div className="tasks-empty-inline">
                          <p className="text-sm font-bold text-oak-coffee">No media attached yet</p>
                          <p className="tasks-muted text-sm">{isAdmin ? "Upload supporting files for this task." : "No files have been added yet."}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <aside className="flex min-h-0 flex-col overflow-hidden bg-oak-surface/50">
                <header className="border-b border-oak-border px-6 py-5">
                  <div className="flex items-center gap-3">
                    <MessageSquareText size={18} className="text-oak-taupe" />
                    <div>
                      <h3 className="text-lg font-extrabold text-oak-coffee">Task chat</h3>
                      <p className="tasks-muted text-sm">
                        {canChatInTask ? "Discuss progress directly inside the task." : "Only assigned employees and administrators can send messages."}
                      </p>
                    </div>
                  </div>
                </header>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                  <div className="grid gap-3">
                    {selectedTask.messages.length > 0 ? (
                      selectedTask.messages.map((message) => (
                        <article key={message.id} className="tasks-chat-bubble">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-sm font-bold text-oak-coffee">{message.sender.name}</p>
                            <span className="tasks-muted text-xs">{formatDisplayDateTime(message.created_at)}</span>
                          </div>
                          <p className="text-sm leading-6 text-black/70">{message.content}</p>
                        </article>
                      ))
                    ) : (
                      <div className="tasks-empty-inline">
                        <p className="text-sm font-bold text-oak-coffee">No messages yet</p>
                        <p className="tasks-muted text-sm">Start the conversation when the task needs context or updates.</p>
                      </div>
                    )}
                  </div>
                </div>

                <form className="grid gap-3 border-t border-oak-border px-6 py-5" onSubmit={handleSendMessage}>
                  <textarea
                    className="tasks-input min-h-28 resize-none py-3"
                    disabled={!canChatInTask || sendingMessage}
                    placeholder={canChatInTask ? "Write a message" : "Messaging is not available for you on this task"}
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                  />
                  <button className="tasks-button-primary w-full" disabled={!canChatInTask || sendingMessage || !messageDraft.trim()} type="submit">
                    {sendingMessage ? "Sending..." : "Send message"}
                  </button>
                </form>
              </aside>
            </article>
          </div>
        ) : null}

        {deleteTarget ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
            <article className="tasks-modal-shell w-full max-w-md p-6">
              <p className="oak-label">Delete task</p>
              <h2 className="mt-2 text-xl font-extrabold text-oak-coffee">Delete {deleteTarget.name}?</h2>
              <p className="tasks-muted mt-3 text-sm">This action cannot be undone and the task code will not be reused.</p>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button className="tasks-button-secondary" type="button" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </button>
                <button className="tasks-button-danger" disabled={deletingTask} type="button" onClick={() => void confirmDeleteTask()}>
                  {deletingTask ? "Deleting..." : "Delete task"}
                </button>
              </div>
            </article>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
