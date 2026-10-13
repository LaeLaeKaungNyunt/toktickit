import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StaffTicketQueue } from "../../src/components/StaffTicketQueue";
import App from "../../src/App";
import * as staffApi from "../../src/api/staff";
import * as authContext from "../../src/context/AuthContext";
import { StaffQueueResponse } from "../../src/types/staff";

vi.mock("../../src/api/staff", async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>();
  return {
    ...actual,
    fetchStaffTickets: vi.fn(),
    fetchStaffTicketDetail: vi.fn(),
  };
});

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

const mockQueueResponse: StaffQueueResponse = {
  items: [
    {
      id: "tkt-001",
      ticketNumber: "TKT-2026-00001",
      requester: { id: "req-001", name: "Alice Smith" },
      category: { id: 1, name: "Account and Access" },
      summary: "Cannot access Student Portal login page",
      requestedPriority: "High",
      status: "New",
      itPriority: "High",
      assignee: null,
      createdAt: "2026-09-18T18:00:00.000Z",
      updatedAt: "2026-09-18T18:00:00.000Z",
    },
    {
      id: "tkt-002",
      ticketNumber: "TKT-2026-00002",
      requester: { id: "req-002", name: "Bob Jones" },
      category: { id: 2, name: "Network" },
      summary: "Wi-Fi Connection Drops in Library",
      requestedPriority: "Urgent",
      status: "In Progress",
      itPriority: "Urgent",
      assignee: { id: "staff-1111", name: "Sam Staff" },
      createdAt: "2026-09-18T19:00:00.000Z",
      updatedAt: "2026-09-18T19:30:00.000Z",
    },
    {
      id: "tkt-003",
      ticketNumber: "TKT-2026-00003",
      requester: { id: "req-003", name: "Charlie Brown" },
      category: { id: 3, name: "Hardware" },
      summary: "Monitor screen flickers in Lab 4",
      requestedPriority: "Low",
      status: "Open",
      itPriority: "Low",
      assignee: { id: "staff-2222", name: "Alex Tech" },
      createdAt: "2026-09-18T20:00:00.000Z",
      updatedAt: "2026-09-18T20:15:00.000Z",
    },
  ],
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 3,
    totalPages: 1,
  },
};

describe("StaffTicketQueue Dashboard Filter Extensions (Issue #47: SD-16 to SD-18)", () => {
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

    vi.mocked(staffApi.fetchStaffTickets).mockResolvedValue(mockQueueResponse);
  });

  // =========================================================================
  // 1. Incoming Dashboard Filters & assignedToMe=true (SD-16)
  // =========================================================================
  describe("1. Incoming Dashboard Filters & assignedToMe=true (SD-16)", () => {
    it("1. SD-16 / AC-15: Queue accepts incoming initialFilters prop and passes assignedToMe=true to backend API", async () => {
      // @ts-ignore - initialFilters will be added to StaffTicketQueueProps in GREEN phase
      render(<StaffTicketQueue initialFilters={{ assignedToMe: true }} />);

      await waitFor(() => {
        expect(staffApi.fetchStaffTickets).toHaveBeenCalledWith(
          "mock-jwt-token",
          expect.objectContaining({ assignedToMe: true })
        );
      });
    });

    it("2. SD-16 / AC-17: Displays an active filter indicator when assignedToMe filter is applied", async () => {
      // @ts-ignore
      render(<StaffTicketQueue initialFilters={{ assignedToMe: true }} />);

      await waitFor(() => {
        expect(
          screen.getByText(/Assigned to Me|My Assigned Tickets/i)
        ).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 2. Comma-Separated Priority Filters (SD-17)
  // =========================================================================
  describe("2. Comma-Separated Priority Filters (SD-17)", () => {
    it("3. SD-17 / AC-15: Preserves comma-separated Urgent,High priority filter and sends it to backend API", async () => {
      // @ts-ignore
      render(<StaffTicketQueue initialFilters={{ priority: "Urgent,High" }} />);

      await waitFor(() => {
        expect(staffApi.fetchStaffTickets).toHaveBeenCalledWith(
          "mock-jwt-token",
          expect.objectContaining({ priority: "Urgent,High" })
        );
      });
    });

    it("4. SD-17 / AC-17: Displays priority filter indicator representing Urgent, High without breaking dropdown", async () => {
      // @ts-ignore
      render(<StaffTicketQueue initialFilters={{ priority: "Urgent,High" }} />);

      await waitFor(() => {
        expect(
          screen.getByText(/Urgent, High|Urgent & High|Urgent,High/i)
        ).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 3. Status and Unassigned Filter Mapping (AC-15, AC-17)
  // =========================================================================
  describe("3. Status and Unassigned Filter Mapping (AC-15, AC-17)", () => {
    it("5. AC-15: Applies incoming assignment=unassigned filter and queries backend correctly", async () => {
      // @ts-ignore
      render(<StaffTicketQueue initialFilters={{ assignment: "unassigned" }} />);

      await waitFor(() => {
        expect(staffApi.fetchStaffTickets).toHaveBeenCalledWith(
          "mock-jwt-token",
          expect.objectContaining({ assignment: "unassigned" })
        );
      });

      const assignmentSelect = screen.getByLabelText(/Assignment/i) as HTMLSelectElement;
      expect(assignmentSelect.value).toBe("unassigned");
    });

    it("6. AC-15: Applies incoming status filter and queries backend correctly", async () => {
      // @ts-ignore
      render(<StaffTicketQueue initialFilters={{ status: "In Progress" }} />);

      await waitFor(() => {
        expect(staffApi.fetchStaffTickets).toHaveBeenCalledWith(
          "mock-jwt-token",
          expect.objectContaining({ status: "In Progress" })
        );
      });

      const statusSelect = screen.getByLabelText(/Status/i) as HTMLSelectElement;
      expect(statusSelect.value).toBe("In Progress");
    });
  });

  // =========================================================================
  // 4. Changing & Resetting Filters
  // =========================================================================
  describe("4. Changing & Resetting Filters", () => {
    it("7. Changing toolbar filters updates the queue query parameters", async () => {
      render(<StaffTicketQueue />);

      await waitFor(() => {
        expect(staffApi.fetchStaffTickets).toHaveBeenCalled();
      });

      const searchInput = screen.getByLabelText(/Search Queue/i);
      fireEvent.change(searchInput, { target: { value: "Portal" } });

      await waitFor(() => {
        expect(staffApi.fetchStaffTickets).toHaveBeenCalledWith(
          "mock-jwt-token",
          expect.objectContaining({ search: "Portal" })
        );
      });
    });

    it("8. Reset filters clears incoming dashboard filters back to defaults", async () => {
      // @ts-ignore
      render(<StaffTicketQueue initialFilters={{ assignment: "unassigned", priority: "Urgent,High", assignedToMe: true }} />);

      await waitFor(() => {
        expect(staffApi.fetchStaffTickets).toHaveBeenCalled();
      });

      const resetBtn = screen.getByRole("button", { name: /Reset Filters/i });
      fireEvent.click(resetBtn);

      await waitFor(() => {
        expect(staffApi.fetchStaffTickets).toHaveBeenLastCalledWith(
          "mock-jwt-token",
          expect.objectContaining({
            assignment: undefined,
            priority: undefined,
            status: undefined,
          })
        );
      });
    });
  });

  // =========================================================================
  // 5. Existing Lab 3 Queue Behavior Preserved (Baseline Tests)
  // =========================================================================
  describe("5. Existing Lab 3 Queue Behavior Preserved (Baseline Tests)", () => {
    it("9. Baseline: Queue renders normally without incoming filters", async () => {
      render(<StaffTicketQueue />);

      await waitFor(() => {
        expect(screen.getAllByText("TKT-2026-00001").length).toBeGreaterThan(0);
      });

      expect(staffApi.fetchStaffTickets).toHaveBeenCalledWith(
        "mock-jwt-token",
        expect.objectContaining({
          sortBy: "createdAt",
          sortOrder: "desc",
          page: 1,
        })
      );

      expect(screen.getAllByText("Alice Smith").length).toBeGreaterThan(0);
    });

    it("10. Baseline: Pagination controls function normally", async () => {
      render(<StaffTicketQueue />);

      await waitFor(() => {
        expect(screen.getByText(/Page 1 of 1/i)).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /Previous/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /Next/i })).toBeDisabled();
    });
  });

  // =========================================================================
  // 6. Queue -> Ticket Detail Navigation (AC-17, AC-21)
  // =========================================================================
  describe("6. Queue -> Ticket Detail Navigation (AC-17, AC-21)", () => {
    it("11. AC-17: Selecting a ticket invokes onSelectTicket with the correct ticket ID", async () => {
      const mockSelect = vi.fn();
      render(<StaffTicketQueue onSelectTicket={mockSelect} />);

      await waitFor(() => {
        expect(screen.getAllByText("TKT-2026-00001").length).toBeGreaterThan(0);
      });

      const viewDetailBtn = screen.getAllByRole("button", { name: /View Detail/i })[0];
      fireEvent.click(viewDetailBtn);

      expect(mockSelect).toHaveBeenCalledWith("tkt-001");
    });

    it("12. SD-18: Administrator role can view queue and select tickets", async () => {
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

      const mockSelect = vi.fn();
      render(<StaffTicketQueue onSelectTicket={mockSelect} />);

      await waitFor(() => {
        expect(screen.getAllByText("TKT-2026-00001").length).toBeGreaterThan(0);
      });

      expect(staffApi.fetchStaffTickets).toHaveBeenCalledWith(
        "admin-jwt-token",
        expect.anything()
      );
    });
  });
});
