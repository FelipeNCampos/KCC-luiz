import { FormEvent, useEffect, useMemo, useState } from "react";
import { FileText, Search, Settings2, X } from "lucide-react";

import { DashboardShell } from "../components/DashboardShell";
import { InvoiceModalContractor } from "../components/InvoiceModalContractor";
import { ContractorVisit, oakhillService } from "../services/oakhill";

const GOAL_KEY_PREFIX = "oakhill-contractor-monthly-goal-hours-";
const WEEKLY_GOAL_KEY_PREFIX = "oakhill-contractor-weekly-goal-hours-";

function monthlyGoalKey(month: string) {
  return `${GOAL_KEY_PREFIX}${month}`;
}

function weeklyGoalKey(month: string) {
  return `${WEEKLY_GOAL_KEY_PREFIX}${month}`;
}

function monthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthBounds(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(year, monthIndex - 1, 1);
  const end = new Date(year, monthIndex, 0);
  return { start: dateOnly(start), end: dateOnly(end) };
}

function startOfWeek(value = new Date()) {
  const date = new Date(value);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function hoursBetween(start: string, end?: string | null) {
  if (!end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return diff > 0 ? diff / 36e5 : 0;
}

function formatHours(value: number) {
  return `${value.toFixed(1)}h`;
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "short" }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeStyle: "short" }).format(new Date(value));
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

export function CaretakerPage() {
  const initialMonth = monthValue();
  const [month, setMonth] = useState(initialMonth);
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<ContractorVisit[]>([]);
  const [goal, setGoal] = useState(() => Number(localStorage.getItem(monthlyGoalKey(initialMonth)) ?? 0));
  const [weeklyGoal, setWeeklyGoal] = useState(() => Number(localStorage.getItem(weeklyGoalKey(initialMonth)) ?? 0));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [outTarget, setOutTarget] = useState<ContractorVisit | null>(null);
  const [outTime, setOutTime] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const { start, end } = monthBounds(month);

  useEffect(() => {
    oakhillService
      .contractorVisits({ date_from: start, date_to: end, search: search.trim() || undefined })
      .then((response) => setRecords(response.data))
      .catch(() => setRecords([]));
  }, [start, end, search]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
        setIsInvoiceOpen(false);
        setOutTarget(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setGoal(Number(localStorage.getItem(monthlyGoalKey(month)) ?? 0));
    setWeeklyGoal(Number(localStorage.getItem(weeklyGoalKey(month)) ?? 0));
  }, [month]);

  const analytics = useMemo(() => {
    const weekStart = startOfWeek();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    let monthHours = 0;
    let weekHours = 0;
    records.forEach((record) => {
      const hours = hoursBetween(record.in_at, record.out_at);
      monthHours += hours;
      const date = new Date(record.in_at);
      if (date >= weekStart && date < weekEnd) weekHours += hours;
    });
    return {
      monthHours,
      weekHours,
    };
  }, [records]);

  function saveSettings(event: FormEvent) {
    event.preventDefault();
    localStorage.setItem(monthlyGoalKey(month), String(goal));
    localStorage.setItem(weeklyGoalKey(month), String(weeklyGoal));
    setIsSettingsOpen(false);
  }

  function openOutModal(record: ContractorVisit) {
    setFeedback(null);
    setOutTarget(record);
    setOutTime(timeInputValue());
  }

  async function handleTimeOut(event: FormEvent) {
    event.preventDefault();
    if (!outTarget) return;
    if (checkingOutId) return;

    setCheckingOutId(outTarget.id);
    setFeedback(null);
    try {
      await oakhillService.contractorCheckOut({
        condominio_id: outTarget.condominio_id,
        visit_id: outTarget.id,
        out_at: withSelectedTime(outTarget.in_at, outTime),
      });
      setFeedback("Time out saved successfully.");
      setOutTarget(null);
      const response = await oakhillService.contractorVisits({ date_from: start, date_to: end, search: search.trim() || undefined });
      setRecords(response.data);
    } catch {
      setFeedback("Unable to save time out.");
    } finally {
      setCheckingOutId(null);
    }
  }

  return (
    <DashboardShell title="Contractor" subtitle="Contractor hours, goals and records">
      <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
        <button className="oak-button-primary" type="button" onClick={() => setIsInvoiceOpen(true)}>
          <FileText size={16} />
          Invoice
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

      <section className="oak-card overflow-x-auto px-2 sm:px-4">
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
                placeholder="Search by name, company, flat or job"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </span>
          </label>
          <button className="oak-button-primary hidden md:inline-flex" type="button" onClick={() => setIsInvoiceOpen(true)}>
            <FileText size={16} />
            Invoice
          </button>
        </div>
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="bg-oak-panel text-oak-muted">
            <tr>
              <th className="p-3 whitespace-nowrap">Date</th>
              <th className="p-3 whitespace-nowrap">Name</th>
              <th className="p-3 whitespace-nowrap">Company</th>
              <th className="p-3 whitespace-nowrap">Flat</th>
              <th className="p-3 whitespace-nowrap">Job</th>
              <th className="p-3 whitespace-nowrap">Time in</th>
              <th className="py-3 pl-3 pr-1 whitespace-nowrap">Time out</th>
              <th className="py-3 pl-1 pr-3 whitespace-nowrap text-right">Hours</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr className="border-t border-oak-border" key={record.id}>
                <td className="p-3 whitespace-nowrap">{formatDate(record.in_at)}</td>
                <td className="p-3 whitespace-nowrap">{record.name}</td>
                <td className="p-3 whitespace-nowrap">{record.company}</td>
                <td className="p-3 whitespace-nowrap">Flat {record.flat}</td>
                <td className="p-3 max-w-56 truncate">{record.job_description}</td>
                <td className="p-3 whitespace-nowrap">{formatTime(record.in_at)}</td>
                <td className="py-3 pl-3 pr-1 whitespace-nowrap">
                  {record.out_at ? (
                    formatTime(record.out_at)
                  ) : (
                    <button
                      className="oak-button-secondary !min-h-9 !px-3 !py-1.5"
                      type="button"
                      disabled={checkingOutId === record.id}
                      onClick={() => openOutModal(record)}
                    >
                      {checkingOutId === record.id ? "Saving..." : "OUT"}
                    </button>
                  )}
                </td>
                <td className="py-3 pl-1 pr-3 whitespace-nowrap text-right font-bold">{formatHours(hoursBetween(record.in_at, record.out_at))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {outTarget ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
          <article className="w-full max-w-md rounded-2xl border border-oak-border bg-white shadow-oakLg">
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">Contractor</p>
                <h2 className="text-lg font-extrabold text-oak-coffee">Save OUT time</h2>
              </div>
              <button className="grid size-9 place-items-center rounded-lg border border-oak-border" type="button" onClick={() => setOutTarget(null)}>
                <X size={17} />
              </button>
            </header>
            <form className="grid gap-4 p-6" onSubmit={(event) => void handleTimeOut(event)}>
              <div className="rounded-xl bg-oak-panel p-4 text-sm font-bold text-black/65">
                IN: {formatDate(outTarget.in_at)} {formatTime(outTarget.in_at)}
              </div>
              <label className="grid gap-2">
                <span className="oak-label">OUT time</span>
                <input className="oak-input" type="time" value={outTime} onChange={(event) => setOutTime(event.target.value)} required />
              </label>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button className="oak-button-secondary" type="button" onClick={() => setOutTarget(null)}>Cancel</button>
                <button className="oak-button-primary" disabled={checkingOutId === outTarget.id} type="submit">{checkingOutId === outTarget.id ? "Saving..." : "Save OUT"}</button>
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
                <p className="oak-label">Contractor</p>
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
        <InvoiceModalContractor
          open={isInvoiceOpen}
          sourceLabel="Contractor"
          defaultDescription="Contractor service invoice"
          onClose={() => setIsInvoiceOpen(false)}
          onCreated={(message) => setFeedback(message)}
        />
      ) : null}
    </DashboardShell>
  );
}
