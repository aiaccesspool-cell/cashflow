import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Container, Row, Col } from "react-bootstrap";
import "./App.css";

import AppNavbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Category from "./pages/Category";
import Account from "./pages/Account";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import ChangePassword from "./pages/ChangePassword";

import { useAuth } from "./context/AuthContext";
import { hasAnyPermission } from "./utils/permissions";

function AccessDenied() {
  return (
    <div className="app-content p-4">
      <h4>Access denied</h4>
      <p className="text-muted mb-0">
        Your current account does not have permission to open this page.
      </p>
    </div>
  );
}

function PrivateRoute({ children, permissions = [] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasAnyPermission(user, permissions)) {
    return <AccessDenied />;
  }

  return children;
}

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  const isAuth = Boolean(user);

  return (
    <BrowserRouter>
      {isAuth && <AppNavbar />}

      <Container fluid className={isAuth ? "app-shell" : "auth-shell"}>
        <Row>
          {isAuth && (
            <Col md={2} className="p-0">
              <Sidebar />
            </Col>
          )}

          <Col md={isAuth ? 10 : 12} className={isAuth ? "app-main-column" : ""}>
            <div className={isAuth ? "app-content" : ""}>
              <Routes>
                <Route
                  path="/login"
                  element={isAuth ? <Navigate to="/" replace /> : <Login />}
                />

                <Route
                  path="/"
                  element={
                    <PrivateRoute permissions={["dashboard.view"]}>
                      <Dashboard />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/categories"
                  element={
                    <PrivateRoute permissions={["categories.view"]}>
                      <Category />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/accounts"
                  element={
                    <PrivateRoute permissions={["accounts.view"]}>
                      <Account />
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
                  path="/reports"
                  element={
                    <PrivateRoute permissions={["reports.view"]}>
                      <Reports />
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
                  path="/change-password"
                  element={
                    <PrivateRoute>
                      <ChangePassword />
                    </PrivateRoute>
                  }
                />

                <Route
                  path="*"
                  element={<Navigate to={isAuth ? "/" : "/login"} replace />}
                />
              </Routes>
            </div>
          </Col>
        </Row>
      </Container>
    </BrowserRouter>
  );
}

export default App;
