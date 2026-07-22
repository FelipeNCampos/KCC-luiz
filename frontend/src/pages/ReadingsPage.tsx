import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { DashboardShell } from "../components/DashboardShell";
import { UtilityReading, oakhillService } from "../services/oakhill";

const FLATS = ["50", "51", "52"] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "short" }).format(new Date(`${value}T00:00:00`));
}

function comparisonClass(value: number | null) {
  if (value === null) return "bg-oak-panel text-black/55";
  if (value <= 0) return "bg-emerald-100 text-emerald-950";
  if (value > 20) return "bg-red-200 text-red-950";
  return "bg-amber-100 text-amber-950";
}

function formatPercent(value: number | null) {
  return value === null ? "-" : `${value.toFixed(2)}%`;
}

export function ReadingsPage() {
  const [selectedFlat, setSelectedFlat] = useState<(typeof FLATS)[number]>("50");
  const [readings, setReadings] = useState<UtilityReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void oakhillService.readings(selectedFlat)
      .then((response) => { if (active) setReadings(response.data); })
      .catch(() => { if (active) { setReadings([]); setError("Unable to load readings."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedFlat]);

  return (
    <DashboardShell title="Buildings - Readings" subtitle="Energy and gas consumption by flat" rightSlot={
      <Link className="oak-button-primary" to="/readings/new"><Plus size={16} />Add reading</Link>
    }>
      <section className="oak-card p-5">
        <p className="oak-label">Select a flat</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {FLATS.map((flat) => (
            <button aria-pressed={selectedFlat === flat} className={`rounded-xl px-5 py-2.5 text-sm font-extrabold ${selectedFlat === flat ? "bg-oak-coffee text-white shadow-oak" : "bg-oak-panel text-oak-coffee hover:bg-oak-border"}`} key={flat} type="button" onClick={() => setSelectedFlat(flat)}>Flat {flat}</button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-emerald-700 text-white shadow-oak">
        <div className="grid min-h-28 grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-5 text-center">
          <button aria-label="Previous flat" className="grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25" type="button" onClick={() => setSelectedFlat(FLATS[(FLATS.indexOf(selectedFlat) + FLATS.length - 1) % FLATS.length])}><ArrowLeft size={20} /></button>
          <div><h2 className="text-2xl font-extrabold">Flat {selectedFlat}</h2><p className="mt-1 text-sm font-semibold text-white/85">Energy and gas readings</p></div>
          <button aria-label="Next flat" className="grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25" type="button" onClick={() => setSelectedFlat(FLATS[(FLATS.indexOf(selectedFlat) + 1) % FLATS.length])}><ArrowRight size={20} /></button>
        </div>
      </section>

      <section className="oak-card overflow-x-auto">
        {error ? <p className="m-4 rounded-xl bg-oak-dangerBg p-3 text-sm font-bold text-oak-danger">{error}</p> : null}
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-oak-panel text-oak-muted">
            <tr><th className="p-3">Days</th><th className="p-3">Date</th><th className="p-3">Energy</th><th className="p-3 text-right italic">used</th><th className="p-3 text-right">%</th><th className="p-3">Gas</th><th className="p-3 text-right italic">used</th><th className="p-3 text-right">%</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td className="p-5 font-bold text-black/60" colSpan={8}>Loading readings...</td></tr> : null}
            {!loading && readings.length === 0 ? <tr><td className="p-5 font-bold text-black/60" colSpan={8}>No readings for Flat {selectedFlat}.</td></tr> : null}
            {readings.map((reading) => (
              <tr className="border-t border-oak-border" key={reading.id}>
                <td className="p-3">{reading.days ?? "-"}</td><td className="p-3">{formatDate(reading.reading_date)}</td><td className="p-3">{reading.energy}</td><td className="p-3 text-right">{reading.energy_used ?? "-"}</td><td className={`p-3 text-right font-bold ${comparisonClass(reading.energy_change_percent)}`}>{formatPercent(reading.energy_change_percent)}</td><td className="p-3">{reading.gas}</td><td className="p-3 text-right">{reading.gas_used ?? "-"}</td><td className={`p-3 text-right font-bold ${comparisonClass(reading.gas_change_percent)}`}>{formatPercent(reading.gas_change_percent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </DashboardShell>
  );
}

type ReadingForm = Record<(typeof FLATS)[number], { energy: string; gas: string }>;

function emptyReadingForm(): ReadingForm {
  return { "50": { energy: "", gas: "" }, "51": { energy: "", gas: "" }, "52": { energy: "", gas: "" } };
}

export function ReadingsFormPage() {
  const navigate = useNavigate();
  const [readingDate, setReadingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState<ReadingForm>(emptyReadingForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateReading(flat: (typeof FLATS)[number], field: "energy" | "gas", value: string) {
    setForm((current) => ({ ...current, [flat]: { ...current[flat], [field]: value } }));
  }

  async function saveReadings(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await oakhillService.saveReadings({
        reading_date: readingDate,
        readings: FLATS.map((flat) => ({ flat, energy: Number(form[flat].energy), gas: Number(form[flat].gas) })),
      });
      navigate("/readings");
    } catch {
      setError("Unable to save readings. Check that this date was not already entered.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell title="Add readings" subtitle="Record energy and gas meters for all flats">
      <form className="oak-card grid gap-6 p-5" onSubmit={(event) => void saveReadings(event)}>
        <div className="flex flex-col gap-4 border-b border-oak-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <label className="grid gap-2 sm:w-56"><span className="oak-label">Reading date</span><input className="oak-input" type="date" value={readingDate} onChange={(event) => setReadingDate(event.target.value)} required /></label>
          <Link className="oak-button-secondary" to="/readings">Cancel</Link>
        </div>
        {error ? <p className="rounded-xl bg-oak-dangerBg p-3 text-sm font-bold text-oak-danger">{error}</p> : null}
        <div className="grid gap-4 lg:grid-cols-3">
          {FLATS.map((flat) => <section className="rounded-2xl border border-oak-border p-4" key={flat}>
            <h2 className="text-lg font-extrabold text-oak-coffee">Flat {flat}</h2>
            <div className="mt-4 grid gap-4"><label className="grid gap-2"><span className="oak-label">Energy</span><input aria-label={`Flat ${flat} energy`} className="oak-input" type="number" min="0" inputMode="numeric" value={form[flat].energy} onChange={(event) => updateReading(flat, "energy", event.target.value)} required /></label><label className="grid gap-2"><span className="oak-label">Gas</span><input aria-label={`Flat ${flat} gas`} className="oak-input" type="number" min="0" inputMode="numeric" value={form[flat].gas} onChange={(event) => updateReading(flat, "gas", event.target.value)} required /></label></div>
          </section>)}
        </div>
        <div className="flex justify-end"><button className="oak-button-primary" disabled={saving} type="submit">{saving ? "Saving..." : "Save readings"}</button></div>
      </form>
    </DashboardShell>
  );
}
