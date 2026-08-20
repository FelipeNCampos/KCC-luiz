import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { useParams } from "react-router-dom";

import { CashFlowPublicShare, cashFlowService } from "../services/cashflow";

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
                    <td className="px-4 py-3">{formatDate(row.record_date)}</td><td className={`px-4 py-3 text-right font-bold ${Number(row.amount) >= 0 ? "text-emerald-700" : "text-oak-danger"}`}>{formatCurrency(row.amount)}</td><td className="px-4 py-3">{row.description ?? "-"}</td><td className="px-4 py-3">{row.notes ?? "-"}</td><td className="px-4 py-3">{row.supplier ?? "-"}</td><td className="px-4 py-3">{row.flat ?? "-"}</td>
                    <td className="px-4 py-3">{row.invoice_media_url ? (row.invoice_media_mime?.startsWith("image/") ? <a href={cashFlowService.publicUrl(row.invoice_media_url)} target="_blank" rel="noreferrer"><img className="max-h-16 rounded border border-oak-border" src={cashFlowService.publicUrl(row.invoice_media_url)} alt={row.invoice_media_name ?? "Receipt"} /></a> : <a className="font-bold text-oak-coffee underline" href={cashFlowService.publicUrl(row.invoice_media_url)} target="_blank" rel="noreferrer">View receipt</a>) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
