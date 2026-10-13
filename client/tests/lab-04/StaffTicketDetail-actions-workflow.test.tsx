import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StaffTicketDetail } from "../../src/components/StaffTicketDetail";
import * as staffApi from "../../src/api/staff";
import * as lab02Api from "../../src/api/lab02";
import * as authContext from "../../src/context/AuthContext";

// Mock API modules
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
vi.mock("../../src/api/lab02");

const mockStaffUser = {
  id: "staff-1111",
  name: "Sam Staff",
  email: "staff1@university.edu",
  role: "IT Staff" as const,
  mustChangePassword: false,
};

const mockAdminUser = {
  id: "admin-9999",
  name: "Alice Admin",
  email: "admin@university.edu",
  role: "Administrator" as const,
  mustChangePassword: false,
};

const mockStaffMembers = [
  { id: "staff-1111", name: "Sam Staff", email: "staff1@university.edu", role: "IT Staff" },
  { id: "staff-2222", name: "Alex Tech", email: "staff2@university.edu", role: "IT Staff" },
];

const mockOpenTicketResponse: any = {
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

const mockResolvedTicketResponse: any = {
  ticket: {
    ...mockOpenTicketResponse.ticket,
    status: "Resolved",
    resolutionSummary: "Replaced faulty wireless access point AP-2B and verified signal stability.",
    updatedAt: "2026-10-11T11:00:00.000Z",
  },
};

const mockCompletedAction: any = {
  id: "act-001",
  ticketId: "tkt-001",
  actionDateTime: "2026-10-11T09:00:00.000Z",
  description: "Diagnosed access point hardware and found faulty radio module.",
  result: "AP-2B hardware fault confirmed; replacement scheduled.",
  performedById: "staff-1111",
  performedBy: { id: "staff-1111", name: "Sam Staff" },
  assignedToId: "staff-2222",
  assignedTo: { id: "staff-2222", name: "Alex Tech" },
  followUpRequired: true,
  followUpNote: "Mount new AP and run throughput test.",
  attachmentNotes: "Hardware log attached to diagnostic ticket.",
  status: "Completed",
  createdAt: "2026-10-11T09:05:00.000Z",
  updatedAt: "2026-10-11T09:20:00.000Z",
};

const mockActiveAction: any = {
  id: "act-002",
  ticketId: "tkt-001",
  actionDateTime: "2026-10-11T10:00:00.000Z",
  description: "Installing replacement access point in room 204.",
  result: "Physical mount completed; running PoE cable test.",
  performedById: "staff-1111",
  performedBy: { id: "staff-1111", name: "Sam Staff" },
  assignedToId: null,
  assignedTo: null,
  followUpRequired: false,
  followUpNote: null,
  attachmentNotes: null,
  status: "Active",
  createdAt: "2026-10-11T10:05:00.000Z",
  updatedAt: "2026-10-11T10:05:00.000Z",
};

const mockCancelledAction: any = {
  id: "act-003",
  ticketId: "tkt-001",
  actionDateTime: "2026-10-11T08:30:00.000Z",
  description: "Rebooted hallway switch.",
  result: "Did not resolve Wi-Fi drops.",
  performedById: "staff-1111",
  performedBy: { id: "staff-1111", name: "Sam Staff" },
  assignedToId: null,
  assignedTo: null,
  followUpRequired: false,
  followUpNote: null,
  attachmentNotes: null,
  status: "Cancelled",
  createdAt: "2026-10-11T08:35:00.000Z",
  updatedAt: "2026-10-11T08:40:00.000Z",
};

describe("StaffTicketDetail — Lab 4 Actions Taken UI & Resolution Workflow (Issue #46)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

    vi.mocked(staffApi.fetchStaffTicketDetail).mockResolvedValue(mockOpenTicketResponse);
    vi.mocked(staffApi.fetchStaffTicketComments).mockResolvedValue({ comments: [] });
    vi.mocked(staffApi.fetchStaffTicketNotes).mockResolvedValue({ notes: [] });
    vi.mocked(staffApi.fetchStaffUsers).mockResolvedValue({
      users: mockStaffMembers,
    });

    if (typeof (staffApi as any).fetchTicketActions === "function") {
      vi.mocked((staffApi as any).fetchTicketActions).mockResolvedValue({
        actions: [mockCompletedAction, mockActiveAction],
      });
    }
  });

  // =========================================================================
  // 1. IT Staff Actions Taken UI
  // =========================================================================
  describe("1. Actions Taken History & Rendering", () => {
    it("AT-UI-01: Renders Actions Taken section header and action records in deterministic order", async () => {
      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      // Expect section heading
      const heading = await screen.findByRole("heading", { name: /Actions Taken/i });
      expect(heading).toBeInTheDocument();

      // Expect both action descriptions rendered
      expect(screen.getByText(/Diagnosed access point hardware/i)).toBeInTheDocument();
      expect(screen.getByText(/Installing replacement access point/i)).toBeInTheDocument();
    });

    it("AT-UI-02: Displays empty-state message when ticket has no recorded actions", async () => {
      if (typeof (staffApi as any).fetchTicketActions === "function") {
        vi.mocked((staffApi as any).fetchTicketActions).mockResolvedValue({ actions: [] });
      }

      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      expect(
        await screen.findByText(/No actions taken have been recorded for this ticket/i)
      ).toBeInTheDocument();
    });

    it("AT-UI-03: Displays complete Action Taken fields including performer, result, and status badges", async () => {
      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/Diagnosed access point hardware/i)).toBeInTheDocument();
      });

      // Performer
      expect(screen.getAllByText(/Sam Staff/i).length).toBeGreaterThan(0);
      // Assigned Staff
      expect(screen.getAllByText(/Alex Tech/i).length).toBeGreaterThan(0);
      // Result
      expect(screen.getByText(/AP-2B hardware fault confirmed/i)).toBeInTheDocument();
      // Status badge
      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
      // Follow-up notes
      expect(screen.getByText(/Mount new AP and run throughput test/i)).toBeInTheDocument();
    });

    it("AT-UI-04: Completed and Cancelled actions are displayed as read-only terminal states without edit controls", async () => {
      if (typeof (staffApi as any).fetchTicketActions === "function") {
        vi.mocked((staffApi as any).fetchTicketActions).mockResolvedValue({
          actions: [mockCompletedAction, mockCancelledAction],
        });
      }

      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/Diagnosed access point hardware/i)).toBeInTheDocument();
      });

      // Neither completed nor cancelled action card should contain Edit or Complete buttons
      const completedCard = screen.getByText(/Diagnosed access point hardware/i).closest(".card, [data-testid]") || document.body;
      expect(within(completedCard as HTMLElement).queryByRole("button", { name: /^Edit$/i })).not.toBeInTheDocument();
      expect(within(completedCard as HTMLElement).queryByRole("button", { name: /Complete/i })).not.toBeInTheDocument();
    });

    it("AT-UI-13: Displays loading state while actions taken are being fetched", async () => {
      let resolvePromise: any;
      const pendingPromise = new Promise<{ actions: any[] }>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked((staffApi as any).fetchTicketActions).mockReturnValue(pendingPromise);

      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      expect(await screen.findByText(/Loading actions taken/i)).toBeInTheDocument();

      resolvePromise({ actions: [] });
      await waitFor(() => {
        expect(screen.queryByText(/Loading actions taken/i)).not.toBeInTheDocument();
      });
    });

    it("AT-UI-14: Displays error message when actions API call fails", async () => {
      vi.mocked((staffApi as any).fetchTicketActions).mockRejectedValueOnce(
        new Error("Network failure fetching actions taken.")
      );

      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      expect(
        await screen.findByText(/Network failure fetching actions taken/i)
      ).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. Add Action Taken Form & Validation
  // =========================================================================
  describe("2. Add Action Taken Form & Validation", () => {
    it("AT-UI-05: Clicking 'Add Action Taken' opens form with read-only Performed By matching authenticated user", async () => {
      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      const addBtn = await screen.findByRole("button", { name: /Add Action Taken/i });
      fireEvent.click(addBtn);

      // Form inputs should appear
      expect(screen.getByLabelText(/Action Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Result/i)).toBeInTheDocument();

      // Performed By displays logged-in staff member
      expect(within(screen.getByRole("dialog")).getAllByText(/Sam Staff/i).length).toBeGreaterThan(0);
    });

    it("AT-UI-06: Validates required fields: rejects submission when Description or Result is blank", async () => {
      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      const addBtn = await screen.findByRole("button", { name: /Add Action Taken/i });
      fireEvent.click(addBtn);

      const saveBtn = screen.getByRole("button", { name: /^Save Action$/i });
      fireEvent.click(saveBtn);

      // Field validation messages should appear
      expect(await screen.findByText(/Description is required/i)).toBeInTheDocument();
    });

    it("AT-UI-07: Validates conditional Follow-Up Note when Follow-Up Required is Yes", async () => {
      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      const addBtn = await screen.findByRole("button", { name: /Add Action Taken/i });
      fireEvent.click(addBtn);

      const descInput = screen.getByLabelText(/Action Description/i);
      const resultInput = screen.getByLabelText(/Result/i);
      fireEvent.change(descInput, { target: { value: "Checked power supply." } });
      fireEvent.change(resultInput, { target: { value: "Voltage nominal." } });

      // Toggle Follow-up required to Yes
      const followUpToggle = screen.getByLabelText(/Follow-Up Required/i);
      fireEvent.click(followUpToggle);

      const saveBtn = screen.getByRole("button", { name: /^Save Action$/i });
      fireEvent.click(saveBtn);

      expect(await screen.findByText(/Follow-up note is required/i)).toBeInTheDocument();
    });

    it("AT-UI-08: Submits valid Action Taken with staff assignment and refreshes actions list", async () => {
      if (typeof (staffApi as any).createTicketAction === "function") {
        vi.mocked((staffApi as any).createTicketAction).mockResolvedValue({
          action: {
            ...mockActiveAction,
            id: "act-new",
            description: "Replaced patch cable.",
            result: "Link sync ok.",
          },
        });
      }

      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      const addBtn = await screen.findByRole("button", { name: /Add Action Taken/i });
      fireEvent.click(addBtn);

      fireEvent.change(screen.getByLabelText(/Action Description/i), { target: { value: "Replaced patch cable." } });
      fireEvent.change(screen.getByLabelText(/Result/i), { target: { value: "Link sync ok." } });

      const saveBtn = screen.getByRole("button", { name: /^Save Action$/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect((staffApi as any).createTicketAction).toHaveBeenCalledWith(
          "mock-jwt-token",
          "tkt-001",
          expect.objectContaining({
            description: "Replaced patch cable.",
            result: "Link sync ok.",
          })
        );
      });
    });

    it("AT-UI-15: Refreshes actions list from server after creating an action taken", async () => {
      vi.mocked((staffApi as any).createTicketAction).mockResolvedValue({
        action: {
          ...mockActiveAction,
          id: "act-new",
          description: "Replaced patch cable.",
          result: "Link sync ok.",
        },
      });

      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      const addBtn = await screen.findByRole("button", { name: /Add Action Taken/i });
      fireEvent.click(addBtn);

      fireEvent.change(screen.getByLabelText(/Action Description/i), { target: { value: "Replaced patch cable." } });
      fireEvent.change(screen.getByLabelText(/Result/i), { target: { value: "Link sync ok." } });

      const saveBtn = screen.getByRole("button", { name: /^Save Action$/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect((staffApi as any).createTicketAction).toHaveBeenCalled();
        // Initial fetch + post-creation refresh = at least 2 calls
        expect((staffApi as any).fetchTicketActions).toHaveBeenCalledTimes(2);
      });
    });
  });

  // =========================================================================
  // 3. Edit & Lifecycle Controls
  // =========================================================================
  describe("3. Edit & Lifecycle Controls", () => {
    it("AT-UI-09: Complete control transitions an Active action to Completed", async () => {
      if (typeof (staffApi as any).updateTicketAction === "function") {
        vi.mocked((staffApi as any).updateTicketAction).mockResolvedValue({
          action: { ...mockActiveAction, status: "Completed" },
        });
      }

      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/Installing replacement access point/i)).toBeInTheDocument();
      });

      const completeBtn = screen.getByRole("button", { name: /Mark Completed|Complete/i });
      fireEvent.click(completeBtn);

      await waitFor(() => {
        expect((staffApi as any).updateTicketAction).toHaveBeenCalledWith(
          "mock-jwt-token",
          "tkt-001",
          "act-002",
          expect.objectContaining({ status: "Completed" })
        );
      });
    });

    it("AT-UI-10: Displays conflict feedback (HTTP 409) when editing a stale action", async () => {
      if (typeof (staffApi as any).updateTicketAction === "function") {
        vi.mocked((staffApi as any).updateTicketAction).mockRejectedValueOnce(
          new Error("Action has been modified by another request. Stale update rejected.")
        );
      }

      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/Installing replacement access point/i)).toBeInTheDocument();
      });

      const editBtn = screen.getByRole("button", { name: /Edit Action|Edit/i });
      fireEvent.click(editBtn);

      const saveBtn = screen.getByRole("button", { name: /^Save Changes$/i });
      fireEvent.click(saveBtn);

      expect(await screen.findByText(/modified by another request|conflict|stale/i)).toBeInTheDocument();
    });

    it("AT-UI-11: Successfully edits and reassigns an Active action, sending updated fields and expectedUpdatedAt", async () => {
      vi.mocked((staffApi as any).updateTicketAction).mockResolvedValue({
        action: {
          ...mockActiveAction,
          description: "Repositioned access point antenna.",
          result: "Signal improved to -60dBm.",
          assignedToId: "staff-2222",
          assignedTo: mockStaffMembers[1],
        },
      });

      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/Installing replacement access point/i)).toBeInTheDocument();
      });

      const editBtn = screen.getByRole("button", { name: /Edit Action|Edit/i });
      fireEvent.click(editBtn);

      const modal = screen.getByRole("dialog");
      const descInput = within(modal).getByLabelText(/Action Description/i);
      const resultInput = within(modal).getByLabelText(/Result/i);
      const assigneeSelect = within(modal).getByLabelText(/Assigned Staff/i);

      fireEvent.change(descInput, { target: { value: "Repositioned access point antenna." } });
      fireEvent.change(resultInput, { target: { value: "Signal improved to -60dBm." } });
      fireEvent.change(assigneeSelect, { target: { value: "staff-2222" } });

      const saveBtn = screen.getByRole("button", { name: /^Save Changes$/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect((staffApi as any).updateTicketAction).toHaveBeenCalledWith(
          "mock-jwt-token",
          "tkt-001",
          "act-002",
          expect.objectContaining({
            description: "Repositioned access point antenna.",
            result: "Signal improved to -60dBm.",
            assignedToId: "staff-2222",
            expectedUpdatedAt: "2026-10-11T10:05:00.000Z",
          })
        );
      });
    });

    it("AT-UI-12: Cancel control transitions an Active action to Cancelled with expectedUpdatedAt", async () => {
      vi.mocked((staffApi as any).updateTicketAction).mockResolvedValue({
        action: { ...mockActiveAction, status: "Cancelled" },
      });

      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/Installing replacement access point/i)).toBeInTheDocument();
      });

      const cancelBtn = screen.getByRole("button", { name: /Cancel Action/i });
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect((staffApi as any).updateTicketAction).toHaveBeenCalledWith(
          "mock-jwt-token",
          "tkt-001",
          "act-002",
          expect.objectContaining({
            status: "Cancelled",
            expectedUpdatedAt: "2026-10-11T10:05:00.000Z",
          })
        );
      });
    });
  });

  // =========================================================================
  // 4. Ticket Status and Resolution Gate Workflow
  // =========================================================================
  describe("4. Ticket Status and Resolution Gate Workflow", () => {
    it("RES-UI-01: Status transition dropdown offers only permitted next statuses for Open ticket", async () => {
      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      const select = await screen.findByLabelText(/Status Transition/i);
      expect(select).toBeInTheDocument();

      const options = Array.from((select as HTMLSelectElement).options).map((o) => o.value);
      // Permitted next from Open: In Progress, Waiting for Requester, Resolved, Cancelled
      expect(options).toContain("In Progress");
      expect(options).toContain("Waiting for Requester");
      expect(options).toContain("Resolved");
      expect(options).toContain("Cancelled");
      // Prohibited from Open
      expect(options).not.toContain("New");
      expect(options).not.toContain("Closed");
      expect(options).not.toContain("Reopened");
    });

    it("RES-UI-02: Selecting 'Resolved' opens the Ticket Resolution Form requiring a Resolution Summary", async () => {
      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      const select = await screen.findByLabelText(/Status Transition/i);
      fireEvent.change(select, { target: { value: "Resolved" } });

      const transitionBtn = screen.getByRole("button", { name: /Transition/i });
      fireEvent.click(transitionBtn);

      // Resolution Form / Modal should appear
      expect(await screen.findByLabelText(/Resolution Summary/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirm Resolution/i })).toBeInTheDocument();
    });

    it("RES-UI-03: Resolution Form displays completed actions count/evidence and warns if missing", async () => {
      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      const select = await screen.findByLabelText(/Status Transition/i);
      fireEvent.change(select, { target: { value: "Resolved" } });
      fireEvent.click(screen.getByRole("button", { name: /Transition/i }));

      // Summary of completed actions must be visible
      expect(await screen.findByText(/1 completed action/i)).toBeInTheDocument();
    });

    it("RES-UI-04: Resolution Form rejects blank Resolution Summary", async () => {
      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      const select = await screen.findByLabelText(/Status Transition/i);
      fireEvent.change(select, { target: { value: "Resolved" } });
      fireEvent.click(screen.getByRole("button", { name: /Transition/i }));

      const confirmBtn = await screen.findByRole("button", { name: /Confirm Resolution/i });
      fireEvent.click(confirmBtn);

      expect(await screen.findByText(/Resolution summary is required/i)).toBeInTheDocument();
      expect(staffApi.updateStaffTicketStatus).not.toHaveBeenCalled();
    });

    it("RES-UI-05: Submitting Resolution Form sends status, resolutionSummary, and expectedUpdatedAt", async () => {
      vi.mocked(staffApi.updateStaffTicketStatus).mockResolvedValue({
        ticket: {
          id: "tkt-001",
          status: "Resolved",
          resolutionSummary: "Replaced AP-2B radio module and verified 5GHz signal.",
          updatedAt: "2026-10-11T10:30:00.000Z",
        } as any,
      });

      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      const select = await screen.findByLabelText(/Status Transition/i);
      fireEvent.change(select, { target: { value: "Resolved" } });
      fireEvent.click(screen.getByRole("button", { name: /Transition/i }));

      const summaryInput = await screen.findByLabelText(/Resolution Summary/i);
      fireEvent.change(summaryInput, {
        target: { value: "Replaced AP-2B radio module and verified 5GHz signal." },
      });

      const confirmBtn = screen.getByRole("button", { name: /Confirm Resolution/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(staffApi.updateStaffTicketStatus).toHaveBeenCalledWith(
          "mock-jwt-token",
          "tkt-001",
          "Resolved",
          "2026-10-11T09:30:00.000Z", // expectedUpdatedAt
          "Replaced AP-2B radio module and verified 5GHz signal." // resolutionSummary
        );
      });
    });

    it("RES-UI-06: Non-Resolved status transitions include expectedUpdatedAt for concurrency protection", async () => {
      vi.mocked(staffApi.updateStaffTicketStatus).mockResolvedValue({
        ticket: { id: "tkt-001", status: "In Progress" },
      });

      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      const select = await screen.findByLabelText(/Status Transition/i);
      fireEvent.change(select, { target: { value: "In Progress" } });

      const transitionBtn = screen.getByRole("button", { name: /Transition/i });
      fireEvent.click(transitionBtn);

      await waitFor(() => {
        expect(staffApi.updateStaffTicketStatus).toHaveBeenCalledWith(
          "mock-jwt-token",
          "tkt-001",
          "In Progress",
          "2026-10-11T09:30:00.000Z" // expectedUpdatedAt must be supplied by Lab 4 UI!
        );
      });
    });

    it("RES-UI-07: Displays saved Resolution Summary when ticket is Resolved", async () => {
      vi.mocked(staffApi.fetchStaffTicketDetail).mockResolvedValue(mockResolvedTicketResponse);

      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Resolved")).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Replaced faulty wireless access point AP-2B and verified signal stability/i)
      ).toBeInTheDocument();
    });

    it("RES-UI-08: Displays HTTP 400 validation error in Resolution Form when server rejects resolution", async () => {
      vi.mocked(staffApi.updateStaffTicketStatus).mockRejectedValueOnce(
        new Error("Cannot resolve ticket without at least one completed action taken.")
      );

      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      const select = await screen.findByLabelText(/Status Transition/i);
      fireEvent.change(select, { target: { value: "Resolved" } });
      fireEvent.click(screen.getByRole("button", { name: /Transition/i }));

      const summaryInput = await screen.findByLabelText(/Resolution Summary/i);
      fireEvent.change(summaryInput, {
        target: { value: "Attempting resolution with server rejection." },
      });

      const confirmBtn = screen.getByRole("button", { name: /Confirm Resolution/i });
      fireEvent.click(confirmBtn);

      expect(
        await screen.findByText(/Cannot resolve ticket without at least one completed action taken/i)
      ).toBeInTheDocument();
    });

    it("RES-UI-09: Displays HTTP 409 conflict feedback when ticket was concurrently modified during status transition", async () => {
      vi.mocked(staffApi.updateStaffTicketStatus).mockRejectedValueOnce(
        new Error("Ticket was modified concurrently by another user. Stale update rejected.")
      );

      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      const select = await screen.findByLabelText(/Status Transition/i);
      fireEvent.change(select, { target: { value: "In Progress" } });

      const transitionBtn = screen.getByRole("button", { name: /Transition/i });
      fireEvent.click(transitionBtn);

      expect(
        await screen.findByText(/Ticket was modified concurrently by another user/i)
      ).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 5. Administrator Role Access & Regression
  // =========================================================================
  describe("5. Administrator Role Access & Regression", () => {
    it("REG-UI-01: Administrator has full access to Actions Taken management and status transitions", async () => {
      vi.spyOn(authContext, "useAuth").mockReturnValue({
        user: mockAdminUser,
        token: "admin-jwt-token",
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        changePassword: vi.fn(),
        clearError: vi.fn(),
      });

      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      expect(await screen.findByRole("button", { name: /Add Action Taken/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Status Transition/i)).toBeInTheDocument();
    });

    it("REG-UI-02: Preserves Public Comments, Internal Notes, and Attachments in StaffTicketDetail", async () => {
      render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

      expect(await screen.findByPlaceholderText(/Write a public comment/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Write an internal note/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Upload Attachment/i)).toBeInTheDocument();
    });
  });
});
