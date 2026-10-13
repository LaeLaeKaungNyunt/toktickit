import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchStaffDashboard } from "../api/staff";
import { StaffDashboardResponse } from "../types/staff";

export interface StaffDashboardProps {
  onNavigateToQueue?: (filters?: {
    assignment?: string;
    assignedToMe?: boolean;
    priority?: string;
    status?: string;
  }) => void;
  onSelectTicket?: (ticketId: string) => void;
}

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

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  onNavigateToQueue,
  onSelectTicket,
}) => {
  const { token } = useAuth();
  const [data, setData] = useState<StaffDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchStaffDashboard(token);
      setData(result);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleCardKeyDown = (
    e: React.KeyboardEvent,
    action: () => void
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };

  const scrollToActions = () => {
    const el = document.getElementById("my-actions");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      el.focus();
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "New":
        return "bg-success bg-opacity-10 text-success border border-success";
      case "Open":
        return "bg-info bg-opacity-10 text-info border border-info";
      case "In Progress":
        return "bg-primary bg-opacity-10 text-primary border border-primary";
      case "Waiting for Requester":
        return "bg-warning bg-opacity-25 text-dark border border-warning";
      case "Resolved":
        return "bg-success text-white";
      case "Closed":
        return "bg-secondary text-white";
      case "Reopened":
        return "bg-warning text-dark border border-warning";
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

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2 text-muted">Loading dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
          <div>
            <strong>Failed to load dashboard:</strong> {error || "Unable to load dashboard. Please try again."}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={loadDashboard}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { metrics, myActions, recentTickets, urgentTickets } = data;

  return (
    <div className="container py-4">
      {/* Header Banner */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: "#006B3C" }}>
            IT Staff Dashboard
          </h2>
          <p className="text-muted mb-0">
            Operational workload, priority issues, and assigned work
          </p>
        </div>
        <span
          className="badge bg-success px-3 py-2 fs-6"
          style={{ backgroundColor: "#006B3C" }}
        >
          Operations Center
        </span>
      </div>

      {/* 1. Operational Summary Metric Cards */}
      <div className="row g-3 mb-4">
        {/* Card 1: Unassigned Tickets */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            data-testid="metric-unassigned-tickets"
            className="card shadow-sm border-0 h-100"
            style={{ borderRadius: "10px", cursor: "pointer", transition: "transform 0.15s ease-in-out" }}
            role="button"
            tabIndex={0}
            aria-label={`Unassigned Tickets: ${metrics.unassignedTickets}. Click to filter queue.`}
            onClick={() => onNavigateToQueue?.({ assignment: "unassigned" })}
            onKeyDown={(e) =>
              handleCardKeyDown(e, () => onNavigateToQueue?.({ assignment: "unassigned" }))
            }
          >
            <div className="card-body p-3 d-flex flex-column justify-content-between">
              <span className="text-muted small fw-semibold text-uppercase">
                Unassigned Tickets
              </span>
              <div className="d-flex justify-content-between align-items-baseline mt-2">
                <span className="fs-2 fw-bold text-dark">{metrics.unassignedTickets}</span>
                <span className="badge bg-secondary bg-opacity-10 text-secondary border">Queue</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: My Assigned Tickets */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            data-testid="metric-my-assigned-tickets"
            className="card shadow-sm border-0 h-100"
            style={{ borderRadius: "10px", cursor: "pointer", transition: "transform 0.15s ease-in-out" }}
            role="button"
            tabIndex={0}
            aria-label={`My Assigned Tickets: ${metrics.myAssignedTickets}. Click to view your tickets.`}
            onClick={() => onNavigateToQueue?.({ assignedToMe: true })}
            onKeyDown={(e) =>
              handleCardKeyDown(e, () => onNavigateToQueue?.({ assignedToMe: true }))
            }
          >
            <div className="card-body p-3 d-flex flex-column justify-content-between">
              <span className="text-muted small fw-semibold text-uppercase">
                My Assigned Tickets
              </span>
              <div className="d-flex justify-content-between align-items-baseline mt-2">
                <span className="fs-2 fw-bold" style={{ color: "#006B3C" }}>
                  {metrics.myAssignedTickets}
                </span>
                <span className="badge bg-success bg-opacity-10 text-success border border-success">Assigned</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Urgent Tickets */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            data-testid="metric-urgent-tickets"
            className="card shadow-sm border-0 h-100"
            style={{ borderRadius: "10px", cursor: "pointer", transition: "transform 0.15s ease-in-out" }}
            role="button"
            tabIndex={0}
            aria-label={`Urgent Tickets: ${metrics.urgentTickets}. Click to view urgent tickets.`}
            onClick={() => onNavigateToQueue?.({ priority: "Urgent,High" })}
            onKeyDown={(e) =>
              handleCardKeyDown(e, () => onNavigateToQueue?.({ priority: "Urgent,High" }))
            }
          >
            <div className="card-body p-3 d-flex flex-column justify-content-between">
              <span className="text-muted small fw-semibold text-uppercase">
                Urgent Tickets
              </span>
              <div className="d-flex justify-content-between align-items-baseline mt-2">
                <span className="fs-2 fw-bold text-danger">{metrics.urgentTickets}</span>
                <span className="badge bg-danger text-white">Priority</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: My Active Actions */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            data-testid="metric-my-active-actions"
            className="card shadow-sm border-0 h-100"
            style={{ borderRadius: "10px", cursor: "pointer", transition: "transform 0.15s ease-in-out" }}
            role="button"
            tabIndex={0}
            aria-label={`My Active Actions: ${metrics.myActiveActionsCount}. Click to scroll to actions section.`}
            onClick={scrollToActions}
            onKeyDown={(e) => handleCardKeyDown(e, scrollToActions)}
          >
            <div className="card-body p-3 d-flex flex-column justify-content-between">
              <span className="text-muted small fw-semibold text-uppercase">
                My Active Actions
              </span>
              <div className="d-flex justify-content-between align-items-baseline mt-2">
                <span className="fs-2 fw-bold text-primary">{metrics.myActiveActionsCount}</span>
                <span className="badge bg-primary bg-opacity-10 text-primary border border-primary">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Tickets by Status Overview Card */}
      <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: "10px" }}>
        <div className="card-body p-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold mb-0 text-dark">
              Status Overview
            </h5>
            <span className="text-muted small">Click any status to filter queue</span>
          </div>
          <div className="row g-2">
            {ALL_STATUSES.map((statusName) => {
              const count = metrics.statusCounts[statusName] ?? 0;
              return (
                <div key={statusName} className="col-6 col-md-3">
                  <div
                    className="p-2 border rounded d-flex justify-content-between align-items-center"
                    style={{ cursor: "pointer", backgroundColor: "#f8f9fa" }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Status ${statusName}: ${count} tickets`}
                    onClick={() => onNavigateToQueue?.({ status: statusName })}
                    onKeyDown={(e) =>
                      handleCardKeyDown(e, () => onNavigateToQueue?.({ status: statusName }))
                    }
                  >
                    <span className="small fw-semibold text-dark">{statusName}</span>
                    <span className={`badge ${getStatusBadgeClass(statusName)}`}>
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Work Lists Row: My Actions Taken & Urgent Tickets */}
      <div className="row g-4 mb-4">
        {/* 3.1 My Actions Taken Preview Section */}
        <div className="col-12 col-lg-6">
          <div
            id="my-actions"
            tabIndex={-1}
            className="card shadow-sm border-0 h-100"
            style={{ borderRadius: "10px" }}
          >
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold mb-0 text-dark">
                  My Actions Taken
                </h5>
                <span className="badge bg-light text-secondary border">Up to 5 Active</span>
              </div>

              {myActions.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <p className="mb-0">No active Actions Taken assigned to you.</p>
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {myActions.map((action) => (
                    <div
                      key={action.id}
                      className="list-group-item px-0 py-2 border-bottom d-flex flex-column gap-1"
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none fw-bold text-start"
                          style={{ color: "#006B3C" }}
                          onClick={() => onSelectTicket?.(action.ticketId)}
                        >
                          {action.ticketNumber}: {action.ticketSummary}
                        </button>
                        <span className="badge bg-primary bg-opacity-10 text-primary border border-primary ms-2">
                          {action.status}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none text-dark text-start small mb-1"
                        onClick={() => onSelectTicket?.(action.ticketId)}
                      >
                        {action.description}
                      </button>
                      <div className="d-flex justify-content-between align-items-center small text-muted">
                        <span>{new Date(action.actionDateTime).toLocaleString()}</span>
                        {action.followUpRequired && (
                          <span className="badge bg-warning bg-opacity-25 text-dark border border-warning">
                            Follow-up Required
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3.2 Urgent Tickets Preview Section */}
        <div className="col-12 col-lg-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: "10px" }}>
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold mb-0 text-dark" aria-label="Urgent Tickets">
                  Urgent Tickets Queue
                </h5>
                <span className="badge bg-light text-secondary border">Top 5 Priority</span>
              </div>

              {urgentTickets.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <p className="mb-0">No urgent tickets requiring attention.</p>
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {urgentTickets.map((t) => (
                    <div
                      key={t.id}
                      className="list-group-item px-0 py-2 border-bottom d-flex flex-column gap-1"
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none fw-bold text-start"
                          style={{ color: "#006B3C" }}
                          onClick={() => onSelectTicket?.(t.id)}
                        >
                          {t.ticketNumber}: {t.summary}
                        </button>
                        <span className={`badge ${getPriorityBadgeClass(t.itPriority)} ms-2`}>
                          {t.itPriority}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center small text-muted mt-1">
                        <div>
                          <span className={`badge ${getStatusBadgeClass(t.status)} me-2`}>
                            Status: {t.status}
                          </span>
                          <span>Assignee: </span>
                          <span>{t.assignee ? t.assignee.name : "Unassigned"}</span>
                        </div>
                        <span>{new Date(t.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Recently Updated Tickets Preview Section */}
      <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: "10px" }}>
        <div className="card-body p-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold mb-0 text-dark">
              Recently Updated Tickets
            </h5>
            <span className="badge bg-light text-secondary border">Latest 5 Updates</span>
          </div>

          {recentTickets.length === 0 ? (
            <div className="text-center py-4 text-muted">
              <p className="mb-0">No recently updated tickets.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: "140px" }}>Ticket #</th>
                    <th>Summary</th>
                    <th style={{ width: "140px" }}>Status</th>
                    <th style={{ width: "110px" }}>Priority</th>
                    <th style={{ width: "160px" }}>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTickets.map((t) => (
                    <tr
                      key={t.id}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none fw-bold font-monospace"
                          style={{ color: "#006B3C" }}
                          onClick={() => onSelectTicket?.(t.id)}
                        >
                          {t.ticketNumber}
                        </button>
                      </td>
                      <td className="text-truncate" style={{ maxWidth: "320px" }}>
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none text-dark text-start"
                          onClick={() => onSelectTicket?.(t.id)}
                        >
                          {t.summary}
                        </button>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadgeClass(t.status)}`}>
                          Status: {t.status}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${getPriorityBadgeClass(t.itPriority || t.requestedPriority)}`}>
                          {t.itPriority || t.requestedPriority}
                        </span>
                      </td>
                      <td className="small text-muted">
                        {new Date(t.updatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
