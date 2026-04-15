import { Nav } from "react-bootstrap";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

export default function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();

  const links = [
    { to: "/", label: "Dashboard", permission: "dashboard.view" },
    { to: "/categories", label: "Categories", permission: "categories.view" },
    { to: "/accounts", label: "Accounts", permission: "accounts.view" },
    { to: "/transactions", label: "Transactions", permission: "transactions.view" },
    { to: "/reports", label: "Reports", permission: "reports.view" },
    { to: "/users", label: "Users", permission: "users.view" },
  ].filter((link) => hasPermission(user, link.permission));

  return (
    <div className="bg-dark text-white vh-100 p-3">
      <h4 className="mb-4">Cash System</h4>

      <Nav className="flex-column gap-1">
        {links.map((link) => (
          <Nav.Link
            key={link.to}
            as={Link}
            to={link.to}
            className={`text-white rounded ${location.pathname === link.to ? "bg-secondary" : ""}`}
          >
            {link.label}
          </Nav.Link>
        ))}
      </Nav>
    </div>
  );
}
