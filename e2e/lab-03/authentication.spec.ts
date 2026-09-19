import { test, expect } from "@playwright/test";
import { captureViewportScreenshots } from "./helpers.js";

const API_URL = process.env.VITE_API_URL || "http://localhost:3000";

test.describe("Lab 3 E2E — Authentication, Navigation & Screenshots", () => {
  test("1. Login screen visual capture across viewports", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign In to TokTickIT" })).toBeVisible();
    await expect(page.getByLabel(/Email Address/i)).toBeVisible();

    await captureViewportScreenshots(page, "authentication", "01_login_screen");
  });

  test("2. Invalid login returns safe failure feedback", async ({ page }) => {
    await page.goto("/");

    // Wrong password
    await page.getByLabel(/Email Address/i).fill("alice.smith@university.edu");
    await page.getByLabel(/Password/i).fill("WrongPassword123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.locator("#login-error-alert")).toBeVisible();
    await expect(page.locator("#login-error-alert")).toContainText("Invalid email or password");

    // Unknown email
    await page.getByLabel(/Email Address/i).fill("unknown.user@university.edu");
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.locator("#login-error-alert")).toBeVisible();
    await expect(page.locator("#login-error-alert")).toContainText("Invalid email or password");
  });

  test("3. Inactive account receives safe forbidden feedback", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel(/Email Address/i).fill("eve.mallary@university.edu");
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.locator("#login-error-alert")).toBeVisible();
    await expect(page.locator("#login-error-alert")).toContainText("Account is inactive");
  });

  test("4. Mandatory first-password-change flow and viewports", async ({ request, page }) => {
    // 1. Ensure initial.user@university.edu is reset to requiring password change via Admin API
    const adminLoginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: { email: "admin@university.edu", password: "Password123!" },
    });
    const { token: adminToken } = await adminLoginRes.json();

    const usersRes = await request.get(`${API_URL}/api/v1/admin/users?search=initial.user`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { users } = await usersRes.json();
    const initialUser = users.find((u: any) => u.email === "initial.user@university.edu");

    if (initialUser) {
      await request.post(`${API_URL}/api/v1/admin/users/${initialUser.id}/reset-password`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { initialPassword: "InitialPassword123!" },
      });
    }

    // 2. Perform UI login as initial password user
    await page.goto("/");
    await page.getByLabel(/Email Address/i).fill("initial.user@university.edu");
    await page.getByLabel(/Password/i).fill("InitialPassword123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Verify redirected/presented with Mandatory Password Change screen
    await expect(page.getByRole("heading", { name: "Mandatory Password Change" })).toBeVisible();
    await expect(page.locator("#new-password")).toBeVisible();

    await captureViewportScreenshots(page, "authentication", "02_change_password_screen");

    // Complete password change
    await page.locator("#new-password").fill("NewE2EPassword123!");
    await page.locator("#confirm-password").fill("NewE2EPassword123!");
    await page.getByRole("button", { name: "Update Password" }).click();

    // Verify unlocked and authenticated as Requester
    await expect(page.locator(".border-bottom").getByText("Initial Password User")).toBeVisible();
    await expect(page.locator(".border-bottom").getByText("Requester")).toBeVisible();
  });

  test("5. Authenticated Requester navigation, screens & screenshots", async ({ page }) => {
    await page.goto("/");

    // Login as Alice Smith
    await page.getByLabel(/Email Address/i).fill("alice.smith@university.edu");
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.locator(".border-bottom").getByText("Alice Smith")).toBeVisible();
    await expect(page.locator(".border-bottom").getByText("Requester")).toBeVisible();

    // 1. Create Ticket Screen
    await expect(page.locator(".nav-tabs").getByRole("button", { name: "Create Ticket" })).toBeVisible();
    await captureViewportScreenshots(page, "requester", "03_requester_create_ticket");

    // 2. My Tickets Screen
    await page.locator(".nav-tabs").getByRole("button", { name: "My Tickets" }).click();
    await expect(page.locator(".my-tickets-container")).toBeVisible();
    await captureViewportScreenshots(page, "requester", "04_requester_my_tickets");

    // 3. Ticket Detail Screen (Deterministic)
    const ticketRow = page.locator(".my-tickets-container tbody tr").first();
    await expect(ticketRow).toBeVisible();
    await ticketRow.click();
    await expect(page.getByText(/Ticket Number:/i).or(page.getByText(/TKT-2026-/i))).toBeVisible();
    await captureViewportScreenshots(page, "requester", "05_requester_ticket_detail");
  });

  test("6. Logout invalidates session and blocks protected access", async ({ request, page }) => {
    await page.goto("/");

    await page.getByLabel(/Email Address/i).fill("alice.smith@university.edu");
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.locator(".border-bottom").getByText("Alice Smith")).toBeVisible();

    // Extract active token from sessionStorage
    const sessionToken = await page.evaluate(() => sessionStorage.getItem("toktickit_auth_token"));
    expect(sessionToken).toBeTruthy();

    // Click Logout
    await page.getByRole("button", { name: "Logout" }).click();

    // Verify returned to Login screen
    await expect(page.getByLabel(/Email Address/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();

    // Verify client session token cleared
    const clearedToken = await page.evaluate(() => sessionStorage.getItem("toktickit_auth_token"));
    expect(clearedToken).toBeNull();

    // Reload page and verify protected UI remains inaccessible
    await page.reload();
    await expect(page.getByLabel(/Email Address/i)).toBeVisible();
    await expect(page.locator(".border-bottom").getByText("Alice Smith")).not.toBeVisible();

    // Verify invalidated token receives 401 Unauthorized from API
    const meRes = await request.get(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    expect(meRes.status()).toBe(401);
  });
});


