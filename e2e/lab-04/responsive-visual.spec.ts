import { test, expect, Page } from "@playwright/test";
import {
  loginAs,
  logout,
  switchViewport,
  waitForStaffDashboardLoaded,
  waitForRequesterDashboardLoaded,
  captureScreenshot,
  SCREENSHOT_IDS,
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
 * Assert that the page does not produce unexpected horizontal page-level scrollbars
 */
async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
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

  await page.locator(".nav-tabs").getByRole("button", { name: "Create Ticket" }).click();
  await expect(page.getByText("Create IT Support Ticket")).toBeVisible({ timeout: 10000 });

  await expect(page.locator("#ticket-category option")).not.toHaveCount(1, { timeout: 10000 });
  await page.locator("#ticket-category").selectOption({ index: 1 });

  await expect(page.locator("#ticket-system option")).not.toHaveCount(1, { timeout: 10000 });
  await page.locator("#ticket-system").selectOption({ index: 1 });

  await page.locator("#ticket-priority").selectOption("Medium");
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

  // Support both desktop table rows and mobile responsive card layouts
  const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
  const item = isMobile
    ? page.locator(".staff-queue-mobile-card", { hasText: ticketNumber })
    : page.locator("tr", { hasText: ticketNumber });

  await expect(item.first()).toBeVisible({ timeout: 10000 });
  await item.first().getByRole("button", { name: "View Detail" }).click();

  await expect(
    page.getByRole("heading", { name: `Ticket ${ticketNumber}` })
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("heading", { name: "Actions Taken" })
  ).toBeVisible({ timeout: 10000 });
}

test.describe.serial("Lab 4 E2E — Responsive Visual Verification (UI-01 – UI-07, UI-SS-02, UI-SS-04, UI-SS-13, UI-SS-14)", () => {
  let emptyStateTicketNumber: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    const page = await browser.newPage();
    const uniqueSuffix = Date.now().toString().slice(-6);

    emptyStateTicketNumber = await createTicketViaUI(
      page,
      `E2E Empty Actions Ticket ${uniqueSuffix}`,
      "Newly created ticket with no actions taken recorded yet."
    );

    await page.close();
  });

  // -------------------------------------------------------------------------
  // UI-01 to UI-03 — IT Staff Dashboard Responsive Layout (Desktop, Tablet, Mobile)
  // -------------------------------------------------------------------------
  test("UI-01 to UI-03 — IT Staff Dashboard Responsive Layout & UI-SS-02, UI-SS-13", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60000);
    await loginAs(page, "staff1");

    // 1. Desktop Viewport (1280 × 800)
    await switchViewport(page, "desktop");
    await waitForStaffDashboardLoaded(page);
    await expect(page.getByRole("heading", { name: "IT Staff Dashboard" })).toBeVisible();
    await expect(page.getByText("Operations Center")).toBeVisible();
    await expect(page.getByText("Unassigned Tickets")).toBeVisible();
    await expect(page.getByText("My Assigned Tickets")).toBeVisible();
    await expect(page.getByText("Urgent Tickets", { exact: true })).toBeVisible();
    await expect(page.getByText("My Active Actions")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    // 2. Tablet Viewport (768 × 1024)
    await switchViewport(page, "tablet");
    await expect(page.getByRole("heading", { name: "IT Staff Dashboard" })).toBeVisible();
    await expect(page.getByText("Status Overview")).toBeVisible();
    await expect(page.getByText("Urgent Tickets Queue")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    // Capture UI-SS-13: Tablet responsive layout
    await captureTargetScreenshot(page, "tabletResponsiveLayout", "UI-SS-13");

    // 3. Mobile Viewport (375 × 667)
    await switchViewport(page, "mobile");
    await expect(page.getByRole("heading", { name: "IT Staff Dashboard" })).toBeVisible();
    await expect(page.getByText("Operations Center")).toBeVisible();
    // Cards stack cleanly and urgent queue remains accessible
    await expect(page.getByText("Urgent Tickets Queue")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    // Capture UI-SS-02: IT Staff Dashboard mobile
    await captureTargetScreenshot(page, "staffDashboardMobile", "UI-SS-02");

    await logout(page);
  });

  // -------------------------------------------------------------------------
  // UI-04 to UI-06 — Requester Dashboard Responsive Layout (Desktop, Tablet, Mobile)
  // -------------------------------------------------------------------------
  test("UI-04 to UI-06 — Requester Dashboard Responsive Layout, Drilldown & UI-SS-04", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60000);
    await loginAs(page, "requesterBob");

    // 1. Desktop Viewport (1280 × 800)
    await switchViewport(page, "desktop");
    await waitForRequesterDashboardLoaded(page);
    await expect(page.getByRole("heading", { name: /My Dashboard/i })).toBeVisible();
    await expect(page.getByTestId("metric-my-active-tickets")).toBeVisible();
    await expect(page.getByTestId("metric-waiting-for-me")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tickets by Status" })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    // 2. Tablet Viewport (768 × 1024)
    await switchViewport(page, "tablet");
    await expect(page.getByRole("heading", { name: /My Dashboard/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Needs My Attention" })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    // 3. Mobile Viewport (375 × 667)
    await switchViewport(page, "mobile");
    await expect(page.getByRole("heading", { name: /My Dashboard/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Needs My Attention" })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    // Capture UI-SS-04: Requester Dashboard mobile
    await captureTargetScreenshot(page, "requesterDashboardMobile", "UI-SS-04");

    // 4. Ticket drilldown on mobile remains accessible
    const attentionSection = page.locator("#needs-attention");
    await expect(attentionSection).toBeVisible();
    const firstAttentionItem = attentionSection.locator(".list-group-item").first();
    await expect(firstAttentionItem).toBeVisible({ timeout: 10000 });

    const ticketNumberEl = firstAttentionItem.locator(".text-primary");
    const attentionTicketNumber = (await ticketNumberEl.textContent())?.trim() || "";
    expect(attentionTicketNumber).toMatch(/^TKT-\d{4}-\d{5}$/);

    // Click to navigate on mobile
    await firstAttentionItem.click();

    // Verify navigation reaches ticket detail
    await expect(
      page.getByRole("heading", { name: attentionTicketNumber, exact: true })
    ).toBeVisible({ timeout: 10000 });
    await assertNoHorizontalOverflow(page);

    await logout(page);
  });

  // -------------------------------------------------------------------------
  // UI-07 — Mobile Actions Taken and Modal Accessibility
  // -------------------------------------------------------------------------
  test("UI-07 — Mobile Actions Taken and Modal Accessibility", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
    // 1. Log in as IT Staff on mobile viewport
    await switchViewport(page, "mobile");
    await loginAs(page, "staff1");

    // 2. Navigate to Ticket Queue and open empty state ticket
    await openTicketInQueue(page, emptyStateTicketNumber);
    await assertNoHorizontalOverflow(page);

    // 3. Actions Taken section is readable and fits within mobile width
    const actionsHeading = page.getByRole("heading", { name: "Actions Taken" });
    await expect(actionsHeading).toBeVisible();

    const addActionBtn = page.getByRole("button", { name: /Add Action Taken/i });
    await expect(addActionBtn).toBeVisible();

    // 4. Open Create Action Taken modal on mobile
    await addActionBtn.click();
    const modal = page.locator(".modal.show");
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Verify all form fields and controls are accessible on mobile
    await expect(page.locator("#action-date-time-input")).toBeVisible();
    await expect(page.locator("#action-assignee-select")).toBeVisible();
    await expect(page.locator("#follow-up-required-check")).toBeVisible();
    await expect(page.locator("#action-description-input")).toBeVisible();
    await expect(page.locator("#action-result-input")).toBeVisible();

    // Verify submit and cancel buttons are accessible in modal footer
    const saveBtn = modal.locator(".modal-footer").getByRole("button", { name: "Save Action" });
    const cancelBtn = modal.locator(".modal-footer").getByRole("button", { name: "Cancel" });
    await expect(saveBtn).toBeVisible();
    await expect(cancelBtn).toBeVisible();

    // Close modal
    await cancelBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    await logout(page);
  });

  // -------------------------------------------------------------------------
  // UI-14 — Real Empty State Verification & UI-SS-14
  // -------------------------------------------------------------------------
  test("UI-14 — Real Empty State Verification & UI-SS-14", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
    await switchViewport(page, "desktop");
    await loginAs(page, "staff1");

    // Open ticket with zero recorded actions taken
    await openTicketInQueue(page, emptyStateTicketNumber);

    // Verify genuine empty-state text and styling
    const emptyStateMessage = page.getByText(
      "No actions taken have been recorded for this ticket."
    );
    await expect(emptyStateMessage).toBeVisible({ timeout: 10000 });

    // Verify "+ Add Action Taken" button is prominently displayed
    await expect(page.getByRole("button", { name: /Add Action Taken/i })).toBeVisible();

    // Capture UI-SS-14: Empty dashboard or actions state
    await captureTargetScreenshot(page, "emptyState", "UI-SS-14");

    await logout(page);
  });
});
