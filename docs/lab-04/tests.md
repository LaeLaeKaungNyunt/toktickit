# Lab 4 — Test Plan

**Project:** TokTickIT — IT Service Desk  
**Sprint:** Lab 4  
**Status:** Approved for Implementation  
**Related documents:** `specification.md`, `api-spec.md`, `ui-spec.md`

## 1. Testing Strategy

### 1.1 Objective

Verify that Lab 4 Actions Taken, Ticket resolution rules, IT Staff Dashboard, and Requester Dashboard meet the approved acceptance criteria without breaking Labs 1–3.

Tests will be planned before implementation and executed throughout development.

### 1.2 Test Levels

| Test level | Purpose |
|---|---|
| Unit tests | Verify individual validation rules, status transitions, and dashboard calculations |
| API integration tests | Verify Express endpoints, Prisma database operations, and HTTP responses |
| Authorization tests | Verify JWT authentication, role restrictions, and Ticket ownership |
| Workflow tests | Verify Action Taken lifecycle and formal Ticket resolution |
| UI tests | Verify forms, tables, dashboard states, and error feedback |
| End-to-end tests | Verify complete user journeys across frontend, backend, and database |
| Migration tests | Verify existing data survives schema changes |
| Regression tests | Verify Labs 1–3 functionality remains working |
| Responsive and accessibility tests | Verify desktop, tablet, mobile, and keyboard usability |
| Performance-smoke tests | Verify dashboard queries remain usable with realistic test data |

### 1.3 Test-First Workflow

For each Lab 4 feature:

1. Identify the relevant acceptance criteria.
2. Write or update tests describing the expected behavior.
3. Run the tests and confirm that the new tests fail for the expected reason.
4. Implement the smallest change needed to satisfy the tests.
5. Run the tests again and confirm they pass.
6. Refactor where necessary without changing approved behavior.
7. Run related Lab 1–3 regression tests.
8. Record test results and evidence in the pull request.

### 1.4 Test Data and Isolation

- Use dedicated test data and a separate test database where applicable.
- Do not run destructive migration or reset commands against the development database containing existing work.
- Create Requester, IT Staff, Administrator, and inactive-user fixtures.
- Include Tickets in all eight existing statuses.
- Include Tickets with no Actions Taken, active actions, completed actions, and cancelled actions.
- Include valid and invalid assignees, required follow-up notes, and stale-update scenarios.
- Include multiple Requesters to verify data isolation.
- Reset or isolate test records between cases to avoid order-dependent results.

### 1.5 Evidence and Reporting

For each test group, record:

- Test file or verification procedure.
- Acceptance criteria covered.
- Expected behavior.
- Actual result.
- Pass/fail status.
- Relevant screenshot, log, or pull-request evidence.

A test is considered passed only when its actual behavior matches the approved contract. A successful build alone is not sufficient evidence that the feature works.

## 2. Actions Taken Test Cases

These tests verify the Actions Taken requirements defined in `specification.md` and `api-spec.md`.

### 2.1 Creation and Validation

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| AT-01 | IT Staff creates an action with valid required fields | HTTP 201; action linked to correct Ticket | AC-01 |
| AT-02 | Administrator creates an action | HTTP 201; action saved successfully | AC-01 |
| AT-03 | Create action with blank description | HTTP 400; no action created | AC-01 |
| AT-04 | Create action with blank result | HTTP 400; no action created | AC-01 |
| AT-05 | Create action without valid action date/time | HTTP 400; no action created | AC-01 |
| AT-06 | Create action with `followUpRequired = true` and blank note | HTTP 400; no action created | AC-04 |
| AT-07 | Create action with `followUpRequired = false` and no note | HTTP 201; action created | AC-04 |
| AT-08 | Create action with active IT Staff assignee | HTTP 201; assignee saved | AC-01, AC-05 |
| AT-09 | Create action with active Administrator assignee | HTTP 201; assignee saved | AC-05 |
| AT-10 | Assign action to inactive user | HTTP 400; assignment rejected | AC-05 |
| AT-11 | Assign action to Requester | HTTP 400; assignment rejected | AC-05 |
| AT-12 | Client attempts to set `performedById` | Backend rejects the field; authenticated performer cannot be forged | AC-01 |
| AT-13 | Create action for nonexistent Ticket | HTTP 404; no action created | AC-01 |

### 2.2 Listing and Ownership

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| AT-14 | IT Staff lists actions for an existing Ticket | HTTP 200; correct actions returned | AC-02 |
| AT-15 | Requester lists actions for owned Ticket | HTTP 200; read-only data returned | AC-06 |
| AT-16 | Requester lists actions for another user's Ticket | HTTP 404; restricted data not disclosed | AC-07 |
| AT-17 | Requester attempts to create an action | HTTP 403; no action created | AC-07 |
| AT-18 | Requester attempts to edit an action | HTTP 403; no changes saved | AC-07 |
| AT-19 | Unauthenticated user requests actions | HTTP 401 | AC-07 |
| AT-20 | Ticket contains no actions | HTTP 200 with `actions: []` | AC-02 |
| AT-21 | Multiple actions share the same action date/time | Results follow the documented stable ordering | AC-02 |

### 2.3 Editing and Assignment

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| AT-22 | IT Staff edits action description and result | HTTP 200; valid changes saved | AC-03 |
| AT-23 | Administrator edits an action | HTTP 200; valid changes saved | AC-03 |
| AT-24 | Edit action assignment to another active staff member | HTTP 200; new assignee saved | AC-05 |
| AT-25 | Remove an optional action assignee | HTTP 200; `assignedToId` becomes null | AC-05 |
| AT-26 | Attempt to change `ticketId` | HTTP 400; parent Ticket unchanged | AC-03 |
| AT-27 | Attempt to change `performedById` | HTTP 400; original performer unchanged | AC-03 |
| AT-28 | Edit action with invalid follow-up combination | HTTP 400; previous values preserved | AC-04 |
| AT-29 | Action ID belongs to a different Ticket | HTTP 404; no changes saved | AC-03 |
| AT-30 | Edit action using a stale `expectedUpdatedAt` | HTTP 409; newer changes preserved | AC-14 |

### 2.4 Action Lifecycle

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| AT-31 | Create a valid Action Taken | Initial status is `Active` | AC-01 |
| AT-32 | Transition Active → Completed | HTTP 200; status becomes Completed | AC-08 |
| AT-33 | Transition Active → Cancelled | HTTP 200; status becomes Cancelled | AC-08 |
| AT-34 | Transition Completed → Active | HTTP 409; status unchanged | AC-08 |
| AT-35 | Transition Cancelled → Completed | HTTP 409; status unchanged | AC-08 |
| AT-36 | Two concurrent requests update the same action version | Only one succeeds; conflicting request receives HTTP 409 | AC-14 |
| AT-44 | Attempt to edit fields or reassign a Completed or Cancelled Action Taken | HTTP 409; edit rejected and terminal state preserved | AC-03, AC-08 |

### 2.5 Audit History and Atomicity

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| AT-37 | Create Action Taken successfully | `ACTION_CREATED` TicketEvent saved with actor and action ID | AC-01 |
| AT-38 | Edit Action Taken successfully | `ACTION_UPDATED` TicketEvent records the change | AC-03 |
| AT-39 | Complete Action Taken | `ACTION_COMPLETED` TicketEvent saved | AC-08 |
| AT-40 | Cancel Action Taken | `ACTION_CANCELLED` TicketEvent saved | AC-08 |
| AT-41 | Submit invalid Action Taken update | No new audit event; previous record unchanged | AC-03 |
| AT-42 | Simulate a failure during record and event persistence | Transaction rolls back; no partial action or misleading event remains | AC-03 |
| AT-43 | Edit an existing Action Taken | Earlier TicketEvent history remains unchanged | AC-03 |

### 2.6 Planned Test Implementation

The exact test filenames will be selected to match the existing Lab 3 test structure.

Planned coverage includes:

- Unit tests for validation and lifecycle transitions.
- API integration tests for Actions Taken endpoints.
- Database tests for relationships and transactions.
- Authorization tests for role and ownership restrictions.
- Concurrency tests for stale updates.
- UI and E2E tests for creating, editing, completing, and cancelling actions.

All test cases AT-01 through AT-44 must be implemented or explicitly accounted for in the final test report.

## 3. Ticket Status and Resolution Test Cases

These tests verify the existing Lab 3 Ticket workflow and the additional Lab 4 resolution requirements.

### 3.1 Permitted Status Transitions

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| TS-01 | New → Open | HTTP 200; status updated | AC-09 |
| TS-02 | New → In Progress | HTTP 200; status updated | AC-09 |
| TS-03 | Open → Resolved with valid resolution evidence | HTTP 200; Ticket resolved | AC-12 |
| TS-04 | In Progress → Waiting for Requester | HTTP 200; status updated | AC-09 |
| TS-05 | Waiting for Requester → In Progress | HTTP 200; status updated | AC-09 |
| TS-06 | Resolved → Closed | HTTP 200; Ticket closed | AC-09 |
| TS-07 | Resolved → Reopened | HTTP 200; Ticket reopened | AC-09 |
| TS-08 | Reopened → In Progress | HTTP 200; status updated | AC-09 |
| TS-09 | Every other permitted transition in the approved status matrix | HTTP 200; correct status saved | AC-09 |

### 3.2 Prohibited Status Transitions

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| TS-10 | New → Resolved | HTTP 409; status unchanged | AC-10 |
| TS-11 | Closed → In Progress | HTTP 409; status unchanged | AC-10 |
| TS-12 | Cancelled → Open | HTTP 409; status unchanged | AC-10 |
| TS-13 | In Progress → New | HTTP 409; status unchanged | AC-10 |
| TS-14 | Submit an unsupported status value | HTTP 400; status unchanged | AC-10 |
| TS-15 | Attempt any other prohibited transition | HTTP 409; no status change | AC-10 |

### 3.3 Formal Resolution Gate

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| TS-16 | Resolve Ticket with no Actions Taken | HTTP 400; Ticket remains unchanged | AC-11 |
| TS-17 | Resolve Ticket with only Active actions | HTTP 400; Ticket remains unchanged | AC-11 |
| TS-18 | Resolve Ticket with only Cancelled actions | HTTP 400; Ticket remains unchanged | AC-11 |
| TS-19 | Resolve Ticket with at least one Completed action and valid Resolution Summary | HTTP 200; status becomes Resolved | AC-12 |
| TS-20 | Resolve Ticket with Completed action but blank Resolution Summary | HTTP 400; Ticket remains unchanged | AC-12 |
| TS-21 | Resolve Ticket with Completed action but missing Resolution Summary | HTTP 400; Ticket remains unchanged | AC-12 |
| TS-22 | Requester indicates `RESOLVED` through the existing requester-resolution feature | Advisory indication saved; formal Ticket status does not automatically change | AC-13 |
| TS-23 | Resolve Ticket with valid evidence but from a prohibited source status | HTTP 409; status unchanged | AC-10, AC-12 |

### 3.4 Concurrency and Audit History

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| TS-24 | Update Ticket using a stale `expectedUpdatedAt` | HTTP 409; newer status preserved | AC-14 |
| TS-25 | Two users submit conflicting transitions from the same Ticket version | Only one succeeds; the other receives HTTP 409 | AC-14 |
| TS-26 | Successful status transition | `STATUS_CHANGED` TicketEvent saved with actor, previous status, and new status | AC-09 |
| TS-27 | Rejected transition or resolution attempt | No successful status-change event created | AC-10, AC-11 |
| TS-28 | Simulated failure while saving status and audit event | Entire transaction rolls back | AC-09 |
| TS-29 | Resolve Ticket successfully | Resolution Summary is saved and remains available in Ticket Detail | AC-12 |

### 3.5 Authorization and Regression

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| TS-30 | Requester calls IT Staff status endpoint | HTTP 403; status unchanged | AC-10 |
| TS-31 | Unauthenticated user calls status endpoint | HTTP 401 | AC-10 |
| TS-32 | Inactive IT Staff account attempts a transition | HTTP 403; status unchanged | AC-10 |
| TS-33 | Existing Ticket assignment and IT Priority updates | Continue working as in Lab 3 | AC-25 |
| TS-34 | Existing Ticket comments, notes, and attachment workflows | Continue working as in Lab 3 | AC-25 |
| TS-35 | Administrator calls status endpoint with valid transition | HTTP 200; status updated and `STATUS_CHANGED` event saved | AC-09, AC-25 |
| TS-36 | IT Staff or Administrator status update omits `expectedUpdatedAt` | HTTP 200; transition succeeds (backward compatibility with Labs 1–3) | AC-09, AC-25 |

### 3.6 Test Implementation Notes

- Use parameterized tests to cover every allowed and prohibited transition in the existing eight-status matrix.
- Create valid Completed Actions Taken fixtures for transitions entering Resolved.
- Test the resolution gate through the actual API, not only through frontend validation.
- Verify concurrency using database-backed integration tests.
- Verify that Ticket updates and TicketEvent creation are atomic.
- Preserve the existing Requester resolution indication behavior.
- Confirm that failed transitions do not modify the Ticket or create misleading audit records.

All test cases TS-01 through TS-36 must be implemented or explicitly accounted for in the final test report.

## 4. Dashboard Test Cases

These tests verify the IT Staff and Requester Dashboard requirements defined in `specification.md` and `api-spec.md`.

### 4.1 IT Staff Dashboard — Metrics

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| SD-01 | Load dashboard with unassigned, non-terminal Tickets | `unassignedTickets` matches the database count | AC-15 |
| SD-01a | Current staff member has Active assigned Actions Taken | `metrics.myActiveActionsCount` accurately counts that user's assigned Active actions | AC-15, AC-16 |
| SD-02 | Load dashboard with Tickets assigned to the current staff member | `myAssignedTickets` counts only that user's non-terminal Tickets | AC-15 |
| SD-03 | Load dashboard with Tickets assigned to other staff members | Other staff assignments are excluded from `myAssignedTickets` | AC-15 |
| SD-04 | Load dashboard with IT Priority Urgent or High Tickets | `urgentTickets` metric includes both priorities, excluding Closed and Cancelled | AC-15 |
| SD-05 | Load dashboard with Low, Medium, or unset IT Priority | Those Tickets are excluded from the urgent count | AC-15 |
| SD-06 | Load dashboard with Tickets in all eight statuses | `statusCounts` matches the database counts for each status | AC-15 |
| SD-07 | Load dashboard with no Tickets | Metrics return zero and lists return empty arrays | AC-18 |

### 4.2 IT Staff Dashboard — Work Lists and Queue Filtering

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| SD-08 | Current staff member has Active assigned Actions Taken | `myActions` contains those actions | AC-16 |
| SD-09 | Actions Taken belong to other assignees | They are excluded from `myActions` | AC-16 |
| SD-10 | Actions Taken are Completed or Cancelled | They are excluded from `myActions` | AC-16 |
| SD-11 | More than five assigned Active actions exist | `myActions` contains no more than five records | AC-16 |
| SD-12 | More than five recently updated Tickets exist | `recentTickets` returns the five most recently updated | AC-17 |
| SD-13 | Urgent and High priority Tickets exist | Urgent list prioritizes Urgent over High, then recent updates | AC-17 |
| SD-14 | Staff selects a dashboard Ticket | Correct permitted Ticket Detail opens | AC-17 |
| SD-15 | Staff selects an assigned Action Taken | Corresponding Ticket and action are accessible | AC-16, AC-17 |
| SD-16 | Staff queries queue with `assignedToMe=true` | Returns only Tickets where `assigneeId` matches authenticated caller | AC-15, AC-17 |
| SD-17 | Staff queries queue with `priority=Urgent,High` | Returns Tickets matching Urgent or High priorities | AC-15, AC-17 |
| SD-18 | Administrator queries staff queue and dashboard | HTTP 200; Administrator access permitted across queue and dashboard | AC-15, AC-25 |

### 4.3 Requester Dashboard — Metrics

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| RD-01 | Requester loads dashboard with owned Tickets | Counts include only that Requester's Tickets | AC-19 |
| RD-01a | Requester loads dashboard with owned Tickets | `metrics.totalTicketsCount` matches total count of owned Tickets across all statuses | AC-19 |
| RD-01b | Requester loads dashboard with owned Tickets | `metrics.resolvedTicketsCount` matches count of owned Tickets currently in Resolved status | AC-19 |
| RD-02 | Another Requester owns Tickets | Those Tickets are excluded from all returned metrics and lists | AC-19, AC-22 |
| RD-03 | Requester has non-terminal Tickets | `myActiveTickets` excludes Closed and Cancelled | AC-19 |
| RD-04 | Requester has Tickets in Waiting for Requester | `waitingForMe` matches the owned Ticket count | AC-20 |
| RD-05 | Requester has Tickets in all eight statuses | `statusCounts` includes only owned Tickets | AC-19 |
| RD-06 | Requester has no Tickets | All metrics are zero and lists are empty | AC-19 |

### 4.4 Requester Dashboard — Activity Lists

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| RD-07 | Requester has Tickets requiring attention | `waitingForMeTickets` shows the correct owned Tickets | AC-20 |
| RD-08 | Requester has more than five waiting Tickets | Preview returns at most five | AC-20 |
| RD-09 | Requester has currently Resolved Tickets | `recentlyResolvedTickets` shows owned Resolved Tickets | AC-19 |
| RD-09a | Requester has legacy Resolved Tickets without `STATUS_CHANGED` event | `recentlyResolvedTickets` falls back safely to `ticket.updatedAt` sorting | AC-19, AC-23 |
| RD-10 | Ticket was resolved, then reopened | It is excluded from the currently Resolved preview | AC-19 |
| RD-11 | Multiple resolution events exist | Recently resolved ordering uses the latest relevant resolution event | AC-19 |
| RD-12 | Requester has more than five recently updated Tickets | `recentTickets` returns at most five in correct order | AC-19 |
| RD-13 | Requester selects an owned Ticket | Correct Ticket Detail opens | AC-21 |
| RD-14 | Requester attempts to open another user's Ticket | Access is denied without exposing restricted data | AC-22 |

### 4.5 Dashboard Authorization and Error Handling

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| DA-01 | IT Staff requests staff dashboard | HTTP 200 | AC-15 |
| DA-02 | Administrator requests staff dashboard | HTTP 200 | AC-15 |
| DA-03 | Requester requests staff dashboard | HTTP 403 | AC-22 |
| DA-04 | Requester requests requester dashboard | HTTP 200; own data only | AC-19 |
| DA-05 | IT Staff requests requester dashboard | HTTP 403 | AC-22 |
| DA-06 | Unauthenticated user requests either dashboard | HTTP 401 | AC-22 |
| DA-07 | Inactive account requests dashboard | HTTP 403 | AC-22 |
| DA-08 | User with mandatory password change requests dashboard | HTTP 403 with existing password-change-required code | AC-25 |
| DA-09 | Database query fails | HTTP 500 with safe error; no internal details exposed | AC-26 |

### 4.6 Dashboard Performance and Consistency

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| DP-01 | Dashboard contains more records than preview limits | Counts reflect all matching records, not just five previews | AC-15, AC-19 |
| DP-02 | Two Tickets share the same update timestamp | Secondary ordering produces deterministic results | AC-17, AC-19 |
| DP-03 | Dashboard loads with realistic seeded data | Queries complete within the agreed performance-smoke threshold | AC-15, AC-19 |
| DP-04 | A Ticket's status, priority, or assignment changes | Dashboard metrics reflect the updated database state after refresh | AC-15, AC-19 |
| DP-05 | Dashboard API returns no matching records | Frontend displays useful empty states without errors | AC-18, AC-19 |

### 4.7 Test Implementation Notes

- Calculate expected metrics independently from the seeded test fixtures.
- Test all eight Ticket statuses and all existing IT Priority values.
- Verify Requester isolation using at least two different Requester accounts.
- Test dashboard API authorization separately from frontend route protection.
- Verify the five-item preview limit without incorrectly limiting metric counts.
- Use database-backed integration tests for calculations and sorting.
- Use UI and E2E tests for dashboard loading, empty states, and drill-down navigation.
- Record actual performance-smoke measurements rather than assuming the dashboard is fast.

All test cases SD-01 through SD-18 (including SD-01a), RD-01 through RD-14 (including RD-01a, RD-01b, RD-09a), DA-01 through DA-09, and DP-01 through DP-05 must be implemented or explicitly accounted for in the final test report.

## 5. Migration, Regression, and Quality Test Cases

### 5.1 Database Migration and Seed Tests

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| MG-01 | Apply Lab 4 migration to a database containing Lab 3 records | Migration succeeds; existing records remain intact | AC-23 |
| MG-02 | Read existing Tickets after migration | Ticket IDs, ownership, statuses, priorities, and timestamps are preserved | AC-23 |
| MG-03 | Read existing comments, internal notes, attachments, and events | Existing relationships and records remain valid | AC-23 |
| MG-04 | Read a legacy Ticket with no Actions Taken | Ticket remains accessible; Actions Taken list is empty | AC-23 |
| MG-05 | Inspect newly added nullable Ticket fields | Existing Tickets have safe default or null values | AC-23 |
| MG-06 | Run the Lab 4 seed twice | Second run does not create duplicate demonstration records | AC-24 |
| MG-07 | Create Actions Taken linked to valid Ticket and User records | Foreign-key relationships are enforced | AC-23 |
| MG-08 | Attempt to link an action to a nonexistent Ticket or User | Database rejects invalid relationship; no partial data saved | AC-23 |

### 5.2 Labs 1–3 Regression Tests

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| RG-01 | Requester logs in and accesses permitted pages | Authentication works as before | AC-25 |
| RG-02 | User with mandatory password change signs in | Password-change gate remains enforced | AC-25 |
| RG-03 | Requester creates and views Tickets | Existing Ticket workflow remains functional | AC-25 |
| RG-04 | IT Staff searches, filters, sorts, and paginates Tickets | Existing queue behavior remains functional | AC-25 |
| RG-05 | IT Staff assigns Tickets and updates IT Priority | Existing validation and permissions remain functional | AC-25 |
| RG-06 | IT Staff adds Public Comments and Internal Notes | Existing functionality remains intact | AC-25 |
| RG-07 | Requester uploads and removes attachments | Existing attachment behavior remains intact | AC-25 |
| RG-08 | Requester indicates the problem is resolved | Advisory indication remains separate from formal status | AC-13, AC-25 |
| RG-09 | Administrator manages user accounts | Existing user-management functions remain intact | AC-25 |
| RG-10 | Existing Lab 1–3 automated test suites run | All applicable tests pass without unintended regressions | AC-25, AC-30 |

### 5.3 Responsive and Accessibility Tests

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| UI-01 | Open IT Staff Dashboard at desktop width | Metrics, lists, and navigation display correctly | AC-27 |
| UI-02 | Open IT Staff Dashboard at tablet width | Layout adapts without overlapping or clipped controls | AC-27 |
| UI-03 | Open IT Staff Dashboard at mobile width | Content remains usable without horizontal page scrolling | AC-27 |
| UI-04 | Open Requester Dashboard at desktop, tablet, and mobile widths | Layout remains readable and usable | AC-27 |
| UI-05 | Open Actions Taken list and form at mobile width | Fields and actions remain accessible | AC-27 |
| UI-06 | Navigate major Lab 4 controls using only the keyboard | Controls are reachable in a logical order | AC-28 |
| UI-07 | Move keyboard focus through forms and navigation | Visible focus indicators are present | AC-28 |
| UI-08 | Inspect form inputs and validation messages | Inputs have accessible labels and useful error text | AC-28 |
| UI-09 | Inspect Ticket and Action Taken status indicators | Status is understandable without relying on color alone | AC-28 |
| UI-10 | Trigger loading, empty, success, and error states | Feedback is readable and does not break the layout | AC-26, AC-27 |

### 5.4 Error Recovery and Reliability Tests

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| ER-01 | Submit an Action Taken form with invalid data | Validation appears; previously entered valid data is preserved | AC-26, AC-29 |
| ER-02 | Submit an update using stale data | Conflict feedback appears; newer server data is not overwritten | AC-14, AC-29 |
| ER-03 | Simulate a recoverable network failure | User receives safe feedback and can retry | AC-26, AC-29 |
| ER-04 | Submit a form twice rapidly | Duplicate records are prevented or safely handled | AC-29 |
| ER-05 | Trigger an unexpected API failure | No stack trace, database credentials, or internal details are exposed | AC-26 |

### 5.5 Performance-Smoke Verification

| Test ID | Test scenario | Expected result | AC |
|---|---|---|---|
| PF-01 | Load staff dashboard with realistic seeded records | Response time is measured and recorded | AC-15 |
| PF-02 | Load requester dashboard with realistic seeded records | Response time is measured and recorded | AC-19 |
| PF-03 | Retrieve a Ticket with multiple Actions Taken | List loads successfully in stable order | AC-02 |
| PF-04 | Inspect database query patterns | No unnecessary full-table loading for dashboard counts | AC-15, AC-19 |

Performance-smoke tests are intended to detect obvious performance problems, not to claim production-scale load testing. The dataset size, environment, measured response times, and acceptable threshold must be recorded before final verification.

### 5.6 Evidence Requirements

The final Lab 4 verification record must include:

- Automated test results and test-file paths.
- Database migration and seed verification.
- Labs 1–3 regression results.
- Desktop, tablet, and mobile screenshots.
- Keyboard and accessibility checks.
- Error-handling and concurrency evidence.
- Performance-smoke measurements.
- Any failed tests, fixes, and retest results.

Screenshots will be stored under `artifacts/lab-04/screenshots/` and referenced in the final submission where relevant.

All test cases MG-01 through MG-08, RG-01 through RG-10, UI-01 through UI-10, ER-01 through ER-05, and PF-01 through PF-04 must be implemented or explicitly accounted for in the final test report.

## 6. End-to-End Tests and Acceptance Criteria Traceability

### 6.1 End-to-End Test Scenarios

| Test ID | End-to-end scenario | Expected result | AC |
|---|---|---|---|
| E2E-01 | IT Staff logs in, opens a Ticket, creates an Action Taken, and views the saved record | Action appears under the correct Ticket with the authenticated performer | AC-01, AC-02 |
| E2E-02 | IT Staff assigns an Action Taken to another active staff member | Assignment is saved and appears in the assigned user's work list | AC-05, AC-16 |
| E2E-03 | IT Staff edits an Action Taken and marks it Completed | Updated details and Completed status are displayed; history is preserved | AC-03, AC-08 |
| E2E-04 | IT Staff creates an Action Taken and cancels it | Cancelled status is displayed and the action is excluded from active work lists | AC-08, AC-16 |
| E2E-05 | IT Staff attempts to resolve a Ticket without completed work | Resolution is rejected; Ticket remains unchanged | AC-11 |
| E2E-06 | IT Staff completes an Action Taken, provides a Resolution Summary, and resolves the Ticket | Ticket becomes Resolved and the summary is saved | AC-09, AC-12 |
| E2E-07 | Requester logs in, opens their Ticket, and views Actions Taken | Actions are visible in read-only form | AC-06 |
| E2E-08 | Requester attempts to access another user's Ticket or Actions Taken | Access is denied without exposing restricted information | AC-07, AC-22 |
| E2E-09 | IT Staff opens the dashboard and selects an urgent Ticket | Correct metrics appear and the Ticket Detail opens | AC-15, AC-17 |
| E2E-10 | Requester opens the dashboard and selects a Ticket requiring attention | Only owned Tickets appear and the correct detail page opens | AC-19, AC-20, AC-21 |
| E2E-11 | Two staff members attempt conflicting updates | One update succeeds; the stale update receives a conflict without overwriting data | AC-14 |
| E2E-12 | Requester indicates their problem is resolved | Advisory indication is saved without automatically changing formal Ticket status | AC-13 |
| E2E-13 | User submits invalid form data and corrects it | Useful validation appears and valid entered data is preserved | AC-26, AC-29 |
| E2E-14 | Run critical Requester, IT Staff, and Administrator workflows after Lab 4 integration | Existing Labs 1–3 functionality remains operational | AC-25, AC-30 |

### 6.2 Acceptance Criteria Traceability Matrix

Every acceptance criterion must have planned verification.

| Acceptance criterion | Planned test IDs |
|---|---|
| AC-01 | AT-01–AT-05, AT-08, AT-12, AT-13, AT-31, AT-37, E2E-01 |
| AC-02 | AT-14, AT-20, AT-21, PF-03, E2E-01 |
| AC-03 | AT-22, AT-23, AT-26–AT-29, AT-38, AT-41–AT-44, E2E-03 |
| AC-04 | AT-06, AT-07, AT-28 |
| AC-05 | AT-08–AT-11, AT-24, AT-25, E2E-02 |
| AC-06 | AT-15, E2E-07 |
| AC-07 | AT-16–AT-19, E2E-08 |
| AC-08 | AT-32–AT-35, AT-39, AT-40, AT-44, E2E-03, E2E-04 |
| AC-09 | TS-01–TS-09, TS-26, TS-28, TS-35, TS-36, E2E-06 |
| AC-10 | TS-10–TS-15, TS-23, TS-27, TS-30–TS-32 |
| AC-11 | TS-16–TS-18, TS-27, E2E-05 |
| AC-12 | TS-03, TS-19–TS-21, TS-23, TS-29, E2E-06 |
| AC-13 | TS-22, RG-08, E2E-12 |
| AC-14 | AT-30, AT-36, TS-24, TS-25, ER-02, E2E-11 |
| AC-15 | SD-01–SD-07, SD-01a, SD-16–SD-18, DA-01, DA-02, DP-01, DP-03, DP-04, PF-01, PF-04, E2E-09 |
| AC-16 | SD-01a, SD-08–SD-11, SD-15, E2E-02 |
| AC-17 | SD-12–SD-14, SD-16, SD-17, DP-02, E2E-09 |
| AC-18 | SD-07, DP-05 |
| AC-19 | RD-01–RD-06, RD-01a, RD-01b, RD-09–RD-12, RD-09a, DA-04, DP-01–DP-05, PF-02, PF-04, E2E-10 |
| AC-20 | RD-04, RD-07, RD-08, E2E-10 |
| AC-21 | RD-13, E2E-10 |
| AC-22 | RD-02, RD-14, DA-03, DA-05–DA-07, E2E-08 |
| AC-23 | MG-01–MG-05, MG-07, MG-08, RD-09a |
| AC-24 | MG-06 |
| AC-25 | RG-01–RG-10, TS-33–TS-36, SD-18, DA-08, E2E-14 |
| AC-26 | DA-09, UI-10, ER-01, ER-03, ER-05, E2E-13 |
| AC-27 | UI-01–UI-05, UI-10 |
| AC-28 | UI-06–UI-09 |
| AC-29 | ER-01–ER-04, E2E-13 |
| AC-30 | RG-10, E2E-14, final integration test and build verification |

### 6.3 Test Execution and Reporting

Before implementation, the planned tests must be reviewed for consistency with the approved API and UI contracts.

During implementation:

1. Write relevant automated tests before feature code.
2. Record expected failing tests where appropriate.
3. Implement and verify each feature.
4. Run related regression tests.
5. Attach test results and evidence to the relevant pull request.
6. Resolve failures before integration.

### 6.4 Final Verification Checklist

- [ ] All AC-01 through AC-30 have supporting test evidence.
- [ ] Actions Taken API and workflow tests pass (including terminal-action edit rejection AT-44).
- [ ] Ticket status and resolution tests pass (including atomic transactions and legacy expectedUpdatedAt TS-35, TS-36).
- [ ] Both dashboard API and UI tests pass (including myActiveActionsCount, totalTicketsCount, resolvedTicketsCount).
- [ ] IT Staff queue filtering tests pass (assignedToMe=true and priority=Urgent,High).
- [ ] Role authorization and ownership tests pass (including Administrator access).
- [ ] Migration and idempotent seed checks pass (including legacy resolved ticket sorting fallback).
- [ ] Labs 1–3 regression tests pass.
- [ ] Desktop, tablet, and mobile checks are completed.
- [ ] Keyboard and accessibility checks are completed.
- [ ] Concurrency and failure-recovery checks pass.
- [ ] Performance-smoke results are recorded.
- [ ] End-to-end user journeys pass.
- [ ] Production builds pass on the final integrated branch.
- [ ] Test results and evidence are referenced in the Lab 4 submission.

**Test plan status:** Approved for Implementation.