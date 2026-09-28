import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StaffTicketQueue } from "../../src/components/StaffTicketQueue";
import * as staffApi from "../../src/api/staff";
import * as authContext from "../../src/context/AuthContext";
import { StaffQueueResponse } from "../../src/types/staff";

vi.mock("../../src/api/staff");

const mockStaffUser = {
  id: "staff-1111",
  name: "Sam Staff",
  email: "staff1@university.edu",
  role: "IT Staff" as const,
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
      requestedPriority: "Medium",
      status: "In Progress",
      itPriority: "Medium",
      assignee: { id: "staff-1111", name: "Sam Staff" },
      createdAt: "2026-09-18T19:00:00.000Z",
      updatedAt: "2026-09-18T19:30:00.000Z",
    },
  ],
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 2,
    totalPages: 1,
  },
};

describe("StaffTicketQueue Component (Issue #25)", () => {
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

  it("1. AC-12, AC-17 / FR-16, FR-33: Renders ticket queue with ticket numbers, requester names, categories, status badges, IT priority badges, and assignees", async () => {
    render(<StaffTicketQueue />);

    await waitFor(() => {
      expect(screen.getAllByText("TKT-2026-00001").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText("Alice Smith").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Account and Access").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cannot access Student Portal login page").length).toBeGreaterThan(0);
    expect(screen.getAllByText("New").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);

    expect(screen.getAllByText("TKT-2026-00002").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bob Jones").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wi-Fi Connection Drops in Library").length).toBeGreaterThan(0);
    expect(screen.getAllByText("In Progress").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sam Staff").length).toBeGreaterThan(0);
  });

  it("2. AC-18 / FR-32: Displays loading spinner while fetch is pending", () => {
    vi.mocked(staffApi.fetchStaffTickets).mockImplementation(() => new Promise(() => {}));
    render(<StaffTicketQueue />);

    expect(screen.getByText("Loading ticket queue...")).toBeInTheDocument();
  });

  it("3. AC-13 / FR-14: Search input triggers API fetch with search query parameter", async () => {
    render(<StaffTicketQueue />);

    await waitFor(() => {
      expect(staffApi.fetchStaffTickets).toHaveBeenCalled();
    });

    const searchInput = screen.getByPlaceholderText(/Search ticket #/i);
    fireEvent.change(searchInput, { target: { value: "Portal" } });

    await waitFor(() => {
      expect(staffApi.fetchStaffTickets).toHaveBeenLastCalledWith(
        "mock-jwt-token",
        expect.objectContaining({ search: "Portal" })
      );
    });
  });

  it("4. AC-14 / FR-14: Filter controls (Status, Priority, Assignment) update parameters and trigger refetch", async () => {
    render(<StaffTicketQueue />);

    await waitFor(() => {
      expect(staffApi.fetchStaffTickets).toHaveBeenCalled();
    });

    const statusSelect = screen.getByLabelText("Status");
    fireEvent.change(statusSelect, { target: { value: "New" } });

    await waitFor(() => {
      expect(staffApi.fetchStaffTickets).toHaveBeenLastCalledWith(
        "mock-jwt-token",
        expect.objectContaining({ status: "New" })
      );
    });

    const prioritySelect = screen.getByLabelText("IT Priority");
    fireEvent.change(prioritySelect, { target: { value: "High" } });

    await waitFor(() => {
      expect(staffApi.fetchStaffTickets).toHaveBeenLastCalledWith(
        "mock-jwt-token",
        expect.objectContaining({ priority: "High" })
      );
    });

    const assignmentSelect = screen.getByLabelText("Assignment");
    fireEvent.change(assignmentSelect, { target: { value: "unassigned" } });

    await waitFor(() => {
      expect(staffApi.fetchStaffTickets).toHaveBeenLastCalledWith(
        "mock-jwt-token",
        expect.objectContaining({ assignment: "unassigned" })
      );
    });
  });

  it("5. AC-15 / FR-15: Sort selector updates parameters", async () => {
    render(<StaffTicketQueue />);

    await waitFor(() => {
      expect(staffApi.fetchStaffTickets).toHaveBeenCalled();
    });

    const sortBySelect = screen.getByLabelText("Sort By");
    fireEvent.change(sortBySelect, { target: { value: "ticketNumber" } });

    await waitFor(() => {
      expect(staffApi.fetchStaffTickets).toHaveBeenLastCalledWith(
        "mock-jwt-token",
        expect.objectContaining({ sortBy: "ticketNumber" })
      );
    });
  });

  it("6. AC-16 / FR-15: Pagination controls navigate pages", async () => {
    vi.mocked(staffApi.fetchStaffTickets).mockResolvedValue({
      items: mockQueueResponse.items,
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 45,
        totalPages: 3,
      },
    });

    render(<StaffTicketQueue />);

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole("button", { name: "Next" });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(staffApi.fetchStaffTickets).toHaveBeenLastCalledWith(
        "mock-jwt-token",
        expect.objectContaining({ page: 2 })
      );
    });
  });

  it("7. AC-18 / FR-32: Renders No Results state when search/filter returns empty list", async () => {
    vi.mocked(staffApi.fetchStaffTickets).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });

    render(<StaffTicketQueue />);

    await waitFor(() => {
      expect(screen.getByText("No Service Tickets")).toBeInTheDocument();
    });
  });

  it("8. AC-18 / FR-32: Renders Error alert with Retry button on API failure", async () => {
    vi.mocked(staffApi.fetchStaffTickets).mockRejectedValue(new Error("Failed to load queue from server"));

    render(<StaffTicketQueue />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load queue from server/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: "Retry" });
    expect(retryBtn).toBeInTheDocument();
  });

  it("9. AC-18 / FR-17: Clicking View Detail action triggers onSelectTicket callback", async () => {
    const handleSelectTicket = vi.fn();
    render(<StaffTicketQueue onSelectTicket={handleSelectTicket} />);

    await waitFor(() => {
      expect(screen.getAllByText("TKT-2026-00001").length).toBeGreaterThan(0);
    });

    const viewDetailBtns = screen.getAllByRole("button", { name: "View Detail" });
    fireEvent.click(viewDetailBtns[0]);

    expect(handleSelectTicket).toHaveBeenCalledWith("tkt-001");
  });

  it("10. UI-Spec: Renders both desktop table and mobile stacked card view for responsive layout", async () => {
    render(<StaffTicketQueue />);

    await waitFor(() => {
      expect(screen.getAllByText("TKT-2026-00001").length).toBeGreaterThan(0);
    });

    // Check desktop table view container
    const desktopTable = document.querySelector(".staff-queue-desktop-table");
    expect(desktopTable).toBeInTheDocument();

    // Check mobile stacked card view container
    const mobileCards = document.querySelectorAll(".staff-queue-mobile-card");
    expect(mobileCards.length).toBe(2);
  });
});
