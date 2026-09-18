# Lab 3 Engineering Specification

## 1. Sprint Goal

Evolve the existing TokTickIT Requester ticketing system into a role-based service desk application with real authentication, IT Staff workflows, and basic Administrator user management while preserving the working Lab 2 Requester features and existing data.

## 2. Stakeholder Request

TokTickIT needs to replace the temporary Development Requester selection used in Lab 2 with real user authentication. The system must support three roles: Requester, IT Staff, and Administrator.

Requesters must continue to create and manage their own tickets using their authenticated identity. IT Staff need a ticket queue and Ticket Detail interface for handling tickets, including assignment, priority, status, Public Comments, and Internal Notes. Administrators need a basic User Management interface for creating and maintaining user accounts.

Existing Lab 2 Requesters must be migrated to real users without losing their ticket ownership, Ticket data, or Attachment data.

## 3. Scope

### In Scope

- Real user authentication
- Login and logout
- Mandatory first-password change
- Active and inactive user handling
- Requester, IT Staff, and Administrator roles
- Migration of existing Development Requesters to authenticated users
- Preservation of existing Ticket ownership and Attachment data
- Removal of the temporary Development Requester selector
- Authenticated Requester ticket workflows
- Role-based authorization
- IT Staff ticket queue
- Ticket search, filtering, sorting, and pagination
- IT Staff Ticket Detail
- Ticket claim and permitted reassignment
- IT Priority management
- Permitted ticket status changes
- Public Comments
- Internal Notes
- Existing attachment functionality
- Requester resolution indication
- Basic Administrator User Management
- Automated unit, API/integration, authorization, regression, UI, and E2E testing
- Zen Green responsive UI verification

### Out of Scope

- User deletion
- Multiple roles for one user
- Advanced identity or authentication features
- Actions Taken
- SLA management
- Escalation workflows
- Notification workflows
- Other Lab 4 functionality
- Unnecessary expansion of reference data

## 4. Functional Requirements

### Authentication

**FR-01 — User Login**  
The system shall allow an active user to log in using their registered email and password.

**FR-02 — Invalid Login Handling**  
The system shall reject invalid credentials with safe feedback that does not expose sensitive authentication details.

**FR-03 — Inactive Account Handling**  
The system shall prevent inactive users from logging in.

**FR-04 — Mandatory Password Change**  
The system shall require users with an initial password to change their password before accessing normal authenticated features.

**FR-05 — Authenticated User Context**  
The system shall maintain the authenticated user's identity and role and make them available to authorized application features.

**FR-06 — Logout**  
The system shall allow an authenticated user to log out and shall block authenticated routes and APIs after logout.

### Requester

**FR-07 — Authenticated Requester Identity**  
The system shall use the authenticated Requester identity instead of the temporary Development Requester selector from Lab 2.

**FR-08 — Requester Ticket Creation**  
An authenticated Requester shall be able to create a ticket under their own identity.

**FR-09 — Requester Ticket Access**  
An authenticated Requester shall be able to view only tickets they own.

**FR-10 — Requester Ticket Detail and Attachments**  
Existing Lab 2 Ticket Detail and Attachment functionality shall continue to work for the authenticated ticket owner.

### Authorization

**FR-11 — Role-Based Access**  
The system shall enforce access according to the Requester, IT Staff, and Administrator roles at both UI and API levels.

**FR-12 — Unauthorized Access**  
The system shall reject attempts to access features or perform operations that are not permitted for the authenticated user's role.

### IT Staff Ticket Queue

**FR-13 — Staff Ticket Queue**  
An authenticated IT Staff user shall be able to view the IT Staff ticket queue.

**FR-14 — Queue Search and Filters**  
The IT Staff queue shall support ticket search and the required filtering controls.

**FR-15 — Queue Sorting and Pagination**  
The IT Staff queue shall support deterministic sorting and pagination.

**FR-16 — Queue Ticket Information**  
The queue shall clearly display relevant ticket information, including ticket number, requester, category, status, IT Priority, and assignment state.

**FR-17 — Open Ticket Detail**  
IT Staff shall be able to open an authorized Ticket Detail from the queue.

### IT Staff Ticket Detail and Operations

**FR-18 — Ticket Claim and Reassignment**  
Authorized IT Staff shall be able to claim unassigned tickets and perform permitted ticket reassignment.

**FR-19 — IT Priority**  
Authorized IT Staff shall be able to set or update a ticket's IT Priority.

**FR-20 — Ticket Status**  
Authorized IT Staff shall be able to perform only permitted ticket status transitions.

**FR-21 — Public Comments**  
Authorized users shall be able to add and view Public Comments according to their role permissions.

**FR-22 — Internal Notes**  
Authorized IT Staff shall be able to add and view Internal Notes, while Requesters shall not have access to Internal Notes.

**FR-23 — Attachment Continuity**  
Existing attachment functionality shall remain available according to the applicable Lab 3 role and ownership rules.

**FR-24 — Requester Resolution Indication**  
The Ticket Detail interface shall display the required Requester resolution indication.

**FR-25 — Ticket Event History**  
Material ticket operations required by Lab 3 shall be recorded in the existing append-only ticket event history where applicable.

### Administrator User Management

**FR-26 — User List**  
An authenticated Administrator shall be able to view users with Name, Email, Role, Status, and an Edit action.

**FR-27 — User Search and Filter**  
The Administrator shall be able to search users by name or email and use the permitted role filter.

**FR-28 — Create User**  
The Administrator shall be able to create a user with valid account information, exactly one permitted role, and an initial password.

**FR-29 — Edit User**  
The Administrator shall be able to edit a user's permitted name, email, role, and activation status.

**FR-30 — Reset Initial Password**  
The Administrator shall be able to set a new initial password that requires the user to change it at the next login.

**FR-31 — Administrator Safety Rules**  
The system shall prevent an Administrator from deactivating their own account and prevent removal of the last active Administrator.

### User Interface and Verification

**FR-32 — Safe UI States**  
Lab 3 interfaces shall provide appropriate loading, validation, empty or no-results, and safe failure feedback where applicable.

**FR-33 — Responsive Zen Green UI**  
Major Lab 3 screens shall follow the existing Zen Green design direction and remain usable on desktop, tablet, and mobile layouts.

## 5. Business Rules

### Authentication and Accounts

**BR-01 — Unique Email**  
Each user account shall have a unique email address.

**BR-02 — Secure Password Storage**  
Passwords shall never be stored as plain text and shall be stored using secure password hashing.

**BR-03 — Active Account Requirement**  
Only active users may authenticate and access protected application features.

**BR-04 — Initial Password Change**  
A user with an initial or reset password must change it before accessing normal authenticated features.

**BR-05 — Session Termination**  
After logout, the previous authenticated session shall no longer provide access to protected routes or APIs.

### Roles and Authorization

**BR-06 — Single Role**  
Each user shall have exactly one role: Requester, IT Staff, or Administrator.

**BR-07 — Server-Side Authorization**  
Authorization shall be enforced by the backend. Hiding an action in the UI alone is not sufficient authorization.

**BR-08 — Requester Ownership**  
Requesters may access only tickets and attachments permitted by their authenticated identity and ticket ownership.

**BR-09 — IT Staff Access**  
IT Staff may access staff ticket-management features permitted by the Lab 3 authorization rules.

**BR-10 — Administrator Access**  
User Management operations are restricted to Administrators.

### Ticket Management

**BR-11 — Preserved Requester Ownership**  
Migration from Lab 2 shall preserve the relationship between existing Requesters and their existing Tickets.

**BR-12 — Preserved Existing Data**  
Lab 3 migration shall preserve existing Ticket and Attachment data.

**BR-13 — Ticket Claim**  
An authorized IT Staff user may claim an unassigned ticket according to the permitted assignment rules.

**BR-14 — Ticket Reassignment**  
Ticket reassignment shall be limited to authorized users and valid assignment targets.

**BR-15 — IT Priority**  
IT Priority shall use only the values permitted by the Lab 3 specification.

**BR-16 — Status Transition**  
Ticket status changes shall follow the permitted Lab 3 status workflow. Invalid transitions shall be rejected.

**BR-17 — Public Comments**  
Public Comments shall be visible according to the permitted ticket-access rules and shall not contain Internal Notes.

**BR-18 — Internal Notes**  
Internal Notes shall be restricted to authorized staff and shall never be exposed to Requesters.

**BR-19 — Attachment Authorization**  
Attachment access and permitted attachment operations shall be authorized using the current authenticated user and applicable ticket-access rules.

**BR-20 — Ticket Event History**  
Material Lab 3 ticket changes shall create append-only ticket events where required. Existing event history shall not be rewritten.

### Administrator User Management

**BR-21 — User Creation Role**  
An Administrator may assign exactly one permitted role when creating a user.

**BR-22 — Duplicate Email**  
The system shall reject creation or editing that would produce a duplicate user email.

**BR-23 — Initial Password for New Users**  
A newly created user shall receive an initial password and shall be required to change it at first login.

**BR-24 — Password Reset by Administrator**  
When an Administrator sets a new initial password for a user, that user shall be required to change it at the next login.

**BR-25 — Self-Deactivation Protection**  
An Administrator shall not be allowed to deactivate their own account.

**BR-26 — Last Administrator Protection**  
The system shall not allow an operation that would leave TokTickIT without an active Administrator.

### Migration and Compatibility

**BR-27 — Requester Migration**  
Existing Lab 2 Development Requesters shall be migrated to authenticated Requester users without breaking their existing ownership relationships.

**BR-28 — Temporary Selector Removal**  
After authentication is introduced, the Lab 2 Development Requester selector and client-side requester-selection mechanism shall no longer determine the active user.

**BR-29 — Lab 2 Regression Protection**  
Existing Lab 2 Requester ticket creation, My Tickets, Ticket Detail, and Attachment behavior shall continue to work under authenticated Requester identity.

**BR-30 — Scope Control**  
Lab 3 shall not introduce user deletion, multiple simultaneous roles, SLA management, escalation, notification workflows, Actions Taken, or other functionality reserved for later increments.

## 6. UI Summary

Lab 3 shall extend the existing Zen Green interface while replacing the temporary Development Requester selection with authenticated, role-based navigation.

### Login

- Email and password fields
- Login action
- Busy state while authentication is processing
- Safe feedback for invalid credentials or inactive accounts
- Successful login routes the user according to their authenticated role

### Change Password

- Shown when an authenticated user is required to change an initial or reset password
- New password and confirmation fields
- Validation and safe failure feedback
- Normal authenticated features remain unavailable until the required password change is completed

### Authenticated Navigation

- Clearly display the authenticated user's identity and role
- Show navigation appropriate to the user's role
- Provide logout
- Do not expose navigation to unauthorized features

### Requester Screens

The existing Lab 2 Requester screens shall remain available under authenticated Requester identity:

- Create Ticket
- My Tickets
- Requester Ticket Detail
- Attachment functionality

The temporary Development Requester selector shall be removed.

### IT Staff Ticket Queue

- Display realistic ticket data
- Show ticket number, requester, category, status, IT Priority, and assignment state
- Provide search
- Provide required filters
- Provide deterministic sorting
- Provide pagination
- Use clear status and priority badges
- Provide an action to open Ticket Detail
- Provide loading, empty, no-results, and safe failure states

### IT Staff Ticket Detail

- Display ticket information and current ownership
- Provide permitted claim and reassignment controls
- Provide IT Priority control
- Provide permitted status-change controls
- Display and add Public Comments
- Display and add Internal Notes for authorized staff
- Preserve applicable Attachment functionality
- Display the Requester resolution indication
- Clearly distinguish editable and read-only information
- Provide validation and safe failure feedback

### Administrator User Management

- Display Name, Email, Role, Status, and Edit action
- Search users by name or email
- Provide the permitted role filter
- Create a user with exactly one permitted role and an initial password
- Edit permitted name, email, role, and activation status
- Allow an Administrator to set a new initial password
- Show validation for duplicate email and invalid input
- Enforce self-deactivation and last-active-Administrator protections
- Provide safe failure feedback

### Responsive and Visual Requirements

All major Lab 3 screens shall:

- Follow the existing Zen Green visual direction
- Remain usable at desktop, tablet, and mobile widths
- Keep role navigation clear
- Use consistent status and priority badges
- Clearly distinguish editable and read-only fields
- Place validation feedback near the relevant input or action
- Maintain visible keyboard focus
- Avoid unintended clipping, overlap, and horizontal overflow

## 7. Data Changes

Lab 3 shall extend the existing Lab 2 data model rather than replace it. Existing Requester ownership, Tickets, Attachments, Categories, and Ticket Events must remain valid after migration.

### User Migration

- Replace the Lab 2 Development Requester concept with a persistent authenticated User model.
- Migrate each existing Development Requester to a User with the Requester role.
- Preserve the relationship between each migrated Requester and their existing Tickets.
- Seed additional realistic users for the IT Staff and Administrator roles.
- Each User shall have exactly one role: Requester, IT Staff, or Administrator.
- User records shall support active/inactive status.
- User records shall store only securely hashed passwords.
- User records shall support a flag or equivalent mechanism indicating that a password change is required.

### Ticket Changes

The existing Ticket model shall be extended only as required for Lab 3.

Required Lab 3 ticket data shall support:

- IT Staff assignment or an unassigned state
- IT Priority
- Lab 3 ticket status workflow
- Requester resolution indication
- Existing Requester ownership
- Existing Category relationship
- Existing Ticket Event history

Existing ticket records shall remain valid after migration.

### Comments and Internal Notes

Lab 3 shall persist ticket communication required by the staff workflow.

The data model shall distinguish between:

- Public Comments, which are available according to permitted ticket access
- Internal Notes, which are restricted to authorized staff

The backend shall enforce this distinction so Internal Notes cannot be exposed to Requesters.

### Attachments

The existing Lab 2 Attachment model and stored attachment data shall be preserved.

Lab 3 shall adapt attachment authorization to authenticated users and roles without unnecessarily replacing the existing attachment storage design.

### Categories

The existing Lab 1 and Lab 2 Category model shall remain compatible with the current database.

The existing integer Category identifier shall not be changed merely to match the UUID identifiers used by newer entities.

### Ticket Events

The existing append-only TicketEvent approach shall be preserved.

Material Lab 3 ticket operations shall add event records where required rather than modifying or deleting historical event records.

### Migration Requirements

The Lab 3 database migration shall:

1. Preserve existing Category records and identifiers.
2. Preserve existing Ticket records.
3. Preserve existing Attachment records and metadata.
4. Preserve existing TicketEvent history.
5. Migrate existing Development Requesters to authenticated Requester users.
6. Preserve existing Requester-to-Ticket ownership relationships.
7. Add only the schema changes required for Lab 3.
8. Avoid destructive reset or reseeding of existing Lab 2 application data.

## 8. API Contract

Lab 3 shall continue using the existing `/api/v1` REST API convention. JSON responses shall use camelCase fields, timestamps shall use ISO UTC format, and authentication or authorization failures shall return safe responses without exposing sensitive information.

### Authentication

Required authentication operations shall support:

- Login with email and password
- Logout
- Retrieve the current authenticated user and role
- Change a required initial or reset password
- Reject invalid credentials safely
- Reject inactive accounts
- Reject protected requests without valid authentication

### Requester APIs

Existing Lab 2 Requester APIs shall be adapted to use the authenticated Requester identity instead of a client-selected requester.

The server shall:

- Determine Requester identity from authentication
- Preserve Create Ticket behavior
- Preserve My Tickets ownership isolation
- Preserve authorized Ticket Detail behavior
- Preserve authorized Attachment behavior
- Reject attempts to supply or impersonate another Requester identity

### IT Staff Queue APIs

The IT Staff API shall support:

- Retrieving the ticket queue
- Search
- Required filters
- Deterministic sorting
- Pagination
- Assigned and unassigned ticket information
- Status and IT Priority information

Queue endpoints shall require appropriate IT Staff authorization.

### IT Staff Ticket Detail APIs

Authorized staff operations shall support:

- Retrieve Ticket Detail
- Claim an unassigned ticket
- Perform permitted reassignment
- Update IT Priority
- Perform permitted status transitions
- Add and retrieve Public Comments
- Add and retrieve Internal Notes
- Access permitted Attachments
- Retrieve the Requester resolution indication

The backend shall validate each operation and reject unauthorized or invalid requests.

### Administrator User APIs

Administrator-only operations shall support:

- List users
- Search users by name or email
- Apply the permitted role filter
- Create a user
- Edit permitted user information
- Activate or deactivate a user
- Set a new initial password

The backend shall enforce:

- Unique email addresses
- Valid input
- Exactly one permitted role per user
- Self-deactivation protection
- Last-active-Administrator protection
- Required password change after an initial password is created or reset

### Authorization and Error Handling

Protected API operations shall enforce authorization on the server regardless of whether the corresponding UI control is visible.

API responses shall distinguish appropriately between:

- Unauthenticated requests
- Authenticated but forbidden requests
- Invalid input
- Missing resources
- Conflicting operations
- Unexpected server failures

Error responses shall be safe for display and shall not expose password hashes, credentials, stack traces, or other sensitive implementation details.

### Detailed Endpoint Contract

Exact HTTP methods, endpoint paths, request DTOs, response DTOs, validation rules, and status codes shall be defined in `docs/lab-03/api-spec.md` before implementation.

## 9. Acceptance Criteria

### Authentication

**AC-01 — Valid Login**  
Given an active user with valid credentials, when the user logs in, then authentication succeeds and the application provides the authenticated user's identity and role.

**AC-02 — Invalid Login**  
Given invalid credentials, when login is attempted, then authentication is rejected with safe feedback and no authenticated session is created.

**AC-03 — Inactive Account**  
Given an inactive user, when login is attempted, then authentication is rejected and protected application features remain inaccessible.

**AC-04 — Mandatory Password Change**  
Given a user whose password must be changed, when the user logs in successfully, then normal authenticated features remain unavailable until a valid new password is set.

**AC-05 — Authenticated Identity and Role**  
Given an authenticated user, then the application displays or otherwise provides the correct user identity and role for authorized navigation and operations.

**AC-06 — Logout and Protected Access**  
Given an authenticated user who logs out, when a protected route or API is accessed afterward, then access is rejected.

### Requester Regression and Authorization

**AC-07 — Authenticated Requester Ticket Creation**  
Given an authenticated Requester, when a valid ticket is created, then the ticket is owned by that authenticated Requester without using a client-selected requester identity.

**AC-08 — Requester Ownership Isolation**  
Given an authenticated Requester, when My Tickets is viewed, then only tickets owned by that Requester are returned.

**AC-09 — Requester Ticket Detail Isolation**  
Given an authenticated Requester, when attempting to access another Requester's ticket, then access is rejected safely.

**AC-10 — Requester Attachment Authorization**  
Given an authenticated Requester, attachment access and permitted attachment operations succeed only when allowed by the Requester's ticket ownership.

**AC-11 — Role-Based Authorization**  
Given a protected Lab 3 feature or API, when it is accessed by a role without permission, then the operation is rejected even if the API is called directly.

### IT Staff Ticket Queue

**AC-12 — Staff Queue Access**  
Given an authenticated IT Staff user, when the ticket queue is opened, then realistic ticket data and the required ticket information are displayed.

**AC-13 — Queue Search**  
Given multiple tickets, when IT Staff performs a supported search, then the queue returns only matching results.

**AC-14 — Queue Filters**  
Given multiple tickets, when a supported queue filter is applied, then only tickets matching the selected filter are returned.

**AC-15 — Queue Sorting**  
Given multiple tickets, when a supported sort is selected, then tickets are returned in a deterministic order.

**AC-16 — Queue Pagination**  
Given more tickets than fit on one page, when pagination is used, then the correct page of tickets is returned without unintended duplication or omission.

**AC-17 — Queue Ownership and Badges**  
The queue clearly indicates assigned or unassigned ownership and displays the required status and IT Priority badges.

**AC-18 — Queue UI States and Detail Navigation**  
The queue provides loading, empty or no-results, and safe failure feedback where applicable, and an authorized ticket can be opened in Ticket Detail.

### IT Staff Ticket Detail and Operations

**AC-19 — Claim Ticket**  
Given an authorized IT Staff user and an unassigned ticket, when the ticket is claimed, then the permitted ownership change is persisted.

**AC-20 — Reassign Ticket**  
Given an authorized IT Staff user, when a valid reassignment is performed, then the new permitted assignment is persisted; invalid or unauthorized reassignment is rejected.

**AC-21 — IT Priority**  
Given an authorized IT Staff user, when a valid IT Priority is selected, then the priority is persisted; invalid values are rejected.

**AC-22 — Status Workflow**  
Given an authorized IT Staff user, when a permitted status transition is performed, then the new status is persisted; invalid transitions are rejected.

**AC-23 — Public Comments**  
Given an authorized user, when a valid Public Comment is added, then it is persisted and visible according to the permitted ticket-access rules.

**AC-24 — Internal Notes**  
Given an authorized IT Staff user, when an Internal Note is added, then it is persisted and available to authorized staff but is not exposed to Requesters.

**AC-25 — Staff Attachment Continuity**  
Given an authorized Lab 3 user, existing Attachment functionality continues to work according to the applicable role and ticket-access rules.

**AC-26 — Requester Resolution Indication**  
Given a ticket with Requester resolution information, when its Ticket Detail is viewed, then the required resolution indication is displayed.

**AC-27 — Ticket Operation Authorization and Validation**  
Invalid, forbidden, or conflicting Ticket Detail operations are rejected safely by the backend and produce appropriate UI feedback.

**AC-28 — Ticket Event Continuity**  
Material Lab 3 ticket changes create the required append-only event records without rewriting existing TicketEvent history.

### Administrator User Management

**AC-29 — User List and Search**  
Given an authenticated Administrator, when User Management is opened, then Name, Email, Role, Status, and Edit are available, and users can be searched by name or email.

**AC-30 — User Role Filter**  
Given multiple users, when the permitted role filter is applied, then the list shows users matching that role.

**AC-31 — Create User**  
Given valid user information, exactly one permitted role, and an initial password, when an Administrator creates the user, then the account is created and requires a password change at first login.

**AC-32 — User Validation**  
Duplicate email and invalid user input are rejected with appropriate validation feedback.

**AC-33 — Edit User**  
Given an existing user, an Administrator can update permitted name, email, role, and activation information and the valid changes are persisted.

**AC-34 — Reset Initial Password**  
Given an existing user, when an Administrator sets a new initial password, then the user must change that password at the next login.

**AC-35 — Administrator Safety Rules**  
An Administrator cannot deactivate their own account or perform an operation that would leave the system without an active Administrator.

**AC-36 — Administrator Authorization**  
Given a non-Administrator user, when User Management UI or APIs are accessed, then access is rejected.

### Migration, Regression, and UI

**AC-37 — Existing Requester Migration**  
After the Lab 3 migration, existing Lab 2 Development Requesters exist as authenticated Requester users and retain ownership of their existing tickets.

**AC-38 — Existing Data Preservation**  
After migration, existing Ticket, Attachment, Category, and TicketEvent data remain available and valid.

**AC-39 — Lab 2 Requester Regression**  
After authentication migration, the existing Create Ticket, My Tickets, Ticket Detail, and Attachment workflows continue to work for authenticated Requesters.

**AC-40 — Responsive Zen Green UI**  
Login, Change Password, Requester screens, IT Staff queue, IT Staff Ticket Detail, and Administrator User Management remain usable and visually consistent with Zen Green at required desktop, tablet, and mobile widths.

**AC-41 — Visual Quality and Feedback**  
Major Lab 3 screens provide appropriate validation and safe failure feedback, visible focus, clear role navigation, consistent badges and field states, and no unintended clipping, overlap, or horizontal overflow.

## 10. Product Definition of Done

Lab 3 is considered complete only when all required functionality is implemented, verified, reviewed, and integrated without breaking the existing Lab 2 increment.

### Specification and Traceability

- The Lab 3 engineering contract was completed before the main implementation work.
- Functional requirements and business rules are documented.
- Authentication and authorization rules are documented.
- Migration decisions are documented.
- Every acceptance criterion maps to planned verification in `docs/lab-03/tests.md`.
- Detailed UI and API contracts are documented before implementation.

### Implementation

- Real authentication replaces the temporary Development Requester selection.
- Existing Development Requesters are migrated to authenticated Requester users.
- Existing Requester ownership and Lab 2 data are preserved.
- Requester workflows operate using authenticated identity.
- Role-based authorization is enforced by the backend.
- Login, logout, and mandatory password change are complete.
- IT Staff Ticket Queue is complete.
- IT Staff Ticket Detail and required operations are complete.
- Administrator User Management is complete.
- Required migration and seed data are complete.

### Testing

- Required unit tests pass.
- Required API/integration tests pass.
- Authentication tests pass.
- Authorization tests, including direct API authorization checks, pass.
- Required client/UI tests pass.
- Lab 2 Requester regression tests pass.
- Required Lab 3 E2E tests pass.
- Every acceptance criterion has a final verification status.

### UI and Visual Verification

- Zen Green styling remains consistent across Lab 3.
- Major Lab 3 screens are verified at desktop, tablet, and mobile widths.
- Role-based navigation is clear.
- Status and priority badges are consistent.
- Editable and read-only fields are clearly distinguished.
- Validation feedback is placed appropriately.
- Keyboard focus is visible.
- No unintended clipping, overlap, or horizontal overflow remains.
- Required loading, empty, no-results, validation, and safe failure states are verified.

### Engineering Workflow and Release

- Lab 3 work is tracked through GitHub Issues.
- Implementation is completed on feature branches rather than directly on `main`.
- Feature work is integrated through `lab3-staging`.
- Required pull requests receive peer review and approval.
- `docs/lab-03/reviewer.md` records the required review evidence.
- `docs/lab-03/ai-use.md` records selected AI use and reflection.
- README and `.gitignore` are updated where required.
- Server and client production builds pass.
- Final automated test suites pass from the release-ready code.
- The final working tree is clean.
- All Lab 3 Issues are complete before final integration to `main`.

## 11. Assumptions and Decisions

### AD-01 — Lab 2 Is the Baseline

Lab 3 extends the completed Lab 2 application. Existing working Requester functionality and data shall be preserved unless Lab 3 explicitly requires a change.

### AD-02 — Authentication Replaces Requester Selection

The temporary Development Requester selector from Lab 2 is a development mechanism only. Lab 3 shall replace it with authenticated user identity rather than maintaining both mechanisms.

### AD-03 — Three Single Roles

Lab 3 supports exactly three roles: Requester, IT Staff, and Administrator. Each user has exactly one role.

### AD-04 — Backend Is the Authorization Authority

The server is the source of truth for authentication and authorization. Client-side route guards and hidden controls improve the UI but shall not be treated as security enforcement.

### AD-05 — Existing Ownership Must Survive Migration

Migration shall preserve the connection between existing Lab 2 Requesters and their Tickets. Existing Ticket, Attachment, Category, and TicketEvent data shall not be discarded to simplify implementation.

### AD-06 — Existing Category Identifier Is Preserved

The existing Category model uses an integer identifier. Lab 3 shall preserve this design unless a genuine technical requirement requires a migration; UUID use by newer entities does not by itself justify changing Category IDs.

### AD-07 — Existing Attachment Design Is Reused

Lab 3 shall continue the existing attachment storage and metadata approach. Authentication and authorization shall be adapted to the new User model rather than redesigning attachment storage without a Lab 3 requirement.

### AD-08 — Ticket Events Remain Append-Only

Existing TicketEvent history shall be preserved. Required Lab 3 material ticket changes shall add new events rather than rewrite historical events.

### AD-09 — API Version Remains v1

Lab 3 shall continue using the existing `/api/v1` API namespace unless an implementation constraint requires a documented change.

### AD-10 — Exact Technical Details Belong in Detailed Contracts

This system specification defines required behavior. Exact endpoint paths, DTOs, status codes, UI component behavior, schema field names, and detailed test cases shall be finalized in `api-spec.md`, `ui-spec.md`, and `tests.md` before implementation.

### AD-11 — Safe Errors

Authentication, authorization, validation, and unexpected failures shall provide useful but safe feedback. Sensitive credentials, password hashes, stack traces, and unnecessary internal details shall not be exposed to users.

### AD-12 — Zen Green Continues

Lab 3 shall extend the existing Zen Green visual direction rather than introduce a separate visual system for the new role-based interfaces.

### AD-13 — Responsive Evidence Covers Major Screens

Responsive verification shall cover Login, Change Password, the major authenticated Requester screens, IT Staff Ticket Queue, IT Staff Ticket Detail, and Administrator User Management at the required desktop, tablet, and mobile widths.

### AD-14 — Lab 4 Scope Is Deferred

Actions Taken, SLA management, escalation, notification workflows, user deletion, multiple simultaneous roles, advanced identity management, and other later-increment functionality are intentionally excluded from Lab 3.

### AD-15 — Contract Changes Must Be Documented

If implementation reveals that an engineering-contract decision must change, the relevant Lab 3 contract document shall be updated deliberately with the reason for the change rather than silently allowing implementation to diverge from the specification.