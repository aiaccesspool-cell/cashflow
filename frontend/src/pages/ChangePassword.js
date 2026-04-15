import { useState } from "react";
import { Alert, Button, Card, Col, Form, Row } from "react-bootstrap";
import { API } from "../services/api";
import { useAuth } from "../context/AuthContext";

const EMPTY_FORM = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ChangePassword() {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [flash, setFlash] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFlash(null);

    if (!form.currentPassword) {
      setFlash({ variant: "danger", message: "Current password is required" });
      return;
    }

    if (form.newPassword.trim().length < 6) {
      setFlash({
        variant: "danger",
        message: "New password must be at least 6 characters",
      });
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setFlash({
        variant: "danger",
        message: "Password confirmation does not match",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await API.put("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      setFlash({
        variant: "success",
        message: response.data.message || "Password updated successfully",
      });
      setForm(EMPTY_FORM);
    } catch (err) {
      setFlash({
        variant: "danger",
        message: err.response?.data?.error || "Failed to change password",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="analytics-page">
      <Row className="justify-content-center">
        <Col lg={7} xl={6}>
          <Card className="analytics-card">
            <Card.Body>
              <div className="mb-4">
                <h2 className="analytics-page-title mb-2">Change Password</h2>
                <p className="analytics-page-subtitle mb-0">
                  Update the password for {user?.email || "your account"} without needing
                  admin help.
                </p>
              </div>

              {flash && (
                <Alert
                  variant={flash.variant}
                  dismissible
                  onClose={() => setFlash(null)}
                >
                  {flash.message}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Current Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="currentPassword"
                    value={form.currentPassword}
                    onChange={handleChange}
                    placeholder="Enter your current password"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>New Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="newPassword"
                    value={form.newPassword}
                    onChange={handleChange}
                    placeholder="Minimum 6 characters"
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label>Confirm New Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repeat the new password"
                  />
                </Form.Group>

                <div className="d-flex justify-content-end">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
