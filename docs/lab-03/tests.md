# Lab 3 Test Plan and Traceability

## 1. Test Strategy

Lab 3 testing shall verify the new authentication, authorization, IT Staff, and Administrator functionality while also confirming that the existing Lab 2 Requester workflows continue to work after migration.

Testing shall be planned before implementation and shall cover the system at multiple levels.

### Unit Testing

Unit tests shall verify isolated business rules and validation logic where appropriate, including authentication-related rules, authorization decisions, ticket workflow rules, and Administrator safety rules.

### API and Integration Testing

API and integration tests shall verify:

- Authentication and session behavior
- Role-based authorization
- Requester ownership isolation
- IT Staff queue operations
- IT Staff Ticket Detail operations
- Public Comment and Internal Note visibility
- Administrator User Management
- Migration and data-preservation behavior
- Validation and safe API failures

Direct API tests shall be used to confirm that authorization is enforced by the backend and does not depend only on the UI.

### Client and UI Testing

Client tests shall verify the major Lab 3 interfaces and important UI states, including:

- Login
- Mandatory Change Password
- Authenticated role navigation
- Existing Requester workflows
- IT Staff Ticket Queue
- IT Staff Ticket Detail
- Administrator User Management
- Loading, validation, empty, no-results, and safe failure states where applicable

### Regression Testing

Existing Lab 2 tests shall continue to run after the Lab 3 migration.

Regression testing shall specifically confirm that authenticated Requesters can continue to use:

- Create Ticket
- My Tickets
- Ticket Detail
- Attachment functionality

Existing ownership isolation and data behavior shall remain intact.

### End-to-End Testing

End-to-end tests shall verify integrated user workflows using the completed application.

Required E2E coverage shall include:

- Authentication and password-change flow
- IT Staff ticket workflow
- Administrator user-management workflow
- Required role and authorization boundaries

### Visual and Responsive Verification

Manual visual verification shall supplement automated testing for behavior that is better evaluated visually.

Major Lab 3 screens shall be checked at desktop, tablet, and mobile widths for:

- Zen Green consistency
- Role navigation
- Status and priority badges
- Editable and read-only field distinction
- Validation placement
- Visible focus
- Clipping
- Overlap
- Horizontal overflow

### Test Result Recording

Each acceptance criterion shall map to planned verification in this document.

As implementation progresses, the traceability record shall be updated with:

- Actual test-file path
- Final verification method
- Final pass/fail status

Lab 3 shall not be considered complete while required acceptance criteria remain unverified or required automated tests are failing.

## 2. Planned Test Structure

Lab 3 tests shall be organized separately where practical so the new increment can be identified clearly while the existing Lab 2 regression suite remains available.

### Server Tests

Planned Lab 3 server test structure:

```text
server/tests/lab-03/
├── auth.api.test.ts
├── authorization.api.test.ts
├── staff-queue.api.test.ts
├── staff-ticket-detail.api.test.ts
├── comments-notes.api.test.ts
└── users-admin.api.test.ts

## 3. Planned Tests and Acceptance-Criteria Traceability

The following tests are planned before implementation. Actual test-file paths and final status shall be confirmed as implementation is completed.

| AC | Planned Verification | Test Level | Planned Test File | Final Status |
|---|---|---|---|---|
| AC-01 | Valid active user can log in and authenticated identity/role is returned | API + E2E | `server/tests/lab-03/auth.api.test.ts`, `e2e/lab-03/authentication.spec.ts` | Planned |
| AC-02 | Invalid credentials are rejected safely without creating authentication | API + UI | `server/tests/lab-03/auth.api.test.ts`, `client/src/Login.test.tsx` | Planned |
| AC-03 | Inactive account cannot log in | API + UI | `server/tests/lab-03/auth.api.test.ts`, `client/src/Login.test.tsx` | Planned |
| AC-04 | Initial-password user is forced through password change before normal access | API + UI + E2E | `server/tests/lab-03/auth.api.test.ts`, `client/src/ChangePassword.test.tsx`, `e2e/lab-03/authentication.spec.ts` | Planned |
| AC-05 | Authenticated identity and role are available and displayed correctly | API + UI | `server/tests/lab-03/auth.api.test.ts`, relevant authenticated client tests | Planned |
| AC-06 | Logout invalidates authenticated access and protected access afterward is rejected | API + E2E | `server/tests/lab-03/auth.api.test.ts`, `e2e/lab-03/authentication.spec.ts` | Planned |
| AC-07 | Ticket creation uses authenticated Requester identity rather than client-selected requester | API + Regression | `server/tests/lab-03/authorization.api.test.ts`, existing Create Ticket tests | Planned |
| AC-08 | My Tickets returns only the authenticated Requester's tickets | API + Regression | `server/tests/lab-03/authorization.api.test.ts`, existing My Tickets tests | Planned |
| AC-09 | Requester cannot access another Requester's Ticket Detail | API | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AC-10 | Requester attachment access follows authenticated ownership rules | API + Regression | `server/tests/lab-03/authorization.api.test.ts`, existing Attachment tests | Planned |
| AC-11 | Unauthorized roles are rejected by protected APIs even through direct API requests | API | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AC-12 | Authorized IT Staff can load queue with required realistic ticket information | API + UI | `server/tests/lab-03/staff-queue.api.test.ts`, `client/src/StaffTicketQueue.test.tsx` | Planned |
| AC-13 | Queue search returns matching tickets | API + UI | `server/tests/lab-03/staff-queue.api.test.ts`, `client/src/StaffTicketQueue.test.tsx` | Planned |
| AC-14 | Queue filters return only matching tickets | API + UI | `server/tests/lab-03/staff-queue.api.test.ts`, `client/src/StaffTicketQueue.test.tsx` | Planned |
| AC-15 | Queue sorting is deterministic and follows selected sort | API + UI | `server/tests/lab-03/staff-queue.api.test.ts`, `client/src/StaffTicketQueue.test.tsx` | Planned |
| AC-16 | Queue pagination returns correct pages without unintended duplication or omission | API + UI | `server/tests/lab-03/staff-queue.api.test.ts`, `client/src/StaffTicketQueue.test.tsx` | Planned |
| AC-17 | Queue clearly represents ownership, status, and IT Priority badges | UI + Visual | `client/src/StaffTicketQueue.test.tsx`, visual checklist | Planned |
| AC-18 | Queue handles loading, empty/no-results, failure, and open-detail behavior | UI + E2E | `client/src/StaffTicketQueue.test.tsx`, `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| AC-19 | Authorized IT Staff can claim an unassigned ticket | API + E2E | `server/tests/lab-03/staff-ticket-detail.api.test.ts`, `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| AC-20 | Valid reassignment persists and invalid/unauthorized reassignment is rejected | API + UI | `server/tests/lab-03/staff-ticket-detail.api.test.ts`, `client/src/StaffTicketDetail.test.tsx` | Planned |
| AC-21 | Valid IT Priority persists and invalid values are rejected | API + UI | `server/tests/lab-03/staff-ticket-detail.api.test.ts`, `client/src/StaffTicketDetail.test.tsx` | Planned |
| AC-22 | Permitted status transitions persist and invalid transitions are rejected | API + UI + E2E | `server/tests/lab-03/staff-ticket-detail.api.test.ts`, `client/src/StaffTicketDetail.test.tsx`, `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| AC-23 | Public Comments persist and are visible according to ticket-access rules | API + UI | `server/tests/lab-03/comments-notes.api.test.ts`, `client/src/StaffTicketDetail.test.tsx` | Planned |
| AC-24 | Internal Notes persist for authorized staff and are not exposed to Requesters | API + UI | `server/tests/lab-03/comments-notes.api.test.ts`, `client/src/StaffTicketDetail.test.tsx` | Planned |
| AC-25 | Existing Attachment functionality continues under Lab 3 authorization | API + Regression | `server/tests/lab-03/authorization.api.test.ts`, existing Attachment tests | Planned |
| AC-26 | Requester resolution indication is displayed on Ticket Detail | UI + E2E | `client/src/StaffTicketDetail.test.tsx`, `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| AC-27 | Invalid, forbidden, and conflicting ticket operations fail safely | API + UI | `server/tests/lab-03/staff-ticket-detail.api.test.ts`, `client/src/StaffTicketDetail.test.tsx` | Planned |
| AC-28 | Material Lab 3 ticket changes append required TicketEvent records without rewriting history | API + Integration | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| AC-29 | Administrator sees required user columns and can search by name/email | API + UI | `server/tests/lab-03/users-admin.api.test.ts`, `client/src/UserManagement.test.tsx` | Planned |
| AC-30 | Administrator role filter returns matching users | API + UI | `server/tests/lab-03/users-admin.api.test.ts`, `client/src/UserManagement.test.tsx` | Planned |
| AC-31 | Administrator can create valid user with one role and required initial password change | API + UI + E2E | `server/tests/lab-03/users-admin.api.test.ts`, `client/src/UserManagement.test.tsx`, `e2e/lab-03/user-administration.spec.ts` | Planned |
| AC-32 | Duplicate email and invalid user input are rejected with validation feedback | API + UI | `server/tests/lab-03/users-admin.api.test.ts`, `client/src/UserManagement.test.tsx` | Planned |
| AC-33 | Administrator can persist permitted user edits | API + UI | `server/tests/lab-03/users-admin.api.test.ts`, `client/src/UserManagement.test.tsx` | Planned |
| AC-34 | Administrator password reset requires password change at next login | API + E2E | `server/tests/lab-03/users-admin.api.test.ts`, `e2e/lab-03/user-administration.spec.ts` | Planned |
| AC-35 | Self-deactivation and removal of last active Administrator are prevented | API + UI | `server/tests/lab-03/users-admin.api.test.ts`, `client/src/UserManagement.test.tsx` | Planned |
| AC-36 | Non-Administrator cannot access User Management UI or APIs | API + E2E | `server/tests/lab-03/authorization.api.test.ts`, `e2e/lab-03/user-administration.spec.ts` | Planned |
| AC-37 | Existing Development Requesters migrate to Requester users with ownership preserved | Integration + Regression | migration/data-preservation test, existing Requester tests | Planned |
| AC-38 | Existing Ticket, Attachment, Category, and TicketEvent data survive migration | Integration + Regression | migration/data-preservation test, existing regression tests | Planned |
| AC-39 | Existing Create Ticket, My Tickets, Ticket Detail, and Attachment workflows pass after authentication migration | Regression + E2E | existing Lab 2 test suite, relevant Lab 3 E2E tests | Planned |
| AC-40 | All major Lab 3 screens remain usable at desktop, tablet, and mobile widths with Zen Green consistency | Visual + E2E | visual checklist and `artifacts/lab-03/screenshots/` | Planned |
| AC-41 | Major screens satisfy validation, focus, navigation, badge, field-state, clipping, overlap, and overflow checks | UI + Visual | relevant client tests and visual checklist | Planned |

## 4. Planned Test Cases

### Authentication

Planned authentication tests shall verify:

1. Active user can log in with valid credentials.
2. Invalid password is rejected safely.
3. Unknown email is rejected safely without revealing whether the account exists.
4. Inactive user cannot log in.
5. Authenticated current-user information contains the correct identity and role.
6. User with an initial password is required to change it before normal application access.
7. Valid required password change succeeds.
8. Invalid password-change input is rejected.
9. Logout invalidates authenticated access.
10. Protected APIs reject unauthenticated requests.

### Authorization and Requester Regression

Planned authorization and Requester tests shall verify:

1. Requester ticket creation uses the authenticated Requester identity.
2. A client cannot create a ticket on behalf of another Requester by supplying another identity.
3. My Tickets returns only the authenticated Requester's tickets.
4. Requester can open their own Ticket Detail.
5. Requester cannot open another Requester's Ticket Detail.
6. Requester attachment access follows ticket ownership.
7. Requester cannot access IT Staff-only APIs.
8. Requester cannot access Administrator-only APIs.
9. IT Staff cannot access Administrator-only User Management.
10. Direct API requests enforce the same authorization rules as the UI.
11. Existing Lab 2 Requester workflows continue to pass after authentication migration.

### IT Staff Ticket Queue

Planned queue tests shall verify:

1. Authorized IT Staff can retrieve the queue.
2. Unauthorized roles cannot retrieve the staff queue.
3. Queue results contain required ticket information.
4. Search returns matching tickets.
5. Search with no matches produces the expected no-results state.
6. Required filters return matching tickets.
7. Supported sorting produces deterministic results.
8. Pagination returns the correct records for each page.
9. Pagination does not unintentionally duplicate or omit tickets.
10. Assigned and unassigned tickets are represented correctly.
11. Status and IT Priority information are displayed clearly.
12. Loading, empty, no-results, and safe failure states are handled.
13. An authorized queue item can open Ticket Detail.

### IT Staff Ticket Detail and Operations

Planned Ticket Detail tests shall verify:

1. Authorized IT Staff can retrieve Ticket Detail.
2. Unauthorized access to staff Ticket Detail is rejected.
3. Authorized IT Staff can claim an unassigned ticket.
4. Invalid or conflicting claim operations are rejected safely.
5. Permitted reassignment persists.
6. Invalid or unauthorized reassignment is rejected.
7. Valid IT Priority update persists.
8. Invalid IT Priority is rejected.
9. Each permitted staff status transition succeeds according to the approved 8-status transition matrix (`New`, `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`, `Reopened`, `Cancelled`).
10. Invalid status transitions are rejected with HTTP 409 Conflict.
11. Requesters are strictly prohibited from directly changing `currentStatus` or executing formal status transitions.
12. Valid Public Comment is persisted and displayed.
13. Public Comment visibility follows ticket-access rules.
14. Valid Internal Note is persisted for authorized staff.
15. Internal Notes are not returned or displayed to Requesters.
16. Existing permitted Attachment behavior continues to work.
17. Requester resolution indication (`PATCH /api/v1/tickets/:ticketId/resolution`) sets or clears `requesterResolution` without altering `currentStatus`.
18. Validation failures provide safe feedback.
19. Material Lab 3 ticket changes append the required TicketEvent records.
20. Existing TicketEvent history remains intact.

### Administrator User Management

Planned Administrator tests shall verify:

1. Administrator can retrieve the user list.
2. User list provides Name, Email, Role, Status, and Edit capability.
3. Search by name returns matching users.
4. Search by email returns matching users.
5. Permitted role filter returns matching users.
6. Administrator can create a valid user.
7. New user has exactly one permitted role.
8. New user must change the initial password at first login.
9. Duplicate email is rejected.
10. Invalid user input is rejected.
11. Administrator can edit permitted name, email, role, and activation information.
12. Administrator can set a new initial password.
13. Reset initial password requires change at next login.
14. Administrator cannot deactivate their own account.
15. System prevents an operation that would leave no active Administrator.
16. Requester cannot access User Management.
17. IT Staff cannot access User Management.
18. Forbidden direct API requests are rejected safely.

### Migration and Data Preservation

Planned migration verification shall confirm:

1. Existing Lab 2 Development Requesters are migrated to authenticated Requester users.
2. Existing Requester-to-Ticket ownership relationships are preserved.
3. Existing Ticket records remain valid.
4. Existing Attachment records and metadata remain valid.
5. Existing Category records and integer identifiers remain valid.
6. Existing TicketEvent history remains valid.
7. Migration does not require destructive reset of existing Lab 2 application data.

### End-to-End Workflows

Planned E2E verification shall cover:

1. Valid login and authenticated navigation.
2. Invalid login feedback.
3. Mandatory first-password change.
4. Logout followed by blocked protected access.
5. Authenticated Requester workflow after migration.
6. IT Staff queue search/filter and open-detail flow.
7. IT Staff ticket claim or permitted assignment flow.
8. IT Staff priority and permitted status update flow.
9. Public Comment and Internal Note behavior.
10. Administrator user creation flow.
11. Administrator user editing or activation flow.
12. Initial-password/reset-password behavior for an administered user.
13. Required role-access boundaries.

### Visual and Responsive Verification

Manual visual checks shall verify each major Lab 3 screen at desktop, tablet, and mobile widths.

The checklist shall confirm:

1. Zen Green design consistency.
2. Role navigation is clear and appropriate.
3. Status and IT Priority badges are visually consistent.
4. Editable and read-only fields are distinguishable.
5. Validation appears near the relevant input or action.
6. Keyboard focus is visible.
7. Buttons and controls remain usable.
8. Content is not unintentionally clipped.
9. Elements do not overlap.
10. No unintended horizontal overflow is present.
11. Loading, empty, no-results, validation, and failure states remain understandable.

## 5. Test Execution and Final Status

This section shall be updated as Lab 3 implementation and verification are completed. Planned tests shall not be marked as passed until the corresponding implementation has been executed and verified.

### Actual Test Files

Actual Lab 3 test files shall be recorded here after implementation.

| Test Area | Actual Test File(s) | Final Status |
|---|---|---|
| Authentication | To be completed | Planned |
| Authorization | To be completed | Planned |
| Requester Regression | To be completed | Planned |
| IT Staff Queue | To be completed | Planned |
| IT Staff Ticket Detail | To be completed | Planned |
| Public Comments / Internal Notes | To be completed | Planned |
| Administrator User Management | To be completed | Planned |
| Migration / Data Preservation | To be completed | Planned |
| Client / UI | To be completed | Planned |
| End-to-End | To be completed | Planned |
| Visual / Responsive | To be completed | Planned |

### Final Automated Test Results

The following results shall be recorded from the final release-ready code:

- Server unit tests: Pending
- Server API/integration tests: Pending
- Authentication tests: Pending
- Authorization tests: Pending
- Lab 2 regression tests: Pending
- Client/UI tests: Pending
- Lab 3 E2E tests: Pending
- Server production build: Pending
- Client production build: Pending

### Acceptance-Criteria Completion

The AC traceability table in Section 3 shall be updated during implementation so that:

- Planned test paths are replaced or supplemented with actual test-file paths where necessary.
- Each acceptance criterion receives a final verification status.
- Any changed test approach is documented rather than silently diverging from the original plan.
- No required acceptance criterion remains `Planned` when Lab 3 is declared complete.

### Final Verification Rule

Lab 3 shall be considered test-complete only when:

1. Required automated tests pass from the final integrated code.
2. Required direct API authorization checks pass.
3. Lab 2 Requester regression behavior passes.
4. Required E2E workflows pass.
5. Desktop, tablet, and mobile visual verification is complete.
6. All AC-01 through AC-41 have recorded final verification.
7. No unresolved required test failure remains.