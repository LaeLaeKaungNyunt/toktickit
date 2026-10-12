# Lab 4 — UI Specification

**Project:** TokTickIT — IT Service Desk  
**Sprint:** Lab 4  
**Status:** Approved for Implementation  
**Related documents:** `specification.md`, `api-spec.md`, `tests.md`

## 1. UI Design Principles and Navigation

### 1.1 Design Goal

Extend the existing TokTickIT interface with Actions Taken and role-specific dashboards while keeping the application simple, consistent, responsive, and accessible.

Lab 4 must build on the existing React, TypeScript, Vite, and Bootstrap frontend rather than replacing the Lab 3 interface.

### 1.2 Design Principles

- **Consistency:** Reuse existing navigation, page layouts, forms, tables, buttons, and status indicators.
- **Clarity:** Show important Ticket information and required actions without unnecessary clutter.
- **Role awareness:** Display only the functions appropriate to the authenticated user's role.
- **Accessibility:** Support keyboard navigation, visible focus, readable labels, and text-based status indicators.
- **Responsiveness:** Keep the interface usable on desktop, tablet, and mobile.
- **Safe feedback:** Provide clear loading, empty, success, validation-error, and conflict states.
- **Data integrity:** Prevent accidental duplicate submissions and explain when another user has updated a record.

### 1.3 Role-Based Navigation

| Role | Lab 4 navigation |
|---|---|
| Requester | Requester Dashboard, My Tickets, Ticket Detail with read-only Actions Taken |
| IT Staff | IT Staff Dashboard, Ticket Queue, Ticket Detail with Actions Taken management |
| Administrator | User Management, IT Staff Dashboard, Ticket Queue, Ticket Detail with Actions Taken management |

Existing Lab 3 navigation and authentication flows must remain available.

### 1.4 Main Screen Inventory

| Screen | Main purpose |
|---|---|
| IT Staff Dashboard | Operational metrics, assigned work, urgent Tickets, and recent activity |
| Requester Dashboard | Personal Ticket metrics, attention items, and recent activity |
| IT Staff Ticket Detail | View and manage Actions Taken alongside existing Ticket information |
| Requester Ticket Detail | View Actions Taken on owned Tickets without edit controls |
| Action Taken Form | Create or edit an action, assign work, and record follow-up details |
| Ticket Resolution Form | Provide a Resolution Summary before formally resolving a Ticket |

### 1.5 Navigation and Access Rules

- Dashboard cards and list items must link to the corresponding authorized Ticket view or dashboard section.
- Requesters must never see controls for creating, editing, completing, or cancelling Actions Taken.
- Administrators may access all IT Staff operational features (Staff Dashboard, Queue, Detail, Actions Taken, and status transitions) in addition to User Management.
- Hiding a control in the UI does not replace backend authorization.
- Unauthorized routes must show an appropriate access-denied state or redirect to an allowed page.
- Existing Ticket links and browser navigation should continue working.

### 1.6 UI Verification

The UI must be verified against acceptance criteria AC-06, AC-08, AC-15 through AC-22, and AC-26 through AC-29.

Visual and interaction evidence will be collected during implementation and final testing.

**Design status:** Approved for Implementation.

## 2. IT Staff Dashboard

### 2.1 Purpose

The IT Staff Dashboard gives IT Staff and Administrators a quick overview of Ticket workload, urgent issues, assigned Actions Taken, and recent activity.

It must help users identify what needs attention and navigate directly to the relevant Ticket.

### 2.2 Page Layout

The dashboard contains four main areas:

1. **Page Header:** Title "IT Staff Dashboard" with a short description of the current workload.
2. **Summary Cards:** Key operational metrics.
3. **Work Lists:** Assigned Actions Taken and urgent Tickets.
4. **Recent Activity:** Recently updated Tickets and status distribution.

The layout should follow the existing TokTickIT visual style and use Bootstrap's responsive grid.

### 2.3 Summary Cards

| Card | Displayed information | Interaction |
|---|---|---|
| Unassigned Tickets | Number of non-terminal Tickets without an assignee (`metrics.unassignedTickets`) | Opens the Ticket Queue filtered to unassigned Tickets (`assignment=unassigned`) |
| My Assigned Tickets | Number of non-terminal Tickets assigned to the current user (`metrics.myAssignedTickets`) | Opens the Ticket Queue filtered to tickets assigned to the caller (`assignedToMe=true`) |
| Urgent Tickets | Number of non-terminal Tickets with IT Priority Urgent or High (`metrics.urgentTickets`) | Opens the Ticket Queue filtered to urgent priorities (`priority=Urgent,High`) |
| My Active Actions | Number of active Actions Taken assigned to the current user (`metrics.myActiveActionsCount`) | Scrolls to the My Actions Taken section on the dashboard |

All numbers must come from the backend `metrics` payload. The UI must not calculate totals from the five-item preview lists.

### 2.4 My Actions Taken Section

Display up to five active Actions Taken assigned to the authenticated user.

Each item should show:

- Parent Ticket number and summary.
- Action description.
- Action status.
- Follow-up requirement.
- Relevant action date/time.
- A link to the corresponding Ticket Detail.

When no actions are assigned, display:

"No active Actions Taken assigned to you."

### 2.5 Urgent Tickets Section

Display up to five non-terminal Tickets with IT Priority Urgent or High.

Each item should show:

- Ticket number and summary.
- IT Priority.
- Current status.
- Assigned IT Staff member, if any.
- Last updated date/time.
- Link to Ticket Detail.

Urgent Tickets appear before High priority Tickets. Within each priority, show the most recently updated first.

### 2.6 Recent Tickets and Status Overview

**Recent Tickets:** Show the five most recently updated Tickets, including their ticket number, summary, status, and update time.

**Status Overview:** Display the number of Tickets in each of the eight existing statuses:

New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, and Cancelled.

Status labels must remain readable without relying on color alone.

### 2.7 Loading, Empty, and Error States

| State | Expected UI behavior |
|---|---|
| Loading | Show a loading indicator or placeholder without displaying misleading counts |
| Empty dashboard | Show zero counts and helpful empty-state messages |
| Successful load | Display current backend data |
| API failure | Show a safe error message and a Retry option |
| Unauthorized access | Show access denied or redirect to an authorized page |
| Stale data | Refresh metrics and lists after relevant updates or page reload |

### 2.8 Responsive and Accessibility Requirements

- Desktop: Summary cards and work lists may appear in multiple columns.
- Tablet: Cards and lists rearrange into fewer columns.
- Mobile: Cards stack vertically; lists remain readable without horizontal page scrolling.
- All links and controls must be keyboard-accessible.
- Focus indicators must remain visible.
- Ticket priority and status must include text labels.
- Dates, counts, and action labels must be understandable to screen-reader users.

### 2.9 Acceptance and Verification

This screen supports:

- AC-15: Accurate operational metrics.
- AC-16: Assigned work visibility.
- AC-17: Urgent/recent Ticket drill-down.
- AC-18: Empty states.
- AC-26: Safe error handling.
- AC-27: Responsive layout.
- AC-28: Keyboard accessibility.

Planned tests: SD-01 through SD-15, DA-01 through DA-03, DP-01 through DP-05, UI-01 through UI-03, and E2E-09.

## 3. Requester Dashboard

### 3.1 Purpose

The Requester Dashboard provides a simple overview of the authenticated Requester's Tickets, current progress, and requests requiring attention.

It must not display Tickets belonging to other Requesters.

### 3.2 Page Layout

The dashboard contains four main areas:

1. **Page Header:** Title "My Dashboard" with a short description of the Requester's Ticket activity.
2. **Summary Cards:** Personal Ticket counts.
3. **Needs My Attention:** Tickets currently waiting for the Requester.
4. **Recent Activity:** Recently resolved and recently updated Tickets.

The page must follow the existing TokTickIT design and use a responsive Bootstrap layout.

### 3.3 Summary Cards

| Card | Displayed information | Interaction |
|---|---|---|
| My Active Tickets | Number of owned Tickets excluding Closed and Cancelled (`metrics.myActiveTickets`) | Opens My Tickets (unfiltered; preserves existing Lab 2 query behavior) |
| Waiting for Me | Number of owned Tickets with status Waiting for Requester (`metrics.waitingForMe`) | Scrolls to the Needs My Attention section on the dashboard |
| Recently Resolved | Number of owned Tickets currently in Resolved status (`metrics.resolvedTicketsCount`) | Scrolls to the Recently Resolved section on the dashboard |
| Total Tickets | Total number of Tickets owned by the Requester (`metrics.totalTicketsCount`) | Opens My Tickets (unfiltered) |

All counts must come directly from authoritative backend fields in the `metrics` object and include only Tickets belonging to the authenticated Requester. To preserve Lab 2 regression test contracts (`server/tests/lab-02/my-tickets.test.ts:L535-L538`), `GET /api/v1/tickets` strictly retains `status=New` query validation; summary cards navigate to in-page preview sections or individual Ticket Detail views, not unsupported filtered My Tickets query links.

### 3.4 Needs My Attention

Display up to five owned Tickets with status `Waiting for Requester`.

Each item should show:

- Ticket number and summary.
- Current status.
- Last updated date/time.
- A link to Ticket Detail.

When there are no matching Tickets, display:

"No tickets are waiting for your response."

This section must not include Tickets belonging to other Requesters.

### 3.5 Recently Resolved Tickets

Display up to five owned Tickets currently in `Resolved` status.

Each item should show:

- Ticket number and summary.
- Resolution Summary, when available.
- Most recent resolution date/time.
- Link to Ticket Detail.

Tickets that have been reopened or moved out of Resolved must not appear in this list.

The ordering must follow the dashboard API contract using the latest relevant resolution event.

### 3.6 Recently Updated Tickets

Display the five most recently updated Tickets owned by the Requester.

Each item should show:

- Ticket number and summary.
- Current status.
- Last updated date/time.
- Link to Ticket Detail.

The Requester can select an item to open the existing Ticket Detail page.

### 3.7 Status Overview

Display the number of owned Tickets in each existing status:

New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, and Cancelled.

Use readable text labels alongside any visual status indicators.

### 3.8 Loading, Empty, and Error States

| State | Expected UI behavior |
|---|---|
| Loading | Show a loading indicator without displaying inaccurate counts |
| No Tickets | Show zero counts and a helpful message |
| No attention items | Show "No tickets are waiting for your response" |
| No resolved Tickets | Show an appropriate empty-state message |
| API failure | Show a safe error message with a Retry option |
| Unauthorized access | Redirect to an authorized page or show access denied |
| Successful refresh | Display updated backend data |

### 3.9 Privacy and Access Control

- All dashboard data must be restricted by the authenticated Requester's ID on the backend.
- The frontend must not send a different Requester ID to retrieve another user's data.
- Ticket Detail navigation must preserve existing ownership checks.
- Requesters must not see internal notes, staff-only controls, or unrelated Ticket information.
- Hiding restricted information in the UI does not replace backend authorization.

### 3.10 Responsive and Accessibility Requirements

- Desktop: Summary cards and activity lists may appear in multiple columns.
- Tablet: Cards and lists rearrange into fewer columns.
- Mobile: Cards stack vertically, and Ticket lists remain readable without horizontal page scrolling.
- All dashboard links must be keyboard-accessible.
- Focus indicators must remain visible.
- Status information must include text labels rather than color alone.
- Loading and error messages must be understandable and accessible.

### 3.11 Acceptance and Verification

This screen supports:

- AC-19: Accurate Requester-only metrics and recent Tickets.
- AC-20: Tickets requiring Requester attention.
- AC-21: Correct Ticket Detail navigation.
- AC-22: Ownership and privacy restrictions.
- AC-26: Safe error handling.
- AC-27: Responsive layout.
- AC-28: Keyboard accessibility.

Planned tests: RD-01 through RD-14, DA-04 through DA-09, UI-04, and E2E-10.

## 4. Actions Taken UI and Ticket Detail

### 4.1 Purpose

Extend the existing Ticket Detail page with an Actions Taken section without removing or replacing any Lab 3 features.

IT Staff and Administrators can create and manage Actions Taken. Requesters can view Actions Taken belonging to their own Tickets but cannot modify them.

### 4.2 Actions Taken Section

The Actions Taken section appears within Ticket Detail alongside existing Ticket information, comments, notes, and attachments.

Each Action Taken record displays:

- Action Date/Time
- Action Description
- Result
- Performed By
- Assigned To, if assigned
- Status: Active, Completed, or Cancelled
- Follow-Up Required: Yes or No
- Follow-Up Note, when applicable
- Attachment Notes, when provided

Actions must appear in a stable order: Action Date/Time ascending, followed by creation time and record ID.

When no records exist, display:

"No actions taken have been recorded for this ticket."

### 4.3 Role-Based Controls

| User role | View Actions Taken | Create | Edit / Assign | Complete / Cancel |
|---|---|---|---|---|
| Requester (Ticket owner) | Yes | No | No | No |
| Requester (not Ticket owner) | No | No | No | No |
| IT Staff | Yes | Yes | Yes | Yes |
| Administrator | Yes | Yes | Yes | Yes |

Requesters must not see management buttons. All permissions must also be enforced by the backend.

### 4.4 Create Action Taken Form

IT Staff and Administrators can select **Add Action Taken** from Ticket Detail.

The form contains:

| Field | Input | Validation |
|---|---|---|
| Action Date/Time | Date and time input | Required, valid date/time |
| Action Description | Multiline text | Required, nonblank |
| Result | Multiline text | Required, nonblank |
| Performed By | Read-only display | Automatically determined from authenticated user |
| Assigned To | Staff selection | Optional; only active IT Staff or Administrators |
| Follow-Up Required | Yes/No selection | Required; default No |
| Follow-Up Note | Multiline text | Required when Follow-Up Required is Yes |
| Attachment Notes | Multiline text | Optional |

The initial action status is **Active**.

The form provides **Save** and **Cancel** controls. Cancel closes the form without creating a record.

### 4.5 Edit and Assignment Form

Authorized IT Staff and Administrators can edit an existing Active Action Taken record.

- Existing values are prefilled.
- Performed By remains read-only and cannot be changed.
- Assigned To can be updated using eligible active users.
- Follow-Up Note validation changes when Follow-Up Required changes.
- Save sends the record's expected update timestamp to detect stale changes.
- If another user has updated the record, display a conflict message and offer to reload the latest data.
- A stale update must never silently overwrite newer information.

Completed and Cancelled records remain visible in history as read-only terminal states. Any attempt to edit fields or reassign a Completed or Cancelled action must be rejected by the backend with HTTP 409 Conflict. A terminal action cannot be reactivated or modified through the Lab 4 interface.

### 4.6 Complete or Cancel an Action

Authorized users can change an Active Action Taken record to:

- **Completed:** The action is finished.
- **Cancelled:** The action will not continue.

Before changing status, the UI must clearly identify the selected action and target status.

After a successful change:

- Update the displayed status.
- Refresh relevant dashboard information.
- Remove the record from active-action work lists.
- Keep the record visible in the Ticket's Actions Taken history.

A terminal action cannot be reactivated through the Lab 4 interface.

### 4.7 Requester Read-Only View

A Requester viewing their own Ticket sees the Actions Taken list without management controls.

The Requester can read:

- What action was taken.
- When it happened.
- The recorded result.
- Who performed it.
- Whether follow-up is required.
- Available follow-up and attachment notes.
- Current action status.

The Requester cannot create, edit, assign, complete, or cancel Actions Taken.

### 4.8 Loading, Validation, and Error States

| State | Expected behavior |
|---|---|
| Loading actions | Show a loading indicator |
| No actions | Show the empty-state message |
| Saving | Disable repeated submission and show progress |
| Validation failure | Display field-level errors and preserve entered values |
| Unauthorized action | Show safe access-denied feedback |
| Stale update | Show conflict feedback and offer to reload |
| Server or network failure | Show a safe error message and allow retry |
| Successful save | Refresh the Actions Taken list and show confirmation |

### 4.9 Responsive and Accessibility Requirements

- Desktop: Display records using readable cards or a suitable responsive layout.
- Tablet: Adapt record details and forms to the available width.
- Mobile: Stack record fields vertically without horizontal page scrolling.
- Form inputs must have visible labels.
- Validation errors must identify the relevant field.
- Buttons and form controls must be keyboard-accessible.
- Focus indicators must remain visible.
- Status must be represented by text, not color alone.
- Confirmation and error feedback must be understandable without relying only on visual styling.

### 4.10 Acceptance and Verification

This section supports:

- AC-01 through AC-08: Actions Taken creation, viewing, editing, assignment, permissions, and lifecycle.
- AC-14: Stale-update protection.
- AC-26: Safe error handling.
- AC-27: Responsive layout.
- AC-28: Accessibility.
- AC-29: Reliable form submission and recovery.

Planned tests: AT-01 through AT-44, UI-05 through UI-10, ER-01 through ER-05, and E2E-01 through E2E-04, E2E-07, E2E-08, and E2E-11.

## 5. Ticket Status and Resolution UI

### 5.1 Purpose

Extend the existing Ticket status controls to support Lab 4 resolution validation while preserving the current Ticket workflow.

IT Staff must be able to understand which status transitions are allowed and why a resolution attempt may be rejected.

The backend remains responsible for enforcing all status and resolution rules.

### 5.2 Existing Ticket Statuses

The application continues using these eight statuses:

- New
- Open
- In Progress
- Waiting for Requester
- Resolved
- Closed
- Reopened
- Cancelled

No additional Ticket statuses are introduced in Lab 4.

### 5.3 Status Transition Controls

The Ticket Detail page must display the current status and provide authorized users with available next-status options.

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

The UI should present only valid next-status options. However, the backend must reject invalid transitions even when requests bypass the UI.

### 5.4 Resolution Requirements

Before a Ticket can transition to **Resolved**, the backend must confirm:

1. The Ticket has at least one Completed Action Taken record.
2. The completed action has a meaningful Action Description and Result.
3. A nonblank Resolution Summary is provided.

These checks apply to every permitted transition into Resolved, including transitions from Reopened.

The Requester's advisory resolution indication does not replace these requirements.

### 5.5 Resolution Form

When an authorized user selects **Resolved**, show a resolution form containing:

| Field | Input | Validation |
|---|---|---|
| Current Ticket Status | Read-only text | Displays the existing status |
| Target Status | Read-only text | Resolved |
| Completed Actions Taken | Read-only summary | Shows completed work available for resolution |
| Resolution Summary | Multiline text | Required, nonblank |
| Expected Update Timestamp | Hidden request value | Used for stale-update detection |

The form provides **Confirm Resolution** and **Cancel** controls.

Cancel closes the form without changing the Ticket.

The UI may explain missing completed work before submission, but the backend must independently validate the resolution requirements.

### 5.6 Resolution Validation Feedback

| Condition | Expected UI behavior |
|---|---|
| No Completed Action Taken | Explain that completed work is required before resolution |
| Completed action lacks required meaningful details | Explain that the completed work record must satisfy resolution requirements |
| Empty Resolution Summary | Show a field-level validation message |
| Invalid status transition | Show that the requested transition is not allowed |
| Stale Ticket update | Show conflict feedback and offer to reload current Ticket data |
| Unauthorized request | Show safe access-denied feedback |
| Successful resolution | Update Ticket status to Resolved and display the saved Resolution Summary |

Validation messages must be clear and must not expose internal server information.

### 5.7 Other Status Changes

For valid transitions that do not target Resolved:

- Display the selected target status.
- Ask the user to confirm when appropriate.
- Send the expected Ticket update timestamp for concurrency protection.
- Update the Ticket Detail view after a successful response.
- Preserve the existing Ticket event history.

The UI must not create a duplicate status-change workflow separate from the existing Ticket Detail functionality.

### 5.8 Requester Experience

Requesters can view the current Ticket status and Resolution Summary on their own Tickets.

Requesters cannot perform IT Staff status transitions.

The existing Requester resolution indication remains an advisory action. Selecting it must not automatically change the Ticket to Resolved or bypass the completed-action requirement.

### 5.9 Loading, Error, and Concurrency States

| State | Expected behavior |
|---|---|
| Submitting status change | Disable repeated submission and show progress |
| Successful update | Refresh Ticket details, status, and relevant dashboard data |
| Validation failure | Preserve entered Resolution Summary and show the reason |
| Stale update | Explain that the Ticket changed and offer to reload |
| Network failure | Show a safe error and allow retry |
| Terminal Ticket status | Hide or disable unavailable transition controls |

A failed status change must not leave the UI showing a status that was never saved.

### 5.10 Responsive and Accessibility Requirements

- Status controls and resolution forms must remain usable on desktop, tablet, and mobile.
- All inputs and buttons must have accessible labels.
- Keyboard users must be able to open, complete, and dismiss the resolution form.
- Focus must be managed appropriately when opening and closing a modal, if one is used.
- Validation messages must be associated with their relevant fields.
- Status changes must be communicated using text, not color alone.

### 5.11 Acceptance and Verification

This section supports:

- AC-09 and AC-10: Valid status transitions and rejection of invalid transitions.
- AC-11 and AC-12: Resolution gate and Resolution Summary.
- AC-13: Requester advisory indication remains separate.
- AC-14: Stale-update protection.
- AC-26: Safe error handling.
- AC-27 and AC-28: Responsive and accessible interaction.
- AC-29: Reliable submission and recovery.

Planned tests: TS-01 through TS-36, ER-01 through ER-05, and E2E-05, E2E-06, E2E-11, and E2E-12.

## 6. Visual Consistency, Screenshots, and UI Acceptance

### 6.1 Existing Design Consistency

Lab 4 must extend the existing TokTickIT interface without unnecessarily redesigning features completed in Labs 1–3.

The implementation must:

- Reuse the existing Bootstrap layout and navigation patterns.
- Maintain the established Zen Green visual theme.
- Use consistent typography, spacing, buttons, forms, and status indicators.
- Preserve existing Ticket Detail functionality.
- Avoid unnecessary animations and decorative elements.
- Keep important information easy to find and read.

### 6.2 Responsive Layout Verification

The following viewport widths will be used for visual verification:

| Device | Viewport width | Verification focus |
|---|---|---|
| Desktop | 1440px | Dashboard columns, navigation, tables, and spacing |
| Tablet | 768px | Card reflow, forms, and readable content |
| Mobile | 390px | Stacked layouts, navigation, and usable controls |

Screenshots must show that:

- Content does not overlap or become clipped.
- Important controls remain visible and usable.
- Forms can be completed without horizontal page scrolling.
- Dashboard cards and lists adapt to smaller screens.
- Actions Taken records remain readable on mobile.

### 6.3 Required Screenshot Evidence

Store screenshots under:

`artifacts/lab-04/screenshots/`

| Screenshot ID | Required evidence |
|---|---|
| UI-SS-01 | IT Staff Dashboard — desktop |
| UI-SS-02 | IT Staff Dashboard — mobile |
| UI-SS-03 | Requester Dashboard — desktop |
| UI-SS-04 | Requester Dashboard — mobile |
| UI-SS-05 | Ticket Detail with Actions Taken list |
| UI-SS-06 | Create Action Taken form |
| UI-SS-07 | Edit or assign Action Taken form |
| UI-SS-08 | Completed Action Taken displayed in history |
| UI-SS-09 | Requester read-only Actions Taken view |
| UI-SS-10 | Ticket Resolution form |
| UI-SS-11 | Resolution validation error |
| UI-SS-12 | Stale-update conflict feedback |
| UI-SS-13 | Tablet responsive layout |
| UI-SS-14 | Empty dashboard or empty Actions Taken state |
| UI-SS-15 | Successful Ticket resolution with Resolution Summary |

Screenshots must use test or demonstration data and must not expose passwords, tokens, or other sensitive information.

### 6.4 Accessibility Verification

The following checks must be completed:

- [ ] All important controls can be reached using the keyboard.
- [ ] Keyboard focus is clearly visible.
- [ ] Form inputs have readable labels.
- [ ] Required fields and validation errors are understandable.
- [ ] Status and priority information do not rely only on color.
- [ ] Buttons and links have meaningful accessible names.
- [ ] Loading and error feedback is understandable.
- [ ] Modal dialogs, if used, support appropriate focus behavior.
- [ ] Text and interactive elements maintain usable contrast.
- [ ] Responsive layouts remain usable with increased text size.

### 6.5 UI Acceptance Checklist

- [ ] IT Staff Dashboard displays accurate backend metrics (including `metrics.myActiveActionsCount`).
- [ ] IT Staff can open assigned work (`assignedToMe=true`) and urgent Tickets (`priority=Urgent,High`).
- [ ] Requester Dashboard displays only owned Tickets with valid metrics (`totalTicketsCount`, `resolvedTicketsCount`).
- [ ] Requester Dashboard summary cards navigate to corresponding in-page sections or authorized Ticket views.
- [ ] Requesters can navigate to their Ticket details.
- [ ] Actions Taken records display all required information, including `actionDateTime`, `performedBy`, and `assignedTo`.
- [ ] IT Staff and Administrators can create and manage Actions Taken.
- [ ] Requesters can view owned Actions Taken without management controls.
- [ ] Follow-Up Note validation works correctly.
- [ ] Inactive users cannot be selected as new action assignees.
- [ ] Completed and Cancelled actions remain visible in history.
- [ ] Terminal actions (Completed or Cancelled) cannot be edited, returning HTTP 409 Conflict if attempted.
- [ ] Resolution Summary is required for formal resolution.
- [ ] Invalid status transitions are rejected.
- [ ] Stale updates send `expectedUpdatedAt` and display conflict feedback (HTTP 409).
- [ ] Concurrency checks and status updates are executed in atomic database transactions.
- [ ] Administrators have full access to IT Staff features, queues, actions, and status updates.
- [ ] Loading, empty, success, and error states are handled.
- [ ] Desktop, tablet, and mobile layouts are verified.
- [ ] Keyboard and accessibility checks are completed.
- [ ] Existing Labs 1–3 UI functionality remains intact.
- [ ] Required screenshots are captured and referenced in the final report.

### 6.6 Final UI Review

Before the UI specification is approved for implementation:

1. Compare every screen against the approved functional requirements.
2. Confirm that the UI and API contracts agree on available data and actions.
3. Confirm that all required interactions have corresponding test cases.
4. Resolve any unclear navigation or authorization behavior.
5. Record reviewer feedback and update the specification if necessary.

**UI specification status:** Approved for Implementation.