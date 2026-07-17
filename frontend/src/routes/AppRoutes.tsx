import { Navigate, Route, Routes } from "react-router-dom";
import { ReactNode } from "react";

import { AdminOnlyRoute } from "../components/AdminOnlyRoute";
import { AdminRoute } from "../components/AdminRoute";
import { PrivateRoute } from "../components/PrivateRoute";
import { TasksRoute } from "../components/TasksRoute";
import { useAuth } from "../hooks/useAuth";
import { CashFlowPage } from "../pages/CashFlowPage";
import { CashFlowSharedPage } from "../pages/CashFlowSharedPage";
import { ChecklistPage } from "../pages/ChecklistPage";
import { CleanerAccessPage } from "../pages/CleanerAccessPage";
import { CleanerPage } from "../pages/CleanerPage";
import { ContractorAccessPage } from "../pages/ContractorAccessPage";
import { CaretakerPage } from "../pages/CaretakerPage";
import { DashboardPage } from "../pages/DashboardPage";
import { GeneralAccessPage } from "../pages/GeneralAccessPage";
import { FlatInstructionsPage } from "../pages/FlatInstructionsPage";
import { InstructionsPage } from "../pages/InstructionsPage";
import { LoginPage } from "../pages/LoginPage";
import { QrCodesPage } from "../pages/QrCodesPage";
import { RegisterPage } from "../pages/RegisterPage";
import { StockPage } from "../pages/StockPage";
import { StockRequestPage } from "../pages/StockRequestPage";
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
      <Route path="/access" element={<GeneralAccessPage />} />
      <Route path="/stock-request" element={<StockRequestPage />} />
      <Route path="/instructions-public" element={<FlatInstructionsPage />} />
      <Route path="/cash-flow/share/:token" element={<CashFlowSharedPage />} />
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
        path="/cash-flow-52"
        element={
          <AdminRoute>
            <CashFlowPage title="Cashflow 52" scope="cashflow52" showFlat={false} />
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
        path="/checklist"
        element={
          <PrivateRoute>
            <OakHillRoute>
              <ChecklistPage />
            </OakHillRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/contractor"
        element={
          <PrivateRoute>
            <OakHillRoute>
              <CaretakerPage />
            </OakHillRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/stock"
        element={
          <PrivateRoute>
            <OakHillRoute>
              <StockPage />
            </OakHillRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/instructions"
        element={
          <PrivateRoute>
            <OakHillRoute>
              <InstructionsPage />
            </OakHillRoute>
          </PrivateRoute>
        }
      />
      <Route path="/caretaker" element={<Navigate to="/contractor" replace />} />
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
