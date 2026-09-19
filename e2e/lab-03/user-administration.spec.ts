import { test, expect } from "@playwright/test";
import { captureViewportScreenshots } from "./helpers.js";

const SERVER_BASE = "http://localhost:3000";

test.describe("Lab 3 E2E — Administrator User Management & Screenshots", () => {
  test("1. Administrator User Management visual capture and filters across viewports", async ({ page }) => {
    await page.goto("/");

    // Login as Admin User
    await page.getByLabel(/Email Address/i).fill("admin@university.edu");
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.locator(".border-bottom").getByText("Admin User")).toBeVisible();
    await expect(page.locator(".border-bottom").getByText("Administrator")).toBeVisible();
    await expect(page.getByRole("button", { name: "User Management" })).toBeVisible();

    // Capture User Management screenshots across viewports
    await captureViewportScreenshots(page, "user-management", "01_user_management");

    // 1. Search input test with strict row assertion
    const searchInput = page.getByPlaceholder("Search by name or email...");
    await searchInput.fill("Alice");
    await page.waitForTimeout(300);
    await expect(page.locator("td", { hasText: "Alice Smith" }).first()).toBeVisible();
    await expect(page.locator("td", { hasText: "Admin User" })).not.toBeVisible();
    await searchInput.clear();
    await page.waitForTimeout(300);

    // 2. Role filter test with strict row assertion
    const roleFilterSelect = page.locator("#user-role-filter");
    await roleFilterSelect.selectOption("IT Staff");
    await page.waitForTimeout(300);
    await expect(page.locator("td", { hasText: "Sam Staff" }).first()).toBeVisible();
    await expect(page.locator("td", { hasText: "Alice Smith" })).not.toBeVisible();
    await roleFilterSelect.selectOption("");
    await page.waitForTimeout(300);
  });

  test("2. Create User, Invalid Validation, Duplicate Validation, Edit User & Reset Password flow", async ({ page }) => {
    const e2eUserEmail = `e2e.user.${Date.now()}@university.edu`;

    await page.goto("/");

    await page.getByLabel(/Email Address/i).fill("admin@university.edu");
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.getByRole("button", { name: "User Management" })).toBeVisible();

    // 1. Click + Create User
    await page.getByRole("button", { name: "+ Create User" }).click();
    await expect(page.getByRole("heading", { name: "Create New User" })).toBeVisible();

    // 2. Invalid Input Validation Check (Short password < 8 chars)
    await page.locator("#create-user-name").fill("Invalid Password User");
    await page.locator("#create-user-email").fill("invalid.pass@university.edu");
    await page.locator("#create-user-password").fill("short");
    await page.locator(".modal-content").getByRole("button", { name: "Create User" }).click();

    await expect(page.locator(".modal-content .alert-danger")).toBeVisible();
    await expect(page.locator(".modal-content .alert-danger")).toContainText(/at least 8 characters/i);

    // 3. Duplicate email validation check
    await page.locator("#create-user-name").fill("Duplicate Test");
    await page.locator("#create-user-email").fill("alice.smith@university.edu");
    await page.locator("#create-user-password").fill("Password123!");
    await page.locator(".modal-content").getByRole("button", { name: "Create User" }).click();

    await expect(page.locator(".modal-content .alert-danger")).toBeVisible();
    await expect(page.locator(".modal-content .alert-danger")).toContainText(/already exists/i);

    // 4. Valid User Creation
    await page.locator("#create-user-email").fill(e2eUserEmail);
    await page.locator("#create-user-name").fill("E2E Created User");
    await page.locator("#create-user-role").selectOption("IT Staff");
    await page.locator("#create-user-password").fill("InitialE2EPass123!");

    await page.locator(".modal-content").getByRole("button", { name: "Create User" }).click();

    await expect(page.getByText(/created successfully/i)).toBeVisible();
    await expect(page.locator("td", { hasText: "E2E Created User" }).first()).toBeVisible();

    // 5. Edit User
    const userRow = page.locator("tr", { hasText: "E2E Created User" }).first();
    await userRow.getByRole("button", { name: "Edit" }).click();

    await expect(page.getByRole("heading", { name: /Edit User: E2E Created User/i })).toBeVisible();
    await page.locator("#edit-user-name").fill("E2E Created User Updated");
    await page.locator("#edit-user-role").selectOption("Requester");
    await page.locator(".modal-content").getByRole("button", { name: "Save Changes" }).click();

    await expect(page.getByText(/updated successfully/i)).toBeVisible();
    await expect(page.locator("td", { hasText: "E2E Created User Updated" }).first()).toBeVisible();

    // 6. Reset Password
    const updatedUserRow = page.locator("tr", { hasText: "E2E Created User Updated" }).first();
    await updatedUserRow.getByRole("button", { name: "Reset Password" }).click();

    await expect(page.getByRole("heading", { name: /Reset Password: E2E Created User Updated/i })).toBeVisible();
    const resetInput = page.locator("#reset-password-input");
    await resetInput.fill("ResetE2EPass123!");
    await resetInput.blur();
    await page.waitForTimeout(300);

    const modalResetSubmitBtn = page.locator(".modal-content form button[type='submit']");
    await modalResetSubmitBtn.click();

    await expect(page.getByText(/Password reset for/i)).toBeVisible();
    await expect(page.locator(".modal-content")).not.toBeVisible();

    // 7. Logout Admin and test login as created user with initial password
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    await page.waitForTimeout(300);

    await page.getByLabel(/Email Address/i).fill(e2eUserEmail);
    await page.getByLabel(/Password/i).fill("InitialE2EPass123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Verify created user receives mandatory first password change prompt
    await expect(page.getByRole("heading", { name: "Mandatory Password Change" })).toBeVisible();
  });

  test("3. Self-deactivation and Last-Active Administrator protection assertions", async ({ page, request }) => {
    await page.goto("/");

    // Login as Admin
    await page.getByLabel(/Email Address/i).fill("admin@university.edu");
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.getByRole("button", { name: "User Management" })).toBeVisible();

    // 1. Self-deactivation UI check for logged-in Admin User
    const selfAdminRow = page.locator("tr", { hasText: "Admin User" }).first();
    await selfAdminRow.getByRole("button", { name: "Edit" }).click();

    await expect(page.getByRole("heading", { name: /Edit User: Admin User/i })).toBeVisible();
    const activeCheckbox = page.locator("#edit-user-active");
    await expect(activeCheckbox).toBeDisabled();
    await expect(page.getByText(/cannot deactivate your own account/i)).toBeVisible();

    await page.locator(".modal-content").getByRole("button", { name: "Cancel" }).click();

    // 2. Direct API test for Last-Active Administrator protection
    // Get Admin User ID via admin users API call directly to SERVER_BASE
    const loginRes = await request.post(`${SERVER_BASE}/api/v1/auth/login`, {
      data: { email: "admin@university.edu", password: "Password123!" },
    });
    const { token } = await loginRes.json();

    const usersRes = await request.get(`${SERVER_BASE}/api/v1/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { users } = await usersRes.json();
    const adminUser = users.find((u: any) => u.email === "admin@university.edu");

    // Attempting to deactivate the last active Admin must return 409 Conflict
    const deactRes = await request.patch(`${SERVER_BASE}/api/v1/admin/users/${adminUser.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { isActive: false },
    });

    expect(deactRes.status()).toBe(409);
    const errBody = await deactRes.json();
    expect(errBody.error).toMatch(/last active administrator/i);
  });

  test("4. Non-Administrator forbidden access checks for User Management UI and API", async ({ page, request }) => {
    // 1. Requester role checks
    await page.goto("/");
    await page.getByLabel(/Email Address/i).fill("alice.smith@university.edu");
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.getByRole("button", { name: "My Tickets" })).toBeVisible();
    await expect(page.getByRole("button", { name: "User Management" })).not.toBeVisible();

    // Direct API call by Requester returns 403 Forbidden
    const reqLoginRes = await request.post(`${SERVER_BASE}/api/v1/auth/login`, {
      data: { email: "alice.smith@university.edu", password: "Password123!" },
    });
    const { token: reqToken } = await reqLoginRes.json();

    const reqApiRes = await request.get(`${SERVER_BASE}/api/v1/admin/users`, {
      headers: { Authorization: `Bearer ${reqToken}` },
    });
    expect(reqApiRes.status()).toBe(403);

    // Logout
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();

    // 2. IT Staff role checks
    await page.getByLabel(/Email Address/i).fill("staff1@university.edu");
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.getByRole("button", { name: "IT Staff Queue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "User Management" })).not.toBeVisible();

    // Direct API call by IT Staff returns 403 Forbidden
    const staffLoginRes = await request.post(`${SERVER_BASE}/api/v1/auth/login`, {
      data: { email: "staff1@university.edu", password: "Password123!" },
    });
    const { token: staffToken } = await staffLoginRes.json();

    const staffApiRes = await request.get(`${SERVER_BASE}/api/v1/admin/users`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    expect(staffApiRes.status()).toBe(403);
  });
});


