import { FormEvent, useEffect, useMemo, useState } from "react";
import { FileText, Settings2, X } from "lucide-react";

import { DashboardShell } from "../components/DashboardShell";
import { InvoiceModal } from "../components/InvoiceModal";
import { ContractorVisit, oakhillService } from "../services/oakhill";

const GOAL_KEY_PREFIX = "oakhill-caretaker-monthly-goal-hours-";
const WEEKLY_GOAL_KEY_PREFIX = "oakhill-caretaker-weekly-goal-hours-";

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
  const [records, setRecords] = useState<ContractorVisit[]>([]);
  const [goal, setGoal] = useState(() => Number(localStorage.getItem(monthlyGoalKey(initialMonth)) ?? 0));
  const [weeklyGoal, setWeeklyGoal] = useState(() => Number(localStorage.getItem(weeklyGoalKey(initialMonth)) ?? 0));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { start, end } = monthBounds(month);

  useEffect(() => {
    oakhillService
      .contractorVisits({ date_from: start, date_to: end })
      .then((response) => setRecords(response.data))
      .catch(() => setRecords([]));
  }, [start, end]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
        setIsInvoiceOpen(false);
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

  async function handleTimeOut(record: ContractorVisit) {
    if (checkingOutId) return;

    setCheckingOutId(record.id);
    setFeedback(null);
    try {
      await oakhillService.contractorCheckOut({ condominio_id: record.condominio_id, visit_id: record.id });
      setFeedback("Time out saved successfully.");
      const response = await oakhillService.contractorVisits({ date_from: start, date_to: end });
      setRecords(response.data);
    } catch {
      setFeedback("Unable to save time out.");
    } finally {
      setCheckingOutId(null);
    }
  }

  return (
    <DashboardShell title="Caretaker" subtitle="Caretaker hours, goals and records">
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

      <section className="oak-card overflow-x-auto px-2 sm:px-4">
        <div className="flex items-center justify-between gap-3 border-b border-oak-border p-4">
          <h2 className="text-lg font-extrabold text-oak-coffee">Records</h2>
          <button className="oak-button-primary hidden md:inline-flex" type="button" onClick={() => setIsInvoiceOpen(true)}>
            <FileText size={16} />
            Emit invoice
          </button>
        </div>
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="bg-oak-panel text-oak-muted">
            <tr>
              <th className="p-3 whitespace-nowrap">Date</th>
              <th className="p-3 whitespace-nowrap">Name</th>
              <th className="p-3 whitespace-nowrap">Company</th>
              <th className="p-3 whitespace-nowrap">Building</th>
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
                <td className="p-3 whitespace-nowrap">{record.building_name}</td>
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
                      onClick={() => void handleTimeOut(record)}
                    >
                      {checkingOutId === record.id ? "Saving..." : "Time out"}
                    </button>
                  )}
                </td>
                <td className="py-3 pl-1 pr-3 whitespace-nowrap text-right font-bold">{formatHours(hoursBetween(record.in_at, record.out_at))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {isSettingsOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
          <article className="w-full max-w-md rounded-2xl border border-oak-border bg-white shadow-oakLg">
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">Caretaker</p>
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
          sourceLabel="Caretaker"
          defaultDescription="Caretaker service invoice"
          onClose={() => setIsInvoiceOpen(false)}
          onCreated={(message) => setFeedback(message)}
        />
      ) : null}
    </DashboardShell>
  );
}
