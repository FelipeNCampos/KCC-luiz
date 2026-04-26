import { ReactNode } from "react";
import { Building2, ClipboardCheck, ShieldCheck } from "lucide-react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative isolate min-h-[100dvh] overflow-hidden bg-[#f3ece6] px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -left-28 top-8 h-72 w-72 rounded-full bg-[#d9c2b3]/40 blur-3xl" />
        <div className="absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-[#b79b89]/30 blur-3xl" />
      </div>

      <section className="relative z-10 mx-auto grid min-h-[calc(100dvh-3rem)] w-full max-w-7xl items-center gap-6 lg:grid-cols-[1.1fr_470px]">
        <aside className="hidden rounded-3xl border border-[#ddcdc1] bg-gradient-to-b from-[#f8f3ef] to-[#f2e9e2] p-10 shadow-[0_24px_80px_-32px_rgba(85,49,28,0.45)] lg:block">
          <div className="mb-10 flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-xl bg-white text-oak-coffee shadow-oak">
              <Building2 size={24} strokeWidth={2} />
            </div>
            <div>
              <p className="oak-label">OakHill Park</p>
              <h1 className="text-2xl font-extrabold text-oak-coffee">Administração residencial</h1>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[#8c7569]">Sistema interno</p>
            <h2 className="mt-3 text-balance text-4xl font-extrabold leading-tight tracking-[-0.02em] text-oak-coffee">
              Operação clara para portaria, gestão e acompanhamento do condomínio.
            </h2>
            <p className="mt-5 max-w-[52ch] text-base leading-7 text-black/65">
              Controle de acesso, cadastros e indicadores em uma interface quente, objetiva e
              preparada para rotinas administrativas.
            </p>
          </div>

          <div className="mt-10 grid gap-4">
            {[
              ["Sessões seguras", "JWT com renovação controlada", ShieldCheck],
              ["Fluxo operacional", "Telas diretas, sem ruído visual", ClipboardCheck],
            ].map(([title, description, Icon]) => (
              <div key={title as string} className="flex gap-3 rounded-2xl border border-[#dfd0c4] bg-white/90 p-4 backdrop-blur">
                <div className="grid size-10 place-items-center rounded-xl bg-oak-panel text-oak-taupe">
                  <Icon size={20} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="font-bold text-oak-coffee">{title as string}</h3>
                  <p className="text-sm text-black/60">{description as string}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="mx-auto w-full max-w-md rounded-3xl border border-[#e2d5cb] bg-[#fffdfa]/90 p-6 shadow-[0_24px_80px_-34px_rgba(85,49,28,0.5)] backdrop-blur-sm sm:p-8">
          <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
            <div className="grid size-11 place-items-center rounded-xl bg-oak-panel text-oak-coffee">
              <Building2 size={22} />
            </div>
            <div>
              <p className="oak-label">OakHill Park</p>
              <h1 className="text-lg font-extrabold text-oak-coffee">Administração</h1>
            </div>
          </div>
          {children}
        </section>
      </section>
    </main>
  );
}
