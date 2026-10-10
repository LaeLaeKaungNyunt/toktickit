# Lab 4 — API Specification

**Project:** TokTickIT — IT Service Desk  
**Sprint:** Lab 4  
**Status:** Approved for Implementation  
**Related specification:** `docs/lab-04/specification.md`

## 1. API Overview

Lab 4 extends the existing Express REST API to support Actions Taken, operational dashboards, and stronger Ticket workflow validation.

The implementation must preserve existing Lab 1–3 endpoints and response contracts unless a documented Lab 4 requirement explicitly changes their behavior.

### 1.1 API Conventions

- Base path: `/api/v1`
- Data format: JSON
- Authentication: `Authorization: Bearer <JWT>`
- Ticket identifiers: String UUID
- User identifiers: String UUID
- Dates and times: ISO 8601, stored consistently in UTC
- Errors: JSON responses with safe, user-readable messages
- Authorization: Enforced by the backend, not only by hidden UI controls

### 1.2 Role Permissions

| Operation | Requester | IT Staff | Administrator |
|---|---|---|---|
| View Actions Taken on owned Ticket | Yes | Yes | Yes |
| View Actions Taken on another Requester's Ticket | No | Yes | Yes |
| Create Actions Taken | No | Yes | Yes |
| Edit Actions Taken | No | Yes | Yes |
| Assign Actions Taken | No | Yes | Yes |
| Complete or cancel Actions Taken | No | Yes | Yes |
| View IT Staff Dashboard | No | Yes | Yes |
| View Requester Dashboard | Own data only | No | No |
| Perform formal Ticket status transitions | No | Yes | Yes |
| Access IT Staff Ticket Queue & Detail | No | Yes | Yes |

### 1.3 Existing API Compatibility

The existing endpoints under `/api/v1/staff/*` are extended to support both `IT Staff` and `Administrator` roles (`requireRole("IT Staff", "Administrator")`):

1. **`GET /api/v1/staff/tickets` (Ticket Queue):**
   - Retains all existing query parameters: `status`, `priority`, `assignment` (`assigned` | `unassigned`), `search`, `sortBy`, `sortOrder`, `page`, `pageSize`.
   - Adds `assignedToMe=true` query parameter: when present, filters tickets assigned to the authenticated user (`assigneeId = req.user.id`).
   - Extends `priority` query parameter: accepts comma-separated priorities (e.g. `priority=Urgent,High`) to allow querying urgent and high tickets simultaneously.

2. **`PATCH /api/v1/staff/tickets/:ticketId/status`:**
   - Retains the permitted Ticket transition matrix and HTTP 409 response for prohibited transitions.
   - Extends the workflow with the formal resolution gate (completed Action Taken evidence and non-blank `resolutionSummary`).
   - Supports optimistic concurrency: `expectedUpdatedAt` is optional for backward compatibility with Labs 1–3 regression test suites, but required on all new Lab 4 frontend status updates. Stale updates return HTTP 409 Conflict.
   - Wraps status update and `STATUS_CHANGED` TicketEvent creation within an atomic database transaction (`prisma.$transaction`).

3. **`GET /api/v1/tickets` (Requester Ticket List):**
   - Retains strict `status=New` parameter validation to preserve Lab 2 regression test suites (`server/tests/lab-02/my-tickets.test.ts:L535-L538`). Dashboard summary cards navigate to in-page preview sections ("Needs My Attention", "Recently Resolved") or individual Ticket Detail views rather than unsupported filtered query URLs.

### 1.4 Proposed and Extended Endpoint Summary

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/tickets/:ticketId/actions` | List Actions Taken for an accessible Ticket |
| POST | `/api/v1/tickets/:ticketId/actions` | Create an Action Taken (IT Staff or Administrator) |
| PATCH | `/api/v1/tickets/:ticketId/actions/:actionId` | Edit or transition an Action Taken (`expectedUpdatedAt` required; IT Staff or Administrator) |
| GET | `/api/v1/dashboard/staff` | Retrieve operational dashboard metrics and preview lists (IT Staff or Administrator) |
| GET | `/api/v1/dashboard/requester` | Retrieve personal dashboard metrics and preview lists (Requester only) |
| GET | `/api/v1/staff/tickets` | Existing queue extended with `assignedToMe=true` and `priority=Urgent,High` |
| PATCH | `/api/v1/staff/tickets/:ticketId/status` | Existing status update extended with resolution gate, atomic transaction, and optional `expectedUpdatedAt` |

### 1.5 General Error Responses

| HTTP Status | Meaning |
|---|---|
| 200 | Successful read or update |
| 201 | Resource created successfully |
| 400 | Invalid request, missing required field, or failed field validation |
| 401 | Missing, invalid, or expired authentication |
| 403 | Authenticated user lacks permission |
| 404 | Resource does not exist or is not accessible |
| 409 | Prohibited transition, stale update, edit to terminal action, or conflicting workflow state |
| 500 | Unexpected server failure with a safe error response |

All write operations must validate the authenticated user's permissions and the current database state before saving changes.

## 2. Actions Taken API

### 2.1 Action Taken Data Contract

Each Action Taken is a separate record belonging to one Ticket.

| Field | Type | Rule |
|---|---|---|
| `id` | String UUID | Generated by the backend (`@id @default(uuid())`) |
| `ticketId` | String UUID | References an existing Ticket; immutable |
| `actionDateTime` | ISO 8601 datetime | Required; user-provided date/time representing when the action occurred |
| `description` | String | Required; cannot be blank |
| `result` | String | Required; cannot be blank |
| `performedById` | String UUID | Set automatically from the authenticated creator; immutable |
| `performedBy` | Object `{ id, name }` | Present in GET/POST/PATCH responses |
| `assignedToId` | String UUID or null | Optional; must reference an active IT Staff or Administrator |
| `assignedTo` | Object `{ id, name }` or null | Present in GET/POST/PATCH responses |
| `followUpRequired` | Boolean | Required boolean |
| `followUpNote` | String or null | Required and non-blank when `followUpRequired` is true; optional when false |
| `attachmentNotes` | String or null | Optional text; does not replace existing Ticket attachments |
| `status` | String | Stored as Prisma `String @default("Active")`. Allowed values: `Active`, `Completed`, `Cancelled` |
| `createdAt` | ISO 8601 datetime | Server-generated audit timestamp (`@default(now())`) |
| `updatedAt` | ISO 8601 datetime | Server-updated timestamp (`@updatedAt`) |

**Design decision:** `actionDateTime` is separate from `createdAt`. This allows staff to record work performed earlier without changing the audit timestamp showing when the record was entered into the system.

### 2.2 GET `/api/v1/tickets/:ticketId/actions`

**Purpose:** Retrieve all Actions Taken linked to a Ticket.

**Authorization:**

- Requester: May view Actions Taken only for Tickets they own. Cross-requester access returns `404 Not Found`.
- IT Staff and Administrator: May view Actions Taken for accessible Tickets.
- Unauthenticated users: Denied (`401 Unauthorized`).

**Success:** `200 OK`

Example response:

```json
{
  "actions": [
    {
      "id": "action-uuid-1",
      "ticketId": "ticket-uuid-1",
      "actionDateTime": "2026-10-11T09:30:00.000Z",
      "description": "Checked the network connection on switch port 12",
      "result": "Found a disconnected cable and loose patch connector",
      "performedById": "staff1-uuid",
      "performedBy": {
        "id": "staff1-uuid",
        "name": "Sam Staff"
      },
      "assignedToId": "staff2-uuid",
      "assignedTo": {
        "id": "staff2-uuid",
        "name": "Alex Tech"
      },
      "followUpRequired": true,
      "followUpNote": "Order replacement Cat6 patch cable and test throughput",
      "attachmentNotes": "Refer to photos attached to parent ticket",
      "status": "Active",
      "createdAt": "2026-10-11T09:35:00.000Z",
      "updatedAt": "2026-10-11T09:35:00.000Z"
    }
  ]
}
```

**Ordering:** Sort by `actionDateTime` ascending, then `createdAt` ascending, then `id` ascending to ensure deterministic results.

**Error responses:**

- `401`: Missing or invalid authentication.
- `403`: Role is not permitted.
- `404`: Ticket does not exist or is not accessible.
- `500`: Unexpected server failure.

### 2.3 POST `/api/v1/tickets/:ticketId/actions`

**Purpose:** Create an Action Taken under an existing Ticket.

**Authorization:** IT Staff or Administrator only (`403 Forbidden` for Requesters).

Example request:

```json
{
  "actionDateTime": "2026-10-11T09:30:00.000Z",
  "description": "Checked the network connection on switch port 12",
  "result": "Found a disconnected cable and loose patch connector",
  "assignedToId": "staff2-uuid",
  "followUpRequired": true,
  "followUpNote": "Order replacement Cat6 patch cable and test throughput",
  "attachmentNotes": "Refer to photos attached to parent ticket"
}
```

**Backend rules:**

1. Verify authentication and role authorization (`IT Staff` or `Administrator`).
2. Verify the parent Ticket exists (`404 Not Found` if missing).
3. Validate `actionDateTime` is a valid ISO 8601 date string.
4. Validate `description` and `result` contain meaningful non-blank text (`400 Bad Request` if blank).
5. When `assignedToId` is provided, validate the user exists, `isActive === true`, and role is `IT Staff` or `Administrator` (`400 Bad Request` if invalid or inactive).
6. When `followUpRequired === true`, require non-blank `followUpNote` (`400 Bad Request` if missing or blank).
7. Set `performedById` from the authenticated caller (`req.user.id`); never accept it from the client body.
8. Set initial status to `Active`.
9. In a single database transaction, create the `ActionTaken` record and an append-only `ACTION_CREATED` `TicketEvent`.
10. Return the complete created Action Taken DTO matching the GET shape.

**Success:** `201 Created`

Example response:

```json
{
  "action": {
    "id": "action-uuid-1",
    "ticketId": "ticket-uuid-1",
    "actionDateTime": "2026-10-11T09:30:00.000Z",
    "description": "Checked the network connection on switch port 12",
    "result": "Found a disconnected cable and loose patch connector",
    "performedById": "staff1-uuid",
    "performedBy": {
      "id": "staff1-uuid",
      "name": "Sam Staff"
    },
    "assignedToId": "staff2-uuid",
    "assignedTo": {
      "id": "staff2-uuid",
      "name": "Alex Tech"
    },
    "followUpRequired": true,
    "followUpNote": "Order replacement Cat6 patch cable and test throughput",
    "attachmentNotes": "Refer to photos attached to parent ticket",
    "status": "Active",
    "createdAt": "2026-10-11T09:35:00.000Z",
    "updatedAt": "2026-10-11T09:35:00.000Z"
  }
}
```

### 2.4 PATCH `/api/v1/tickets/:ticketId/actions/:actionId`

**Purpose:** Edit an Action Taken, change its assignee, or transition its lifecycle status.

**Authorization:** IT Staff or Administrator only.

Example request:

```json
{
  "description": "Replaced the disconnected cable and tested port 12",
  "result": "Gigabit connectivity restored and verified with iperf3",
  "assignedToId": "staff2-uuid",
  "followUpRequired": false,
  "followUpNote": null,
  "status": "Completed",
  "expectedUpdatedAt": "2026-10-11T09:35:00.000Z"
}
```

**Lifecycle transitions:**

| Current status | Allowed next status |
|---|---|
| Active | Completed, Cancelled |
| Completed | None (Terminal — modifications rejected with HTTP 409) |
| Cancelled | None (Terminal — modifications rejected with HTTP 409) |

**Backend rules:**

1. Verify authentication and role authorization (`IT Staff` or `Administrator`).
2. Verify the Ticket and Action Taken exist and belong together (`404 Not Found` if not found or mismatched).
3. **Terminal Action Check:** If the Action Taken currently has status `Completed` or `Cancelled` in the database, reject the request with `409 Conflict`. Terminal actions cannot be modified or transitioned.
4. **Optimistic Concurrency Check:** Require `expectedUpdatedAt` in request body. If `expectedUpdatedAt` does not match the record's current `updatedAt`, reject with `409 Conflict`.
5. Reject attempts to change `ticketId` or `performedById` (`400 Bad Request`).
6. Validate non-blank text for `description` and `result` if provided.
7. Validate `followUpNote` is present and non-blank if `followUpRequired` is or becomes `true`.
8. When `assignedToId` is provided and not null, validate the assignee is active and has role `IT Staff` or `Administrator`.
9. Reject invalid lifecycle transitions with `409 Conflict` (e.g. `Completed -> Active`, `Cancelled -> Completed`).
10. Preserve the original performer identity (`performedById`) and `createdAt` timestamp.
11. In a single database transaction, update the `ActionTaken` record and create the corresponding `TicketEvent` (`ACTION_UPDATED`, `ACTION_COMPLETED`, or `ACTION_CANCELLED`).
12. Return the updated Action Taken DTO matching the GET shape.

**Success:** `200 OK`

Example response:

```json
{
  "action": {
    "id": "action-uuid-1",
    "ticketId": "ticket-uuid-1",
    "actionDateTime": "2026-10-11T09:30:00.000Z",
    "description": "Replaced the disconnected cable and tested port 12",
    "result": "Gigabit connectivity restored and verified with iperf3",
    "performedById": "staff1-uuid",
    "performedBy": {
      "id": "staff1-uuid",
      "name": "Sam Staff"
    },
    "assignedToId": "staff2-uuid",
    "assignedTo": {
      "id": "staff2-uuid",
      "name": "Alex Tech"
    },
    "followUpRequired": false,
    "followUpNote": null,
    "attachmentNotes": "Refer to photos attached to parent ticket",
    "status": "Completed",
    "createdAt": "2026-10-11T09:35:00.000Z",
    "updatedAt": "2026-10-11T10:00:00.000Z"
  }
}
```

### 2.5 Validation and Failure Handling

- Blank or whitespace-only descriptions and results are rejected with `400`.
- Invalid dates and malformed UUIDs are rejected with `400`, except inaccessible or malformed Ticket identifiers may return `404` consistently with existing Ticket routes.
- Invalid or inactive assignees are rejected with `400`.
- Missing required follow-up notes are rejected with `400`.
- Forbidden write operations return `403`.
- Invalid lifecycle transitions and stale updates return `409`.
- Failed writes must not leave partially saved Action Taken records or misleading audit events.
- The backend must return safe errors without exposing database details or stack traces.

### 2.6 Audit History

Action Taken creation, edits, completion, and cancellation must produce append-only `TicketEvent` records.

Each event must identify:

- The parent Ticket.
- The authenticated actor.
- The event type.
- The affected Action Taken ID.
- The relevant changes or lifecycle transition.
- The server-generated event timestamp.

Editing an Action Taken must not delete or rewrite its earlier audit events.

## 3. Ticket Status and Resolution API

### 3.1 Existing Endpoint

**PATCH** `/api/v1/staff/tickets/:ticketId/status`

This endpoint already exists in Lab 3. Lab 4 extends its validation, authorization, and concurrency protection.

**Authorization:** Authenticated `IT Staff` or `Administrator` (`requireRole("IT Staff", "Administrator")`). Requesters are rejected with `403 Forbidden`.

### 3.2 Request Contract

For a normal status transition:

```json
{
  "status": "In Progress",
  "expectedUpdatedAt": "2026-10-11T09:30:00.000Z"
}
```

For formal Ticket resolution:

```json
{
  "status": "Resolved",
  "resolutionSummary": "Replaced the damaged network cable and confirmed the connection is working.",
  "expectedUpdatedAt": "2026-10-11T09:30:00.000Z"
}
```

**Concurrency field:** `expectedUpdatedAt` is an optional ISO 8601 string at the API boundary to preserve backward compatibility with Labs 1–3 regression test suites. However, all new Lab 4 frontend status updates must supply it. When supplied, it must match the Ticket's current `updatedAt` in the database.

### 3.3 Permitted Ticket Transitions

| Current status | Allowed next statuses |
|---|---|
| New | Open, In Progress, Waiting for Requester, Cancelled |
| Open | In Progress, Waiting for Requester, Resolved, Cancelled |
| In Progress | Waiting for Requester, Resolved, Cancelled |
| Waiting for Requester | In Progress, Resolved, Cancelled |
| Resolved | Closed, Reopened, In Progress |
| Reopened | In Progress, Waiting for Requester, Resolved, Cancelled |
| Closed | None |
| Cancelled | None |

This matrix matches the existing Lab 3 implementation.

### 3.4 Formal Resolution Rules

When `status` is `Resolved`, the backend must verify:

1. The current Ticket status permits a transition to Resolved (`Open`, `In Progress`, `Waiting for Requester`, or `Reopened`). Transition attempts from other statuses return `409 Conflict`.
2. At least one linked Action Taken has status `Completed`. If none exist, return `400 Bad Request`.
3. The completed action has a non-blank `description` and `result`.
4. `resolutionSummary` is provided and contains meaningful non-blank text. If missing or blank, return `400 Bad Request`.
5. If `expectedUpdatedAt` is provided, the request is not based on a stale Ticket state. If stale, return `409 Conflict`.

If any requirement fails, the Ticket remains unchanged.

The Requester's existing `requesterResolution` indication is advisory and does not bypass these checks.

### 3.5 Concurrency and Atomicity

A Ticket status update must:

- If `expectedUpdatedAt` is provided, compare it against the current Ticket version. Return `409 Conflict` if the submitted version does not match `updatedAt`. If `expectedUpdatedAt` is omitted, allow the transition to proceed for Labs 1–3 backward compatibility.
- Execute the Ticket status update and the `STATUS_CHANGED` TicketEvent creation within a single atomic database transaction (`prisma.$transaction`).
- Include `previousStatus`, `newStatus`, and `resolutionSummary` (when transitioning to Resolved) in the `STATUS_CHANGED` event payload.
- Prevent conflicting concurrent updates from silently overwriting each other.
- Preserve the original Ticket status and history if any validation condition fails.

### 3.6 Success Response

**200 OK**

```json
{
  "ticket": {
    "id": "ticket-uuid",
    "status": "Resolved",
    "resolutionSummary": "Replaced the damaged network cable and confirmed the connection is working.",
    "updatedAt": "2026-10-11T10:00:00.000Z"
  }
}
```

The response extends the existing Lab 3 response with resolution and concurrency information.

### 3.7 Error Responses

| Status | Condition |
|---|---|
| 400 | Invalid status value, missing/blank Resolution Summary, or missing completed Action Taken evidence |
| 401 | Missing or invalid authentication |
| 403 | Insufficient permissions (Requester caller or inactive account) |
| 404 | Ticket not found |
| 409 | Prohibited transition or stale update (when `expectedUpdatedAt` is provided and mismatched) |
| 500 | Unexpected server failure |

A failed resolution attempt must not create a successful status-change event.

### 3.8 Resolution Data

Lab 4 adds `resolutionSummary` as a nullable field on the existing `Ticket` model in Prisma:

- Existing Tickets retain `null` after migration.
- A non-blank value is required when entering `Resolved`.
- The saved summary remains available in Ticket Detail and history.
- The migration must not rewrite existing Ticket statuses or Requester resolution indications.

## 4. Dashboard API

### 4.1 GET `/api/v1/dashboard/staff`

**Purpose:** Return operational metrics and preview work lists for the IT Staff Dashboard.

**Authorization:** IT Staff and Administrator only (`403 Forbidden` for Requesters).

**Success:** `200 OK`

Example response:

```json
{
  "metrics": {
    "unassignedTickets": 4,
    "myAssignedTickets": 6,
    "urgentTickets": 3,
    "myActiveActionsCount": 2,
    "statusCounts": {
      "New": 2,
      "Open": 4,
      "In Progress": 3,
      "Waiting for Requester": 1,
      "Resolved": 2,
      "Closed": 8,
      "Reopened": 1,
      "Cancelled": 1
    }
  },
  "myActions": [
    {
      "id": "action-uuid-1",
      "ticketId": "ticket-uuid-1",
      "ticketNumber": "TKT-2026-00001",
      "ticketSummary": "Cannot access Student Portal login page",
      "description": "Checked switch port configuration",
      "status": "Active",
      "followUpRequired": true,
      "actionDateTime": "2026-10-11T09:30:00.000Z",
      "createdAt": "2026-10-11T09:35:00.000Z"
    }
  ],
  "recentTickets": [
    {
      "id": "ticket-uuid-1",
      "ticketNumber": "TKT-2026-00001",
      "summary": "Cannot access Student Portal login page",
      "status": "In Progress",
      "requestedPriority": "High",
      "itPriority": "High",
      "updatedAt": "2026-10-11T10:00:00.000Z"
    }
  ],
  "urgentTickets": [
    {
      "id": "ticket-uuid-3",
      "ticketNumber": "TKT-2026-00003",
      "summary": "Canvas assignment submission fails with upload timeout",
      "status": "In Progress",
      "itPriority": "Urgent",
      "assignee": {
        "id": "staff2-uuid",
        "name": "Alex Tech"
      },
      "updatedAt": "2026-10-11T09:45:00.000Z"
    }
  ]
}
```

**Calculation rules:**

| Field | Backend calculation |
|---|---|
| `unassignedTickets` | Count of non-terminal Tickets (`currentStatus` not in Closed, Cancelled) with `assigneeId === null` |
| `myAssignedTickets` | Count of non-terminal Tickets where `assigneeId === authenticated caller ID` |
| `urgentTickets` metric | Count of non-terminal Tickets where `itPriority` is `Urgent` or `High` |
| `myActiveActionsCount` | Total count of Actions Taken with `status === "Active"` and `assignedToId === authenticated caller ID` (includes all matching records, not limited to 5) |
| `statusCounts` | Counts of all Tickets grouped by each of the eight existing statuses |
| `myActions` | Up to 5 Actions Taken assigned to authenticated user with status `Active`, ordered by `actionDateTime ASC, createdAt ASC, id ASC` |
| `recentTickets` | Up to 5 most recently updated Tickets, ordered by `updatedAt DESC, id DESC` |
| `urgentTickets` list | Up to 5 non-terminal Tickets with `itPriority` in `['Urgent', 'High']`, ordered by priority (`Urgent` before `High`), then `updatedAt DESC, id DESC` |

### 4.2 GET `/api/v1/dashboard/requester`

**Purpose:** Return personal Ticket metrics and recent activity for the authenticated Requester.

**Authorization:** Requester only (`403 Forbidden` for IT Staff and Administrator).

**Success:** `200 OK`

Example response:

```json
{
  "metrics": {
    "myActiveTickets": 3,
    "waitingForMe": 1,
    "resolvedTicketsCount": 2,
    "totalTicketsCount": 9,
    "statusCounts": {
      "New": 1,
      "Open": 1,
      "In Progress": 0,
      "Waiting for Requester": 1,
      "Resolved": 2,
      "Closed": 4,
      "Reopened": 0,
      "Cancelled": 0
    }
  },
  "waitingForMeTickets": [
    {
      "id": "ticket-uuid-5",
      "ticketNumber": "TKT-2026-00005",
      "summary": "MFA Authentication code not receiving via SMS",
      "status": "Waiting for Requester",
      "updatedAt": "2026-10-11T08:00:00.000Z"
    }
  ],
  "recentlyResolvedTickets": [
    {
      "id": "ticket-uuid-2",
      "ticketNumber": "TKT-2026-00002",
      "summary": "Campus Wi-Fi disconnects frequently in Library",
      "status": "Resolved",
      "resolutionSummary": "Replaced faulty wireless access point.",
      "resolvedAt": "2026-10-11T09:15:00.000Z",
      "updatedAt": "2026-10-11T09:15:00.000Z"
    }
  ],
  "recentTickets": [
    {
      "id": "ticket-uuid-1",
      "ticketNumber": "TKT-2026-00001",
      "summary": "Cannot access Student Portal login page",
      "status": "New",
      "updatedAt": "2026-10-11T07:30:00.000Z"
    }
  ]
}
```

**Calculation rules:**

| Field | Backend calculation |
|---|---|
| `myActiveTickets` | Count of owned Tickets where `currentStatus` not in Closed, Cancelled |
| `waitingForMe` | Count of owned Tickets where `currentStatus === "Waiting for Requester"` |
| `resolvedTicketsCount` | Total count of owned Tickets currently in `Resolved` status |
| `totalTicketsCount` | Total count of owned Tickets across all statuses |
| `statusCounts` | Counts of owned Tickets grouped by the eight existing statuses |
| `waitingForMeTickets` | Up to 5 owned Tickets with status `Waiting for Requester`, ordered by `updatedAt DESC, id DESC` |
| `recentlyResolvedTickets` | Up to 5 owned Tickets currently in `Resolved` status, ordered by latest relevant `STATUS_CHANGED` event timestamp where `payloadJson.newStatus = 'Resolved'` descending (fallback to `ticket.updatedAt` if no event exists for legacy tickets) |
| `recentTickets` | Up to 5 most recently updated owned Tickets, ordered by `updatedAt DESC, id DESC` |

**Ownership rule:** Every Requester dashboard query must filter by `requesterId = authenticated user ID` at the database level. The backend must never accept a client-supplied requester ID to override this restriction.

### 4.3 Dashboard Sorting and Limits

- Dashboard preview lists contain a maximum of five records each.
- Full Ticket counts reflect all matching records in the database, independent from preview list limits.
- Most recent Ticket lists sort by `updatedAt DESC, id DESC`.
- Urgent Tickets sort with `Urgent` before `High`, then by `updatedAt DESC, id DESC`.
- Recently resolved Tickets sort by the latest resolution event timestamp descending, fallback to `updatedAt DESC`. Reopened tickets are excluded from this preview.
- Existing `GET /api/v1/tickets` endpoint retains `status=New` query validation to protect Lab 2 tests; dashboard summary cards navigate to in-page preview sections ("Needs My Attention", "Recently Resolved") or individual Ticket Detail views.

### 4.4 Dashboard Error Handling

| Status | Condition |
|---|---|
| 200 | Dashboard loaded successfully, including empty results |
| 401 | Missing or invalid authentication |
| 403 | User role is not permitted |
| 500 | Unexpected server failure |

Both endpoints must respect existing inactive-account and mandatory-password-change restrictions.

### 4.5 Performance and Data Safety

Dashboard queries must:

- Avoid loading every Ticket into application memory just to calculate counts.
- Use database aggregation or appropriately filtered queries.
- Avoid exposing password hashes, tokens, internal authentication fields, or unrelated Requester data.
- Return predictable response shapes for loading, empty, and populated states.
- Use appropriate indexes where justified by actual query patterns.
- Remain responsive with a realistic seeded dataset.

## 5. API Validation, Compatibility, and Test Traceability

### 5.1 Backend Validation Rules

All Lab 4 API endpoints must validate requests on the server, even when the frontend performs its own validation.

| Validation area | Required behavior |
|---|---|
| Authentication | Reject missing, invalid, expired, or revoked JWTs |
| Role authorization | Enforce the approved permissions for each endpoint |
| Ticket ownership | Requesters may access Actions Taken only for their own Tickets |
| Resource relationships | Verify each Action Taken belongs to the Ticket specified in the URL |
| Required fields | Reject blank descriptions, results, and required follow-up notes |
| Dates | Reject invalid action dates and malformed timestamps |
| Assignment | Accept only active IT Staff or Administrator assignees |
| Immutable fields | Prevent changes to Action Taken ID, Ticket ID, and original performer |
| Action lifecycle | Permit only approved status transitions |
| Ticket lifecycle | Preserve the existing Ticket transition matrix |
| Resolution | Require completed work evidence and a valid Resolution Summary |
| Concurrency | Reject stale updates without overwriting newer data |
| Audit history | Record successful changes without modifying earlier events |

### 5.2 Transaction and Audit Requirements

Operations that update business records and create audit events must be atomic.

The backend must ensure that:

- Creating an Action Taken and recording `ACTION_CREATED` succeed or fail together.
- Editing or transitioning an Action Taken and recording its event succeed or fail together.
- Changing a Ticket status and recording `STATUS_CHANGED` succeed or fail together.
- Failed validation does not create misleading history records.
- Concurrent updates cannot silently overwrite each other.
- Earlier TicketEvent records remain unchanged.

Use Prisma transactions and database-safe conditional updates where appropriate.

### 5.3 Compatibility with Labs 1–3

Lab 4 must preserve the existing API behavior for:

- Authentication, login, logout, and mandatory password changes.
- Requester Ticket creation and viewing.
- Ticket assignment and IT Priority management.
- Existing Ticket status transitions, except for the documented resolution gate and concurrency checks.
- Public Comments and Internal Notes.
- Ticket attachments and removal history.
- Requester resolution indication.
- Administrator user management.
- Existing Ticket search, filtering, sorting, and pagination.

New fields must be introduced through safe Prisma migrations. Existing records must remain readable without requiring manual updates.

### 5.4 API Test Traceability

| API area | Acceptance criteria | Required test coverage |
|---|---|---|
| Actions Taken list | AC-02, AC-06, AC-07 | Ownership, authorization, stable ordering |
| Actions Taken creation | AC-01, AC-04, AC-05 | Valid creation, required fields, follow-up validation, inactive assignee |
| Actions Taken editing | AC-03, AC-05, AC-14 | Valid edits, immutable fields, stale updates |
| Actions Taken lifecycle | AC-08, AC-14 | Completion, cancellation, prohibited transitions |
| Ticket status updates | AC-09, AC-10, AC-14 | Permitted transitions, prohibited transitions, concurrency |
| Formal resolution | AC-11, AC-12, AC-13 | Completed work, Resolution Summary, advisory Requester indication |
| IT Staff Dashboard | AC-15, AC-16, AC-17, AC-18 | Metric accuracy, assignments, sorting, empty states |
| Requester Dashboard | AC-19, AC-20, AC-21, AC-22 | Ownership, metrics, attention lists, drill-down |
| Migration and compatibility | AC-23, AC-24, AC-25 | Data preservation, idempotent seed, regression |
| API error handling | AC-26, AC-29 | Safe errors, atomic writes, conflict handling |
| Final integration | AC-30 | Automated tests and production build |

Responsive layout and keyboard-accessibility acceptance criteria (AC-27 and AC-28) will be covered in `ui-spec.md` and `tests.md`.

### 5.5 API Contract Completion Conditions

This API specification is ready for approval when:

1. Every endpoint has an agreed request and response shape.
2. Role permissions and ownership checks are unambiguous.
3. Action Taken lifecycle and Ticket resolution rules match the approved product specification.
4. Concurrency and transaction requirements are testable.
5. Existing Lab 3 API compatibility has been reviewed.
6. Each API-related acceptance criterion has planned verification.
7. Any remaining design decisions are resolved before implementation.

**Contract status:** Approved for Implementation.