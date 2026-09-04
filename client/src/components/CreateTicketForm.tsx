import { useEffect, useState, FormEvent } from "react";
import { useRequester } from "../context/RequesterContext.js";
import { fetchCategoriesV1, fetchRelatedSystems, createTicket } from "../api/lab02.js";
import { CategoryV1, RelatedSystem, CreatedTicketDto, RequestedPriority } from "../types/lab02.js";

const PRIORITIES: RequestedPriority[] = ["Low", "Medium", "High", "Urgent"];

export default function CreateTicketForm() {
  const { selectedRequester } = useRequester();

  // Reference data state
  const [categories, setCategories] = useState<CategoryV1[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [loadingRefData, setLoadingRefData] = useState<boolean>(true);
  const [refDataError, setRefDataError] = useState<string | null>(null);

  // Form input state
  const [categoryId, setCategoryId] = useState<string>("");
  const [relatedSystemId, setRelatedSystemId] = useState<string>("");
  const [requestedPriority, setRequestedPriority] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // Process & Error state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Created Ticket success result state
  const [createdTicket, setCreatedTicket] = useState<CreatedTicketDto | null>(null);

  async function loadReferenceData() {
    setLoadingRefData(true);
    setRefDataError(null);

    try {
      const [cats, systems] = await Promise.all([
        fetchCategoriesV1(),
        fetchRelatedSystems(),
      ]);
      setCategories(cats);
      setRelatedSystems(systems);
    } catch {
      setRefDataError("Unable to load reference data");
    } finally {
      setLoadingRefData(false);
    }
  }

  // Reset form whenever selected requester changes
  useEffect(() => {
    setCategoryId("");
    setRelatedSystemId("");
    setRequestedPriority("");
    setSummary("");
    setDescription("");
    setFieldErrors({});
    setApiError(null);
    setCreatedTicket(null);

    if (selectedRequester) {
      loadReferenceData();
    }
  }, [selectedRequester]);

  if (!selectedRequester) {
    return null;
  }

  if (loadingRefData) {
    return (
      <div
        className="p-3 mb-4 rounded border"
        style={{ backgroundColor: "#EAF6EF", borderColor: "#0B7A46" }}
      >
        <p className="m-0 text-dark font-weight-bold">
          <span className="spinner-border spinner-border-sm me-2 text-success" role="status" />
          Loading form reference data…
        </p>
      </div>
    );
  }

  if (refDataError) {
    return (
      <div className="alert alert-danger mb-4 d-flex justify-content-between align-items-center">
        <div>
          <strong>Error: </strong> {refDataError}
        </div>
        <button className="btn btn-outline-danger btn-sm" onClick={loadReferenceData}>
          Retry
        </button>
      </div>
    );
  }

  // AC-10 Success View
  if (createdTicket) {
    return (
      <div
        className="card mb-4 border-success shadow-sm"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        <div
          className="card-header text-white fw-bold d-flex justify-content-between align-items-center"
          style={{ backgroundColor: "#006B3C" }}
        >
          <span>Ticket Created Successfully</span>
          <span className="badge bg-light text-dark fs-6">{createdTicket.ticketNumber}</span>
        </div>
        <div className="card-body">
          <div className="alert alert-success d-flex align-items-center mb-4">
            <span className="me-2">✓</span>
            <div>Your support request has been submitted and assigned Ticket Number <strong>{createdTicket.ticketNumber}</strong>.</div>
          </div>

          <h3 className="h5 text-success mb-3" style={{ color: "#006B3C" }}>
            {createdTicket.summary}
          </h3>

          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="text-muted small d-block">Ticket Number</label>
              <span className="fw-semibold text-dark">{createdTicket.ticketNumber}</span>
            </div>
            <div className="col-md-6">
              <label className="text-muted small d-block">Current Status</label>
              <span className="badge bg-success">{createdTicket.currentStatus}</span>
            </div>
            <div className="col-md-6">
              <label className="text-muted small d-block">Requester</label>
              <span className="fw-semibold text-dark">{createdTicket.requester.displayName}</span>
            </div>
            <div className="col-md-6">
              <label className="text-muted small d-block">Ticket Date</label>
              <span className="fw-semibold text-dark">{createdTicket.createdAt}</span>
            </div>
            <div className="col-md-6">
              <label className="text-muted small d-block">Category</label>
              <span className="fw-semibold text-dark">{createdTicket.category.name}</span>
            </div>
            <div className="col-md-6">
              <label className="text-muted small d-block">Related System</label>
              <span className="fw-semibold text-dark">{createdTicket.relatedSystem.name}</span>
            </div>
            <div className="col-md-6">
              <label className="text-muted small d-block">Requested Priority</label>
              <span className="badge bg-secondary">{createdTicket.requestedPriority}</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-muted small d-block">Description</label>
            <div className="p-3 bg-light rounded border text-dark white-space-pre-wrap">
              {createdTicket.description}
            </div>
          </div>

          <button
            className="btn text-white"
            style={{ backgroundColor: "#006B3C" }}
            onClick={() => {
              setCreatedTicket(null);
              setCategoryId("");
              setRelatedSystemId("");
              setRequestedPriority("");
              setSummary("");
              setDescription("");
            }}
          >
            Create Another Ticket
          </button>
        </div>
      </div>
    );
  }

  // Client & Server Validation
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const errors: Record<string, string> = {};

    if (!categoryId) {
      errors.categoryId = "Category selection is required.";
    }

    if (!relatedSystemId) {
      errors.relatedSystemId = "Related System selection is required.";
    }

    if (!requestedPriority) {
      errors.requestedPriority = "Requested Priority must be selected.";
    }

    const trimmedSummary = summary.trim();
    if (!trimmedSummary) {
      errors.summary = "Ticket Summary is required.";
    } else if (trimmedSummary.length < 5 || trimmedSummary.length > 120) {
      errors.summary = "Ticket Summary must contain 5 to 120 characters.";
    }

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      errors.description = "Description is required.";
    } else if (trimmedDescription.length < 10 || trimmedDescription.length > 5000) {
      errors.description = "Description must contain 10 to 5000 characters.";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    setApiError(null);

    try {
      const dto = await createTicket(
        {
          categoryId: Number(categoryId),
          relatedSystemId,
          summary: trimmedSummary,
          requestedPriority: requestedPriority as RequestedPriority,
          description: trimmedDescription,
        },
        selectedRequester!.id
      );

      setCreatedTicket(dto);
    } catch (err: any) {
      setApiError(err.message ?? "Unable to create Ticket");
      if (err.fields && typeof err.fields === "object") {
        setFieldErrors(err.fields);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card mb-4 shadow-sm border">
      <div
        className="card-header text-white fw-bold"
        style={{ backgroundColor: "#006B3C" }}
      >
        Create IT Support Ticket
      </div>
      <div className="card-body">
        {apiError && (
          <div className="alert alert-danger mb-4">
            <strong>Error: </strong> {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="row g-3 mb-3">
            {/* Ticket Number (Read-only) */}
            <div className="col-md-6">
              <label htmlFor="ticket-number" className="form-label text-muted small fw-semibold">
                Ticket Number
              </label>
              <input
                id="ticket-number"
                type="text"
                className="form-control bg-light"
                value="Generated upon submission"
                disabled
                readOnly
              />
            </div>

            {/* Ticket Date (Read-only) */}
            <div className="col-md-6">
              <label htmlFor="ticket-date" className="form-label text-muted small fw-semibold">
                Ticket Date
              </label>
              <input
                id="ticket-date"
                type="text"
                className="form-control bg-light"
                value="Generated upon submission"
                disabled
                readOnly
              />
            </div>

            {/* Requester (Read-only) */}
            <div className="col-12">
              <label htmlFor="ticket-requester" className="form-label text-muted small fw-semibold">
                Requester
              </label>
              <input
                id="ticket-requester"
                type="text"
                className="form-control bg-light"
                value={`${selectedRequester.displayName} (${selectedRequester.email})`}
                disabled
                readOnly
              />
            </div>

            {/* Category Dropdown */}
            <div className="col-md-6">
              <label htmlFor="ticket-category" className="form-label fw-semibold">
                Category <span className="text-danger">*</span>
              </label>
              <select
                id="ticket-category"
                aria-label="Category"
                className={`form-select ${fieldErrors.categoryId ? "is-invalid" : ""}`}
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  if (fieldErrors.categoryId) {
                    setFieldErrors((prev) => ({ ...prev, categoryId: "" }));
                  }
                }}
                disabled={submitting}
              >
                <option value="">-- Select Category --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {fieldErrors.categoryId && (
                <div className="invalid-feedback">{fieldErrors.categoryId}</div>
              )}
            </div>

            {/* Related System Dropdown */}
            <div className="col-md-6">
              <label htmlFor="ticket-system" className="form-label fw-semibold">
                Related System <span className="text-danger">*</span>
              </label>
              <select
                id="ticket-system"
                aria-label="Related System"
                className={`form-select ${fieldErrors.relatedSystemId ? "is-invalid" : ""}`}
                value={relatedSystemId}
                onChange={(e) => {
                  setRelatedSystemId(e.target.value);
                  if (fieldErrors.relatedSystemId) {
                    setFieldErrors((prev) => ({ ...prev, relatedSystemId: "" }));
                  }
                }}
                disabled={submitting}
              >
                <option value="">-- Select Related System --</option>
                {relatedSystems.map((sys) => (
                  <option key={sys.id} value={sys.id}>
                    {sys.name}
                  </option>
                ))}
              </select>
              {fieldErrors.relatedSystemId && (
                <div className="invalid-feedback">{fieldErrors.relatedSystemId}</div>
              )}
            </div>

            {/* Requested Priority */}
            <div className="col-12">
              <label htmlFor="ticket-priority" className="form-label fw-semibold">
                Requested Priority <span className="text-danger">*</span>
              </label>
              <select
                id="ticket-priority"
                aria-label="Requested Priority"
                className={`form-select ${fieldErrors.requestedPriority ? "is-invalid" : ""}`}
                value={requestedPriority}
                onChange={(e) => {
                  setRequestedPriority(e.target.value);
                  if (fieldErrors.requestedPriority) {
                    setFieldErrors((prev) => ({ ...prev, requestedPriority: "" }));
                  }
                }}
                disabled={submitting}
              >
                <option value="">-- Select Priority --</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {fieldErrors.requestedPriority && (
                <div className="invalid-feedback">{fieldErrors.requestedPriority}</div>
              )}
            </div>

            {/* Summary Input */}
            <div className="col-12">
              <label htmlFor="ticket-summary" className="form-label fw-semibold">
                Ticket Summary <span className="text-danger">*</span>
              </label>
              <input
                id="ticket-summary"
                type="text"
                aria-label="Ticket Summary"
                className={`form-control ${fieldErrors.summary ? "is-invalid" : ""}`}
                placeholder="Brief summary of the issue (5–120 characters)"
                value={summary}
                onChange={(e) => {
                  setSummary(e.target.value);
                  if (fieldErrors.summary) {
                    setFieldErrors((prev) => ({ ...prev, summary: "" }));
                  }
                }}
                disabled={submitting}
              />
              {fieldErrors.summary ? (
                <div className="invalid-feedback">{fieldErrors.summary}</div>
              ) : (
                <div className="form-text text-muted">5 to 120 characters</div>
              )}
            </div>

            {/* Description Multiline Textarea */}
            <div className="col-12">
              <label htmlFor="ticket-description" className="form-label fw-semibold">
                Description <span className="text-danger">*</span>
              </label>
              <textarea
                id="ticket-description"
                aria-label="Description"
                className={`form-control ${fieldErrors.description ? "is-invalid" : ""}`}
                rows={5}
                placeholder="Detailed description of your request or issue (10–5000 characters)"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (fieldErrors.description) {
                    setFieldErrors((prev) => ({ ...prev, description: "" }));
                  }
                }}
                disabled={submitting}
              />
              {fieldErrors.description ? (
                <div className="invalid-feedback">{fieldErrors.description}</div>
              ) : (
                <div className="form-text text-muted">10 to 5000 characters</div>
              )}
            </div>
          </div>

          <div className="d-flex justify-content-end">
            <button
              type="submit"
              className="btn text-white px-4"
              style={{ backgroundColor: "#006B3C" }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Creating Ticket…
                </>
              ) : (
                "Create Ticket"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
