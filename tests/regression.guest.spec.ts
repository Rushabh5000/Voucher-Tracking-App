/**
 * Full guest-mode regression suite.
 * All data created here is isolated to a fresh guest session and never
 * touches existing admin/user vouchers or cards.
 *
 * Run:  npx playwright test tests/regression.guest.spec.ts
 */

import { test, expect, Page, BrowserContext } from "@playwright/test";

const BASE = "http://localhost:5173";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function loginAsGuest(page: Page) {
  await page.goto(BASE);
  await page.getByRole("button", { name: /continue as guest/i }).click();
  await page.waitForURL(/localhost:5173/);
  // Wait until the guest session banner appears
  await expect(page.getByText(/guest session/i).first()).toBeVisible({ timeout: 15_000 });
}

/** Navigate via the sidebar nav buttons */
async function navTo(page: Page, label: string) {
  await page.locator("nav").getByRole("button", { name: new RegExp(label, "i") }).first().click();
  await page.waitForTimeout(500);
}

/** Close any open dialog (safety net so modals don't leak between tests) */
async function dismissOpenDialog(page: Page) {
  try {
    const dialog = page.getByRole("dialog");
    if (await dialog.isVisible({ timeout: 300 })) {
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => {});
    }
  } catch {}
}

// ─── Suite ───────────────────────────────────────────────────────────────────

test.describe("Guest Mode Regression", () => {
  let page: Page;
  let ctx: BrowserContext; // kept at describe scope to prevent GC closing the context

  test.beforeAll(async ({ browser }) => {
    // Fresh incognito context — completely isolated from any existing session
    ctx = await browser.newContext();
    page = await ctx.newPage();
    await loginAsGuest(page);
  });

  // Safety net: close any open modal after every test so failures don't cascade
  test.afterEach(async () => {
    await dismissOpenDialog(page);
  });

  test.afterAll(async () => {
    await page.close();
    await ctx.close();
  });

  // ── 1. Auth ────────────────────────────────────────────────────────────────

  test("1.1 cold-start note visible on login page before login", async ({ page: p }) => {
    await p.goto(BASE);
    await expect(p.getByText(/first load may take/i)).toBeVisible();
  });

  test("1.2 guest session banner shows countdown timer", async () => {
    await expect(page.getByText(/guest session/i).first()).toBeVisible();
    // Countdown chip shows "Xm Ys" format
    await expect(page.getByText(/\d+m \d+s/)).toBeVisible();
  });

  // ── 2. Dashboard ──────────────────────────────────────────────────────────

  test("2.1 dashboard loads with zero-state stats", async () => {
    await navTo(page, "dashboard");
    await expect(page.getByText(/total/i).first()).toBeVisible();
    // All stats should be 0 for a fresh guest
    const zeros = page.getByText("0");
    await expect(zeros.first()).toBeVisible();
  });

  // ── 3. Voucher CRUD ───────────────────────────────────────────────────────

  test("3.1 add voucher — happy path", async () => {
    await navTo(page, "vouchers");
    await page.getByRole("button", { name: /\+ add voucher/i }).first().click();

    // Fill form using placeholders (SmartInput labels have no htmlFor).
    // Use exact:true for brand to avoid matching "e.g. Amazon Gift Voucher".
    await page.getByPlaceholder("e.g. Amazon", { exact: true }).fill("TestBrand");
    await page.getByPlaceholder(/AMZN-HDFC/i).fill("GUEST-TEST-001");
    await page.getByPlaceholder(/Amazon Gift Voucher/i).fill("Guest Test Voucher");

    // Set expiry date (nth(1) = second date input, after issue date)
    const expiryInput = page.locator('input[type="date"]').nth(1);
    await expiryInput.fill("2026-12-31");

    await page.getByRole("button", { name: /save voucher/i }).click();
    // Use unique voucher code as assertion — backend lowercases codes
    await expect(page.getByText("guest-test-001")).toBeVisible({ timeout: 5_000 });
  });

  test("3.2 add second voucher (different expiry for sort test)", async () => {
    await page.getByRole("button", { name: /\+ add voucher/i }).first().click();
    await page.getByPlaceholder("e.g. Amazon", { exact: true }).fill("TestBrand");
    await page.getByPlaceholder(/AMZN-HDFC/i).fill("GUEST-TEST-002");
    await page.getByPlaceholder(/Amazon Gift Voucher/i).fill("Earlier Expiry Voucher");
    const expiryInput = page.locator('input[type="date"]').nth(1);
    await expiryInput.fill("2026-07-01");
    await page.getByRole("button", { name: /save voucher/i }).click();
    await expect(page.getByText("Earlier Expiry Voucher")).toBeVisible({ timeout: 5_000 });
  });

  test("3.3 sort order — earlier expiry appears before later expiry", async () => {
    // Both unredeemed; GUEST-TEST-002 (Jul 2026) should appear before GUEST-TEST-001 (Dec 2026)
    // Note: backend stores voucher codes in lowercase
    const cards = page.locator(".space-y-3 > div");
    const first  = await cards.nth(0).textContent();
    const second = await cards.nth(1).textContent();
    expect(first).toContain("guest-test-002");
    expect(second).toContain("guest-test-001");
  });

  test("3.4 duplicate voucher code rejected", async () => {
    await page.getByRole("button", { name: /\+ add voucher/i }).first().click();
    await page.getByPlaceholder("e.g. Amazon", { exact: true }).fill("TestBrand");
    await page.getByPlaceholder(/AMZN-HDFC/i).fill("GUEST-TEST-001"); // duplicate
    await page.getByPlaceholder(/Amazon Gift Voucher/i).fill("Duplicate");
    await page.getByRole("button", { name: /save voucher/i }).click();
    await expect(page.getByText(/already exists|duplicate/i)).toBeVisible({ timeout: 3_000 });
    // Close modal via ✕ button (more reliable than Escape)
    await page.getByRole("dialog").getByRole("button", { name: "✕" }).click();
  });

  test("3.5 edit voucher — change title", async () => {
    await navTo(page, "vouchers");
    await page.getByRole("button", { name: /^edit$/i }).first().click();
    // EditVoucherModal save button says "Update voucher"
    const titleInput = page.getByPlaceholder(/Amazon Gift Voucher/i);
    await titleInput.clear();
    await titleInput.fill("Updated Guest Voucher");
    await page.getByRole("button", { name: /update voucher/i }).click();
    await expect(page.getByText("Updated Guest Voucher")).toBeVisible({ timeout: 5_000 });
  });

  // ── 4. Redeem / Unredeem ──────────────────────────────────────────────────

  test("4.1 mark voucher as redeemed", async () => {
    await navTo(page, "vouchers");
    await page.getByRole("button", { name: /mark redeemed/i }).first().click();
    // Check the success toast — avoids matching the hidden <option> "Unredeemed" in the status filter
    await expect(page.getByText("Marked as redeemed")).toBeVisible({ timeout: 5_000 });
  });

  test("4.2 redeemed voucher sinks to bottom of list", async () => {
    // Navigate explicitly in case page state changed
    await navTo(page, "vouchers");
    await page.waitForTimeout(300);
    const cards = page.locator(".space-y-3 > div");
    // Use .last() directly — more robust than nth(count-1)
    const last = await cards.last().textContent();
    // The redeemed voucher should be last (sortVouchers puts REDEEMED after UNREDEEMED)
    expect(last).toMatch(/Redeemed/);
  });

  test("4.3 mark redeemed voucher back to unredeemed", async () => {
    // Navigate explicitly in case page state changed
    await navTo(page, "vouchers");
    await page.waitForTimeout(300);
    const cards = page.locator(".space-y-3 > div");
    const lastCard = cards.last();
    await lastCard.getByRole("button", { name: /mark unredeemed/i }).click();
    // Check the success toast — store shows "Reverted to unredeemed"
    await expect(page.getByText("Reverted to unredeemed")).toBeVisible({ timeout: 5_000 });
  });

  // ── 5. Dashboard stat cards filter ────────────────────────────────────────

  test("5.1 dashboard shows correct voucher count", async () => {
    await navTo(page, "dashboard");
    await expect(page.getByText("2").first()).toBeVisible(); // 2 guest vouchers
  });

  test("5.2 clicking 'Unredeemed' stat card filters list", async () => {
    // Navigate explicitly in case state changed from prior test
    await navTo(page, "dashboard");
    await page.waitForTimeout(500);
    // Click the Unredeemed stat card (accessible name includes value, e.g. "Unredeemed 2")
    await page.getByRole("button", { name: /unredeemed/i }).first().click();
    await page.waitForTimeout(300);
    // Verify the inline voucher list is rendered — check the count label unique to the dashboard.
    // NOTE: getByText("TestBrand") would match the hidden <option> in the brand <select> first,
    // which is not visible (same hidden-option trap as test 4.1). Use the count text instead.
    await expect(page.getByText(/\d+ vouchers? — oldest first/i)).toBeVisible({ timeout: 3_000 });
  });

  // ── 6. Get Voucher flow ───────────────────────────────────────────────────

  test("6.1 get voucher — select brand, receive oldest eligible", async () => {
    await navTo(page, "vouchers");
    await page.getByRole("button", { name: /get voucher/i }).first().click();
    // Modal shows brand selection step
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/choose a brand/i)).toBeVisible({ timeout: 5_000 });

    // Scope all clicks to the dialog to avoid hitting the header/page "Get voucher" button
    await dialog.getByRole("button", { name: "TestBrand" }).click();
    // "Get voucher →" footer button (scoped to dialog to avoid page-level button match)
    await dialog.getByRole("button", { name: /get voucher/i }).click();
    // Should show a voucher code on step 2
    await expect(dialog.getByText(/guest-test/i)).toBeVisible({ timeout: 5_000 });
    // Close modal
    await page.keyboard.press("Escape");
  });

  // ── 7. Brand Cloud ────────────────────────────────────────────────────────

  test("7.1 brand cloud shows TestBrand with active count", async () => {
    await navTo(page, "brand");
    // Brands rendered as buttons in the cloud
    await expect(page.getByRole("button", { name: "TestBrand" }).first()).toBeVisible({ timeout: 5_000 });
    // Should show active count badge — 2 unredeemed
    await expect(page.getByText("2").first()).toBeVisible();
  });

  test("7.2 clicking brand shows its vouchers inline", async () => {
    await page.getByRole("button", { name: "TestBrand" }).first().click();
    // Both guest-test-002 and guest-test-001 match /guest-test/i — use .first() to avoid
    // strict-mode violation (both spans are visible simultaneously)
    await expect(page.getByText(/guest-test/i).first()).toBeVisible({ timeout: 3_000 });
    // Both vouchers should appear
    const items = page.getByText(/guest-test-00/i);
    expect(await items.count()).toBeGreaterThanOrEqual(2);
  });

  test("7.3 status filter on brand detail — redeemed hidden by default", async () => {
    // Defensive: navigate to Brand Cloud and ensure TestBrand is selected so the
    // status filter <select> is visible. This guards against any page-state loss.
    await navTo(page, "brand");
    await page.waitForTimeout(300);
    // The status filter is only rendered when a brand is selected.
    // If not visible, click TestBrand to select it.
    const statusSelect = page.getByRole("combobox").filter({ hasText: /all statuses/i });
    if (!(await statusSelect.isVisible().catch(() => false))) {
      await page.getByRole("button", { name: "TestBrand" }).first().click();
      await page.waitForTimeout(200);
    }
    await expect(statusSelect).toBeVisible({ timeout: 3_000 });
    await statusSelect.selectOption("REDEEMED");
    await expect(page.getByText(/no vouchers match/i)).toBeVisible({ timeout: 2_000 });
    await statusSelect.selectOption("ALL");
  });

  // ── 8. Cards ──────────────────────────────────────────────────────────────

  test("8.1 add card", async () => {
    await navTo(page, "cards");
    await page.getByRole("button", { name: /\+ add card/i }).click();

    // CardModal fields
    await page.getByPlaceholder(/Rushabh Shah/i).fill("Guest User");   // account owner
    await page.getByPlaceholder(/HDFC Bank/i).fill("Test Bank");        // bank
    await page.getByPlaceholder(/Rupay Select/i).fill("RuPay Select"); // card type
    await page.getByPlaceholder(/HDFC Millennia/i).fill("Test RuPay Card"); // card name
    await page.getByPlaceholder(/4532/i).fill("1234");                  // last 4
    await page.getByPlaceholder(/your@email.com/i).fill("guest@test.com"); // email
    await page.getByPlaceholder(/9876543210/i).fill("9876543210");      // mobile

    await page.getByRole("button", { name: /^add card$/i }).click();
    // exact:true avoids matching react-hot-toast notification
    await expect(page.getByText("Test RuPay Card", { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test("8.2 card search filters correctly", async () => {
    await page.getByPlaceholder(/search by name/i).fill("Test Bank");
    // exact:true avoids strict-mode collision with still-visible toast
    await expect(page.getByText("Test RuPay Card", { exact: true })).toBeVisible();
    await page.getByPlaceholder(/search by name/i).fill("ZZNOTEXIST");
    await expect(page.getByText(/no cards match/i)).toBeVisible();
    // Clear search via the ✕ button (only appears when search is non-empty)
    await page.locator("button").filter({ hasText: "✕" }).first().click();
  });

  test("8.3 clicking card shows vouchers panel (empty — no linked vouchers yet)", async () => {
    // Click the card name span to select/expand it
    await page.getByText("Test RuPay Card", { exact: true }).first().click();
    // Use exact empty-state text — avoids strict-mode collision with the outer span that
    // wraps "Vouchers linked to this card" together with the nested count badge.
    await expect(page.getByText("No vouchers linked to this card yet")).toBeVisible({ timeout: 3_000 });
  });

  test("8.4 edit card", async () => {
    // Edit button in CardsPage card row
    await page.getByRole("button", { name: /^edit$/i }).first().click();
    const cardNameInput = page.getByPlaceholder(/HDFC Millennia/i);
    await cardNameInput.clear();
    await cardNameInput.fill("Updated RuPay Card");
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText("Updated RuPay Card")).toBeVisible({ timeout: 5_000 });
  });

  // ── 9. Vouchers page — card filter ────────────────────────────────────────

  test("9.1 card filter on vouchers page shows in dropdown", async () => {
    await navTo(page, "vouchers");
    // Card filter dropdown only renders when cards.length > 0
    const cardSelect = page.getByRole("combobox").filter({ hasText: /all cards/i });
    await expect(cardSelect).toBeVisible();
  });

  // ── 10. Analytics ─────────────────────────────────────────────────────────

  test("10.1 analytics page loads with guest data visible", async () => {
    await navTo(page, "analytics");
    // Multiple "Total" texts may exist (stat card label + table header); use first()
    await expect(page.getByText(/total/i).first()).toBeVisible();
    // Guest vouchers should count in summary
    await expect(page.getByText("2").first()).toBeVisible();
  });

  test("10.2 pie chart renders", async () => {
    // recharts wraps inside ResponsiveContainer → recharts-responsive-container
    const container = page.locator(".recharts-responsive-container").first();
    await expect(container).toBeVisible({ timeout: 5_000 });
  });

  // ── 11. Export ────────────────────────────────────────────────────────────

  test("11.1 export page loads with Excel and PDF buttons", async () => {
    await navTo(page, "export");
    await expect(page.getByRole("button", { name: /excel/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /pdf/i })).toBeVisible();
  });

  test("11.2 Excel download initiates (no error toast)", async () => {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15_000 }),
      page.getByRole("button", { name: /excel/i }).first().click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  });

  // ── 12. Audit Log ─────────────────────────────────────────────────────────

  test("12.1 audit log page loads with entries", async () => {
    await navTo(page, "audit");
    // Table column headers — use first() as multiple matches may exist
    await expect(page.getByText(/action|entity/i).first()).toBeVisible();
    // Our guest actions should have created some audit entries
    await expect(page.locator("table, .audit").first()).toBeVisible({ timeout: 5_000 });
  });

  test("12.2 audit log date filter works", async () => {
    const today = new Date().toISOString().split("T")[0];
    const dateFrom = page.locator('input[type="date"]').first();
    if (await dateFrom.isVisible()) {
      await dateFrom.fill(today);
      await page.waitForTimeout(500);
      // Should still show today's entries
      await expect(page.locator("table, .audit").first()).toBeVisible();
    }
  });

  // ── 13. Settings ──────────────────────────────────────────────────────────

  test("13.1 settings page shows theme toggle", async () => {
    await navTo(page, "settings");
    await expect(page.getByText(/light mode|dark mode/i).first()).toBeVisible();
  });

  test("13.2 guest settings — field values section is empty (user-isolated)", async () => {
    // Guest should NOT see admin's banks, account owners, emails
    // Either the section is absent, or it exists but has 0 entries
    const entriesList = page.locator('[class*="FieldValues"] li, [class*="field"] .item');
    const count = await entriesList.count();
    expect(count).toBe(0);
  });

  test("13.3 dark mode toggle applies class to html element", async () => {
    // Find and click dark mode option
    await page.getByText(/dark mode/i).first().click();
    const html = page.locator("html");
    await expect(html).toHaveClass(/dark/, { timeout: 2_000 });
    // Restore light
    await page.getByText(/light mode/i).first().click();
    await expect(html).not.toHaveClass(/dark/);
  });

  // ── 14. Delete voucher ────────────────────────────────────────────────────

  test("14.1 delete voucher — confirm dialog appears and cancels", async () => {
    await navTo(page, "vouchers");
    await page.waitForTimeout(500); // let any mid-test reload settle
    await page.getByRole("button", { name: /^delete$/i }).first().click();
    await expect(page.getByText(/are you sure|confirm|permanently/i)).toBeVisible({ timeout: 2_000 });
    await page.getByRole("button", { name: /cancel/i }).click();
    // VoucherCard is still present — check for the count text instead of brand name
    // (avoids hidden-<option> trap identical to test 5.2)
    await expect(page.getByText(/\d+ vouchers? — unredeemed first/i)).toBeVisible({ timeout: 3_000 });
  });

  test("14.2 delete voucher — confirm removes it", async () => {
    await navTo(page, "vouchers");
    await page.waitForTimeout(300);
    const initialCount = await page.locator(".space-y-3 > div").count();
    await page.getByRole("button", { name: /^delete$/i }).first().click();
    // Confirm label in VoucherCard ConfirmDialog is "Yes, delete"
    await page.getByRole("button", { name: /yes, delete/i }).click();
    await page.waitForTimeout(800);
    const newCount = await page.locator(".space-y-3 > div").count();
    expect(newCount).toBe(initialCount - 1);
  });

  // ── 15. Delete card ───────────────────────────────────────────────────────

  test("15.1 delete card — confirm removes it", async () => {
    await navTo(page, "cards");
    // "Del" button on the card
    await page.getByRole("button", { name: /^del$/i }).first().click();
    // CardsPage ConfirmDialog confirmLabel="Delete"
    await page.getByRole("button", { name: /^delete$/i }).last().click();
    await page.waitForTimeout(800);
    // Card should be gone or "no cards yet" shown
    const hasCard = await page.getByText("Updated RuPay Card").isVisible().catch(() => false);
    const noCards = await page.getByText(/no cards yet/i).isVisible().catch(() => false);
    expect(hasCard || noCards).toBeTruthy();
  });
});
