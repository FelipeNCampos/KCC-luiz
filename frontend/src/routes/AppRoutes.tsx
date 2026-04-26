import { Navigate, Route, Routes } from "react-router-dom";

import { AdminRoute } from "../components/AdminRoute";
import { PrivateRoute } from "../components/PrivateRoute";
import { TasksRoute } from "../components/TasksRoute";
import { CashFlowPage } from "../pages/CashFlowPage";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { TasksPage } from "../pages/TasksPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <DashboardPage />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
