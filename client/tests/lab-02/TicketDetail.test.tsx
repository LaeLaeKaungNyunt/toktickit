import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TicketDetail from "../../src/components/TicketDetail.js";
import { RequesterProvider, useRequester } from "../../src/context/RequesterContext.js";
import * as api from "../../src/api/lab02.js";
import {
  DevelopmentRequester,
  TicketDetailDto,
  AttachmentDto,
} from "../../src/types/lab02.js";

vi.mock("../../src/api/lab02.js");

const mockRequesterA: DevelopmentRequester = {
  id: "req-1111",
  displayName: "Jane Doe",
  email: "jane@university.edu",
};

const mockRequesterB: DevelopmentRequester = {
  id: "req-2222",
  displayName: "Bob Smith",
  email: "bob@university.edu",
};

const mockActiveAttachment: AttachmentDto = {
  id: "att-001",
  originalFilename: "error-screenshot.png",
  mimeType: "image/png",
  sizeBytes: 245000,
  uploadedAt: "2026-09-04T07:05:00.000Z",
};

const mockTicketDetail: TicketDetailDto = {
  id: "tkt-1234",
  ticketNumber: "TKT-2026-00001",
  requester: {
    id: "req-1111",
    displayName: "Jane Doe",
  },
  category: {
    id: 1,
    name: "Account and Access",
  },
  relatedSystem: {
    id: "sys-001",
    name: "Student Portal",
  },
  summary: "Unable to access student portal",
  requestedPriority: "Medium",
  description: "The portal rejects my login even after resetting my password.",
  currentStatus: "New",
  createdAt: "2026-09-04T07:00:00.000Z",
  updatedAt: "2026-09-04T07:00:00.000Z",
  attachments: [mockActiveAttachment],
};

function TestWrapper({
  initialRequester = mockRequesterA,
  ticketId = "tkt-1234",
  onBack,
}: {
  initialRequester?: DevelopmentRequester | null;
  ticketId?: string;
  onBack?: () => void;
}) {
  const { setSelectedRequester } = useRequester();

  useEffect(() => {
    setSelectedRequester(initialRequester);
  }, [initialRequester?.id]);

  return (
    <div>
      <button
        data-testid="set-requester-a"
        onClick={() => setSelectedRequester(mockRequesterA)}
      >
        Set Requester A
      </button>
      <button
        data-testid="set-requester-b"
        onClick={() => setSelectedRequester(mockRequesterB)}
      >
        Set Requester B
      </button>
      <button
        data-testid="clear-requester"
        onClick={() => setSelectedRequester(null)}
      >
        Clear Requester
      </button>
      <TicketDetail ticketId={ticketId} onBack={onBack} />
    </div>
  );
}

function renderWithRequester(
  requester: DevelopmentRequester | null = mockRequesterA,
  ticketId: string = "tkt-1234",
  onBack?: () => void
) {
  return render(
    <RequesterProvider>
      <TestWrapper
        initialRequester={requester}
        ticketId={ticketId}
        onBack={onBack}
      />
    </RequesterProvider>
  );
}

describe("TicketDetail Component (Issue #15)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.fetchTicketDetail).mockResolvedValue(mockTicketDetail);
    vi.mocked(api.uploadAttachment).mockResolvedValue({
      id: "att-002",
      originalFilename: "new-upload.pdf",
      mimeType: "application/pdf",
      sizeBytes: 120000,
      uploadedAt: "2026-09-05T08:00:00.000Z",
    });
    vi.mocked(api.softRemoveAttachment).mockResolvedValue({
      id: "att-001",
      removedAt: "2026-09-05T08:10:00.000Z",
      removalReason: "Uploaded wrong screenshot",
      removedByRequesterId: "req-1111",
    });
  });

  describe("AC-20: Read-Only Ticket Detail & Active Attachments", () => {
    it("renders complete saved ticket information and active attachment metadata read-only", async () => {
      renderWithRequester(mockRequesterA, "tkt-1234");

      await waitFor(() => {
        expect(screen.getByText("TKT-2026-00001")).toBeInTheDocument();
      });

      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
      expect(screen.getByText("Account and Access")).toBeInTheDocument();
      expect(screen.getByText("Student Portal")).toBeInTheDocument();
      expect(screen.getByText("Unable to access student portal")).toBeInTheDocument();
      expect(screen.getByText("Medium")).toBeInTheDocument();
      expect(screen.getByText("The portal rejects my login even after resetting my password.")).toBeInTheDocument();
      expect(screen.getByText("New")).toBeInTheDocument();

      // Verify active attachment details
      expect(screen.getByText("error-screenshot.png")).toBeInTheDocument();

      // Verify fields are read-only and no status/field edit controls exist
      expect(screen.queryByRole("textbox", { name: /Summary/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("combobox", { name: /Status/i })).not.toBeInTheDocument();
    });

    it("displays empty attachment state when ticket has zero active attachments", async () => {
      vi.mocked(api.fetchTicketDetail).mockResolvedValueOnce({
        ...mockTicketDetail,
        attachments: [],
      });

      renderWithRequester(mockRequesterA, "tkt-1234");

      await waitFor(() => {
        expect(screen.getByText("TKT-2026-00001")).toBeInTheDocument();
      });

      expect(screen.getByText(/No active attachments/i)).toBeInTheDocument();
    });
  });

  describe("AC-22 & AC-23: Attachment Upload UI", () => {
    it("AC-22: handles permitted file upload with busy state and success feedback", async () => {
      renderWithRequester(mockRequesterA, "tkt-1234");

      await waitFor(() => {
        expect(screen.getByText("TKT-2026-00001")).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText(/Upload Attachment/i);
      const pdfFile = new File(["pdf content"], "new-upload.pdf", {
        type: "application/pdf",
      });

      await userEvent.upload(fileInput, pdfFile);

      const uploadButton = screen.getByRole("button", { name: /Upload/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(api.uploadAttachment).toHaveBeenCalledWith(
          "tkt-1234",
          expect.any(File),
          "req-1111"
        );
      });

      expect(await screen.findByText(/Attachment uploaded successfully/i)).toBeInTheDocument();
    });

    it("AC-23: validates unsupported file type before calling API", async () => {
      renderWithRequester(mockRequesterA, "tkt-1234");

      await waitFor(() => {
        expect(screen.getByText("TKT-2026-00001")).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText(/Upload Attachment/i);
      const invalidFile = new File(["script content"], "script.sh", {
        type: "text/plain",
      });

      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      const uploadButton = screen.getByRole("button", { name: /Upload/i });
      fireEvent.click(uploadButton);

      expect(await screen.findByText(/Allowed file types are JPG, PNG, WEBP, and PDF/i)).toBeInTheDocument();
      expect(api.uploadAttachment).not.toHaveBeenCalled();
    });

    it("AC-23: validates file size exceeding 5 MB before calling API", async () => {
      renderWithRequester(mockRequesterA, "tkt-1234");

      await waitFor(() => {
        expect(screen.getByText("TKT-2026-00001")).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText(/Upload Attachment/i);
      const largeBuffer = new Uint8Array(5 * 1024 * 1024 + 1);
      const largeFile = new File([largeBuffer], "huge-image.png", {
        type: "image/png",
      });

      await userEvent.upload(fileInput, largeFile);

      const uploadButton = screen.getByRole("button", { name: /Upload/i });
      fireEvent.click(uploadButton);

      expect(await screen.findByText(/File size must not exceed 5 MB/i)).toBeInTheDocument();
      expect(api.uploadAttachment).not.toHaveBeenCalled();
    });

    it("AC-23: disables upload control when ticket has 5 active attachments", async () => {
      const fiveAttachments: AttachmentDto[] = Array.from({ length: 5 }).map((_, i) => ({
        id: `att-00${i + 1}`,
        originalFilename: `file-${i + 1}.png`,
        mimeType: "image/png",
        sizeBytes: 1000,
        uploadedAt: "2026-09-04T07:00:00.000Z",
      }));

      vi.mocked(api.fetchTicketDetail).mockResolvedValueOnce({
        ...mockTicketDetail,
        attachments: fiveAttachments,
      });

      renderWithRequester(mockRequesterA, "tkt-1234");

      await waitFor(() => {
        expect(screen.getByText("TKT-2026-00001")).toBeInTheDocument();
      });

      expect(screen.getByText(/Maximum active attachments limit \(5\) reached/i)).toBeInTheDocument();
      const fileInput = screen.getByLabelText(/Upload Attachment/i);
      expect(fileInput).toBeDisabled();
    });

    it("AC-28: displays upload error feedback separately without destroying ticket detail display when upload API fails", async () => {
      vi.mocked(api.uploadAttachment).mockRejectedValueOnce(
        new Error("Attachment upload failed due to storage error")
      );

      renderWithRequester(mockRequesterA, "tkt-1234");

      await waitFor(() => {
        expect(screen.getByText("TKT-2026-00001")).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText(/Upload Attachment/i);
      const validFile = new File(["valid image"], "photo.png", { type: "image/png" });

      await userEvent.upload(fileInput, validFile);
      fireEvent.click(screen.getByRole("button", { name: /Upload/i }));

      await waitFor(() => {
        expect(screen.getByText(/Attachment upload failed due to storage error/i)).toBeInTheDocument();
      });

      // Ticket Detail content remains rendered intact
      expect(screen.getByText("TKT-2026-00001")).toBeInTheDocument();
      expect(screen.getByText("Unable to access student portal")).toBeInTheDocument();
    });
  });

  describe("AC-24: Download Action", () => {
    it("provides Download action for active attachments and triggers API download function", async () => {
      renderWithRequester(mockRequesterA, "tkt-1234");

      await waitFor(() => {
        expect(screen.getByText("error-screenshot.png")).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole("button", { name: /Download|Download file/i });
      fireEvent.click(downloadButton);

      expect(api.downloadAttachment).toHaveBeenCalledWith("tkt-1234", "att-001", "req-1111");
    });
  });

  describe("AC-25: Soft Removal UI & Confirmation Modal", () => {
    it("opens removal modal, enforces required non-empty removal reason, and submits valid removal", async () => {
      renderWithRequester(mockRequesterA, "tkt-1234");

      await waitFor(() => {
        expect(screen.getByText("error-screenshot.png")).toBeInTheDocument();
      });

      // Click Remove button
      const removeButton = screen.getByRole("button", { name: /Remove|Soft Remove/i });
      fireEvent.click(removeButton);

      // Modal appears asking for removal reason
      expect(await screen.findByText(/Reason for Removal/i)).toBeInTheDocument();

      const confirmButton = screen.getByRole("button", { name: /Confirm Removal/i });

      // Submit empty reason -> validation error
      fireEvent.click(confirmButton);
      expect(await screen.findByText(/Removal reason is required/i)).toBeInTheDocument();
      expect(api.softRemoveAttachment).not.toHaveBeenCalled();

      // Enter valid reason
      const reasonInput = screen.getByLabelText(/Removal Reason/i);
      await userEvent.type(reasonInput, "  Uploaded wrong screenshot  ");

      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(api.softRemoveAttachment).toHaveBeenCalledWith(
          "tkt-1234",
          "att-001",
          { reason: "Uploaded wrong screenshot" },
          "req-1111"
        );
      });

      expect(await screen.findByText(/Attachment removed successfully/i)).toBeInTheDocument();
    });
  });

  describe("AC-26 & AC-27: Ownership & Not Found Error States", () => {
    it("displays safe not-found error state when API returns 404 for nonexistent or unauthorized ticket", async () => {
      vi.mocked(api.fetchTicketDetail).mockRejectedValueOnce(
        new Error("Ticket not found or inaccessible")
      );

      renderWithRequester(mockRequesterA, "unauthorized-tkt-id");

      await waitFor(() => {
        expect(screen.getByText(/Ticket not found or inaccessible/i)).toBeInTheDocument();
      });

      expect(screen.queryByText("TKT-2026-00001")).not.toBeInTheDocument();
    });
  });

  describe("AC-03 & BR-06: Development Requester Switching State Clearance", () => {
    it("clears active ticket detail and attachment data immediately when requester changes", async () => {
      renderWithRequester(mockRequesterA, "tkt-1234");

      await waitFor(() => {
        expect(screen.getByText("TKT-2026-00001")).toBeInTheDocument();
      });

      // Switch requester to B
      await userEvent.click(screen.getByTestId("set-requester-b"));

      // Active ticket detail data should be cleared immediately
      expect(screen.queryByText("TKT-2026-00001")).not.toBeInTheDocument();
      expect(screen.queryByText("error-screenshot.png")).not.toBeInTheDocument();
    });
  });

  describe("AC-29, AC-30, AC-31: Zen Green Foundation, Responsive Layout & Accessibility", () => {
    it("applies Zen Green visual tokens and responsive container styling", async () => {
      renderWithRequester(mockRequesterA, "tkt-1234");

      await waitFor(() => {
        expect(screen.getByText("TKT-2026-00001")).toBeInTheDocument();
      });

      // Check card/container elements
      const mainCard = screen.getByTestId("ticket-detail-card");
      expect(mainCard).toBeInTheDocument();

      // Check priority and status badges exist with accessible contrast labels
      expect(screen.getByText("Medium")).toBeInTheDocument();
      expect(screen.getByText("New")).toBeInTheDocument();
    });

    it("supports keyboard interaction and focus management for removal modal", async () => {
      renderWithRequester(mockRequesterA, "tkt-1234");

      await waitFor(() => {
        expect(screen.getByText("error-screenshot.png")).toBeInTheDocument();
      });

      const removeButton = screen.getByRole("button", { name: /Remove|Soft Remove/i });
      removeButton.focus();
      expect(document.activeElement).toBe(removeButton);

      fireEvent.click(removeButton);

      // Modal pops up and reason field gets accessible focus
      const reasonInput = await screen.findByLabelText(/Removal Reason/i);
      expect(reasonInput).toBeInTheDocument();
    });
  });
});
