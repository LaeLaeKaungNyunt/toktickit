import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.js";
import {
  fetchStaffTicketDetail,
  claimStaffTicket,
  reassignStaffTicket,
  updateStaffTicketPriority,
  updateStaffTicketStatus,
  fetchStaffTicketComments,
  addStaffTicketComment,
  fetchStaffTicketNotes,
  addStaffTicketNote,
  fetchStaffUsers,
  StaffTicketDetailResponse,
  TicketCommentDto,
  InternalNoteDto,
  StaffUserDto,
} from "../api/staff.js";
import {
  uploadAttachment,
  downloadAttachment,
  softRemoveAttachment,
} from "../api/lab02.js";

interface StaffTicketDetailProps {
  ticketId: string;
  onBack: () => void;
}

const PERMITTED_TRANSITIONS: Record<string, string[]> = {
  New: ["Open", "In Progress", "Waiting for Requester", "Cancelled"],
  Open: ["In Progress", "Waiting for Requester", "Resolved", "Cancelled"],
  "In Progress": ["Waiting for Requester", "Resolved", "Cancelled"],
  "Waiting for Requester": ["In Progress", "Resolved", "Cancelled"],
  Resolved: ["Closed", "Reopened", "In Progress"],
  Reopened: ["In Progress", "Waiting for Requester", "Resolved", "Cancelled"],
  Closed: [],
  Cancelled: [],
};

export const StaffTicketDetail: React.FC<StaffTicketDetailProps> = ({ ticketId, onBack }) => {
  const { user, token } = useAuth();
  const [ticket, setTicket] = useState<StaffTicketDetailResponse["ticket"] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Users list for reassignment
  const [staffUsers, setStaffUsers] = useState<StaffUserDto[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  // Priority state
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [isUpdatingPriority, setIsUpdatingPriority] = useState<boolean>(false);

  // Status transition state
  const [selectedNextStatus, setSelectedNextStatus] = useState<string>("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  // Public Comments state
  const [comments, setComments] = useState<TicketCommentDto[]>([]);
  const [commentInput, setCommentInput] = useState<string>("");
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);

  // Internal Notes state
  const [notes, setNotes] = useState<InternalNoteDto[]>([]);
  const [noteInput, setNoteInput] = useState<string>("");
  const [isSubmittingNote, setIsSubmittingNote] = useState<boolean>(false);

  // Attachment state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);
  const [attachmentUploadError, setAttachmentUploadError] = useState<string | null>(null);
  const [attachmentUploadSuccess, setAttachmentUploadSuccess] = useState<string | null>(null);

  // Soft Removal state
  const [removingAttachment, setRemovingAttachment] = useState<any | null>(null);
  const [removalReason, setRemovalReason] = useState<string>("");
  const [isRemovingAttachment, setIsRemovingAttachment] = useState<boolean>(false);
  const [attachmentRemovalError, setAttachmentRemovalError] = useState<string | null>(null);
  const [attachmentRemovalSuccess, setAttachmentRemovalSuccess] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
  const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentUploadError(null);
    setAttachmentUploadSuccess(null);

    const file = e.target.files?.[0];
    if (!file) {
      setAttachmentUploadError("Allowed file types are JPG, PNG, WEBP, and PDF.");
      setSelectedFile(null);
      return;
    }

    const fileNameLower = file.name.toLowerCase();
    const fileTypeLower = file.type ? file.type.toLowerCase() : "";

    const isValidType =
      ALLOWED_MIME_TYPES.includes(fileTypeLower) ||
      ALLOWED_EXTENSIONS.some((ext) => fileNameLower.endsWith(ext));

    if (!isValidType) {
      setAttachmentUploadError("Allowed file types are JPG, PNG, WEBP, and PDF.");
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setAttachmentUploadError("File size must not exceed 5 MB.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleUploadAttachment = async () => {
    if (!selectedFile || !ticket || !token) return;
    const activeCount = ticket.attachments ? ticket.attachments.length : 0;
    if (activeCount >= 5) return;

    setIsUploadingAttachment(true);
    setAttachmentUploadError(null);
    setAttachmentUploadSuccess(null);

    try {
      const newAtt = await uploadAttachment(ticket.id, selectedFile, token);
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              attachments: [
                ...prev.attachments,
                {
                  id: newAtt.id,
                  filename: newAtt.originalFilename,
                  mimeType: newAtt.mimeType,
                  sizeBytes: newAtt.sizeBytes,
                  uploadedAt: newAtt.uploadedAt,
                },
              ],
            }
          : prev
      );
      setAttachmentUploadSuccess("Attachment uploaded successfully.");
      setSelectedFile(null);
      const inputEl = document.getElementById("staff-attachment-upload-input") as HTMLInputElement;
      if (inputEl) inputEl.value = "";
    } catch (err: any) {
      setAttachmentUploadError(err.message || "Attachment upload failed.");
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleDownloadAttachment = async (attId: string) => {
    if (!ticket || !token) return;
    setDownloadError(null);
    try {
      await downloadAttachment(ticket.id, attId, token);
    } catch (err: any) {
      setDownloadError(err.message || "Unable to download attachment.");
    }
  };

  const openRemoveModal = (att: any) => {
    setRemovingAttachment(att);
    setRemovalReason("");
    setAttachmentRemovalError(null);
  };

  const closeRemoveModal = () => {
    setRemovingAttachment(null);
    setRemovalReason("");
    setAttachmentRemovalError(null);
  };

  const handleConfirmRemoval = async () => {
    if (!removingAttachment || !ticket || !token) return;
    const trimmedReason = removalReason.trim();
    if (!trimmedReason) {
      setAttachmentRemovalError("Removal reason is required.");
      return;
    }

    setIsRemovingAttachment(true);
    setAttachmentRemovalError(null);

    try {
      await softRemoveAttachment(
        ticket.id,
        removingAttachment.id,
        { reason: trimmedReason },
        token
      );

      setTicket((prev) =>
        prev
          ? {
              ...prev,
              attachments: prev.attachments.filter((a) => a.id !== removingAttachment.id),
            }
          : prev
      );

      setAttachmentRemovalSuccess("Attachment removed successfully.");
      closeRemoveModal();
    } catch (err: any) {
      setAttachmentRemovalError(err.message || "Unable to remove attachment.");
    } finally {
      setIsRemovingAttachment(false);
    }
  };

  useEffect(() => {
    if (!token || !ticketId) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchStaffTicketDetail(token, ticketId),
      fetchStaffTicketComments(token, ticketId).catch(() => ({ comments: [] })),
      fetchStaffTicketNotes(token, ticketId).catch(() => ({ notes: [] })),
      fetchStaffUsers(token).catch(() => ({ users: [] })),
    ])
      .then(([detailData, commentsData, notesData, usersData]) => {
        if (isMounted) {
          setTicket(detailData.ticket);
          setSelectedPriority(detailData.ticket.itPriority || detailData.ticket.requestedPriority || "Medium");
          setSelectedAssignee(detailData.ticket.assignee?.id || "");
          setComments(commentsData.comments);
          setNotes(notesData.notes);
          setStaffUsers(usersData.users);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load ticket detail.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, ticketId]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "New":
        return "bg-success bg-opacity-10 text-success border border-success";
      case "Open":
        return "bg-info bg-opacity-15 text-dark border border-info";
      case "In Progress":
        return "bg-primary bg-opacity-10 text-primary border border-primary";
      case "Waiting for Requester":
        return "bg-warning bg-opacity-15 text-dark border border-warning";
      case "Resolved":
        return "bg-success text-white";
      case "Reopened":
        return "bg-warning text-dark border border-warning";
      case "Closed":
        return "bg-secondary bg-opacity-10 text-secondary border border-secondary";
      case "Cancelled":
        return "bg-danger bg-opacity-10 text-danger border border-danger";
      default:
        return "bg-light text-dark border";
    }
  };

  const getPriorityBadgeClass = (priority: string | null) => {
    if (!priority) return "bg-light text-muted border";
    switch (priority) {
      case "Urgent":
        return "bg-danger text-white";
      case "High":
        return "bg-warning text-dark";
      case "Medium":
        return "bg-info text-dark";
      case "Low":
        return "bg-secondary text-white";
      default:
        return "bg-light text-dark border";
    }
  };

  // Claim ticket handler
  const handleClaimTicket = async () => {
    if (!token || !ticketId || isAssigning) return;
    setIsAssigning(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await claimStaffTicket(token, ticketId);
      if (ticket) {
        setTicket({
          ...ticket,
          assignee: res.ticket.assignee,
        });
        setSelectedAssignee(res.ticket.assignee?.id || "");
      }
      setActionSuccess("Ticket claimed successfully.");
    } catch (err: any) {
      setActionError(err.message || "Failed to claim ticket.");
    } finally {
      setIsAssigning(false);
    }
  };

  // Reassign ticket handler
  const handleReassignTicket = async () => {
    if (!token || !ticketId || isAssigning) return;
    setIsAssigning(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const targetId = selectedAssignee === "" ? null : selectedAssignee;
      const res = await reassignStaffTicket(token, ticketId, targetId);
      if (ticket) {
        setTicket({
          ...ticket,
          assignee: res.ticket.assignee,
        });
      }
      setActionSuccess(targetId ? "Ticket reassigned successfully." : "Ticket unassigned.");
    } catch (err: any) {
      setActionError(err.message || "Failed to reassign ticket.");
    } finally {
      setIsAssigning(false);
    }
  };

  // Priority update handler
  const handleUpdatePriority = async () => {
    if (!token || !ticketId || isUpdatingPriority || !selectedPriority) return;
    setIsUpdatingPriority(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await updateStaffTicketPriority(token, ticketId, selectedPriority);
      if (ticket) {
        setTicket({
          ...ticket,
          itPriority: res.ticket.itPriority,
        });
      }
      setActionSuccess(`IT Priority updated to ${res.ticket.itPriority}.`);
    } catch (err: any) {
      setActionError(err.message || "Failed to update IT Priority.");
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  // Status update handler
  const handleUpdateStatus = async (nextStatus: string) => {
    if (!token || !ticketId || isUpdatingStatus || !nextStatus) return;
    setIsUpdatingStatus(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await updateStaffTicketStatus(token, ticketId, nextStatus);
      if (ticket) {
        setTicket({
          ...ticket,
          status: res.ticket.status,
        });
      }
      setSelectedNextStatus("");
      setActionSuccess(`Status updated to ${res.ticket.status}.`);
    } catch (err: any) {
      setActionError(err.message || "Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Submit Public Comment handler
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !ticketId || isSubmittingComment || !commentInput.trim()) return;
    setIsSubmittingComment(true);
    setActionError(null);

    try {
      const res = await addStaffTicketComment(token, ticketId, commentInput.trim());
      setComments((prev) => [...prev, res.comment]);
      setCommentInput("");
    } catch (err: any) {
      setActionError(err.message || "Failed to add public comment.");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Submit Internal Note handler
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !ticketId || isSubmittingNote || !noteInput.trim()) return;
    setIsSubmittingNote(true);
    setActionError(null);

    try {
      const res = await addStaffTicketNote(token, ticketId, noteInput.trim());
      setNotes((prev) => [...prev, res.note]);
      setNoteInput("");
    } catch (err: any) {
      setActionError(err.message || "Failed to add internal note.");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const permittedNextStatuses = ticket ? PERMITTED_TRANSITIONS[ticket.status] || [] : [];
  const isTerminalStatus = permittedNextStatuses.length === 0;

  return (
    <div className="container py-4">
      {/* Back Button and Header */}
      <div className="mb-4">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary mb-3"
          onClick={onBack}
        >
          &larr; Back to Ticket Queue
        </button>
        {ticket && (
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <h2 className="fw-bold mb-1" style={{ color: "#006B3C" }}>
                Ticket {ticket.ticketNumber}
              </h2>
              <p className="text-muted mb-0">{ticket.summary}</p>
            </div>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              {ticket.requesterResolution === "RESOLVED" && (
                <span className="badge bg-success fs-6 px-3 py-2" title="Requester indicated resolution">
                  ✓ Marked Resolved by Requester
                </span>
              )}
              <span className={`badge ${getStatusBadgeClass(ticket.status)} fs-6 px-3 py-2`}>
                {ticket.status}
              </span>
              <span className={`badge ${getPriorityBadgeClass(ticket.itPriority)} fs-6 px-3 py-2`}>
                IT Priority: {ticket.itPriority || "Unset"}
              </span>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 text-muted">Loading ticket details...</p>
        </div>
      )}

      {!loading && error && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
          <div>
            <strong>Error:</strong> {error}
          </div>
          <button className="btn btn-sm btn-outline-danger" onClick={onBack}>
            Return to Queue
          </button>
        </div>
      )}

      {!loading && !error && ticket && (
        <>
          {/* Action Notifications */}
          {actionSuccess && (
            <div className="alert alert-success alert-dismissible fade show mb-4" role="alert">
              {actionSuccess}
              <button
                type="button"
                className="btn-close"
                onClick={() => setActionSuccess(null)}
              ></button>
            </div>
          )}

          {actionError && (
            <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
              {actionError}
              <button
                type="button"
                className="btn-close"
                onClick={() => setActionError(null)}
              ></button>
            </div>
          )}

          {/* IT Staff Operations Toolbar Card */}
          <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "10px", backgroundColor: "#EAF6EF" }}>
            <div className="card-body p-3">
              <h5 className="fw-bold mb-3" style={{ color: "#006B3C" }}>
                IT Staff Ticket Operations
              </h5>
              <div className="row g-3 align-items-end">
                {/* Claim Button */}
                <div className="col-12 col-sm-6 col-md-3">
                  <label className="form-label small fw-semibold text-muted mb-1">Ownership</label>
                  <button
                    type="button"
                    className="btn btn-success btn-sm w-100 fw-semibold"
                    style={{ backgroundColor: "#006B3C", borderColor: "#006B3C" }}
                    onClick={handleClaimTicket}
                    disabled={isAssigning || ticket.assignee?.id === user?.id}
                  >
                    {isAssigning ? "Processing..." : ticket.assignee?.id === user?.id ? "Claimed by You" : "Claim Ticket"}
                  </button>
                </div>

                {/* Reassign Dropdown */}
                <div className="col-12 col-sm-6 col-md-3">
                  <label htmlFor="reassign-select" className="form-label small fw-semibold text-muted mb-1">
                    Reassign Staff
                  </label>
                  <div className="input-group input-group-sm">
                    <select
                      id="reassign-select"
                      className="form-select form-select-sm"
                      value={selectedAssignee}
                      onChange={(e) => setSelectedAssignee(e.target.value)}
                    >
                      <option value="">-- Unassigned --</option>
                      {staffUsers.map((su) => (
                        <option key={su.id} value={su.id}>
                          {su.name} ({su.role})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-outline-success"
                      onClick={handleReassignTicket}
                      disabled={isAssigning}
                    >
                      Apply
                    </button>
                  </div>
                </div>

                {/* IT Priority Selector */}
                <div className="col-12 col-sm-6 col-md-3">
                  <label htmlFor="it-priority-select" className="form-label small fw-semibold text-muted mb-1">
                    Set IT Priority
                  </label>
                  <div className="input-group input-group-sm">
                    <select
                      id="it-priority-select"
                      className="form-select form-select-sm"
                      value={selectedPriority}
                      onChange={(e) => setSelectedPriority(e.target.value)}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                    <button
                      type="button"
                      className="btn btn-outline-success"
                      onClick={handleUpdatePriority}
                      disabled={isUpdatingPriority || selectedPriority === ticket.itPriority}
                    >
                      Save
                    </button>
                  </div>
                </div>

                {/* Status Transition Controls */}
                <div className="col-12 col-sm-6 col-md-3">
                  <label htmlFor="status-transition-select" className="form-label small fw-semibold text-muted mb-1">
                    Status Transition
                  </label>
                  {isTerminalStatus ? (
                    <span className="badge bg-secondary w-100 py-2">Terminal Status ({ticket.status})</span>
                  ) : (
                    <div className="input-group input-group-sm">
                      <select
                        id="status-transition-select"
                        className="form-select form-select-sm"
                        value={selectedNextStatus}
                        onChange={(e) => setSelectedNextStatus(e.target.value)}
                      >
                        <option value="">-- Select Status --</option>
                        {permittedNextStatuses.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleUpdateStatus(selectedNextStatus)}
                        disabled={isUpdatingStatus || !selectedNextStatus}
                      >
                        Transition
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="row g-4">
            <div className="col-12 col-lg-8">
              {/* Description */}
              <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "10px" }}>
                <div className="card-header bg-light border-0 fw-semibold">
                  Ticket Description
                </div>
                <div className="card-body">
                  <p className="card-text text-dark" style={{ whiteSpace: "pre-wrap" }}>
                    {ticket.description}
                  </p>
                </div>
              </div>

              {/* Attachments Section */}
              <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "10px" }}>
                <div className="card-header bg-light border-0 fw-semibold d-flex justify-content-between align-items-center">
                  <span>Attachments ({ticket.attachments ? ticket.attachments.length : 0}/5)</span>
                </div>
                <div className="card-body">
                  {attachmentUploadSuccess && (
                    <div className="alert alert-success alert-dismissible fade show" role="alert">
                      {attachmentUploadSuccess}
                      <button type="button" className="btn-close" onClick={() => setAttachmentUploadSuccess(null)}></button>
                    </div>
                  )}

                  {attachmentRemovalSuccess && (
                    <div className="alert alert-success alert-dismissible fade show" role="alert">
                      {attachmentRemovalSuccess}
                      <button type="button" className="btn-close" onClick={() => setAttachmentRemovalSuccess(null)}></button>
                    </div>
                  )}

                  {downloadError && (
                    <div className="alert alert-danger alert-dismissible fade show" role="alert">
                      {downloadError}
                      <button type="button" className="btn-close" onClick={() => setDownloadError(null)}></button>
                    </div>
                  )}

                  {attachmentUploadError && (
                    <div className="alert alert-danger" role="alert">
                      {attachmentUploadError}
                    </div>
                  )}

                  {(!ticket.attachments || ticket.attachments.length === 0) ? (
                    <p className="text-muted italic mb-3">No active attachments.</p>
                  ) : (
                    <div className="table-responsive mb-3">
                      <table className="table table-hover align-middle mb-0">
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
                          {ticket.attachments.map((att) => (
                            <tr key={att.id}>
                              <td className="fw-semibold text-dark">{att.filename}</td>
                              <td><span className="badge bg-secondary">{att.mimeType}</span></td>
                              <td>{(att.sizeBytes / 1024 < 1024) ? `${(att.sizeBytes / 1024).toFixed(1)} KB` : `${(att.sizeBytes / (1024 * 1024)).toFixed(1)} MB`}</td>
                              <td>{new Date(att.uploadedAt).toLocaleString()}</td>
                              <td className="text-end">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-success me-2"
                                  onClick={() => handleDownloadAttachment(att.id)}
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

                  {/* Add Attachment Upload Form */}
                  <div className="card p-3" style={{ backgroundColor: "#EAF6EF", border: "1px dashed #006B3C" }}>
                    <h6 className="fw-bold mb-2" style={{ color: "#006B3C" }}>
                      Add Attachment
                    </h6>
                    {ticket.attachments && ticket.attachments.length >= 5 && (
                      <p className="text-danger mb-2 small fw-bold">
                        Maximum active attachments limit (5) reached. Soft-remove an existing file to upload a new one.
                      </p>
                    )}
                    <div>
                      <div className="mb-2">
                        <label htmlFor="staff-attachment-upload-input" className="form-label small fw-bold">
                          Upload Attachment
                        </label>
                        <input
                          id="staff-attachment-upload-input"
                          type="file"
                          className="form-control"
                          aria-label="Upload Attachment"
                          accept=".jpg,.jpeg,.png,.webp,.pdf"
                          onChange={handleFileChange}
                          disabled={(ticket.attachments && ticket.attachments.length >= 5) || isUploadingAttachment}
                        />
                        <small className="text-muted d-block mt-1">
                          Permitted file types: JPG/JPEG, PNG, WEBP, PDF (Max 5 MB per file).
                        </small>
                      </div>
                      <button
                        type="button"
                        className="btn text-white mt-2 btn-sm fw-semibold"
                        style={{ backgroundColor: "#006B3C" }}
                        onClick={handleUploadAttachment}
                        disabled={!selectedFile || (ticket.attachments && ticket.attachments.length >= 5) || isUploadingAttachment}
                      >
                        {isUploadingAttachment ? "Uploading..." : "Upload"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Public Comments */}
              <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "10px" }}>
                <div className="card-header bg-light border-0 fw-semibold d-flex justify-content-between align-items-center">
                  <span>Public Comments ({comments.length})</span>
                  <span className="badge bg-info text-dark">Requester Visible</span>
                </div>
                <div className="card-body">
                  {comments.length === 0 ? (
                    <p className="text-muted small mb-3">No public comments yet.</p>
                  ) : (
                    <div className="mb-4">
                      {comments.map((c) => (
                        <div key={c.id} className="p-3 mb-2 rounded bg-light border">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="fw-semibold text-dark">
                              {c.author.name} <span className="badge bg-secondary bg-opacity-75 ms-1">{c.author.role}</span>
                            </span>
                            <small className="text-muted">{new Date(c.createdAt).toLocaleString()}</small>
                          </div>
                          <p className="mb-0 text-dark" style={{ whiteSpace: "pre-wrap" }}>
                            {c.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleAddComment}>
                    <div className="mb-2">
                      <label htmlFor="public-comment-input" className="form-label small fw-semibold text-muted">
                        Add Public Comment
                      </label>
                      <textarea
                        id="public-comment-input"
                        className="form-control"
                        rows={3}
                        maxLength={2000}
                        placeholder="Write a public comment visible to the requester..."
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        disabled={isSubmittingComment}
                      ></textarea>
                    </div>
                    <button
                      type="submit"
                      className="btn btn-sm btn-success fw-semibold"
                      style={{ backgroundColor: "#006B3C", borderColor: "#006B3C" }}
                      disabled={isSubmittingComment || !commentInput.trim()}
                    >
                      {isSubmittingComment ? "Posting..." : "Post Public Comment"}
                    </button>
                  </form>
                </div>
              </div>

              {/* Internal Notes (Staff Only) */}
              <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "10px", borderColor: "#ffc107" }}>
                <div className="card-header bg-warning bg-opacity-15 border-0 fw-semibold d-flex justify-content-between align-items-center">
                  <span className="text-dark">🔒 Internal Notes ({notes.length})</span>
                  <span className="badge bg-warning text-dark">Staff Only — Hidden from Requester</span>
                </div>
                <div className="card-body">
                  {notes.length === 0 ? (
                    <p className="text-muted small mb-3">No internal notes yet.</p>
                  ) : (
                    <div className="mb-4">
                      {notes.map((n) => (
                        <div key={n.id} className="p-3 mb-2 rounded border" style={{ backgroundColor: "#FFFBEB" }}>
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="fw-semibold text-dark">
                              {n.author.name} <span className="badge bg-dark ms-1">{n.author.role}</span>
                            </span>
                            <small className="text-muted">{new Date(n.createdAt).toLocaleString()}</small>
                          </div>
                          <p className="mb-0 text-dark" style={{ whiteSpace: "pre-wrap" }}>
                            {n.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleAddNote}>
                    <div className="mb-2">
                      <label htmlFor="internal-note-input" className="form-label small fw-semibold text-muted">
                        Add Internal Note (Staff Only)
                      </label>
                      <textarea
                        id="internal-note-input"
                        className="form-control"
                        rows={3}
                        maxLength={2000}
                        placeholder="Write an internal note restricted to staff..."
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        disabled={isSubmittingNote}
                      ></textarea>
                    </div>
                    <button
                      type="submit"
                      className="btn btn-sm btn-warning text-dark fw-semibold"
                      disabled={isSubmittingNote || !noteInput.trim()}
                    >
                      {isSubmittingNote ? "Posting..." : "Post Internal Note"}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* Metadata Panel */}
            <div className="col-12 col-lg-4">
              <div className="card border-0 shadow-sm" style={{ borderRadius: "10px" }}>
                <div className="card-header bg-light border-0 fw-semibold">
                  Ticket Metadata
                </div>
                <div className="card-body small">
                  <div className="mb-3">
                    <span className="text-muted d-block">Requester</span>
                    <span className="fw-semibold text-dark">{ticket.requester.name}</span>
                    <small className="text-muted d-block">{ticket.requester.email}</small>
                  </div>
                  <div className="mb-3">
                    <span className="text-muted d-block">Category</span>
                    <span className="badge bg-light text-dark border">{ticket.category.name}</span>
                  </div>
                  <div className="mb-3">
                    <span className="text-muted d-block">Related System</span>
                    <span className="text-dark">{ticket.relatedSystem.name}</span>
                  </div>
                  <div className="mb-3">
                    <span className="text-muted d-block">Requested Priority</span>
                    <span className="text-dark">{ticket.requestedPriority}</span>
                  </div>
                  <div className="mb-3">
                    <span className="text-muted d-block">Assigned IT Staff</span>
                    {ticket.assignee ? (
                      <span className="fw-semibold text-dark">{ticket.assignee.name}</span>
                    ) : (
                      <span className="badge bg-secondary bg-opacity-75">Unassigned</span>
                    )}
                  </div>
                  <div className="mb-3">
                    <span className="text-muted d-block">Requester Resolution</span>
                    {ticket.requesterResolution === "RESOLVED" ? (
                      <span className="badge bg-success">RESOLVED</span>
                    ) : (
                      <span className="text-muted">Unindicated</span>
                    )}
                  </div>
                  <div className="mb-3">
                    <span className="text-muted d-block">Created At</span>
                    <span className="text-dark">{new Date(ticket.createdAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted d-block">Last Updated</span>
                    <span className="text-dark">{new Date(ticket.updatedAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Removal Confirmation Modal */}
          {removingAttachment && (
            <div className="modal fade show d-block" tabIndex={-1} role="dialog" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
              <div className="modal-dialog modal-dialog-centered" role="document">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title fw-bold text-danger">Reason for Removal</h5>
                    <button type="button" className="btn-close" aria-label="Close" onClick={closeRemoveModal} disabled={isRemovingAttachment}></button>
                  </div>
                  <div className="modal-body">
                    <p className="small text-muted mb-3">
                      You are soft-removing <strong>{removingAttachment.filename}</strong>. Please provide a mandatory reason for this removal action.
                    </p>
                    {attachmentRemovalError && (
                      <div className="alert alert-danger" role="alert">
                        {attachmentRemovalError}
                      </div>
                    )}
                    <div className="mb-3">
                      <label htmlFor="staff-removal-reason-input" className="form-label fw-bold">
                        Removal Reason
                      </label>
                      <textarea
                        id="staff-removal-reason-input"
                        className="form-control"
                        rows={3}
                        placeholder="Enter reason for soft removal..."
                        value={removalReason}
                        onChange={(e) => setRemovalReason(e.target.value)}
                        disabled={isRemovingAttachment}
                        autoFocus
                      ></textarea>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={closeRemoveModal} disabled={isRemovingAttachment}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={handleConfirmRemoval} disabled={isRemovingAttachment}>
                      {isRemovingAttachment ? "Removing..." : "Confirm Removal"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
