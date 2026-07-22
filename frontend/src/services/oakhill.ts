import { api } from "./api";

export type ApiList<T> = { data: T[]; count: number };

export type Building = { id: string; nome: string; condominio_id: string };
export type ContractorBuilding = { id: string; name: string };
export type Funcionario = {
  id: string;
  status: boolean;
  is_default: boolean;
  nome: string;
  mobile: string | null;
  cargo: number;
  email: string | null;
  condominio_id: string;
};
export type Acess = {
  id: string;
  status: boolean;
  data: string;
  operacao: 0 | 1;
  building_id: string;
  funcionario_id: string;
  checkout_checklist_items: CleanerCheckoutChecklistItem[];
};
export type CleanerOpenAccess = {
  name: string;
  mobile: string;
  in_at: string;
  building_id: string;
  building_name: string;
};
export type ContractorVisit = {
  id: string;
  name: string;
  company: string;
  flat: string;
  building_name: string;
  job_description: string;
  mobile: string;
  extra_media_name: string | null;
  extra_media_data: string | null;
  extra_media_2_name: string | null;
  extra_media_2_data: string | null;
  extra_media_3_name: string | null;
  extra_media_3_data: string | null;
  extra_media_4_name: string | null;
  extra_media_4_data: string | null;
  in_at: string;
  out_at: string | null;
  condominio_id: string;
};
export type ContractorPublicVisit = ContractorVisit & { door_code?: string | null };
export type MaintenanceCategory = { id: string; name: string; created_at: string; condominio_id: string };
export type MaintenanceSchedule = {
  id: string;
  category_id: string;
  category_name: string;
  tag: string;
  report: string;
  frequency_days: number;
  notes: string;
  cellphone: string | null;
  latest_in_at: string | null;
  latest_out_at: string | null;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
  condominio_id: string;
};
export type MaintenanceRecord = {
  id: string;
  maintenance_id: string;
  category_name: string;
  tag: string;
  report: string;
  contractor_visit_id: string;
  contractor_name: string;
  contractor_mobile: string;
  in_at: string;
  out_at: string | null;
  condominio_id: string;
};
export type UtilityReading = {
  id: string;
  flat: string;
  building_name: string;
  reading_date: string;
  days: number | null;
  energy: number;
  energy_used: number | null;
  energy_change_percent: number | null;
  gas: number;
  gas_used: number | null;
  gas_change_percent: number | null;
};
export type ContractorHistoryCategory = { id: string; name: string; created_at: string; updated_at: string; condominio_id: string };
export type ContractorHistory = {
  id: string;
  category_id: string;
  category_name: string;
  contractor_visit_id: string;
  created_new_visit: boolean;
  next_enabled: boolean;
  next_interval_unit: "week" | "month" | null;
  next_interval_value: number | null;
  next_job_at: string | null;
  next_notify_at: string | null;
  next_notification_sent_at: string | null;
  name: string;
  company: string;
  flat: string;
  building_name: string;
  job_description: string;
  mobile: string;
  visit_in_at: string;
  visit_out_at: string | null;
  history_created_at: string;
  history_updated_at: string;
  condominio_id: string;
};
export type FlatChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
  position: number;
  building_id: string;
  condominio_id: string;
  created_at: string;
  updated_at: string;
};
export type CleanerCheckoutChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
  position: number;
  access_id: string;
  checklist_item_id: string | null;
  building_id: string;
  condominio_id: string;
  created_at: string;
};

export const oakhillService = {
  async buildings() {
    const { data } = await api.get<ApiList<Building>>("/buildings/condominio");
    return data;
  },
  async activeAccess(buildingId?: string) {
    const { data } = await api.get<{ has_open_session: boolean; building_id: string | null }>("/acess/active", {
      params: { building_id: buildingId }
    });
    return data;
  },
  async createAccess(payload: { operacao: 0 | 1; building_id: string; data?: string; status?: boolean }) {
    const { data } = await api.post<Acess>("/acess/", { status: true, ...payload });
    return data;
  },
  async listAccess(limit = 1000) {
    const { data } = await api.get<ApiList<Acess>>("/acess/", { params: { skip: 0, limit } });
    return data;
  },
  async updateAccess(id: string, payload: Partial<Acess>) {
    const { data } = await api.patch<Acess>(`/acess/${id}`, payload);
    return data;
  },
  async timeOutAccess(id: string, payload: { data: string }) {
    const { data } = await api.post<Acess>(`/acess/${id}/time-out`, payload);
    return data;
  },
  async deleteAccess(id: string) {
    await api.delete(`/acess/${id}`);
  },
  async cleanerOpen() {
    const { data } = await api.get<ApiList<CleanerOpenAccess>>("/general-access/cleaner/open");
    return data;
  },
  async cleanerCheckIn(payload: { name: string; mobile: string; building_id: string }) {
    const { data } = await api.post<Acess>("/general-access/cleaner/check-in", payload);
    return data;
  },
  async cleanerChecklist(mobile: string) {
    const { data } = await api.get<ApiList<FlatChecklistItem> & { building_id: string; building_name: string }>("/general-access/cleaner/checklist", { params: { mobile } });
    return data;
  },
  async cleanerCheckOut(payload: { mobile: string; checked_item_ids?: string[] }) {
    const { data } = await api.post<Acess>("/general-access/cleaner/check-out", payload);
    return data;
  },
  async funcionarios() {
    const { data } = await api.get<ApiList<Funcionario>>("/funcionarios/", { params: { skip: 0, limit: 500 } });
    return data;
  },
  async createFuncionario(payload: Omit<Funcionario, "id">) {
    const { data } = await api.post<Funcionario>("/funcionarios/", payload);
    return data;
  },
  async updateFuncionario(id: string, payload: Partial<Funcionario>) {
    const { data } = await api.patch<Funcionario>(`/funcionarios/${id}`, payload);
    return data;
  },
  async contractorBuildings(condominioId?: string) {
    const { data } = await api.get<ApiList<ContractorBuilding>>("/contractor-access/buildings", { params: { condominio_id: condominioId || undefined } });
    return data;
  },
  async contractorOpen(condominioId?: string) {
    const { data } = await api.get<ApiList<ContractorVisit>>("/contractor-access/open", { params: { condominio_id: condominioId || undefined } });
    return data;
  },
  async contractorCheckIn(payload: { condominio_id?: string; name: string; company: string; building_id: string; job_description: string; mobile: string }) {
    const { data } = await api.post<ContractorPublicVisit>("/contractor-access/check-in", payload);
    return data;
  },
  async contractorCheckOut(payload: { condominio_id?: string; visit_id: string; out_at?: string }) {
    const { data } = await api.post<ContractorPublicVisit>("/contractor-access/check-out", payload);
    return data;
  },
  async contractorVisits(params: { search?: string; date_from?: string; date_to?: string } = {}) {
    const { data } = await api.get<ApiList<ContractorVisit>>("/contractor-access/", { params: { skip: 0, limit: 200, ...params } });
    return data;
  },
  async updateContractorVisit(id: string, payload: Partial<Pick<ContractorVisit, "name" | "company" | "job_description" | "mobile" | "in_at" | "out_at">> & { building_id?: string }) {
    const { data } = await api.patch<ContractorVisit>(`/contractor-access/${id}`, payload);
    return data;
  },
  async maintenanceCategories() {
    const { data } = await api.get<ApiList<MaintenanceCategory>>("/contractor-access/maintenance/categories");
    return data;
  },
  async createMaintenanceCategory(name: string) {
    const { data } = await api.post<MaintenanceCategory>("/contractor-access/maintenance/categories", { name });
    return data;
  },
  async maintenanceSchedules() {
    const { data } = await api.get<ApiList<MaintenanceSchedule>>("/contractor-access/maintenance");
    return data;
  },
  async createMaintenanceSchedule(payload: { category_id: string; tag: string; report: string; frequency_days: number; notes: string; cellphone?: string }) {
    const { data } = await api.post<MaintenanceSchedule>("/contractor-access/maintenance", payload);
    return data;
  },
  async maintenanceHistory() {
    const { data } = await api.get<ApiList<MaintenanceRecord>>("/contractor-access/maintenance/history");
    return data;
  },
  async readings(flat = "50") {
    const { data } = await api.get<ApiList<UtilityReading>>("/readings", { params: { flat } });
    return data;
  },
  async saveReadings(payload: { reading_date: string; readings: Array<{ flat: "50" | "51" | "52"; energy: number; gas: number }> }) {
    const { data } = await api.post<ApiList<UtilityReading>>("/readings", payload);
    return data;
  },
  async flatChecklist(flat: string) {
    const { data } = await api.get<ApiList<FlatChecklistItem> & { flat: string; building_id: string }>(`/flat-checklists/${flat}`);
    return data;
  },
  async saveFlatChecklist(flat: string, items: Array<{ id?: string; label: string; checked: boolean; position: number }>) {
    const { data } = await api.put<ApiList<FlatChecklistItem> & { flat: string; building_id: string }>(`/flat-checklists/${flat}`, { items });
    return data;
  },
  async updateContractorMedia(id: string, payload: Record<string, string | null>) {
    const { data } = await api.patch<ContractorVisit>(`/contractor-access/${id}/media`, payload);
    return data;
  },
  async historyCategories() {
    const { data } = await api.get<ApiList<ContractorHistoryCategory>>("/contractor-access/history/categories");
    return data;
  },
  async createHistoryCategory(name: string) {
    const { data } = await api.post<ContractorHistoryCategory>("/contractor-access/history/categories", { name });
    return data;
  },
  async histories(params: Record<string, string | undefined> = {}) {
    const { data } = await api.get<ApiList<ContractorHistory>>("/contractor-access/history", { params: { skip: 0, limit: 100, ...params } });
    return data;
  },
  async createHistory(payload: Record<string, unknown>) {
    const { data } = await api.post<ContractorHistory>("/contractor-access/history", payload);
    return data;
  },
  async updateHistory(id: string, payload: Record<string, unknown>) {
    const { data } = await api.patch<ContractorHistory>(`/contractor-access/history/${id}`, payload);
    return data;
  },
  async deleteHistory(id: string) {
    await api.delete(`/contractor-access/history/${id}`);
  }
};
