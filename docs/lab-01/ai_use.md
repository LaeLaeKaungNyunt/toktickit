# Lab 1 — AI Use and Reflection

**LLM/agent used:** ChatGPT and Antigravity coding agent

## Selected Key Prompts

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Inspect the provided TokTickIT starter scaffold against the Issue #1 acceptance criteria without modifying any files. | I reviewed which parts were already configured and identified the remaining environment setup and verification tasks before making changes. |
| 2 | Explain the Lab 1 workflow and the relationship between main, lab1-staging, feature branches, Issues, Pull Requests, and peer review. | I used the explanation to follow the required Git and Kanban workflow step by step. |
| 3 | Help verify the frontend foundation using the existing React, TypeScript, Vite, Bootstrap, and Vitest scaffold. | I installed the provided dependencies and verified the build, running page, Bootstrap styling, and existing test setup instead of recreating the frontend. |
| 4 | Help verify PostgreSQL and Prisma connectivity without implementing the Category feature early. | I installed and started PostgreSQL, created the local TokTickIT database/user, validated Prisma, and kept the Category model for Issue #3. |
| 5 | Implement only the Issue #2 health check requirements without starting the category feature. | I reviewed and implemented the health endpoint and frontend Online/Offline behavior, then verified the success and failure cases. |
| 6 | Implement the Prisma Category model and an idempotent seed using upsert for Issue #3. | I created the model, migration, and seed, ran the seed twice, and queried PostgreSQL to confirm that only four rows existed. |
| 7 | Implement GET /api/categories using Prisma and return id and name in predictable order. | I added the route and verified it with the provided Supertest structure. |
| 8 | Complete the Issue #4 frontend category display and Vitest tests. | I connected the frontend to the category API, displayed the database categories, and implemented success and error UI tests. |
| 9 | Review the files changed before each Git commit and keep each commit limited to the current Issue. | I checked `git status` before staging and avoided committing `.env`, `node_modules`, generated files, or work belonging to later Issues. |

## Reflection

Using smaller and more specific prompts helped me understand what the AI was doing instead of asking it to complete the whole lab at once. I usually asked the AI to inspect or explain the existing scaffold first, then I reviewed the result before making a change.

One example where I did not blindly follow the first result was when the frontend TypeScript build generated extra `.js` files. I investigated why they appeared, removed the generated files, and restored the professor's original TypeScript configuration instead of committing unnecessary changes. I also did not follow Prisma's suggestion to manually create a table when the database was empty because the Category table was required to be created later through the Issue #3 Prisma migration.