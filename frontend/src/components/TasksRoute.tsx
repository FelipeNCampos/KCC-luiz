import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { canAccessTasks } from "../utils/permissions";

export function TasksRoute({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-oak-page p-4">
        <section className="w-full max-w-md rounded-2xl border border-oak-border bg-white p-8 shadow-oak" aria-busy="true">
          <div className="mb-4 h-8 animate-pulse rounded-lg bg-oak-panel" />
          <div className="mb-3 h-4 animate-pulse rounded-lg bg-oak-panel" />
          <div className="h-4 w-2/3 animate-pulse rounded-lg bg-oak-panel" />
        </section>
      </main>
    );
  }

  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!canAccessTasks(user)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
