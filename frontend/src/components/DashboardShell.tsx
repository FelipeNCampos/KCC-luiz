import { ReactNode } from "react";
import { Building2 } from "lucide-react";

import { SidebarMenu } from "./SidebarMenu";

type DashboardShellProps = {
  title: string;
  subtitle: string;
  rightSlot?: ReactNode;
  children: ReactNode;
};

export function DashboardShell({ title, subtitle, rightSlot, children }: DashboardShellProps) {
  return (
    <div className="min-h-[100dvh] bg-oak-page text-oak-coffee">
      <div className="grid min-h-[100dvh] lg:grid-cols-[280px_minmax(0,1fr)]">
        <SidebarMenu />

        <div className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-oak-border bg-oak-page/95 backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:px-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-11 place-items-center rounded-xl border border-oak-border bg-white text-oak-coffee lg:hidden">
                  <Building2 size={21} />
                </div>
                <div className="min-w-0">
                  <p className="oak-label">Painel administrativo</p>
                  <h1 className="truncate text-2xl font-extrabold text-oak-coffee sm:text-3xl">{title}</h1>
                  <p className="mt-1 text-sm font-semibold text-black/55">{subtitle}</p>
                </div>
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:w-auto">{rightSlot}</div>
            </div>
          </header>

          <main className="p-3 sm:p-6 md:p-8">
            <div className="mx-auto grid w-full min-w-0 max-w-7xl gap-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
