import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AxiosError } from "axios";
import { ArrowRight, CircleDollarSign, PackagePlus, X } from "lucide-react";
import { Link } from "react-router-dom";

import { DashboardShell } from "../components/DashboardShell";
import { useAuth } from "../hooks/useAuth";
import { cashFlowService, CashFlowListResponse } from "../services/cashflow";
import { Acess, Building, ContractorVisit, oakhillService } from "../services/oakhill";
import { StockRequest, stockService } from "../services/stock";
import { canAccessOakHill } from "../utils/permissions";

type CleanerPair = { type: "cleaner"; key: string; building_id: string; in: Acess; out?: Acess };
type ContractorRow = { type: "contractor"; key: string; visit: ContractorVisit };
type AccessRow = CleanerPair | ContractorRow;
type OutTarget = AccessRow & { defaultTime: string };

function toMonthInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatCurrency(value: string | number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(parsed);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "short" }).format(new Date(value));
}

function formatTime(value?: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "-";
}

function minutesBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return diff > 0 ? Math.round(diff / 60000) : null;
}

function formatMinutes(minutes: number | null) {
  if (minutes === null) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function monthBounds(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(year, monthIndex - 1, 1);
  const end = new Date(year, monthIndex, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
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

export function DashboardPage() {
  const { user } = useAuth();
  const currentMonth = useMemo(() => toMonthInputValue(new Date()), []);
  const [data, setData] = useState<CashFlowListResponse | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [cleanerAccess, setCleanerAccess] = useState<Acess[]>([]);
  const [contractorRecords, setContractorRecords] = useState<ContractorVisit[]>([]);
  const [stockRequests, setStockRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [savingOut, setSavingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [outTarget, setOutTarget] = useState<OutTarget | null>(null);
  const [outTime, setOutTime] = useState("");

  const { start, end } = useMemo(() => monthBounds(currentMonth), [currentMonth]);

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true);
    setRecordsError(null);
    try {
      const [buildingResponse, cleanerResponse, contractorResponse] = await Promise.all([
        oakhillService.buildings(),
        oakhillService.listAccess(),
        oakhillService.contractorVisits({ date_from: start, date_to: end }),
      ]);
      setBuildings(buildingResponse.data);
      setCleanerAccess(cleanerResponse.data);
      setContractorRecords(contractorResponse.data);
    } catch {
      setRecordsError("Nao foi possivel carregar os registros.");
    } finally {
      setRecordsLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    cashFlowService
      .list({ month: currentMonth })
      .then((response) => {
        if (!active) return;
        setData(response);
      })
      .catch((requestError: AxiosError<{ detail?: string }>) => {
        if (!active) return;
        setError(requestError.response?.data?.detail ?? "Nao foi possivel carregar o saldo do mes.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentMonth]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (!canAccessOakHill(user)) return;
    let active = true;
    stockService
      .list({ status: "pending", limit: 5 })
      .then((response) => {
        if (!active) return;
        setStockRequests(response.data);
      })
      .catch(() => {
        if (!active) return;
        setStockRequests([]);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const buildingById = useMemo(() => new Map(buildings.map((item) => [item.id, item.nome])), [buildings]);

  const cleanerPairs = useMemo(() => {
    const rows = [...cleanerAccess].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
    const result: CleanerPair[] = [];
    const openByFuncionario = new Map<string, Acess>();

    rows.forEach((row) => {
      const open = openByFuncionario.get(row.funcionario_id);
      if (row.operacao === 0) {
        if (open) result.push({ type: "cleaner", key: open.id, building_id: open.building_id, in: open });
        openByFuncionario.set(row.funcionario_id, row);
        return;
      }

      if (open) {
        result.push({ type: "cleaner", key: `${open.id}-${row.id}`, building_id: open.building_id, in: open, out: row });
        openByFuncionario.delete(row.funcionario_id);
      }
    });

    openByFuncionario.forEach((open) => {
      result.push({ type: "cleaner", key: open.id, building_id: open.building_id, in: open });
    });

    return result.filter((pair) => pair.in.data.startsWith(currentMonth) || pair.out?.data.startsWith(currentMonth));
  }, [cleanerAccess, currentMonth]);

  const accessRows = useMemo<AccessRow[]>(() => {
    const contractorRows: ContractorRow[] = contractorRecords.map((visit) => ({ type: "contractor", key: visit.id, visit }));
    return [...cleanerPairs, ...contractorRows]
      .sort((a, b) => {
        const aDate = a.type === "cleaner" ? a.in.data : a.visit.in_at;
        const bDate = b.type === "cleaner" ? b.in.data : b.visit.in_at;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      })
      .slice(0, 20);
  }, [cleanerPairs, contractorRecords]);

  const currentBalance = useMemo(() => formatCurrency(data?.current_balance ?? 0), [data?.current_balance]);

  function openOutModal(row: AccessRow) {
    setRecordsError(null);
    setOutTarget({ ...row, defaultTime: timeInputValue() });
    setOutTime(timeInputValue());
  }

  async function saveOut(event: FormEvent) {
    event.preventDefault();
    if (!outTarget || savingOut) return;

    setSavingOut(true);
    setRecordsError(null);
    try {
      if (outTarget.type === "cleaner") {
        await oakhillService.timeOutAccess(outTarget.in.id, {
          data: withSelectedTime(outTarget.in.data, outTime),
        });
      } else {
        await oakhillService.contractorCheckOut({
          condominio_id: outTarget.visit.condominio_id,
          visit_id: outTarget.visit.id,
          out_at: withSelectedTime(outTarget.visit.in_at, outTime),
        });
      }
      setOutTarget(null);
      await loadRecords();
    } catch (requestError) {
      const detail = (requestError as AxiosError<{ detail?: string }>).response?.data?.detail;
      setRecordsError(detail ?? "Nao foi possivel salvar o OUT.");
    } finally {
      setSavingOut(false);
    }
  }

  return (
    <DashboardShell title="Overview" subtitle="Resumo rapido do mes">
      <section>
        <Link
          className="oak-card block p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-oak-taupe hover:shadow-oakLg active:translate-y-px"
          to="/cash-flow"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="oak-label">Saldo do mes</p>
              <p
                className={`mt-3 text-4xl font-extrabold ${
                  Number(data?.current_balance ?? 0) >= 0 ? "text-emerald-700" : "text-oak-danger"
                }`}
              >
                {loading ? "Carregando..." : currentBalance}
              </p>
            </div>
            <div className="grid size-11 place-items-center rounded-xl bg-oak-panel text-oak-taupe">
              <CircleDollarSign size={21} strokeWidth={2} />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[52ch] text-sm font-semibold leading-6 text-black/60">
              {error ?? `Clique para abrir o cashflow de ${data?.month ?? currentMonth}.`}
            </p>
            <span className="inline-flex items-center gap-2 text-sm font-extrabold text-oak-coffee">
              Abrir cashflow
              <ArrowRight size={16} strokeWidth={2.2} />
            </span>
          </div>
        </Link>
      </section>

      {canAccessOakHill(user) ? (
        <section className="w-full md:w-1/2">
          <Link
            className="oak-card block p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-oak-taupe hover:shadow-oakLg active:translate-y-px"
            to="/stock"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="oak-label">New requests</p>
                <h2 className="mt-2 text-xl font-extrabold text-oak-coffee">Stock</h2>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-oak-panel text-oak-taupe">
                <PackagePlus size={21} strokeWidth={2} />
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {stockRequests.length === 0 ? (
                <p className="rounded-xl bg-oak-panel p-3 text-sm font-bold text-black/60">No pending requests.</p>
              ) : (
                stockRequests.map((item) => (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-oak-panel p-3 text-sm" key={item.id}>
                    <span className="font-bold text-black/60">{formatDate(item.created_at)}</span>
                    <span className="min-w-0 flex-1 truncate text-right font-extrabold text-oak-coffee">{item.product_name}</span>
                  </div>
                ))
              )}
            </div>
          </Link>
        </section>
      ) : null}

      <section className="oak-card overflow-x-auto">
        <div className="border-b border-oak-border p-4">
          <h2 className="text-lg font-extrabold text-oak-coffee">Access records</h2>
          <p className="mt-1 text-sm font-semibold text-black/60">Cleaner e contractor deste mes.</p>
          {recordsError ? <p className="mt-3 rounded-xl bg-oak-dangerBg p-3 text-sm font-bold text-oak-danger">{recordsError}</p> : null}
        </div>
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-oak-panel text-oak-muted">
            <tr>
              <th className="p-3">Type</th>
              <th className="p-3">Date</th>
              <th className="p-3">Name / Flat</th>
              <th className="p-3">Description</th>
              <th className="p-3">IN</th>
              <th className="p-3">OUT</th>
              <th className="p-3 text-right">Used</th>
            </tr>
          </thead>
          <tbody>
            {recordsLoading ? (
              <tr><td className="p-4 font-bold text-black/60" colSpan={7}>Carregando registros...</td></tr>
            ) : null}
            {!recordsLoading && accessRows.length === 0 ? (
              <tr><td className="p-4 font-bold text-black/60" colSpan={7}>Nenhum registro encontrado.</td></tr>
            ) : null}
            {accessRows.map((row) => {
              const isCleaner = row.type === "cleaner";
              const inAt = isCleaner ? row.in.data : row.visit.in_at;
              const outAt = isCleaner ? row.out?.data : row.visit.out_at;
              const name = isCleaner ? (buildingById.get(row.building_id) ?? row.building_id) : row.visit.name;
              const description = isCleaner ? "Cleaner" : row.visit.job_description;
              return (
                <tr className="border-t border-oak-border" key={`${row.type}-${row.key}`}>
                  <td className="p-3 font-bold">{isCleaner ? "Cleaner" : "Contractor"}</td>
                  <td className="p-3 whitespace-nowrap">{formatDate(inAt)}</td>
                  <td className="p-3 whitespace-nowrap">{name}</td>
                  <td className="p-3 max-w-64 truncate">{description}</td>
                  <td className="p-3 whitespace-nowrap">{formatTime(inAt)}</td>
                  <td className="p-3 whitespace-nowrap">
                    {outAt ? (
                      formatTime(outAt)
                    ) : (
                      <button className="oak-button-secondary !min-h-9 !px-3 !py-1.5" type="button" onClick={() => openOutModal(row)}>
                        OUT
                      </button>
                    )}
                  </td>
                  <td className="p-3 text-right font-bold">{formatMinutes(minutesBetween(inAt, outAt))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {outTarget ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
          <article className="w-full max-w-md rounded-2xl border border-oak-border bg-white shadow-oakLg">
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">{outTarget.type === "cleaner" ? "Cleaner" : "Contractor"}</p>
                <h2 className="text-lg font-extrabold text-oak-coffee">Save OUT time</h2>
              </div>
              <button className="grid size-9 place-items-center rounded-lg border border-oak-border" type="button" onClick={() => setOutTarget(null)}>
                <X size={17} />
              </button>
            </header>
            <form className="grid gap-4 p-6" onSubmit={(event) => void saveOut(event)}>
              <div className="rounded-xl bg-oak-panel p-4 text-sm font-bold text-black/65">
                <p>IN: {formatDate(outTarget.type === "cleaner" ? outTarget.in.data : outTarget.visit.in_at)} {formatTime(outTarget.type === "cleaner" ? outTarget.in.data : outTarget.visit.in_at)}</p>
              </div>
              <label className="grid gap-2">
                <span className="oak-label">OUT time</span>
                <input className="oak-input" type="time" value={outTime || outTarget.defaultTime} onChange={(event) => setOutTime(event.target.value)} required />
              </label>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button className="oak-button-secondary" type="button" onClick={() => setOutTarget(null)}>Cancel</button>
                <button className="oak-button-primary" disabled={savingOut} type="submit">{savingOut ? "Saving..." : "Save OUT"}</button>
              </div>
            </form>
          </article>
        </div>
      ) : null}
    </DashboardShell>
  );
}
