import { expect, test, type Page } from "@playwright/test";

test.describe("dashboard navigation smoke", () => {
  async function navigateFromDashboard(
    page: Page,
    linkName: string,
    expectedPath: string,
    headingName: string,
  ) {
    const link = page.getByRole("link", { name: linkName });

    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", expectedPath);

    await page.goto(expectedPath);
    await expect(page.getByRole("heading", { name: headingName })).toBeVisible();
  }

  test("navigates from the dashboard to treasury and governance", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Open Treasury" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View Proposals" })).toBeVisible();

    await navigateFromDashboard(page, "Open Treasury", "/treasury", "Treasury");

    await page.goto("/");
    await navigateFromDashboard(
      page,
      "View Proposals",
      "/governance",
      "Governance",
    );
  });
});
