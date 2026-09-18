import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StaffTicketDetail } from "../../src/components/StaffTicketDetail";
import * as staffApi from "../../src/api/staff";
import * as authContext from "../../src/context/AuthContext";

vi.mock("../../src/api/staff");

const mockStaffUser = {
  id: "staff-1111",
  name: "Sam Staff",
  email: "staff1@university.edu",
  role: "IT Staff" as const,
  mustChangePassword: false,
};

const mockDetailResponse: staffApi.StaffTicketDetailResponse = {
  ticket: {
    id: "tkt-001",
    ticketNumber: "TKT-2026-00001",
    requester: { id: "req-001", name: "Alice Smith", email: "alice@university.edu" },
    category: { id: 1, name: "Account and Access" },
    relatedSystem: { id: "sys-001", name: "Student Portal" },
    summary: "Cannot access Student Portal login page",
    description: "Attempting to log into Student Portal returns 500 server error.",
    requestedPriority: "High",
    status: "New",
    itPriority: "High",
    assignee: null,
    createdAt: "2026-09-18T18:00:00.000Z",
    updatedAt: "2026-09-18T18:00:00.000Z",
    attachments: [
      {
        id: "att-001",
        filename: "error-screenshot.png",
        mimeType: "image/png",
        sizeBytes: 102400,
        uploadedAt: "2026-09-18T18:05:00.000Z",
      },
    ],
  },
};

describe("StaffTicketDetail Component (Issue #25)", () => {
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

    vi.mocked(staffApi.fetchStaffTicketDetail).mockResolvedValue(mockDetailResponse);
  });

  it("1. AC-18 / FR-17: Renders read-only IT Staff ticket details, metadata, and attachments", async () => {
    const handleBack = vi.fn();
    render(<StaffTicketDetail ticketId="tkt-001" onBack={handleBack} />);

    await waitFor(() => {
      expect(screen.getByText("Ticket TKT-2026-00001")).toBeInTheDocument();
    });

    expect(screen.getByText("Cannot access Student Portal login page")).toBeInTheDocument();
    expect(screen.getByText("Attempting to log into Student Portal returns 500 server error.")).toBeInTheDocument();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Account and Access")).toBeInTheDocument();
    expect(screen.getByText("Student Portal")).toBeInTheDocument();
    expect(screen.getByText("error-screenshot.png")).toBeInTheDocument();
  });

  it("2. AC-18 / FR-17: Clicking Back button triggers onBack callback to return to queue", async () => {
    const handleBack = vi.fn();
    render(<StaffTicketDetail ticketId="tkt-001" onBack={handleBack} />);

    await waitFor(() => {
      expect(screen.getByText("Ticket TKT-2026-00001")).toBeInTheDocument();
    });

    const backBtn = screen.getByRole("button", { name: /Back to Ticket Queue/i });
    fireEvent.click(backBtn);

    expect(handleBack).toHaveBeenCalledTimes(1);
  });
});
