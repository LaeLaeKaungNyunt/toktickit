# Lab 2 Test Specification

## 1. Purpose and Test Strategy

This document defines the automated verification contract for the Lab 2 TokTickIT Requester Ticketing MVP.

Tests shall verify the behavior defined in:

- `specification.md`;
- `api-spec.md`;
- `ui-spec.md`.

Every Acceptance Criterion in `specification.md` shall be mapped to at least one automated test or explicitly identified verification method.

### Test Levels

Lab 2 shall use the following test levels where appropriate:

- **Unit tests** — verify isolated validation, formatting, helper, and business-rule logic.
- **API/integration tests** — verify REST endpoints, PostgreSQL persistence, ownership enforcement, validation, Ticket Events, and Attachment behavior.
- **UI/component tests** — verify rendering, form behavior, validation, loading, success, empty, no-results, and failure states.
- **Style/responsive tests** — verify required Zen Green UI foundation and responsive behavior.
- **End-to-end tests** — verify critical Requester workflows across the frontend, API, database, and storage integration.

### Test-Driven Development

For implementation work, tests should be created or updated from the approved Acceptance Criteria before or alongside the corresponding implementation.

A feature shall not be considered complete only because the UI appears to work manually. Relevant automated tests must pass and the Acceptance Criteria must be verified.

### Test Isolation

Tests shall use controlled test data and shall not depend on a specific manually created Ticket already existing.

Where practical:

- test data shall be created during test setup;
- tests shall clean up or isolate their own data;
- repeated test execution shall produce consistent results;
- ownership tests shall use at least two distinct Development Requesters;
- Attachment tests shall use controlled permitted and rejected test files. 

## 2. Test Environment and Seed Data

Automated tests shall run against controlled development or test configuration and shall not depend on production data.

### Required Reference Data

Test setup shall provide or verify:

- the four required Categories:
  - Account and Access;
  - Hardware;
  - Software;
  - Network;
- at least six realistic Related Systems;
- at least four active Development Requesters;
- at least one inactive Development Requester.

The inactive Development Requester shall be available in the database for verification but shall not appear in the Development Requester selector API or UI.

### Test Requesters

Ownership tests shall use at least two active Development Requesters so the test suite can verify that:

- a Requester can access their own Tickets;
- a Requester cannot list another Requester's Tickets;
- direct access to another Requester's Ticket is rejected safely;
- another Requester's Attachments cannot be retrieved, downloaded, uploaded, or removed.

### Test Storage

Attachment tests shall use the configured Lab 2 SeaweedFS integration or an isolated test substitute where appropriate.

Test files shall include:

- at least one permitted image;
- at least one permitted PDF;
- an unsupported file type;
- a file exceeding 5 MB where required for size-limit verification.

Tests shall not rely on unsafe original filenames as storage object keys.

### Seed Repeatability

Seed verification shall confirm that running the seed process repeatedly does not create duplicate Categories, Related Systems, or Development Requesters.

## 3. Development Requester Context Tests

### Requester Reference Data

Tests shall verify that:

- `GET /api/v1/development-requesters` returns `200 OK`;
- only active Development Requesters are returned;
- inactive Development Requesters are excluded;
- returned Requesters contain the required identifier, display name, and email fields.

### Requester Context Validation

For requester-specific endpoints, tests shall verify that:

- a valid active `X-Dev-Requester-Id` is accepted;
- a missing requester header is rejected safely;
- a malformed requester identifier is rejected safely;
- an unknown requester identifier is rejected safely;
- an inactive Development Requester is rejected safely.

### Requester Switching

UI tests shall verify that changing the selected Development Requester:

- updates the requester context used for subsequent requests;
- clears or replaces stale Ticket and Attachment data;
- reloads requester-specific data;
- does not display the previous Requester's Ticket data after the change.

### Ownership Isolation

Using at least two active Development Requesters, tests shall verify that requester-specific operations never expose another Requester's Ticket or Attachment data.

## 4. Create Ticket Tests

### API and Business Rules

Tests shall verify that a valid Ticket creation request:

- returns `201 Created`;
- creates exactly one Ticket;
- generates a unique backend-controlled Ticket Number in `TKT-YYYY-NNNNN` format;
- assigns the selected Development Requester as the owner;
- sets Current Status to `New`;
- persists the selected Category and active Related System;
- persists the trimmed Summary and Description;
- persists the requested priority;
- creates the corresponding Ticket-created Ticket Event in the same PostgreSQL transaction.

Tests shall also verify that Ticket Number generation remains unique when multiple Ticket creation requests occur concurrently.

### Validation

Ticket creation shall be rejected safely when:

- Category is missing or invalid;
- Related System is missing, invalid, or inactive;
- Summary is missing, whitespace-only, shorter than 5 characters, or longer than 120 characters after trimming;
- Requested Priority is missing or outside Low, Medium, High, and Urgent;
- Description is missing, whitespace-only, shorter than 10 characters, or longer than 5000 characters after trimming;
- requester context is invalid.

### UI Behavior

UI tests shall verify that:

- all required Create Ticket fields are displayed;
- Requester is read-only and reflects the selected Development Requester;
- no Requested Priority is silently preselected;
- invalid input produces appropriate field-level feedback;
- duplicate submission is prevented while creation is in progress;
- recoverable failures preserve entered values where practical;
- successful creation displays the persisted Ticket information and success feedback;
- optional Attachment upload occurs only after successful Ticket creation;
- a later Attachment upload failure does not make the successfully created Ticket appear to have failed.

## 5. My Tickets Tests

### Ownership and Listing

Tests shall verify that `GET /api/v1/tickets`:

- returns only Tickets owned by the current Development Requester;
- never includes another Requester's Tickets;
- returns the required Ticket summary fields;
- returns valid pagination metadata;
- uses the documented default ordering.

### Search and Filtering

Tests shall verify:

- case-insensitive search across Ticket Number, Summary, and Description;
- filtering by Current Status;
- filtering by Category;
- filtering by Related System;
- filtering by Requested Priority;
- combined search and filters;
- invalid query parameter values return `400 Bad Request`.

### Sorting and Pagination

Tests shall verify:

- sorting by creation date/time;
- sorting by Ticket Number;
- sorting by Requested Priority using the business order `Low < Medium < High < Urgent`, reversed for descending order;
- ascending and descending sort directions;
- default page and page size;
- explicit page navigation;
- maximum page-size validation;
- deterministic ordering where values are otherwise equal.

### UI Behavior

UI tests shall verify:

- loading state;
- owned Ticket information is rendered correctly;
- selecting a Ticket opens Ticket Detail;
- search, filter, sort, and reset controls work as specified;
- pagination controls represent the current page correctly;
- unavailable pagination actions are disabled;
- the general empty state is shown when the Requester owns no Tickets;
- the distinct no-results state is shown when active search or filters match no Tickets;
- API failure produces safe retryable feedback;
- switching Requesters clears stale list data before loading the new Requester's Tickets.

## 6. Ticket Detail and Attachment Tests

### Ticket Detail

Tests shall verify that `GET /api/v1/tickets/:ticketId`:

- returns the complete read-only Ticket Detail DTO for an owned Ticket;
- includes only active Attachment metadata;
- returns the same safe `404 Not Found` response when the Ticket does not exist or belongs to another Development Requester;
- does not expose Ticket update or status-change behavior in Lab 2.

UI tests shall verify that:

- all required Ticket fields are displayed;
- Ticket fields are read-only;
- another Requester's Ticket is never displayed;
- inaccessible Tickets produce a safe not-found/unavailable state.

### Attachment Upload

Tests shall verify that a valid Attachment upload:

- accepts JPG/JPEG, PNG, WEBP, and PDF;
- rejects unsupported file types;
- rejects files larger than 5 MB;
- rejects upload when the Ticket already has five active Attachments;
- requires ownership of the parent Ticket;
- stores the binary in SeaweedFS;
- stores Attachment metadata in PostgreSQL;
- does not use the unsafe original filename directly as the storage object key;
- creates the corresponding Attachment-added Ticket Event;
- persists Attachment metadata and the Ticket Event in the same PostgreSQL transaction.

Tests shall verify that database failure after successful binary storage triggers cleanup so an orphaned storage object is not knowingly left behind.

### Attachment Retrieval and Download

Tests shall verify that an active Attachment belonging to an owned Ticket:

- returns metadata successfully;
- can be downloaded successfully;
- returns the correct binary content type and safe download filename.

A missing, removed, mismatched, or unauthorized Attachment shall return the same safe `404 Not Found` behavior.

### Attachment Removal

Tests shall verify that removal:

- requires a non-empty trimmed reason;
- requires ownership of the parent Ticket and Attachment;
- records `removedAt`;
- records `removalReason`;
- records the removing Development Requester;
- retains Attachment metadata in PostgreSQL;
- deletes the binary object from SeaweedFS;
- creates the corresponding Attachment-removed Ticket Event;
- persists the removal metadata and Ticket Event in the same PostgreSQL transaction;
- prevents the removed Attachment from being retrieved or downloaded afterward.

Storage or database failure during removal shall return a safe error and shall not report a false successful removal.

### Attachment UI Behavior

UI tests shall verify that:

- permitted file types and limits are communicated clearly;
- upload progress or busy state prevents duplicate upload actions;
- successful upload refreshes the active Attachment list;
- Remove requires a reason and confirmation;
- successful removal removes the Attachment from the active list;
- removed Attachments cannot be previewed or downloaded;
- upload, download, and removal failures display safe user-facing feedback.

## 7. Zen Green, Responsive, and Accessibility Tests

### Zen Green Foundation

Style and UI tests shall verify that:

- the primary green `#006B3C` is applied consistently to appropriate primary UI elements;
- the secondary green `#0B7A46` and pale green `#EAF6EF` are used consistently where specified;
- shared buttons, forms, cards, alerts, badges, and other reusable components follow the common visual foundation;
- status, priority, success, validation, and error meaning does not rely on color alone.

### Responsive Behavior

Responsive verification shall cover representative desktop, tablet, and mobile viewport widths.

Tests shall verify that:

- primary content remains usable at each supported width;
- layouts stack or wrap appropriately as available width decreases;
- My Tickets provides a mobile-friendly presentation rather than requiring a wide desktop table;
- search, filter, sorting, and pagination controls remain usable;
- Ticket Detail and Attachment actions remain accessible;
- filenames and long text wrap safely;
- no unintended horizontal page scrolling occurs.

### Accessibility and Interaction

Tests or automated accessibility checks shall verify where practical that:

- form controls have visible labels;
- required fields are identifiable without relying only on color;
- interactive controls are keyboard reachable;
- visible focus indication is preserved;
- buttons and controls have understandable accessible names;
- Attachment removal confirmation can be operated by keyboard;
- disabled controls are distinguishable;
- readable contrast is maintained for key text and interactive elements.

## 8. Acceptance Criteria Traceability

The following matrix maps every Acceptance Criterion from `specification.md` to its primary automated verification.

| AC | Primary Verification |
|---|---|
| AC-01 | API + UI test — only active Development Requesters are available |
| AC-02 | UI test — requester-specific workflows remain unavailable until a Requester is selected |
| AC-03 | UI test — changing Requester updates context, reloads data, and clears stale Ticket data |
| AC-04 | UI test — Requester API failure displays a safe failure state |
| AC-05 | API/integration test — valid Ticket creation persists exactly one Ticket with a unique backend-generated Ticket Number, status New, selected owner, and Ticket-created Event |
| AC-06 | API + UI test — Categories and active Related Systems are populated from PostgreSQL |
| AC-07 | API + UI validation test — missing or invalid required input is rejected and not persisted |
| AC-08 | UI test — submitting state prevents duplicate Ticket creation |
| AC-09 | UI test — recoverable creation failure displays a safe error and preserves entered values |
| AC-10 | API + UI test — successful creation displays the persisted Ticket information |
| AC-11 | API + UI test — My Tickets returns only the selected Requester's Tickets |
| AC-12 | UI test — switching Requesters removes the previous Requester's Tickets and loads the new Requester's Tickets |
| AC-13 | API + UI test — search works across the documented fields |
| AC-14 | API + UI test — supported filters return only matching Tickets |
| AC-15 | API + UI test — supported sorting follows the documented deterministic order |
| AC-16 | API + UI test — pagination and pagination metadata work correctly |
| AC-17 | UI test — general empty state is displayed when the Requester owns no Tickets |
| AC-18 | UI test — search/filter no-results state is distinct from the general empty state |
| AC-19 | API test — invalid list query parameters receive the documented safe response |
| AC-20 | API + UI test — owned Ticket Detail displays saved Ticket information and active Attachment metadata read-only |
| AC-21 | API test — another Requester's Ticket cannot be accessed directly or exposed |
| AC-22 | API/integration + UI test — permitted Attachment upload stores the file and metadata and creates an Attachment-added Event |
| AC-23 | API + UI test — unsupported type, oversize file, and five-active-Attachment limit are rejected safely |
| AC-24 | API/integration test — active Attachment on an owned Ticket can be downloaded |
| AC-25 | API/integration + UI test — valid removal records removal metadata and removing Requester, deletes the SeaweedFS binary, and creates an Attachment-removed Event |
| AC-26 | API test — soft-removed Attachment cannot be previewed or downloaded |
| AC-27 | API test — another Requester's Attachment metadata, download, and removal cannot be accessed |
| AC-28 | API + UI test — Ticket remains created when a later optional Attachment upload fails and the Attachment failure is reported separately |
| AC-29 | Style/UI test — Lab 2 Requester screens consistently follow the Zen Green design foundation |
| AC-30 | Responsive test — desktop, tablet, and mobile workflows remain usable without unintended horizontal scrolling |
| AC-31 | UI/component test — applicable loading, empty, submitting, success, invalid, no-results, and API failure states are clearly presented |

### Traceability Rule

If an Acceptance Criterion changes during implementation, the corresponding test specification and automated test shall be updated before the feature is considered complete.

No Acceptance Criterion may be marked complete solely from visual inspection when an automated verification is practical.

## 9. Test Completion and Evidence

A Lab 2 feature shall be considered verified only when its required automated tests pass and its mapped Acceptance Criteria have been checked.

### Required Test Evidence

Evidence collected for the Lab 2 report shall include, where applicable:

- passing server/API test output;
- passing client/UI test output;
- passing end-to-end test output;
- responsive or style verification;
- evidence of ownership isolation;
- evidence of Attachment validation and removal behavior;
- evidence that required Ticket Events are persisted;
- evidence that the seed process is repeatable without duplicate reference data.

### Failure Handling

A failing required test shall not be ignored or removed only to obtain a passing test suite.

If implementation changes an approved behavior, the engineering contract shall be reviewed first. Any justified contract change shall be reflected consistently in `specification.md`, `api-spec.md`, `ui-spec.md`, and this test specification where applicable.

### Final Verification

Before Lab 2 is considered complete:

1. all required automated test suites shall pass;
2. every Acceptance Criterion shall have a completed verification;
3. no known ownership or requester-data isolation failure shall remain;
4. required Ticket Events and Attachment storage behavior shall be verified;
5. Zen Green and responsive UI requirements shall be verified;
6. final evidence shall be captured for the Lab 2 report.