import React, { useEffect, useState, useRef } from "react";
import { useRequester } from "../context/RequesterContext.js";
import {
  fetchTicketDetail,
  uploadAttachment,
  downloadAttachment,
  softRemoveAttachment,
} from "../api/lab02.js";
import { TicketDetailDto, AttachmentDto } from "../types/lab02.js";

interface TicketDetailProps {
  ticketId: string;
  onBack?: () => void;
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export default function TicketDetail({ ticketId, onBack }: TicketDetailProps) {
  const { selectedRequester } = useRequester();

  const [ticket, setTicket] = useState<TicketDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Synchronously clear stale ticket data on requester change (AC-03, BR-06)
  const prevRequesterIdRef = useRef<string | undefined>(selectedRequester?.id);
  if (prevRequesterIdRef.current !== selectedRequester?.id) {
    prevRequesterIdRef.current = selectedRequester?.id;
    setTicket(null);
    setError(null);
    setIsLoading(true);
  }

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Removal state
  const [removingAttachment, setRemovingAttachment] = useState<AttachmentDto | null>(null);
  const [removalReason, setRemovalReason] = useState<string>("");
  const [isRemoving, setIsRemoving] = useState<boolean>(false);
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [removalSuccess, setRemovalSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedRequester || !ticketId) {
      setTicket(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setUploadError(null);
    setUploadSuccess(null);
    setRemovalError(null);
    setRemovalSuccess(null);
    setSelectedFile(null);
    setRemovingAttachment(null);

    fetchTicketDetail(ticketId, selectedRequester.id)
      .then((data) => {
        if (isMounted) {
          setTicket(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setTicket(null);
          setError(err.message || "Ticket not found or inaccessible");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [ticketId, selectedRequester?.id]);

  if (!selectedRequester) {
    return (
      <div className="alert alert-warning" role="alert">
        Please select a Development Requester to view ticket detail.
      </div>
    );
  }

  // Requester ownership check: do not display stale data if ticket owner != selected requester
  const isOwnedBySelectedRequester = ticket?.requester.id === selectedRequester.id;

  if (isLoading || (ticket && !isOwnedBySelectedRequester)) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading ticket detail...</span>
        </div>
        <p className="mt-2 text-muted">Loading ticket detail...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div>
        {onBack && (
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm mb-3"
            onClick={onBack}
          >
            &larr; Back to My Tickets
          </button>
        )}
        <div className="alert alert-danger" role="alert">
          {error || "Ticket not found or inaccessible"}
        </div>
      </div>
    );
  }

  const activeAttachments = ticket.attachments ?? [];
  const isMaxAttachments = activeAttachments.length >= 5;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadSuccess(null);

    const file = e.target.files?.[0];
    if (!file) {
      setUploadError("Allowed file types are JPG, PNG, WEBP, and PDF.");
      setSelectedFile(null);
      return;
    }

    const fileNameLower = file.name.toLowerCase();
    const fileTypeLower = file.type ? file.type.toLowerCase() : "";

    const isValidType =
      ALLOWED_MIME_TYPES.includes(fileTypeLower) ||
      ALLOWED_EXTENSIONS.some((ext) => fileNameLower.endsWith(ext));

    if (!isValidType) {
      setUploadError("Allowed file types are JPG, PNG, WEBP, and PDF.");
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError("File size must not exceed 5 MB.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || isMaxAttachments) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const newAtt = await uploadAttachment(ticket.id, selectedFile, selectedRequester.id);
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              attachments: [...prev.attachments, newAtt],
            }
          : prev
      );
      setUploadSuccess("Attachment uploaded successfully.");
      setSelectedFile(null);
      const fileInput = document.getElementById("attachment-upload-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (err: any) {
      setUploadError(err.message || "Attachment upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (attachment: AttachmentDto) => {
    try {
      await downloadAttachment(ticket.id, attachment.id, selectedRequester.id);
    } catch (err: any) {
      alert(err.message || "Unable to download attachment.");
    }
  };

  const openRemoveModal = (attachment: AttachmentDto) => {
    setRemovingAttachment(attachment);
    setRemovalReason("");
    setRemovalError(null);
  };

  const closeRemoveModal = () => {
    setRemovingAttachment(null);
    setRemovalReason("");
    setRemovalError(null);
  };

  const handleConfirmRemoval = async () => {
    if (!removingAttachment) return;

    const trimmedReason = removalReason.trim();
    if (!trimmedReason) {
      setRemovalError("Removal reason is required.");
      return;
    }

    setIsRemoving(true);
    setRemovalError(null);

    try {
      await softRemoveAttachment(
        ticket.id,
        removingAttachment.id,
        { reason: trimmedReason },
        selectedRequester.id
      );

      setTicket((prev) =>
        prev
          ? {
              ...prev,
              attachments: prev.attachments.filter((a) => a.id !== removingAttachment.id),
            }
          : prev
      );

      setRemovalSuccess("Attachment removed successfully.");
      closeRemoveModal();
    } catch (err: any) {
      setRemovalError(err.message || "Unable to remove attachment.");
    } finally {
      setIsRemoving(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString: string): string => {
    return new Date(isoString).toLocaleString();
  };

  return (
    <div className="container-fluid px-0">
      {onBack && (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm mb-3"
          onClick={onBack}
        >
          &larr; Back to My Tickets
        </button>
      )}

      {/* Global notifications */}
      {uploadSuccess && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          {uploadSuccess}
          <button
            type="button"
            className="btn-close"
            onClick={() => setUploadSuccess(null)}
          ></button>
        </div>
      )}

      {removalSuccess && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          {removalSuccess}
          <button
            type="button"
            className="btn-close"
            onClick={() => setRemovalSuccess(null)}
          ></button>
        </div>
      )}

      {/* Main Ticket Detail Card */}
      <div
        className="card shadow-sm border-0 mb-4"
        data-testid="ticket-detail-card"
        style={{ borderRadius: 10, overflow: "hidden" }}
      >
        <div
          className="card-header text-white p-3 d-flex flex-wrap align-items-center justify-content-between"
          style={{ backgroundColor: "#006B3C" }}
        >
          <div>
            <h2 className="h4 mb-0 fw-bold text-white">{ticket.ticketNumber}</h2>
            <small style={{ opacity: 0.9 }}>Created: {formatDate(ticket.createdAt)}</small>
          </div>
          <div className="d-flex align-items-center gap-2 mt-2 mt-sm-0">
            <span className="badge bg-light text-dark fs-6">{ticket.requestedPriority}</span>
            <span className="badge bg-warning text-dark fs-6">{ticket.currentStatus}</span>
          </div>
        </div>

        <div className="card-body p-4" style={{ backgroundColor: "#ffffff" }}>
          <h3 className="h5 fw-bold mb-3" style={{ color: "#006B3C" }}>
            {ticket.summary}
          </h3>

          <div className="row g-3 mb-4">
            <div className="col-12 col-md-4">
              <div className="p-3 rounded" style={{ backgroundColor: "#EAF6EF" }}>
                <small className="text-muted d-block fw-bold">REQUESTER</small>
                <span className="fw-semibold">{ticket.requester.displayName}</span>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="p-3 rounded" style={{ backgroundColor: "#EAF6EF" }}>
                <small className="text-muted d-block fw-bold">CATEGORY</small>
                <span className="fw-semibold">{ticket.category.name}</span>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="p-3 rounded" style={{ backgroundColor: "#EAF6EF" }}>
                <small className="text-muted d-block fw-bold">RELATED SYSTEM</small>
                <span className="fw-semibold">{ticket.relatedSystem.name}</span>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="h6 fw-bold text-muted mb-2">DESCRIPTION</h4>
            <div
              className="p-3 rounded border text-wrap"
              style={{ backgroundColor: "#f8f9fa", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {ticket.description}
            </div>
          </div>

          {/* Attachments Section */}
          <hr />
          <div className="mt-4">
            <h4 className="h5 fw-bold mb-3" style={{ color: "#006B3C" }}>
              Attachments ({activeAttachments.length}/5)
            </h4>

            {uploadError && (
              <div className="alert alert-danger" role="alert">
                {uploadError}
              </div>
            )}

            {/* Active Attachment List */}
            {activeAttachments.length === 0 ? (
              <p className="text-muted italic">No active attachments.</p>
            ) : (
              <div className="table-responsive mb-4">
                <table className="table table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Filename</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>Uploaded</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeAttachments.map((att) => (
                      <tr key={att.id}>
                        <td className="fw-semibold">{att.originalFilename}</td>
                        <td>
                          <span className="badge bg-secondary">{att.mimeType}</span>
                        </td>
                        <td>{formatFileSize(att.sizeBytes)}</td>
                        <td>{formatDate(att.uploadedAt)}</td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success me-2"
                            onClick={() => handleDownload(att)}
                          >
                            Download
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => openRemoveModal(att)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add Attachment Upload Control */}
            <div className="card p-3" style={{ backgroundColor: "#EAF6EF", border: "1px dashed #006B3C" }}>
              <h5 className="h6 fw-bold mb-2" style={{ color: "#006B3C" }}>
                Add Attachment
              </h5>
              {isMaxAttachments && (
                <p className="text-danger mb-2 small fw-bold">
                  Maximum active attachments limit (5) reached. Soft-remove an existing file to upload a new one.
                </p>
              )}
              <div>
                <div className="mb-2">
                  <label htmlFor="attachment-upload-input" className="form-label small fw-bold">
                    Upload Attachment
                  </label>
                  <input
                    id="attachment-upload-input"
                    type="file"
                    className="form-control"
                    aria-label="Upload Attachment"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={handleFileChange}
                    disabled={isMaxAttachments || isUploading}
                  />
                  <small className="text-muted d-block mt-1">
                    Permitted file types: JPG/JPEG, PNG, WEBP, PDF (Max 5 MB per file).
                  </small>
                </div>
                <button
                  type="button"
                  className="btn text-white mt-2"
                  style={{ backgroundColor: "#006B3C" }}
                  onClick={handleUpload}
                  disabled={!selectedFile || isMaxAttachments || isUploading}
                >
                  {isUploading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Uploading...
                    </>
                  ) : (
                    "Upload"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Removal Confirmation Modal Dialog */}
      {removingAttachment && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold text-danger">Reason for Removal</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={closeRemoveModal}
                  disabled={isRemoving}
                ></button>
              </div>
              <div className="modal-body">
                <p className="small text-muted mb-3">
                  You are soft-removing <strong>{removingAttachment.originalFilename}</strong>. Please provide a mandatory reason for this removal action.
                </p>

                {removalError && (
                  <div className="alert alert-danger" role="alert">
                    {removalError}
                  </div>
                )}

                <div className="mb-3">
                  <label htmlFor="removal-reason-input" className="form-label fw-bold">
                    Removal Reason
                  </label>
                  <textarea
                    id="removal-reason-input"
                    className="form-control"
                    rows={3}
                    aria-label="Removal Reason"
                    placeholder="Enter reason for soft removal..."
                    value={removalReason}
                    onChange={(e) => setRemovalReason(e.target.value)}
                    disabled={isRemoving}
                    autoFocus
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeRemoveModal}
                  disabled={isRemoving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmRemoval}
                  disabled={isRemoving}
                >
                  {isRemoving ? "Removing..." : "Confirm Removal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
