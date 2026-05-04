import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { ContractorVisit, oakhillService } from "../services/oakhill";
import { closePublicPage } from "../utils/closePublicPage";

const FLATS = ["50", "51", "52"];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function ContractorAccessPage() {
  const condominioId = new URLSearchParams(window.location.search).get("condominioId") ?? "";
  const [mode, setMode] = useState<"in" | "out">("in");
  const [openVisits, setOpenVisits] = useState<ContractorVisit[]>([]);
  const [form, setForm] = useState({ name: "", company: "", building_id: "", job_description: "", mobile: "" });
  const [visitId, setVisitId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ mode: "in" | "out"; doorCode?: string | null; building?: string } | null>(null);

  useEffect(() => {
    if (mode !== "out") return;
    oakhillService.contractorOpen(condominioId || undefined).then((response) => setOpenVisits(response.data)).catch(() => setError("Unable to load open visits."));
  }, [condominioId, mode]);

  const selectedVisit = openVisits.find((item) => item.id === visitId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === "in") {
        const response = await oakhillService.contractorCheckIn({ condominio_id: condominioId || undefined, ...form });
        setConfirmed({ mode: "in", doorCode: response.door_code, building: response.building_name });
        setForm({ name: "", company: "", building_id: "", job_description: "", mobile: "" });
      } else {
        await oakhillService.contractorCheckOut({ condominio_id: condominioId || undefined, visit_id: visitId });
        setConfirmed({ mode: "out" });
      }
    } catch (requestError) {
      const detail = (requestError as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(detail ?? "Unable to confirm record.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh bg-oak-surface p-4">
      <section className="mx-auto max-w-xl py-8">
        <form className="rounded-2xl border border-oak-border bg-white p-6 shadow-oakLg" onSubmit={(event) => void submit(event)}>
          <p className="oak-label">OakHill Park</p>
          <h1 className="mt-2 text-3xl font-extrabold text-oak-coffee">Contractor access</h1>
          <div className="mt-5 grid grid-cols-2 rounded-xl bg-oak-panel p-1">
            <button className={`rounded-lg py-3 font-extrabold ${mode === "in" ? "bg-white text-oak-coffee shadow-oak" : "text-oak-muted"}`} type="button" onClick={() => setMode("in")}>IN</button>
            <button className={`rounded-lg py-3 font-extrabold ${mode === "out" ? "bg-white text-oak-coffee shadow-oak" : "text-oak-muted"}`} type="button" onClick={() => setMode("out")}>OUT</button>
          </div>

          {mode === "in" ? (
            <div className="mt-5 grid gap-4">
              {(["name", "company", "job_description", "mobile"] as const).map((field) => (
                <label className="grid gap-2" key={field}>
                  <span className="oak-label">{field.replace("_", " ")}</span>
                  <input className="oak-input" value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} required />
                </label>
              ))}
              <label className="grid gap-2">
                <span className="oak-label">Flat</span>
                <select className="oak-input" value={form.building_id} onChange={(event) => setForm((current) => ({ ...current, building_id: event.target.value }))} required>
                  <option value="">Select flat</option>
                  {FLATS.map((flat) => <option key={flat} value={flat}>Flat {flat}</option>)}
                </select>
              </label>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="oak-label">Mobile</span>
                <select className="oak-input" value={visitId} onChange={(event) => setVisitId(event.target.value)} required>
                  <option value="">Select mobile</option>
                  {openVisits.map((visit) => <option key={visit.id} value={visit.id}>{visit.mobile}</option>)}
                </select>
              </label>
              {selectedVisit ? (
                <div className="rounded-xl bg-oak-panel p-4 text-sm font-semibold text-black/65">
                  <p>{selectedVisit.name} | {selectedVisit.company}</p>
                  <p>{selectedVisit.building_name}</p>
                  <p>{selectedVisit.job_description}</p>
                  <p>Check-in: {formatDateTime(selectedVisit.in_at)}</p>
                </div>
              ) : null}
            </div>
          )}

          {error ? <p className="mt-4 rounded-xl bg-oak-dangerBg p-3 text-sm font-bold text-oak-danger">{error}</p> : null}
          <button className="oak-button-primary mt-6 min-h-14 w-full text-base" disabled={saving} type="submit">{saving ? "Confirming..." : "Confirm"}</button>
        </form>
      </section>
      {confirmed ? (
        <div className="fixed inset-0 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-oakLg">
            <CheckCircle2 className="mx-auto text-emerald-700" size={46} />
            <h2 className="mt-4 text-xl font-extrabold text-oak-coffee">Record confirmed</h2>
            {confirmed.doorCode ? (
              <div className="mt-4 rounded-xl bg-oak-panel p-4 text-left">
                <p className="oak-label">{confirmed.building}</p>
                {confirmed.doorCode.split("\n").map((line) => {
                  const [label, code] = line.includes(":") ? line.split(":", 2) : ["", line];
                  return <p className="mt-2 flex justify-between gap-3" key={line}><span>{label}</span><code className="font-mono font-bold">{code.trim()}</code></p>;
                })}
              </div>
            ) : null}
            <button className="oak-button-primary mt-5 w-full" type="button" onClick={closePublicPage}>OK</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
