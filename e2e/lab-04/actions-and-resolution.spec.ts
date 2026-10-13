import { test, expect, Page } from "@playwright/test";
import {
  loginAs,
  logout,
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
 * Helper to create a ticket through Requester Portal UI
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

test.describe.serial("Lab 4 E2E — Actions Taken and Ticket Resolution (E2E-01 – E2E-06)", () => {
  let ticketANumber: string;
  let ticketBNumber: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    const page = await browser.newPage();
    const uniqueSuffix = Date.now().toString().slice(-6);

    ticketANumber = await createTicketViaUI(
      page,
      `E2E Switch Failure Ticket A ${uniqueSuffix}`,
      "Switch port 14 intermittent hardware failure causing high packet loss on floor 2."
    );

    ticketBNumber = await createTicketViaUI(
      page,
      `E2E Core Firmware Ticket B ${uniqueSuffix}`,
      "Core distribution switch firmware upgrade and reboot schedule request."
    );

    await page.close();
  });

  // -------------------------------------------------------------------------
  // E2E-01 — Create Action Taken
  // -------------------------------------------------------------------------
  test("E2E-01 — Create Action Taken", async ({ page }) => {
    // 1. Log in as IT Staff
    await loginAs(page, "staff1");

    // 2. Open Ticket A in Queue
    await openTicketInQueue(page, ticketANumber);

    // Transition Ticket A from New to Open to allow active workflows
    const statusSelect = page.locator("#status-transition-select");
    await statusSelect.selectOption("Open");
    await page.getByRole("button", { name: "Transition" }).click();
    await expect(page.getByText("Status updated to Open.")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".badge", { hasText: "Open" }).first()).toBeVisible();

    // 3. Click + Add Action Taken
    await page.getByRole("button", { name: "+ Add Action Taken" }).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    // Verify Performed By is read-only displaying authenticated IT Staff member
    await expect(modal.locator(".form-control.bg-light", { hasText: "Sam Staff" })).toBeVisible();

    // Capture UI-SS-06: Create Action Taken form
    await captureTargetScreenshot(page, "createActionForm", "UI-SS-06");

    // Fill action form fields
    await modal
      .getByLabel("Action Description")
      .fill("Diagnosed network switch port failure and replaced faulty patch cable.");
    await modal
      .getByLabel("Result")
      .fill("Port link re-established with full duplex 1Gbps throughput.");

    // Save the Action Taken
    await modal.getByRole("button", { name: "Save Action" }).click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // 4. Verify record appears with correct details and performer attribution
    await expect(page.getByText("Action Taken recorded successfully.")).toBeVisible();
    await expect(
      page.getByText("Diagnosed network switch port failure and replaced faulty patch cable.")
    ).toBeVisible();
    await expect(
      page.getByText("Port link re-established with full duplex 1Gbps throughput.")
    ).toBeVisible();
    await expect(page.getByText(/Performed by:\s*Sam Staff/i)).toBeVisible();
    await expect(page.locator(".badge", { hasText: "Active" }).first()).toBeVisible();

    // Capture UI-SS-05: Ticket Detail with Actions Taken list
    await captureTargetScreenshot(page, "ticketDetailActionsList", "UI-SS-05");
  });

  // -------------------------------------------------------------------------
  // E2E-02 — Assign Action Taken
  // -------------------------------------------------------------------------
  test("E2E-02 — Assign Action Taken", async ({ page }) => {
    await loginAs(page, "staff1");
    await openTicketInQueue(page, ticketANumber);

    // Click Edit Action on the active action
    const editBtn = page.getByRole("button", { name: "Edit Action" }).first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    // Assign to another active IT Staff member (Alex Tech)
    const assigneeSelect = modal.locator("#edit-action-assignee-select");
    await assigneeSelect.selectOption({ label: "Alex Tech (IT Staff)" });

    // Capture UI-SS-07: Edit or assign Action Taken form
    await captureTargetScreenshot(page, "editActionForm", "UI-SS-07");

    // Save changes
    await modal.getByRole("button", { name: "Save Changes" }).click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Verify selected assignee is saved and displayed
    await expect(page.getByText("Action Taken updated successfully.")).toBeVisible();
    await expect(page.getByText(/Assigned Staff:\s*Alex Tech/i)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // E2E-03 — Edit and Complete Action Taken
  // -------------------------------------------------------------------------
  test("E2E-03 — Edit and Complete Action Taken", async ({ page }) => {
    await loginAs(page, "staff1");
    await openTicketInQueue(page, ticketANumber);

    // 1. Edit the action description & result
    const editBtn = page.getByRole("button", { name: "Edit Action" }).first();
    await editBtn.click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    const updatedDesc =
      "Diagnosed network switch port failure, replaced patch cable, and ran throughput tests.";
    const updatedResult =
      "Port link re-established with full duplex 1Gbps; 0 dropped packets measured.";
    await modal.locator("#edit-action-description-input").fill(updatedDesc);
    await modal.locator("#edit-action-result-input").fill(updatedResult);

    await modal.getByRole("button", { name: "Save Changes" }).click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText(updatedDesc)).toBeVisible();

    // 2. Mark it Completed
    const completeBtn = page.getByRole("button", { name: "Complete" }).first();
    await expect(completeBtn).toBeVisible();
    await completeBtn.click();

    await expect(page.getByText("Action marked as Completed.")).toBeVisible();
    await expect(page.locator(".badge", { hasText: "Completed" }).first()).toBeVisible();

    // Capture UI-SS-08: Completed Action Taken history
    await captureTargetScreenshot(page, "completedActionHistory", "UI-SS-08");

    // 3. Confirm immutable-state restrictions: Completed action card cannot be edited or cancelled
    await expect(page.getByRole("button", { name: "Edit Action" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Complete" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel Action" })).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // E2E-04 — Cancel Action Taken
  // -------------------------------------------------------------------------
  test("E2E-04 — Cancel Action Taken", async ({ page }) => {
    await loginAs(page, "staff1");
    await openTicketInQueue(page, ticketBNumber);

    // Transition Ticket B to Open
    const statusSelect = page.locator("#status-transition-select");
    await statusSelect.selectOption("Open");
    await page.getByRole("button", { name: "Transition" }).click();
    await expect(page.getByText("Status updated to Open.")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".badge", { hasText: "Open" }).first()).toBeVisible();

    // Create an Action Taken
    await page.getByRole("button", { name: "+ Add Action Taken" }).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    const actionDesc = "Scheduled maintenance to reboot distribution switch.";
    const actionResult = "Action superseded; switch recovered automatically.";
    await modal.getByLabel("Action Description").fill(actionDesc);
    await modal.getByLabel("Result").fill(actionResult);
    await modal.getByRole("button", { name: "Save Action" }).click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    await expect(page.getByText(actionDesc)).toBeVisible();
    await expect(page.locator(".badge", { hasText: "Active" }).first()).toBeVisible();

    // Cancel the action
    const cancelBtn = page.getByRole("button", { name: "Cancel Action" }).first();
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    await expect(page.getByText("Action marked as Cancelled.")).toBeVisible();
    await expect(page.locator(".badge", { hasText: "Cancelled" }).first()).toBeVisible();

    // Confirm immutable-state restrictions on Cancelled action
    await expect(page.getByRole("button", { name: "Edit Action" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Complete" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel Action" })).not.toBeVisible();

    // Verify cancelled action is excluded from active work lists on IT Staff Dashboard
    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    await expect(page.getByRole("heading", { name: "IT Staff Dashboard" })).toBeVisible();
    await expect(page.getByText(actionDesc)).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // E2E-05 — Resolution Gate
  // -------------------------------------------------------------------------
  test("E2E-05 — Resolution Gate", async ({ page }) => {
    await loginAs(page, "staff1");
    await openTicketInQueue(page, ticketBNumber);

    // Confirm Ticket B has status Open and NO Completed actions
    await expect(page.locator(".badge", { hasText: "Open" }).first()).toBeVisible();
    await expect(page.locator(".badge", { hasText: "Completed" })).not.toBeVisible();

    // Attempt to transition to Resolved
    const statusSelect = page.locator("#status-transition-select");
    await statusSelect.selectOption("Resolved");
    await page.getByRole("button", { name: "Transition" }).click();

    // Resolution modal opens
    const resolutionModal = page.getByRole("dialog");
    await expect(resolutionModal).toBeVisible();

    // Capture UI-SS-10: Ticket Resolution form
    await captureTargetScreenshot(page, "ticketResolutionForm", "UI-SS-10");

    // Verify rejection feedback: warning alert indicating completed action requirement
    const warningAlert = resolutionModal.getByText(
      /Cannot resolve ticket:\s*At least one completed Action Taken is required before resolution/i
    );
    await expect(warningAlert).toBeVisible();

    // Confirm Resolution button is disabled
    const confirmBtn = resolutionModal.getByRole("button", { name: "Confirm Resolution" });
    await expect(confirmBtn).toBeDisabled();

    // Capture UI-SS-11: Resolution validation error
    await captureTargetScreenshot(page, "resolutionValidationError", "UI-SS-11");

    // Entering summary text does NOT bypass the gate; button must remain disabled
    await resolutionModal
      .locator("#resolution-summary-input")
      .fill("Attempting to bypass resolution gate without completed work.");
    await expect(confirmBtn).toBeDisabled();

    // Close / Cancel the resolution modal
    await resolutionModal.getByRole("button", { name: "Cancel" }).click();
    await expect(resolutionModal).not.toBeVisible({ timeout: 10000 });

    // Verify Ticket status remains unchanged (still Open, not Resolved)
    await expect(page.locator(".badge", { hasText: "Open" }).first()).toBeVisible();
    await expect(page.locator(".badge", { hasText: "Resolved" })).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // E2E-06 — Successful Resolution
  // -------------------------------------------------------------------------
  test("E2E-06 — Successful Resolution", async ({ page }) => {
    await loginAs(page, "staff1");
    await openTicketInQueue(page, ticketANumber);

    // Ticket A is Open and has 1 Completed Action Taken (from E2E-03)
    await expect(page.locator(".badge", { hasText: "Open" }).first()).toBeVisible();
    await expect(page.locator(".badge", { hasText: "Completed" }).first()).toBeVisible();

    // Select Resolved
    const statusSelect = page.locator("#status-transition-select");
    await statusSelect.selectOption("Resolved");
    await page.getByRole("button", { name: "Transition" }).click();

    const resolutionModal = page.getByRole("dialog");
    await expect(resolutionModal).toBeVisible();

    // Verify completed action evidence is displayed
    await expect(
      resolutionModal.getByText(/1 completed action\(s\) recorded:/i)
    ).toBeVisible();

    // 1. Validation test: blank Resolution Summary is rejected
    const confirmBtn = resolutionModal.getByRole("button", { name: "Confirm Resolution" });
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    await expect(resolutionModal.getByText("Resolution summary is required.")).toBeVisible();

    // 2. Enter nonblank Resolution Summary
    const resolutionSummaryText =
      "Replaced faulty Cat6 patch cable connecting switch port 14 to patch panel. Signal restored, verified 1Gbps link stability and 0% packet loss over 30 minutes of continuous telemetry monitoring.";
    await resolutionModal.locator("#resolution-summary-input").fill(resolutionSummaryText);

    // 3. Confirm Resolution
    await confirmBtn.click();
    await expect(resolutionModal).not.toBeVisible({ timeout: 10000 });

    // 4. Verify Resolved status and persisted Resolution Summary
    await expect(page.getByText("Ticket resolved successfully.")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator(".badge", { hasText: "Resolved" }).first()).toBeVisible();

    // Verify persisted Resolution Summary card
    await expect(page.getByRole("heading", { name: "Resolution Summary" })).toBeVisible();
    await expect(page.getByText(resolutionSummaryText)).toBeVisible();

    // Capture UI-SS-15: Successful resolution with summary
    await captureTargetScreenshot(page, "resolvedTicketSummary", "UI-SS-15");
  });
});
