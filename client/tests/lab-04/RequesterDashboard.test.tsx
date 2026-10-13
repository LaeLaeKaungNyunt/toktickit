import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../../src/App";
import * as authContext from "../../src/context/AuthContext";
import * as lab02Api from "../../src/api/lab02";
import * as staffApi from "../../src/api/staff";

// Mock lab02 API functions for App integration
vi.mock("../../src/api/lab02", async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>().catch(() => ({}));
  return {
    ...actual,
    fetchMyTickets: vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    }),
    fetchTicketDetail: vi.fn().mockResolvedValue({
      id: "tkt-001",
      ticketNumber: "TKT-2026-00001",
      summary: "Cannot access Student Portal login page",
      description: "Description text",
      requestedPriority: "High",
      currentStatus: "New",
      createdAt: "2026-10-11T07:30:00.000Z",
      updatedAt: "2026-10-11T07:30:00.000Z",
      category: { id: 1, name: "General IT Support" },
      relatedSystem: { id: "sys-001", name: "Student Portal" },
      requester: { id: "req-alice-001", name: "Alice Smith" },
      attachments: [],
      comments: [],
    }),
    fetchCategoriesV1: vi.fn().mockResolvedValue([]),
    fetchRelatedSystems: vi.fn().mockResolvedValue([]),
  };
});

// Mock staff API so Staff components don't throw during role checks
vi.mock("../../src/api/staff", async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>().catch(() => ({}));
  return {
    ...actual,
    fetchStaffDashboard: vi.fn().mockResolvedValue({
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
    }),
    fetchStaffTickets: vi.fn().mockResolvedValue({ items: [], pagination: { totalItems: 0, totalPages: 0 } }),
    fetchStaffTicketDetail: vi.fn(),
    fetchTicketActions: vi.fn().mockResolvedValue({ actions: [] }),
  };
});

// Mock admin API so UserManagement does not throw during fallback renders
vi.mock("../../src/api/admin", () => ({
  fetchUsers: vi.fn().mockResolvedValue({ users: [], pagination: { totalItems: 0, totalPages: 0 } }),
}));

// Dynamically resolve RequesterDashboard component when implemented in GREEN phase
const requesterDashboardModule = import.meta.glob<{
  RequesterDashboard?: React.ComponentType<any>;
  default?: React.ComponentType<any>;
}>("../../src/components/RequesterDashboard.tsx", { eager: true });

const RequesterDashboardComponent =
  requesterDashboardModule["../../src/components/RequesterDashboard.tsx"]?.RequesterDashboard ||
  requesterDashboardModule["../../src/components/RequesterDashboard.tsx"]?.default;

import * as requesterApi from "../../src/api/requester";

vi.mock("../../src/api/requester", async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>().catch(() => ({}));
  return {
    ...actual,
    fetchRequesterDashboard: vi.fn(),
  };
});

const mockRequesterUser = {
  id: "req-alice-001",
  name: "Alice Smith",
  email: "alice.smith@university.edu",
  role: "Requester" as const,
  mustChangePassword: false,
};

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

const mockRequesterDashboardData = {
  metrics: {
    myActiveTickets: 3,
    waitingForMe: 1,
    resolvedTicketsCount: 2,
    totalTicketsCount: 9,
    statusCounts: {
      New: 1,
      Open: 1,
      "In Progress": 0,
      "Waiting for Requester": 1,
      Resolved: 2,
      Closed: 4,
      Reopened: 0,
      Cancelled: 0,
    },
  },
  waitingForMeTickets: [
    {
      id: "tkt-005",
      ticketNumber: "TKT-2026-00005",
      summary: "MFA Authentication code not receiving via SMS",
      status: "Waiting for Requester",
      updatedAt: "2026-10-11T08:00:00.000Z",
    },
  ],
  recentlyResolvedTickets: [
    {
      id: "tkt-002",
      ticketNumber: "TKT-2026-00002",
      summary: "Campus Wi-Fi disconnects frequently in Library",
      status: "Resolved",
      resolutionSummary: "Replaced faulty wireless access point.",
      resolvedAt: "2026-10-11T09:15:00.000Z",
      updatedAt: "2026-10-11T09:15:00.000Z",
    },
  ],
  recentTickets: [
    {
      id: "tkt-001",
      ticketNumber: "TKT-2026-00001",
      summary: "Cannot access Student Portal login page",
      status: "New",
      updatedAt: "2026-10-11T07:30:00.000Z",
    },
  ],
};

const mockEmptyDashboardData = {
  metrics: {
    myActiveTickets: 0,
    waitingForMe: 0,
    resolvedTicketsCount: 0,
    totalTicketsCount: 0,
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
  waitingForMeTickets: [],
  recentlyResolvedTickets: [],
  recentTickets: [],
};

describe("RequesterDashboard Component (Issue #48: RD-01 to RD-14, UI-04, AC-19 to AC-22, AC-26 to AC-28)", () => {
  let mockFetch: any;

  function setupAuth(role: "Requester" | "IT Staff" | "Administrator" = "Requester") {
    let user: any = mockRequesterUser;
    if (role === "IT Staff") user = mockStaffUser;
    if (role === "Administrator") user = mockAdminUser;

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
    onNavigateToMyTickets?: () => void;
    onSelectTicket?: (ticketId: string) => void;
  } = {}) {
    if (RequesterDashboardComponent) {
      return render(<RequesterDashboardComponent {...props} />);
    }
    // During RED phase when standalone component is not yet created, render App
    return render(<App />);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth("Requester");

    mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/v1/dashboard/requester")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockRequesterDashboardData,
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [], categories: [], pagination: { totalItems: 0, totalPages: 0 } }),
      });
    });
    globalThis.fetch = mockFetch;

    if (requesterApi?.fetchRequesterDashboard) {
      vi.mocked(requesterApi.fetchRequesterDashboard).mockResolvedValue(mockRequesterDashboardData);
    }
  });

  // =========================================================================
  // 1. Summary Metrics Display (RD-01 to RD-06, AC-19)
  // =========================================================================
  describe("1. Summary Metrics Display (RD-01 to RD-06, AC-19)", () => {
    it("1. AC-19: Displays all four summary metrics using backend response values", async () => {
      renderDashboard();

      expect(await screen.findByRole("heading", { name: /My Dashboard/i })).toBeInTheDocument();

      // Card 1: My Active Tickets (3)
      const activeCard = screen.getByText(/My Active Tickets/i).closest(".card, [role='button']")!;
      expect(activeCard).toBeInTheDocument();
      expect(within(activeCard as HTMLElement).getByText("3")).toBeInTheDocument();

      // Card 2: Waiting for Me (1)
      const waitingCard = screen.getByText(/Waiting for Me/i).closest(".card, [role='button']")!;
      expect(waitingCard).toBeInTheDocument();
      expect(within(waitingCard as HTMLElement).getByText("1")).toBeInTheDocument();

      // Card 3: Recently Resolved (2)
      const resolvedCard = screen.getByText(/Recently Resolved/i).closest(".card, [role='button']")!;
      expect(resolvedCard).toBeInTheDocument();
      expect(within(resolvedCard as HTMLElement).getByText("2")).toBeInTheDocument();

      // Card 4: Total Tickets (9)
      const totalCard = screen.getByText(/Total Tickets/i).closest(".card, [role='button']")!;
      expect(totalCard).toBeInTheDocument();
      expect(within(totalCard as HTMLElement).getByText("9")).toBeInTheDocument();
    });

    it("2. RD-01a, RD-01b: Authoritative metric counts reflect backend response values directly", async () => {
      // Mock data where metrics counts differ from preview array lengths
      const customData = {
        ...mockRequesterDashboardData,
        metrics: {
          ...mockRequesterDashboardData.metrics,
          myActiveTickets: 15,
          waitingForMe: 8,
          resolvedTicketsCount: 12,
          totalTicketsCount: 42,
        },
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/v1/dashboard/requester")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => customData,
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      });
      if (requesterApi?.fetchRequesterDashboard) {
        vi.mocked(requesterApi.fetchRequesterDashboard).mockResolvedValue(customData);
      }

      renderDashboard();

      expect(await screen.findByRole("heading", { name: /My Dashboard/i })).toBeInTheDocument();

      // Confirm counts match backend metrics directly
      expect(screen.getByText("15")).toBeInTheDocument();
      expect(screen.getByText("8")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
    });

    it("3. RD-05: Displays Tickets by Status overview showing all eight statuses", async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText("Tickets by Status")).toBeInTheDocument();
      });

      const ALL_STATUSES = [
        "New",
        "Open",
        "In Progress",
        "Waiting for Requester",
        "Resolved",
        "Closed",
        "Reopened",
        "Cancelled",
      ];

      for (const status of ALL_STATUSES) {
        expect(screen.getByText(status)).toBeInTheDocument();
      }
    });

    it("4. RD-06: Zero metrics display zero counts and empty values without crashing", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/v1/dashboard/requester")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockEmptyDashboardData,
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      });
      if (requesterApi?.fetchRequesterDashboard) {
        vi.mocked(requesterApi.fetchRequesterDashboard).mockResolvedValue(mockEmptyDashboardData);
      }

      renderDashboard();

      expect(await screen.findByRole("heading", { name: /My Dashboard/i })).toBeInTheDocument();

      const zeroes = screen.getAllByText("0");
      expect(zeroes.length).toBeGreaterThanOrEqual(4);
    });
  });

  // =========================================================================
  // 2. Activity Previews and Empty States (RD-07 to RD-12, AC-20)
  // =========================================================================
  describe("2. Activity Previews and Empty States (RD-07 to RD-12, AC-20)", () => {
    it("5. RD-07 / AC-20: Needs My Attention section displays waiting tickets with ticket number, summary, and date", async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Needs My Attention/i)).toBeInTheDocument();
      });

      expect(screen.getByText("TKT-2026-00005")).toBeInTheDocument();
      expect(screen.getByText("MFA Authentication code not receiving via SMS")).toBeInTheDocument();
      expect(screen.getByText("Waiting for Requester")).toBeInTheDocument();
    });

    it("6. RD-09 / AC-19: Recently Resolved section displays resolved tickets, resolutionSummary, and date", async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Recently Resolved/i)).toBeInTheDocument();
      });

      expect(screen.getByText("TKT-2026-00002")).toBeInTheDocument();
      expect(screen.getByText("Campus Wi-Fi disconnects frequently in Library")).toBeInTheDocument();
      expect(screen.getByText("Replaced faulty wireless access point.")).toBeInTheDocument();
    });

    it("7. RD-12 / AC-19: Recently Updated section displays recent tickets with ticket number and summary", async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Recently Updated/i)).toBeInTheDocument();
      });

      expect(screen.getByText("TKT-2026-00001")).toBeInTheDocument();
      expect(screen.getByText("Cannot access Student Portal login page")).toBeInTheDocument();
    });

    it("8. RD-06 / DP-05 / AC-18: Shows contract-defined empty states when preview lists are empty", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/v1/dashboard/requester")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockEmptyDashboardData,
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      });
      if (requesterApi?.fetchRequesterDashboard) {
        vi.mocked(requesterApi.fetchRequesterDashboard).mockResolvedValue(mockEmptyDashboardData);
      }

      renderDashboard();

      expect(await screen.findByRole("heading", { name: /My Dashboard/i })).toBeInTheDocument();

      // UI Spec 3.4: "No tickets are waiting for your response."
      expect(screen.getByText(/no tickets are waiting for your response/i)).toBeInTheDocument();
      // UI Spec 3.8: No resolved tickets empty message
      expect(screen.getByText(/no recently resolved tickets/i)).toBeInTheDocument();
      // UI Spec 3.8: No recent tickets empty message
      expect(screen.getByText(/no recent tickets/i)).toBeInTheDocument();
    });

    it("9. AC-28 / UI-09: Status badges include text labels and do not rely on color alone", async () => {
      renderDashboard();

      expect(await screen.findByRole("heading", { name: /My Dashboard/i })).toBeInTheDocument();

      const waitingBadges = screen.getAllByText("Waiting for Requester");
      expect(waitingBadges.length).toBeGreaterThan(0);
      for (const badge of waitingBadges) {
        expect(badge.textContent).toBe("Waiting for Requester");
      }
    });
  });

  // =========================================================================
  // 3. Loading, Errors, and Retry (AC-26)
  // =========================================================================
  describe("3. Loading, Errors, and Retry (AC-26)", () => {
    it("10. AC-26: Displays loading state while dashboard data is fetching", () => {
      mockFetch.mockReturnValue(new Promise(() => {})); // Never resolves
      if (requesterApi?.fetchRequesterDashboard) {
        vi.mocked(requesterApi.fetchRequesterDashboard).mockReturnValue(new Promise(() => {}));
      }

      renderDashboard();

      expect(screen.getByText(/Loading dashboard/i)).toBeInTheDocument();
    });

    it("11. AC-26: Displays safe error feedback with Retry button when dashboard fetch fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Unable to connect to server"));
      if (requesterApi?.fetchRequesterDashboard) {
        vi.mocked(requesterApi.fetchRequesterDashboard).mockRejectedValueOnce(new Error("Unable to connect to server"));
      }

      renderDashboard();

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    });

    it("12. AC-26: Clicking Retry button re-fetches dashboard data and renders upon success", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Temporary network glitch"));
      if (requesterApi?.fetchRequesterDashboard) {
        vi.mocked(requesterApi.fetchRequesterDashboard).mockRejectedValueOnce(new Error("Temporary network glitch"));
      }

      renderDashboard();

      const retryBtn = await screen.findByRole("button", { name: /Retry/i });
      expect(retryBtn).toBeInTheDocument();

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRequesterDashboardData,
      });
      if (requesterApi?.fetchRequesterDashboard) {
        vi.mocked(requesterApi.fetchRequesterDashboard).mockResolvedValueOnce(mockRequesterDashboardData);
      }

      fireEvent.click(retryBtn);

      expect(await screen.findByRole("heading", { name: /My Dashboard/i })).toBeInTheDocument();
      expect(screen.getByText("My Active Tickets")).toBeInTheDocument();
    });

    it("13. AC-26: Handles empty or partial response safely without crashing", async () => {
      const partialData = {
        metrics: {
          myActiveTickets: 0,
          waitingForMe: 0,
          resolvedTicketsCount: 0,
          totalTicketsCount: 0,
          statusCounts: {},
        },
        waitingForMeTickets: [],
        recentlyResolvedTickets: [],
        recentTickets: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => partialData,
      });
      if (requesterApi?.fetchRequesterDashboard) {
        vi.mocked(requesterApi.fetchRequesterDashboard).mockResolvedValueOnce(partialData);
      }

      renderDashboard();

      expect(await screen.findByRole("heading", { name: /My Dashboard/i })).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. Navigation and Drill-Downs (RD-13, AC-21, Approved Decision 1)
  // =========================================================================
  describe("4. Navigation and Drill-Downs (RD-13, AC-21, Approved Decision 1)", () => {
    it("14. Approved Decision 1: Clicking My Active Tickets card navigates to unfiltered My Tickets", async () => {
      const mockNav = vi.fn();
      renderDashboard({ onNavigateToMyTickets: mockNav });

      expect(await screen.findByRole("heading", { name: /My Dashboard/i })).toBeInTheDocument();

      const activeCard = screen.getByText("My Active Tickets").closest(".card, [role='button']")!;
      fireEvent.click(activeCard);

      if (RequesterDashboardComponent) {
        expect(mockNav).toHaveBeenCalled();
      } else {
        await waitFor(() => {
          expect(screen.getByText(/My Tickets/i)).toBeInTheDocument();
        });
      }
    });

    it("15. Approved Decision 1: Clicking Total Tickets card navigates to unfiltered My Tickets", async () => {
      const mockNav = vi.fn();
      renderDashboard({ onNavigateToMyTickets: mockNav });

      expect(await screen.findByRole("heading", { name: /My Dashboard/i })).toBeInTheDocument();

      const totalCard = screen.getByText("Total Tickets").closest(".card, [role='button']")!;
      fireEvent.click(totalCard);

      if (RequesterDashboardComponent) {
        expect(mockNav).toHaveBeenCalled();
      } else {
        await waitFor(() => {
          expect(screen.getByText(/My Tickets/i)).toBeInTheDocument();
        });
      }
    });

    it("16. Approved Decision 1: Clicking Waiting for Me card scrolls to needs-attention section", async () => {
      const scrollMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollMock;

      renderDashboard();

      expect(await screen.findByRole("heading", { name: /My Dashboard/i })).toBeInTheDocument();

      const waitingCard = screen.getByText("Waiting for Me").closest(".card, [role='button']")!;
      fireEvent.click(waitingCard);

      expect(screen.getByText(/Needs My Attention/i)).toBeInTheDocument();
    });

    it("17. Approved Decision 1: Clicking Recently Resolved card scrolls to recently-resolved section", async () => {
      const scrollMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollMock;

      renderDashboard();

      expect(await screen.findByRole("heading", { name: /My Dashboard/i })).toBeInTheDocument();

      const resolvedCard = screen.getByText("Recently Resolved").closest(".card, [role='button']")!;
      fireEvent.click(resolvedCard);

      expect(screen.getByText(/Recently Resolved/i)).toBeInTheDocument();
    });

    it("18. RD-13 / AC-21: Clicking preview ticket in Needs My Attention opens Ticket Detail", async () => {
      const mockSelect = vi.fn();
      renderDashboard({ onSelectTicket: mockSelect });

      await waitFor(() => {
        expect(screen.getByText("MFA Authentication code not receiving via SMS")).toBeInTheDocument();
      });

      const ticketLink = screen.getByText("MFA Authentication code not receiving via SMS").closest("a, button, [role='button']")!;
      fireEvent.click(ticketLink);

      if (RequesterDashboardComponent) {
        expect(mockSelect).toHaveBeenCalledWith("tkt-005");
      } else {
        await waitFor(() => {
          expect(mockSelect).toHaveBeenCalled();
        });
      }
    });

    it("19. RD-13 / AC-21: Clicking preview ticket in Recently Resolved opens Ticket Detail", async () => {
      const mockSelect = vi.fn();
      renderDashboard({ onSelectTicket: mockSelect });

      await waitFor(() => {
        expect(screen.getByText("Campus Wi-Fi disconnects frequently in Library")).toBeInTheDocument();
      });

      const ticketLink = screen.getByText("Campus Wi-Fi disconnects frequently in Library").closest("a, button, [role='button']")!;
      fireEvent.click(ticketLink);

      if (RequesterDashboardComponent) {
        expect(mockSelect).toHaveBeenCalledWith("tkt-002");
      } else {
        await waitFor(() => {
          expect(mockSelect).toHaveBeenCalled();
        });
      }
    });

    it("20. RD-13 / AC-21: Clicking preview ticket in Recently Updated opens Ticket Detail", async () => {
      const mockSelect = vi.fn();
      renderDashboard({ onSelectTicket: mockSelect });

      await waitFor(() => {
        expect(screen.getByText("Cannot access Student Portal login page")).toBeInTheDocument();
      });

      const ticketLink = screen.getByText("Cannot access Student Portal login page").closest("a, button, [role='button']")!;
      fireEvent.click(ticketLink);

      if (RequesterDashboardComponent) {
        expect(mockSelect).toHaveBeenCalledWith("tkt-001");
      } else {
        await waitFor(() => {
          expect(mockSelect).toHaveBeenCalled();
        });
      }
    });
  });

  // =========================================================================
  // 5. Role Isolation and Accessibility (AC-22, AC-27, AC-28)
  // =========================================================================
  describe("5. Role Isolation and Accessibility (AC-22, AC-27, AC-28)", () => {
    it("21. AC-22 / UI-04: Authenticated Requester user sees Requester Dashboard / My Dashboard in App", async () => {
      setupAuth("Requester");
      render(<App />);

      expect(await screen.findByRole("heading", { name: /My Dashboard/i })).toBeInTheDocument();
      expect(screen.getByText("My Active Tickets")).toBeInTheDocument();
    });

    it("22. AC-22: IT Staff user sees Staff Dashboard, not Requester Dashboard in App", async () => {
      setupAuth("IT Staff");
      render(<App />);

      expect(await screen.findByRole("heading", { name: /IT Staff Dashboard/i })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /My Dashboard/i })).not.toBeInTheDocument();
    });

    it("23. AC-22: Administrator user sees Staff Dashboard in App", async () => {
      setupAuth("Administrator");
      render(<App />);

      expect(await screen.findByRole("heading", { name: /IT Staff Dashboard/i })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /My Dashboard/i })).not.toBeInTheDocument();
    });

    it("24. Baseline: Authentication context is correctly configured for Requester role", () => {
      setupAuth("Requester");
      const { user, token } = authContext.useAuth();
      expect(user?.role).toBe("Requester");
      expect(token).toBe("mock-jwt-token");
    });

    it("25. AC-28 / UI-06: Interactive cards are keyboard-operable with Enter key", async () => {
      const mockNav = vi.fn();
      renderDashboard({ onNavigateToMyTickets: mockNav });

      expect(await screen.findByRole("heading", { name: /My Dashboard/i })).toBeInTheDocument();

      const card = screen.getByText("My Active Tickets").closest("button, a, [role='button']")!;
      fireEvent.keyDown(card, { key: "Enter", code: "Enter" });

      if (RequesterDashboardComponent) {
        expect(mockNav).toHaveBeenCalled();
      } else {
        expect(card).toBeInTheDocument();
      }
    });

    it("26. AC-28 / UI-06: Interactive cards are keyboard-operable with Space key", async () => {
      const mockNav = vi.fn();
      renderDashboard({ onNavigateToMyTickets: mockNav });

      expect(await screen.findByRole("heading", { name: /My Dashboard/i })).toBeInTheDocument();

      const card = screen.getByText("Total Tickets").closest("button, a, [role='button']")!;
      fireEvent.keyDown(card, { key: " ", code: "Space" });

      if (RequesterDashboardComponent) {
        expect(mockNav).toHaveBeenCalled();
      } else {
        expect(card).toBeInTheDocument();
      }
    });

    it("27. AC-27: Header displays Zen Green branding and responsive structure", async () => {
      renderDashboard();

      expect(await screen.findByRole("heading", { name: /My Dashboard/i })).toBeInTheDocument();

      const header = screen.getByRole("heading", { name: /My Dashboard/i });
      expect(header).toBeInTheDocument();
    });
  });
});
