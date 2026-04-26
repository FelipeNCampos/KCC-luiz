import { useEffect, useMemo, useState } from "react";
import { AxiosError } from "axios";
import { ArrowRight, CircleDollarSign } from "lucide-react";
import { Link } from "react-router-dom";

import { DashboardShell } from "../components/DashboardShell";
import { cashFlowService, CashFlowListResponse } from "../services/cashflow";

function toMonthInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatCurrency(value: string | number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(parsed);
}

export function DashboardPage() {
  const currentMonth = useMemo(() => toMonthInputValue(new Date()), []);
  const [data, setData] = useState<CashFlowListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const monthlyTotal = useMemo(() => formatCurrency(data?.monthly_total ?? 0), [data?.monthly_total]);
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
                  Number(data?.monthly_total ?? 0) >= 0 ? "text-emerald-700" : "text-oak-danger"
                }`}
              >
                {loading ? "Carregando..." : monthlyTotal}
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
    </DashboardShell>
  );
}
