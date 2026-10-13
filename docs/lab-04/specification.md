# Lab 4 — Engineering Specification

**Project:** TokTickIT — IT Service Desk  
**Course:** CPE 334 Introduction to Software Engineering in the Age of AI Agents  
**Sprint:** Lab 4 — Actions Taken, Dashboards, and Final Regression  
**GitHub Issue:** #44  
**Status:** Approved for Implementation

## 1. Product Scope

Lab 4 completes the core TokTickIT service-desk workflow established in Labs 1–3.

The sprint introduces Actions Taken, finalizes Ticket workflow rules, adds role-appropriate dashboards, and verifies that previously implemented functionality continues to work.

The existing Express, React, Prisma, and PostgreSQL application will be extended without replacing its established architecture or discarding existing data.

### 1.1 Functional Requirements

| ID | Requirement |
|---|---|
| FR-01 | IT Staff and Administrators can create and update Actions Taken on accessible Tickets. |
| FR-02 | Each Action Taken belongs to one Ticket, and each Ticket can contain multiple Actions Taken. |
| FR-03 | Actions Taken record the action date/time, description, result, performer, follow-up requirement, follow-up note when required, and attachment notes. |
| FR-04 | Requesters can view Actions Taken associated with their own Tickets. |
| FR-05 | The backend enforces permitted Ticket status transitions and resolution rules. |
| FR-06 | The IT Staff Dashboard displays operational statistics, assigned work, recent or urgent Tickets, and relevant Actions Taken information. |
| FR-07 | The Requester Dashboard displays personal Ticket statistics, recent activity, and Tickets requiring attention. |
| FR-08 | Dashboard metrics are calculated from authoritative backend data and provide appropriate drill-down navigation. |
| FR-09 | Authentication, role authorization, Ticket ownership, comments, internal notes, attachments, and user management from Labs 1–3 continue working. |
| FR-10 | The database migration preserves existing Users, Tickets, Attachments, Public Comments, and Internal Notes. |

### 1.2 Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | All write operations must enforce authorization on the backend. |
| NFR-02 | Invalid requests must receive safe, consistent error responses. |
| NFR-03 | Concurrent or stale workflow updates must not silently overwrite newer changes. |
| NFR-04 | The application must retain its Zen Green visual design across desktop, tablet, and mobile. |
| NFR-05 | Interfaces must support keyboard operation, visible focus, semantic labels, and non-color status indicators. |
| NFR-06 | Automated tests must cover new functionality and regression behavior from previous labs. |
| NFR-07 | Seed data must be repeatable and support realistic demonstration scenarios. |

### 1.3 Existing Functionality to Preserve

- JWT authentication and first-password-change workflow.
- Requester Ticket creation, listing, details, and attachments.
- IT Staff Ticket Queue, assignment, priority, and status management.
- Public Comments and staff-only Internal Notes.
- Requester resolution indication.
- Administrator user management.
- Existing Ticket history, database relationships, and role-based access controls.

### 1.4 Scope Control

Lab 4 implementation will follow the approved engineering contract. Features not required by the assignment or necessary for the documented workflow will not be added without updating the specification and tests.

## 2. Actions Taken Business Rules

An Action Taken records work performed on a Ticket. A Ticket can contain multiple Actions Taken records, allowing the service desk to track work separately from the Ticket's overall status and ownership.

### 2.1 Business Rules

| ID | Business Rule |
|---|---|
| BR-01 | Each Action Taken belongs to exactly one Ticket. A Ticket may have zero, one, or multiple Actions Taken records. |
| BR-02 | The Ticket Owner coordinates the Ticket, but an Action Taken may be performed by a different IT Staff member. |
| BR-03 | Only authenticated IT Staff and Administrators may create or update Actions Taken on Tickets they are authorized to access. |
| BR-04 | Requesters may view Actions Taken for their own Tickets but cannot create, update, assign, complete, or cancel them. |
| BR-05 | Each Action Taken records its creation date/time, Action Description, Result, Performed By, Follow-Up Required, Follow-Up Note, and Attachment Notes. |
| BR-06 | Performed By is automatically identified from the authenticated user creating the Action Taken and cannot be impersonated through the request body. |
| BR-07 | Action Description and Result must contain meaningful non-blank text. |
| BR-08 | Follow-Up Required is a boolean value. When true, a non-blank Follow-Up Note is mandatory. |
| BR-09 | When Follow-Up Required is false, Follow-Up Note may be empty. |
| BR-10 | Attachment Notes describe relevant files or evidence. They do not replace the existing Ticket attachment system. |
| BR-11 | Actions Taken support assignment to an eligible active IT Staff member or Administrator, independently of Ticket ownership. |
| BR-12 | Assigning an Action Taken to an inactive or ineligible user must be rejected by the backend. |
| BR-13 | Actions Taken support a documented lifecycle covering active work, completion, and cancellation. Completed and Cancelled are terminal statuses; any attempt to edit any field of an Action Taken whose database status is Completed or Cancelled must be rejected with HTTP 409 Conflict. |
| BR-14 | Existing Actions Taken must remain linked to their original Ticket and retain their original performer identity when edited. |
| BR-15 | Actions Taken must be displayed in a consistent, documented order, with stable ordering when timestamps match. |
| BR-16 | Actions Taken history must preserve accountability. Updates and lifecycle changes must not silently erase previously recorded work. |
| BR-17 | Invalid, unauthorized, conflicting, or stale updates must produce safe errors without corrupting Ticket or Actions Taken data. |
| BR-18 | Existing Tickets without Actions Taken remain valid after migration. No artificial Actions Taken records are created for them. |

### 2.2 Field Validation Decisions

| Field | Validation |
|---|---|
| Action Date/Time | User-provided date and time when the action was performed (ISO 8601 UTC); stored separately from `createdAt`; retained after edits |
| Action Description | Required, non-blank text |
| Result | Required, non-blank text |
| Performed By | Automatically set from authenticated creator; immutable |
| Follow-Up Required | Required boolean |
| Follow-Up Note | Required non-blank text when Follow-Up Required is true; optional when false |
| Attachment Notes | Optional text |
| Assigned Staff | Optional eligible active IT Staff or Administrator |
| Action Status | Controlled lifecycle value stored as Prisma `String @default("Active")` (not a database enum), validated in application code (`Active`, `Completed`, `Cancelled`) |

### 2.3 Authorization Summary

| Operation | Requester | IT Staff | Administrator |
|---|---|---|---|
| View Actions Taken on accessible Tickets | Own Tickets only | Allowed | Allowed |
| Create Actions Taken | No | Allowed | Allowed |
| Update Actions Taken | No | Allowed | Allowed |
| Assign Actions Taken | No | Allowed | Allowed |
| Complete or cancel Actions Taken | No | Allowed | Allowed |

All permissions must be checked by the backend. UI visibility alone is not sufficient authorization. Administrators are authorized to perform all IT Staff actions and operational workflows.

### 2.4 Decisions Requiring Detailed Contracts

The exact Action Status values (`Active`, `Completed`, `Cancelled`), lifecycle transition matrix, assignment validation, concurrency handling, and update audit strategy are finalized in the workflow and API contract sections. These decisions remain consistent across the database model, API, UI, and tests.

## 3. Ticket Status and Resolution Rules

### 3.1 Supported Ticket Statuses

TokTickIT retains the eight Ticket statuses established in Lab 3:

1. New
2. Open
3. In Progress
4. Waiting for Requester
5. Resolved
6. Closed
7. Reopened
8. Cancelled

### 3.2 Permitted Status Transitions

| Current Status | Permitted Next Statuses |
|---|---|
| New | Open, In Progress, Waiting for Requester, Cancelled |
| Open | In Progress, Waiting for Requester, Resolved, Cancelled |
| In Progress | Waiting for Requester, Resolved, Cancelled |
| Waiting for Requester | In Progress, Resolved, Cancelled |
| Resolved | Closed, Reopened, In Progress |
| Reopened | In Progress, Waiting for Requester, Resolved, Cancelled |
| Closed | None |
| Cancelled | None |

Transitions not listed in this table must be rejected by the backend.

### 3.3 Business Rules

| ID | Business Rule |
|---|---|
| BR-19 | Only authorized IT Staff and Administrators may formally change Ticket status. |
| BR-20 | Every status change must follow the approved transition matrix. |
| BR-21 | A Ticket may enter Resolved only when it has at least one completed Action Taken containing recorded work and a meaningful result. |
| BR-22 | A non-blank Resolution Summary is required when formally resolving a Ticket. |
| BR-23 | A Requester's indication that the problem appears resolved is advisory and must not automatically change Ticket status to Resolved. |
| BR-24 | A Ticket in Resolved may be Closed, Reopened, or returned to In Progress according to the approved transition matrix. |
| BR-25 | Closed and Cancelled are terminal statuses. No further status transitions are permitted. |
| BR-26 | Every successful status change must update the Ticket's current status and create a `STATUS_CHANGED` TicketEvent atomically in the same database transaction. |
| BR-27 | Concurrent or stale status updates must not silently overwrite a newer workflow change. The backend keeps `expectedUpdatedAt` optional at the status API boundary for Labs 1–3 backward compatibility, but all Lab 4 frontend status updates must supply it. When provided, stale updates must be rejected with HTTP 409 Conflict. |
| BR-28 | An invalid resolution attempt must leave the Ticket status unchanged and return a clear, safe validation error. |

### 3.4 Resolution Gate

Before a Ticket changes to Resolved, the backend must verify:

- The authenticated user has permission to resolve the Ticket (IT Staff or Administrator).
- The transition to Resolved is permitted from the current status.
- At least one linked Action Taken is completed.
- The completed Action Taken contains meaningful work details and a result.
- A non-blank Resolution Summary is provided.
- If `expectedUpdatedAt` is provided, the request is not based on a stale Ticket state.
- Status update and TicketEvent creation succeed or fail atomically in a database transaction.

If any condition fails, the backend rejects the transition without partially updating the Ticket.

### 3.5 Requester Resolution Indication

The Requester may indicate that the problem appears resolved using the existing Lab 3 functionality.

This indication is separate from the formal Ticket status. IT Staff must review the work and apply the approved resolution process.

The Requester cannot bypass the resolution gate or directly set the Ticket status to Resolved.

### 3.6 User Interface Behavior

- Ticket Detail displays the current status clearly.
- Status controls show only transitions available to the authenticated user.
- A blocked resolution attempt displays a useful explanation.
- Successful status changes refresh the Ticket summary and history.
- Backend validation remains authoritative even when requests bypass the user interface.

## 4. Dashboard Metrics and Calculations

Lab 4 introduces role-appropriate dashboards that summarize existing Ticket and Actions Taken data. Dashboards provide quick access to important work without replacing Ticket Queue, My Tickets, or Ticket Detail.

All metrics are calculated by the backend using authoritative PostgreSQL data.

### 4.1 IT Staff Dashboard

| ID | Metric | Calculation | Drill-Down |
|---|---|---|---|
| DM-01 | Unassigned Tickets | Count Tickets with no Ticket Owner, excluding Closed and Cancelled | Ticket Queue filtered by unassigned (`assignment=unassigned`) |
| DM-02 | My Assigned Tickets | Count non-terminal Tickets owned by the authenticated staff user | Ticket Queue filtered by current user (`assignedToMe=true`) |
| DM-03 | Urgent Tickets | Count non-terminal Tickets with IT Priority = Urgent or High; display Urgent before High | Ticket Queue filtered by urgent priorities (`priority=Urgent,High`) |
| DM-04 | Tickets by Status | Count Tickets grouped by each of the eight statuses (`statusCounts`) | Ticket Queue filtered by selected status (`status=<Status>`) |
| DM-05 | My Active Actions | Count active Actions Taken assigned to the authenticated user (`myActiveActionsCount`) | Moves to My Actions Taken section on IT Staff Dashboard |
| DM-06 | Recently Updated Tickets | Show the 5 Tickets with the latest update timestamps, newest first (`recentTickets`) | Corresponding Ticket Detail |

The IT Staff Dashboard displays operational data across Tickets accessible to IT Staff. Administrators may use the same dashboard.

### 4.2 Requester Dashboard

| ID | Metric | Calculation | Drill-Down |
|---|---|---|---|
| DM-07 | My Active Tickets | Count the authenticated Requester's Tickets excluding Closed and Cancelled (`myActiveTickets`) | My Tickets (unfiltered; preserves existing Lab 2 query behavior) |
| DM-08 | Waiting for Me | Count owned Tickets with status Waiting for Requester (`waitingForMe`) | Moves to Needs My Attention section on Requester Dashboard |
| DM-08a | Total Tickets | Total count of owned Tickets across all statuses (`totalTicketsCount`) | My Tickets (unfiltered) |
| DM-08b | Resolved Tickets | Total count of owned Tickets currently in Resolved status (`resolvedTicketsCount`) | Moves to Recently Resolved section on Requester Dashboard |
| DM-09 | Recently Resolved | Show up to 5 owned Tickets currently in Resolved, ordered by latest resolution event timestamp (fallback to `updatedAt`) | Corresponding Requester Ticket Detail |
| DM-10 | Recently Updated | Show the 5 owned Tickets with the latest update timestamps, newest first | Corresponding Requester Ticket Detail |
| DM-11 | Tickets by Status | Count owned Tickets grouped by each of the eight statuses (`statusCounts`) | Status breakdown card on Requester Dashboard |

The Requester Dashboard must never include another Requester's Tickets in its counts, lists, or links. Existing `GET /api/v1/tickets` status query parameter validation remains strictly unchanged (`status=New` only) to preserve Lab 2 regression tests; dashboard summary cards navigate to in-page preview sections or individual Ticket views rather than unsupported filtered ticket lists.

### 4.3 General Dashboard Business Rules

| ID | Business Rule |
|---|---|
| BR-29 | Dashboard metrics must be calculated on the backend from authoritative Ticket and Actions Taken records. |
| BR-30 | Requester dashboard queries must filter by the authenticated Requester's user ID. |
| BR-30a | `GET /api/v1/tickets` status query parameter validation remains unchanged (`status=New` only) to preserve Lab 2 regression test contracts. Dashboard summary navigation directs to in-page preview sections ("Needs My Attention", "Recently Resolved") or individual Ticket Detail views, not unsupported filtered My Tickets query URLs. |
| BR-31 | IT Staff dashboard data must follow the approved staff authorization rules. |
| BR-32 | Ticket counts must use the documented status and priority filters consistently. |
| BR-33 | A metric with no matching records must return zero rather than an error. |
| BR-34 | Recent lists must return an empty array when no records match. |
| BR-35 | Recent Ticket lists must use descending timestamps with Ticket ID as a stable tie-breaker. |
| BR-36 | Dashboard drill-down links must respect the user's role and Ticket access permissions. |
| BR-37 | Administrators may reuse the IT Staff Dashboard without requiring a separate dashboard implementation. |
| BR-38 | Dashboard failures must display safe feedback without exposing sensitive database or server details. |

### 4.4 Calculation and Date Rules

- All counts are calculated using database queries, not client-side counting of paginated Ticket lists.
- Closed and Cancelled are treated as terminal statuses for active-work metrics.
- Recent lists use a maximum of five records unless a different limit is explicitly specified.
- Timestamps are stored and exchanged in UTC.
- Date-based calculations use UTC boundaries unless a different reporting timezone is explicitly documented.
- Equal timestamps are ordered consistently using the record ID.
- Dashboard results are refreshed when the page loads or the user explicitly refreshes the data.

### 4.5 Empty, Loading, and Error States

- Loading: display a clear loading indicator or skeleton.
- Zero metrics: display 0.
- Empty recent lists: display a short message such as "No recent tickets."
- Forbidden: display Access Denied without revealing restricted data.
- API failure: display a safe error message and provide a retry action.
- Responsive layout: stack dashboard cards and lists appropriately on smaller screens.

### 4.6 Dashboard Scope

Dashboards summarize and navigate existing operational information. Advanced analytics, chart builders, exports, SLA monitoring, and external notifications are outside Lab 4 scope.

## 5. Database Changes, Migration, and Seed Data

### 5.1 Data Model

Lab 4 extends the existing Prisma and PostgreSQL database with an Action Taken model.

Each Ticket can have multiple Actions Taken records. Existing Ticket, User, Attachment, Public Comment, Internal Note, and Ticket Event relationships must remain valid.

| Field | Proposed Data Type | Purpose |
|---|---|---|
| id | String UUID, primary key | Unique Action Taken identifier (`@id @default(uuid())`) |
| ticketId | String UUID, foreign key | Parent Ticket (`Ticket.id`) |
| actionDateTime | DateTime | User-provided date and time when the action was performed (ISO 8601 UTC); stored separately from `createdAt` |
| description | Text / String | Work performed or planned |
| result | Text / String | Outcome of the action |
| performedById | String UUID, foreign key | Authenticated creator (`User.id`) |
| assignedToId | Nullable String UUID, foreign key | Eligible staff member responsible for the action (`User.id`) |
| followUpRequired | Boolean | Whether follow-up is necessary |
| followUpNote | Nullable Text / String | Required when follow-up is necessary |
| attachmentNotes | Nullable Text / String | Description of related evidence |
| status | String (`@default("Active")`) | Current Action Taken lifecycle status (`Active`, `Completed`, `Cancelled`); stored as Prisma `String` to match existing schema conventions |
| createdAt | DateTime | Server-generated audit creation timestamp (`@default(now())`) |
| updatedAt | DateTime | Last modification timestamp (`@updatedAt`) |

Additionally, the `Ticket` model is extended with:
- `resolutionSummary`: Nullable `String?` (storing the mandatory summary provided upon formal resolution).

### 5.2 Relationships and Indexes

- One Ticket has zero or many Actions Taken (`actions ActionTaken[]`).
- Each Action Taken belongs to exactly one Ticket (`ticket Ticket @relation(fields: [ticketId], references: [id])`).
- Each Action Taken references its original performer via named relation (`User.performedActions ActionTaken[] @relation("ActionPerformer")`).
- An Action Taken may reference an assigned staff member via named relation (`User.assignedActions ActionTaken[] @relation("ActionAssignee")`).
- Foreign keys protect referential integrity.
- Index `ticketId` to support Ticket Detail queries.
- Index `assignedToId` and `status` to support staff workload queries.
- Use `actionDateTime ASC, createdAt ASC, id ASC` ordering for stable Actions Taken history.

### 5.3 Database Design Justifications

**Decision 1 — Separate Action Taken model**

Actions Taken are stored in a separate table rather than adding repeated action fields to the Ticket table.

This supports multiple work records per Ticket, avoids duplicated Ticket information, and allows individual actions to be tracked and updated independently.

**Decision 2 — Separate Ticket Owner and Action Assignee**

Ticket ownership and Action Taken assignment are stored separately.

The Ticket Owner remains responsible for coordinating the overall request, while another eligible IT Staff member may perform a specific action. This reflects the stakeholder's required workflow.

**Decision 3 — Preserve the original performer**

The original `performedById` is retained when an action is edited or reassigned.

This helps preserve accountability and prevents reassignment from incorrectly changing who originally recorded the work.

### 5.4 Migration Strategy

- Create a new Prisma migration for the Action Taken model and required relationships.
- Preserve all existing Users, Tickets, Attachments, Public Comments, Internal Notes, and Ticket Events.
- Do not delete, recreate, or reset existing application tables.
- Existing Tickets with no Actions Taken remain valid.
- Do not automatically generate artificial Actions Taken for older Tickets.
- Test migration against a database containing representative Lab 3 data.
- Verify record counts and relationships before and after migration.
- Back up existing data before applying the migration to a database that must be preserved.

### 5.5 Recovery Strategy

Before applying the migration, create a recoverable database backup.

If migration fails, stop deployment and investigate the error. Restore from the verified backup when necessary rather than using a destructive database reset.

The migration procedure and recovery instructions must be documented in the README.

### 5.6 Seed Data

The seed process must be idempotent and safe to run repeatedly.

Seed data must include:

- Tickets representing all major statuses and priorities.
- Assigned and unassigned Tickets.
- Tickets with zero, one, and multiple Actions Taken.
- Actions Taken assigned to different eligible staff members.
- Completed, cancelled, and active Actions Taken.
- Records with and without required follow-up.
- Data producing both zero and non-zero dashboard metrics.

Repeated seed execution must not create duplicate demonstration records.

### 5.7 Data Integrity Rules

| ID | Business Rule |
|---|---|
| BR-39 | Deleting or changing an Action Taken must not accidentally delete its parent Ticket. |
| BR-40 | Existing Ticket records must remain valid after the Lab 4 migration. |
| BR-41 | Action Taken performer and assignee references must identify valid Users. |
| BR-42 | Action Taken assignment must reject inactive or ineligible Users. |
| BR-43 | Seed execution must not duplicate existing demonstration records. |
| BR-44 | Database writes must preserve valid relationships and avoid partial workflow updates. |
| BR-45 | Historical Action Taken records must remain attributable to their original performer. |

### 5.8 Implementation Decisions to Verify

Before implementing the migration, inspect the existing Prisma schema to confirm:

- Existing primary-key types and naming conventions.
- Existing User and Ticket relationships.
- Current priority and status enum values.
- Existing Ticket resolution fields.
- Whether Ticket Event history can record Action Taken changes.
- The best approach for detecting stale updates.

The final migration must be based on the actual Lab 3 schema rather than assumptions.

## 6. API Contract Summary and Error Handling

### 6.1 API Design

Lab 4 extends the existing REST API under `/api/v1`.

The API must preserve the authentication, authorization, Ticket, comment, note, attachment, and user-management endpoints implemented in Labs 2–3.

New endpoints must use the existing JSON naming conventions and consistent HTTP status codes.

### 6.2 Proposed and Extended API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/tickets/:ticketId/actions` | Retrieve Actions Taken for an accessible Ticket |
| POST | `/api/v1/tickets/:ticketId/actions` | Create an Action Taken (IT Staff or Administrator) |
| PATCH | `/api/v1/tickets/:ticketId/actions/:actionId` | Update or transition an Action Taken (`expectedUpdatedAt` required; IT Staff or Administrator) |
| GET | `/api/v1/dashboard/staff` | Retrieve IT Staff Dashboard metrics and preview lists (IT Staff or Administrator) |
| GET | `/api/v1/dashboard/requester` | Retrieve the authenticated Requester's dashboard data (Requester only) |
| GET | `/api/v1/staff/tickets` | Existing queue extended with `assignedToMe=true` and combined priorities (e.g. `priority=Urgent,High`) |
| PATCH | `/api/v1/staff/tickets/:ticketId/status` | Existing status update extended with resolution gate, atomic transaction, and optional `expectedUpdatedAt` |

Existing Ticket status-update endpoints will be extended to enforce the approved resolution gate, Administrator authorization, and stale-update handling.

Exact request bodies, response shapes, and query parameters are documented in `api-spec.md`.

### 6.3 Authorization

| API Operation | Requester | IT Staff | Administrator |
|---|---|---|---|
| Read Actions Taken | Own Tickets only | Accessible Tickets | Accessible Tickets |
| Create Actions Taken | Forbidden | Allowed | Allowed |
| Update Actions Taken | Forbidden | Allowed | Allowed |
| Staff Dashboard | Forbidden | Allowed | Allowed |
| Requester Dashboard | Allowed | Forbidden | Forbidden |
| Formal Ticket status change | Forbidden | Allowed | Allowed |
| Staff Ticket Queue & Detail | Forbidden | Allowed | Allowed |

All authorization checks must be enforced by the backend. The backend router for staff operations (`/api/v1/staff/*`) permits both authenticated `IT Staff` and `Administrator` roles.

### 6.4 Validation

The backend must validate:

- Required Action Taken fields.
- Follow-Up Note when follow-up is required.
- Valid Ticket and Action Taken identifiers.
- Valid and active assigned staff (`IT Staff` or `Administrator`).
- Permitted Action Taken lifecycle changes (rejecting any edits to Completed or Cancelled actions with HTTP 409).
- Permitted Ticket status transitions.
- Resolution gate requirements (completed work evidence and non-blank `resolutionSummary`).
- Stale or conflicting updates.

Invalid requests must not partially modify application data.

### 6.5 HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 OK | Successful retrieval or update |
| 201 Created | Action Taken successfully created |
| 400 Bad Request | Invalid input, missing resolution evidence, or unsupported parameters |
| 401 Unauthorized | Missing or invalid authentication |
| 403 Forbidden | Authenticated user lacks permission |
| 404 Not Found | Requested resource does not exist or must not be disclosed |
| 409 Conflict | Prohibited Ticket transition, stale update, edit to terminal action, or conflicting workflow state |
| 500 Internal Server Error | Unexpected server failure with a safe response |

The API must not expose passwords, tokens, database connection details, stack traces, or other sensitive internal information.

### 6.6 Concurrency and Conflict Handling

Lab 4 prevents stale clients from silently overwriting newer Ticket and Action Taken workflow changes:

- **Action Taken updates:** The client submits `expectedUpdatedAt` matching the timestamp last retrieved. The backend checks that `expectedUpdatedAt` still matches the current database record. If the record has changed or the action is already terminal (`Completed` or `Cancelled`), the backend rejects the update with HTTP 409 Conflict.
- **Ticket status updates:** `expectedUpdatedAt` is kept optional at the API boundary for backward compatibility with Labs 1–3 regression test suites. However, all new Lab 4 frontend status updates must supply it. When provided, the backend rejects stale updates with HTTP 409 Conflict.
- **Atomicity:** All status changes, action updates, and their corresponding `TicketEvent` audit records are committed within the same database transaction (`prisma.$transaction`), ensuring partial updates cannot occur.
- **User experience:** When HTTP 409 Conflict is returned, the frontend informs the user and provides an action to reload the latest state.

### 6.7 Dashboard Responses

Dashboard endpoints must return concise metrics and recent-item summaries rather than entire Ticket collections.

Requester dashboard data must be filtered by the authenticated user's identity on the backend.

Counts return zero when no records match. Recent lists return empty arrays when no records match.

Dashboard query filters, date boundaries, ordering, and drill-down behavior must follow Section 4.

### 6.8 Compatibility

Lab 4 must not break existing Lab 3 API contracts without an explicitly documented and tested change.

Regression tests must verify that existing clients can continue using authentication, Tickets, comments, internal notes, attachments, and administrator functions.

## 7. UI Specification Summary

Lab 4 extends the existing TokTickIT interface while preserving the Zen Green design language and navigation established in Labs 2–3.

Detailed screen layouts, controls, responsive rules, and visual verification criteria are defined in `docs/lab-04/ui-spec.md`.

### 7.1 IT Staff Dashboard

The IT Staff Dashboard provides a concise overview of service-desk operations.

It must include:

- Operational metric cards defined in Section 4.
- Assigned work and Actions Taken information.
- Recent or urgent Tickets.
- Links to the relevant Ticket Queue or Ticket Detail.
- Loading, empty, forbidden, and safe-error states.

Administrators may access the same dashboard using their IT Staff permissions.

### 7.2 Requester Dashboard

The Requester Dashboard summarizes only the authenticated Requester's Tickets.

It must include:

- Personal Ticket statistics.
- Tickets waiting for Requester attention.
- Recently updated and recently resolved Tickets.
- Links to the Requester's Ticket Detail or My Tickets.
- Loading, empty, forbidden, and safe-error states.

It must not expose other Requesters' Ticket information.

### 7.3 Actions Taken on Ticket Detail

The existing IT Staff Ticket Detail must include an Actions Taken section with:

- A list or table of recorded Actions Taken.
- Create mode for authorized users.
- View and edit modes for existing records.
- Action date/time, description, result, performer, follow-up requirement, follow-up note, and attachment notes.
- Assignment and lifecycle controls for permitted users.
- Clear validation, success, and failure feedback.

Requesters can view Actions Taken associated with their own Tickets but cannot modify them.

### 7.4 Ticket Workflow Controls

- Display the current Ticket status clearly.
- Offer only permitted status transitions.
- Explain resolution requirements when a transition is blocked.
- Refresh the Ticket status after successful changes.
- Preserve existing comments, internal notes, attachments, ownership, and priority controls.

The backend remains responsible for enforcing workflow rules.

### 7.5 Responsive Design and Accessibility

All major Lab 4 screens must:

- Work on desktop, tablet, and mobile layouts.
- Avoid horizontal page scrolling, clipped content, and overlapping controls.
- Support keyboard navigation and visible focus indicators.
- Use accessible form labels and clear validation messages.
- Distinguish statuses and priorities using text as well as color.
- Preserve readable layouts for tables, cards, and forms.
- Provide clear loading, empty, error, and forbidden feedback.

### 7.6 Existing Screens and Navigation

Lab 4 must preserve the existing Login, First Password Change, Create Ticket, My Tickets, Ticket Detail, IT Staff Ticket Queue, and Administrator User Management screens.

Dashboard navigation must be added according to the authenticated user's role, with a clear active-page indication.

Temporary or duplicate controls left from earlier development must be removed only after confirming they are no longer required.

### 7.7 Visual Verification

Desktop, tablet, and mobile screenshots must be captured for the major Lab 4 screens and stored under `artifacts/lab-04/screenshots/`.

The visual and accessibility checklist in `ui-spec.md` must be completed using actual application evidence.

## 8. Acceptance Criteria

### 8.1 Actions Taken

| ID | Acceptance Criterion |
|---|---|
| AC-01 | Given an authorized IT Staff member and valid input, when an Action Taken is created, then it is saved under the correct Ticket with the authenticated creator and approved assignee. |
| AC-02 | Given an accessible Ticket with multiple Actions Taken, when the Ticket Detail is opened, then all linked actions are displayed in a stable order. |
| AC-03 | Given an authorized user, when an existing Action Taken is edited with valid data, then the changes are saved without changing its original performer or parent Ticket. |
| AC-04 | Given an Action Taken requiring follow-up, when its Follow-Up Note is blank, then the backend rejects the request without saving invalid data. |
| AC-05 | Given an inactive or ineligible assignee, when an assignment is attempted, then the backend rejects the assignment. |
| AC-06 | Given a Requester viewing their own Ticket, when Actions Taken are loaded, then the records are visible but cannot be modified. |
| AC-07 | Given an unauthorized user, when an Actions Taken write endpoint is called directly, then the backend rejects the operation. |
| AC-08 | Given a valid Action Taken lifecycle change, when the user completes or cancels the action, then the new state is saved and reflected in Ticket Detail. |

### 8.2 Ticket Workflow

| ID | Acceptance Criterion |
|---|---|
| AC-09 | Given a permitted Ticket transition, when an authorized IT Staff member changes the status, then the new status is saved and the Ticket history records the change. |
| AC-10 | Given a prohibited Ticket transition, when an update is attempted, then the backend rejects it and preserves the current status. |
| AC-11 | Given a Ticket without a completed Action Taken, when formal resolution is attempted, then the backend rejects the transition to Resolved. |
| AC-12 | Given a Ticket with completed work evidence and a valid Resolution Summary, when an authorized user performs a permitted transition to Resolved, then the Ticket is formally resolved. |
| AC-13 | Given a Requester indicating that the problem appears resolved, when the indication is submitted, then the Ticket does not automatically change to Resolved. |
| AC-14 | Given a stale Ticket or Action Taken update, when the client submits an outdated version, then the backend returns a conflict without overwriting newer changes. |

### 8.3 IT Staff Dashboard

| ID | Acceptance Criterion |
|---|---|
| AC-15 | Given an authenticated IT Staff member, when the dashboard loads, then the displayed operational metrics match the approved database calculations. |
| AC-16 | Given assigned Actions Taken and Tickets, when the dashboard loads, then the current user's relevant work is displayed correctly. |
| AC-17 | Given recent or urgent Tickets, when a dashboard item is selected, then the user can open the corresponding permitted Ticket view. |
| AC-18 | Given no matching records, when the dashboard loads, then counts display zero and lists show appropriate empty states. |

### 8.4 Requester Dashboard

| ID | Acceptance Criterion |
|---|---|
| AC-19 | Given an authenticated Requester, when dashboard data is retrieved, then only metrics and recent Tickets owned by that Requester are returned. |
| AC-20 | Given Tickets requiring Requester attention, when the dashboard loads, then the correct Tickets are highlighted. |
| AC-21 | Given a Requester selecting a dashboard Ticket, when the detail page opens, then the correct owned Ticket is displayed. |
| AC-22 | Given an attempt to access another Requester's dashboard data or Ticket, when the backend processes the request, then access is denied without disclosing restricted information. |

### 8.5 Migration, Regression, and Quality

| ID | Acceptance Criterion |
|---|---|
| AC-23 | Given an existing Lab 3 database, when the Lab 4 migration runs, then previous Users, Tickets, Attachments, Public Comments, Internal Notes, and Ticket Events remain valid. |
| AC-24 | Given repeated seed execution, when the seed process runs again, then duplicate demonstration records are not created. |
| AC-25 | Given existing Lab 1–3 workflows, when regression tests run, then authentication, Tickets, attachments, comments, notes, and administrator functions continue working. |
| AC-26 | Given an API validation, authorization, or server failure, when the application receives an error, then it displays safe feedback without exposing sensitive internal details. |
| AC-27 | Given desktop, tablet, and mobile viewports, when major Lab 4 screens are inspected, then the layout remains readable without clipped controls, overlap, or horizontal page scrolling. |
| AC-28 | Given keyboard-only navigation, when the user operates major Lab 4 controls, then focus remains visible and interactive elements remain accessible. |
| AC-29 | Given an interrupted or conflicting form submission, when a recoverable error occurs, then the user's entered data is preserved where practical and duplicate actions are prevented. |
| AC-30 | Given the completed Lab 4 implementation, when all required automated tests and production builds run on `main`, then they pass and the final documentation matches the released application. |

### 8.6 Acceptance Criteria Traceability

Every acceptance criterion from AC-01 through AC-30 must map to at least one planned test in `docs/lab-04/tests.md`.

The test plan must cover:

- Unit and business-rule tests.
- API and database integration tests.
- Authorization and security tests.
- UI component and workflow tests.
- Migration and regression tests.
- Responsive and accessibility verification.
- End-to-end tests.
- Performance-smoke checks.

The final test report must identify actual test-file paths and results. No acceptance criterion may be marked complete without supporting verification evidence.

## 9. Product Definition of Done and Final Decisions

### 9.1 Product Definition of Done

Lab 4 is considered complete only when all applicable conditions below are satisfied.

| ID | Definition of Done |
|---|---|
| DoD-01 | All approved functional requirements and acceptance criteria are implemented and verified. |
| DoD-02 | Actions Taken support creation, viewing, editing, assignment, completion, and cancellation according to the approved contract. |
| DoD-03 | Ticket status transitions and the resolution gate are enforced by the backend. |
| DoD-04 | IT Staff and Requester Dashboards display accurate backend-calculated metrics and working drill-down navigation. |
| DoD-05 | Role authorization and Requester ownership restrictions are enforced by the backend. |
| DoD-06 | The Prisma migration preserves existing Labs 1–3 data and relationships. |
| DoD-07 | Seed data is idempotent and supports the required demonstration scenarios. |
| DoD-08 | Unit, API/integration, authorization, UI, workflow, regression, and E2E tests pass. |
| DoD-09 | Stale updates, validation failures, and unauthorized operations are handled safely. |
| DoD-10 | Major Lab 4 screens work on desktop, tablet, and mobile without clipping, overlap, or horizontal page scrolling. |
| DoD-11 | Keyboard accessibility, visible focus, form labels, and non-color status indicators are verified. |
| DoD-12 | Existing authentication, Tickets, comments, internal notes, attachments, and user-management functionality continues working. |
| DoD-13 | All required Lab 4 documentation is complete and consistent with the implementation. |
| DoD-14 | GitHub Issues, feature branches, pull requests, peer reviews, and staged integration are documented. |
| DoD-15 | The final implementation is merged into `main` through the approved Git workflow. |
| DoD-16 | Automated tests and production builds pass on the final `main` branch. |
| DoD-17 | The final Lab 4 submission PDF contains Answer Part 1 through Answer Part 9 with working links and readable evidence. |

### 9.2 Explicitly Excluded Features

The following are outside Lab 4 scope:

- Automatic SLA clocks, escalation engines, and breach notifications.
- Email, SMS, LINE, push, or other external notification services.
- Inventory, purchasing, spare-parts management, and service cost accounting.
- Time-sheet billing, payroll, and detailed labor-cost calculation.
- Multi-level approval workflows and electronic signatures.
- Advanced business intelligence, custom report builders, and export warehouses.
- Multi-tenant organizations and production-scale cloud operations.
- Unapproved features beyond the Sprint 4 engineering contract.

### 9.3 Assumptions and Design Decisions

| ID | Decision or Assumption |
|---|---|
| AD-01 | Lab 4 extends the existing React, Express, Prisma, and PostgreSQL architecture rather than replacing it. |
| AD-02 | Existing Ticket statuses and permitted transitions from Lab 3 are retained unless a documented Lab 4 requirement requires refinement. |
| AD-03 | Actions Taken are stored as separate child records linked to Tickets. |
| AD-04 | The original Action Taken performer is derived from authentication and preserved after editing. |
| AD-05 | Ticket ownership and individual Action Taken assignment are independent. |
| AD-06 | Formal Ticket resolution requires completed work evidence and a Resolution Summary. |
| AD-07 | Dashboard metrics are calculated on the backend, with Requester data restricted to owned Tickets. |
| AD-08 | Administrators may use IT Staff Dashboard and Actions Taken functions. |
| AD-09 | Stale workflow updates are detected using an optimistic-concurrency mechanism compatible with the existing database. |
| AD-10 | Existing Tickets without Actions Taken remain valid after migration. |

### 9.4 Approved Engineering Decisions

Following the comprehensive contract review against the active codebase, the following decisions are approved:

- **Approved Decision 1 (Requester Dashboard Navigation):** Keep existing `GET /api/v1/tickets` query validation unchanged (`status=New` only) to protect Lab 2 regression tests. Dashboard summary cards navigate to in-page preview sections ("Needs My Attention", "Recently Resolved") or individual Ticket Detail views, avoiding unsupported filtered My Tickets query links.
- **Approved Decision 2 (Administrator Authorization):** Widen `/api/v1/staff/*` backend route authorization to `requireRole("IT Staff", "Administrator")` and extend frontend navigation so Administrators can access the IT Staff Dashboard, Ticket Queue, Ticket Detail, and status transitions.
- **Approved Decision 3 (Optimistic Concurrency & Transactions):** Keep `expectedUpdatedAt` optional at the `PATCH /api/v1/staff/tickets/:ticketId/status` boundary for backward compatibility with Labs 1–3 test suites. Require it on all new Lab 4 frontend status updates and Action Taken PATCH operations (`PATCH .../actions/:actionId`). Stale updates return HTTP 409 Conflict. State changes and `TicketEvent` audit records are committed atomically within the same database transaction (`prisma.$transaction`).
- **Approved Decision 4 (IT Staff Queue Filtering):** Extend `GET /api/v1/staff/tickets` to support `assignedToMe=true` (filtering tickets where `assigneeId` equals the authenticated caller's ID) and combined priorities (e.g. `priority=Urgent,High`). Preserve existing query parameter behavior.
- **Approved Decision 5 (Action Taken Status Storage):** Store `ActionTaken.status` as Prisma `String @default("Active")` (not a PostgreSQL native enum) to match repository conventions. Validate allowed values (`Active`, `Completed`, `Cancelled`) in application code. Reject any edits to Completed or Cancelled actions with HTTP 409 Conflict.

### 9.5 Engineering Contract Approval

This specification represents the agreed engineering contract for Lab 4. All requirements and design decisions have been checked against the active codebase and synchronized with `api-spec.md`, `ui-spec.md`, and `tests.md`.

**Contract status:** Approved for Implementation.