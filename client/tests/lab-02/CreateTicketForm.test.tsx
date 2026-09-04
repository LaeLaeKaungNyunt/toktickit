import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequesterProvider, useRequester } from "../../src/context/RequesterContext.js";
import CreateTicketForm from "../../src/components/CreateTicketForm.js";
import * as lab02Api from "../../src/api/lab02.js";

const mockRequester = {
  id: "req-123",
  displayName: "Alice Smith",
  email: "alice.smith@university.edu",
};

const mockCategories = [
  { id: 1, name: "Account and Access" },
  { id: 2, name: "Hardware" },
];

const mockRelatedSystems = [
  { id: "sys-1", name: "Student Portal" },
  { id: "sys-2", name: "Canvas LMS" },
];

function TestWrapper() {
  const { setSelectedRequester } = useRequester();

  return (
    <div>
      <button
        data-testid="set-requester-btn"
        onClick={() => setSelectedRequester(mockRequester)}
      >
        Set Requester
      </button>
      <button
        data-testid="clear-requester-btn"
        onClick={() => setSelectedRequester(null)}
      >
        Clear Requester
      </button>
      <CreateTicketForm />
    </div>
  );
}

describe("CreateTicketForm Component (Issue #13)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-06: shows loading state while fetching reference data", async () => {
    vi.spyOn(lab02Api, "fetchCategoriesV1").mockReturnValue(new Promise(() => {}) as any);
    vi.spyOn(lab02Api, "fetchRelatedSystems").mockReturnValue(new Promise(() => {}) as any);

    render(
      <RequesterProvider>
        <TestWrapper />
      </RequesterProvider>
    );

    // Set requester context
    await userEvent.click(screen.getByTestId("set-requester-btn"));

    // Expect loading state
    expect(screen.getByText(/loading form reference data/i)).toBeInTheDocument();
  });

  it("AC-06: loads Categories and Related Systems options from API", async () => {
    vi.spyOn(lab02Api, "fetchCategoriesV1").mockResolvedValue(mockCategories);
    vi.spyOn(lab02Api, "fetchRelatedSystems").mockResolvedValue(mockRelatedSystems);

    render(
      <RequesterProvider>
        <TestWrapper />
      </RequesterProvider>
    );

    await userEvent.click(screen.getByTestId("set-requester-btn"));

    // Expect populated options
    expect(await screen.findByRole("option", { name: "Account and Access" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Hardware" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Student Portal" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Canvas LMS" })).toBeInTheDocument();
  });

  it("AC-06: handles reference data loading error with safe retry option", async () => {
    vi.spyOn(lab02Api, "fetchCategoriesV1").mockRejectedValue(new Error("Failed to load"));
    vi.spyOn(lab02Api, "fetchRelatedSystems").mockResolvedValue(mockRelatedSystems);

    render(
      <RequesterProvider>
        <TestWrapper />
      </RequesterProvider>
    );

    await userEvent.click(screen.getByTestId("set-requester-btn"));

    expect(await screen.findByText(/unable to load reference data/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("AC-07: validates required fields, summary length, description length, priority selection", async () => {
    vi.spyOn(lab02Api, "fetchCategoriesV1").mockResolvedValue(mockCategories);
    vi.spyOn(lab02Api, "fetchRelatedSystems").mockResolvedValue(mockRelatedSystems);
    const createTicketSpy = vi.spyOn(lab02Api, "createTicket");

    render(
      <RequesterProvider>
        <TestWrapper />
      </RequesterProvider>
    );

    await userEvent.click(screen.getByTestId("set-requester-btn"));
    await screen.findByRole("option", { name: "Account and Access" });

    // Submit empty form
    const submitBtn = screen.getByRole("button", { name: /create ticket/i });
    await userEvent.click(submitBtn);

    expect(createTicketSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/category selection is required/i)).toBeInTheDocument();
    expect(screen.getByText(/related system selection is required/i)).toBeInTheDocument();
    expect(screen.getByText(/ticket summary is required/i)).toBeInTheDocument();
    expect(screen.getByText(/requested priority must be selected/i)).toBeInTheDocument();
    expect(screen.getByText(/description is required/i)).toBeInTheDocument();

    // Enter short summary and description
    await userEvent.type(screen.getByLabelText(/ticket summary/i), "abc");
    await userEvent.type(screen.getByLabelText(/description/i), "short");
    await userEvent.click(submitBtn);

    expect(createTicketSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/ticket summary must contain 5 to 120 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/description must contain 10 to 5000 characters/i)).toBeInTheDocument();
  });

  it("AC-08: shows busy state and prevents duplicate submission while create API call is pending", async () => {
    vi.spyOn(lab02Api, "fetchCategoriesV1").mockResolvedValue(mockCategories);
    vi.spyOn(lab02Api, "fetchRelatedSystems").mockResolvedValue(mockRelatedSystems);

    let resolveCreate: (val: any) => void;
    const createPromise = new Promise((res) => {
      resolveCreate = res;
    });
    vi.spyOn(lab02Api, "createTicket").mockReturnValue(createPromise as any);

    render(
      <RequesterProvider>
        <TestWrapper />
      </RequesterProvider>
    );

    await userEvent.click(screen.getByTestId("set-requester-btn"));
    await screen.findByRole("option", { name: "Account and Access" });

    // Fill valid form values
    await userEvent.selectOptions(screen.getByLabelText(/category/i), "1");
    await userEvent.selectOptions(screen.getByLabelText(/related system/i), "sys-1");
    await userEvent.selectOptions(screen.getByLabelText(/requested priority/i), "Medium");
    await userEvent.type(screen.getByLabelText(/ticket summary/i), "Cannot login to student portal");
    await userEvent.type(
      screen.getByLabelText(/description/i),
      "The portal shows an error page whenever I enter my valid credentials."
    );

    const submitBtn = screen.getByRole("button", { name: /create ticket/i });
    await userEvent.click(submitBtn);

    // Expect busy button state
    expect(screen.getByRole("button", { name: /creating ticket/i })).toBeDisabled();
    expect(screen.getByLabelText(/ticket summary/i)).toBeDisabled();

    // Resolve API promise
    resolveCreate!({
      id: "tkt-1",
      ticketNumber: "TKT-2026-00001",
      requester: { id: "req-123", displayName: "Alice Smith" },
      category: { id: 1, name: "Account and Access" },
      relatedSystem: { id: "sys-1", name: "Student Portal" },
      summary: "Cannot login to student portal",
      requestedPriority: "Medium",
      description: "The portal shows an error page whenever I enter my valid credentials.",
      currentStatus: "New",
      createdAt: "2026-09-04T20:00:00.000Z",
      updatedAt: "2026-09-04T20:00:00.000Z",
    });

    await waitFor(async () => {
      const el = await screen.findAllByText("TKT-2026-00001");
      expect(el.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("AC-09: preserves entered form values on recoverable API failure and maps field errors", async () => {
    vi.spyOn(lab02Api, "fetchCategoriesV1").mockResolvedValue(mockCategories);
    vi.spyOn(lab02Api, "fetchRelatedSystems").mockResolvedValue(mockRelatedSystems);

    const apiErr = new Error("Some submitted values are invalid.");
    (apiErr as any).fields = { summary: "Summary violates policy." };
    vi.spyOn(lab02Api, "createTicket").mockRejectedValue(apiErr);

    render(
      <RequesterProvider>
        <TestWrapper />
      </RequesterProvider>
    );

    await userEvent.click(screen.getByTestId("set-requester-btn"));
    await screen.findByRole("option", { name: "Account and Access" });

    await userEvent.selectOptions(screen.getByLabelText(/category/i), "1");
    await userEvent.selectOptions(screen.getByLabelText(/related system/i), "sys-1");
    await userEvent.selectOptions(screen.getByLabelText(/requested priority/i), "High");
    await userEvent.type(screen.getByLabelText(/ticket summary/i), "Network Access Issues");
    await userEvent.type(
      screen.getByLabelText(/description/i),
      "Unable to connect to university Wi-Fi network from dormitory."
    );

    await userEvent.click(screen.getByRole("button", { name: /create ticket/i }));

    expect(await screen.findByText(/some submitted values are invalid/i)).toBeInTheDocument();
    expect(screen.getByText(/summary violates policy/i)).toBeInTheDocument();

    // Form inputs must retain entered values for retry
    expect(screen.getByLabelText(/ticket summary/i)).toHaveValue("Network Access Issues");
    expect(screen.getByLabelText(/description/i)).toHaveValue(
      "Unable to connect to university Wi-Fi network from dormitory."
    );
  });

  it("AC-10: displays all required details (including Ticket Summary) on successful creation", async () => {
    vi.spyOn(lab02Api, "fetchCategoriesV1").mockResolvedValue(mockCategories);
    vi.spyOn(lab02Api, "fetchRelatedSystems").mockResolvedValue(mockRelatedSystems);

    vi.spyOn(lab02Api, "createTicket").mockResolvedValue({
      id: "tkt-100",
      ticketNumber: "TKT-2026-00042",
      requester: { id: "req-123", displayName: "Alice Smith" },
      category: { id: 1, name: "Account and Access" },
      relatedSystem: { id: "sys-1", name: "Student Portal" },
      summary: "Password reset request failed",
      requestedPriority: "Urgent",
      description: "Self-service password reset portal gave error code 500.",
      currentStatus: "New",
      createdAt: "2026-09-04T21:00:00.000Z",
      updatedAt: "2026-09-04T21:00:00.000Z",
    });

    render(
      <RequesterProvider>
        <TestWrapper />
      </RequesterProvider>
    );

    await userEvent.click(screen.getByTestId("set-requester-btn"));
    await screen.findByRole("option", { name: "Account and Access" });

    await userEvent.selectOptions(screen.getByLabelText(/category/i), "1");
    await userEvent.selectOptions(screen.getByLabelText(/related system/i), "sys-1");
    await userEvent.selectOptions(screen.getByLabelText(/requested priority/i), "Urgent");
    await userEvent.type(screen.getByLabelText(/ticket summary/i), "Password reset request failed");
    await userEvent.type(
      screen.getByLabelText(/description/i),
      "Self-service password reset portal gave error code 500."
    );

    await userEvent.click(screen.getByRole("button", { name: /create ticket/i }));

    // AC-10 Required Fields Verification
    const ticketNumEls = await screen.findAllByText("TKT-2026-00042");
    expect(ticketNumEls.length).toBeGreaterThanOrEqual(1); // Ticket Number
    expect(screen.getByText("Password reset request failed")).toBeInTheDocument(); // Ticket Summary
    expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument(); // Requester
    expect(screen.getByText(/2026-09-04/i)).toBeInTheDocument(); // Ticket Date
    expect(screen.getByText("Account and Access")).toBeInTheDocument(); // Category
    expect(screen.getByText("Student Portal")).toBeInTheDocument(); // Related System
    expect(screen.getByText("Urgent")).toBeInTheDocument(); // Requested Priority
    expect(screen.getByText("Self-service password reset portal gave error code 500.")).toBeInTheDocument(); // Description
    expect(screen.getByText("New")).toBeInTheDocument(); // Current Status

    // Check "Create Another Ticket" action resets form
    await userEvent.click(screen.getByRole("button", { name: /create another ticket/i }));
    expect(screen.getByRole("button", { name: /create ticket/i })).toBeInTheDocument();
  });

  it("resets Create Ticket state when requester selection changes", async () => {
    vi.spyOn(lab02Api, "fetchCategoriesV1").mockResolvedValue(mockCategories);
    vi.spyOn(lab02Api, "fetchRelatedSystems").mockResolvedValue(mockRelatedSystems);

    render(
      <RequesterProvider>
        <TestWrapper />
      </RequesterProvider>
    );

    await userEvent.click(screen.getByTestId("set-requester-btn"));
    await screen.findByRole("option", { name: "Account and Access" });

    await userEvent.type(screen.getByLabelText(/ticket summary/i), "Draft Summary Text");

    // Clear / Switch requester
    await userEvent.click(screen.getByTestId("clear-requester-btn"));

    expect(screen.queryByLabelText(/ticket summary/i)).not.toBeInTheDocument();

    // Set requester again -> clean fresh form
    await userEvent.click(screen.getByTestId("set-requester-btn"));
    expect(await screen.findByLabelText(/ticket summary/i)).toHaveValue("");
  });
});
