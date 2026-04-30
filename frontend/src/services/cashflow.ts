import { api } from "./api";

export type CashFlowRow = {
  id: number;
  payment_number: number;
  has_invoice: boolean;
  invoice_media_name: string | null;
  record_date: string;
  amount: string;
  description: string | null;
  flat: string | null;
  balance: string;
  created_by_user_id: number;
  created_at: string;
};

export type CashFlowListResponse = {
  month: string;
  monthly_total: string;
  items: CashFlowRow[];
};

type CashFlowNextPaymentNumberResponse = {
  next_payment_number: number;
};

export type CreateCashFlowPayload = {
  invoice: "Yes" | "No";
  date: string;
  value: string;
  description?: string;
  flat?: string;
  invoiceMedia?: File | null;
};

export type UpdateCashFlowPayload = {
  description?: string | null;
  flat?: string | null;
};

export type CashFlowReportPayload = {
  email: string;
  start_month: string;
  end_month: string;
  search?: string;
  include_invoice_table: boolean;
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

  async getNextPaymentNumber() {
    const { data } = await api.get<CashFlowNextPaymentNumberResponse>("/cashflow/next-payment-number");
    return data.next_payment_number;
  },

  async create(payload: CreateCashFlowPayload) {
    const formData = new FormData();
    formData.append("invoice", payload.invoice);
    formData.append("date", payload.date);
    formData.append("value", payload.value);

    if (payload.description && payload.description.trim()) {
      formData.append("description", payload.description);
    }

    if (payload.flat && payload.flat.trim()) {
      formData.append("flat", payload.flat);
    }

    if (payload.invoice === "Yes" && payload.invoiceMedia) {
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

  async update(recordId: number, payload: UpdateCashFlowPayload) {
    const { data } = await api.patch<CashFlowRow>(`/cashflow/${recordId}`, payload);
    return data;
  },

  async updateInvoiceMedia(recordId: number, invoiceMedia: File) {
    const formData = new FormData();
    formData.append("invoice_media", invoiceMedia);

    const { data } = await api.patch<CashFlowRow>(`/cashflow/${recordId}/invoice`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data;
  },

  async sendReport(payload: CashFlowReportPayload) {
    const { data } = await api.post<{ message: string }>("/cashflow/report", payload);
    return data;
  },

  async previewReport(payload: Omit<CashFlowReportPayload, "email">) {
    const { data } = await api.post<Blob>("/cashflow/report/preview", payload, {
      responseType: "blob"
    });
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
