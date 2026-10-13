import { test, expect, Page } from "@playwright/test";
import {
  loginAs,
  logout,
  switchViewport,
  waitForStaffDashboardLoaded,
  captureScreenshot,
  SCREENSHOT_IDS,
  TEST_USERS,
} from "./helpers.js";

/**
 * Capture both canonical lab-04 screenshot ID and short screenshot ID
 */
async function captureTargetScreenshot(
  page: Page,
  idKey: keyof typeof SCREENSHOT_IDS,
  shortId: string
): Promise<void> {
  await captureScreenshot(page, SCREENSHOT_IDS[idKey]);
  await captureScreenshot(page, shortId);
}

/**
 * Helper to create an isolated ticket through Requester Portal UI
 */
async function createTicketViaUI(
  page: Page,
  summary: string,
  description: string
): Promise<string> {
  await loginAs(page, "requester");

  // Navigate to Create Ticket tab
  await page.locator(".nav-tabs").getByRole("button", { name: "Create Ticket" }).click();
  await expect(page.getByText("Create IT Support Ticket")).toBeVisible({ timeout: 10000 });

  // Wait for categories & systems reference data to load
  await expect(page.locator("#ticket-category option")).not.toHaveCount(1, { timeout: 10000 });
  await page.locator("#ticket-category").selectOption({ index: 1 });

  await expect(page.locator("#ticket-system option")).not.toHaveCount(1, { timeout: 10000 });
  await page.locator("#ticket-system").selectOption({ index: 1 });

  await page.locator("#ticket-priority").selectOption("High");
  await page.locator("#ticket-summary").fill(summary);
  await page.locator("#ticket-description").fill(description);

  await page.locator("button[type='submit']").click();
  await expect(page.getByText("Ticket Created Successfully")).toBeVisible({ timeout: 10000 });

  const badge = page.locator(".card-header .badge");
  await expect(badge).toBeVisible();
  const ticketNumber = (await badge.textContent())?.trim() || "";
  expect(ticketNumber).toMatch(/^TKT-\d{4}-\d{5}$/);

  await logout(page);
  return ticketNumber;
}

/**
 * Helper for IT Staff to find and open a ticket in Queue
 */
async function openTicketInQueue(page: Page, ticketNumber: string): Promise<void> {
  const queueTabBtn = page.getByRole("button", { name: "Queue", exact: true });
  await queueTabBtn.click();

  const searchInput = page.locator("#search-input");
  await searchInput.fill(ticketNumber);

  const row = page.locator("tr", { hasText: ticketNumber });
  await expect(row).toBeVisible({ timeout: 10000 });

  await row.getByRole("button", { name: "View Detail" }).click();

  await expect(
    page.getByRole("heading", { name: `Ticket ${ticketNumber}` })
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("heading", { name: "Actions Taken" })
  ).toBeVisible({ timeout: 10000 });
}

test.describe.serial("Lab 4 E2E — Cross-Role and Resilience (E2E-11 – E2E-14)", () => {
  let conflictTicketNumber: string;
  let advisoryTicketNumber: string;
  let formTestTicketNumber: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(90000);
    const page = await browser.newPage();
    const uniqueSuffix = Date.now().toString().slice(-6);

    conflictTicketNumber = await createTicketViaUI(
      page,
      `E2E Concurrency Test Ticket ${uniqueSuffix}`,
      "Simulated concurrent update conflict ticket across separate browser contexts."
    );

    advisoryTicketNumber = await createTicketViaUI(
      page,
      `E2E Advisory Resolution Ticket ${uniqueSuffix}`,
      "Requester advisory resolution toggle verification ticket."
    );

    formTestTicketNumber = await createTicketViaUI(
      page,
      `E2E Form Correction Ticket ${uniqueSuffix}`,
      "Form validation and data preservation verification ticket."
    );

    await page.close();
  });

  // -------------------------------------------------------------------------
  // E2E-11 — Concurrent Staff Update Conflict
  // -------------------------------------------------------------------------
  test("E2E-11 — Concurrent Staff Update Conflict", async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    // 1. Open two separate authenticated IT Staff browser contexts
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await switchViewport(pageA, "desktop");
      await switchViewport(pageB, "desktop");

      // Staff A logs in
      await loginAs(pageA, "staff1");
      await openTicketInQueue(pageA, conflictTicketNumber);

      // Staff B logs in on separate context
      await loginAs(pageB, "staff2");
      await openTicketInQueue(pageB, conflictTicketNumber);

      // Both Staff A and Staff B now view the ticket at its initial version (status New)
      const selectA = pageA.locator("#status-transition-select");
      const selectB = pageB.locator("#status-transition-select");
      await expect(selectA).toBeVisible();
      await expect(selectB).toBeVisible();

      // 2. Staff A makes a successful update (New -> Open)
      await selectA.selectOption("Open");
      await pageA.getByRole("button", { name: "Transition" }).click();
      await expect(pageA.getByText("Status updated to Open.")).toBeVisible({ timeout: 10000 });
      await expect(pageA.locator(".badge", { hasText: "Open" }).first()).toBeVisible();

      // 3. Staff B submits a conflicting update using stale version metadata
      // (Staff B's page still holds the original updatedAt timestamp from when ticket was New)
      await selectB.selectOption("In Progress");
      await pageB.getByRole("button", { name: "Transition" }).click();

      // 4. Verify Staff B receives safe HTTP 409 conflict feedback in the UI
      const conflictAlert = pageB.locator(".alert-danger", {
        hasText: /modified|stale update rejected/i,
      });
      await expect(conflictAlert).toBeVisible({ timeout: 10000 });

      // 5. Capture UI-SS-12: stale conflict feedback
      await captureTargetScreenshot(pageB, "staleUpdateConflict", "UI-SS-12");

      // 6. Verify Staff A's successful update remains intact
      await expect(pageA.locator(".badge", { hasText: "Open" }).first()).toBeVisible();

      // Verify direct server query/reload reflects Staff A's update ("Open"), not Staff B's stale attempt
      await pageB.reload();
      await expect(pageB.locator(".badge", { hasText: "Open" }).first()).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  // -------------------------------------------------------------------------
  // E2E-12 — Requester Advisory Resolution Toggle
  // -------------------------------------------------------------------------
  test("E2E-12 — Requester Advisory Resolution Toggle", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
    // 1. Log in as Requester Alice (ticket owner)
    await loginAs(page, "requester");
    await switchViewport(page, "desktop");

    // 2. Open owned ticket eligible for advisory resolution toggle
    await page.locator(".nav-tabs").getByRole("button", { name: "My Tickets" }).click();
    await page.locator("#search-tickets-input").fill(advisoryTicketNumber);
    await page.getByRole("button", { name: "Search" }).click();

    const ticketRow = page.locator("tr", { hasText: advisoryTicketNumber });
    await expect(ticketRow).toBeVisible({ timeout: 10000 });
    await ticketRow.click();

    // Verify detail loaded
    await expect(
      page.getByRole("heading", { name: advisoryTicketNumber, exact: true })
    ).toBeVisible({ timeout: 10000 });

    // Initial state: not resolved by requester
    const toggleButton = page.getByRole("button", {
      name: /Mark as Resolved|Resolved by You/i,
    });
    await expect(toggleButton).toBeVisible();
    await expect(toggleButton).toHaveText("Mark as Resolved");

    const formalStatusBadge = page.locator(".badge.bg-warning");
    await expect(formalStatusBadge).toBeVisible();
    const initialStatusText = (await formalStatusBadge.textContent())?.trim() || "";
    expect(initialStatusText).toBe("New");

    // 3. Change advisory resolved state to RESOLVED
    await toggleButton.click();
    await expect(toggleButton).toHaveText("✓ Resolved by You", { timeout: 10000 });

    // 4. Verify formal IT Staff ticket status is NOT silently changed
    await expect(formalStatusBadge).toHaveText(initialStatusText);

    // 5. Verify advisory value persists: go back to My Tickets and re-open the ticket
    await page.getByRole("button", { name: /Back to My Tickets/i }).click();
    await page.locator("#search-tickets-input").fill(advisoryTicketNumber);
    await page.getByRole("button", { name: "Search" }).click();
    await page.locator("tr", { hasText: advisoryTicketNumber }).click();

    await expect(
      page.getByRole("heading", { name: advisoryTicketNumber, exact: true })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: "✓ Resolved by You" })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".badge.bg-warning")).toHaveText(initialStatusText);

    // 6. Toggle advisory resolution back to un-resolved
    await page.getByRole("button", { name: "✓ Resolved by You" }).click();
    await expect(
      page.getByRole("button", { name: "Mark as Resolved" })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".badge.bg-warning")).toHaveText(initialStatusText);

    // 7. Verify Requester cannot access formal staff resolution controls
    await expect(page.locator("#status-transition-select")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Transition" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Resolve Ticket" })).not.toBeVisible();
    await expect(page.locator("#resolution-summary-input")).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // E2E-13 — Invalid Form Correction and Data Preservation
  // -------------------------------------------------------------------------
  test("E2E-13 — Invalid Form Correction and Data Preservation", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
    // 1. Log in as IT Staff
    await loginAs(page, "staff1");
    await switchViewport(page, "desktop");

    // Open ticket and ensure it is in Open status to allow actions
    await openTicketInQueue(page, formTestTicketNumber);

    const statusSelect = page.locator("#status-transition-select");
    const currentStatus = await statusSelect.inputValue();
    if (currentStatus !== "Open") {
      await statusSelect.selectOption("Open");
      await page.getByRole("button", { name: "Transition" }).click();
      await expect(page.getByText("Status updated to Open.")).toBeVisible({ timeout: 10000 });
    }

    // 2. Open Add Action Taken form
    await page.getByRole("button", { name: /Add Action Taken/i }).click();
    const modal = page.locator(".modal.show");
    await expect(modal).toBeVisible({ timeout: 10000 });

    // 3. Fill partial valid data, leaving required Description empty
    const testResultText = "Signal continuity verified with spectrum analyzer.";
    await page.locator("#action-assignee-select").selectOption({ label: "Alex Tech (IT Staff)" });
    await page.locator("#action-result-input").fill(testResultText);
    await page.locator("#action-description-input").fill("");

    // Submit invalid input
    await modal.locator(".modal-footer").getByRole("button", { name: "Save Action" }).click();

    // 4. Verify accessible, useful validation feedback
    const validationAlert = modal.locator(".alert-danger");
    await expect(validationAlert).toBeVisible();
    await expect(validationAlert).toHaveText(/Description is required/i);

    // 5. Verify other valid user-entered values remain intact
    await expect(page.locator("#action-result-input")).toHaveValue(testResultText);
    const selectedAssignee = await page.locator("#action-assignee-select").inputValue();
    expect(selectedAssignee).not.toBe("");

    // 6. Correct the invalid field
    const testDescriptionText = "Tested primary patch lead and reseated RJ-45 terminating connector.";
    await page.locator("#action-description-input").fill(testDescriptionText);

    // 7. Submit successfully
    await modal.locator(".modal-footer").getByRole("button", { name: "Save Action" }).click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // 8. Verify persisted results in Actions Taken list
    await expect(page.getByText(testDescriptionText)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(testResultText)).toBeVisible();
    await expect(page.getByText(/Assigned Staff:\s*Alex Tech/i)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // E2E-14 — Labs 1–3 Workflow Regression
  // -------------------------------------------------------------------------
  test("E2E-14 — Labs 1–3 Workflow Regression", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
    await switchViewport(page, "desktop");

    // --- Sub-workflow 1: Authentication and logout ---
    await loginAs(page, "requester");
    await expect(page.getByText("Alice Smith")).toBeVisible();
    await expect(page.getByText("Requester", { exact: true })).toBeVisible();
    await logout(page);
    await expect(page.getByRole("heading", { name: "Sign In to TokTickIT" })).toBeVisible();

    // --- Sub-workflow 2: Requester ticket submission and owned-ticket access ---
    await loginAs(page, "requester");
    await page.locator(".nav-tabs").getByRole("button", { name: "Create Ticket" }).click();
    await expect(page.getByText("Create IT Support Ticket")).toBeVisible({ timeout: 10000 });

    await expect(page.locator("#ticket-category option")).not.toHaveCount(1, { timeout: 10000 });
    await page.locator("#ticket-category").selectOption({ index: 1 });
    await expect(page.locator("#ticket-system option")).not.toHaveCount(1, { timeout: 10000 });
    await page.locator("#ticket-system").selectOption({ index: 1 });
    await page.locator("#ticket-priority").selectOption("Medium");

    const regSuffix = Date.now().toString().slice(-6);
    const regSummary = `Regression Workflow Ticket ${regSuffix}`;
    await page.locator("#ticket-summary").fill(regSummary);
    await page
      .locator("#ticket-description")
      .fill("Comprehensive automated regression ticket covering Labs 1-3 baseline flows.");
    await page.locator("button[type='submit']").click();

    await expect(page.getByText("Ticket Created Successfully")).toBeVisible({ timeout: 10000 });
    const regTicketNumber = (await page.locator(".card-header .badge").textContent())?.trim() || "";
    expect(regTicketNumber).toMatch(/^TKT-\d{4}-\d{5}$/);

    // Open submitted ticket through My Tickets
    await page.locator(".nav-tabs").getByRole("button", { name: "My Tickets" }).click();
    await page.locator("#search-tickets-input").fill(regSummary);
    await page.getByRole("button", { name: "Search" }).click();
    await page.locator("tr", { hasText: regSummary }).click();

    await expect(
      page.getByRole("heading", { name: regTicketNumber, exact: true })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(regSummary)).toBeVisible();
    await logout(page);

    // --- Sub-workflow 3: IT Staff queue and ticket detail ---
    await loginAs(page, "staff1");
    await waitForStaffDashboardLoaded(page);

    await page.getByRole("button", { name: "Queue", exact: true }).click();
    await expect(page.locator("#search-input")).toBeVisible({ timeout: 10000 });
    await page.locator("#search-input").fill(regTicketNumber);

    const queueRow = page.locator("tr", { hasText: regTicketNumber });
    await expect(queueRow).toBeVisible({ timeout: 10000 });
    await queueRow.getByRole("button", { name: "View Detail" }).click();

    await expect(page.getByRole("heading", { name: `Ticket ${regTicketNumber}` })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
    await expect(page.getByText(/Public Comments/i).first()).toBeVisible();
    await expect(page.getByText(/Internal Notes/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Post Public Comment" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Post Internal Note" })).toBeVisible();
    await logout(page);

    // --- Sub-workflow 4: Administrator User Management ---
    await loginAs(page, "admin");
    await expect(page.getByRole("button", { name: "User Management" })).toBeVisible();
    await page.getByRole("button", { name: "User Management" }).click();

    const adminSearch = page.getByPlaceholder("Search by name or email...");
    await expect(adminSearch).toBeVisible({ timeout: 10000 });
    await adminSearch.fill("Sam Staff");

    await expect(page.locator("td", { hasText: "Sam Staff" }).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("td", { hasText: "staff1@university.edu" }).first()).toBeVisible();
    await expect(page.locator("td", { hasText: "IT Staff" }).first()).toBeVisible();
    await logout(page);
  });
});
