import { expect, Frame, Page, test } from "@playwright/test";

async function openDevtools(page: Page): Promise<Frame> {
  await page.goto("/");
  await page.keyboard.press("Control+Shift+Alt+Digit0");
  await expect
    .poll(() => page.frames().some((frame) => frame.url().includes("subscriber.html")))
    .toBe(true);

  const frame = page.frames().find((item) => item.url().includes("subscriber.html"));
  if (!frame) {
    throw new Error("Apollo devtools frame was not mounted");
  }

  await expect(frame.getByText("Apollo client:")).toBeVisible();
  await expect(frame.getByText("main", { exact: true })).toBeVisible();
  return frame;
}

async function clickPlaygroundButton(page: Page, name: string) {
  await page.evaluate((buttonName) => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const button = buttons.find((item) => item.textContent?.trim() === buttonName);
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }, name);
}

test("shows Apollo clients and switches active client cache", async ({ page }) => {
  const devtools = await openDevtools(page);

  await expect(devtools.getByText("Cache")).toBeVisible();
  await expect(devtools.getByText("query Chat", { exact: false })).toBeVisible();

  await devtools.locator("#apollo-client-dropdown").getByText("main").click();
  await devtools.locator("#apollo-client-dropdown").getByText("emptyClient").click();

  await expect(devtools.getByText("emptyClient", { exact: true })).toBeVisible();
  await expect(devtools.getByText("Apollo cache (overall size 2 B)")).toBeVisible();
});

test("tracks watched queries", async ({ page }) => {
  const devtools = await openDevtools(page);

  await devtools.getByText("Watched Queries").click();

  await expect(devtools.getByText("OptimisticChat")).toBeVisible();
  await expect(devtools.getByText("Chat", { exact: true })).toBeVisible();
  await expect(devtools.getByText("Query String")).toBeVisible();
  await expect(devtools.getByText("Latest data from the cache")).toBeVisible();
});

test("tracks mutations while devtools are open", async ({ page }) => {
  const devtools = await openDevtools(page);

  await page.getByRole("textbox", { name: "Message", exact: true }).fill("e2e mutation");
  await clickPlaygroundButton(page, "Add Message");

  await devtools.getByText("Mutations").click();

  await expect(devtools.getByText("addMessage", { exact: true })).toBeVisible();
  await expect(devtools.getByText("Mutation String")).toBeVisible();
  await expect(devtools.getByText('"text": "e2e mutation"')).toBeVisible();
});

test("records recent cache and operation activity", async ({ page }) => {
  const devtools = await openDevtools(page);

  await devtools.getByText("Activity monitor").click();
  await devtools.getByRole("button", { name: "Record recent activity" }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("recent activity");
  await clickPlaygroundButton(page, "Add Message");

  await expect(devtools.getByText("Mutation: addMessage")).toBeVisible();
  await expect(devtools.getByText("Cache item:", { exact: false })).toBeVisible();
});

test("records operation tracker events", async ({ page }) => {
  const devtools = await openDevtools(page);

  await devtools.getByText("Operations tracker").click();
  await devtools.getByRole("button", { name: "Start Recording" }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("tracked operation");
  await clickPlaygroundButton(page, "Add Message");

  await expect(devtools.getByText("addMessage", { exact: false })).toBeVisible();
});

test("runs GraphiQL against the active Apollo client", async ({ page }) => {
  const devtools = await openDevtools(page);

  await devtools.getByText("GraphiQL").click();
  await expect(devtools.getByText("GraphiQL", { exact: true })).toBeVisible();
  await expect(devtools.getByText("Variables")).toBeVisible();
});

test("shows import history tooling", async ({ page }) => {
  const devtools = await openDevtools(page);

  await devtools.getByText("Import History").click();

  await expect(devtools.getByText("Import History from JSON")).toBeVisible();
  await expect(devtools.getByText("History JSON:")).toBeVisible();
});
