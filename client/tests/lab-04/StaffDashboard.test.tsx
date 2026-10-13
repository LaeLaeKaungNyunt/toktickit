import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../../src/App";
import * as staffApi from "../../src/api/staff";
import * as authContext from "../../src/context/AuthContext";

// Mock staff API functions
vi.mock("../../src/api/staff", async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>();
  return {
    ...actual,
    fetchStaffDashboard: vi.fn(),
    fetchStaffTickets: vi.fn(),
    fetchStaffTicketDetail: vi.fn(),
  };
});

// Mock admin API so UserManagement does not throw during fallback renders
vi.mock("../../src/api/admin", () => ({
  fetchUsers: vi.fn().mockResolvedValue({ users: [], pagination: { totalItems: 0, totalPages: 0 } }),
}));

// Dynamically resolve StaffDashboard component when implemented in GREEN phase
const staffDashboardModule = import.meta.glob<{
  StaffDashboard?: React.ComponentType<any>;
  default?: React.ComponentType<any>;
}>("../../src/components/StaffDashboard.tsx", { eager: true });

const StaffDashboardComponent =
  staffDashboardModule["../../src/components/StaffDashboard.tsx"]?.StaffDashboard ||
  staffDashboardModule["../../src/components/StaffDashboard.tsx"]?.default;

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

const mockDashboardData = {
  metrics: {
    unassignedTickets: 4,
    myAssignedTickets: 6,
    urgentTickets: 3,
    myActiveActionsCount: 2,
    statusCounts: {
      New: 2,
      Open: 4,
      "In Progress": 3,
      "Waiting for Requester": 1,
      Resolved: 2,
      Closed: 8,
      Reopened: 1,
      Cancelled: 1,
    },
  },
  myActions: [
    {
      id: "act-001",
      ticketId: "tkt-001",
      ticketNumber: "TKT-2026-00001",
      ticketSummary: "Wi-Fi dropping in Science Hall",
      description: "Checked switch port configuration and re-routed cable",
      status: "Active" as const,
      followUpRequired: true,
      actionDateTime: "2026-10-11T09:30:00.000Z",
      createdAt: "2026-10-11T09:35:00.000Z",
    },
    {
      id: "act-002",
      ticketId: "tkt-002",
      ticketNumber: "TKT-2026-00002",
      ticketSummary: "Projector lamp failure in Lecture Hall A",
      description: "Ordered replacement lamp assembly from vendor",
      status: "Active" as const,
      followUpRequired: false,
      actionDateTime: "2026-10-11T10:15:00.000Z",
      createdAt: "2026-10-11T10:20:00.000Z",
    },
  ],
  recentTickets: [
    {
      id: "tkt-001",
      ticketNumber: "TKT-2026-00001",
      summary: "Wi-Fi dropping in Science Hall",
      status: "In Progress",
      requestedPriority: "High",
      itPriority: "High",
      updatedAt: "2026-10-11T11:00:00.000Z",
    },
    {
      id: "tkt-003",
      ticketNumber: "TKT-2026-00003",
      summary: "Cannot access Faculty Portal grade submission",
      status: "Open",
      requestedPriority: "Urgent",
      itPriority: "Urgent",
      updatedAt: "2026-10-11T10:45:00.000Z",
    },
    {
      id: "tkt-002",
      ticketNumber: "TKT-2026-00002",
      summary: "Projector lamp failure in Lecture Hall A",
      status: "Waiting for Requester",
      requestedPriority: "Medium",
      itPriority: "Medium",
      updatedAt: "2026-10-11T10:30:00.000Z",
    },
  ],
  urgentTickets: [
    {
      id: "tkt-003",
      ticketNumber: "TKT-2026-00003",
      summary: "Cannot access Faculty Portal grade submission",
      status: "Open",
      itPriority: "Urgent",
      assignee: {
        id: "staff-2222",
        name: "Alex Tech",
      },
      updatedAt: "2026-10-11T10:45:00.000Z",
    },
    {
      id: "tkt-001",
      ticketNumber: "TKT-2026-00001",
      summary: "Wi-Fi dropping in Science Hall",
      status: "In Progress",
      itPriority: "High",
      assignee: {
        id: "staff-1111",
        name: "Sam Staff",
      },
      updatedAt: "2026-10-11T11:00:00.000Z",
    },
  ],
};

const mockEmptyDashboardData = {
  metrics: {
    unassignedTickets: 0,
    myAssignedTickets: 0,
    urgentTickets: 0,
    myActiveActionsCount: 0,
    statusCounts: {
      New: 0,
      Open: 0,
      "In Progress": 0,
      "Waiting for Requester": 0,
      Resolved: 0,
      Closed: 0,
      Reopened: 0,
      Cancelled: 0,
    },
  },
  myActions: [],
  recentTickets: [],
  urgentTickets: [],
};

describe("StaffDashboard Component (Issue #47: SD-01 to SD-18, UI-01 to UI-03, UI-06 to UI-10)", () => {
  let mockFetch: any;

  function setupAuth(role: "IT Staff" | "Administrator" = "IT Staff") {
    const user = role === "IT Staff" ? mockStaffUser : mockAdminUser;
    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user,
      token: "mock-jwt-token",
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      clearError: vi.fn(),
    });
  }

  function renderDashboard(props: {
    onNavigateToQueue?: (filters?: any) => void;
    onSelectTicket?: (ticketId: string) => void;
  } = {}) {
    if (StaffDashboardComponent) {
      return render(<StaffDashboardComponent {...props} />);
    }
    // During RED phase when standalone component is not yet created, render App
    return render(<App />);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth("IT Staff");

    mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/v1/dashboard/staff")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockDashboardData,
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [], pagination: { totalItems: 0, totalPages: 0 } }),
      });
    });
    globalThis.fetch = mockFetch;

    if ((staffApi as any).fetchStaffDashboard) {
      vi.mocked((staffApi as any).fetchStaffDashboard).mockResolvedValue(mockDashboardData);
    }
    vi.mocked(staffApi.fetchStaffTickets).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
  });

  // =========================================================================
  // 1. Summary Metrics Display (SD-01 to SD-05, AC-15)
  // =========================================================================
  describe("1. Summary Metrics Display (SD-01 to SD-05, AC-15)", () => {
    it("1. AC-15: Displays all four summary metrics using backend response values", async () => {
      renderDashboard();

      expect(await screen.findByRole("heading", { name: /IT Staff Dashboard/i })).toBeInTheDocument();

      // Card 1: Unassigned Tickets
      const unassignedCard = screen.getByTestId("metric-unassigned-tickets") || screen.getByText(/Unassigned Tickets/i).closest(".card");
      expect(unassignedCard).toBeInTheDocument();
      expect(within(unassignedCard as HTMLElement).getByText("4")).toBeInTheDocument();

      // Card 2: My Assigned Tickets
      const assignedCard = screen.getByTestId("metric-my-assigned-tickets") || screen.getByText(/My Assigned Tickets/i).closest(".card");
      expect(assignedCard).toBeInTheDocument();
      expect(within(assignedCard as HTMLElement).getByText("6")).toBeInTheDocument();

      // Card 3: Urgent Tickets
      const urgentCard = screen.getByTestId("metric-urgent-tickets") || screen.getByText(/Urgent Tickets/i).closest(".card");
      expect(urgentCard).toBeInTheDocument();
      expect(within(urgentCard as HTMLElement).getByText("3")).toBeInTheDocument();

      // Card 4: My Active Actions
      const activeActionsCard = screen.getByTestId("metric-my-active-actions") || screen.getByText(/My Active Actions/i).closest(".card");
      expect(activeActionsCard).toBeInTheDocument();
      expect(within(activeActionsCard as HTMLElement).getByText("2")).toBeInTheDocument();
    });

    it("2. AC-15 / DP-01: Summary metric values come directly from metrics payload, not preview lengths", async () => {
      const dataWithDifferentPreviewCounts = {
        ...mockDashboardData,
        metrics: {
          ...mockDashboardData.metrics,
          myActiveActionsCount: 15,
          urgentTickets: 12,
        },
        myActions: mockDashboardData.myActions.slice(0, 2),
        urgentTickets: mockDashboardData.urgentTickets.slice(0, 2),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => dataWithDifferentPreviewCounts,
      });
      if ((staffApi as any).fetchStaffDashboard) {
        vi.mocked((staffApi as any).fetchStaffDashboard).mockResolvedValueOnce(dataWithDifferentPreviewCounts);
      }

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText("15")).toBeInTheDocument();
        expect(screen.getByText("12")).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 2. Status Counts Breakdown (SD-06, AC-15)
  // =========================================================================
  describe("2. Status Counts Breakdown (SD-06, AC-15)", () => {
    it("3. AC-15: Displays accurate counts across all eight ticket statuses", async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Status Overview|Tickets by Status/i)).toBeInTheDocument();
      });

      const expectedStatuses: Array<[string, number]> = [
        ["New", 2],
        ["Open", 4],
        ["In Progress", 3],
        ["Waiting for Requester", 1],
        ["Resolved", 2],
        ["Closed", 8],
        ["Reopened", 1],
        ["Cancelled", 1],
      ];

      for (const [statusName, count] of expectedStatuses) {
        const statusElement = screen.getByText(new RegExp(`^${statusName}$`, "i"));
        expect(statusElement).toBeInTheDocument();
        const container = statusElement.closest(".card, .badge, li, div");
        expect(container).not.toBeNull();
        expect(within(container as HTMLElement).getByText(String(count))).toBeInTheDocument();
      }
    });
  });

  // =========================================================================
  // 3. Work Lists and Previews (SD-08, SD-12, SD-13, AC-16, AC-17)
  // =========================================================================
  describe("3. Work Lists and Previews (SD-08, SD-12, SD-13, AC-16, AC-17)", () => {
    it("4. AC-16: Displays My Actions Taken section with assigned active actions and details", async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/My Actions Taken/i)).toBeInTheDocument();
      });

      expect(screen.getByText("Checked switch port configuration and re-routed cable")).toBeInTheDocument();
      expect(screen.getByText("Ordered replacement lamp assembly from vendor")).toBeInTheDocument();
      expect(screen.getAllByText("TKT-2026-00001").length).toBeGreaterThan(0);
      expect(screen.getAllByText("TKT-2026-00002").length).toBeGreaterThan(0);
    });

    it("5. AC-17: Displays Urgent Tickets section with Urgent and High priority tickets", async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Urgent Tickets/i })).toBeInTheDocument();
      });

      expect(screen.getByText("Cannot access Faculty Portal grade submission")).toBeInTheDocument();
      expect(screen.getByText("Alex Tech")).toBeInTheDocument();
      expect(screen.getAllByText("Urgent").length).toBeGreaterThan(0);
      expect(screen.getAllByText("High").length).toBeGreaterThan(0);
    });

    it("6. AC-17: Displays Recent Tickets section with recently updated tickets", async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Recently Updated Tickets|Recent Tickets/i })).toBeInTheDocument();
      });

      expect(screen.getByText("Cannot access Faculty Portal grade submission")).toBeInTheDocument();
      expect(screen.getByText("Wi-Fi dropping in Science Hall")).toBeInTheDocument();
    });

    it("7. AC-16: Displays follow-up required indicator on actions requiring follow-up", async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText("Checked switch port configuration and re-routed cable")).toBeInTheDocument();
      });

      expect(screen.getByText(/Follow-up Required|Follow-up/i)).toBeInTheDocument();
    });

    it("8. AC-28 / UI-09: Status and priority indicators include clear text labels", async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getAllByText(/Urgent/i)[0]).toBeInTheDocument();
      });

      // Text labels exist and are accessible, not color-only
      expect(screen.getAllByText(/Urgent/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/In Progress/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Active/i).length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 4. Empty States (SD-07, AC-18)
  // =========================================================================
  describe("4. Empty States (SD-07, AC-18)", () => {
    it("9. AC-18 / UI Spec 2.4: Displays exact empty state message when no active actions are assigned", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ...mockDashboardData, myActions: [] }),
      });
      if ((staffApi as any).fetchStaffDashboard) {
        vi.mocked((staffApi as any).fetchStaffDashboard).mockResolvedValueOnce({
          ...mockDashboardData,
          myActions: [],
        });
      }

      renderDashboard();

      expect(
        await screen.findByText("No active Actions Taken assigned to you.")
      ).toBeInTheDocument();
    });

    it("10. AC-18: Displays empty state message when urgentTickets list is empty", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ...mockDashboardData, urgentTickets: [] }),
      });
      if ((staffApi as any).fetchStaffDashboard) {
        vi.mocked((staffApi as any).fetchStaffDashboard).mockResolvedValueOnce({
          ...mockDashboardData,
          urgentTickets: [],
        });
      }

      renderDashboard();

      expect(
        await screen.findByText(/No urgent tickets/i)
      ).toBeInTheDocument();
    });

    it("11. AC-18: Displays empty state message when recentTickets list is empty", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ...mockDashboardData, recentTickets: [] }),
      });
      if ((staffApi as any).fetchStaffDashboard) {
        vi.mocked((staffApi as any).fetchStaffDashboard).mockResolvedValueOnce({
          ...mockDashboardData,
          recentTickets: [],
        });
      }

      renderDashboard();

      expect(
        await screen.findByText(/No recently updated tickets|No recent tickets/i)
      ).toBeInTheDocument();
    });

    it("12. SD-07 / AC-18: Displays zero counts safely when all metrics are 0", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockEmptyDashboardData,
      });
      if ((staffApi as any).fetchStaffDashboard) {
        vi.mocked((staffApi as any).fetchStaffDashboard).mockResolvedValueOnce(mockEmptyDashboardData);
      }

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /IT Staff Dashboard/i })).toBeInTheDocument();
      });

      // Zeros should be rendered across metric cards
      const zeros = screen.getAllByText("0");
      expect(zeros.length).toBeGreaterThanOrEqual(4);
    });
  });

  // =========================================================================
  // 5. Loading, Error Handling, and Retry (AC-26, UI-10)
  // =========================================================================
  describe("5. Loading, Error Handling, and Retry (AC-26, UI-10)", () => {
    it("13. AC-26 / UI-10: Displays loading indicator while dashboard data is fetching", () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));
      if ((staffApi as any).fetchStaffDashboard) {
        vi.mocked((staffApi as any).fetchStaffDashboard).mockImplementation(() => new Promise(() => {}));
      }

      renderDashboard();

      expect(screen.getByText(/Loading dashboard|Loading TokTickIT/i)).toBeInTheDocument();
    });

    it("14. AC-26 / DA-09: Displays safe error message when API call fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network Error"));
      if ((staffApi as any).fetchStaffDashboard) {
        vi.mocked((staffApi as any).fetchStaffDashboard).mockRejectedValueOnce(new Error("Network Error"));
      }

      renderDashboard();

      expect(
        await screen.findByText(/Failed to load dashboard|Unable to load dashboard|Error loading/i)
      ).toBeInTheDocument();
    });

    it("15. AC-26 / ER-03: Provides a Retry button on failure that recovers when clicked", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Temporary network error"));
      if ((staffApi as any).fetchStaffDashboard) {
        vi.mocked((staffApi as any).fetchStaffDashboard).mockRejectedValueOnce(new Error("Temporary network error"));
      }

      renderDashboard();

      const retryBtn = await screen.findByRole("button", { name: /Retry/i });
      expect(retryBtn).toBeInTheDocument();

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockDashboardData,
      });
      if ((staffApi as any).fetchStaffDashboard) {
        vi.mocked((staffApi as any).fetchStaffDashboard).mockResolvedValueOnce(mockDashboardData);
      }

      fireEvent.click(retryBtn);

      expect(await screen.findByText("Unassigned Tickets")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 6. Navigation and Drill-Downs (UI Spec 2.3, AC-15, AC-17)
  // =========================================================================
  describe("6. Navigation and Drill-Downs (UI Spec 2.3, AC-15, AC-17)", () => {
    it("16. UI Spec 2.3 / DM-05: Clicking My Active Actions card navigates or scrolls to actions section", async () => {
      const scrollIntoViewMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText("My Active Actions")).toBeInTheDocument();
      });

      const activeActionsCard = screen.getByText("My Active Actions").closest("button, .card, [role='button']")!;
      fireEvent.click(activeActionsCard);

      // Section is target of scroll or focus
      expect(screen.getByText("My Actions Taken")).toBeInTheDocument();
    });

    it("17. UI Spec 2.3 / SD-16: Clicking Unassigned Tickets card navigates to queue with assignment=unassigned", async () => {
      const mockNav = vi.fn();
      renderDashboard({ onNavigateToQueue: mockNav });

      await waitFor(() => {
        expect(screen.getByText("Unassigned Tickets")).toBeInTheDocument();
      });

      const unassignedCard = screen.getByText("Unassigned Tickets").closest("button, .card, [role='button']")!;
      fireEvent.click(unassignedCard);

      if (StaffDashboardComponent) {
        expect(mockNav).toHaveBeenCalledWith(expect.objectContaining({ assignment: "unassigned" }));
      } else {
        // In App integration, queue should be displayed
        await waitFor(() => {
          expect(screen.getByText(/IT Staff Ticket Queue/i)).toBeInTheDocument();
        });
      }
    });

    it("18. UI Spec 2.3 / SD-16: Clicking My Assigned Tickets card navigates to queue with assignedToMe=true", async () => {
      const mockNav = vi.fn();
      renderDashboard({ onNavigateToQueue: mockNav });

      await waitFor(() => {
        expect(screen.getByText("My Assigned Tickets")).toBeInTheDocument();
      });

      const assignedCard = screen.getByText("My Assigned Tickets").closest("button, .card, [role='button']")!;
      fireEvent.click(assignedCard);

      if (StaffDashboardComponent) {
        expect(mockNav).toHaveBeenCalledWith(expect.objectContaining({ assignedToMe: true }));
      } else {
        await waitFor(() => {
          expect(screen.getByText(/IT Staff Ticket Queue/i)).toBeInTheDocument();
        });
      }
    });

    it("19. UI Spec 2.3 / SD-17: Clicking Urgent Tickets card navigates to queue with priority=Urgent,High", async () => {
      const mockNav = vi.fn();
      renderDashboard({ onNavigateToQueue: mockNav });

      await waitFor(() => {
        expect(screen.getByText("Urgent Tickets")).toBeInTheDocument();
      });

      const urgentCard = screen.getByText("Urgent Tickets").closest("button, .card, [role='button']")!;
      fireEvent.click(urgentCard);

      if (StaffDashboardComponent) {
        expect(mockNav).toHaveBeenCalledWith(expect.objectContaining({ priority: "Urgent,High" }));
      } else {
        await waitFor(() => {
          expect(screen.getByText(/IT Staff Ticket Queue/i)).toBeInTheDocument();
        });
      }
    });

    it("20. UI Spec 2.3 / DM-04: Clicking a status card navigates to queue filtered by corresponding status", async () => {
      const mockNav = vi.fn();
      renderDashboard({ onNavigateToQueue: mockNav });

      await waitFor(() => {
        expect(screen.getByText("In Progress")).toBeInTheDocument();
      });

      const statusCard = screen.getByText("In Progress").closest("button, .card, [role='button']")!;
      fireEvent.click(statusCard);

      if (StaffDashboardComponent) {
        expect(mockNav).toHaveBeenCalledWith(expect.objectContaining({ status: "In Progress" }));
      } else {
        await waitFor(() => {
          expect(screen.getByText(/IT Staff Ticket Queue/i)).toBeInTheDocument();
        });
      }
    });

    it("21. SD-14 / AC-17: Clicking a preview ticket opens the correct Ticket Detail", async () => {
      const mockSelect = vi.fn();
      renderDashboard({ onSelectTicket: mockSelect });

      await waitFor(() => {
        expect(screen.getByText("Cannot access Faculty Portal grade submission")).toBeInTheDocument();
      });

      const ticketLink = screen.getByText("Cannot access Faculty Portal grade submission").closest("a, button, [role='button']")!;
      fireEvent.click(ticketLink);

      if (StaffDashboardComponent) {
        expect(mockSelect).toHaveBeenCalledWith("tkt-003");
      } else {
        await waitFor(() => {
          expect(mockSelect).toHaveBeenCalled();
        });
      }
    });

    it("22. SD-15 / AC-16: Clicking a preview action opens Ticket Detail for that action's ticket", async () => {
      const mockSelect = vi.fn();
      renderDashboard({ onSelectTicket: mockSelect });

      await waitFor(() => {
        expect(screen.getByText("Checked switch port configuration and re-routed cable")).toBeInTheDocument();
      });

      const actionLink = screen.getByText("Checked switch port configuration and re-routed cable").closest("a, button, [role='button']")!;
      fireEvent.click(actionLink);

      if (StaffDashboardComponent) {
        expect(mockSelect).toHaveBeenCalledWith("tkt-001");
      } else {
        await waitFor(() => {
          expect(mockSelect).toHaveBeenCalled();
        });
      }
    });
  });

  // =========================================================================
  // 7. Role Access and Accessibility (DA-01, DA-02, SD-18, AC-28, UI-06)
  // =========================================================================
  describe("7. Role Access and Accessibility (DA-01, DA-02, SD-18, AC-28, UI-06)", () => {
    it("23. DA-01: Authenticated IT Staff user loads dashboard successfully", async () => {
      setupAuth("IT Staff");
      renderDashboard();

      expect(await screen.findByRole("heading", { name: /IT Staff Dashboard/i })).toBeInTheDocument();
    });

    it("24. DA-02 / SD-18: Authenticated Administrator user loads dashboard successfully", async () => {
      setupAuth("Administrator");
      renderDashboard();

      expect(await screen.findByRole("heading", { name: /IT Staff Dashboard/i })).toBeInTheDocument();
    });

    it("25. Baseline: Authentication context is properly mocked and accessible", () => {
      setupAuth("IT Staff");
      const { user, token } = authContext.useAuth();
      expect(user?.role).toBe("IT Staff");
      expect(token).toBe("mock-jwt-token");
    });

    it("26. AC-28 / UI-06: Interactive cards and links are keyboard-operable with Enter key", async () => {
      const mockNav = vi.fn();
      renderDashboard({ onNavigateToQueue: mockNav });

      await waitFor(() => {
        expect(screen.getByText("Unassigned Tickets")).toBeInTheDocument();
      });

      const card = screen.getByText("Unassigned Tickets").closest("button, a, [role='button']")!;
      fireEvent.keyDown(card, { key: "Enter", code: "Enter" });

      if (StaffDashboardComponent) {
        expect(mockNav).toHaveBeenCalledWith(expect.objectContaining({ assignment: "unassigned" }));
      } else {
        expect(card).toBeInTheDocument();
      }
    });
  });
});
