import { api } from "./api";

export type TaskStatus = "todo" | "in_progress" | "done";

export type TaskAssignee = {
  id: number;
  name: string;
  email: string;
  job_title: string | null;
  is_active: boolean;
};

export type TaskCard = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  has_cover_photo: boolean;
  assignees: TaskAssignee[];
};

export type TaskMessage = {
  id: number;
  sender: TaskAssignee;
  content: string;
  created_at: string;
};

export type TaskMedia = {
  id: number;
  file_name: string;
  file_mime: string;
  created_at: string;
  uploaded_by: TaskAssignee;
};

export type TaskDetail = TaskCard & {
  media: TaskMedia[];
  messages: TaskMessage[];
};

export type TaskModuleSettings = {
  is_active: boolean;
};

export type EmployeeRecord = {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  role: string;
  job_title: string | null;
  profile_photo_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskFilters = {
  search?: string;
  status?: "all" | TaskStatus;
  created_from?: string;
  created_to?: string;
  modified_from?: string;
  modified_to?: string;
  sort?: "created_desc" | "created_asc" | "name_asc" | "name_desc";
};

export const tasksService = {
  async getModuleSettings() {
    const { data } = await api.get<TaskModuleSettings>("/tasks/module");
    return data;
  },

  async updateModuleSettings(isActive: boolean) {
    const { data } = await api.patch<TaskModuleSettings>("/tasks/module", { is_active: isActive });
    return data;
  },

  async listTasks(filters: TaskFilters) {
    const params: Record<string, string> = {};
    if (filters.search) params.search = filters.search;
    if (filters.status && filters.status !== "all") params.status = filters.status;
    if (filters.created_from) params.created_from = `${filters.created_from}T00:00:00`;
    if (filters.created_to) params.created_to = `${filters.created_to}T23:59:59`;
    if (filters.modified_from) params.modified_from = `${filters.modified_from}T00:00:00`;
    if (filters.modified_to) params.modified_to = `${filters.modified_to}T23:59:59`;
    if (filters.sort) params.sort = filters.sort;

    const { data } = await api.get<{ items: TaskCard[] }>("/tasks", { params });
    return data.items;
  },

  async getTask(taskId: number) {
    const { data } = await api.get<TaskDetail>(`/tasks/${taskId}`);
    return data;
  },

  async createTask(payload: {
    name: string;
    description?: string;
    initialStatus: TaskStatus;
    assignedUserIds: number[];
    coverPhoto?: File | null;
  }) {
    const formData = new FormData();
    formData.append("name", payload.name);
    formData.append("description", payload.description ?? "");
    formData.append("initial_status", payload.initialStatus);
    formData.append("assigned_user_ids", JSON.stringify(payload.assignedUserIds));
    if (payload.coverPhoto) {
      formData.append("cover_photo", payload.coverPhoto);
    }
    const { data } = await api.post<TaskDetail>("/tasks", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data;
  },

  async updateTask(taskId: number, payload: { name?: string; description?: string | null; status?: TaskStatus; assigned_user_ids?: number[] }) {
    const { data } = await api.patch<TaskDetail>(`/tasks/${taskId}`, payload);
    return data;
  },

  async deleteTask(taskId: number) {
    await api.delete(`/tasks/${taskId}`);
  },

  async addMessage(taskId: number, content: string) {
    const { data } = await api.post<TaskMessage>(`/tasks/${taskId}/messages`, { content });
    return data;
  },

  async addMedia(taskId: number, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post<TaskMedia>(`/tasks/${taskId}/media`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data;
  },

  async getCoverPhoto(taskId: number) {
    const { data } = await api.get<Blob>(`/tasks/${taskId}/cover`, { responseType: "blob" });
    return data;
  },

  async getMedia(taskId: number, mediaId: number) {
    const { data, headers } = await api.get<Blob>(`/tasks/${taskId}/media/${mediaId}`, { responseType: "blob" });
    return {
      blob: data,
      contentType: headers["content-type"] as string | undefined
    };
  },

  async listEmployees() {
    const { data } = await api.get<EmployeeRecord[]>("/users/employees");
    return data;
  },

  async createEmployee(payload: {
    fullName: string;
    email: string;
    password: string;
    jobTitle?: string;
    profilePhoto?: File | null;
  }) {
    const formData = new FormData();
    formData.append("full_name", payload.fullName);
    formData.append("email", payload.email);
    formData.append("password", payload.password);
    formData.append("job_title", payload.jobTitle ?? "");
    if (payload.profilePhoto) {
      formData.append("profile_photo", payload.profilePhoto);
    }
    const { data } = await api.post<EmployeeRecord>("/users/employees", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data;
  },

  async updateEmployee(
    employeeId: number,
    payload: {
      fullName?: string;
      email?: string;
      password?: string;
      jobTitle?: string;
      isActive?: boolean;
      profilePhoto?: File | null;
    }
  ) {
    const formData = new FormData();
    if (payload.fullName !== undefined) formData.append("full_name", payload.fullName);
    if (payload.email !== undefined) formData.append("email", payload.email);
    if (payload.password) formData.append("password", payload.password);
    if (payload.jobTitle !== undefined) formData.append("job_title", payload.jobTitle);
    if (payload.isActive !== undefined) formData.append("is_active", String(payload.isActive));
    if (payload.profilePhoto) formData.append("profile_photo", payload.profilePhoto);
    const { data } = await api.patch<EmployeeRecord>(`/users/employees/${employeeId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data;
  }
};
