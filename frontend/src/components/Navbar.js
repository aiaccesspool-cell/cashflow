import { Navbar, Nav, Container, NavDropdown } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

export default function AppNavbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <Navbar bg="dark" variant="dark" expand="lg" sticky="top">
      <Container fluid>
        <Navbar.Brand
          style={{ cursor: "pointer", fontWeight: "bold" }}
          onClick={() => navigate("/")}
        >
          CashMS
        </Navbar.Brand>

        <Navbar.Toggle />

        <Navbar.Collapse>
          <Nav className="me-auto">
            {hasPermission(user, "dashboard.view") && (
              <Nav.Link onClick={() => navigate("/")}>Dashboard</Nav.Link>
            )}

            {hasPermission(user, "transactions.view") && (
              <Nav.Link onClick={() => navigate("/transactions")}>Transactions</Nav.Link>
            )}

            {hasPermission(user, "reports.view") && (
              <Nav.Link onClick={() => navigate("/reports")}>Reports</Nav.Link>
            )}

            {hasPermission(user, "users.view") && (
              <Nav.Link onClick={() => navigate("/users")}>Users</Nav.Link>
            )}
          </Nav>

          <Nav>
            <NavDropdown title={user?.name || "User"} align="end">
              <NavDropdown.ItemText>{user?.email}</NavDropdown.ItemText>
              <NavDropdown.ItemText className="text-capitalize">
                Role: {user?.role || "user"}
              </NavDropdown.ItemText>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={() => navigate("/change-password")}>
                Change Password
              </NavDropdown.Item>
              <NavDropdown.Item onClick={handleLogout}>Logout</NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
