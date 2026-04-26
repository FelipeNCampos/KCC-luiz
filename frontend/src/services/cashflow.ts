import { api } from "./api";

export type CashFlowType = "income" | "outcome";

export type CashFlowRow = {
  id: number;
  payment_number: number;
  has_invoice: boolean;
  invoice_media_name: string | null;
  record_date: string;
  amount: string;
  description: string;
  flat: string;
  balance: string;
  created_by_user_id: number;
  created_at: string;
};

export type CashFlowListResponse = {
  month: string;
  monthly_total: string;
  items: CashFlowRow[];
};

export type CreateCashFlowPayload = {
  type: CashFlowType;
  invoice: "Yes" | "No";
  date: string;
  value: string;
  description: string;
  flat: string;
  invoiceMedia?: File | null;
};

export type CashFlowReportPayload = {
  email: string;
  month: string;
  search?: string;
};

export const cashFlowService = {
  async list(params: { month: string; search?: string }) {
    const { data } = await api.get<CashFlowListResponse>("/cashflow", {
      params: {
        month: params.month,
        search: params.search || undefined
      }
    });
    return data;
  },

  async create(payload: CreateCashFlowPayload) {
    const formData = new FormData();
    formData.append("type", payload.type);
    formData.append("invoice", payload.invoice);
    formData.append("date", payload.date);
    formData.append("value", payload.value);
    formData.append("description", payload.description);
    formData.append("flat", payload.flat);

    if (payload.invoiceMedia) {
      formData.append("invoice_media", payload.invoiceMedia);
    }

    const { data } = await api.post<CashFlowRow>("/cashflow", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data;
  },

  async remove(recordId: number) {
    await api.delete(`/cashflow/${recordId}`);
  },

  async sendReport(payload: CashFlowReportPayload) {
    const { data } = await api.post<{ message: string }>("/cashflow/report", payload);
    return data;
  },

  async getInvoiceMedia(recordId: number) {
    const { data, headers } = await api.get<Blob>(`/cashflow/${recordId}/invoice`, {
      responseType: "blob"
    });

    return {
      blob: data,
      contentType: headers["content-type"] as string | undefined
    };
  }
};
