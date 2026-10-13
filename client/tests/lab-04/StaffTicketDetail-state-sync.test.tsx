import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StaffTicketDetail } from "../../src/components/StaffTicketDetail";
import * as staffApi from "../../src/api/staff";
import * as authContext from "../../src/context/AuthContext";

// Mock staff API module
vi.mock("../../src/api/staff", async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>();
  return {
    ...actual,
    fetchStaffTicketDetail: vi.fn(),
    fetchStaffTicketComments: vi.fn(),
    fetchStaffTicketNotes: vi.fn(),
    fetchStaffUsers: vi.fn(),
    updateStaffTicketStatus: vi.fn(),
    updateStaffTicketPriority: vi.fn(),
    claimStaffTicket: vi.fn(),
    reassignStaffTicket: vi.fn(),
    addStaffTicketComment: vi.fn(),
    addStaffTicketNote: vi.fn(),
    fetchTicketActions: vi.fn(),
    createTicketAction: vi.fn(),
    updateTicketAction: vi.fn(),
  };
});

const mockStaffUser = {
  id: "staff-1111",
  name: "Sam Staff",
  email: "staff1@university.edu",
  role: "IT Staff" as const,
  mustChangePassword: false,
};

const mockStaffMembers = [
  { id: "staff-1111", name: "Sam Staff", email: "staff1@university.edu", role: "IT Staff" },
  { id: "staff-2222", name: "Alex Tech", email: "staff2@university.edu", role: "IT Staff" },
];

const initialTicketDetail: any = {
  ticket: {
    id: "tkt-001",
    ticketNumber: "TKT-2026-00001",
    requester: { id: "req-001", name: "Alice Smith", email: "alice@university.edu" },
    category: { id: 1, name: "Network Infrastructure" },
    relatedSystem: { id: "sys-001", name: "Campus Wi-Fi" },
    summary: "Wi-Fi dropping frequently in Science Hall",
    description: "Signal drops every 10 minutes on the 2nd floor.",
    requestedPriority: "High",
    status: "Open",
    itPriority: "High",
    requesterResolution: null,
    resolutionSummary: null,
    assignee: { id: "staff-1111", name: "Sam Staff", email: "staff1@university.edu" },
    createdAt: "2026-10-11T08:00:00.000Z",
    updatedAt: "2026-10-11T09:30:00.000Z",
    attachments: [],
  },
};

describe("StaffTicketDetail — Ticket State Synchronization Regression Tests (Issue #50)", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: mockStaffUser,
      token: "mock-jwt-token",
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      clearError: vi.fn(),
    });

    vi.mocked(staffApi.fetchStaffTicketComments).mockResolvedValue({ comments: [] });
    vi.mocked(staffApi.fetchStaffTicketNotes).mockResolvedValue({ notes: [] });
    vi.mocked(staffApi.fetchStaffUsers).mockResolvedValue({ users: mockStaffMembers });
    vi.mocked(staffApi.fetchTicketActions).mockResolvedValue({ actions: [] });
  });

  it("REG-SYNC-01: Updating IT Priority refreshes ticket metadata so subsequent status transition sends latest expectedUpdatedAt", async () => {
    const updatedTimestamp = "2026-10-11T09:35:00.000Z";
    const refreshedTicketDetail: any = {
      ticket: {
        ...initialTicketDetail.ticket,
        itPriority: "Urgent",
        updatedAt: updatedTimestamp,
      },
    };

    // First call returns initial ticket; second call returns refreshed ticket with updated timestamp
    vi.mocked(staffApi.fetchStaffTicketDetail)
      .mockResolvedValueOnce(initialTicketDetail)
      .mockResolvedValueOnce(refreshedTicketDetail);

    vi.mocked(staffApi.updateStaffTicketPriority).mockResolvedValue({
      ticket: { id: "tkt-001", itPriority: "Urgent" },
    });

    vi.mocked(staffApi.updateStaffTicketStatus).mockResolvedValue({
      ticket: { id: "tkt-001", status: "In Progress", updatedAt: "2026-10-11T09:36:00.000Z" },
    });

    render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

    // Wait for initial render
    await screen.findByRole("heading", { name: "IT Staff Ticket Operations" });

    // Change IT Priority to Urgent and save
    const prioritySelect = screen.getByLabelText(/Set IT Priority/i);
    fireEvent.change(prioritySelect, { target: { value: "Urgent" } });

    const savePriorityBtn = screen.getByRole("button", { name: /^Save$/i });
    fireEvent.click(savePriorityBtn);

    await screen.findByText(/IT Priority updated to Urgent/i);

    // Immediately change status to In Progress on the same page
    const statusSelect = screen.getByLabelText(/Status Transition/i);
    fireEvent.change(statusSelect, { target: { value: "In Progress" } });

    const transitionBtn = screen.getByRole("button", { name: /^Transition$/i });
    fireEvent.click(transitionBtn);

    // Must use the latest refreshed timestamp, NOT the initial stale timestamp
    await waitFor(() => {
      expect(staffApi.updateStaffTicketStatus).toHaveBeenCalledWith(
        "mock-jwt-token",
        "tkt-001",
        "In Progress",
        updatedTimestamp
      );
    });
  });

  it("REG-SYNC-02: Claiming a ticket refreshes ticket metadata so subsequent status transition sends latest expectedUpdatedAt", async () => {
    const unassignedTicket: any = {
      ticket: {
        ...initialTicketDetail.ticket,
        assignee: null,
        updatedAt: "2026-10-11T09:00:00.000Z",
      },
    };

    const claimedTimestamp = "2026-10-11T09:40:00.000Z";
    const claimedTicketDetail: any = {
      ticket: {
        ...unassignedTicket.ticket,
        assignee: { id: "staff-1111", name: "Sam Staff", email: "staff1@university.edu" },
        updatedAt: claimedTimestamp,
      },
    };

    vi.mocked(staffApi.fetchStaffTicketDetail)
      .mockResolvedValueOnce(unassignedTicket)
      .mockResolvedValueOnce(claimedTicketDetail);

    vi.mocked(staffApi.claimStaffTicket).mockResolvedValue({
      ticket: {
        id: "tkt-001",
        assignee: { id: "staff-1111", name: "Sam Staff", email: "staff1@university.edu" },
      },
    });

    vi.mocked(staffApi.updateStaffTicketStatus).mockResolvedValue({
      ticket: { id: "tkt-001", status: "In Progress", updatedAt: "2026-10-11T09:41:00.000Z" },
    });

    render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

    const claimBtn = await screen.findByRole("button", { name: /^Claim Ticket$/i });
    fireEvent.click(claimBtn);

    await screen.findByText(/Ticket claimed successfully/i);

    // Immediately change status
    const statusSelect = screen.getByLabelText(/Status Transition/i);
    fireEvent.change(statusSelect, { target: { value: "In Progress" } });

    const transitionBtn = screen.getByRole("button", { name: /^Transition$/i });
    fireEvent.click(transitionBtn);

    await waitFor(() => {
      expect(staffApi.updateStaffTicketStatus).toHaveBeenCalledWith(
        "mock-jwt-token",
        "tkt-001",
        "In Progress",
        claimedTimestamp
      );
    });
  });

  it("REG-SYNC-03: Reassigning a ticket refreshes ticket metadata so subsequent status transition sends latest expectedUpdatedAt", async () => {
    const reassignedTimestamp = "2026-10-11T09:45:00.000Z";
    const reassignedTicketDetail: any = {
      ticket: {
        ...initialTicketDetail.ticket,
        assignee: { id: "staff-2222", name: "Alex Tech", email: "staff2@university.edu" },
        updatedAt: reassignedTimestamp,
      },
    };

    vi.mocked(staffApi.fetchStaffTicketDetail)
      .mockResolvedValueOnce(initialTicketDetail)
      .mockResolvedValueOnce(reassignedTicketDetail);

    vi.mocked(staffApi.reassignStaffTicket).mockResolvedValue({
      ticket: {
        id: "tkt-001",
        assignee: { id: "staff-2222", name: "Alex Tech", email: "staff2@university.edu" },
      },
    });

    vi.mocked(staffApi.updateStaffTicketStatus).mockResolvedValue({
      ticket: { id: "tkt-001", status: "In Progress", updatedAt: "2026-10-11T09:46:00.000Z" },
    });

    render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

    await screen.findByRole("heading", { name: "IT Staff Ticket Operations" });

    const reassignSelect = screen.getByLabelText(/Reassign Staff/i);
    fireEvent.change(reassignSelect, { target: { value: "staff-2222" } });

    const applyBtn = screen.getByRole("button", { name: /^Apply$/i });
    fireEvent.click(applyBtn);

    await screen.findByText(/Ticket reassigned successfully/i);

    // Immediately change status
    const statusSelect = screen.getByLabelText(/Status Transition/i);
    fireEvent.change(statusSelect, { target: { value: "In Progress" } });

    const transitionBtn = screen.getByRole("button", { name: /^Transition$/i });
    fireEvent.click(transitionBtn);

    await waitFor(() => {
      expect(staffApi.updateStaffTicketStatus).toHaveBeenCalledWith(
        "mock-jwt-token",
        "tkt-001",
        "In Progress",
        reassignedTimestamp
      );
    });
  });

  it("REG-SYNC-04: Genuine concurrent edits that cause 409 Conflict display conflict feedback", async () => {
    vi.mocked(staffApi.fetchStaffTicketDetail).mockResolvedValue(initialTicketDetail);

    vi.mocked(staffApi.updateStaffTicketStatus).mockRejectedValueOnce(
      new Error("Ticket has been modified by another request. Stale update rejected.")
    );

    render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

    await screen.findByRole("heading", { name: "IT Staff Ticket Operations" });

    const statusSelect = screen.getByLabelText(/Status Transition/i);
    fireEvent.change(statusSelect, { target: { value: "In Progress" } });

    const transitionBtn = screen.getByRole("button", { name: /^Transition$/i });
    fireEvent.click(transitionBtn);

    // Conflict error message must be displayed to the user
    await screen.findByText(/Ticket has been modified by another request. Stale update rejected./i);
  });
});
