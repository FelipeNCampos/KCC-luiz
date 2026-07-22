import { api } from "./api";

export type CashFlowScope = "main" | "cashflow52";

export type CashFlowRow = {
  id: number;
  payment_number: number;
  has_invoice: boolean;
  invoice_number: string | null;
  invoice_media_name: string | null;
  record_date: string;
  amount: string;
  description: string | null;
  supplier: string | null;
  flat: string | null;
  balance: string;
  created_by_user_id: number;
  created_at: string;
};

export type CashFlowListResponse = {
  month: string;
  monthly_total: string;
  current_balance: string;
  items: CashFlowRow[];
};

type CashFlowNextPaymentNumberResponse = {
  next_payment_number: number;
};

export type CreateCashFlowPayload = {
  scope?: CashFlowScope;
  invoice: "Yes" | "No";
  invoiceNumber?: string;
  date: string;
  value: string;
  description?: string;
  supplier?: string;
  flat?: string;
  invoiceMedia?: File | null;
};

export type UpdateCashFlowPayload = {
  scope?: CashFlowScope;
  value?: string | null;
  description?: string | null;
  supplier?: string | null;
  flat?: string | null;
};

export type CashFlowReportPayload = {
  email: string;
  scope?: CashFlowScope;
  start_month: string;
  end_month: string;
  search?: string;
  include_invoice_table: boolean;
};

export type CashFlowShareLink = {
  id: string;
  scope: CashFlowScope;
  date_from: string;
  date_to: string;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
  status: "active" | "expired" | "revoked";
  token: string;
  share_url: string;
};

export type CashFlowPublicRow = {
  record_date: string;
  amount: string;
  description: string | null;
  supplier: string | null;
  flat: string | null;
  has_invoice: boolean;
  invoice_number: string | null;
  invoice_media_name: string | null;
  invoice_media_mime: string | null;
  invoice_media_url: string | null;
};

export type CashFlowPublicShare = {
  date_from: string;
  date_to: string;
  credit_total: string;
  debit_total: string;
  net_total: string;
  items: CashFlowPublicRow[];
};

export const cashFlowService = {
  async list(params: { month: string; search?: string; scope?: CashFlowScope }) {
    const { data } = await api.get<CashFlowListResponse>("/cashflow", {
      params: {
        month: params.month,
        search: params.search || undefined,
        scope: params.scope || undefined
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
    if (payload.scope) {
      formData.append("scope", payload.scope);
    }

    formData.append("invoice", payload.invoice);
    if (payload.invoiceNumber && payload.invoiceNumber.trim()) {
      formData.append("invoice_number", payload.invoiceNumber);
    }
    formData.append("date", payload.date);
    formData.append("value", payload.value);

    if (payload.description && payload.description.trim()) {
      formData.append("description", payload.description);
    }

    if (payload.supplier && payload.supplier.trim()) {
      formData.append("supplier", payload.supplier);
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

  async updateInvoiceMedia(recordId: number, payload: { invoiceMedia?: File | null; invoiceNumber?: string | null }) {
    const formData = new FormData();
    if (payload.invoiceMedia) {
      formData.append("invoice_media", payload.invoiceMedia);
    }
    if (payload.invoiceNumber !== undefined) {
      formData.append("invoice_number", payload.invoiceNumber ?? "");
    }

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
  },

  async createShareLink(payload: { scope: CashFlowScope; date_from: string; date_to: string; expires_at: string }) {
    const { data } = await api.post<CashFlowShareLink>("/cashflow/share-links", payload);
    return data;
  },

  async listShareLinks(scope: CashFlowScope) {
    const { data } = await api.get<{ items: CashFlowShareLink[] }>("/cashflow/share-links", {
      params: { scope }
    });
    return data.items;
  },

  async revokeShareLink(linkId: string) {
    const { data } = await api.delete<CashFlowShareLink>(`/cashflow/share-links/${linkId}`);
    return data;
  },

  async getPublicShare(token: string) {
    const { data } = await api.get<CashFlowPublicShare>(`/cashflow/shared/${token}`);
    return data;
  },

  publicUrl(path: string) {
    const baseUrl = api.defaults.baseURL ?? "/api/v1";
    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
    const normalizedPath = `/${path.replace(/^\//, "")}`;

    if (normalizedPath === normalizedBaseUrl || normalizedPath.startsWith(`${normalizedBaseUrl}/`)) {
      return normalizedPath;
    }

    return `${normalizedBaseUrl}${normalizedPath}`;
  }
};
