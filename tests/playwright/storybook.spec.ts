import { expect, test } from "@playwright/test";

function storyUrl(id: string): string {
  return `/iframe.html?id=${id}&viewMode=story`;
}

test("diff panel truncated story exposes load full diff affordance", async ({ page }) => {
  await page.goto(storyUrl("jotdiff-diffpanel--truncated"));

  await expect(page.getByRole("heading", { name: "src/renderer/App.tsx" })).toBeVisible();
  await expect(page.getByText("This diff is in preview mode to keep the UI responsive.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Load full diff" })).toBeVisible();
});

test("diff panel binary story shows binary placeholder", async ({ page }) => {
  await page.goto(storyUrl("jotdiff-diffpanel--binary"));

  await expect(page.getByText("This file appears to be binary or non-text.")).toBeVisible();
  await expect(page.getByText("Binary content cannot be rendered as text.")).toBeVisible();
});

test("diff panel split story renders paired add/remove content", async ({ page }) => {
  await page.goto(storyUrl("jotdiff-diffpanel--split"));

  await expect(page.getByText("OldPanel")).toBeVisible();
  await expect(page.getByText("NewPanel")).toBeVisible();
  await expect(page.getByText("+2 / -1")).toBeVisible();
});

test("file list default story shows search and diff badges", async ({ page }) => {
  await page.goto(storyUrl("jotdiff-filelist--default"));

  await expect(page.getByRole("searchbox", { name: "Search changed files" })).toBeVisible();
  await expect(page.getByText("src/renderer/App.tsx")).toBeVisible();
  await expect(page.getByText("+14")).toBeVisible();
  await expect(page.getByText("-3")).toBeVisible();
});
