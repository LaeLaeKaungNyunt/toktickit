import { test, expect } from "@playwright/test";
import { captureViewportScreenshots } from "./helpers.js";

test.describe("Lab 3 E2E — IT Staff Queue, Ticket Operations & Screenshots", () => {
  test("1. IT Staff Queue visual capture and filtering across viewports", async ({ page }) => {
    await page.goto("/");

    // Login as Sam Staff (IT Staff)
    await page.getByLabel(/Email Address/i).fill("staff1@university.edu");
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.locator(".border-bottom").getByText("Sam Staff")).toBeVisible();
    await expect(page.locator(".border-bottom").getByText("IT Staff")).toBeVisible();
    await expect(page.getByRole("button", { name: "IT Staff Queue" })).toBeVisible();

    // Verify User Management tab is NOT present for IT Staff
    await expect(page.getByRole("button", { name: "User Management" })).not.toBeVisible();

    // Assert ticket items are rendered
    const ticketRows = page.locator(".staff-queue-desktop-table tbody tr");
    await expect(ticketRows.first()).toBeVisible();
    expect(await ticketRows.count()).toBeGreaterThanOrEqual(1);

    // Capture Staff Queue screenshots across viewports
    await captureViewportScreenshots(page, "staff-queue", "01_staff_queue");

    // 1. Search Filtering
    const searchInput = page.locator("#search-input");
    await searchInput.fill("portal");
    await page.waitForTimeout(300);
    await expect(page.locator("td", { hasText: /portal/i }).first()).toBeVisible();
    await searchInput.clear();
    await page.waitForTimeout(300);

    // 2. Status Filter
    const statusSelect = page.locator("#status-filter");
    await statusSelect.selectOption("In Progress");
    await page.waitForTimeout(300);
    await expect(page.locator("td", { hasText: "In Progress" }).first()).toBeVisible();
    await statusSelect.selectOption("");
    await page.waitForTimeout(300);

    // 3. IT Priority Filter
    const prioritySelect = page.locator("#priority-filter");
    await prioritySelect.selectOption("High");
    await page.waitForTimeout(300);
    await expect(page.locator("td", { hasText: "High" }).first()).toBeVisible();
    await prioritySelect.selectOption("");
    await page.waitForTimeout(300);

    // 4. Assignment Filter
    const assignmentSelect = page.locator("#assignment-filter");
    await assignmentSelect.selectOption("unassigned");
    await page.waitForTimeout(300);
    await expect(page.locator("td", { hasText: "Unassigned" }).first()).toBeVisible();
    await assignmentSelect.selectOption("");
    await page.waitForTimeout(300);

    // 5. Sorting Controls
    const sortBySelect = page.locator("#sort-by-select");
    await sortBySelect.selectOption("ticketNumber");
    const toggleSortBtn = page.getByRole("button", { name: "Toggle sort order" });
    await toggleSortBtn.click();
    await toggleSortBtn.click();
    await sortBySelect.selectOption("createdAt");

    // 6. Pagination Footer & Ownership Presentation
    await expect(page.getByText(/Showing \d+–\d+ of \d+ tickets/)).toBeVisible();
    await expect(page.getByText(/Page 1 of \d+/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();

    const nextBtn = page.getByRole("button", { name: "Next" });
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await page.waitForTimeout(300);
      await expect(page.getByText(/Page 2 of \d+/i)).toBeVisible();
      await page.getByRole("button", { name: "Previous" }).click();
      await page.waitForTimeout(300);
      await expect(page.getByText(/Page 1 of \d+/i)).toBeVisible();
    }

    // Open Detail Navigation
    const firstDetailBtn = page.getByRole("button", { name: "View Detail" }).first();
    await firstDetailBtn.click();
    await expect(page.getByText("IT Staff Ticket Operations")).toBeVisible();
  });

  test("2. IT Staff Ticket Detail, Operations & Screenshots", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel(/Email Address/i).fill("staff1@university.edu");
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.locator(".border-bottom").getByText("Sam Staff")).toBeVisible();

    // Open first ticket in queue
    const firstDetailBtn = page.getByRole("button", { name: "View Detail" }).first();
    await firstDetailBtn.click();

    // Verify Ticket Detail heading and info loaded
    await expect(page.getByText("IT Staff Ticket Operations")).toBeVisible();

    // Capture Staff Ticket Detail screenshots across viewports
    await captureViewportScreenshots(page, "staff-ticket-detail", "01_staff_ticket_detail");

    // 1. Claim Ticket
    const claimBtn = page.getByRole("button", { name: /Claim Ticket|Claimed by You/i });
    if ((await claimBtn.textContent())?.includes("Claim Ticket")) {
      await claimBtn.click();
      await expect(page.getByText("Ticket claimed successfully.")).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Claimed by You" })).toBeVisible();

    // 2. Reassign Ticket
    const reassignSelect = page.locator("#reassign-select");
    const alexTechOption = page.locator("#reassign-select option", { hasText: "Alex Tech" });
    if (await alexTechOption.count() > 0) {
      const alexTechId = await alexTechOption.getAttribute("value");
      if (alexTechId) {
        await reassignSelect.selectOption(alexTechId);
        await reassignSelect.locator("..").getByRole("button", { name: "Apply" }).click();
        await expect(page.getByText(/Ticket reassigned successfully/i)).toBeVisible();

        // Reassign back to Sam Staff
        const samStaffOption = page.locator("#reassign-select option", { hasText: "Sam Staff" });
        const samStaffId = await samStaffOption.getAttribute("value");
        if (samStaffId) {
          await reassignSelect.selectOption(samStaffId);
          await reassignSelect.locator("..").getByRole("button", { name: "Apply" }).click();
          await expect(page.getByText(/Ticket reassigned successfully/i)).toBeVisible();
        }
      }
    }

    // 3. IT Priority Update
    const prioritySelect = page.locator("#it-priority-select");
    const currentPriority = await prioritySelect.inputValue();
    const newPriority = currentPriority === "Urgent" ? "High" : "Urgent";
    await prioritySelect.selectOption(newPriority);
    await prioritySelect.locator("..").getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(new RegExp(`IT Priority updated to ${newPriority}`, "i"))).toBeVisible();

    // 4. Status Transition
    const statusTransitionSelect = page.locator("#status-transition-select");
    if (await statusTransitionSelect.isVisible()) {
      const options = await statusTransitionSelect.locator("option").allTextContents();
      const validTargetOption = options.find((opt) => opt && !opt.includes("-- Select Status --"));
      if (validTargetOption) {
        await statusTransitionSelect.selectOption(validTargetOption.trim());
        await statusTransitionSelect.locator("..").getByRole("button", { name: "Transition" }).click();
        await expect(page.getByText(new RegExp(`Status updated to ${validTargetOption.trim()}`, "i"))).toBeVisible();
      }
    }

    // 5. Public Comment
    const commentInput = page.locator("#public-comment-input");
    await commentInput.fill("E2E Verified Public Comment for Requester");
    await page.getByRole("button", { name: "Post Public Comment" }).click();
    await expect(page.locator("p", { hasText: "E2E Verified Public Comment for Requester" }).first()).toBeVisible();

    // 6. Internal Note
    const postNoteBtn = page.getByRole("button", { name: "Post Internal Note" });
    await expect(postNoteBtn).toBeVisible();
    const noteInput = page.locator("#internal-note-input");
    await noteInput.fill("E2E Verified Internal Note for Staff Only");
    await postNoteBtn.click();
    await expect(page.locator("p", { hasText: "E2E Verified Internal Note for Staff Only" }).first()).toBeVisible();

    // 7. Attachments & Metadata Continuity Checks
    await expect(page.locator(".card-header", { hasText: "Attachments" })).toBeVisible();
    await expect(page.locator("#staff-attachment-upload-input")).toBeVisible();

    // 8. Return to Queue
    await page.getByRole("button", { name: /Back to Ticket Queue/i }).click();
    await expect(page.getByRole("button", { name: "IT Staff Queue" })).toBeVisible();
  });
});
