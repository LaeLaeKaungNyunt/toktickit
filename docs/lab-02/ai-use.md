# Lab 2 AI Use and Reflection

## AI Tools Used

I used ChatGPT to help interpret the Lab 2 requirements, prepare the engineering contract, review implementation decisions, verify test coverage, and check the final work against the labsheet. I also used the Antigravity coding agent to assist with implementation and testing based on the approved specifications.

## Selected Key Prompts

| Prompt | Selected Prompt / Instruction | My Reflection |
|---|---|---|
| 1. Plan Lab 2 | Review the Lab 2 requirements and identify the required engineering contract, features, tests, Git workflow, and implementation order before writing code. | This helped keep the implementation within the required Lab 2 scope. |
| 2. Define Engineering Contract | Prepare `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` before implementation, with requirements, business rules, acceptance criteria, and test traceability. | Defining the contract first made later implementation and review clearer. |
| 3. Requester Context | Implement the Development Requester context and seed data according to the approved specification, including active/inactive requester behavior and requester isolation. | The specification made the requester rules easier to implement consistently. |
| 4. Create Ticket | Implement Create Ticket from the approved acceptance criteria, including validation, backend-generated ticket numbers, New status, ownership, and Ticket Events. | Detailed acceptance criteria reduced ambiguity during implementation. |
| 5. My Tickets | Implement My Tickets with requester ownership, search, filters, sorting, pagination, empty state, and no-results state. | Breaking the feature into specific behaviors made testing easier. |
| 6. Ticket Detail and Attachments | Implement read-only Ticket Detail and attachment upload, download, and soft removal using PostgreSQL metadata and SeaweedFS binary storage. | This required careful checking of ownership, storage, and removal behavior. |
| 7. Verify Tests | Run and review the Lab 2 server and client tests and compare the results with the acceptance criteria and test specification. | Test results helped identify whether the implementation actually matched the contract. |
| 8. Final Lab 2 Review | Review the completed Lab 2 work against the labsheet, engineering contract, Git workflow, test evidence, and required report evidence before submission. | This helped identify missing documentation and evidence before final submission. |

## My Reflection

AI was most useful when I gave it specific requirements and acceptance criteria instead of broad instructions. I still needed to review the generated work, verify tests, check the implementation against the Lab 2 specification, and correct missing documentation or evidence.