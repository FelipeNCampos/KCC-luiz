import { api } from "./api";

export type StockRequestStatus = "pending" | "completed" | "archived";

export type StockRequest = {
  id: string;
  product_name: string;
  quantity: number;
  photo_name: string | null;
  photo_data: string | null;
  status: StockRequestStatus;
  created_at: string;
  updated_at: string;
  condominio_id: string;
};

export type StockRequestList = { data: StockRequest[]; count: number };

export const stockService = {
  async create(payload: { product_name: string; quantity: number; photo_name?: string | null; photo_data?: string | null }) {
    const { data } = await api.post<StockRequest>("/stock-requests", payload);
    return data;
  },
  async list(params: { search?: string; status?: StockRequestStatus | ""; date_from?: string; date_to?: string; limit?: number } = {}) {
    const { data } = await api.get<StockRequestList>("/stock-requests", {
      params: { skip: 0, limit: params.limit ?? 200, ...params, status: params.status || undefined }
    });
    return data;
  },
  async complete(id: string) {
    const { data } = await api.patch<StockRequest>(`/stock-requests/${id}/status`, { status: "completed" });
    return data;
  },
  async archive(id: string) {
    const { data } = await api.delete<StockRequest>(`/stock-requests/${id}`);
    return data;
  }
};
