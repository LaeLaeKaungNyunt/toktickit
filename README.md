# TokTickIT

TokTickIT is an IT service desk web application developed for the Software Engineering course. The project has evolved across four incremental development sprints:
- **Lab 1:** Project foundation, health check, and request category seeding.
- **Lab 2:** Requester ticketing MVP with attachments, search, filtering, and object storage.
- **Lab 3:** Authentication foundation, role-based access control (Requester, IT Staff, Administrator), ticket queue, public comments, internal notes, and administrator user management.
- **Lab 4:** Actions Taken lifecycle, formal ticket resolution gates, IT Staff Operational Dashboard, Requester Dashboard with attention tracking, optimistic concurrency, and responsive end-to-end verification.

---

## Technology Stack

### Frontend
- React 18
- TypeScript
- Vite
- Bootstrap 5 (Zen Green design theme)

### Backend
- Node.js
- Express
- TypeScript
- Prisma ORM 5

### Database and Storage
- PostgreSQL
- SeaweedFS (S3-compatible object storage for attachments)

### Testing and Verification
- Vitest + React Testing Library (Frontend unit and integration testing)
- Vitest + Supertest (Backend API and transaction testing)
- Playwright (End-to-end, multi-viewport responsive, and visual regression testing)

---

## Prerequisites

Before running the project locally, ensure the following are installed:
- Node.js (v18+ recommended; verified on Node v24) and npm
- PostgreSQL (running locally or via container on port 5432)
- SeaweedFS (for attachment storage)

---

## Setup and Installation

### 1. Repository Setup

Clone the repository and install root and package dependencies:

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install

# Install root dependencies (including Playwright test runner)
cd ..
npm install
```

### 2. Environment Configuration

Copy the example environment files for both backend and frontend:

```bash
# Server configuration
cp server/.env.example server/.env

# Client configuration
cp client/.env.example client/.env
```

Ensure `server/.env` contains your PostgreSQL connection string:
```env
DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit?schema=public"
PORT=3000
```

Ensure `client/.env` points to the backend API:
```env
VITE_API_URL="http://localhost:3000"
```

*(Do not commit actual `.env` files).*

### 3. SeaweedFS (Attachment Storage)

Start SeaweedFS in a separate terminal:

```bash
weed mini
```

SeaweedFS provides local S3-compatible object storage for ticket attachments.

### 4. Database Migration and Seeding

Run the Prisma migration to initialize the database schema, followed by the idempotent seed script:

```bash
cd server
npm run prisma:migrate
npm run prisma:seed
```

The seed script creates initial categories, test accounts, and realistic demonstration tickets across all eight statuses.

---

## Running the Application

Start the backend and frontend in separate terminals:

### Backend Server
```bash
cd server
npm run dev
```
The API server runs at **http://localhost:3000**.

### Frontend Client
```bash
cd client
npm run dev
```
The React application runs at **http://localhost:5173**.

---

## Seeded Test Accounts

The seed script initializes accounts with the default password `Password123!`:

| Role | Name | Email | Default Password |
|---|---|---|---|
| **Requester** | Alice Smith | `alice.smith@university.edu` | `Password123!` |
| **Requester** | Bob Jones | `bob.jones@university.edu` | `Password123!` |
| **IT Staff** | Sam Staff | `staff1@university.edu` | `Password123!` |
| **IT Staff** | Alex Tech | `staff2@university.edu` | `Password123!` |
| **Administrator** | Admin User | `admin@university.edu` | `Password123!` |

---

## Running Automated Tests

Run test suites from the project root using root scripts, or individually within each package:

### Root Convenience Commands
```bash
# Run all frontend tests
npm run test:client

# Run all backend API and integration tests
npm run test:server

# Run Playwright E2E tests across viewports
npx playwright test e2e/lab-03
npx playwright test e2e/lab-04

# Run production builds
npm run build:client
npm run build:server
```

### Package-Specific Test Commands
```bash
# Frontend Vitest suite (client/)
cd client
npm test

# Backend Vitest suite (server/)
cd server
npm test
```

---

## Lab 4 Features Overview

Lab 4 completes the service desk workflow with core operational capabilities:

1. **Actions Taken Lifecycle:**
   - IT Staff and Administrators can log individual work items (**Actions Taken**) against tickets with date/time, description, result, optional staff assignment, and follow-up notes.
   - Performed-by identity is derived automatically from the authenticated session.
   - Actions transition through `Active` → `Completed` or `Active` → `Cancelled`. Terminal states are immutable.
2. **Requester Read-Only Visibility:**
   - Requesters can view the audit history of Actions Taken on their owned tickets.
   - Requesters cannot create, edit, reassign, complete, or cancel actions, and cannot access actions on other users' tickets.
3. **Formal Ticket Resolution Gate:**
   - Tickets cannot transition to `Resolved` status without verified completed work (at least one `Completed` Action Taken).
   - IT Staff must provide a mandatory non-blank **Resolution Summary** upon resolving a ticket.
4. **Optimistic Concurrency & Audit Trail:**
   - Updates to Actions Taken and ticket statuses pass `expectedUpdatedAt` timestamps to prevent silent overwrites. Stale requests safely return HTTP 409 Conflict.
   - Every creation, modification, and status transition is recorded atomically in `TicketEvent`.
5. **IT Staff Operational Dashboard:**
   - Summary metric cards: Unassigned tickets, Assigned to Me, Urgent work, and status breakdowns.
   - Work previews limited to 5 items: urgent work list and active assigned actions.
   - Ticket queue filtering: support for `assignedToMe=true` and combined priorities (`priority=Urgent,High`).
6. **Requester Dashboard:**
   - Metric cards: Total owned tickets, Active tickets, and Resolved tickets.
   - Attention Tracking: "Needs My Attention" section highlighting owned tickets in `Waiting for Requester` status.
   - Recently Resolved preview list with fallback sorting for legacy tickets.
7. **Responsive Zen Green Design & Accessibility:**
   - Full layout reflow across Desktop (1280×800), Tablet (768×1024), and Mobile (375×667) without horizontal overflow.
   - Accessible form inputs, visible focus rings, color-independent badges, and keyboard navigation.

---

## Lab 4 Demonstration Walkthrough

### 1. IT Staff Workflow
1. Navigate to `http://localhost:5173` and sign in as IT Staff (`staff1@university.edu` / `Password123!`).
2. The **IT Staff Dashboard** displays summary metrics, urgent tickets, and assigned actions.
3. Click the **Queue** tab; filter tickets using `assignedToMe` or priority filters.
4. Open a ticket (e.g., `TKT-2026-00001`) to view **Ticket Detail**.
5. Under **Actions Taken**, click **+ Add Action Taken**, fill in the action date, description, result, and save.
6. Click **Edit** on the action, update the status to **Completed**, and save.
7. Under **Status Transition**, choose **Resolved**; the **Ticket Resolution** modal appears.
8. Enter a Resolution Summary and confirm. The ticket becomes **Resolved** with resolution summary displayed.

### 2. Requester Workflow
1. Sign out and sign in as Requester (`alice.smith@university.edu` / `Password123!`).
2. The **Requester Dashboard** displays owned ticket counts, status distributions, and the **Needs My Attention** section.
3. Click a ticket from the attention list or recent activity to open **Ticket Detail**.
4. Scroll to **Actions Taken**; verify the history of actions is visible in read-only form with no edit controls.
5. Verify resolved tickets appear under **Recently Resolved Tickets** on the dashboard.

---

## Lab 4 Verification Baseline

The following results represent the verified release-candidate baseline established on `lab4-staging`:

| Verification Level | Scope | Result |
|---|---|:---:|
| **Frontend Unit & Integration** | 14 test files (`client/tests/`) | **163 / 163 passed** |
| **Backend API & Integration** | 18 test files (`server/tests/`) | **373 / 373 passed** |
| **Lab 3 Playwright E2E** | 3 spec files (`e2e/lab-03/`) | **12 / 12 passed** |
| **Lab 4 Playwright E2E** | 5 spec files (`e2e/lab-04/`) | **25 / 25 passed** |
| **Total Automated Tests** | 40 test files | **573 / 573 passed (100%)** |
| **Client Production Build** | `tsc && vite build` | **PASS (0 errors)** |
| **Server Production Build** | `tsc` | **PASS (0 errors)** |
| **Visual Evidence** | Desktop, tablet, and mobile | **15/15 canonical screenshots verified** |

*(Note: These figures represent the release-candidate baseline verified prior to final release into `main`).*

---

## Project Documentation

Detailed specifications, API contracts, test records, and peer reviews are documented under `docs/`:

- **Lab 4 Documentation:**
  - [Specification](file:///Users/laelaekaungnyunt/Desktop/SOFTWARE%20ENGINEERING/toktickit/docs/lab-04/specification.md): Complete Sprint 4 engineering contract, data models, and acceptance criteria.
  - [API Specification](file:///Users/laelaekaungnyunt/Desktop/SOFTWARE%20ENGINEERING/toktickit/docs/lab-04/api-spec.md): REST endpoint contracts, query parameters, payload schemas, and HTTP status codes.
  - [UI Specification](file:///Users/laelaekaungnyunt/Desktop/SOFTWARE%20ENGINEERING/toktickit/docs/lab-04/ui-spec.md): Component layouts, responsive rules, color tokens, and screenshot evidence table.
  - [Test Plan & Verification Report](file:///Users/laelaekaungnyunt/Desktop/SOFTWARE%20ENGINEERING/toktickit/docs/lab-04/tests.md): AC-01 through AC-30 traceability, actual test paths, and baseline verification counts.
  - [E2E & Visual Verification Record](file:///Users/laelaekaungnyunt/Desktop/SOFTWARE%20ENGINEERING/toktickit/docs/lab-04/e2e-visual-verification.md): Detailed Playwright test logs, responsive audit, and screenshot index.
  - [Peer Review Record](file:///Users/laelaekaungnyunt/Desktop/SOFTWARE%20ENGINEERING/toktickit/docs/lab-04/reviewer.md): Pull request reviews, reviewer feedback, author responses, and approvals.
  - [AI Use and Reflection](file:///Users/laelaekaungnyunt/Desktop/SOFTWARE%20ENGINEERING/toktickit/docs/lab-04/ai-use.md): Record of AI assistance, representative prompts, development workflow, and reflection.
  - [Screenshot Evidence](file:///Users/laelaekaungnyunt/Desktop/SOFTWARE%20ENGINEERING/toktickit/artifacts/lab-04/screenshots/): Canonical evidence screenshots (`UI-SS-01` through `UI-SS-15`).
- **Earlier Sprint Records:**
  - Lab 1: `docs/lab-01/`
  - Lab 2: `docs/lab-02/`
  - Lab 3: `docs/lab-03/`

---

## Development History and Sprints

* **Lab 1:** Project setup, Express API health checks, PostgreSQL schema definition, and request category seeding.
* **Lab 2:** Requester MVP, ticket creation, attachment upload/download via SeaweedFS, pagination, search, sorting, and Zen Green styling.
* **Lab 3:** JWT authentication, role authorization (Requester, IT Staff, Administrator), IT Staff queue, ticket operations, Public Comments, Internal Notes, and Administrator User Management.
* **Lab 4:** Actions Taken lifecycle, resolution gate enforcement, IT Staff Operational Dashboard, Requester Dashboard, optimistic locking, and responsive visual Playwright verification.
