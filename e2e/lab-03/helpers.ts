import { Page } from "@playwright/test";
import fs from "fs";
import path from "path";

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
};

/**
 * Capture screenshots of a page across required viewports (desktop, tablet, mobile)
 * saved in the specified folder under artifacts/lab-03/screenshots/
 */
export async function captureViewportScreenshots(
  page: Page,
  folder: "authentication" | "staff-queue" | "staff-ticket-detail" | "user-management" | "requester",
  namePrefix: string
): Promise<void> {
  const baseDir = path.join(
    process.cwd(),
    "artifacts",
    "lab-03",
    "screenshots",
    folder
  );

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const originalViewport = page.viewportSize();

  for (const [vpName, vpSize] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize(vpSize);
    await page.waitForTimeout(300); // Allow responsive layout adjustments
    const filePath = path.join(baseDir, `${namePrefix}_${vpName}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
  }

  if (originalViewport) {
    await page.setViewportSize(originalViewport);
  }
}
