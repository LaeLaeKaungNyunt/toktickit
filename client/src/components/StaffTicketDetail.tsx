import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.js";
import { fetchStaffTicketDetail, StaffTicketDetailResponse } from "../api/staff.js";

interface StaffTicketDetailProps {
  ticketId: string;
  onBack: () => void;
}

export const StaffTicketDetail: React.FC<StaffTicketDetailProps> = ({ ticketId, onBack }) => {
  const { token } = useAuth();
  const [ticket, setTicket] = useState<StaffTicketDetailResponse["ticket"] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !ticketId) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchStaffTicketDetail(token, ticketId)
      .then((data) => {
        if (isMounted) {
          setTicket(data.ticket);
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
      case "In Progress":
        return "bg-primary bg-opacity-10 text-primary border border-primary";
      case "On Hold":
        return "bg-warning bg-opacity-15 text-dark border border-warning";
      case "Resolved":
        return "bg-info bg-opacity-10 text-info border border-info";
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
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="fw-bold mb-1" style={{ color: "#006B3C" }}>
                Ticket {ticket.ticketNumber}
              </h2>
              <p className="text-muted mb-0">{ticket.summary}</p>
            </div>
            <div className="d-flex gap-2">
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
        <div className="row g-4">
          <div className="col-12 col-lg-8">
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

            {/* Read-only Attachments */}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "10px" }}>
                <div className="card-header bg-light border-0 fw-semibold">
                  Attachments ({ticket.attachments.length})
                </div>
                <div className="card-body">
                  <ul className="list-group list-group-flush">
                    {ticket.attachments.map((att) => (
                      <li key={att.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                        <div>
                          <span className="fw-semibold text-dark me-2">{att.filename}</span>
                          <span className="text-muted small">({(att.sizeBytes / 1024).toFixed(1)} KB)</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-sm" style={{ borderRadius: "10px" }}>
              <div className="card-header bg-light border-0 fw-semibold">
                Ticket Metadata
              </div>
              <div className="card-body small">
                <div className="mb-3">
                  <span className="text-muted d-block">Requester</span>
                  <span className="fw-semibold text-dark">{ticket.requester.name}</span>
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
      )}
    </div>
  );
};
