# Lab 3 AI Use and Reflection

## AI Tools Used

- **ChatGPT** — used as the specification and review assistant to interpret the Lab 3 requirements, define the engineering contract, review implementation decisions, and check work against the acceptance criteria.
- **Antigravity Coding Agent** — used to implement the approved specification, tests, migrations, UI, API behavior, and E2E verification.

## Selected Key Prompts

The following are representative prompts used during Lab 3.

1. **Engineering contract**
   > Review the Lab 3 requirements and help define the engineering contract before implementation. Keep Lab 2 functionality working and clearly separate Requester, IT Staff, and Administrator permissions.

2. **Authentication and migration**
   > Implement the authentication foundation and migrate the existing Development Requesters into Users without losing existing Ticket, Attachment, Category, or requester ownership data.

3. **Authorization and regression**
   > Replace the temporary Development Requester selector with authenticated Requester identity. Enforce ownership and role authorization on the backend and keep the existing Lab 2 Requester workflows passing.

4. **IT Staff queue**
   > Implement the IT Staff ticket queue according to the approved specification, including search, filters, sorting, pagination, assignment state, responsive behavior, and authorized ticket-detail access.

5. **Ticket workflow**
   > Implement the approved IT Staff ticket-detail operations. Follow the defined status-transition matrix and role restrictions, and do not add Lab 4 features such as Actions Taken, SLA, escalation, or notifications.

6. **Comments, notes, and attachments**
   > Verify Public Comments, Internal Notes, Requester resolution indication, and attachment continuity against the Lab 3 authorization rules. Check both UI behavior and direct API authorization.

7. **Administrator management**
   > Implement Administrator User Management with user listing, search, role filtering, create/edit, password reset, self-deactivation protection, last-active-Administrator protection, and backend authorization.

8. **E2E and visual verification**
   > Review the Lab 3 E2E coverage against the acceptance criteria. Make the tests deterministic and verify authentication, Requester, IT Staff, and Administrator workflows across desktop, tablet, and mobile.

9. **Final verification**
   > Run the complete server, client, build, and Playwright verification. Check for regressions, authorization gaps, missing responsive evidence, and any mismatch with the approved Lab 3 specification.

## My Reflection

Using AI was most useful when I separated specification work from implementation work. I used ChatGPT first to understand the requirements, define the rules, and review whether the implementation matched the contract. This helped catch issues such as authorization boundaries, migration details, status workflow rules, and missing E2E coverage before accepting the work.

The Antigravity coding agent was useful for implementing larger changes across the client, server, database, and tests. However, I still had to review its work against the specification and test results. Some implementation details needed correction after review, so passing code alone was not enough.

Overall, the specification-agent and coding-agent workflow made the development process more structured. The specification gave the coding agent a clear target, while the tests, review, and Pull Request process gave me evidence that the implementation actually met the Lab 3 requirements.