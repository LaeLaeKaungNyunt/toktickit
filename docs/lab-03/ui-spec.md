# Lab 3 UI Specification

## 1. UI Direction

Lab 3 shall extend the existing TokTickIT Zen Green design established in Lab 2. New authentication, IT Staff, and Administrator interfaces shall feel like part of the same application rather than a separate visual system.

The interface shall prioritize:

- Clear role-based navigation
- Simple and readable layouts
- Consistent Zen Green styling
- Clear status and IT Priority indicators
- Clear distinction between editable and read-only information
- Safe and understandable feedback
- Responsive behavior across desktop, tablet, and mobile widths
- Accessible keyboard focus and usable controls

### Zen Green Visual Continuity

The existing Lab 2 visual direction shall remain the baseline:

- Primary green: `#006B3C`
- Secondary green: `#0B7A46`
- Pale green: `#EAF6EF`
- Bootstrap-based layout and components
- Consistent spacing, typography, cards, forms, buttons, and feedback patterns

New Lab 3 screens shall reuse existing visual patterns where practical instead of introducing unnecessary new styles.

## 2. Global Layout and Navigation

### Authenticated Header

After authentication, the application shall clearly show:

- TokTickIT identity
- Authenticated user's name or appropriate identity
- Authenticated user's role
- Navigation permitted for that role
- Logout action

### Role-Based Navigation

**Requester navigation** shall provide access to the existing Requester workflow, including:

- Create Ticket
- My Tickets

**IT Staff navigation** shall provide access to:

- IT Staff Ticket Queue

Ticket Detail shall normally be reached from the queue.

**Administrator navigation** shall provide access to:

- User Management

Navigation items that the authenticated role cannot use shall not be presented as available actions.

Backend authorization remains required even when a navigation item or UI action is hidden.

### Unauthenticated Layout

Unauthenticated users shall be directed to the Login interface rather than seeing protected application content.

### Mandatory Password Change

A user who must change an initial or reset password shall be directed to the Change Password interface before normal authenticated navigation becomes available.

### Logout Behavior

After logout:

- Authenticated user information shall be cleared from the client.
- Protected application content shall no longer be displayed.
- Direct navigation to a protected route shall not restore access.
- The user shall be returned to an appropriate unauthenticated state.

### Global Feedback

Where applicable, screens shall provide:

- Loading or busy feedback
- Validation feedback near the relevant input or action
- Empty or no-results feedback
- Safe failure feedback
- Disabled or protected actions where appropriate

Feedback shall not expose sensitive authentication, authorization, or server implementation details.

## 3. Login and Change Password

### Login Screen

The Login screen shall provide a simple entry point for all TokTickIT users.

Required elements:

- TokTickIT heading or branding
- Email field
- Password field
- Login button
- Appropriate validation and authentication feedback

The screen shall not include the Lab 2 Development Requester selector.

### Login States

**Default**
- Email and password fields are available.
- Login action is clearly visible.

**Busy**
- Login action indicates that authentication is processing.
- Repeated submission is prevented while the request is in progress.

**Invalid Credentials**
- Safe authentication feedback is displayed.
- The message shall not reveal sensitive account information.

**Inactive Account**
- Access is denied.
- Safe feedback is displayed without exposing unnecessary account details.

**Success**
- The authenticated user's identity and role become available.
- A user who does not require a password change proceeds to their permitted authenticated interface.
- A user who requires a password change proceeds to Change Password first.

### Change Password Screen

The Change Password screen shall be shown when an authenticated user is required to replace an initial or reset password.

Required elements:

- Clear explanation that a password change is required
- New password field
- Confirm new password field
- Submit/change-password action
- Validation feedback

Normal authenticated features shall not be available until the required password change succeeds.

### Change Password States

**Default**
- Required password fields and action are available.

**Validation**
- Missing, invalid, or mismatched password input is identified near the relevant fields.

**Busy**
- The action indicates processing.
- Repeated submission is prevented.

**Failure**
- Safe failure feedback is displayed.
- Sensitive server or authentication details are not exposed.

**Success**
- The password-change requirement is cleared.
- The user proceeds to the interface permitted for their authenticated role.

### Authenticated User and Role Display

After authentication and completion of any required password change, the application shall clearly display the current user's identity and role within the authenticated layout.

### Logout

A visible Logout action shall be available from the authenticated interface.

After logout:

- Protected content shall no longer be available.
- The authenticated identity and role shall no longer be displayed.
- Direct access to protected routes shall be blocked.

### Responsive Behavior

Login and Change Password shall remain usable on desktop, tablet, and mobile widths.

Forms shall:

- Remain readable without horizontal scrolling
- Keep labels, fields, validation, and actions visible
- Avoid clipped or overlapping controls
- Maintain visible keyboard focus

## 4. IT Staff Ticket Queue

The IT Staff Ticket Queue shall provide authorized IT Staff with a clear overview of service tickets and efficient controls for finding and opening tickets.

### Queue Content

Each queue item or row shall clearly present the information required to identify and understand the ticket, including:

- Ticket number
- Requester
- Category
- Status
- IT Priority
- Assigned IT Staff or Unassigned state
- Open-detail action

Additional existing ticket information may be shown when useful without making the queue unnecessarily crowded.

### Search

The queue shall provide a visible search control.

Search shall:

- Accept the supported ticket search input
- Update the displayed results appropriately
- Provide clear no-results feedback when nothing matches
- Remain usable at desktop, tablet, and mobile widths

### Filters

Required queue filters shall be clearly labeled and easy to understand.

The interface shall:

- Show the currently selected filter values
- Allow supported filters to be changed or cleared
- Update the displayed results to match the selected filters

### Sorting

The queue shall provide the supported sorting controls.

The selected sort shall be visible or understandable to the user, and the displayed order shall remain deterministic.

### Pagination

When results exceed one page, pagination controls shall:

- Show that additional results are available
- Allow navigation between available pages
- Keep controls usable at responsive widths
- Avoid unnecessary horizontal overflow

### Ownership

Ticket ownership shall be clearly distinguishable.

The interface shall show:

- Assigned IT Staff when assigned
- A clear Unassigned state when no IT Staff owns the ticket

### Status and IT Priority Badges

Status and IT Priority shall use consistent badge treatment.

Badges shall:

- Display supported status values from the exact eight Lab 3 statuses: `New`, `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`, `Reopened`, and `Cancelled` (obsolete `"On Hold"` is removed).
- Be readable without relying only on color.
- Follow the Zen Green visual system where appropriate.
- Remain consistent between the queue and Ticket Detail.

### Open Ticket Detail

Each ticket shall provide a clear action for opening its Ticket Detail.

The action shall be usable without requiring the user to guess that unrelated content is clickable.

### Queue States

**Loading**
- The interface clearly indicates that ticket data is being retrieved.

**Empty**
- If no tickets exist, an understandable empty-state message is shown.

**No Results**
- If tickets exist but the current search or filters match none, a distinct no-results message is shown.

**Failure**
- A safe failure message is shown.
- The interface shall not expose stack traces or unnecessary server details.

### Responsive Behavior

**Desktop**
- Queue information may use a table or similarly efficient multi-column layout.
- Search, filters, sorting, and pagination should remain easy to access.

**Tablet**
- Controls may wrap or reorganize while keeping important ticket information visible.

**Mobile**
- The queue may use stacked rows/cards or another responsive presentation when a full-width table would cause horizontal overflow.
- Important ticket information and the open-detail action shall remain accessible.

At all required widths, the queue shall avoid unintended clipping, overlap, and horizontal scrolling.

## 5. IT Staff Ticket Detail

The IT Staff Ticket Detail screen shall provide authorized staff with the information and controls required to manage a ticket while clearly separating editable actions from read-only ticket information.

### Ticket Information

The screen shall clearly display relevant ticket information, including:

- Ticket number
- Requester
- Category
- Ticket description and existing details
- Current status
- Current IT Priority
- Current assignment or Unassigned state
- Requester resolution indication
- Existing applicable Attachment information

Read-only information shall be visually distinguishable from editable controls.

### Claim and Reassignment

When permitted, the interface shall provide controls to:

- Claim an unassigned ticket
- Show the current assignee
- Reassign the ticket to a valid permitted IT Staff user

Invalid or unauthorized assignment actions shall not appear as successful and shall provide safe feedback.

### IT Priority

Authorized IT Staff shall be able to select a permitted IT Priority.

The interface shall:

- Clearly show the current priority
- Provide only permitted priority choices
- Indicate when an update is processing
- Display validation or safe failure feedback when required
- Reflect the persisted value after a successful update

### Status

The current ticket status shall be clearly visible.

Formal status-change actions shall be provided only to authorized staff roles (`IT Staff` and `Administrator`) according to the permitted status-transition matrix (`New` -> `Open`/`In Progress`/`Waiting for Requester`/`Cancelled`; `Open` -> `In Progress`/`Waiting for Requester`/`Resolved`/`Cancelled`; `In Progress` -> `Waiting for Requester`/`Resolved`/`Cancelled`; `Waiting for Requester` -> `In Progress`/`Resolved`/`Cancelled`; `Resolved` -> `Closed`/`Reopened`/`In Progress`; `Reopened` -> `In Progress`/`Waiting for Requester`/`Resolved`/`Cancelled`; `Closed`/`Cancelled` are terminal).

Requesters must not directly change `currentStatus` in Issue #26. Requester resolution indication is provided via a separate indication control (`PATCH /api/v1/tickets/:ticketId/resolution`) that updates `requesterResolution` without altering `currentStatus`.

The interface shall:

- Clearly distinguish the current status
- Provide staff with only permitted valid transitions
- Prevent or reject invalid transitions
- Show busy feedback during an update
- Show safe feedback when an update fails
- Reflect the persisted status after success

### Public Comments

The Ticket Detail screen shall provide a Public Comments section for users permitted to participate in public ticket communication.

The section shall:

- Display existing Public Comments in a readable order
- Clearly identify Public Comments as public ticket communication
- Provide an input and submit action when the current role may add a comment
- Validate required input
- Show busy and safe failure feedback
- Display a successfully added comment without confusing it with an Internal Note

### Internal Notes

Authorized IT Staff shall have a separate Internal Notes section.

The section shall:

- Be clearly labeled as internal
- Be visually distinguishable from Public Comments
- Display existing Internal Notes only to authorized staff
- Allow authorized staff to add a valid Internal Note
- Provide validation, busy, and safe failure feedback

Requester interfaces shall not display Internal Notes or controls for accessing them.

### Attachments

Existing Lab 2 Attachment functionality shall remain visually consistent where it is available under Lab 3 authorization.

The interface shall clearly show:

- Existing permitted attachments
- Available attachment actions for the authenticated role
- Attachment operation feedback

Lab 3 shall not unnecessarily redesign the existing attachment experience.

### Requester Resolution Indication

The Ticket Detail screen shall clearly display the Requester resolution indication required by Lab 3.

The indication shall be understandable without requiring the IT Staff user to infer it from unrelated ticket information.

### Authorization and Restricted Actions

The interface shall show only actions appropriate to the authenticated role and current ticket state.

However, UI restrictions shall not be treated as the security boundary. Forbidden operations must also be rejected by the backend.

### Validation and Failure States

Validation feedback shall appear near the relevant field or action where practical.

Failures shall:

- Use safe and understandable messages
- Avoid exposing internal server details
- Avoid falsely showing an unsuccessful change as persisted
- Leave the interface in a usable state for retry or correction

### Responsive Behavior

**Desktop**
- Ticket information and management controls may use multiple columns or grouped panels where this improves readability.

**Tablet**
- Sections may reorganize or stack while keeping actions close to their related information.

**Mobile**
- Major sections shall stack vertically where needed.
- Controls, comments, notes, attachments, and actions shall remain usable without unintended horizontal scrolling.

At all required widths:

- Important ticket information shall remain visible
- Editable and read-only fields shall remain distinguishable
- Public Comments and Internal Notes shall remain clearly separated
- Controls shall not overlap
- Content shall not be unintentionally clipped
- Keyboard focus shall remain visible

## 6. Administrator User Management

The Administrator User Management screen shall provide a simple interface for authorized Administrators to view, create, and maintain TokTickIT user accounts.

### User List

The user list shall display:

- Name
- Email
- Role
- Status
- Edit action

Active and inactive status shall be clearly understandable.

### Search and Filter

The interface shall provide:

- Search by name or email
- Optional permitted role filter

When no users match the current search or filter, a clear no-results state shall be displayed.

### Create User

The Administrator shall be able to create a user with:

- Name
- Email
- Exactly one permitted role
- Initial password
- Required activation information where applicable

The role control shall allow only:

- Requester
- IT Staff
- Administrator

A newly created user shall be required to change the initial password at first login.

### Create-User Validation

The interface shall provide clear validation for:

- Missing required fields
- Invalid input
- Invalid email format
- Duplicate email
- Invalid role
- Invalid initial-password input

Validation shall appear near the relevant field or action where practical.

### Edit User

The Administrator shall be able to edit permitted account information, including:

- Name
- Email
- Role
- Active/inactive status

The interface shall clearly distinguish editable account fields from information that is not editable.

### Set New Initial Password

The Administrator shall have a clear action for setting a new initial password for an existing user.

The interface shall communicate that the user will be required to change this password at the next login.

The new password itself shall not be displayed later as stored account information.

### Administrator Safety Rules

The UI shall support and clearly communicate the required safety rules:

- An Administrator cannot deactivate their own account.
- An operation that would leave TokTickIT without an active Administrator is not permitted.

A prohibited action shall not appear to succeed.

The backend remains responsible for enforcing these rules even if the UI disables or hides an action.

### Authorization

Only authenticated Administrators shall have access to User Management.

Requester and IT Staff users shall not be presented with User Management navigation.

Direct unauthorized access shall result in a safe forbidden state rather than displaying Administrator content.

### User Management States

**Loading**
- The interface indicates that user data is being retrieved.

**Empty**
- If no user data is available, an understandable empty state is displayed.

**No Results**
- If search or filtering matches no users, a distinct no-results state is displayed.

**Busy**
- Create, edit, activation, and password actions indicate processing and prevent unintended repeated submission.

**Validation**
- Invalid input is identified near the relevant field or action.

**Failure**
- Safe failure feedback is displayed without exposing sensitive server details.

**Success**
- Successful create or edit operations are reflected in the displayed user data.
- Success feedback may be shown where useful.

### Responsive Behavior

**Desktop**
- The user list may use an efficient table layout.
- Search, filter, create, and edit controls shall remain easy to access.

**Tablet**
- Controls and list content may wrap or reorganize without losing important information.

**Mobile**
- User records may use stacked rows/cards or another responsive presentation when a full table would cause horizontal overflow.
- Name, Email, Role, Status, and Edit shall remain accessible.

At all required widths:

- Forms shall remain readable
- Actions shall remain usable
- Validation shall remain associated with the relevant input
- Content shall not be unintentionally clipped
- Controls shall not overlap
- Unintended horizontal overflow shall be avoided
- Keyboard focus shall remain visible

## 7. Visual Verification Checklist

This checklist shall be completed against the final integrated Lab 3 application. Items shall remain unchecked until they have been visually verified.

### Required Screens

Desktop, tablet, and mobile verification shall cover:

- [ ] Login
- [ ] Change Password
- [ ] Requester Create Ticket
- [ ] Requester My Tickets
- [ ] Requester Ticket Detail
- [ ] IT Staff Ticket Queue
- [ ] IT Staff Ticket Detail
- [ ] Administrator User Management

### Design Consistency

- [x] Zen Green styling is consistent across Lab 3 screens.
- [x] Typography and spacing are consistent.
- [x] Cards, forms, buttons, and feedback use consistent patterns.
- [x] Primary and secondary actions are visually understandable.
- [x] New Lab 3 screens visually fit the existing Lab 2 application.

### Role Navigation

- [x] Authenticated user identity is clear.
- [x] Authenticated role is clear.
- [x] Requester navigation shows only appropriate options.
- [x] IT Staff navigation shows only appropriate options.
- [x] Administrator navigation shows only appropriate options.
- [x] Logout is easy to find.
- [x] Protected content is not displayed after logout.

### Status and Priority Badges

- [x] Ticket status badges are consistent.
- [x] IT Priority badges are consistent.
- [x] Badge meaning is understandable without relying only on color.
- [x] Queue and Ticket Detail use consistent badge treatment.

### Editable and Read-Only Fields

- [x] Editable controls are clearly identifiable.
- [x] Read-only information is visually distinguishable.
- [x] Disabled or unavailable actions do not appear active.
- [x] Current ticket ownership, status, and IT Priority are clear.

### Validation and Feedback

- [x] Validation appears near the relevant field or action.
- [x] Login busy and failure feedback is understandable.
- [x] Change Password validation and failure feedback is understandable.
- [x] Queue loading, empty, no-results, and failure states are understandable.
- [x] Ticket Detail validation and failure feedback is understandable.
- [x] User Management validation and failure feedback is understandable.
- [x] Busy actions prevent unintended repeated submission.
- [x] Failure messages do not expose sensitive implementation details.

### Public Comments and Internal Notes

- [x] Public Comments are clearly identified.
- [x] Internal Notes are clearly identified as internal.
- [x] Public Comments and Internal Notes are visually distinguishable.
- [x] Requester interfaces do not expose Internal Notes.

### Responsive Layout

For every required major screen:

- [x] Desktop layout is usable.
- [x] Tablet layout is usable.
- [x] Mobile layout is usable.
- [x] Important information remains visible.
- [x] Controls remain usable.
- [x] Text and controls are not unintentionally clipped.
- [x] Elements do not overlap.
- [x] No unintended horizontal overflow is present.

### Focus and Accessibility

- [x] Keyboard focus is visible on interactive controls.
- [x] Form labels remain associated clearly with their inputs.
- [x] Buttons and links have understandable labels.
- [x] Important state information is not communicated by color alone.

### Evidence

Final visual evidence shall be stored under:

`artifacts/lab-03/screenshots/`

Screenshots shall provide readable evidence for the required desktop, tablet, and mobile states. The completed checklist and screenshots shall reflect the final integrated Lab 3 application rather than an earlier implementation state.