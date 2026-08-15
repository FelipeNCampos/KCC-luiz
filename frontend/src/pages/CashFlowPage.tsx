import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AxiosError } from "axios";
import { CircleDollarSign, Download, FileSpreadsheet, Pencil, Search, Trash2, Upload, X } from "lucide-react";

import { DashboardShell } from "../components/DashboardShell";
import { CashFlowShareLinksPanel } from "../components/CashFlowShareLinksPanel";
import { InvoiceModal } from "../components/InvoiceModal";
import { InvoiceModalContractor } from "../components/InvoiceModalContractor";
import {
  cashFlowService,
  CashFlowListResponse,
  CashFlowRow,
  CashFlowScope,
  SystemInvoiceData,
  SystemInvoiceType,
} from "../services/cashflow";

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

type RecordEditorState = {
  record: CashFlowRow;
  invoiceNumber: string;
  date: string;
  value: string;
  description: string;
  supplier: string;
  flat: string;
  preview: PreviewState | null;
  error: string | null;
};

type SystemInvoiceEditorState = {
  recordId: number;
  type: SystemInvoiceType;
  draft: SystemInvoiceData;
};

type ReportFormState = {
  email: string;
  startMonth: string;
  endMonth: string;
  includeInvoiceTable: boolean;
};

type CustomPeriod = {
  dateFrom: string;
  dateTo: string;
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

function monthDateRange(month: string): CustomPeriod {
  const [year, monthValue] = month.split("-").map(Number);
  const endDate = new Date(year, monthValue, 0);
  return {
    dateFrom: `${month}-01`,
    dateTo: toDateInputValue(endDate)
  };
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
  const recordInvoiceNumberInputRef = useRef<HTMLInputElement | null>(null);
  const recordRowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const [month, setMonth] = useState(toMonthInputValue(new Date()));
  const [customPeriod, setCustomPeriod] = useState<CustomPeriod | null>(null);
  const [customPeriodForm, setCustomPeriodForm] = useState<CustomPeriod>(() => monthDateRange(toMonthInputValue(new Date())));
  const [isCustomPeriodOpen, setIsCustomPeriodOpen] = useState(false);
  const [customPeriodError, setCustomPeriodError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [allRecords, setAllRecords] = useState(false);
  const [highlightedRecordId, setHighlightedRecordId] = useState<number | null>(null);
  const [pendingRecordFocus, setPendingRecordFocus] = useState<{ recordId: number; month: string } | null>(null);
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
  const [recordEditor, setRecordEditor] = useState<RecordEditorState | null>(null);
  const [savingRecord, setSavingRecord] = useState(false);
  const [createInvoicePreview, setCreateInvoicePreview] = useState<PreviewState | null>(null);
  const [systemInvoiceEditor, setSystemInvoiceEditor] = useState<SystemInvoiceEditorState | null>(null);
  const tableColumnCount = showFlat ? 8 : 7;
  const tableMinWidthClass = showFlat ? "min-w-[1000px]" : "min-w-[860px]";
  const summaryMiddleColumnSpan = showFlat ? 2 : 1;
  const moveTargetScope: CashFlowScope = scope === "main" ? "cashflow52" : "main";
  const moveTargetTitle = scope === "main" ? "Cashflow 52" : "Cashflow penthouse";

  const listParams = useCallback(() => {
    return {
      month,
      search,
      scope,
      all: allRecords,
      ...(customPeriod ? { dateFrom: customPeriod.dateFrom, dateTo: customPeriod.dateTo } : {})
    };
  }, [allRecords, customPeriod, month, scope, search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    cashFlowService
      .list(listParams())
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
  }, [listParams]);

  useEffect(() => {
    if (
      !pendingRecordFocus ||
      allRecords ||
      loading ||
      data?.month !== pendingRecordFocus.month
    ) {
      return;
    }

    const recordRow = recordRowRefs.current.get(pendingRecordFocus.recordId);
    if (!recordRow) return;

    recordRow.scrollIntoView({ behavior: "smooth", block: "center" });
    setPendingRecordFocus(null);
  }, [allRecords, data?.month, loading, pendingRecordFocus]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsCreateOpen(false);
      setIsReportOpen(false);
      setIsCustomPeriodOpen(false);
      closeRecordEditor();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      if (recordEditor?.preview) {
        URL.revokeObjectURL(recordEditor.preview.url);
      }
    };
  }, [recordEditor?.preview]);

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
  const totalValue = formatCurrency(data?.monthly_total ?? 0);
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
    const response = await cashFlowService.list(listParams());
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
      closeRecordEditor();
      setFeedback({ type: "success", message: "Record deleted successfully." });
      await reload();
    } catch (requestError) {
      const axiosError = requestError as AxiosError<{ detail?: string }>;
      setFeedback({ type: "error", message: axiosError.response?.data?.detail ?? "Unable to delete record." });
    }
  }

  async function handleMoveRecord(recordId: number) {
    if (!window.confirm(`Move this record to ${moveTargetTitle}?`)) return;

    setFeedback(null);
    try {
      await cashFlowService.update(recordId, { scope: moveTargetScope });
      closeRecordEditor();
      setFeedback({ type: "success", message: `Record moved to ${moveTargetTitle}.` });
      await reload();
    } catch (requestError) {
      const axiosError = requestError as AxiosError<{ detail?: string }>;
      setFeedback({ type: "error", message: axiosError.response?.data?.detail ?? "Unable to move record." });
    }
  }

  async function handleOpenRecordEditor(row: CashFlowRow) {
    setFeedback(null);

    const createEditor = (preview: PreviewState | null): RecordEditorState => ({
      record: row,
      invoiceNumber: row.invoice_number ?? "",
      date: row.record_date,
      value: row.amount,
      description: row.description ?? "",
      supplier: row.supplier ?? "",
      flat: normalizeFlatValue(row.flat),
      preview,
      error: null
    });

    try {
      if (!row.has_invoice_media || !row.invoice_media_name) {
        setRecordEditor(createEditor(null));
        return;
      }

      const media = await cashFlowService.getInvoiceMedia(row.id);
      const objectUrl = URL.createObjectURL(media.blob);
      if (recordEditor?.preview) {
        URL.revokeObjectURL(recordEditor.preview.url);
      }
      setRecordEditor(createEditor({
          url: objectUrl,
          contentType: media.contentType ?? "application/octet-stream",
          fileName: row.invoice_media_name ?? "invoice"
      }));
    } catch {
      setRecordEditor(createEditor(null));
    }
  }

  function handleRecordClick(row: CashFlowRow) {
    if (allRecords) {
      const recordMonth = row.record_date.slice(0, 7);
      setHighlightedRecordId(row.id);
      setPendingRecordFocus({ recordId: row.id, month: recordMonth });
      setAllRecords(false);
      setMonth(recordMonth);
      return;
    }

    if (pendingRecordFocus) return;
    void handleOpenRecordEditor(row);
  }

  async function handleOpenSystemInvoiceEditor(row: CashFlowRow) {
    setFeedback(null);
    try {
      const invoice = await cashFlowService.getSystemInvoice(row.id);
      setSystemInvoiceEditor({
        recordId: row.id,
        type: invoice.system_invoice_type,
        draft: invoice.system_invoice_data,
      });
    } catch (requestError) {
      const axiosError = requestError as AxiosError<{ detail?: string }>;
      setFeedback({ type: "error", message: axiosError.response?.data?.detail ?? "Unable to open system invoice." });
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

  function closeRecordEditor() {
    setRecordEditor(null);
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

  function handleDownloadInvoiceMedia() {
    if (!recordEditor?.preview) return;
    const link = document.createElement("a");
    link.href = recordEditor.preview.url;
    link.download = recordEditor.preview.fileName;
    link.click();
  }

  function focusRecordEditor() {
    recordInvoiceNumberInputRef.current?.focus();
  }

  async function handleSaveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recordEditor) return;

    const isSystemInvoice = recordEditor.record.system_invoice_type !== null;
    const parsedValue = Number(recordEditor.value);
    if (!recordEditor.date || (!isSystemInvoice && (!recordEditor.value.trim() || !Number.isFinite(parsedValue)))) {
      setRecordEditor((current) => (current ? { ...current, error: "Enter a valid date and value." } : current));
      return;
    }
    if (!isSystemInvoice && parsedValue === 0) {
      setRecordEditor((current) => (current ? { ...current, error: "Value must be different from zero." } : current));
      return;
    }

    setSavingRecord(true);
    try {
      const updatePayload = {
        recordDate: recordEditor.date,
        description: recordEditor.description.trim() || null,
        supplier: recordEditor.supplier.trim() || null,
        flat: showFlat ? recordEditor.flat.trim() || null : null
      };
      await cashFlowService.update(recordEditor.record.id, {
        ...updatePayload,
        ...(isSystemInvoice ? {} : { value: recordEditor.value })
      });
      const invoiceNumber = recordEditor.invoiceNumber.trim();
      if (invoiceNumber !== (recordEditor.record.invoice_number ?? "")) {
        await cashFlowService.updateInvoiceMedia(recordEditor.record.id, {
          invoiceMedia: null,
          invoiceNumber
        });
      }
      closeRecordEditor();
      setFeedback({ type: "success", message: "Record updated successfully." });
      await reload();
    } catch (requestError) {
      const axiosError = requestError as AxiosError<{ detail?: string }>;
      setRecordEditor((current) =>
        current ? { ...current, error: axiosError.response?.data?.detail ?? "Unable to update record." } : current
      );
    } finally {
      setSavingRecord(false);
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

  function openCustomPeriodModal() {
    setCustomPeriodForm(customPeriod ?? monthDateRange(month));
    setCustomPeriodError(null);
    setIsCustomPeriodOpen(true);
  }

  function handleApplyCustomPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customPeriodForm.dateFrom || !customPeriodForm.dateTo) {
      setCustomPeriodError("Select both dates for the period.");
      return;
    }
    if (customPeriodForm.dateFrom > customPeriodForm.dateTo) {
      setCustomPeriodError("Start date must be before or equal to end date.");
      return;
    }

    setAllRecords(false);
    setCustomPeriod(customPeriodForm);
    setCustomPeriodError(null);
    setIsCustomPeriodOpen(false);
  }

  function handleMonthClick() {
    const input = monthInputRef.current;
    if (customPeriod && input) {
      input.type = "month";
      input.value = month;
      setCustomPeriod(null);
      if (typeof input.showPicker === "function") {
        input.showPicker();
      }
      return;
    }
    openMonthPicker();
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
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <label className="oak-label" htmlFor="cashflow-month">Month</label>
              <button
                aria-label="Customize period"
                className="grid size-6 place-items-center rounded text-oak-coffee hover:bg-oak-panel"
                type="button"
                onClick={openCustomPeriodModal}
              >
                <Pencil size={15} />
              </button>
            </div>
            <input
              id="cashflow-month"
              ref={monthInputRef}
              className="oak-input cursor-pointer"
              type={customPeriod ? "text" : "month"}
              value={customPeriod ? "Customized" : month}
              readOnly={Boolean(customPeriod)}
              onClick={handleMonthClick}
              onChange={(event) => {
                setCustomPeriod(null);
                setMonth(event.target.value);
              }}
            />
          </div>
          <label className="grid min-w-0 gap-2 sm:flex-1 sm:min-w-72">
            <span className="oak-label invisible">Search</span>
            <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-oak-taupe" />
            <input
              className="oak-input pl-9"
              placeholder={showFlat ? "Search by Description, Supplier, Flat or Amount" : "Search by Description, Supplier or Amount"}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            </span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 pb-2 text-sm font-bold text-oak-coffee">
            <input
              className="size-4 rounded border-oak-borderStrong"
              type="checkbox"
              checked={allRecords}
              onChange={(event) => {
                setAllRecords(event.target.checked);
                if (event.target.checked) setCustomPeriod(null);
              }}
            />
            All
          </label>
        </div>
      }
    >
      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <article className="oak-card p-6">
          <div className="grid overflow-hidden rounded-xl border border-oak-border bg-oak-panel sm:grid-cols-2">
            <div className="p-4 text-center sm:border-r sm:border-oak-border">
                <p className="oak-label">{allRecords ? "Opening balance" : "Last Month"}</p>
              <p className={`mt-2 text-2xl font-extrabold ${openingBalanceValue >= 0 ? "text-oak-coffee" : "text-[#cf0e0e]"}`}>{openingBalance}</p>
            </div>
            <div className="p-4 text-center">
                <p className="oak-label">{allRecords ? "All records" : "This Month"}</p>
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
          <CashFlowShareLinksPanel scope={scope} defaultDate={`${month}-01`} />
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
        <div className="max-h-[calc(100dvh-18rem)] overflow-x-auto overflow-y-auto">
          <table className={`w-full ${tableMinWidthClass} text-left`}>
            <thead className="bg-oak-panel text-[11px] uppercase text-oak-muted">
              <tr>
                <th className="px-4 py-3 font-extrabold">Invoice No</th>
                <th className="px-4 py-3 font-extrabold">Invoice</th>
                <th className="px-4 py-3 font-extrabold">Date</th>
                <th className="px-4 py-3 font-extrabold text-right">Amount</th>
                <th className="px-4 py-3 font-extrabold">Comments</th>
                <th className="px-4 py-3 font-extrabold">Supplier</th>
                {showFlat ? <th className="px-4 py-3 font-extrabold">Flat</th> : null}
                <th className="px-4 py-3 font-extrabold text-right">Balance</th>
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
                        className={`cursor-pointer transition-colors hover:bg-oak-surface ${
                          highlightedRecordId === row.id
                            ? "bg-amber-100 ring-2 ring-inset ring-amber-400"
                            : "bg-white"
                        }`}
                        data-highlighted={highlightedRecordId === row.id || undefined}
                        key={row.id}
                        onClick={() => handleRecordClick(row)}
                        ref={(element) => {
                          if (element) {
                            recordRowRefs.current.set(row.id, element);
                          } else {
                            recordRowRefs.current.delete(row.id);
                          }
                        }}
                      >
                        <td className="px-4 py-3 text-sm font-bold text-oak-coffee">#{row.payment_number}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-oak-coffee">
                          {row.has_invoice_media ? "Yes" : "No"}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-black/65">{formatDate(row.record_date)}</td>
                        <td
                          className={`px-4 py-3 text-right text-sm font-extrabold ${Number(row.amount) >= 0 ? "text-emerald-700" : "text-[#cf0e0e]"}`}
                        >
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-black/70">
                          <span className="block max-w-72 truncate">{row.description ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-black/70">
                          <span className="block max-w-56 truncate">{row.supplier ?? "—"}</span>
                        </td>
                        {showFlat ? (
                          <td className="px-4 py-3 text-sm font-semibold text-black/70">
                            <span className="block max-w-40 truncate">{row.flat ?? "—"}</span>
                          </td>
                        ) : null}
                        <td
                          className={`px-4 py-3 text-right text-sm font-extrabold ${Number(row.balance) >= 0 ? "text-emerald-700" : "text-[#cf0e0e]"}`}
                        >
                          {formatAbsoluteCurrency(row.balance)}
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
                </>
              ) : null}
            </tbody>
            {data ? (
              <tfoot className="sticky bottom-0 z-[1] border-t border-oak-border bg-oak-panel shadow-[0_-4px_8px_rgba(85,49,28,0.08)]">
                <tr>
                  <td className="px-4 py-3" colSpan={2} />
                  <td className="px-4 py-3 text-sm font-extrabold tracking-[0.08em] text-oak-coffee">
                    Total:
                  </td>
                  <td
                    className={`px-4 py-3 text-right text-sm font-extrabold ${Number(data.monthly_total) >= 0 ? "text-emerald-700" : "text-[#cf0e0e]"}`}
                  >
                    {totalValue}
                  </td>
                  <td className="px-4 py-3" colSpan={summaryMiddleColumnSpan} />
                  <td className="px-4 py-3 text-sm font-extrabold tracking-[0.08em] text-oak-coffee">
                    Total:
                  </td>
                  <td
                    className={`px-4 py-3 text-right text-sm font-extrabold ${Number(data.current_balance) >= 0 ? "text-emerald-700" : "text-[#cf0e0e]"}`}
                  >
                    {currentBalance}
                  </td>
                </tr>
              </tfoot>
            ) : null}
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

      {isCustomPeriodOpen ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4">
          <article
            aria-labelledby="custom-period-title"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-oak-border bg-white shadow-oakLg"
            role="dialog"
          >
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">{title}</p>
                <h2 id="custom-period-title" className="text-lg font-extrabold text-oak-coffee">Customize cashflow period</h2>
              </div>
              <button
                aria-label="Close custom period"
                className="grid size-9 place-items-center rounded-lg border border-oak-border"
                type="button"
                onClick={() => setIsCustomPeriodOpen(false)}
              >
                <X size={17} />
              </button>
            </header>

            <form className="grid gap-5 p-6" onSubmit={handleApplyCustomPeriod}>
              <label className="grid gap-2">
                <span className="oak-label">Start date</span>
                <input
                  className="oak-input"
                  type="date"
                  value={customPeriodForm.dateFrom}
                  onChange={(event) => setCustomPeriodForm((current) => ({ ...current, dateFrom: event.target.value }))}
                  required
                />
              </label>

              <label className="grid gap-2">
                <span className="oak-label">End date</span>
                <input
                  className="oak-input"
                  type="date"
                  value={customPeriodForm.dateTo}
                  onChange={(event) => setCustomPeriodForm((current) => ({ ...current, dateTo: event.target.value }))}
                  required
                />
              </label>

              {customPeriodError ? <p className="text-sm font-bold text-oak-danger">{customPeriodError}</p> : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button className="oak-button-secondary" type="button" onClick={() => setIsCustomPeriodOpen(false)}>
                  Cancel
                </button>
                <button className="oak-button-primary" type="submit">
                  Apply period
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

      {recordEditor ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
          <article className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-oak-border bg-white shadow-oakLg">
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">{title}</p>
                <h2 className="text-lg font-extrabold text-oak-coffee">Edit record</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="oak-button-secondary shrink-0"
                  type="button"
                  onClick={focusRecordEditor}
                  disabled={savingRecord}
                >
                  Edit
                </button>
                <button
                  aria-label="Close record details"
                  className="grid size-9 place-items-center rounded-lg border border-oak-border"
                  type="button"
                  onClick={closeRecordEditor}
                  disabled={savingRecord}
                >
                  <X size={17} />
                </button>
              </div>
            </header>

            <form className="grid min-h-0 flex-1 lg:grid-cols-2" onSubmit={handleSaveRecord}>
              <section className="flex min-h-0 flex-col overflow-y-auto border-b border-oak-border p-5 lg:border-b-0 lg:border-r sm:p-6">
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="oak-label">Invoice number</span>
                      <input
                        className="oak-input"
                        ref={recordInvoiceNumberInputRef}
                        maxLength={120}
                        value={recordEditor.invoiceNumber}
                        onChange={(event) => setRecordEditor((current) => (current ? { ...current, invoiceNumber: event.target.value, error: null } : current))}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="oak-label">Date</span>
                      <input
                        className="oak-input"
                        type="date"
                        value={recordEditor.date}
                        onChange={(event) => setRecordEditor((current) => (current ? { ...current, date: event.target.value, error: null } : current))}
                        required
                      />
                    </label>
                  </div>

                  {recordEditor.record.system_invoice_type === null ? (
                    <label className="grid gap-2">
                      <span className="oak-label">Value</span>
                      <input
                        className="oak-input"
                        step="0.01"
                        type="number"
                        value={recordEditor.value}
                        onChange={(event) => setRecordEditor((current) => (current ? { ...current, value: event.target.value, error: null } : current))}
                        required
                      />
                    </label>
                  ) : null}

                  <label className="grid gap-2">
                    <span className="oak-label">Comments</span>
                    <textarea
                      className="oak-input min-h-28 resize-y"
                      maxLength={255}
                      value={recordEditor.description}
                      onChange={(event) => setRecordEditor((current) => (current ? { ...current, description: event.target.value, error: null } : current))}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="oak-label">Supplier</span>
                    <input
                      className="oak-input"
                      maxLength={255}
                      value={recordEditor.supplier}
                      onChange={(event) => setRecordEditor((current) => (current ? { ...current, supplier: event.target.value, error: null } : current))}
                    />
                  </label>

                  {showFlat ? (
                    <label className="grid gap-2">
                      <span className="oak-label">Flat</span>
                      <select
                        className="oak-input"
                        value={recordEditor.flat}
                        onChange={(event) => setRecordEditor((current) => (current ? { ...current, flat: event.target.value, error: null } : current))}
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

                  {recordEditor.error ? <p className="text-sm font-bold text-oak-danger">{recordEditor.error}</p> : null}
                </div>

                <footer className="mt-auto flex flex-nowrap items-center gap-3 overflow-x-auto border-t border-oak-border pt-5">
                  <button
                    aria-label="Delete record"
                    className="oak-button-secondary grid shrink-0 !size-10 !min-h-10 !p-0 !text-oak-danger"
                    title="Delete record"
                    type="button"
                    onClick={() => void handleDeleteRecord(recordEditor.record.id)}
                    disabled={savingRecord}
                  >
                    <Trash2 size={17} />
                  </button>
                  <button
                    className="oak-button-secondary shrink-0 whitespace-nowrap"
                    type="button"
                    onClick={() => void handleMoveRecord(recordEditor.record.id)}
                    disabled={savingRecord}
                  >
                    Move to {moveTargetTitle}
                  </button>
                  <div className="ml-auto flex shrink-0 gap-3">
                    <button className="oak-button-secondary" type="button" onClick={closeRecordEditor} disabled={savingRecord}>
                      Cancel
                    </button>
                    <button className="oak-button-primary" type="submit" disabled={savingRecord}>
                      {savingRecord ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </footer>
              </section>

              <section className="flex min-h-0 flex-col bg-oak-panel/40">
                <header className="flex items-center justify-between gap-3 border-b border-oak-border bg-white px-5 py-4 sm:px-6">
                  <div className="min-w-0">
                    <p className="oak-label">Invoice media</p>
                    <h3 className="truncate text-sm font-extrabold text-oak-coffee">
                      {recordEditor.preview?.fileName ?? "No invoice media"}
                    </h3>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      aria-label="Download invoice media"
                      className="oak-button-secondary grid !size-10 !min-h-10 !p-0"
                      disabled={!recordEditor.preview}
                      title="Download invoice media"
                      type="button"
                      onClick={handleDownloadInvoiceMedia}
                    >
                      <Download size={17} />
                    </button>
                    {recordEditor.record.system_invoice_type === "cleaner" || recordEditor.record.system_invoice_type === "contractor" ? (
                      <button
                        aria-label="Edit invoice media"
                        className="oak-button-secondary grid !size-10 !min-h-10 !p-0"
                        title="Edit invoice media"
                        type="button"
                        onClick={() => void handleOpenSystemInvoiceEditor(recordEditor.record)}
                      >
                        <Pencil size={17} />
                      </button>
                    ) : null}
                  </div>
                </header>

                <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
                  {recordEditor.preview ? (
                    recordEditor.preview.contentType.startsWith("image/") ? (
                      <img
                        alt="Invoice preview"
                        className="mx-auto max-h-[62dvh] rounded-lg border border-oak-border bg-white"
                        src={recordEditor.preview.url}
                      />
                    ) : (
                      <iframe className="h-[62dvh] min-h-[420px] w-full rounded-lg border border-oak-border bg-white" src={recordEditor.preview.url} title="Invoice preview" />
                    )
                  ) : (
                    <div className="grid h-full min-h-64 place-items-center rounded-lg border border-dashed border-oak-border bg-white p-6 text-center text-sm font-semibold text-black/55">
                      No invoice media is attached to this record.
                    </div>
                  )}
                </div>
              </section>
            </form>
          </article>
        </div>
      ) : null}
      {systemInvoiceEditor ? (
        <>
          {systemInvoiceEditor.type === "cleaner" ? (
            <InvoiceModal
              open
              sourceLabel="Cleaner"
              defaultDescription="Cleaner service invoice"
              editingRecordId={systemInvoiceEditor.recordId}
              editingScope={scope}
              editingDraft={systemInvoiceEditor.draft}
              onClose={() => setSystemInvoiceEditor(null)}
              onUpdated={(message) => {
                closeRecordEditor();
                setFeedback({ type: "success", message });
                void reload();
              }}
            />
          ) : (
            <InvoiceModalContractor
              open
              sourceLabel="Contractor"
              defaultDescription="Contractor service invoice"
              editingRecordId={systemInvoiceEditor.recordId}
              editingScope={scope}
              editingDraft={systemInvoiceEditor.draft}
              onClose={() => setSystemInvoiceEditor(null)}
              onUpdated={(message) => {
                closeRecordEditor();
                setFeedback({ type: "success", message });
                void reload();
              }}
            />
          )}
        </>
      ) : null}
    </DashboardShell>
  );
}
