import { useState, FormEvent } from "react";
import { useAuth } from "../context/AuthContext.js";

export default function Login() {
  const { login, error: authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayError = errorMessage || authError;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid credentials or inactive account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="card shadow-sm mx-auto" style={{ maxWidth: 460 }}>
      <div className="card-body p-4">
        <h2 className="card-title text-center h4 mb-3" style={{ color: "#006B3C" }}>
          Sign In to TokTickIT
        </h2>
        <p className="text-muted text-center small mb-4">
          Enter your registered email and password to access the IT Service Desk.
        </p>

        {displayError && (
          <div className="alert alert-danger py-2 small" role="alert" id="login-error-alert">
            {displayError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label htmlFor="login-email" className="form-label fw-semibold small">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              className="form-control"
              placeholder="name@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="login-password" className="form-label fw-semibold small">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <button
            type="submit"
            className="btn text-white w-100 py-2 fw-semibold"
            style={{ backgroundColor: "#006B3C" }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing In…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
