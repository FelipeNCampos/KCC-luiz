import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AxiosError } from "axios";
import { CircleDollarSign, FileSpreadsheet, Search, Upload, X } from "lucide-react";

import { DashboardShell } from "../components/DashboardShell";
import { cashFlowService, CashFlowListResponse, CashFlowType } from "../services/cashflow";

type FormState = {
  type: CashFlowType;
  invoice: "Yes" | "No";
  date: string;
  value: string;
  description: string;
  flat: string;
  invoiceMedia: File | null;
};

type PreviewState = {
  url: string;
  contentType: string;
  fileName: string;
};

type ReportFormState = {
  email: string;
};

function toMonthInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatCurrency(value: string | number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(parsed);
}

const initialForm: FormState = {
  type: "income",
  invoice: "No",
  date: toDateInputValue(new Date()),
  value: "",
  description: "",
  flat: "",
  invoiceMedia: null
};

export function CashFlowPage() {
  const monthInputRef = useRef<HTMLInputElement | null>(null);
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
  const [reportForm, setReportForm] = useState<ReportFormState>({ email: "" });
  const [reportError, setReportError] = useState<string | null>(null);
  const [sendingReport, setSendingReport] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    cashFlowService
      .list({ month, search })
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
  }, [month, search]);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview]);

  const monthlyTotal = useMemo(() => formatCurrency(data?.monthly_total ?? 0), [data?.monthly_total]);

  async function reload() {
    const response = await cashFlowService.list({ month, search });
    setData(response);
  }

  async function handleCreateRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFeedback(null);

    if (!form.date || !form.value || !form.description.trim() || !form.flat.trim()) {
      setFormError("Please fill all required fields.");
      return;
    }

    if (Number(form.value) <= 0) {
      setFormError("Value must be a positive number.");
      return;
    }

    if (form.invoice === "Yes" && !form.invoiceMedia) {
      setFormError("Invoice media is required when Invoice is Yes.");
      return;
    }

    setSaving(true);
    try {
      await cashFlowService.create({
        type: form.type,
        invoice: form.invoice,
        date: form.date,
        value: form.value,
        description: form.description,
        flat: form.flat,
        invoiceMedia: form.invoiceMedia
      });

      setForm(initialForm);
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

  async function handleOpenInvoice(recordId: number, fileName: string | null) {
    setFeedback(null);

    try {
      const media = await cashFlowService.getInvoiceMedia(recordId);
      const objectUrl = URL.createObjectURL(media.blob);
      if (preview) {
        URL.revokeObjectURL(preview.url);
      }
      setPreview({
        url: objectUrl,
        contentType: media.contentType ?? "application/octet-stream",
        fileName: fileName ?? "invoice"
      });
    } catch (requestError) {
      const axiosError = requestError as AxiosError<{ detail?: string }>;
      setFeedback({ type: "error", message: axiosError.response?.data?.detail ?? "Unable to load invoice media." });
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

    setSendingReport(true);
    try {
      const response = await cashFlowService.sendReport({
        email: reportForm.email.trim(),
        month,
        search: search.trim() || undefined
      });
      setIsReportOpen(false);
      setReportForm({ email: "" });
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

  function closePreview() {
    if (preview) {
      URL.revokeObjectURL(preview.url);
    }
    setPreview(null);
  }

  function openMonthPicker() {
    const input = monthInputRef.current;
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === "function") {
      input.showPicker();
    }
  }

  return (
    <DashboardShell
      title="Cashflow"
      subtitle="Lancamentos e saldo mensal"
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
              placeholder="Search by Description or Flat"
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
          <p className="oak-label">Monthly Balance</p>
          <p className={`mt-3 text-4xl font-extrabold ${Number(data?.monthly_total ?? 0) >= 0 ? "text-emerald-700" : "text-oak-danger"}`}>
            {monthlyTotal}
          </p>
          <p className="mt-2 text-sm font-semibold text-black/60">
            Total considers all records for {data?.month ?? month}, even when search is active.
          </p>
        </article>

        <div className="grid gap-3 md:h-full">
          <button className="oak-button-primary min-h-12 w-full" type="button" onClick={() => setIsCreateOpen(true)}>
            <CircleDollarSign size={18} />
            New record
          </button>
          <button className="oak-button-secondary min-h-12 w-full md:flex-1" type="button" onClick={() => setIsReportOpen(true)}>
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
          <table className="w-full min-w-[980px] text-left">
            <thead className="bg-oak-panel text-[11px] uppercase text-oak-muted">
              <tr>
                <th className="px-4 py-3 font-extrabold">Payment Number</th>
                <th className="px-4 py-3 font-extrabold">Invoice</th>
                <th className="px-4 py-3 font-extrabold">Date</th>
                <th className="px-4 py-3 font-extrabold text-right">Amount</th>
                <th className="px-4 py-3 font-extrabold">Description</th>
                <th className="px-4 py-3 font-extrabold">Flat</th>
                <th className="px-4 py-3 font-extrabold text-right">Balance</th>
                <th className="px-4 py-3 font-extrabold">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-oak-border">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-sm font-semibold text-black/60" colSpan={8}>
                    Loading cash flow records...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td className="px-4 py-6 text-sm font-bold text-oak-danger" colSpan={8}>
                    {error}
                  </td>
                </tr>
              ) : data && data.items.length > 0 ? (
                data.items.map((row) => (
                  <tr key={row.id} className="bg-white transition-colors hover:bg-oak-surface">
                    <td className="px-4 py-3 text-sm font-bold text-oak-coffee">#{row.payment_number}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-oak-coffee">
                      {row.has_invoice ? (
                        <button
                          className="underline decoration-oak-taupe underline-offset-2"
                          type="button"
                          onClick={() => handleOpenInvoice(row.id, row.invoice_media_name)}
                        >
                          Yes
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-black/65">{row.record_date}</td>
                    <td
                      className={`px-4 py-3 text-right text-sm font-extrabold ${Number(row.amount) >= 0 ? "text-emerald-700" : "text-oak-danger"}`}
                    >
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-black/70">{row.description}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-black/70">{row.flat}</td>
                    <td
                      className={`px-4 py-3 text-right text-sm font-extrabold ${Number(row.balance) >= 0 ? "text-emerald-700" : "text-oak-danger"}`}
                    >
                      {formatCurrency(row.balance)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-black/70">
                      <button className="oak-button-secondary !min-h-9 !px-3 !py-1.5" type="button" onClick={() => handleDeleteRecord(row.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-8 text-sm font-semibold text-black/60" colSpan={8}>
                    No records for this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4">
          <article className="w-full max-w-2xl rounded-2xl border border-oak-border bg-white shadow-oakLg">
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">Cashflow</p>
                <h2 className="text-xl font-extrabold text-oak-coffee">Add record</h2>
              </div>
              <button className="grid size-9 place-items-center rounded-lg border border-oak-border" type="button" onClick={() => setIsCreateOpen(false)}>
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

                <label className="grid gap-2">
                  <span className="oak-label">Invoice</span>
                  <select
                    className="oak-input"
                    value={form.invoice}
                    onChange={(event) => setForm((prev) => ({ ...prev, invoice: event.target.value as "Yes" | "No" }))}
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="oak-label">Type</span>
                  <select
                    className="oak-input"
                    value={form.type}
                    onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as CashFlowType }))}
                  >
                    <option value="income">Income</option>
                    <option value="outcome">Outcome</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="oak-label">Value</span>
                  <input
                    className="oak-input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.value}
                    onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
                    required
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="oak-label">Description</span>
                  <input
                    className="oak-input"
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    required
                  />
                </label>

                <label className="grid gap-2">
                  <span className="oak-label">Flat</span>
                  <input
                    className="oak-input"
                    value={form.flat}
                    onChange={(event) => setForm((prev) => ({ ...prev, flat: event.target.value }))}
                    required
                  />
                </label>
              </div>

              {form.invoice === "Yes" ? (
                <label className="grid gap-2">
                  <span className="oak-label">Invoice media</span>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-oak-borderStrong bg-oak-surface px-3.5 py-2.5 text-sm font-semibold text-oak-coffee">
                    <Upload size={16} />
                    <span>{form.invoiceMedia?.name ?? "Upload image or PDF"}</span>
                    <input
                      className="hidden"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, invoiceMedia: event.target.files?.[0] ?? null }))
                      }
                    />
                  </label>
                </label>
              ) : null}

              {formError ? <p className="text-sm font-bold text-oak-danger">{formError}</p> : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  className="oak-button-secondary"
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
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
          <article className="w-full max-w-md rounded-2xl border border-oak-border bg-white shadow-oakLg">
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">Cashflow</p>
                <h2 className="text-xl font-extrabold text-oak-coffee">Send report</h2>
              </div>
              <button
                className="grid size-9 place-items-center rounded-lg border border-oak-border"
                type="button"
                onClick={() => setIsReportOpen(false)}
                disabled={sendingReport}
              >
                <X size={17} />
              </button>
            </header>

            <form className="grid gap-4 p-6" onSubmit={handleSendReport}>
              <label className="grid gap-2">
                <span className="oak-label">Email</span>
                <input
                  className="oak-input"
                  type="email"
                  placeholder="name@example.com"
                  value={reportForm.email}
                  onChange={(event) => setReportForm({ email: event.target.value })}
                  required
                />
              </label>

              <div className="rounded-xl bg-oak-panel p-4 text-sm font-semibold text-black/60">
                Report period: {month}
                {search.trim() ? ` | Filter: ${search.trim()}` : ""}
              </div>

              {reportError ? <p className="text-sm font-bold text-oak-danger">{reportError}</p> : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  className="oak-button-secondary"
                  type="button"
                  onClick={() => setIsReportOpen(false)}
                  disabled={sendingReport}
                >
                  Cancel
                </button>
                <button className="oak-button-primary" type="submit" disabled={sendingReport}>
                  {sendingReport ? "Sending..." : "Send report"}
                </button>
              </div>
            </form>
          </article>
        </div>
      ) : null}

      {preview ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
          <article className="w-full max-w-4xl rounded-2xl border border-oak-border bg-white shadow-oakLg">
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">Invoice media</p>
                <h2 className="text-lg font-extrabold text-oak-coffee">{preview.fileName}</h2>
              </div>
              <button className="grid size-9 place-items-center rounded-lg border border-oak-border" type="button" onClick={closePreview}>
                <X size={17} />
              </button>
            </header>

            <div className="max-h-[70dvh] overflow-auto p-4">
              {preview.contentType.startsWith("image/") ? (
                <img alt="Invoice preview" className="mx-auto max-h-[60dvh] rounded-lg border border-oak-border" src={preview.url} />
              ) : (
                <iframe className="h-[60dvh] w-full rounded-lg border border-oak-border" src={preview.url} title="Invoice preview" />
              )}
            </div>

            <footer className="flex justify-end gap-3 border-t border-oak-border px-6 py-4">
              <button className="oak-button-secondary" type="button" onClick={closePreview}>
                Close
              </button>
              <button className="oak-button-primary" type="button" onClick={() => window.open(preview.url, "_blank", "noopener,noreferrer")}>
                Open in new tab
              </button>
            </footer>
          </article>
        </div>
      ) : null}
    </DashboardShell>
  );
}
