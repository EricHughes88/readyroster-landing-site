import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "https://itsreadyroster.com";
const EMAIL = process.env.COACH_EMAIL || "britt@gmail.com";
const PASSWORD = process.env.COACH_PASSWORD || "Madison42";

test("Coach login → dashboard → pending matches → open match", async ({ page }) => {
  // Give the whole test more breathing room
  test.setTimeout(60_000);

  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });

  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);

  await page.getByRole("button", { name: /log in/i }).click();

  // Wait for EITHER:
  // - we leave /login (success)
  // - an error message appears (failure)
  const successOrError = await Promise.race([
    page.waitForURL(/\/coach/i, { timeout: 20_000 }).then(() => "success" as const),
    page
      .locator(".rr-alert-error, [data-testid='login-error'], text=/invalid|could not sign in|please try again/i")
      .first()
      .waitFor({ timeout: 20_000 })
      .then(() => "error" as const),
  ]).catch(() => "timeout" as const);

  if (successOrError !== "success") {
    // Try to pull visible error text so you know WHY
    const errText =
      (await page
        .locator(".rr-alert-error, [data-testid='login-error']")
        .first()
        .textContent()
        .catch(() => null)) || "(no visible error text found)";

    await page.screenshot({ path: "playwright-login-failure.png", fullPage: true });

    throw new Error(
      `Login did not reach /coach. Result=${successOrError}. Current URL=${page.url()}. ErrorText=${errText}`
    );
  }

  // Coach dashboard should load
  await expect(page.getByRole("heading", { name: /coach dashboard/i })).toBeVisible({
    timeout: 20_000,
  });

  // Go to pending matches
  await page.goto(`${BASE_URL}/coach/matches?status=pending`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: /matches/i })).toBeVisible();

  // Click View if present
  const viewButton = page.getByRole("link", { name: /^view$/i }).first();
  if (await viewButton.count()) {
    await viewButton.click();

    // Guard against broken routes
    await expect(page.getByText(/404/i)).toHaveCount(0);
    await expect(page.getByText(/not found/i)).toHaveCount(0);
  }
});
