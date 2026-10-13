# Lab 4 AI Use and Reflection

## 1. AI Tools Used

During TokTickIT Lab 4, two artificial intelligence tools were used to support planning, implementation, verification, and documentation:

- **ChatGPT (GPT-5.6 Sol):** Used primarily as a planning and specification assistant. It helped break down the Lab 4 assignment requirements into manageable issues, clarify edge cases (such as the resolution gate rules and optimistic locking mechanism), prepare structured prompts for implementation, interpret test runner logs, and draft pull request descriptions.
- **Antigravity Coding Agent:** Used as the coding agent inside the development environment. It inspected the repository, created database migrations, implemented backend Express routes and React components, wrote Vitest unit and Playwright end-to-end tests, executed terminal build and test commands, and compiled verification evidence.

All AI suggestions and generated code were treated as proposals. Nothing was committed without automated testing, code inspection, and peer review.

---

## 2. Representative AI Prompts

The following prompts represent the actual instructions used across the Lab 4 milestones. They are representative paraphrases based on the project records and commit history:

1. **Engineering Contract and Specification (Issue #44):**
   > "Review the Lab 4 assignment requirements and help define the engineering contract before coding. Specify data models for Actions Taken, the status transition matrix, resolution gates, IT Staff and Requester Dashboards, and API schemas while preserving Labs 1–3 functionality."

2. **Actions Taken Data Model and API (Issue #45):**
   > "Implement the Prisma migration and Express routes for Actions Taken under `/api/v1/tickets/:ticketId/actions`. Enforce required fields, authenticated performer derivation, optimistic concurrency with `expectedUpdatedAt`, and `TicketEvent` audit logging with full test coverage."

3. **Actions Taken UI and Ticket Resolution Workflow (Issue #46):**
   > "Build the React interface for Actions Taken and formal Ticket Resolution. Enforce the resolution gate so tickets cannot be marked Resolved without at least one Completed action and a non-blank resolution summary. Add modal validation and error handling."

4. **IT Staff Operational Dashboard (Issue #47):**
   > "Implement the IT Staff Operational Dashboard route `GET /api/v1/staff/dashboard` and UI component. Calculate unassigned, urgent, and assigned ticket metrics, show the 5 most recent urgent items and active assigned actions, and add `assignedToMe` and multi-priority filtering to the ticket queue."

5. **Requester Dashboard (Issue #48):**
   > "Create the Requester Dashboard with strict ownership isolation. Calculate active tickets, Waiting for Requester attention metrics, and recently resolved tickets with fallback sorting for legacy records. Ensure requesters cannot access other users' data."

6. **Authorization and Optimistic Concurrency (Issue #49):**
   > "Add comprehensive backend integration tests covering role boundaries, requester data isolation, and optimistic concurrency. Verify that stale updates receive HTTP 409 Conflict without overwriting newer data, and confirm Labs 1–3 regression passes."

7. **Playwright E2E and Visual Verification (Issue #50):**
   > "Implement 25 Playwright E2E scenarios for Lab 4 covering E2E-01 through E2E-14, responsive layouts on desktop, tablet, and mobile, keyboard accessibility, and performance-smoke checks. Capture all 15 required canonical screenshots."

8. **Release Documentation and Final Integration (Issue #51):**
   > "Update `docs/lab-04/tests.md` with actual test file paths, full AC traceability, and release baseline results. Create `reviewer.md` with verified GitHub PR records and update `README.md` with Lab 4 setup, seed, and demo instructions."

---

## 3. AI-Assisted Development Workflow

The development workflow combined specification-driven development, test-first practices, and AI assistance:

1. **Requirement Analysis:** Read the course guidelines and understand the user stories and acceptance criteria.
2. **Contract Specification:** Formulate detailed engineering specifications (`specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`) before writing any feature code.
3. **Branch Isolation:** Create a separate Git branch from `lab4-staging` for each discrete issue.
4. **Test-First Implementation:** Write failing test cases where applicable, then prompt the Antigravity agent to implement minimal code to make tests pass.
5. **Regression Verification:** Run full automated regression suites (573 tests) and production builds (`tsc`, `vite build`) to confirm no earlier functionality broke.
6. **Peer Review:** Open a Pull Request on GitHub with detailed evidence, assign a peer reviewer, address review comments, and merge into `lab4-staging`.

---

## 4. Personal Reflection

Working on Lab 4 showed me how AI can help manage a large, complex software project when used with structure. Instead of trying to build the entire dashboard and workflow system at once, I used AI to break the work into seven distinct issues, each with its own engineering contract, tests, and pull request. Antigravity was especially helpful for generating repetitive boilerplate, writing comprehensive integration test suites, and running end-to-end browser tests across viewports.

However, I quickly learned that AI output cannot be trusted without strict verification. During end-to-end testing, we found a subtle race condition where updating ticket priority in the frontend left the local timestamp stale, causing subsequent status changes to fail with a false 409 Conflict error. Finding and fixing that issue required understanding the optimistic locking design rather than just relying on AI to generate code.

Through this process, I gained a much deeper understanding of RESTful API design, role-based access control, transaction atomicity, and disciplined Git branching workflows. The biggest limitation of AI is that it can produce code that looks correct and passes simple unit tests while masking integration issues or subtle edge cases. Using AI as a fast assistant while maintaining human oversight and thorough testing was essential to successfully completing the sprint.

---

## 5. Academic Integrity and Verification

This submission follows the course academic integrity standards regarding AI assistance:

- AI tools (ChatGPT and Antigravity) were used and are fully documented in this record.
- No code was committed without running automated tests and inspecting diffs.
- Test execution was carried out by the Antigravity agent using the project test suites, and all passing results were verified against the repository baseline (573/573 tests passed).
- All pull requests were reviewed and approved by peer reviewers on GitHub before merging into staging.
