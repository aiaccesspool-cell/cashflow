import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";
import { Dashboard } from "@/components/dashboard/Dashboard";
import Transactions from "@/components/transactions/Transactions";
import Categories from "@/components/categories/Categories";
import Accounts from "@/components/accounts/Accounts";
import Sources from "@/components/sources/Sources";
import Users from "@/components/users/Users";
import Reports from "@/components/reports/Reports";
import AuditLogs from "@/components/audit/AuditLogs";
import Login from "@/components/auth/Login";
import ChangePassword from "@/components/settings/ChangePassword";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { TransactionProvider } from "@/context/TransactionContext";
import { hasAnyPermission } from "@/utils/permissions";

function AccessDenied() {
  return (
    <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
      <h2 className="text-xl font-semibold">Access denied</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your current account does not have permission to open this page.
      </p>
    </div>
  );
}

function PrivateRoute({
  children,
  permissions = [],
}: {
  children: React.ReactNode;
  permissions?: string[];
}) {
  const { user, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasAnyPermission(user, permissions)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return null;
  }

  const isAuthenticated = Boolean(user);
  const isAdmin = user?.role === "admin";

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Shell>
              <Routes>
                <Route
                  path="/"
                  element={
                    <PrivateRoute permissions={["dashboard.view"]}>
                      <Dashboard />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/transactions"
                  element={
                    <PrivateRoute permissions={["transactions.view"]}>
                      <Transactions />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/categories"
                  element={
                    <PrivateRoute permissions={["categories.view"]}>
                      <Categories />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/accounts"
                  element={
                    <PrivateRoute permissions={["accounts.view"]}>
                      <Accounts />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/sources"
                  element={
                    <PrivateRoute permissions={["sources.view"]}>
                      <Sources />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <PrivateRoute permissions={["users.view"]}>
                      <Users />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <PrivateRoute permissions={["reports.view"]}>
                      <Reports />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/change-password"
                  element={
                    <PrivateRoute>
                      <ChangePassword />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/audit-logs"
                  element={
                    isAdmin ? (
                      <AuditLogs />
                    ) : (
                      <AccessDenied />
                    )
                  }
                />
                <Route
                  path="*"
                  element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />}
                />
              </Routes>
            </Shell>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TransactionProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TransactionProvider>
    </AuthProvider>
  );
}
