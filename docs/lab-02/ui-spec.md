# Lab 2 UI Specification

## 1. Purpose and Design Foundation

This document defines the user interface contract for the Lab 2 TokTickIT Requester Ticketing MVP. It covers Development Requester selection, Create Ticket, My Tickets, Ticket Detail, Attachment management, shared UI states, and responsive behavior.

The Lab 2 interface shall follow the TokTickIT **Zen Green** visual foundation.

### Core Visual Tokens

- Primary green: `#006B3C`
- Secondary green: `#0B7A46`
- Pale green surface: `#EAF6EF`
- White/light neutral surfaces for cards, forms, and content areas
- Dark readable text with sufficient contrast
- Consistent Bootstrap-based spacing, borders, form controls, buttons, cards, alerts, badges, and tables

The interface should feel clean, calm, professional, and easy to scan rather than visually dense.

### Shared Layout Principles

- Use a consistent application header and content container across Lab 2 screens.
- Clearly display the currently selected Development Requester.
- Provide an obvious **Change Requester** action.
- Keep primary actions visually prominent.
- Use clear page titles and short supporting text where useful.
- Use consistent spacing and alignment between forms, filters, cards, tables, and action controls.
- Avoid unintended horizontal page scrolling at supported responsive widths.
- Use semantic labels and controls that remain understandable without relying only on color.

## 2. Development Requester Selection

The application shall begin with a Development Requester selection experience because Lab 2 does not implement real authentication.

### Initial State

When no Development Requester is selected:

- requester-specific workflows shall remain unavailable;
- the UI shall clearly explain that a Development Requester must be selected to continue;
- only active Development Requesters returned by the backend shall be available;
- inactive Development Requesters shall never appear in the selector.

### Selector Content

Each Requester option shall display enough information to distinguish users, including:

- display name;
- email address.

### After Selection

After a Development Requester is selected:

- the application shall clearly show the current Requester identity;
- Create Ticket, My Tickets, Ticket Detail, and Attachment actions may become available;
- subsequent requester-specific API requests shall use the selected Requester context;
- requester-specific data shall load for that Requester only.

### Change Requester

A visible **Change Requester** action shall be available after selection.

When the Requester changes:

- stale Ticket and Attachment data from the previous Requester shall be cleared or replaced;
- requester-specific screens shall reload using the new Requester context;
- the UI shall not briefly expose Ticket data belonging to the previously selected Requester.

### Loading and Failure States

While Requesters are loading, the selector shall show a clear loading state.

If Requesters cannot be loaded, the UI shall show a safe retryable error message without exposing backend or database details.

## 3. Create Ticket Screen

The Create Ticket screen shall provide a clear form for the currently selected Development Requester to submit a new IT support Ticket.

### Displayed Fields

The form shall contain:

- **Ticket Number** — not editable; generated only after successful creation.
- **Ticket Date** — not editable; generated from the persisted creation timestamp.
- **Requester** — displays the currently selected Development Requester and is not editable.
- **Category** — required selection populated from PostgreSQL.
- **Related System** — required selection populated from active Related Systems.
- **Ticket Summary** — required text input, 5–120 trimmed characters.
- **Requested Priority** — required selection: Low, Medium, High, or Urgent.
- **Description** — required multiline input, 10–5000 trimmed characters.
- **Attachments** — optional file selection handled according to the Attachment workflow after successful Ticket creation.

### Form Behavior

- Required editable fields shall have clear labels and required indicators.
- No priority shall be silently preselected.
- Validation messages shall appear near the relevant field.
- Invalid client-side input shall not be submitted.
- The primary action shall be clearly labeled **Create Ticket**.
- While submission is in progress, the primary action shall show a busy state and prevent duplicate submission.
- A recoverable API failure shall display a safe error while preserving valid entered values where practical.

### Successful Creation

After successful Ticket creation, the UI shall clearly show the persisted:

- Ticket Number;
- Ticket Date;
- Requester;
- Category;
- Related System;
- Ticket Summary;
- Requested Priority;
- Description;
- Current Status.

The user shall receive clear confirmation that the Ticket was created successfully.

If optional Attachments were selected, their upload shall occur only after the Ticket has been created. An Attachment upload failure shall be reported separately and shall not make the successfully created Ticket appear to have failed.

## 4. My Tickets Screen

The My Tickets screen shall allow the currently selected Development Requester to browse and find only their own Tickets.

### Ticket List

Each Ticket item shall display the information needed to identify and compare Tickets:

- Ticket Number;
- Summary;
- Category;
- Related System;
- Requested Priority;
- Current Status;
- creation date/time.

Selecting a Ticket shall open its Ticket Detail screen.

### Search and Filters

The screen shall provide:

- text search across Ticket Number, Summary, and Description;
- Current Status filter;
- Category filter;
- Related System filter;
- Requested Priority filter;
- a clear way to reset active search and filters.

Search and filters may be combined.

### Sorting

The user shall be able to sort by the options supported by `api-spec.md`:

- creation date/time;
- Ticket Number;
- Requested Priority.

The selected sort direction shall be clear to the user.

### Pagination

When multiple pages exist:

- pagination controls shall allow navigation between pages;
- the current page shall be identifiable;
- controls that cannot be used, such as Previous on the first page, shall be disabled appropriately.

### UI States

- **Loading:** show a clear loading state while Tickets are being retrieved.
- **Empty:** when the selected Requester owns no Tickets, show an empty state with a useful path to Create Ticket.
- **No results:** when Tickets exist but the active search or filters match none, show a distinct no-results state and allow the user to clear the search or filters.
- **Failure:** show a safe retryable error without exposing internal details.

Changing the Development Requester shall clear stale list data and reload My Tickets for the newly selected Requester.

## 5. Ticket Detail and Attachment Management

The Ticket Detail screen shall display the complete saved information for one Ticket owned by the currently selected Development Requester.

### Ticket Information

The following Ticket information shall be displayed as read-only:

- Ticket Number;
- Ticket Date;
- Requester;
- Category;
- Related System;
- Ticket Summary;
- Requested Priority;
- Description;
- Current Status.

Lab 2 shall not provide controls for editing Ticket fields, changing status, assigning an owner, or changing IT Priority.

### Attachment List

The screen shall display active Attachments associated with the Ticket.

For each active Attachment, show:

- original filename;
- file type;
- file size;
- uploaded date/time;
- Download action;
- Remove action.

### Add Attachment

The user shall be able to select and upload permitted files.

The UI shall communicate these rules before or during selection:

- JPG/JPEG, PNG, WEBP, and PDF only;
- maximum 5 MB per file;
- maximum five active Attachments per Ticket.

While an upload is in progress, the relevant upload control shall show a busy state and prevent accidental duplicate submission.

After a successful upload, the Attachment list shall update to show the new Attachment.

### Remove Attachment

Selecting **Remove** shall require the user to provide a non-empty removal reason before confirming the action.

After successful removal:

- the Attachment shall disappear from the active Attachment list;
- it shall no longer be available for preview or download;
- the UI shall show clear success feedback.

The UI shall not represent soft removal as deletion of the Ticket itself.

### Ownership and Failure States

If the Ticket cannot be accessed because it does not exist or is unavailable to the selected Requester, the UI shall show a safe not-found/unavailable state without exposing another Requester's data.

Attachment upload, download, or removal failures shall display safe messages without exposing storage or backend implementation details.

Changing the Development Requester while viewing Ticket Detail shall clear the previous Ticket data before loading or navigating under the new Requester context.

## 6. Shared UI States and Feedback

All Lab 2 screens shall use consistent feedback patterns so the user can understand the current state of an operation.

### Loading

- Show a visible loading indicator or placeholder while required data is being retrieved.
- Do not display stale requester-specific data while new data is loading.
- Controls that depend on unavailable data shall remain disabled where appropriate.

### Validation

- Show field-level validation messages close to the relevant control.
- Required fields shall be clearly identified.
- Validation messages shall explain how the user can correct the input.
- Invalid forms shall not be submitted.

### Submitting and Processing

- Actions in progress shall display a clear busy state.
- Relevant controls shall be temporarily disabled when repeated submission could create duplicate operations.
- The interface shall not imply success until the backend confirms success.

### Success

Successful Ticket creation, Attachment upload, and Attachment removal shall provide clear confirmation. Updated persisted data shall be reflected in the UI after the operation succeeds.

### Empty and No-Results States

Empty states and filtered no-results states shall be visually and textually distinct.

- **Empty state:** the Requester has no data for that workflow.
- **No-results state:** data exists, but none matches the current search or filters.

### Failure

- API failures shall display concise, safe, user-facing messages.
- Retry actions shall be provided where retrying is appropriate.
- Internal server, database, stack-trace, or storage information shall never be displayed.
- Existing valid user input shall be preserved after recoverable failures where practical.

## 7. Responsive Behavior and Shared Components

Lab 2 screens shall remain usable on desktop, tablet, and mobile widths using responsive Bootstrap layout behavior.

### Responsive Layout

#### Desktop

- Use the available content width efficiently while keeping forms and text readable.
- My Tickets may use a table-style layout with clearly aligned columns.
- Search, filters, sorting, and primary actions may appear on the same row when space permits.
- Ticket Detail may organize related information into multiple columns or grouped cards.

#### Tablet

- Multi-column layouts shall reduce or stack when space becomes limited.
- Search, filter, and sort controls may wrap onto additional rows.
- Ticket information and Attachment actions shall remain easy to read and operate.

#### Mobile

- Primary content shall use a single-column layout where practical.
- My Tickets shall adapt from a wide table into a mobile-friendly layout such as stacked Ticket cards or equivalent responsive presentation.
- Form controls and primary actions shall remain comfortably usable.
- Filters and sorting controls shall stack or wrap without clipping.
- Attachment filenames and long text shall wrap safely.
- The application shall not require unintended horizontal page scrolling.

### Shared Components

Reusable UI components should be used where practical for:

- application header/navigation;
- current Requester display and Change Requester action;
- page headings;
- form controls and validation feedback;
- primary and secondary buttons;
- status and priority badges;
- loading indicators;
- alerts and success/error feedback;
- empty and no-results states;
- Ticket list items/cards;
- pagination controls;
- Attachment items and actions;
- confirmation/removal-reason dialog.

Shared components shall follow the same Zen Green tokens, spacing, typography, border, and interaction conventions so Lab 2 screens feel like one consistent application.

## 8. Accessibility and Interaction Rules

Lab 2 shall apply basic accessibility and interaction practices across all Requester-facing screens.

### Forms and Controls

- Every form control shall have a clear visible label.
- Required fields shall be identified using text or indicators that do not rely only on color.
- Validation messages shall be associated visually with the relevant field.
- Buttons and interactive controls shall use descriptive text or accessible labels.
- Disabled controls shall remain visually distinguishable from enabled controls.

### Keyboard and Focus

- Interactive controls shall be reachable and usable with keyboard navigation.
- Visible focus indication shall be preserved.
- Dialogs used for Attachment removal shall place focus appropriately and allow keyboard operation.
- Focus shall not become trapped or lost after loading, validation, or API feedback.

### Color and Readability

- Text and interactive elements shall maintain readable contrast against their backgrounds.
- Status, priority, validation, and success/error meaning shall not be communicated by color alone.
- Text shall remain readable without requiring horizontal scrolling at supported responsive widths.

### Interaction Consistency

- Primary actions shall use consistent placement and styling where practical.
- Destructive actions such as Attachment removal shall be visually distinguishable from normal actions and require confirmation.
- Loading, success, validation, and failure feedback shall use consistent patterns throughout the application.

## 9. Visual Verification Checklist

Final visual verification was completed on the integrated Lab 2 application.

- [x] Zen Green primary, secondary, and pale-green colors are applied consistently.
- [x] Editable and read-only fields are visually distinguishable.
- [x] Validation messages appear beside or below the relevant fields.
- [x] Primary, secondary, and destructive actions have clear visual hierarchy.
- [x] Desktop layout displays without unintended clipping or overlap.
- [x] Tablet layout adapts without unintended clipping or overlap.
- [x] Mobile layout stacks content and controls appropriately.
- [x] Long text and attachment content remain readable at supported widths.
- [x] No unintended horizontal page scrolling occurs on desktop, tablet, or mobile.