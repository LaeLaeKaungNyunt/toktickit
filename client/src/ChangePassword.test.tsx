import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import ChangePassword from "./components/ChangePassword.js";
import { AuthProvider } from "./context/AuthContext.js";

vi.stubGlobal("fetch", vi.fn());

describe("ChangePassword Component", () => {
  it("renders new password and confirm password inputs and update button", () => {
    render(
      <AuthProvider>
        <ChangePassword />
      </AuthProvider>
    );

    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /update password/i })).toBeInTheDocument();
  });

  it("shows validation error when passwords do not match", async () => {
    render(
      <AuthProvider>
        <ChangePassword />
      </AuthProvider>
    );

    const user = userEvent.setup();
    const newPass = screen.getByLabelText(/new password/i);
    const confirmPass = screen.getByLabelText(/confirm new password/i);
    const submitBtn = screen.getByRole("button", { name: /update password/i });

    await user.type(newPass, "NewPassword123!");
    await user.type(confirmPass, "DifferentPassword123!");
    await user.click(submitBtn);

    expect(await screen.findByText(/password confirmation does not match/i)).toBeInTheDocument();
  });
});
