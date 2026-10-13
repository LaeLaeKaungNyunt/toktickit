import { Page, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * Standard viewports for Lab 4 visual and responsive layout verification
 * (Desktop: 1280x800, Tablet: 768x1024, Mobile: 375x667)
 */
export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

/**
 * Seeded test user credentials for automated E2E user journeys
 */
export const TEST_USERS = {
  requester: {
    email: "alice.smith@university.edu",
    password: "Password123!",
    name: "Alice Smith",
    role: "Requester",
  },
  requesterBob: {
    email: "bob.jones@university.edu",
    password: "Password123!",
    name: "Bob Jones",
    role: "Requester",
  },
  staff1: {
    email: "staff1@university.edu",
    password: "Password123!",
    name: "Sam Staff",
    role: "IT Staff",
  },
  staff2: {
    email: "staff2@university.edu",
    password: "Password123!",
    name: "Sarah Staff",
    role: "IT Staff",
  },
  admin: {
    email: "admin@university.edu",
    password: "Password123!",
    name: "Alex Admin",
    role: "Administrator",
  },
  inactive: {
    email: "eve.mallary@university.edu",
    password: "Password123!",
    name: "Eve Mallary",
    role: "Requester",
  },
} as const;

export type TestUserKey = keyof typeof TEST_USERS;

/**
 * Standard Lab 4 Screenshot IDs mapped from docs/lab-04/ui-spec.md Table 6.3
 */
export const SCREENSHOT_IDS = {
  staffDashboardDesktop: "UI-SS-01_staff_dashboard_desktop",
  staffDashboardMobile: "UI-SS-02_staff_dashboard_mobile",
  requesterDashboardDesktop: "UI-SS-03_requester_dashboard_desktop",
  requesterDashboardMobile: "UI-SS-04_requester_dashboard_mobile",
  ticketDetailActionsList: "UI-SS-05_ticket_detail_actions_list",
  createActionForm: "UI-SS-06_create_action_form",
  editActionForm: "UI-SS-07_edit_assign_action_form",
  completedActionHistory: "UI-SS-08_completed_action_history",
  requesterReadOnlyActions: "UI-SS-09_requester_read_only_actions",
  ticketResolutionForm: "UI-SS-10_ticket_resolution_form",
  resolutionValidationError: "UI-SS-11_resolution_validation_error",
  staleUpdateConflict: "UI-SS-12_stale_update_conflict",
  tabletResponsiveLayout: "UI-SS-13_tablet_responsive_layout",
  emptyState: "UI-SS-14_empty_dashboard_or_actions_state",
  resolvedTicketSummary: "UI-SS-15_ticket_resolved_with_summary",
} as const;

/**
 * Ensure artifacts/lab-04/screenshots directory exists and return absolute path
 */
export function getScreenshotDir(): string {
  const screenshotDir = path.join(
    process.cwd(),
    "artifacts",
    "lab-04",
    "screenshots"
  );
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  return screenshotDir;
}

/**
 * Set page viewport size and wait for layout reflow
 */
export async function switchViewport(
  page: Page,
  viewport: ViewportName
): Promise<void> {
  const size = VIEWPORTS[viewport];
  await page.setViewportSize(size);
  // Short pause to allow CSS media queries and flex/grid reflow to settle
  await page.waitForTimeout(300);
}

/**
 * Capture a named screenshot under artifacts/lab-04/screenshots/<name>.png
 */
export async function captureScreenshot(
  page: Page,
  name: string,
  options: { fullPage?: boolean } = {}
): Promise<string> {
  const dir = getScreenshotDir();
  const filePath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: options.fullPage ?? false });
  return filePath;
}

/**
 * Capture screenshots of current page state across desktop, tablet, and mobile viewports
 */
export async function captureResponsiveScreenshots(
  page: Page,
  namePrefix: string
): Promise<void> {
  const originalViewport = page.viewportSize();

  for (const [vpName, vpSize] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize(vpSize);
    await page.waitForTimeout(300);
    await captureScreenshot(page, `${namePrefix}_${vpName}`);
  }

  if (originalViewport) {
    await page.setViewportSize(originalViewport);
  }
}

/**
 * Log in to TokTickIT via the UI and wait for authenticated UI readiness
 */
export async function loginAs(
  page: Page,
  userOrKey: TestUserKey | { email: string; password: string }
): Promise<void> {
  const creds =
    typeof userOrKey === "string" ? TEST_USERS[userOrKey] : userOrKey;

  await page.goto("/");

  // Check if a user is already logged in; if so, log out first
  const signOutBtn = page.getByRole("button", { name: /Logout|Sign Out/i });
  if (await signOutBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await signOutBtn.click();
    await expect(page.getByRole("heading", { name: "Sign In to TokTickIT" })).toBeVisible({
      timeout: 5000,
    });
  }

  // Ensure sign-in form is ready
  await expect(page.getByRole("heading", { name: "Sign In to TokTickIT" })).toBeVisible({
    timeout: 5000,
  });

  await page.getByLabel(/Email Address/i).fill(creds.email);
  await page.getByLabel(/Password/i).fill(creds.password);
  await page.getByRole("button", { name: "Sign In" }).click();

  // Wait for login heading to disappear and session to become active
  await expect(page.getByRole("heading", { name: "Sign In to TokTickIT" })).not.toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole("button", { name: /Logout|Sign Out/i })).toBeVisible({
    timeout: 10000,
  });
}

/**
 * Log out and verify sign-in screen is restored
 */
export async function logout(page: Page): Promise<void> {
  const signOutBtn = page.getByRole("button", { name: /Logout|Sign Out/i });
  if (await signOutBtn.isVisible()) {
    await signOutBtn.click();
  }
  await expect(page.getByRole("heading", { name: "Sign In to TokTickIT" })).toBeVisible({
    timeout: 5000,
  });
}

/**
 * Wait for IT Staff Dashboard to complete loading
 */
export async function waitForStaffDashboardLoaded(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "IT Staff Dashboard" })).toBeVisible({
    timeout: 10000,
  });
  // Wait for metrics container to be visible (loading spinner completed)
  await expect(page.locator(".row.g-3").first()).toBeVisible({ timeout: 10000 });
}

/**
 * Wait for Requester Dashboard to complete loading
 */
export async function waitForRequesterDashboardLoaded(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /My Dashboard|My Tickets Dashboard/i })).toBeVisible({
    timeout: 10000,
  });
  // Wait for metrics summary cards to be visible
  await expect(page.locator(".row.g-3").first()).toBeVisible({ timeout: 10000 });
}
