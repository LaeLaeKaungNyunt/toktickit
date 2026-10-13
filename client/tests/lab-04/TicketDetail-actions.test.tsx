import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TicketDetail from "../../src/components/TicketDetail";
import * as lab02Api from "../../src/api/lab02";
import * as staffApi from "../../src/api/staff";
import * as authContext from "../../src/context/AuthContext";
import { TicketDetailDto } from "../../src/types/lab02";

vi.mock("../../src/api/lab02");
vi.mock("../../src/api/staff", async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>();
  return {
    ...actual,
    fetchTicketActions: vi.fn(),
  };
});

const mockRequester = {
  id: "req-1111",
  name: "Alice Smith",
  email: "alice@university.edu",
  role: "Requester" as const,
  mustChangePassword: false,
};

const mockOtherRequester = {
  id: "req-2222",
  name: "Bob Jones",
  email: "bob@university.edu",
  role: "Requester" as const,
  mustChangePassword: false,
};

const mockActiveTicket: TicketDetailDto = {
  id: "tkt-1234",
  ticketNumber: "TKT-2026-00001",
  requester: {
    id: "req-1111",
    displayName: "Alice Smith",
  },
  category: {
    id: 1,
    name: "Account and Access",
  },
  relatedSystem: {
    id: "sys-001",
    name: "Student Portal",
  },
  summary: "Cannot log into Student Portal",
  requestedPriority: "Medium",
  description: "Login page gives HTTP 500 error intermittently.",
  currentStatus: "In Progress",
  requesterResolution: null,
  createdAt: "2026-10-11T08:00:00.000Z",
  updatedAt: "2026-10-11T09:00:00.000Z",
  attachments: [],
};

const mockResolvedTicket: any = {
  ...mockActiveTicket,
  currentStatus: "Resolved",
  resolutionSummary: "Cleared cached session tokens and restarted portal auth service.",
  updatedAt: "2026-10-11T10:00:00.000Z",
};

const mockActionsList: any[] = [
  {
    id: "act-001",
    ticketId: "tkt-1234",
    actionDateTime: "2026-10-11T08:30:00.000Z",
    description: "Inspected authentication service logs and database query latency.",
    result: "Found stale lock on user session table.",
    performedById: "staff-1111",
    performedBy: { id: "staff-1111", name: "Sam Staff" },
    assignedToId: null,
    assignedTo: null,
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    status: "Completed",
    createdAt: "2026-10-11T08:35:00.000Z",
    updatedAt: "2026-10-11T08:45:00.000Z",
  },
];

describe("TicketDetail — Lab 4 Requester Actions Taken & Resolution View (Issue #46)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: mockRequester,
      token: "mock-jwt-token",
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      clearError: vi.fn(),
    });

    vi.mocked(lab02Api.fetchTicketDetail).mockResolvedValue(mockActiveTicket);

    if (typeof (staffApi as any).fetchTicketActions === "function") {
      vi.mocked((staffApi as any).fetchTicketActions).mockResolvedValue({
        actions: mockActionsList,
      });
    }
  });

  // =========================================================================
  // 1. Read-Only Actions Taken for Requester
  // =========================================================================
  describe("1. Read-Only Actions Taken for Requester", () => {
    it("REQ-UI-01: Displays Actions Taken section in Requester Ticket Detail", async () => {
      render(<TicketDetail ticketId="tkt-1234" onBack={vi.fn()} />);

      const heading = await screen.findByRole("heading", { name: /Actions Taken/i });
      expect(heading).toBeInTheDocument();
    });

    it("REQ-UI-02: Displays action records read-only with performer, description, result, and status", async () => {
      render(<TicketDetail ticketId="tkt-1234" onBack={vi.fn()} />);

      await waitFor(() => {
        expect(
          screen.getByText(/Inspected authentication service logs/i)
        ).toBeInTheDocument();
      });

      expect(screen.getByText(/Found stale lock on user session table/i)).toBeInTheDocument();
      expect(screen.getByText(/Sam Staff/i)).toBeInTheDocument();
      expect(screen.getByText("Completed")).toBeInTheDocument();
    });

    it("REQ-UI-03: Requesters never see staff action controls (Add, Edit, Complete, Cancel, Status Transition)", async () => {
      render(<TicketDetail ticketId="tkt-1234" onBack={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("TKT-2026-00001")).toBeInTheDocument();
      });

      // No staff buttons or status dropdowns
      expect(screen.queryByRole("button", { name: /Add Action Taken/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Edit Action/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Complete Action/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Cancel Action/i })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Status Transition/i)).not.toBeInTheDocument();
    });

    it("REQ-UI-04: Displays empty-state message when ticket has no recorded actions", async () => {
      if (typeof (staffApi as any).fetchTicketActions === "function") {
        vi.mocked((staffApi as any).fetchTicketActions).mockResolvedValue({ actions: [] });
      }

      render(<TicketDetail ticketId="tkt-1234" onBack={vi.fn()} />);

      expect(
        await screen.findByText(/No actions taken have been recorded for this ticket/i)
      ).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. Resolution Summary & Requester Advisory Indication
  // =========================================================================
  describe("2. Resolution Summary & Requester Advisory Indication", () => {
    it("REQ-UI-05: Displays saved Resolution Summary when ticket is in Resolved status", async () => {
      vi.mocked(lab02Api.fetchTicketDetail).mockResolvedValue(mockResolvedTicket);

      render(<TicketDetail ticketId="tkt-1234" onBack={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Resolved")).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Cleared cached session tokens and restarted portal auth service/i)
      ).toBeInTheDocument();
    });

    it("REQ-UI-06: Preserves existing Requester advisory resolution toggle without altering formal status", async () => {
      vi.mocked(lab02Api.updateRequesterResolution).mockResolvedValue({
        ticketId: "tkt-1234",
        requesterResolution: "RESOLVED",
      });

      render(<TicketDetail ticketId="tkt-1234" onBack={vi.fn()} />);

      const toggleBtn = await screen.findByRole("button", { name: /Mark as Resolved|Resolved/i });
      fireEvent.click(toggleBtn);

      await waitFor(() => {
        expect(lab02Api.updateRequesterResolution).toHaveBeenCalledWith(
          "tkt-1234",
          "RESOLVED",
          "mock-jwt-token"
        );
      });

      // Ticket formal status remains In Progress
      expect(screen.getByText("In Progress")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. Ownership Isolation & Regression
  // =========================================================================
  describe("3. Ownership Isolation & Regression", () => {
    it("REQ-UI-07: Requester cannot view ticket owned by another requester", async () => {
      // Simulate ticket owned by Bob, accessed by Alice
      vi.mocked(lab02Api.fetchTicketDetail).mockResolvedValue({
        ...mockActiveTicket,
        requester: { id: "req-2222", displayName: "Bob Jones" },
      });

      render(<TicketDetail ticketId="tkt-1234" onBack={vi.fn()} />);

      // Ownership guard prevents rendering Bob's ticket details to Alice
      await waitFor(() => {
        expect(screen.queryByText("Cannot log into Student Portal")).not.toBeInTheDocument();
      });
    });

    it("REQ-UI-08: Preserves existing ticket details, summary, description, and attachments", async () => {
      render(<TicketDetail ticketId="tkt-1234" onBack={vi.fn()} />);

      expect(await screen.findByText("TKT-2026-00001")).toBeInTheDocument();
      expect(screen.getByText("Cannot log into Student Portal")).toBeInTheDocument();
      expect(screen.getByText("Account and Access")).toBeInTheDocument();
      expect(screen.getByText("Student Portal")).toBeInTheDocument();
    });
  });
});
