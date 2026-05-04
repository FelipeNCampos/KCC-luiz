import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Image, Package, Search, Trash2, X } from "lucide-react";

import { DashboardShell } from "../components/DashboardShell";
import { StockRequest, StockRequestStatus, stockService } from "../services/stock";

const STATUS_LABEL: Record<StockRequestStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  archived: "Archived",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function statusClass(status: StockRequestStatus) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "archived") return "border-zinc-200 bg-zinc-50 text-zinc-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function StockPage() {
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StockRequestStatus | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [detailRequest, setDetailRequest] = useState<StockRequest | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const response = await stockService.list({
        search: search.trim() || undefined,
        status,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setRequests(response.data.filter((item) => item.status !== "archived"));
    } catch {
      setFeedback({ type: "error", message: "Unable to load stock requests." });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, search, status]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const pendingCount = useMemo(() => requests.filter((item) => item.status === "pending").length, [requests]);

  async function completeRequest(item: StockRequest) {
    if (savingId) return;
    setSavingId(item.id);
    setFeedback(null);
    try {
      await stockService.complete(item.id);
      setFeedback({ type: "success", message: "Request completed." });
      await loadRequests();
    } catch {
      setFeedback({ type: "error", message: "Unable to complete request." });
    } finally {
      setSavingId(null);
    }
  }

  async function archiveRequest(item: StockRequest) {
    if (savingId) return;
    setSavingId(item.id);
    setFeedback(null);
    try {
      await stockService.archive(item.id);
      setFeedback({ type: "success", message: "Request archived." });
      await loadRequests();
    } catch {
      setFeedback({ type: "error", message: "Unable to archive request." });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <DashboardShell title="Stock" subtitle="Stock replacement requests">
      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <article className="oak-card p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-oak-panel text-oak-coffee">
              <Package size={21} />
            </div>
            <div>
              <p className="oak-label">Requests</p>
              <h2 className="mt-1 text-xl font-extrabold text-oak-coffee">Stock replacement</h2>
              <p className="mt-1 text-sm font-semibold text-black/60">Review, complete or archive employee requests.</p>
            </div>
          </div>
        </article>
        <article className="oak-card p-5">
          <p className="oak-label">New requests</p>
          <p className="mt-2 text-4xl font-extrabold text-oak-coffee">{pendingCount}</p>
        </article>
      </section>

      <section className="oak-card overflow-hidden">
        <form className="grid gap-4 border-b border-oak-border p-4 lg:grid-cols-[minmax(220px,1fr)_160px_160px_180px_auto] lg:items-end" onSubmit={(event) => { event.preventDefault(); void loadRequests(); }}>
          <label className="grid gap-2">
            <span className="oak-label">Product search</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-oak-taupe" />
              <input className="oak-input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product" />
            </span>
          </label>
          <label className="grid gap-2">
            <span className="oak-label">From</span>
            <input className="oak-input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="grid gap-2">
            <span className="oak-label">To</span>
            <input className="oak-input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <label className="grid gap-2">
            <span className="oak-label">Status</span>
            <select className="oak-input" value={status} onChange={(event) => setStatus(event.target.value as StockRequestStatus | "")}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <button className="oak-button-primary" type="submit">Filter</button>
        </form>

        {feedback ? (
          <p className={`m-4 rounded-xl p-3 text-sm font-bold ${feedback.type === "success" ? "border border-emerald-300 bg-emerald-50 text-emerald-800" : "bg-oak-dangerBg text-oak-danger"}`}>
            {feedback.message}
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-oak-panel text-oak-muted">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Product</th>
                <th className="p-3 text-right">Quantity</th>
                <th className="p-3">Photo</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td className="p-4 font-bold text-black/60" colSpan={6}>Loading requests...</td></tr> : null}
              {!loading && requests.length === 0 ? <tr><td className="p-4 font-bold text-black/60" colSpan={6}>No stock requests found.</td></tr> : null}
              {requests.map((item) => (
                <tr className="cursor-pointer border-t border-oak-border hover:bg-oak-panel/70" key={item.id} onClick={() => setDetailRequest(item)}>
                  <td className="p-3 whitespace-nowrap">{formatDateTime(item.created_at)}</td>
                  <td className="p-3 font-extrabold text-oak-coffee">{item.product_name}</td>
                  <td className="p-3 text-right font-bold">{item.quantity}</td>
                  <td className="p-3">
                    {item.photo_data ? (
                      <span className="inline-flex items-center gap-2 font-bold text-oak-coffee">
                        <Image size={16} />
                        Photo
                      </span>
                    ) : "-"}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-extrabold ${statusClass(item.status)}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button className="oak-button-secondary !min-h-9 !px-3" disabled={savingId === item.id || item.status === "completed"} type="button" onClick={(event) => { event.stopPropagation(); void completeRequest(item); }}>
                        <CheckCircle2 size={16} />
                        Completed
                      </button>
                      <button className="oak-button-secondary !min-h-9 !px-3" disabled={savingId === item.id} type="button" onClick={(event) => { event.stopPropagation(); void archiveRequest(item); }}>
                        <Trash2 size={16} />
                        Delet
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {detailRequest ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
          <article className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-oak-border bg-white shadow-oakLg">
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">Stock request</p>
                <h2 className="text-lg font-extrabold text-oak-coffee">{detailRequest.product_name}</h2>
              </div>
              <button className="grid size-9 place-items-center rounded-lg border border-oak-border" type="button" onClick={() => setDetailRequest(null)}>
                <X size={17} />
              </button>
            </header>
            <div className="grid min-h-0 gap-5 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
              <div className="grid content-start gap-3 text-sm font-bold text-black/65">
                <div className="rounded-xl bg-oak-panel p-4"><span className="oak-label">ID</span><p className="mt-1 break-all text-oak-coffee">{detailRequest.id}</p></div>
                <div className="rounded-xl bg-oak-panel p-4"><span className="oak-label">Product name</span><p className="mt-1 text-oak-coffee">{detailRequest.product_name}</p></div>
                <div className="rounded-xl bg-oak-panel p-4"><span className="oak-label">Quantity</span><p className="mt-1 text-oak-coffee">{detailRequest.quantity}</p></div>
                <div className="rounded-xl bg-oak-panel p-4">
                  <span className="oak-label">Status</span>
                  <p className="mt-2">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-extrabold ${statusClass(detailRequest.status)}`}>
                      {STATUS_LABEL[detailRequest.status]}
                    </span>
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-oak-panel p-4"><span className="oak-label">Created</span><p className="mt-1 text-oak-coffee">{formatDateTime(detailRequest.created_at)}</p></div>
                  <div className="rounded-xl bg-oak-panel p-4"><span className="oak-label">Updated</span><p className="mt-1 text-oak-coffee">{formatDateTime(detailRequest.updated_at)}</p></div>
                </div>
                <div className="rounded-xl bg-oak-panel p-4"><span className="oak-label">Photo name</span><p className="mt-1 break-all text-oak-coffee">{detailRequest.photo_name ?? "-"}</p></div>
                <div className="rounded-xl bg-oak-panel p-4"><span className="oak-label">Condominio ID</span><p className="mt-1 break-all text-oak-coffee">{detailRequest.condominio_id}</p></div>
              </div>
              <div className="min-h-0 rounded-xl border border-oak-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="oak-label">Product photo</p>
                  {detailRequest.photo_data ? <a className="text-xs font-extrabold text-oak-coffee underline-offset-4 hover:underline" href={detailRequest.photo_data} target="_blank" rel="noreferrer">Open</a> : null}
                </div>
                <div className="mt-4 grid min-h-72 place-items-center rounded-xl bg-oak-panel p-3">
                  {detailRequest.photo_data ? (
                    <img className="max-h-[56dvh] w-full rounded-lg object-contain" alt={detailRequest.product_name} src={detailRequest.photo_data} />
                  ) : (
                    <p className="text-sm font-bold text-black/60">No photo attached.</p>
                  )}
                </div>
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </DashboardShell>
  );
}
