import { test, expect, Page } from "@playwright/test";
import {
  loginAs,
  switchViewport,
  waitForStaffDashboardLoaded,
  waitForRequesterDashboardLoaded,
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

test.describe.serial("Lab 4 E2E — Dashboards and Navigation (E2E-07 – E2E-10)", () => {
  // -------------------------------------------------------------------------
  // E2E-07 — Requester Read-Only Actions Taken
  // -------------------------------------------------------------------------
  test("E2E-07 — Requester Read-Only Actions Taken", async ({ page }) => {
    // 1. Log in as Requester Bob
    await loginAs(page, "requesterBob");
    await switchViewport(page, "desktop");

    // 2. Open ticket owned by Bob that has recorded actions taken
    // ("Campus Wi-Fi disconnects frequently in Library" has active and completed actions)
    await page.locator(".nav-tabs").getByRole("button", { name: "My Tickets" }).click();

    // Use search input to filter Bob's tickets
    await page.locator("#search-tickets-input").fill("Campus Wi-Fi");
    await page.getByRole("button", { name: "Search" }).click();

    const ticketRow = page.locator("tr", { hasText: "Campus Wi-Fi disconnects frequently in Library" });
    await expect(ticketRow).toBeVisible({ timeout: 10000 });
    await ticketRow.click();

    // 3. Verify Actions Taken history is visible
    await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible({ timeout: 10000 });

    // 4. Verify relevant action details and status are displayed
    await expect(
      page.getByText("Replaced wireless access point AP-LIB-02 power injector")
    ).toBeVisible();
    await expect(
      page.getByText("Access point booted up and signal beacon restored")
    ).toBeVisible();
    await expect(
      page.getByText("Analyzed spectrum analyzer telemetry in main study hall")
    ).toBeVisible();
    await expect(
      page.getByText("Detected intermittent 5GHz channel interference on channel 36")
    ).toBeVisible();
    await expect(page.locator(".badge", { hasText: "Active" }).first()).toBeVisible();
    await expect(page.locator(".badge", { hasText: "Completed" }).first()).toBeVisible();

    // 5. Verify Requester CANNOT create, edit, complete, cancel, or assign Actions Taken
    await expect(page.getByRole("button", { name: /Add Action Taken/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /^Edit Action$/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /^Complete$/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Cancel Action/i })).not.toBeVisible();

    // 6. Capture UI-SS-09: Requester read-only Actions Taken
    await captureTargetScreenshot(page, "requesterReadOnlyActions", "UI-SS-09");
  });

  // -------------------------------------------------------------------------
  // E2E-08 — Requester Cross-Owner Access Denied
  // -------------------------------------------------------------------------
  test("E2E-08 — Requester Cross-Owner Access Denied", async ({ page, request }) => {
    // 1. Obtain Bob's ticket ID using Bob's session
    const bobAuthRes = await request.post("http://localhost:3000/api/v1/auth/login", {
      data: {
        email: TEST_USERS.requesterBob.email,
        password: TEST_USERS.requesterBob.password,
      },
    });
    expect(bobAuthRes.status()).toBe(200);
    const { token: bobToken } = await bobAuthRes.json();

    const bobTicketsRes = await request.get("http://localhost:3000/api/v1/tickets", {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    expect(bobTicketsRes.status()).toBe(200);
    const bobData = await bobTicketsRes.json();
    const bobTickets = bobData.items || bobData.tickets || [];
    const bobTargetTicket =
      bobTickets.find((t: any) => t.summary.includes("Campus Wi-Fi")) || bobTickets[0];
    expect(bobTargetTicket).toBeDefined();

    const bobTicketId = bobTargetTicket.id;
    const bobTicketNumber = bobTargetTicket.ticketNumber;
    const bobTicketSummary = bobTargetTicket.summary;

    // 2. Log in as Requester Alice
    await loginAs(page, "requester");
    await switchViewport(page, "desktop");

    // 3. Confirm Bob's ticket is NOT present on Alice's Dashboard
    await expect(page.getByRole("heading", { name: "My Dashboard" })).toBeVisible();
    await expect(page.getByText(bobTicketSummary)).not.toBeVisible();

    // 4. Confirm Bob's ticket is NOT present on Alice's My Tickets list
    await page.locator(".nav-tabs").getByRole("button", { name: "My Tickets" }).click();
    await expect(page.locator("tr", { hasText: bobTicketSummary })).not.toBeVisible();
    await expect(page.locator("tr", { hasText: bobTicketNumber })).not.toBeVisible();

    // 5. Attempt direct API access to Bob's ticket and actions from Alice's browser session
    const directAccessResult = await page.evaluate(async (targetId) => {
      const aliceToken =
        sessionStorage.getItem("toktickit_auth_token") ||
        localStorage.getItem("toktickit_auth_token");
      const ticketRes = await fetch(`http://localhost:3000/api/v1/tickets/${targetId}`, {
        headers: { Authorization: `Bearer ${aliceToken}` },
      });
      const actionsRes = await fetch(`http://localhost:3000/api/v1/tickets/${targetId}/actions`, {
        headers: { Authorization: `Bearer ${aliceToken}` },
      });
      return {
        ticketStatus: ticketRes.status,
        ticketBody: await ticketRes.json().catch(() => null),
        actionsStatus: actionsRes.status,
        actionsBody: await actionsRes.json().catch(() => null),
      };
    }, bobTicketId);

    // Both ticket detail and actions taken endpoints must deny access with HTTP 404 (AC-07, AC-22)
    expect(directAccessResult.ticketStatus).toBe(404);
    expect(directAccessResult.actionsStatus).toBe(404);
    const ticketErrMsg =
      typeof directAccessResult.ticketBody?.error === "object"
        ? directAccessResult.ticketBody?.error?.message
        : directAccessResult.ticketBody?.error;
    const actionsErrMsg =
      typeof directAccessResult.actionsBody?.error === "object"
        ? directAccessResult.actionsBody?.error?.message
        : directAccessResult.actionsBody?.error;
    expect(ticketErrMsg).toMatch(/not found|inaccessible/i);
    expect(actionsErrMsg).toMatch(/not found|inaccessible/i);

    // Protected information must NOT be leaked in error responses
    expect(JSON.stringify(directAccessResult.ticketBody)).not.toContain(bobTicketSummary);
    expect(JSON.stringify(directAccessResult.actionsBody)).not.toContain("power injector");
  });

  // -------------------------------------------------------------------------
  // E2E-09 — IT Staff Dashboard Urgent Ticket Drilldown
  // -------------------------------------------------------------------------
  test("E2E-09 — IT Staff Dashboard Urgent Ticket Drilldown", async ({ page }) => {
    // 1. Log in as IT Staff
    await loginAs(page, "staff1");
    await switchViewport(page, "desktop");

    // 2. Verify Operational Dashboard renders its summary metrics
    await waitForStaffDashboardLoaded(page);
    await expect(page.getByRole("heading", { name: "IT Staff Dashboard" })).toBeVisible();
    await expect(page.getByText("Operations Center")).toBeVisible();

    // Check metrics cards are present
    await expect(page.getByText("Unassigned Tickets")).toBeVisible();
    await expect(page.getByText("My Assigned Tickets")).toBeVisible();
    await expect(page.getByText("Urgent Tickets", { exact: true })).toBeVisible();
    await expect(page.getByText("My Active Actions")).toBeVisible();

    // Check Status Overview card is present
    await expect(page.getByRole("heading", { name: "Status Overview" })).toBeVisible();

    // 3. Capture UI-SS-01: IT Staff Dashboard desktop
    await captureTargetScreenshot(page, "staffDashboardDesktop", "UI-SS-01");

    // 4. Locate an urgent or high-priority ticket through Urgent Tickets Queue section
    const urgentSection = page.locator(".card", { hasText: "Urgent Tickets Queue" });
    await expect(urgentSection).toBeVisible();

    const urgentTicketButtons = urgentSection.locator(
      ".list-group-item button.text-decoration-none.fw-bold"
    );
    await expect(urgentTicketButtons.first()).toBeVisible({ timeout: 10000 });

    const rawButtonText = (await urgentTicketButtons.first().textContent())?.trim() || "";
    // Format is "TKT-YYYY-NNNNN: Summary text"
    const ticketNumberMatch = rawButtonText.match(/^(TKT-\d{4}-\d{5})/);
    expect(ticketNumberMatch).not.toBeNull();
    const selectedTicketNumber = ticketNumberMatch![1];

    // 5. Click the urgent ticket link to drill down
    await urgentTicketButtons.first().click();

    // 6. Verify navigation reaches the correct ticket and displayed info matches
    await expect(
      page.getByRole("heading", { name: `Ticket ${selectedTicketNumber}` })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: "Actions Taken" })
    ).toBeVisible({ timeout: 10000 });

    // IT Priority badge in StaffTicketDetail must show Urgent or High
    const priorityBadge = page.locator(".badge", { hasText: /IT Priority:\s*(Urgent|High)/i });
    await expect(priorityBadge).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // E2E-10 — Requester Dashboard Attention Drilldown
  // -------------------------------------------------------------------------
  test("E2E-10 — Requester Dashboard Attention Drilldown", async ({ page }) => {
    // 1. Log in as Requester Bob
    await loginAs(page, "requesterBob");
    await switchViewport(page, "desktop");

    // 2. Verify My Tickets Dashboard metrics and attention indicators
    await waitForRequesterDashboardLoaded(page);
    await expect(page.getByRole("heading", { name: "My Dashboard" })).toBeVisible();
    await expect(page.getByText("Requester Portal")).toBeVisible();

    // Verify metric summary cards
    await expect(page.getByTestId("metric-my-active-tickets")).toBeVisible();
    await expect(page.getByTestId("metric-waiting-for-me")).toBeVisible();
    await expect(page.getByTestId("metric-recently-resolved")).toBeVisible();
    await expect(page.getByTestId("metric-total-tickets")).toBeVisible();

    // Verify Tickets by Status overview
    await expect(page.getByRole("heading", { name: "Tickets by Status" })).toBeVisible();

    // 3. Capture UI-SS-03: Requester Dashboard desktop
    await captureTargetScreenshot(page, "requesterDashboardDesktop", "UI-SS-03");

    // 4. Open an owned ticket requiring attention through Needs My Attention section
    const attentionSection = page.locator("#needs-attention");
    await expect(attentionSection).toBeVisible();

    const attentionItems = attentionSection.locator(".list-group-item");
    await expect(attentionItems.first()).toBeVisible({ timeout: 10000 });

    // Extract ticket number and summary from attention item
    const ticketNumberEl = attentionItems.first().locator(".text-primary");
    const attentionTicketNumber = (await ticketNumberEl.textContent())?.trim() || "";
    expect(attentionTicketNumber).toMatch(/^TKT-\d{4}-\d{5}$/);

    // Click attention ticket item to drill down
    await attentionItems.first().click();

    // 5. Verify navigation reaches the correct owned ticket
    await expect(
      page.getByRole("heading", { name: attentionTicketNumber, exact: true })
    ).toBeVisible({ timeout: 10000 });

    // Status badge must show Waiting for Requester
    await expect(page.locator(".badge", { hasText: "Waiting for Requester" }).first()).toBeVisible();

    // 6. Verify Requester remains restricted to permitted operations
    // - No IT Staff status transition dropdown
    await expect(page.locator("#status-transition-select")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Transition" })).not.toBeVisible();

    // - No Actions Taken management controls
    await expect(page.getByRole("button", { name: /Add Action Taken/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /^Edit Action$/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /^Complete$/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Cancel Action/i })).not.toBeVisible();

    // - Permitted Requester controls are available
    await expect(page.getByRole("heading", { name: /Attachments/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Mark as Resolved|Resolved by You/i })).toBeVisible();
  });
});
