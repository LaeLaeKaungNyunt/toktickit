import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchStaffTickets } from "../api/staff";
import { StaffQueueTicket, StaffQueueQueryParams, StaffQueuePagination } from "../types/staff";

interface StaffTicketQueueProps {
  onSelectTicket?: (ticketId: string) => void;
}

export const StaffTicketQueue: React.FC<StaffTicketQueueProps> = ({ onSelectTicket }) => {
  const { token } = useAuth();

  // Query State
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [assignmentFilter, setAssignmentFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"createdAt" | "ticketNumber" | "status" | "requestedPriority" | "itPriority" | "updatedAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  // Data & Async State
  const [tickets, setTickets] = useState<StaffQueueTicket[]>([]);
  const [pagination, setPagination] = useState<StaffQueuePagination>({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const params: StaffQueueQueryParams = {
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      assignment: assignmentFilter || undefined,
      sortBy,
      sortOrder,
      page,
      pageSize,
    };

    try {
      const data = await fetchStaffTickets(token, params);
      setTickets(data.items);
      setPagination(data.pagination);
    } catch (err: any) {
      setError(err.message || "Failed to load ticket queue.");
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter, priorityFilter, assignmentFilter, sortBy, sortOrder, page]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPriorityFilter("");
    setAssignmentFilter("");
    setSortBy("createdAt");
    setSortOrder("desc");
    setPage(1);
  };

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
      {/* Header Banner */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: "#006B3C" }}>
            IT Staff Ticket Queue
          </h2>
          <p className="text-muted mb-0">
            View, filter, and access all incoming service tickets
          </p>
        </div>
        <span className="badge bg-success px-3 py-2 fs-6" style={{ backgroundColor: "#006B3C" }}>
          IT Staff Portal
        </span>
      </div>

      {/* Filter and Control Toolbar */}
      <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: "10px" }}>
        <div className="card-body p-3 bg-light" style={{ borderRadius: "10px" }}>
          <div className="row g-3 align-items-center">
            {/* Search Input */}
            <div className="col-12 col-md-4">
              <label htmlFor="search-input" className="form-label small fw-semibold text-muted mb-1">
                Search Queue
              </label>
              <input
                id="search-input"
                type="text"
                className="form-control form-control-sm"
                placeholder="Search ticket #, summary, requester..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Status Filter */}
            <div className="col-6 col-md-2">
              <label htmlFor="status-filter" className="form-label small fw-semibold text-muted mb-1">
                Status
              </label>
              <select
                id="status-filter"
                className="form-select form-select-sm"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Statuses</option>
                <option value="New">New</option>
                <option value="In Progress">In Progress</option>
                <option value="On Hold">On Hold</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* IT Priority Filter */}
            <div className="col-6 col-md-2">
              <label htmlFor="priority-filter" className="form-label small fw-semibold text-muted mb-1">
                IT Priority
              </label>
              <select
                id="priority-filter"
                className="form-select form-select-sm"
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
                <option value="Unassigned">Unset / Unassigned</option>
              </select>
            </div>

            {/* Assignment Filter */}
            <div className="col-6 col-md-2">
              <label htmlFor="assignment-filter" className="form-label small fw-semibold text-muted mb-1">
                Assignment
              </label>
              <select
                id="assignment-filter"
                className="form-select form-select-sm"
                value={assignmentFilter}
                onChange={(e) => {
                  setAssignmentFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Tickets</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>

            {/* Sort Controls */}
            <div className="col-6 col-md-2">
              <label htmlFor="sort-by-select" className="form-label small fw-semibold text-muted mb-1">
                Sort By
              </label>
              <div className="d-flex gap-1">
                <select
                  id="sort-by-select"
                  className="form-select form-select-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="createdAt">Created Date</option>
                  <option value="ticketNumber">Ticket Number</option>
                  <option value="status">Status</option>
                  <option value="requestedPriority">Req Priority</option>
                  <option value="itPriority">IT Priority</option>
                  <option value="updatedAt">Updated Date</option>
                </select>
                <button
                  type="button"
                  aria-label="Toggle sort order"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                  title={`Order: ${sortOrder.toUpperCase()}`}
                >
                  {sortOrder === "asc" ? "↑" : "↓"}
                </button>
              </div>
            </div>
          </div>

          {/* Reset Filters Bar */}
          {(search || statusFilter || priorityFilter || assignmentFilter || sortBy !== "createdAt" || sortOrder !== "desc") && (
            <div className="mt-2 text-end">
              <button
                type="button"
                className="btn btn-link btn-sm text-decoration-none text-secondary p-0"
                onClick={handleResetFilters}
              >
                Reset Filters & Search
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 text-muted">Loading ticket queue...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
          <div>
            <strong>Error:</strong> {error}
          </div>
          <button className="btn btn-sm btn-outline-danger" onClick={loadQueue}>
            Retry
          </button>
        </div>
      )}

      {/* Data Content */}
      {!loading && !error && (
        <>
          {pagination.totalItems === 0 ? (
            search || statusFilter || priorityFilter || assignmentFilter ? (
              <div className="card border-0 shadow-sm text-center py-5">
                <div className="card-body">
                  <h5 className="text-muted mb-2">No matching tickets found</h5>
                  <p className="text-secondary small mb-3">
                    No tickets match your search query or selected filter criteria.
                  </p>
                  <button className="btn btn-sm btn-outline-success" onClick={handleResetFilters}>
                    Clear Filters & Search
                  </button>
                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm text-center py-5">
                <div className="card-body">
                  <h5 className="text-muted mb-2">No Service Tickets</h5>
                  <p className="text-secondary small mb-0">
                    There are currently no tickets in the system queue.
                  </p>
                </div>
              </div>
            )
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="card border-0 shadow-sm overflow-hidden mb-3 d-none d-md-block staff-queue-desktop-table">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: "140px" }}>Ticket #</th>
                        <th>Requester</th>
                        <th>Category</th>
                        <th>Summary</th>
                        <th style={{ width: "120px" }}>Status</th>
                        <th style={{ width: "110px" }}>IT Priority</th>
                        <th style={{ width: "140px" }}>Assignee</th>
                        <th style={{ width: "110px" }} className="text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((t) => (
                        <tr key={t.id}>
                          <td className="fw-bold font-monospace text-success" style={{ color: "#006B3C" }}>
                            {t.ticketNumber}
                          </td>
                          <td>
                            <div className="fw-semibold">{t.requester.name}</div>
                          </td>
                          <td>
                            <span className="badge bg-light text-dark border">
                              {t.category.name}
                            </span>
                          </td>
                          <td>
                            <div className="text-truncate" style={{ maxWidth: "300px" }} title={t.summary}>
                              {t.summary}
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${getStatusBadgeClass(t.status)}`}>
                              {t.status}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${getPriorityBadgeClass(t.itPriority)}`}>
                              {t.itPriority || "Unset"}
                            </span>
                          </td>
                          <td>
                            {t.assignee ? (
                              <span className="fw-semibold text-dark">{t.assignee.name}</span>
                            ) : (
                              <span className="badge bg-secondary bg-opacity-75">Unassigned</span>
                            )}
                          </td>
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success"
                              style={{ borderColor: "#006B3C", color: "#006B3C" }}
                              onClick={() => onSelectTicket && onSelectTicket(t.id)}
                            >
                              View Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile / Stacked Card View */}
              <div className="d-md-none mb-3 staff-queue-mobile-cards">
                {tickets.map((t) => (
                  <div key={t.id} className="card border-0 shadow-sm mb-3 staff-queue-mobile-card" style={{ borderRadius: "10px" }}>
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <span className="fw-bold font-monospace text-success me-2" style={{ color: "#006B3C" }}>
                            {t.ticketNumber}
                          </span>
                          <span className="badge bg-light text-dark border">
                            {t.category.name}
                          </span>
                        </div>
                        <span className={`badge ${getStatusBadgeClass(t.status)}`}>
                          {t.status}
                        </span>
                      </div>

                      <h6 className="card-title fw-semibold text-dark mb-2" title={t.summary}>
                        {t.summary}
                      </h6>

                      <div className="bg-light p-2 rounded mb-3 small">
                        <div className="d-flex justify-content-between mb-1">
                          <span className="text-muted">Requester:</span>
                          <span className="fw-semibold text-dark">{t.requester.name}</span>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                          <span className="text-muted">IT Priority:</span>
                          <span className={`badge ${getPriorityBadgeClass(t.itPriority)}`}>
                            {t.itPriority || "Unset"}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span className="text-muted">Assignee:</span>
                          {t.assignee ? (
                            <span className="fw-semibold text-dark">{t.assignee.name}</span>
                          ) : (
                            <span className="badge bg-secondary bg-opacity-75">Unassigned</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success w-100"
                        style={{ borderColor: "#006B3C", color: "#006B3C" }}
                        onClick={() => onSelectTicket && onSelectTicket(t.id)}
                      >
                        View Detail
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Toolbar */}
              <div className="d-flex justify-content-between align-items-center pt-2">
                <span className="small text-muted">
                  Showing {(pagination.page - 1) * pagination.pageSize + 1}–
                  {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of{" "}
                  {pagination.totalItems} tickets
                </span>
                <nav aria-label="Staff queue pagination">
                  <ul className="pagination pagination-sm mb-0">
                    <li className={`page-item ${pagination.page <= 1 ? "disabled" : ""}`}>
                      <button
                        className="page-item-btn btn btn-sm btn-outline-secondary me-1"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={pagination.page <= 1}
                      >
                        Previous
                      </button>
                    </li>
                    <li className="page-item disabled d-flex align-items-center mx-2">
                      <span className="small text-muted">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                    </li>
                    <li className={`page-item ${pagination.page >= pagination.totalPages ? "disabled" : ""}`}>
                      <button
                        className="page-item-btn btn btn-sm btn-outline-secondary ms-1"
                        onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={pagination.page >= pagination.totalPages}
                      >
                        Next
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
