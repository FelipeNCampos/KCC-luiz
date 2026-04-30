import { Navigate, Route, Routes } from "react-router-dom";
import { ReactNode } from "react";

import { AdminOnlyRoute } from "../components/AdminOnlyRoute";
import { AdminRoute } from "../components/AdminRoute";
import { PrivateRoute } from "../components/PrivateRoute";
import { TasksRoute } from "../components/TasksRoute";
import { useAuth } from "../hooks/useAuth";
import { CashFlowPage } from "../pages/CashFlowPage";
import { CleanerAccessPage } from "../pages/CleanerAccessPage";
import { CleanerPage } from "../pages/CleanerPage";
import { ContractorAccessPage } from "../pages/ContractorAccessPage";
import { CaretakerPage } from "../pages/CaretakerPage";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { QrCodesPage } from "../pages/QrCodesPage";
import { RegisterPage } from "../pages/RegisterPage";
import { TasksPage } from "../pages/TasksPage";
import { UsersPage } from "../pages/UsersPage";
import { canAccessOakHill, canAccessOverview, canAccessTasks } from "../utils/permissions";

function HomeRoute() {
  const { user } = useAuth();

  if (canAccessOverview(user)) {
    return <DashboardPage />;
  }

  if (canAccessTasks(user)) {
    return <Navigate to="/tasks" replace />;
  }

  return <Navigate to="/login" replace />;
}

function OakHillRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!canAccessOakHill(user)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/cleaner-access" element={<CleanerAccessPage />} />
      <Route path="/contractor-access" element={<ContractorAccessPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <HomeRoute />
          </PrivateRoute>
        }
      />
      <Route
        path="/cash-flow"
        element={
          <AdminRoute>
            <CashFlowPage />
          </AdminRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <TasksRoute>
            <TasksPage />
          </TasksRoute>
        }
      />
      <Route
        path="/qr-codes"
        element={
          <PrivateRoute>
            <OakHillRoute>
              <QrCodesPage />
            </OakHillRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/cleaner"
        element={
          <PrivateRoute>
            <OakHillRoute>
              <CleanerPage />
            </OakHillRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/caretaker"
        element={
          <PrivateRoute>
            <OakHillRoute>
              <CaretakerPage />
            </OakHillRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/users"
        element={
          <AdminOnlyRoute>
            <UsersPage />
          </AdminOnlyRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
