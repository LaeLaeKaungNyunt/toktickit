import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchRequesterDashboard } from "../api/requester";
import { RequesterDashboardResponse } from "../types/requester";

export interface RequesterDashboardProps {
  onNavigateToMyTickets?: () => void;
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

export const RequesterDashboard: React.FC<RequesterDashboardProps> = ({
  onNavigateToMyTickets,
  onSelectTicket,
}) => {
  const { token } = useAuth();
  const [data, setData] = useState<RequesterDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchRequesterDashboard(token);
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

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
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

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
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
        <div
          className="alert alert-danger d-flex justify-content-between align-items-center"
          role="alert"
        >
          <div>
            <strong>Failed to load dashboard:</strong>{" "}
            {error || "Unable to load dashboard. Please try again."}
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

  const metrics = data.metrics || {
    myActiveTickets: 0,
    waitingForMe: 0,
    resolvedTicketsCount: 0,
    totalTicketsCount: 0,
    statusCounts: {},
  };
  const statusCounts = metrics.statusCounts || {};
  const waitingForMeTickets = data.waitingForMeTickets || [];
  const recentlyResolvedTickets = data.recentlyResolvedTickets || [];
  const recentTickets = data.recentTickets || [];

  return (
    <div className="container py-4">
      {/* Header Banner */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: "#006B3C" }}>
            My Dashboard
          </h2>
          <p className="text-muted mb-0">
            Personal ticket activity, attention items, and status overview
          </p>
        </div>
        <span
          className="badge bg-success px-3 py-2 fs-6"
          style={{ backgroundColor: "#006B3C" }}
        >
          Requester Portal
        </span>
      </div>

      {/* Summary Cards Grid */}
      <div className="row g-3 mb-4">
        {/* Card 1: My Active Tickets */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="card h-100 shadow-sm border-0 border-start border-4 border-success cursor-pointer"
            style={{ cursor: "pointer", transition: "transform 0.15s ease-in-out" }}
            role="button"
            tabIndex={0}
            data-testid="metric-my-active-tickets"
            aria-label="View My Active Tickets in My Tickets"
            onClick={() => onNavigateToMyTickets?.()}
            onKeyDown={(e) => handleCardKeyDown(e, () => onNavigateToMyTickets?.())}
          >
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-semibold mb-1">
                My Active Tickets
              </div>
              <div className="h2 mb-0 fw-bold" style={{ color: "#006B3C" }}>
                {metrics.myActiveTickets ?? 0}
              </div>
              <div className="text-muted small mt-2">Excludes Closed &amp; Cancelled</div>
            </div>
          </div>
        </div>

        {/* Card 2: Waiting for Me */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="card h-100 shadow-sm border-0 border-start border-4 border-warning cursor-pointer"
            style={{ cursor: "pointer", transition: "transform 0.15s ease-in-out" }}
            role="button"
            tabIndex={0}
            data-testid="metric-waiting-for-me"
            aria-label="View tickets Waiting for Me in Needs My Attention section"
            onClick={() => scrollToSection("needs-attention")}
            onKeyDown={(e) => handleCardKeyDown(e, () => scrollToSection("needs-attention"))}
          >
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-semibold mb-1">
                Waiting for Me
              </div>
              <div className="h2 mb-0 fw-bold text-warning">
                {metrics.waitingForMe ?? 0}
              </div>
              <div className="text-muted small mt-2">Requires your response</div>
            </div>
          </div>
        </div>

        {/* Card 3: Recently Resolved */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="card h-100 shadow-sm border-0 border-start border-4 border-info cursor-pointer"
            style={{ cursor: "pointer", transition: "transform 0.15s ease-in-out" }}
            role="button"
            tabIndex={0}
            data-testid="metric-recently-resolved"
            aria-label="View Recently Resolved tickets section"
            onClick={() => scrollToSection("recently-resolved")}
            onKeyDown={(e) => handleCardKeyDown(e, () => scrollToSection("recently-resolved"))}
          >
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-semibold mb-1">
                Recently Resolved
              </div>
              <div className="h2 mb-0 fw-bold text-info">
                {metrics.resolvedTicketsCount ?? 0}
              </div>
              <div className="text-muted small mt-2">Completed requests</div>
            </div>
          </div>
        </div>

        {/* Card 4: Total Tickets */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="card h-100 shadow-sm border-0 border-start border-4 border-secondary cursor-pointer"
            style={{ cursor: "pointer", transition: "transform 0.15s ease-in-out" }}
            role="button"
            tabIndex={0}
            data-testid="metric-total-tickets"
            aria-label="View Total Tickets in My Tickets"
            onClick={() => onNavigateToMyTickets?.()}
            onKeyDown={(e) => handleCardKeyDown(e, () => onNavigateToMyTickets?.())}
          >
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-semibold mb-1">
                Total Tickets
              </div>
              <div className="h2 mb-0 fw-bold text-secondary">
                {metrics.totalTicketsCount ?? 0}
              </div>
              <div className="text-muted small mt-2">All submitted tickets</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tickets by Status Overview */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-header bg-white py-3 border-bottom">
          <h5 className="mb-0 fw-bold" style={{ color: "#006B3C" }}>
            Tickets by Status
          </h5>
        </div>
        <div className="card-body">
          <div className="row g-2">
            {ALL_STATUSES.map((status) => (
              <div key={status} className="col-6 col-sm-4 col-md-3">
                <div className="p-2 rounded border bg-light d-flex justify-content-between align-items-center">
                  <span className={`badge ${getStatusBadgeClass(status)} me-2`}>
                    {status}
                  </span>
                  <span className="fw-bold fs-6">
                    {statusCounts[status] ?? 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 1: Needs My Attention */}
      <div id="needs-attention" tabIndex={-1} className="card shadow-sm border-0 mb-4">
        <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-bold text-warning">
            Needs My Attention
          </h5>
          <span className="badge bg-warning text-dark">
            {waitingForMeTickets.length} items
          </span>
        </div>
        <div className="card-body">
          {waitingForMeTickets.length === 0 ? (
            <p className="text-muted mb-0 fst-italic">
              No tickets are waiting for your response.
            </p>
          ) : (
            <div className="list-group list-group-flush">
              {waitingForMeTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="list-group-item d-flex justify-content-between align-items-center px-0 py-3"
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  onClick={() => onSelectTicket?.(ticket.id)}
                  onKeyDown={(e) => handleCardKeyDown(e, () => onSelectTicket?.(ticket.id))}
                >
                  <div className="me-3">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="fw-bold text-primary">{ticket.ticketNumber}</span>
                      <span className={`badge ${getStatusBadgeClass(ticket.status)}`}>
                        Status: {ticket.status}
                      </span>
                    </div>
                    <div className="fw-semibold text-dark">{ticket.summary}</div>
                    <small className="text-muted">
                      Updated: {formatDate(ticket.updatedAt)}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm text-white"
                    style={{ backgroundColor: "#006B3C" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTicket?.(ticket.id);
                    }}
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Recently Resolved */}
      <div id="recently-resolved" tabIndex={-1} className="card shadow-sm border-0 mb-4">
        <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-bold text-success">
            Resolved Tickets
          </h5>
          <span className="badge bg-success">
            {recentlyResolvedTickets.length} items
          </span>
        </div>
        <div className="card-body">
          {recentlyResolvedTickets.length === 0 ? (
            <p className="text-muted mb-0 fst-italic">
              No recently resolved tickets.
            </p>
          ) : (
            <div className="list-group list-group-flush">
              {recentlyResolvedTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="list-group-item d-flex justify-content-between align-items-center px-0 py-3"
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  onClick={() => onSelectTicket?.(ticket.id)}
                  onKeyDown={(e) => handleCardKeyDown(e, () => onSelectTicket?.(ticket.id))}
                >
                  <div className="me-3">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="fw-bold text-primary">{ticket.ticketNumber}</span>
                      <span className={`badge ${getStatusBadgeClass(ticket.status)}`}>
                        Status: {ticket.status}
                      </span>
                    </div>
                    <div className="fw-semibold text-dark mb-1">{ticket.summary}</div>
                    {ticket.resolutionSummary && (
                      <div className="small text-muted mb-1">
                        <strong>Resolution:</strong> {ticket.resolutionSummary}
                      </div>
                    )}
                    <small className="text-muted">
                      Resolved: {formatDate(ticket.resolvedAt || ticket.updatedAt)}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-success"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTicket?.(ticket.id);
                    }}
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Recently Updated Tickets */}
      <div id="recent-tickets" tabIndex={-1} className="card shadow-sm border-0 mb-4">
        <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-bold" style={{ color: "#006B3C" }}>
            Recently Updated Tickets
          </h5>
          <span className="badge bg-secondary">
            {recentTickets.length} items
          </span>
        </div>
        <div className="card-body">
          {recentTickets.length === 0 ? (
            <p className="text-muted mb-0 fst-italic">
              No recent tickets.
            </p>
          ) : (
            <div className="list-group list-group-flush">
              {recentTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="list-group-item d-flex justify-content-between align-items-center px-0 py-3"
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  onClick={() => onSelectTicket?.(ticket.id)}
                  onKeyDown={(e) => handleCardKeyDown(e, () => onSelectTicket?.(ticket.id))}
                >
                  <div className="me-3">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="fw-bold text-primary">{ticket.ticketNumber}</span>
                      <span className={`badge ${getStatusBadgeClass(ticket.status)}`}>
                        Status: {ticket.status}
                      </span>
                    </div>
                    <div className="fw-semibold text-dark">{ticket.summary}</div>
                    <small className="text-muted">
                      Updated: {formatDate(ticket.updatedAt)}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTicket?.(ticket.id);
                    }}
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequesterDashboard;
