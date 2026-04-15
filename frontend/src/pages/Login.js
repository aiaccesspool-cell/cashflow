import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../services/api";
import { Form, Button, Card } from "react-bootstrap";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post("/auth/login", form);

      // ❌ REMOVE direct localStorage usage (or keep inside context)
      // localStorage.setItem("token", res.data.token);
      // localStorage.setItem("user", JSON.stringify(res.data.user));

      // ✅ USE CONTEXT INSTEAD
      login(res.data.user); 

      // (optional: store token separately)
      localStorage.setItem("token", res.data.token);

      navigate("/"); // redirect to dashboard
    } catch (err) {
      alert(err.response?.data?.error || "Login failed");
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100">
      <Card style={{ width: "400px" }} className="p-4">
        <h3 className="mb-3">Login</h3>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Control type="email" name="email" placeholder="Email" onChange={handleChange} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Control type="password" name="password" placeholder="Password" onChange={handleChange} />
          </Form.Group>
          <Button type="submit" className="w-100">Login</Button>
        </Form>
      </Card>
    </div>
  );
}