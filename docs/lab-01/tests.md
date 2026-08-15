# Lab 1 — Test Plan and Evidence

All test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Supertest | GET /api/health returns 200 and status = ok | Passed |
| 2 | Supertest | GET /api/categories returns 4 seeded categories in id order | Passed |
| 3 | Vitest | TokTickIT heading renders | Passed |
| 4 | Vitest | Success state shows Online and the category list | Passed |
| 5 | Vitest | Error state shows Offline and a useful error message | Passed |

## Test Evidence

### Backend

The backend test suite verifies the health-check and category-list REST endpoints.

Final result:

- 2 test files passed
- 2 tests passed

### Frontend

The frontend test suite verifies the TokTickIT heading, successful system check, category display, and API failure state.

Final result:

- 1 test file passed
- 3 tests passed