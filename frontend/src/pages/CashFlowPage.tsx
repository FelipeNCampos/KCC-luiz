import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AxiosError } from "axios";
import { CircleDollarSign, FileSpreadsheet, Pencil, Plus, Search, Upload, X } from "lucide-react";

import { DashboardShell } from "../components/DashboardShell";
import { cashFlowService, CashFlowListResponse, CashFlowRow, CashFlowScope } from "../services/cashflow";

type FormState = {
  invoice: "Yes" | "No";
  invoiceNumber: string;
  date: string;
  value: string;
  description: string;
  supplier: string;
  flat: string;
  invoiceMedia: File | null;
};

type PreviewState = {
  url: string;
  contentType: string;
  fileName: string;
};

type InvoiceEditorState = {
  record: CashFlowRow;
  invoiceNumber: string;
  preview: PreviewState | null;
  selectedFile: File | null;
  error: string | null;
};

type TextEditorState = {
  record: CashFlowRow;
  value: string;
  description: string;
  supplier: string;
  flat: string;
  error: string | null;
};

type ReportFormState = {
  email: string;
  startMonth: string;
  endMonth: string;
  includeInvoiceTable: boolean;
};

type CashFlowPageProps = {
  title?: string;
  scope?: CashFlowScope;
  showFlat?: boolean;
};

const FLAT_OPTIONS = ["Flat 50", "Flat 51", "Flat 52"] as const;

function toMonthInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}-${month}-${year}` : value;
}

function formatCurrency(value: string | number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(parsed);
}

function formatAbsoluteCurrency(value: string | number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return formatCurrency(Math.abs(parsed));
}

function normalizeFlatValue(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";

  const match = trimmed.match(/^flat\s*(\d+)$/i) || trimmed.match(/^(\d+)$/);
  if (!match) return trimmed;

  return `Flat ${match[1]}`;
}

const initialForm: FormState = {
  invoice: "No",
  invoiceNumber: "",
  date: toDateInputValue(new Date()),
  value: "",
  description: "",
  supplier: "",
  flat: "",
  invoiceMedia: null
};

export function CashFlowPage({ title = "CashFlow", scope = "main", showFlat = true }: CashFlowPageProps = {}) {
  const monthInputRef = useRef<HTMLInputElement | null>(null);
  const createInvoiceFileInputRef = useRef<HTMLInputElement | null>(null);
  const [month, setMonth] = useState(toMonthInputValue(new Date()));
  const [search, setSearch] = useState("");
  const [data, setData] = useState<CashFlowListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState<ReportFormState>({
    email: "",
    startMonth: month,
    endMonth: month,
    includeInvoiceTable: false
  });
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportPreviewUrl, setReportPreviewUrl] = useState<string | null>(null);
  const [reportPreviewLoading, setReportPreviewLoading] = useState(false);
  const [reportPreviewError, setReportPreviewError] = useState<string | null>(null);
  const [sendingReport, setSendingReport] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [invoiceEditor, setInvoiceEditor] = useState<InvoiceEditorState | null>(null);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
  const [savingText, setSavingText] = useState(false);
  const [createInvoicePreview, setCreateInvoicePreview] = useState<PreviewState | null>(null);
  const tableColumnCount = showFlat ? 9 : 8;
  const tableMinWidthClass = showFlat ? "min-w-[1120px]" : "min-w-[980px]";
  const summaryLeadingColumnSpan = showFlat ? 6 : 5;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    cashFlowService
      .list({ month, search, scope })
      .then((response) => {
        if (!active) return;
        setData(response);
      })
      .catch((requestError: AxiosError<{ detail?: string }>) => {
        if (!active) return;
        setError(requestError.response?.data?.detail ?? "Unable to load monthly cash flow.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [month, scope, search]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsCreateOpen(false);
      setIsReportOpen(false);
      setTextEditor(null);
      closeInvoiceEditor();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      if (invoiceEditor?.preview) {
        URL.revokeObjectURL(invoiceEditor.preview.url);
      }
    };
  }, [invoiceEditor?.preview]);

  useEffect(() => {
    return () => {
      if (createInvoicePreview) {
        URL.revokeObjectURL(createInvoicePreview.url);
      }
    };
  }, [createInvoicePreview]);

  useEffect(() => {
    if (!isReportOpen || !reportForm.startMonth || !reportForm.endMonth || reportForm.startMonth > reportForm.endMonth) {
      setReportPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      return;
    }

    let active = true;
    setReportPreviewLoading(true);
    setReportPreviewError(null);

    cashFlowService
      .previewReport({
        start_month: reportForm.startMonth,
        end_month: reportForm.endMonth,
        scope,
        search: search.trim() || undefined,
        include_invoice_table: reportForm.includeInvoiceTable
      })
      .then((blob) => {
        if (!active) return;
        const url = URL.createObjectURL(blob);
        setReportPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return url;
        });
      })
      .catch((requestError: AxiosError<{ detail?: string }>) => {
        if (!active) return;
        setReportPreviewError(requestError.response?.data?.detail ?? "Unable to load report preview.");
      })
      .finally(() => {
        if (!active) return;
        setReportPreviewLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isReportOpen, reportForm.startMonth, reportForm.endMonth, reportForm.includeInvoiceTable, scope, search]);

  useEffect(() => {
    return () => {
      if (reportPreviewUrl) {
        URL.revokeObjectURL(reportPreviewUrl);
      }
    };
  }, [reportPreviewUrl]);

  const currentBalance = useMemo(() => formatAbsoluteCurrency(data?.current_balance ?? 0), [data?.current_balance]);
  const thisMonthValue = useMemo(() => {
    const current = Number(data?.current_balance ?? 0);
    const monthly = Number(data?.monthly_total ?? 0);
    return current - (current - monthly);
  }, [data?.current_balance, data?.monthly_total]);
  const thisMonth = useMemo(() => formatCurrency(thisMonthValue), [thisMonthValue]);
  const openingBalanceValue = useMemo(() => {
    const current = Number(data?.current_balance ?? 0);
    const monthly = Number(data?.monthly_total ?? 0);
    return current - monthly;
  }, [data?.current_balance, data?.monthly_total]);
  const openingBalance = useMemo(() => formatCurrency(openingBalanceValue), [openingBalanceValue]);

  async function reload() {
    const response = await cashFlowService.list({ month, search, scope });
    setData(response);
  }

  async function handleCreateRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFeedback(null);

    if (!form.date || !form.value) {
      setFormError("Please fill all required fields.");
      return;
    }

    if (Number(form.value) === 0) {
      setFormError("Value must be different from zero.");
      return;
    }

    setSaving(true);
    try {
      const invoice = form.invoiceMedia || form.invoiceNumber.trim() ? "Yes" : "No";
      await cashFlowService.create({
        scope,
        invoice,
        invoiceNumber: form.invoiceNumber.trim() || undefined,
        date: form.date,
        value: form.value,
        description: form.description,
        supplier: form.supplier,
        flat: showFlat ? form.flat : undefined,
        invoiceMedia: form.invoiceMedia
      });

      setForm(initialForm);
      clearCreateInvoicePreview();
      setIsCreateOpen(false);
      setFeedback({ type: "success", message: "Cash flow record created successfully." });
      await reload();
    } catch (requestError) {
      const axiosError = requestError as AxiosError<{ detail?: string }>;
      setFormError(axiosError.response?.data?.detail ?? "Unable to create record.");
      setFeedback({ type: "error", message: "Unable to create the record." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRecord(recordId: number) {
    if (!window.confirm("Delete this record?")) return;

    setFeedback(null);
    try {
      await cashFlowService.remove(recordId);
      setFeedback({ type: "success", message: "Record deleted successfully." });
      await reload();
    } catch (requestError) {
      const axiosError = requestError as AxiosError<{ detail?: string }>;
      setFeedback({ type: "error", message: axiosError.response?.data?.detail ?? "Unable to delete record." });
    }
  }

  async function handleOpenInvoiceEditor(row: CashFlowRow) {
    setFeedback(null);

    if (!row.has_invoice) {
      setInvoiceEditor({
        record: row,
        invoiceNumber: row.invoice_number ?? "",
        preview: null,
        selectedFile: null,
        error: null
      });
      return;
    }

    try {
      if (!row.invoice_media_name) {
        setInvoiceEditor({
          record: row,
          invoiceNumber: row.invoice_number ?? "",
          preview: null,
          selectedFile: null,
          error: null
        });
        return;
      }

      const media = await cashFlowService.getInvoiceMedia(row.id);
      const objectUrl = URL.createObjectURL(media.blob);
      if (invoiceEditor?.preview) {
        URL.revokeObjectURL(invoiceEditor.preview.url);
      }
      setInvoiceEditor({
        record: row,
        invoiceNumber: row.invoice_number ?? "",
        preview: {
          url: objectUrl,
          contentType: media.contentType ?? "application/octet-stream",
          fileName: row.invoice_media_name ?? "invoice"
        },
        selectedFile: null,
        error: null
      });
    } catch (requestError) {
      setInvoiceEditor({
        record: row,
        invoiceNumber: row.invoice_number ?? "",
        preview: null,
        selectedFile: null,
        error: null
      });
    }
  }

  async function handleSendReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReportError(null);
    setFeedback(null);

    if (!reportForm.email.trim()) {
      setReportError("Please enter an email address.");
      return;
    }

    if (!reportForm.startMonth || !reportForm.endMonth) {
      setReportError("Please select a report period.");
      return;
    }

    if (reportForm.startMonth > reportForm.endMonth) {
      setReportError("Start month must be before or equal to end month.");
      return;
    }

    setSendingReport(true);
    try {
      const response = await cashFlowService.sendReport({
        email: reportForm.email.trim(),
        scope,
        start_month: reportForm.startMonth,
        end_month: reportForm.endMonth,
        search: search.trim() || undefined,
        include_invoice_table: reportForm.includeInvoiceTable
      });
      closeReportModal();
      setReportForm({
        email: "",
        startMonth: month,
        endMonth: month,
        includeInvoiceTable: false
      });
      setFeedback({ type: "success", message: response.message });
    } catch (requestError) {
      const axiosError = requestError as AxiosError<{ detail?: string }>;
      const detail = axiosError.response?.data?.detail ?? "Unable to send report.";
      setReportError(detail);
      setFeedback({ type: "error", message: detail });
    } finally {
      setSendingReport(false);
    }
  }

  function closeInvoiceEditor() {
    if (invoiceEditor?.preview) {
      URL.revokeObjectURL(invoiceEditor.preview.url);
    }
    setInvoiceEditor(null);
  }

  function clearCreateInvoicePreview() {
    setCreateInvoicePreview((current) => {
      if (current) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
  }

  function clearCreateInvoiceMedia() {
    clearCreateInvoicePreview();
    setForm((prev) => ({ ...prev, invoice: "No", invoiceMedia: null }));
    if (createInvoiceFileInputRef.current) {
      createInvoiceFileInputRef.current.value = "";
    }
  }

  function closeCreateRecord() {
    clearCreateInvoiceMedia();
    setForm(initialForm);
    setFormError(null);
    setIsCreateOpen(false);
  }

  function handleCreateInvoiceFileSelect(file: File | null) {
    clearCreateInvoiceMedia();
    setForm((prev) => ({ ...prev, invoice: file ? "Yes" : "No", invoiceMedia: file }));
    setFormError(null);

    if (!file) return;

    setCreateInvoicePreview({
      url: URL.createObjectURL(file),
      contentType: file.type || "application/octet-stream",
      fileName: file.name
    });
  }

  function handleInvoiceFileSelect(file: File | null) {
    if (!invoiceEditor || !file) return;
    if (invoiceEditor.preview) {
      URL.revokeObjectURL(invoiceEditor.preview.url);
    }
    setInvoiceEditor({
      ...invoiceEditor,
      selectedFile: file,
      preview: {
        url: URL.createObjectURL(file),
        contentType: file.type || "application/octet-stream",
        fileName: file.name
      },
      error: null
    });
  }

  async function handleSaveInvoice() {
    if (!invoiceEditor?.selectedFile && !invoiceEditor?.invoiceNumber.trim()) {
      setInvoiceEditor((current) => (current ? { ...current, error: "Add an invoice number or select an image or PDF first." } : current));
      return;
    }

    setSavingInvoice(true);
    try {
      await cashFlowService.updateInvoiceMedia(invoiceEditor.record.id, {
        invoiceMedia: invoiceEditor.selectedFile,
        invoiceNumber: invoiceEditor.invoiceNumber.trim()
      });
      closeInvoiceEditor();
      setFeedback({ type: "success", message: "Invoice updated successfully." });
      await reload();
    } catch (requestError) {
      const axiosError = requestError as AxiosError<{ detail?: string }>;
      setInvoiceEditor((current) =>
        current ? { ...current, error: axiosError.response?.data?.detail ?? "Unable to update invoice media." } : current
      );
    } finally {
      setSavingInvoice(false);
    }
  }

  function openTextEditor(row: CashFlowRow) {
    setFeedback(null);
    setTextEditor({
      record: row,
      value: row.amount,
      description: row.description ?? "",
      supplier: row.supplier ?? "",
      flat: normalizeFlatValue(row.flat),
      error: null
    });
  }

  async function handleSaveText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!textEditor) return;

    const parsedValue = Number(textEditor.value);
    if (!textEditor.value.trim() || !Number.isFinite(parsedValue)) {
      setTextEditor((current) => (current ? { ...current, error: "Enter a valid value." } : current));
      return;
    }
    if (parsedValue === 0) {
      setTextEditor((current) => (current ? { ...current, error: "Value must be different from zero." } : current));
      return;
    }

    setSavingText(true);
    try {
      await cashFlowService.update(textEditor.record.id, {
        value: textEditor.value,
        description: textEditor.description.trim() || null,
        supplier: textEditor.supplier.trim() || null,
        flat: showFlat ? textEditor.flat.trim() || null : null
      });
      setTextEditor(null);
      setFeedback({ type: "success", message: "Record updated successfully." });
      await reload();
    } catch (requestError) {
      const axiosError = requestError as AxiosError<{ detail?: string }>;
      setTextEditor((current) => (current ? { ...current, error: axiosError.response?.data?.detail ?? "Unable to update record." } : current));
    } finally {
      setSavingText(false);
    }
  }

  function openMonthPicker() {
    const input = monthInputRef.current;
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === "function") {
      input.showPicker();
    }
  }

  function openReportModal() {
    setReportError(null);
    setReportForm((current) => ({
      ...current,
      startMonth: current.startMonth || month,
      endMonth: current.endMonth || month
    }));
    setIsReportOpen(true);
  }

  function closeReportModal() {
    setIsReportOpen(false);
    setReportPreviewError(null);
    setReportPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  return (
    <DashboardShell
      title={title}
      subtitle=""
      rightSlot={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
          <label className="grid gap-2" onClick={openMonthPicker}>
            <span className="oak-label">Month</span>
            <input
              ref={monthInputRef}
              className="oak-input cursor-pointer"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
          <label className="grid min-w-0 gap-2 sm:flex-1 sm:min-w-72">
            <span className="oak-label invisible">Search</span>
            <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-oak-taupe" />
            <input
              className="oak-input pl-9"
              placeholder={showFlat ? "Search by Description, Supplier or Flat" : "Search by Description or Supplier"}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            </span>
          </label>
        </div>
      }
    >
      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <article className="oak-card p-6">
          <div className="grid overflow-hidden rounded-xl border border-oak-border bg-oak-panel sm:grid-cols-2">
            <div className="p-4 text-center sm:border-r sm:border-oak-border">
              <p className="oak-label">Last Month</p>
              <p className={`mt-2 text-2xl font-extrabold ${openingBalanceValue >= 0 ? "text-oak-coffee" : "text-[#cf0e0e]"}`}>{openingBalance}</p>
            </div>
            <div className="p-4 text-center">
              <p className="oak-label">This Month</p>
              <p className={`mt-2 text-2xl font-extrabold ${thisMonthValue >= 0 ? "text-emerald-700" : "text-[#cf0e0e]"}`}>
                {thisMonth}
              </p>
            </div>
          </div>
        </article>

        <div className="grid gap-3 md:h-full">
          <button className="oak-button-primary min-h-12 w-full" type="button" onClick={() => setIsCreateOpen(true)}>
            <CircleDollarSign size={18} />
            New record
          </button>
          <button className="oak-button-secondary min-h-12 w-full md:flex-1" type="button" onClick={openReportModal}>
            <FileSpreadsheet size={18} />
            Report
          </button>
        </div>
      </section>

      {feedback ? (
        <section
          className={`rounded-xl border p-4 text-sm font-bold ${
            feedback.type === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-[#f3c3ad] bg-oak-dangerBg text-oak-danger"
          }`}
        >
          {feedback.message}
        </section>
      ) : null}

      <section className="oak-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full ${tableMinWidthClass} text-left`}>
            <thead className="bg-oak-panel text-[11px] uppercase text-oak-muted">
              <tr>
                <th className="px-4 py-3 font-extrabold">Payment Number</th>
                <th className="px-4 py-3 font-extrabold">Invoice</th>
                <th className="px-4 py-3 font-extrabold">Date</th>
                <th className="px-4 py-3 font-extrabold text-right">Amount</th>
                <th className="px-4 py-3 font-extrabold">Comments</th>
                <th className="px-4 py-3 font-extrabold">Supplier</th>
                {showFlat ? <th className="px-4 py-3 font-extrabold">Flat</th> : null}
                <th className="px-4 py-3 font-extrabold text-right">Balance</th>
                <th className="px-4 py-3 font-extrabold">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-oak-border">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-sm font-semibold text-black/60" colSpan={tableColumnCount}>
                    Loading cash flow records...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td className="px-4 py-6 text-sm font-bold text-oak-danger" colSpan={tableColumnCount}>
                    {error}
                  </td>
                </tr>
              ) : data ? (
                <>
                  {data.items.length > 0 ? (
                    data.items.map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer bg-white transition-colors hover:bg-oak-surface"
                        onClick={() => openTextEditor(row)}
                      >
                        <td className="px-4 py-3 text-sm font-bold text-oak-coffee">#{row.payment_number}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-oak-coffee">
                          {row.has_invoice ? (
                            <button
                              className="inline-flex items-center gap-1.5 rounded-lg border border-oak-border px-2.5 py-1.5 text-xs font-extrabold text-oak-coffee transition-colors hover:bg-oak-panel"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleOpenInvoiceEditor(row);
                              }}
                            >
                              <Pencil size={14} />
                              View / update
                            </button>
                          ) : (
                            <button
                              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-oak-borderStrong px-2.5 py-1.5 text-xs font-extrabold text-oak-coffee transition-colors hover:bg-oak-panel"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleOpenInvoiceEditor(row);
                              }}
                            >
                              <Plus size={14} />
                              Add
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-black/65">{formatDate(row.record_date)}</td>
                        <td
                          className={`px-4 py-3 text-right text-sm font-extrabold ${Number(row.amount) >= 0 ? "text-emerald-700" : "text-[#cf0e0e]"}`}
                        >
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-black/70">
                          <button
                            className="inline-flex max-w-72 items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-oak-panel"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openTextEditor(row);
                            }}
                          >
                            {row.description ? <Pencil className="shrink-0" size={14} /> : <Plus className="shrink-0" size={14} />}
                            <span className="truncate">{row.description ?? "Add"}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-black/70">
                          <button
                            className="inline-flex max-w-56 items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-oak-panel"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openTextEditor(row);
                            }}
                          >
                            {row.supplier ? <Pencil className="shrink-0" size={14} /> : <Plus className="shrink-0" size={14} />}
                            <span className="truncate">{row.supplier ?? "Add"}</span>
                          </button>
                        </td>
                        {showFlat ? (
                          <td className="px-4 py-3 text-sm font-semibold text-black/70">
                            <button
                              className="inline-flex max-w-40 items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-oak-panel"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openTextEditor(row);
                              }}
                            >
                              {row.flat ? <Pencil className="shrink-0" size={14} /> : <Plus className="shrink-0" size={14} />}
                              <span className="truncate">{row.flat ?? "Add"}</span>
                            </button>
                          </td>
                        ) : null}
                        <td
                          className={`px-4 py-3 text-right text-sm font-extrabold ${Number(row.balance) >= 0 ? "text-emerald-700" : "text-[#cf0e0e]"}`}
                        >
                          {formatAbsoluteCurrency(row.balance)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-black/70">
                          <button
                            className="oak-button-secondary !min-h-9 !px-3 !py-1.5"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteRecord(row.id);
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-8 text-sm font-semibold text-black/60" colSpan={tableColumnCount}>
                        No records for this month.
                      </td>
                    </tr>
                  )}
                  <tr className="bg-oak-panel/70">
                    <td className="px-4 py-3" colSpan={summaryLeadingColumnSpan} />
                    <td className="bg-oak-panel px-4 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-oak-coffee">
                      Total:
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-sm font-extrabold ${Number(data.current_balance) >= 0 ? "text-emerald-700" : "text-[#cf0e0e]"}`}
                    >
                      {currentBalance}
                    </td>
                    <td className="bg-oak-panel px-4 py-3" />
                  </tr>
                </>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4">
          <article className="w-full max-w-2xl rounded-2xl border border-oak-border bg-white shadow-oakLg">
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">{title}</p>
                <h2 className="text-xl font-extrabold text-oak-coffee">Add record</h2>
              </div>
              <button className="grid size-9 place-items-center rounded-lg border border-oak-border" type="button" onClick={closeCreateRecord}>
                <X size={17} />
              </button>
            </header>

            <form className="grid gap-4 p-6" onSubmit={handleCreateRecord}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="oak-label">Date</span>
                  <input
                    className="oak-input"
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                    required
                  />
                </label>
              </div>

              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="oak-label">Value</span>
                  <input
                    className="oak-input"
                    type="number"
                    step="0.01"
                    value={form.value}
                    onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
                    required
                  />
                </label>
              </div>

              <div className={`grid gap-4 ${showFlat ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                <label className="grid gap-2">
                  <span className="oak-label">Description</span>
                  <input
                    className="oak-input"
                    maxLength={255}
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="oak-label">Supplier</span>
                  <input
                    className="oak-input"
                    maxLength={255}
                    value={form.supplier}
                    onChange={(event) => setForm((prev) => ({ ...prev, supplier: event.target.value }))}
                  />
                </label>

                {showFlat ? (
                  <label className="grid gap-2">
                    <span className="oak-label">Flat</span>
                    <input
                      className="oak-input"
                      value={form.flat}
                      onChange={(event) => setForm((prev) => ({ ...prev, flat: event.target.value }))}
                    />
                  </label>
                ) : null}
              </div>

              <div className="grid gap-2">
                <span className="oak-label">Invoice media</span>
                <input
                  className="oak-input"
                  maxLength={120}
                  placeholder="Invoice number"
                  value={form.invoiceNumber}
                  onChange={(event) => setForm((prev) => ({ ...prev, invoiceNumber: event.target.value }))}
                />
                <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-oak-borderStrong bg-oak-surface px-3.5 py-2.5 text-sm font-semibold text-oak-coffee">
                  <Upload size={16} />
                  <span>{form.invoiceMedia?.name ?? "Upload image or PDF"}</span>
                  <input
                    ref={createInvoiceFileInputRef}
                    className="hidden"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(event) => handleCreateInvoiceFileSelect(event.target.files?.[0] ?? null)}
                  />
                </label>

                {createInvoicePreview ? (
                  <div className="max-h-72 overflow-auto rounded-lg border border-oak-border bg-white p-3">
                    {createInvoicePreview.contentType.startsWith("image/") ? (
                      <img
                        alt="Invoice preview"
                        className="mx-auto max-h-64 rounded-md border border-oak-border"
                        src={createInvoicePreview.url}
                      />
                    ) : (
                      <iframe className="h-64 w-full rounded-md border border-oak-border" src={createInvoicePreview.url} title="Invoice preview" />
                    )}
                  </div>
                ) : null}
              </div>

              {formError ? <p className="text-sm font-bold text-oak-danger">{formError}</p> : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  className="oak-button-secondary"
                  type="button"
                  onClick={closeCreateRecord}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button className="oak-button-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save record"}
                </button>
              </div>
            </form>
          </article>
        </div>
      ) : null}

      {isReportOpen ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4">
          <article className="flex h-[90dvh] w-[90vw] max-w-[90vw] flex-col rounded-2xl border border-oak-border bg-white shadow-oakLg">
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">{title}</p>
                <h2 className="text-xl font-extrabold text-oak-coffee">Send report</h2>
              </div>
              <button
                className="grid size-9 place-items-center rounded-lg border border-oak-border"
                type="button"
                onClick={closeReportModal}
                disabled={sendingReport}
              >
                <X size={17} />
              </button>
            </header>

            <form className="grid min-h-0 flex-1 gap-4 overflow-hidden p-6 lg:grid-cols-[320px_minmax(0,1fr)]" onSubmit={handleSendReport}>
              <div className="grid content-start gap-4 overflow-y-auto pr-1">
                <label className="grid gap-2">
                  <span className="oak-label">Email</span>
                  <input
                    className="oak-input"
                    type="email"
                    placeholder="name@example.com"
                    value={reportForm.email}
                    onChange={(event) => setReportForm((current) => ({ ...current, email: event.target.value }))}
                    required
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <label className="grid gap-2">
                    <span className="oak-label">Start month</span>
                    <input
                      className="oak-input"
                      type="month"
                      value={reportForm.startMonth}
                      onChange={(event) => setReportForm((current) => ({ ...current, startMonth: event.target.value }))}
                      required
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="oak-label">End month</span>
                    <input
                      className="oak-input"
                      type="month"
                      value={reportForm.endMonth}
                      onChange={(event) => setReportForm((current) => ({ ...current, endMonth: event.target.value }))}
                      required
                    />
                  </label>
                </div>

                <label className="flex items-center gap-3 rounded-xl border border-oak-border bg-oak-surface p-3 text-sm font-bold text-oak-coffee">
                  <input
                    className="size-4 accent-oak-coffee"
                    type="checkbox"
                    checked={reportForm.includeInvoiceTable}
                    onChange={(event) => setReportForm((current) => ({ ...current, includeInvoiceTable: event.target.checked }))}
                  />
                  Add invoice table before media pages
                </label>

                <div className="rounded-xl bg-oak-panel p-4 text-sm font-semibold text-black/60">
                  Report period: {reportForm.startMonth} to {reportForm.endMonth}
                  {search.trim() ? ` | Filter: ${search.trim()}` : ""}
                </div>

                {reportError ? <p className="text-sm font-bold text-oak-danger">{reportError}</p> : null}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end lg:flex-col-reverse">
                  <button className="oak-button-secondary" type="button" onClick={closeReportModal} disabled={sendingReport}>
                    Cancel
                  </button>
                  <button className="oak-button-primary" type="submit" disabled={sendingReport}>
                    {sendingReport ? "Sending..." : "Send report"}
                  </button>
                </div>
              </div>

              <div className="min-h-[420px] overflow-hidden rounded-xl border border-oak-border bg-oak-panel">
                {reportPreviewLoading ? (
                  <div className="grid h-full min-h-[420px] place-items-center text-sm font-bold text-black/55">Loading preview...</div>
                ) : reportPreviewError ? (
                  <div className="grid h-full min-h-[420px] place-items-center p-6 text-center text-sm font-bold text-oak-danger">{reportPreviewError}</div>
                ) : reportPreviewUrl ? (
                  <iframe className="h-full min-h-[420px] w-full bg-white" src={reportPreviewUrl} title={`${title} report preview`} />
                ) : (
                  <div className="grid h-full min-h-[420px] place-items-center text-sm font-bold text-black/55">Select a period to preview.</div>
                )}
              </div>
            </form>
          </article>
        </div>
      ) : null}

      {textEditor ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
          <article className="w-full max-w-md rounded-2xl border border-oak-border bg-white shadow-oakLg">
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">{title}</p>
                <h2 className="text-lg font-extrabold text-oak-coffee">Edit record</h2>
              </div>
              <button
                className="grid size-9 place-items-center rounded-lg border border-oak-border"
                type="button"
                onClick={() => setTextEditor(null)}
                disabled={savingText}
              >
                <X size={17} />
              </button>
            </header>

            <form className="grid gap-4 p-6" onSubmit={handleSaveText}>
              <label className="grid gap-2">
                <span className="oak-label">Value</span>
                <input
                  className="oak-input"
                  step="0.01"
                  type="number"
                  value={textEditor.value}
                  onChange={(event) => setTextEditor((current) => (current ? { ...current, value: event.target.value, error: null } : current))}
                  required
                />
              </label>

              <label className="grid gap-2">
                <span className="oak-label">Comments</span>
                <textarea
                  className="oak-input min-h-28 resize-y"
                  maxLength={255}
                  value={textEditor.description}
                  onChange={(event) => setTextEditor((current) => (current ? { ...current, description: event.target.value, error: null } : current))}
                />
              </label>

              <label className="grid gap-2">
                <span className="oak-label">Supplier</span>
                <input
                  className="oak-input"
                  maxLength={255}
                  value={textEditor.supplier}
                  onChange={(event) => setTextEditor((current) => (current ? { ...current, supplier: event.target.value, error: null } : current))}
                />
              </label>

              {showFlat ? (
                <label className="grid gap-2">
                  <span className="oak-label">Flat</span>
                  <select
                    className="oak-input"
                    value={textEditor.flat || ""}
                    onChange={(event) => setTextEditor((current) => (current ? { ...current, flat: event.target.value, error: null } : current))}
                  >
                    <option value="">Select a flat</option>
                    {FLAT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {textEditor.error ? <p className="text-sm font-bold text-oak-danger">{textEditor.error}</p> : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button className="oak-button-secondary" type="button" onClick={() => setTextEditor(null)} disabled={savingText}>
                  Cancel
                </button>
                <button className="oak-button-primary" type="submit" disabled={savingText}>
                  {savingText ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </article>
        </div>
      ) : null}

      {invoiceEditor ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
          <article className="w-full max-w-4xl rounded-2xl border border-oak-border bg-white shadow-oakLg">
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">Invoice media</p>
                <h2 className="text-lg font-extrabold text-oak-coffee">
                  {invoiceEditor.preview?.fileName ?? `Payment #${invoiceEditor.record.payment_number}`}
                </h2>
              </div>
              <button
                className="grid size-9 place-items-center rounded-lg border border-oak-border"
                type="button"
                onClick={closeInvoiceEditor}
                disabled={savingInvoice}
              >
                <X size={17} />
              </button>
            </header>

            <div className="grid gap-4 p-4">
              <label className="grid gap-2">
                <span className="oak-label">Invoice number</span>
                <input
                  className="oak-input"
                  maxLength={120}
                  value={invoiceEditor.invoiceNumber}
                  onChange={(event) =>
                    setInvoiceEditor((current) => (current ? { ...current, invoiceNumber: event.target.value, error: null } : current))
                  }
                />
              </label>

              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-oak-borderStrong bg-oak-surface px-3.5 py-2.5 text-sm font-semibold text-oak-coffee">
                <Upload size={16} />
                <span>{invoiceEditor.selectedFile?.name ?? (invoiceEditor.record.has_invoice ? "Replace image or PDF" : "Add image or PDF")}</span>
                <input
                  className="hidden"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(event) => handleInvoiceFileSelect(event.target.files?.[0] ?? null)}
                />
              </label>

              {invoiceEditor.preview ? (
                <div className="max-h-[62dvh] overflow-auto">
                  {invoiceEditor.preview.contentType.startsWith("image/") ? (
                    <img
                      alt="Invoice preview"
                      className="mx-auto max-h-[58dvh] rounded-lg border border-oak-border"
                      src={invoiceEditor.preview.url}
                    />
                  ) : (
                    <iframe className="h-[58dvh] w-full rounded-lg border border-oak-border" src={invoiceEditor.preview.url} title="Invoice preview" />
                  )}
                </div>
              ) : (
                <div className="grid min-h-44 place-items-center rounded-lg border border-dashed border-oak-border bg-oak-panel text-sm font-semibold text-black/55">
                  No invoice media added yet.
                </div>
              )}

              {invoiceEditor.error ? <p className="text-sm font-bold text-oak-danger">{invoiceEditor.error}</p> : null}
            </div>

            <footer className="flex justify-end gap-3 border-t border-oak-border px-6 py-4">
              <button className="oak-button-secondary" type="button" onClick={closeInvoiceEditor} disabled={savingInvoice}>
                Close
              </button>
              {invoiceEditor.preview ? (
                <button
                  className="oak-button-secondary"
                  type="button"
                  onClick={() => invoiceEditor.preview && window.open(invoiceEditor.preview.url, "_blank", "noopener,noreferrer")}
                >
                  Open in new tab
                </button>
              ) : null}
              <button className="oak-button-primary" type="button" onClick={() => void handleSaveInvoice()} disabled={savingInvoice}>
                {savingInvoice ? "Saving..." : invoiceEditor.record.has_invoice ? "Update invoice" : "Add invoice"}
              </button>
            </footer>
          </article>
        </div>
      ) : null}
    </DashboardShell>
  );
}
