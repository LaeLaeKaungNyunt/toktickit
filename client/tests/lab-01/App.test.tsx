import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("App", () => {
  beforeEach(() => {
    sessionStorage.setItem("toktickit_auth_token", "test-token");
    vi.spyOn(api, "getMeApi").mockResolvedValue({
      id: "test-user-id",
      name: "Test User",
      email: "test@university.edu",
      role: "Requester",
      mustChangePassword: false,
    });
  });

  it("renders the TokTickIT heading", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: /TokTickIT/i })).toBeInTheDocument();
  });

  it("shows Online and the seeded categories on success", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [
        { id: 1, name: "Account and Access" },
        { id: 2, name: "Hardware" },
        { id: 3, name: "Software" },
        { id: 4, name: "Network" },
      ],
    });

    render(<App />);

    const checkBtn = await screen.findByRole("button", { name: /check system/i });
    await userEvent.click(checkBtn);

    expect(await screen.findByText(/System Status: Online/i)).toBeInTheDocument();
    expect(screen.getByText("Account and Access")).toBeInTheDocument();
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("Software")).toBeInTheDocument();
    expect(screen.getByText("Network")).toBeInTheDocument();
  });

  it("shows an Offline error message when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(new Error("API unavailable"));

    render(<App />);

    const checkBtn = await screen.findByRole("button", { name: /check system/i });
    await userEvent.click(checkBtn);

    expect(await screen.findByText(/System Status: Offline/i)).toBeInTheDocument();
    expect(screen.getByText(/Unable to connect to TokTickIT API/i)).toBeInTheDocument();
  });
});