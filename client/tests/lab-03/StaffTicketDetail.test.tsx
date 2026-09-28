import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StaffTicketDetail } from "../../src/components/StaffTicketDetail";
import * as staffApi from "../../src/api/staff";
import * as lab02Api from "../../src/api/lab02";
import * as authContext from "../../src/context/AuthContext";

vi.mock("../../src/api/staff");
vi.mock("../../src/api/lab02");

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
    requesterResolution: null,
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

describe("StaffTicketDetail Component (Issue #26)", () => {
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
    vi.mocked(staffApi.fetchStaffTicketComments).mockResolvedValue({ comments: [] });
    vi.mocked(staffApi.fetchStaffTicketNotes).mockResolvedValue({ notes: [] });
    vi.mocked(staffApi.fetchStaffUsers).mockResolvedValue({
      users: [
        { id: "staff-1111", name: "Sam Staff", email: "staff1@university.edu", role: "IT Staff" },
        { id: "staff-2222", name: "Alex Tech", email: "staff2@university.edu", role: "IT Staff" },
      ],
    });
  });

  it("1. AC-18 / FR-17: Renders IT Staff ticket details, metadata, and attachments", async () => {
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

  it("3. AC-19 / FR-18: Claim Ticket button triggers claimStaffTicket API call", async () => {
    vi.mocked(staffApi.claimStaffTicket).mockResolvedValue({
      ticket: { id: "tkt-001", assignee: { id: "staff-1111", name: "Sam Staff", email: "staff1@university.edu" } },
    });

    render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Claim Ticket/i })).toBeInTheDocument();
    });

    const claimBtn = screen.getByRole("button", { name: /Claim Ticket/i });
    fireEvent.click(claimBtn);

    await waitFor(() => {
      expect(staffApi.claimStaffTicket).toHaveBeenCalledWith("mock-jwt-token", "tkt-001");
    });
  });

  it("4. AC-22 / FR-20: Status transition triggers updateStaffTicketStatus API call", async () => {
    vi.mocked(staffApi.updateStaffTicketStatus).mockResolvedValue({
      ticket: { id: "tkt-001", status: "In Progress" },
    });

    render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Status Transition/i)).toBeInTheDocument();
    });

    const select = screen.getByLabelText(/Status Transition/i);
    fireEvent.change(select, { target: { value: "In Progress" } });

    const transitionBtn = screen.getByRole("button", { name: /Transition/i });
    fireEvent.click(transitionBtn);

    await waitFor(() => {
      expect(staffApi.updateStaffTicketStatus).toHaveBeenCalledWith("mock-jwt-token", "tkt-001", "In Progress");
    });
  });

  it("5. AC-23 / AC-24: Posting a public comment and internal note calls appropriate API functions", async () => {
    vi.mocked(staffApi.addStaffTicketComment).mockResolvedValue({
      comment: { id: "c-01", body: "Public test comment", author: { id: "staff-1111", name: "Sam Staff", role: "IT Staff" }, createdAt: "2026-09-18T19:00:00.000Z" },
    });

    vi.mocked(staffApi.addStaffTicketNote).mockResolvedValue({
      note: { id: "n-01", body: "Internal test note", author: { id: "staff-1111", name: "Sam Staff", role: "IT Staff" }, createdAt: "2026-09-18T19:05:00.000Z" },
    });

    render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write a public comment/i)).toBeInTheDocument();
    });

    const commentInput = screen.getByPlaceholderText(/Write a public comment/i);
    fireEvent.change(commentInput, { target: { value: "Public test comment" } });
    const postCommentBtn = screen.getByRole("button", { name: /Post Public Comment/i });
    fireEvent.click(postCommentBtn);

    await waitFor(() => {
      expect(staffApi.addStaffTicketComment).toHaveBeenCalledWith("mock-jwt-token", "tkt-001", "Public test comment");
    });

    const noteInput = screen.getByPlaceholderText(/Write an internal note/i);
    fireEvent.change(noteInput, { target: { value: "Internal test note" } });
    const postNoteBtn = screen.getByRole("button", { name: /Post Internal Note/i });
    fireEvent.click(postNoteBtn);

    await waitFor(() => {
      expect(staffApi.addStaffTicketNote).toHaveBeenCalledWith("mock-jwt-token", "tkt-001", "Internal test note");
    });
  });

  it("7. AC-25: Provides Download, Upload, and Soft-Removal actions for attachments in StaffTicketDetail", async () => {
    vi.mocked(lab02Api.uploadAttachment).mockResolvedValue({
      id: "att-002",
      originalFilename: "staff-uploaded-doc.pdf",
      mimeType: "application/pdf",
      sizeBytes: 50000,
      uploadedAt: "2026-09-18T19:20:00.000Z",
    });

    vi.mocked(lab02Api.softRemoveAttachment).mockResolvedValue({
      id: "att-001",
      removedAt: "2026-09-18T19:25:00.000Z",
      removalReason: "Old screenshot no longer relevant",
      removedByRequesterId: "staff-1111",
    });

    render(<StaffTicketDetail ticketId="tkt-001" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("error-screenshot.png")).toBeInTheDocument();
    });

    // 1. Download action
    const downloadBtn = screen.getByRole("button", { name: /Download/i });
    fireEvent.click(downloadBtn);
    expect(lab02Api.downloadAttachment).toHaveBeenCalledWith("tkt-001", "att-001", "mock-jwt-token");

    // 2. Upload action
    const uploadInput = screen.getByLabelText(/Upload Attachment/i);
    const pdfFile = new File(["content"], "staff-uploaded-doc.pdf", { type: "application/pdf" });
    fireEvent.change(uploadInput, { target: { files: [pdfFile] } });

    const uploadBtn = screen.getByRole("button", { name: /^Upload$/i });
    fireEvent.click(uploadBtn);

    await waitFor(() => {
      expect(lab02Api.uploadAttachment).toHaveBeenCalledWith("tkt-001", expect.any(File), "mock-jwt-token");
    });
    expect(await screen.findByText(/Attachment uploaded successfully/i)).toBeInTheDocument();

    // 3. Soft Removal action
    const removeBtn = screen.getAllByRole("button", { name: /^Remove$/i })[0];
    fireEvent.click(removeBtn);

    expect(await screen.findByText(/Reason for Removal/i)).toBeInTheDocument();

    const reasonInput = screen.getByLabelText(/Removal Reason/i);
    fireEvent.change(reasonInput, { target: { value: "Old screenshot no longer relevant" } });

    const confirmRemoveBtn = screen.getByRole("button", { name: /Confirm Removal/i });
    fireEvent.click(confirmRemoveBtn);

    await waitFor(() => {
      expect(lab02Api.softRemoveAttachment).toHaveBeenCalledWith(
        "tkt-001",
        "att-001",
        { reason: "Old screenshot no longer relevant" },
        "mock-jwt-token"
      );
    });
    expect(await screen.findByText(/Attachment removed successfully/i)).toBeInTheDocument();
  });
});
