import { useEffect, useState } from "react";
import { fetchDevelopmentRequesters } from "../api/lab02.js";
import { DevelopmentRequester } from "../types/lab02.js";
import { useRequester } from "../context/RequesterContext.js";

export default function RequesterSelector() {
  const { selectedRequester, setSelectedRequester, changeRequester } = useRequester();

  const [requesters, setRequesters] = useState<DevelopmentRequester[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSelectionId, setPendingSelectionId] = useState<string>("");

  async function loadRequesters() {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchDevelopmentRequesters();
      setRequesters(data);
      if (data.length > 0 && !pendingSelectionId) {
        setPendingSelectionId(data[0].id);
      }
    } catch {
      setError("Unable to load Development Requesters");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequesters();
  }, []);

  function handleConfirmSelection() {
    const chosen = requesters.find((r) => r.id === pendingSelectionId);
    if (chosen) {
      setSelectedRequester(chosen);
    }
  }

  if (loading) {
    return (
      <div
        className="p-3 mb-4 rounded border"
        style={{ backgroundColor: "#EAF6EF", borderColor: "#0B7A46" }}
      >
        <p className="m-0 text-dark font-weight-bold">
          <span className="spinner-border spinner-border-sm me-2 text-success" role="status" />
          Loading Requesters…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger mb-4 d-flex justify-content-between align-items-center">
        <div>
          <strong>Error: </strong> {error}
        </div>
        <button className="btn btn-outline-danger btn-sm" onClick={loadRequesters}>
          Retry
        </button>
      </div>
    );
  }

  if (selectedRequester) {
    return (
      <div
        className="p-3 mb-4 rounded border d-flex justify-content-between align-items-center shadow-sm"
        style={{ backgroundColor: "#EAF6EF", borderColor: "#006B3C" }}
      >
        <div>
          <span className="badge me-2" style={{ backgroundColor: "#006B3C", color: "#FFFFFF" }}>
            Active Context
          </span>
          <span className="fw-semibold text-dark">
            {selectedRequester.displayName} ({selectedRequester.email})
          </span>
        </div>
        <button
          className="btn btn-sm btn-outline-success"
          style={{ borderColor: "#006B3C", color: "#006B3C" }}
          onClick={changeRequester}
        >
          Change Requester
        </button>
      </div>
    );
  }

  return (
    <div
      className="p-4 mb-4 rounded border shadow-sm"
      style={{ backgroundColor: "#EAF6EF", borderColor: "#006B3C" }}
    >
      <h2 className="h5 mb-2" style={{ color: "#006B3C" }}>
        Select a Development Requester to continue
      </h2>
      <p className="small text-muted mb-3">
        Lab 2 uses a temporary Development Requester identity selector to test ticket ownership.
      </p>

      <div className="row g-2 align-items-center">
        <div className="col-md-8">
          <label htmlFor="requester-select" className="visually-hidden">
            Select Requester
          </label>
          <select
            id="requester-select"
            aria-label="Select Requester"
            className="form-select"
            value={pendingSelectionId}
            onChange={(e) => setPendingSelectionId(e.target.value)}
          >
            {requesters.map((req) => (
              <option key={req.id} value={req.id}>
                {req.displayName} ({req.email})
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <button
            className="btn w-100 text-white"
            style={{ backgroundColor: "#006B3C" }}
            onClick={handleConfirmSelection}
            disabled={!pendingSelectionId}
          >
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
}
