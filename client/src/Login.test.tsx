import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import Login from "./components/Login.js";
import { AuthProvider } from "./context/AuthContext.js";

vi.stubGlobal("fetch", vi.fn());

describe("Login Component", () => {
  it("renders email and password inputs and sign-in button", () => {
    render(
      <AuthProvider>
        <Login />
      </AuthProvider>
    );

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows error message when trying to submit empty fields", async () => {
    render(
      <AuthProvider>
        <Login />
      </AuthProvider>
    );

    const user = userEvent.setup();
    const submitBtn = screen.getByRole("button", { name: /sign in/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/please enter both email and password/i)).toBeInTheDocument();
  });
});
