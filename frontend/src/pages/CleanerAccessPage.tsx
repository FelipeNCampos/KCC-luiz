import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { oakhillService } from "../services/oakhill";

export function CleanerAccessPage() {
  const params = new URLSearchParams(window.location.search);
  const flat = params.get("flat") ?? params.get("buildingId") ?? "";
  const buildingName = flat ? `Flat ${flat.replace("Flat ", "")}` : "Flat";
  const requested = (params.get("op") ?? params.get("operation") ?? "").toLowerCase();
  const [operation, setOperation] = useState<0 | 1>(requested === "out" ? 1 : 0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const valid = ["50", "51", "52"].includes(flat.replace("Flat ", "")) && (!requested || requested === "in" || requested === "out");
  const label = operation === 0 ? "IN" : "OUT";

  useEffect(() => {
    if (!valid) {
      setLoading(false);
      return;
    }
    oakhillService
      .activeAccess(flat)
      .then((active) => {
        setOperation(active.has_open_session && active.building_id === flat ? 1 : 0);
      })
      .catch(() => setOperation(0))
      .finally(() => setLoading(false));
  }, [flat, valid]);

  async function confirm() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await oakhillService.createAccess({ operacao: operation, building_id: flat });
      setConfirmed(true);
      window.setTimeout(() => {
        window.close();
        window.location.href = "about:blank";
      }, 5000);
    } catch (requestError) {
      const detail = (requestError as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(detail ?? "Unable to confirm record.");
    } finally {
      setSaving(false);
    }
  }

  const title = useMemo(() => (valid ? `Cleaner ${label}` : "Invalid QR code"), [label, valid]);

  return (
    <main className="min-h-dvh bg-oak-surface p-4">
      <section className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-xl place-items-center">
        <article className="w-full rounded-2xl border border-oak-border bg-white p-6 shadow-oakLg">
          <p className="oak-label">OakHill Park</p>
          <h1 className="mt-2 text-3xl font-extrabold text-oak-coffee">{title}</h1>
          <div className="mt-5 rounded-xl bg-oak-panel p-4">
            <p className="oak-label">Flat</p>
            <p className="mt-1 text-xl font-extrabold text-oak-coffee">{buildingName}</p>
          </div>
          {!valid ? <p className="mt-4 rounded-xl bg-oak-dangerBg p-3 text-sm font-bold text-oak-danger">Invalid QR code</p> : null}
          {error ? <p className="mt-4 rounded-xl bg-oak-dangerBg p-3 text-sm font-bold text-oak-danger">{error}</p> : null}
          <button className="oak-button-primary mt-6 min-h-14 w-full text-base" disabled={!valid || loading || saving} type="button" onClick={() => void confirm()}>
            {saving ? "Confirming..." : loading ? "Checking..." : `Confirm ${label}`}
          </button>
        </article>
      </section>
      {confirmed ? (
        <div className="fixed inset-0 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-oakLg">
            <CheckCircle2 className="mx-auto text-emerald-700" size={46} />
            <h2 className="mt-4 text-xl font-extrabold text-oak-coffee">Record confirmed</h2>
          </div>
        </div>
      ) : null}
    </main>
  );
}
