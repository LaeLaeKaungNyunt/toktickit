import { useState, FormEvent } from "react";
import { useAuth } from "../context/AuthContext.js";

export default function ChangePassword() {
  const { changePassword } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!newPassword || !confirmPassword) {
      setErrorMessage("Please fill in both password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Password confirmation does not match new password.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(newPassword, confirmPassword);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to change password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="card shadow-sm mx-auto my-4" style={{ maxWidth: 460 }}>
      <div className="card-body p-4">
        <h2 className="card-title text-center h4 mb-3" style={{ color: "#006B3C" }}>
          Mandatory Password Change
        </h2>
        <div className="alert alert-warning py-2 small mb-4" role="alert">
          You are logging in with an initial or reset password. Please update your password before accessing TokTickIT.
        </div>

        {errorMessage && (
          <div className="alert alert-danger py-2 small" role="alert" id="change-password-error-alert">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label htmlFor="new-password" className="form-label fw-semibold small">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              className="form-control"
              placeholder="Min. 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="confirm-password" className="form-label fw-semibold small">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              className="form-control"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {isSubmitting ? "Updating Password…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
