import { useEffect, useState } from "react";
import { Eye, Link2, X } from "lucide-react";
import { useParams } from "react-router-dom";

import { CashFlowPublicRow, CashFlowPublicShare, cashFlowService } from "../services/cashflow";

function formatCurrency(value: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value));
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}-${month}-${year}` : value;
}

export function CashFlowSharedPage() {
  const { token = "" } = useParams();
  const [data, setData] = useState<CashFlowPublicShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [notesViewer, setNotesViewer] = useState<CashFlowPublicRow | null>(null);

  useEffect(() => {
    let active = true;
    if (!token) {
      setLoading(false);
      return;
    }
    cashFlowService
      .getPublicShare(token)
      .then((response) => {
        if (active) setData(response);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!notesViewer) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotesViewer(null);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [notesViewer]);

  if (loading) {
    return <main className="grid min-h-dvh place-items-center bg-oak-panel text-sm font-bold text-oak-coffee">Loading shared cashflow...</main>;
  }

  if (!data) {
    return (
      <main className="grid min-h-dvh place-items-center bg-oak-panel p-6">
        <section className="oak-card max-w-md p-8 text-center">
          <Link2 className="mx-auto text-oak-taupe" size={32} />
          <h1 className="mt-4 text-2xl font-extrabold text-oak-coffee">Link unavailable</h1>
          <p className="mt-2 text-sm font-semibold text-black/60">This shared cashflow link is not available.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-oak-panel p-4 sm:p-8">
      <section className="mx-auto max-w-6xl">
        <header className="oak-card p-6">
          <p className="oak-label">Shared read-only cashflow</p>
          <h1 className="mt-1 text-2xl font-extrabold text-oak-coffee">Cashflow records</h1>
          <p className="mt-2 text-sm font-semibold text-black/60">{formatDate(data.date_from)} to {formatDate(data.date_to)}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-emerald-50 p-4"><p className="oak-label">Credits</p><p className="mt-1 text-xl font-extrabold text-emerald-700">{formatCurrency(data.credit_total)}</p></div>
            <div className="rounded-xl bg-red-50 p-4"><p className="oak-label">Debits</p><p className="mt-1 text-xl font-extrabold text-oak-danger">{formatCurrency(data.debit_total)}</p></div>
            <div className="rounded-xl bg-oak-surface p-4"><p className="oak-label">Net total</p><p className="mt-1 text-xl font-extrabold text-oak-coffee">{formatCurrency(data.net_total)}</p></div>
          </div>
        </header>

        <section className="oak-card mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-oak-panel text-[11px] uppercase text-oak-muted"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Notes</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Flat</th><th className="px-4 py-3">Receipt</th></tr></thead>
              <tbody className="divide-y divide-oak-border">
                {data.items.length === 0 ? <tr><td className="px-4 py-6 text-black/60" colSpan={7}>No records for this period.</td></tr> : null}
                {data.items.map((row, index) => (
                  <tr key={`${row.record_date}-${row.description}-${index}`}>
                    <td className="px-4 py-3">{formatDate(row.record_date)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${Number(row.amount) >= 0 ? "text-emerald-700" : "text-oak-danger"}`}>{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-3">{row.description ?? "-"}</td>
                    <td className="px-4 py-3">
                      {row.notes?.trim() ? (
                        <button
                          aria-label="View notes"
                          className="inline-flex items-center gap-1.5 whitespace-nowrap font-bold text-oak-coffee"
                          type="button"
                          onClick={() => setNotesViewer(row)}
                        >
                          <Eye className="shrink-0 text-[#e67a3a]" size={15} />
                          <span>View</span>
                        </button>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3">{row.supplier ?? "-"}</td>
                    <td className="px-4 py-3">{row.flat ?? "-"}</td>
                    <td className="px-4 py-3">
                      {row.invoice_media_url ? (
                        row.invoice_media_mime?.startsWith("image/") ? (
                          <a href={cashFlowService.publicUrl(row.invoice_media_url)} target="_blank" rel="noreferrer">
                            <img className="max-h-16 rounded border border-oak-border" src={cashFlowService.publicUrl(row.invoice_media_url)} alt={row.invoice_media_name ?? "Receipt"} />
                          </a>
                        ) : (
                          <a className="font-bold text-oak-coffee underline" href={cashFlowService.publicUrl(row.invoice_media_url)} target="_blank" rel="noreferrer">View receipt</a>
                        )
                      ) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {notesViewer ? (
          <div className="fixed inset-0 z-30 grid place-items-center bg-black/50 p-4">
            <article
              aria-labelledby="shared-cashflow-notes-title"
              aria-modal="true"
              className="w-full max-w-xl rounded-2xl border border-oak-border bg-white shadow-oakLg"
              role="dialog"
            >
              <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
                <h2 id="shared-cashflow-notes-title" className="text-lg font-extrabold text-oak-coffee">Notes</h2>
                <button
                  aria-label="Close notes"
                  className="grid size-9 place-items-center rounded-lg border border-oak-border"
                  type="button"
                  onClick={() => setNotesViewer(null)}
                >
                  <X size={17} />
                </button>
              </header>
              <p className="max-h-[60dvh] overflow-y-auto whitespace-pre-wrap break-words px-6 py-5 text-sm font-semibold leading-6 text-black/70">
                {notesViewer.notes}
              </p>
              <footer className="flex justify-end border-t border-oak-border px-6 py-4">
                <button className="oak-button-secondary" type="button" onClick={() => setNotesViewer(null)}>
                  Close
                </button>
              </footer>
            </article>
          </div>
        ) : null}
      </section>
    </main>
  );
}
