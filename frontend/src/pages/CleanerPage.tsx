import { FormEvent, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, FileText, Search, Settings2, X } from "lucide-react";

import { DashboardShell } from "../components/DashboardShell";
import { InvoiceModal } from "../components/InvoiceModal";
import { Acess, Building, Funcionario, oakhillService } from "../services/oakhill";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "short" }).format(new Date(value));
}

function formatTime(value?: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "-";
}

function minutesBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff < 0 || diff >= 24 * 60 * 60 * 1000) return null;
  return Math.round(diff / 60000);
}

function formatMinutes(minutes: number | null) {
  if (minutes === null) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

type Pair = { key: string; building_id: string; in?: Acess; out?: Acess };
const GOAL_KEY_PREFIX = "oakhill-cleaner-monthly-goal-hours-";
const WEEKLY_GOAL_KEY_PREFIX = "oakhill-cleaner-weekly-goal-hours-";

function monthlyGoalKey(month: string) {
  return `${GOAL_KEY_PREFIX}${month}`;
}

function weeklyGoalKey(month: string) {
  return `${WEEKLY_GOAL_KEY_PREFIX}${month}`;
}

function monthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function startOfWeek(value = new Date()) {
  const date = new Date(value);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function pairHours(pair: Pair) {
  return (minutesBetween(pair.in?.data, pair.out?.data) ?? 0) / 60;
}

function formatHours(value: number) {
  return `${value.toFixed(1)}h`;
}

function timeInputValue(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function withSelectedTime(source: string, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(source);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function StatCard({ title, subtitle, value }: { title: string; subtitle: string; value: number }) {
  return (
    <article className="oak-card p-5">
      <p className="oak-label">{title}</p>
      <p className="mt-2 text-sm font-bold text-black/60">{subtitle}</p>
      <p className="mt-3 text-3xl font-extrabold text-oak-coffee">{formatHours(value)}</p>
    </article>
  );
}

function ProgressCard({
  title,
  subtitle,
  currentHours,
  targetHours
}: {
  title: string;
  subtitle: string;
  currentHours: number;
  targetHours: number;
}) {
  const progress = targetHours > 0 ? (currentHours / targetHours) * 100 : 0;
  const barWidth = targetHours > 0 ? Math.max(4, Math.min(100, progress)) : 0;
  return (
    <article className="oak-card p-5">
      <div className="flex items-center gap-4">
        <div className="min-w-0 shrink-0">
          <p className="oak-label">{title}</p>
          <p className="text-sm font-bold text-black/60">{subtitle}</p>
        </div>
        <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-oak-panel">
          <div className="h-full rounded-full bg-oak-taupe" style={{ width: `${barWidth}%` }} />
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-extrabold text-oak-coffee">{formatHours(currentHours)}</p>
          <p className="text-xs font-bold text-black/50">{targetHours > 0 ? `${formatHours(targetHours)} goal` : "No goal set"}</p>
        </div>
      </div>
    </article>
  );
}


export function CleanerPage() {
  const initialMonth = monthValue();
  const [month, setMonth] = useState(initialMonth);
  const [search, setSearch] = useState("");
  const [goal, setGoal] = useState(() => Number(localStorage.getItem(monthlyGoalKey(initialMonth)) ?? 0));
  const [weeklyGoal, setWeeklyGoal] = useState(() => Number(localStorage.getItem(weeklyGoalKey(initialMonth)) ?? 0));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [access, setAccess] = useState<Acess[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [outPair, setOutPair] = useState<Pair | null>(null);
  const [detailPair, setDetailPair] = useState<Pair | null>(null);
  const [outTime, setOutTime] = useState("");
  const [savingOut, setSavingOut] = useState(false);

  async function reload() {
    const [buildingResponse, accessResponse, funcionarioResponse] = await Promise.all([
      oakhillService.buildings(),
      oakhillService.listAccess(),
      oakhillService.funcionarios()
    ]);
    setBuildings(buildingResponse.data);
    setAccess(accessResponse.data);
    setFuncionarios(funcionarioResponse.data);
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
        setIsInvoiceOpen(false);
        setOutPair(null);
        setDetailPair(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setGoal(Number(localStorage.getItem(monthlyGoalKey(month)) ?? 0));
    setWeeklyGoal(Number(localStorage.getItem(weeklyGoalKey(month)) ?? 0));
  }, [month]);

  const buildingById = useMemo(() => new Map(buildings.map((item) => [item.id, item.nome])), [buildings]);
  const funcionarioById = useMemo(() => new Map(funcionarios.map((item) => [item.id, item])), [funcionarios]);

  const pairs = useMemo(() => {
    const rows = [...access]
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
    const result: Pair[] = [];
    let open: Acess | undefined;
    rows.forEach((row) => {
      if (row.operacao === 0) {
        if (open) result.push({ key: open.id, building_id: open.building_id, in: open });
        open = row;
      } else if (open) {
        result.push({ key: `${open.id}-${row.id}`, building_id: open.building_id, in: open, out: row });
        open = undefined;
      } else {
        result.push({ key: row.id, building_id: row.building_id, out: row });
      }
    });
    if (open) result.push({ key: open.id, building_id: open.building_id, in: open });
    return result.reverse();
  }, [access]);

  const filteredPairs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return pairs.filter((pair) => {
      const recordDate = pair.in?.data ?? pair.out?.data ?? "";
      if (!recordDate.startsWith(month)) return false;
      if (!query) return true;

      const buildingName = buildingById.get(pair.building_id) ?? pair.building_id;
      const searchable = [
        buildingName,
        formatDate(recordDate),
        formatTime(pair.in?.data),
        formatTime(pair.out?.data),
        formatMinutes(minutesBetween(pair.in?.data, pair.out?.data)),
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [buildingById, month, pairs, search]);

  const analytics = useMemo(() => {
    const weekStart = startOfWeek();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    let monthHours = 0;
    let weekHours = 0;
    filteredPairs.forEach((pair) => {
      const hours = pairHours(pair);
      monthHours += hours;
      const sourceDate = new Date(pair.in?.data ?? pair.out?.data ?? "");
      if (sourceDate >= weekStart && sourceDate < weekEnd) weekHours += hours;
    });
    return {
      monthHours,
      weekHours,
    };
  }, [filteredPairs]);

  function saveSettings(event: FormEvent) {
    event.preventDefault();
    localStorage.setItem(monthlyGoalKey(month), String(goal));
    localStorage.setItem(weeklyGoalKey(month), String(weeklyGoal));
    setIsSettingsOpen(false);
  }

  async function deletePair(pair: Pair) {
    if (!window.confirm("Delete this cleaner record?")) return;
    if (pair.in) await oakhillService.deleteAccess(pair.in.id);
    if (pair.out) await oakhillService.deleteAccess(pair.out.id);
    await reload();
  }

  function openOutModal(pair: Pair) {
    setFeedback(null);
    setOutPair(pair);
    setOutTime(timeInputValue());
  }

  async function saveOut(event: FormEvent) {
    event.preventDefault();
    if (!outPair?.in || savingOut) return;

    setSavingOut(true);
    setFeedback(null);
    try {
      await oakhillService.timeOutAccess(outPair.in.id, { data: withSelectedTime(outPair.in.data, outTime) });
      setFeedback("Time out saved successfully.");
      setOutPair(null);
      await reload();
    } catch {
      setFeedback("Unable to save time out.");
    } finally {
      setSavingOut(false);
    }
  }

  return (
    <DashboardShell title="Cleaner" subtitle="Cleaner hours, goals, records and invoices">
      <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
        <button className="oak-button-primary" type="button" onClick={() => setIsInvoiceOpen(true)}>
          <FileText size={16} />
          Emit invoice
        </button>
        <button className="oak-button-secondary" type="button" onClick={() => setIsSettingsOpen(true)}>
          <Settings2 size={16} />
          Settings
        </button>
      </div>

      <div className="hidden justify-end md:flex">
        <button className="oak-button-secondary" type="button" onClick={() => setIsSettingsOpen(true)}>
          <Settings2 size={16} />
          Settings
        </button>
      </div>
      {feedback ? <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{feedback}</div> : null}
      <section className="grid gap-4">
        <StatCard title="Hour Week" subtitle="Last week total" value={analytics.weekHours} />
        <div className="grid gap-4 xl:grid-cols-2">
          <ProgressCard title="Weekly goal" subtitle="Weekly progress" currentHours={analytics.weekHours} targetHours={weeklyGoal} />
          <ProgressCard title="Monthly goal" subtitle="Monthly progress" currentHours={analytics.monthHours} targetHours={goal} />
        </div>
      </section>
      <section className="oak-card overflow-x-auto">
        <div className="grid gap-4 border-b border-oak-border p-4 lg:grid-cols-[auto_minmax(160px,220px)_minmax(220px,1fr)_auto] lg:items-end">
          <h2 className="text-lg font-extrabold text-oak-coffee lg:pb-2">Records</h2>
          <label className="grid gap-2">
            <span className="oak-label">Month</span>
            <input className="oak-input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="oak-label">Search</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-oak-taupe" />
              <input
                className="oak-input pl-9"
                placeholder="Search by flat, date or time"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </span>
          </label>
          <button className="oak-button-primary hidden md:inline-flex" type="button" onClick={() => setIsInvoiceOpen(true)}>
            <FileText size={16} />
            Emit invoice
          </button>
        </div>
        <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-oak-panel text-oak-muted"><tr><th className="p-3">Date</th><th>Flat</th><th>Time IN</th><th>Time OUT</th><th>Used</th><th>Checklist</th><th>Actions</th></tr></thead>
            <tbody>{filteredPairs.map((pair) => {
              const used = minutesBetween(pair.in?.data, pair.out?.data);
              const checklistCount = pair.out?.checkout_checklist_items.length ?? 0;
              return (
                <tr className="cursor-pointer border-t border-oak-border hover:bg-oak-panel/70" key={pair.key} onClick={() => setDetailPair(pair)}>
                  <td className="p-3">{formatDate(pair.in?.data ?? pair.out?.data ?? "")}</td>
                  <td>{buildingById.get(pair.building_id) ?? pair.building_id}</td>
                  <td>{formatTime(pair.in?.data)}</td>
                  <td>
                    {pair.out ? formatTime(pair.out.data) : pair.in ? (
                      <button className="oak-button-secondary !min-h-9 !px-3 !py-1.5" type="button" onClick={(event) => { event.stopPropagation(); openOutModal(pair); }}>OUT</button>
                    ) : "-"}
                  </td>
                  <td>{formatMinutes(used)}</td>
                  <td>{checklistCount ? <span className="inline-flex items-center gap-2 font-bold text-emerald-800"><ClipboardCheck size={15} />{checklistCount}</span> : "-"}</td>
                  <td><button className="oak-button-secondary !min-h-9" type="button" onClick={(event) => { event.stopPropagation(); void deletePair(pair); }}>Delete</button></td>
                </tr>
              );
            })}</tbody>
          </table>
      </section>

      {detailPair ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
          <article className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-oak-border bg-white shadow-oakLg">
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">Cleaner record</p>
                <h2 className="text-lg font-extrabold text-oak-coffee">{buildingById.get(detailPair.building_id) ?? detailPair.building_id}</h2>
              </div>
              <button className="grid size-9 place-items-center rounded-lg border border-oak-border" type="button" onClick={() => setDetailPair(null)}>
                <X size={17} />
              </button>
            </header>
            <div className="grid min-h-0 gap-5 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
              <div className="grid content-start gap-3 text-sm font-bold text-black/65">
                {(() => {
                  const worker = funcionarioById.get(detailPair.in?.funcionario_id ?? detailPair.out?.funcionario_id ?? "");
                  return (
                    <>
                      <div className="rounded-xl bg-oak-panel p-4"><span className="oak-label">Name</span><p className="mt-1 text-oak-coffee">{worker?.nome ?? "-"}</p></div>
                      <div className="rounded-xl bg-oak-panel p-4"><span className="oak-label">Mobile</span><p className="mt-1 text-oak-coffee">{worker?.mobile ?? "-"}</p></div>
                    </>
                  );
                })()}
                <div className="rounded-xl bg-oak-panel p-4"><span className="oak-label">Flat</span><p className="mt-1 text-oak-coffee">{buildingById.get(detailPair.building_id) ?? detailPair.building_id}</p></div>
                <div className="rounded-xl bg-oak-panel p-4"><span className="oak-label">Date</span><p className="mt-1 text-oak-coffee">{formatDate(detailPair.in?.data ?? detailPair.out?.data ?? "")}</p></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-oak-panel p-4"><span className="oak-label">IN</span><p className="mt-1 text-oak-coffee">{formatTime(detailPair.in?.data)}</p></div>
                  <div className="rounded-xl bg-oak-panel p-4"><span className="oak-label">OUT</span><p className="mt-1 text-oak-coffee">{formatTime(detailPair.out?.data)}</p></div>
                  <div className="rounded-xl bg-oak-panel p-4"><span className="oak-label">Used</span><p className="mt-1 text-oak-coffee">{formatMinutes(minutesBetween(detailPair.in?.data, detailPair.out?.data))}</p></div>
                </div>
              </div>
              <div className="min-h-0 rounded-xl border border-oak-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="oak-label">Checklist</p>
                  <span className="text-xs font-extrabold text-black/50">{detailPair.out?.checkout_checklist_items.length ?? 0} items</span>
                </div>
                <div className="mt-4 grid max-h-[52dvh] gap-2 overflow-y-auto pr-1">
                  {detailPair.out?.checkout_checklist_items.length ? detailPair.out.checkout_checklist_items.map((item) => (
                    <div className="flex items-start gap-3 rounded-lg bg-oak-panel p-3 text-sm font-bold text-black/70" key={item.id}>
                      <input className="mt-0.5 size-5 shrink-0 accent-oak-taupe" type="checkbox" checked={item.checked} readOnly />
                      <span>{item.label}</span>
                    </div>
                  )) : <p className="rounded-lg bg-oak-panel p-3 text-sm font-bold text-black/60">No checkout checklist saved.</p>}
                </div>
              </div>
            </div>
          </article>
        </div>
      ) : null}

      {outPair?.in ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
          <article className="w-full max-w-md rounded-2xl border border-oak-border bg-white shadow-oakLg">
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">Cleaner</p>
                <h2 className="text-lg font-extrabold text-oak-coffee">Save OUT time</h2>
              </div>
              <button className="grid size-9 place-items-center rounded-lg border border-oak-border" type="button" onClick={() => setOutPair(null)}>
                <X size={17} />
              </button>
            </header>
            <form className="grid gap-4 p-6" onSubmit={(event) => void saveOut(event)}>
              <div className="rounded-xl bg-oak-panel p-4 text-sm font-bold text-black/65">
                IN: {formatDate(outPair.in.data)} {formatTime(outPair.in.data)}
              </div>
              <label className="grid gap-2">
                <span className="oak-label">OUT time</span>
                <input className="oak-input" type="time" value={outTime} onChange={(event) => setOutTime(event.target.value)} required />
              </label>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button className="oak-button-secondary" type="button" onClick={() => setOutPair(null)}>Cancel</button>
                <button className="oak-button-primary" disabled={savingOut} type="submit">{savingOut ? "Saving..." : "Save OUT"}</button>
              </div>
            </form>
          </article>
        </div>
      ) : null}

      {isSettingsOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
          <article className="w-full max-w-md rounded-2xl border border-oak-border bg-white shadow-oakLg">
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">Cleaner</p>
                <h2 className="text-lg font-extrabold text-oak-coffee">Settings</h2>
              </div>
              <button className="grid size-9 place-items-center rounded-lg border border-oak-border" type="button" onClick={() => setIsSettingsOpen(false)}>
                <X size={17} />
              </button>
            </header>
            <form className="grid gap-4 p-6" onSubmit={saveSettings}>
              <label className="grid gap-2"><span className="oak-label">Month</span><input className="oak-input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
              <label className="grid gap-2"><span className="oak-label">Monthly goal hours</span><input className="oak-input" type="number" min="0" step="0.5" value={goal} onChange={(event) => setGoal(Number(event.target.value))} /></label>
              <label className="grid gap-2"><span className="oak-label">Weekly goal hours</span><input className="oak-input" type="number" min="0" step="0.5" value={weeklyGoal} onChange={(event) => setWeeklyGoal(Number(event.target.value))} /></label>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button className="oak-button-secondary" type="button" onClick={() => setIsSettingsOpen(false)}>Cancel</button>
                <button className="oak-button-primary" type="submit">Save settings</button>
              </div>
            </form>
          </article>
        </div>
      ) : null}

      {isInvoiceOpen ? (
        <InvoiceModal
          open={isInvoiceOpen}
          sourceLabel="Cleaner"
          defaultDescription="Cleaner service invoice"
          onClose={() => setIsInvoiceOpen(false)}
          onCreated={(message) => setFeedback(message)}
        />
      ) : null}
    </DashboardShell>
  );
}
