import { Navigate, Route, Routes } from "react-router-dom";

import { AdminOnlyRoute } from "../components/AdminOnlyRoute";
import { AdminRoute } from "../components/AdminRoute";
import { PrivateRoute } from "../components/PrivateRoute";
import { TasksRoute } from "../components/TasksRoute";
import { useAuth } from "../hooks/useAuth";
import { CashFlowPage } from "../pages/CashFlowPage";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { TasksPage } from "../pages/TasksPage";
import { UsersPage } from "../pages/UsersPage";
import { canAccessOverview, canAccessTasks } from "../utils/permissions";

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

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
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
