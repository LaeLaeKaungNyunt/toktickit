import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRequester } from "../context/RequesterContext.js";
import {
  fetchMyTickets,
  fetchCategoriesV1,
  fetchRelatedSystems,
} from "../api/lab02.js";
import {
  CategoryV1,
  RelatedSystem,
  TicketListItemDto,
  PaginationMetadata,
  RequestedPriority,
  TicketSortBy,
  SortOrder,
} from "../types/lab02.js";

interface MyTicketsProps {
  onNavigateToCreateTicket?: () => void;
}

export default function MyTickets({ onNavigateToCreateTicket }: MyTicketsProps) {
  const { selectedRequester } = useRequester();

  const [tickets, setTickets] = useState<TicketListItemDto[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reference Data
  const [categories, setCategories] = useState<CategoryV1[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);

  // State to track if requester owns ANY tickets overall (for AC-17 vs AC-18)
  const [hasAnyTicketsOverall, setHasAnyTicketsOverall] = useState<boolean | null>(null);

  // Filter, Search, and Sort state
  const [searchInput, setSearchInput] = useState<string>("");
  const [appliedSearch, setAppliedSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [relatedSystemFilter, setRelatedSystemFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<TicketSortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState<number>(1);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  // Synchronously reset data on requester change (AC-12 context switching)
  const prevRequesterIdRef = useRef<string | undefined>(selectedRequester?.id);
  if (prevRequesterIdRef.current !== selectedRequester?.id) {
    prevRequesterIdRef.current = selectedRequester?.id;
    setTickets([]);
    setHasAnyTicketsOverall(null);
    setSearchInput("");
    setAppliedSearch("");
    setStatusFilter("");
    setCategoryFilter("");
    setRelatedSystemFilter("");
    setPriorityFilter("");
    setSortBy("createdAt");
    setSortOrder("desc");
    setPage(1);
    setError(null);
  }

  // Load reference data on mount
  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [catData, sysData] = await Promise.all([
          fetchCategoriesV1(),
          fetchRelatedSystems(),
        ]);
        setCategories(catData);
        setRelatedSystems(sysData);
      } catch {
        // Safe reference data loading error handling
      }
    }
    loadReferenceData();
  }, []);

  // Main data fetching effect
  useEffect(() => {
    if (!selectedRequester) {
      setTickets([]);
      setHasAnyTicketsOverall(null);
      setLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const parsedCatId = categoryFilter ? parseInt(categoryFilter, 10) : undefined;

    fetchMyTickets(
      {
        search: appliedSearch || undefined,
        status: statusFilter || undefined,
        categoryId: parsedCatId,
        relatedSystemId: relatedSystemFilter || undefined,
        requestedPriority: (priorityFilter as RequestedPriority) || undefined,
        sortBy,
        sortOrder,
        page,
        pageSize: 10,
      },
      selectedRequester.id
    )
      .then((res) => {
        if (!isMounted) return;
        setTickets(res.items);
        setPagination(res.pagination);

        const isUnfiltered =
          !appliedSearch &&
          !statusFilter &&
          !categoryFilter &&
          !relatedSystemFilter &&
          !priorityFilter;

        if (isUnfiltered) {
          setHasAnyTicketsOverall(res.pagination.totalItems > 0);
        } else if (res.pagination.totalItems > 0) {
          setHasAnyTicketsOverall(true);
        } else {
          setHasAnyTicketsOverall((prev) => (prev === null ? false : prev));
        }
        setLoading(false);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setError(err.message || "Unable to retrieve Tickets");
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    selectedRequester?.id,
    appliedSearch,
    statusFilter,
    categoryFilter,
    relatedSystemFilter,
    priorityFilter,
    sortBy,
    sortOrder,
    page,
    retryTrigger,
  ]);

  // Event handlers
  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput);
  }

  function handleClearFilters() {
    setSearchInput("");
    setAppliedSearch("");
    setStatusFilter("");
    setCategoryFilter("");
    setRelatedSystemFilter("");
    setPriorityFilter("");
    setPage(1);
  }

  function handleRetry() {
    setRetryTrigger((prev) => prev + 1);
  }

  function getPriorityBadgeClass(priority: string) {
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
        return "bg-light text-dark";
    }
  }

  if (!selectedRequester) {
    return (
      <div className="alert alert-info mt-4" role="status">
        Please select a Development Requester to view tickets.
      </div>
    );
  }

  const hasActiveFiltersOrSearch =
    Boolean(appliedSearch) ||
    Boolean(statusFilter) ||
    Boolean(categoryFilter) ||
    Boolean(relatedSystemFilter) ||
    Boolean(priorityFilter);

  return (
    <div className="my-tickets-container mt-4">
      {/* Control Panel: Search, Filters, and Sort */}
      <div
        className="card mb-4 p-3 border-0 shadow-sm"
        style={{ backgroundColor: "#EAF6EF" }}
      >
        <form onSubmit={handleSearchSubmit} className="row g-3 align-items-end">
          {/* Search Input */}
          <div className="col-12 col-md-5">
            <label htmlFor="search-tickets-input" className="form-label fw-bold">
              Search Tickets
            </label>
            <div className="input-group">
              <input
                id="search-tickets-input"
                type="text"
                className="form-control"
                placeholder="Search by number, summary, description..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button
                type="submit"
                className="btn text-white"
                style={{ backgroundColor: "#006B3C" }}
              >
                Search
              </button>
            </div>
          </div>

          {/* Status Filter */}
          <div className="col-6 col-md-2">
            <label htmlFor="status-filter-select" className="form-label fw-bold">
              Status
            </label>
            <select
              id="status-filter-select"
              className="form-select"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
            >
              <option value="">All Statuses</option>
              <option value="New">New</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="col-6 col-md-2">
            <label htmlFor="category-filter-select" className="form-label fw-bold">
              Category
            </label>
            <select
              id="category-filter-select"
              className="form-select"
              value={categoryFilter}
              onChange={(e) => {
                setPage(1);
                setCategoryFilter(e.target.value);
              }}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Related System Filter */}
          <div className="col-6 col-md-3">
            <label htmlFor="system-filter-select" className="form-label fw-bold">
              Related System
            </label>
            <select
              id="system-filter-select"
              className="form-select"
              value={relatedSystemFilter}
              onChange={(e) => {
                setPage(1);
                setRelatedSystemFilter(e.target.value);
              }}
            >
              <option value="">All Systems</option>
              {relatedSystems.map((sys) => (
                <option key={sys.id} value={sys.id}>
                  {sys.name}
                </option>
              ))}
            </select>
          </div>

          {/* Requested Priority Filter */}
          <div className="col-6 col-md-3">
            <label htmlFor="priority-filter-select" className="form-label fw-bold">
              Requested Priority
            </label>
            <select
              id="priority-filter-select"
              className="form-select"
              value={priorityFilter}
              onChange={(e) => {
                setPage(1);
                setPriorityFilter(e.target.value);
              }}
            >
              <option value="">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>

          {/* Sort By Select */}
          <div className="col-6 col-md-3">
            <label htmlFor="sort-by-select" className="form-label fw-bold">
              Sort By
            </label>
            <select
              id="sort-by-select"
              className="form-select"
              value={sortBy}
              onChange={(e) => {
                setPage(1);
                setSortBy(e.target.value as TicketSortBy);
              }}
            >
              <option value="createdAt">Created Date</option>
              <option value="ticketNumber">Ticket Number</option>
              <option value="requestedPriority">Requested Priority</option>
            </select>
          </div>

          {/* Sort Order Select */}
          <div className="col-6 col-md-3">
            <label htmlFor="sort-order-select" className="form-label fw-bold">
              Sort Order
            </label>
            <select
              id="sort-order-select"
              className="form-select"
              value={sortOrder}
              onChange={(e) => {
                setPage(1);
                setSortOrder(e.target.value as SortOrder);
              }}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>

          {/* Reset Filters CTA if active */}
          {hasActiveFiltersOrSearch && (
            <div className="col-12 text-end">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={handleClearFilters}
              >
                Clear Filters
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-5" role="status">
          <div
            className="spinner-border"
            style={{ color: "#006B3C" }}
            role="status"
          >
            <span className="visually-hidden">Loading tickets...</span>
          </div>
          <p className="mt-2 text-muted">Loading tickets...</p>
        </div>
      )}

      {/* Error State + Retry Button */}
      {!loading && error && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between my-3" role="alert">
          <div>{error}</div>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      )}

      {/* AC-17 General Empty State */}
      {!loading && !error && hasAnyTicketsOverall === false && (
        <div className="card text-center py-5 border-dashed border-2 bg-light my-3">
          <div className="card-body">
            <h3 className="h5 card-title text-muted mb-3">No Tickets Found</h3>
            <p className="card-text text-secondary mb-4">
              You have not submitted any IT support tickets yet.
            </p>
            {onNavigateToCreateTicket && (
              <button
                type="button"
                className="btn text-white btn-lg"
                style={{ backgroundColor: "#006B3C" }}
                onClick={onNavigateToCreateTicket}
              >
                Create a Ticket
              </button>
            )}
          </div>
        </div>
      )}

      {/* AC-18 Distinct No-Results State */}
      {!loading && !error && hasAnyTicketsOverall === true && tickets.length === 0 && (
        <div className="card text-center py-5 border-dashed border-2 bg-light my-3">
          <div className="card-body">
            <h3 className="h5 card-title text-muted mb-3">No Matching Tickets</h3>
            <p className="card-text text-secondary mb-4">
              No tickets match your search or filter criteria.
            </p>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={handleClearFilters}
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Populated State (Desktop/Tablet Table + Mobile Stacked Cards) */}
      {!loading && !error && tickets.length > 0 && (
        <>
          {/* Desktop/Tablet Table */}
          <div className="table-responsive d-none d-md-block shadow-sm rounded">
            <table className="table table-hover align-middle mb-0 bg-white">
              <thead style={{ backgroundColor: "#EAF6EF" }}>
                <tr>
                  <th scope="col" style={{ color: "#006B3C" }}>Ticket #</th>
                  <th scope="col" style={{ color: "#006B3C" }}>Summary</th>
                  <th scope="col" style={{ color: "#006B3C" }}>Category</th>
                  <th scope="col" style={{ color: "#006B3C" }}>Related System</th>
                  <th scope="col" style={{ color: "#006B3C" }}>Priority</th>
                  <th scope="col" style={{ color: "#006B3C" }}>Status</th>
                  <th scope="col" style={{ color: "#006B3C" }}>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((tkt) => (
                  <tr key={tkt.id}>
                    <td className="fw-bold" style={{ color: "#006B3C" }}>
                      {tkt.ticketNumber}
                    </td>
                    <td>{tkt.summary}</td>
                    <td>{tkt.category.name}</td>
                    <td>{tkt.relatedSystem.name}</td>
                    <td>
                      <span className={`badge ${getPriorityBadgeClass(tkt.requestedPriority)}`}>
                        {tkt.requestedPriority}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-success bg-opacity-75 text-white">
                        {tkt.currentStatus}
                      </span>
                    </td>
                    <td className="text-muted small">
                      {new Date(tkt.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Card Presentation */}
          <div className="d-block d-md-none">
            {tickets.map((tkt) => (
              <div key={tkt.id} className="card mb-3 shadow-sm border-0">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="fw-bold" style={{ color: "#006B3C" }}>
                      {tkt.ticketNumber}
                    </span>
                    <span className={`badge ${getPriorityBadgeClass(tkt.requestedPriority)}`}>
                      {tkt.requestedPriority}
                    </span>
                  </div>
                  <h5 className="card-title h6 mb-2">{tkt.summary}</h5>
                  <p className="card-text small text-muted mb-1">
                    <strong>Category:</strong> {tkt.category.name}
                  </p>
                  <p className="card-text small text-muted mb-2">
                    <strong>System:</strong> {tkt.relatedSystem.name}
                  </p>
                  <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                    <span className="badge bg-success bg-opacity-75 text-white">
                      {tkt.currentStatus}
                    </span>
                    <span className="small text-muted">
                      {new Date(tkt.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Accessible Pagination Footer */}
          <nav
            className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top"
            aria-label="Pagination"
          >
            <div className="text-muted small">
              Page {pagination.page} of {pagination.totalPages || 1} ({pagination.totalItems} total tickets)
            </div>
            <div className="btn-group">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1 || loading}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
              >
                Next
              </button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
