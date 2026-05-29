/**
 * Unit tests for the sortVouchers utility.
 *
 * Rules under test:
 *  1. REDEEMED vouchers always sink to the bottom.
 *  2. Non-redeemed (UNREDEEMED + EXPIRED) are sorted earliest-expiry-first.
 *  3. No-expiry non-redeemed vouchers appear after those with an expiry.
 *  4. Among REDEEMED vouchers, most recently redeemed appears first.
 *  5. Tie-break on expiry → older dateAdded wins.
 */

import { describe, it, expect } from "vitest";
import { sortVouchers } from "@/utils/formatters";
import type { Voucher } from "@/types";

// Minimal factory — only fields used by sortVouchers
function v(overrides: Partial<Voucher> & { id: string }): Voucher {
  return {
    id:                  overrides.id,
    title:               "",
    voucherCode:         overrides.id,
    brand:               "TestBrand",
    sourceProgramOrCard: "",
    description:         "",
    voucherType:         "",
    value:               null,
    expiryDate:          overrides.expiryDate  ?? null,
    issueDate:           "2024-01-01",
    dateAdded:           overrides.dateAdded   ?? "2024-01-01T00:00:00Z",
    status:              overrides.status      ?? "UNREDEEMED",
    redeemedAt:          overrides.redeemedAt  ?? null,
    emailId:             "",
    cardOwner:           "",
    cardName:            "",
    createdAt:           "2024-01-01T00:00:00Z",
    updatedAt:           "2024-01-01T00:00:00Z",
  };
}

describe("sortVouchers", () => {

  // ── Rule 1: redeemed sinks ────────────────────────────────────────────────

  it("places REDEEMED after UNREDEEMED", () => {
    const input = [
      v({ id: "r1", status: "REDEEMED",   expiryDate: "2025-01-01" }),
      v({ id: "u1", status: "UNREDEEMED", expiryDate: "2026-12-31" }),
    ];
    const result = sortVouchers(input);
    expect(result[0].id).toBe("u1");
    expect(result[1].id).toBe("r1");
  });

  it("places REDEEMED after EXPIRED", () => {
    const input = [
      v({ id: "r1", status: "REDEEMED", expiryDate: "2020-01-01" }),
      v({ id: "e1", status: "EXPIRED",  expiryDate: "2020-06-01" }),
    ];
    const result = sortVouchers(input);
    expect(result[0].id).toBe("e1");
    expect(result[1].id).toBe("r1");
  });

  it("places all REDEEMED after all non-redeemed in a mixed list", () => {
    const input = [
      v({ id: "r2", status: "REDEEMED",   expiryDate: "2024-01-01" }),
      v({ id: "e1", status: "EXPIRED",    expiryDate: "2024-03-01" }),
      v({ id: "r1", status: "REDEEMED",   expiryDate: "2025-01-01" }),
      v({ id: "u1", status: "UNREDEEMED", expiryDate: "2025-06-01" }),
      v({ id: "u2", status: "UNREDEEMED", expiryDate: "2026-12-31" }),
    ];
    const result = sortVouchers(input);
    const ids = result.map((x) => x.id);
    // First three must be non-redeemed, last two redeemed
    expect(ids.slice(0, 3)).not.toContain("r1");
    expect(ids.slice(0, 3)).not.toContain("r2");
    expect(["r1", "r2"]).toContain(ids[3]);
    expect(["r1", "r2"]).toContain(ids[4]);
  });

  // ── Rule 2: earliest expiry first (non-redeemed) ──────────────────────────

  it("sorts UNREDEEMED earliest-expiry-first", () => {
    const input = [
      v({ id: "dec", status: "UNREDEEMED", expiryDate: "2026-12-31" }),
      v({ id: "jul", status: "UNREDEEMED", expiryDate: "2026-07-01" }),
      v({ id: "jan", status: "UNREDEEMED", expiryDate: "2026-01-15" }),
    ];
    const ids = sortVouchers(input).map((x) => x.id);
    expect(ids).toEqual(["jan", "jul", "dec"]);
  });

  it("sorts EXPIRED + UNREDEEMED by expiry, earlier first", () => {
    const input = [
      v({ id: "u-late",  status: "UNREDEEMED", expiryDate: "2027-01-01" }),
      v({ id: "e-early", status: "EXPIRED",    expiryDate: "2023-03-01" }),
      v({ id: "u-mid",   status: "UNREDEEMED", expiryDate: "2026-06-01" }),
    ];
    const ids = sortVouchers(input).map((x) => x.id);
    expect(ids).toEqual(["e-early", "u-mid", "u-late"]);
  });

  // ── Rule 3: no-expiry last among non-redeemed ──────────────────────────────

  it("places no-expiry UNREDEEMED after those with an expiry date", () => {
    const input = [
      v({ id: "no-exp",   status: "UNREDEEMED", expiryDate: null }),
      v({ id: "has-exp",  status: "UNREDEEMED", expiryDate: "2026-06-01" }),
    ];
    const ids = sortVouchers(input).map((x) => x.id);
    expect(ids).toEqual(["has-exp", "no-exp"]);
  });

  it("places no-expiry after expiry even if added earlier", () => {
    const input = [
      v({ id: "no-exp",  status: "UNREDEEMED", expiryDate: null,         dateAdded: "2023-01-01T00:00:00Z" }),
      v({ id: "has-exp", status: "UNREDEEMED", expiryDate: "2027-12-31", dateAdded: "2024-06-01T00:00:00Z" }),
    ];
    const ids = sortVouchers(input).map((x) => x.id);
    expect(ids).toEqual(["has-exp", "no-exp"]);
  });

  // ── Rule 4: redeemed — most recently redeemed first ───────────────────────

  it("sorts REDEEMED most-recently-redeemed-first", () => {
    const input = [
      v({ id: "r-old",  status: "REDEEMED", redeemedAt: "2024-01-15T00:00:00Z" }),
      v({ id: "r-new",  status: "REDEEMED", redeemedAt: "2025-08-01T00:00:00Z" }),
      v({ id: "r-mid",  status: "REDEEMED", redeemedAt: "2024-11-01T00:00:00Z" }),
    ];
    const ids = sortVouchers(input).map((x) => x.id);
    expect(ids).toEqual(["r-new", "r-mid", "r-old"]);
  });

  // ── Rule 5: tie-break on expiry → older dateAdded wins ───────────────────

  it("tie-breaks on dateAdded when expiry is the same", () => {
    const input = [
      v({ id: "newer", status: "UNREDEEMED", expiryDate: "2026-06-01", dateAdded: "2024-06-01T00:00:00Z" }),
      v({ id: "older", status: "UNREDEEMED", expiryDate: "2026-06-01", dateAdded: "2024-01-01T00:00:00Z" }),
    ];
    const ids = sortVouchers(input).map((x) => x.id);
    expect(ids).toEqual(["older", "newer"]);
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it("returns empty array for empty input", () => {
    expect(sortVouchers([])).toEqual([]);
  });

  it("returns single-element array unchanged", () => {
    const single = [v({ id: "only", status: "UNREDEEMED", expiryDate: "2026-01-01" })];
    expect(sortVouchers(single)).toHaveLength(1);
    expect(sortVouchers(single)[0].id).toBe("only");
  });

  it("does not mutate the original array", () => {
    const input = [
      v({ id: "b", status: "UNREDEEMED", expiryDate: "2026-12-31" }),
      v({ id: "a", status: "UNREDEEMED", expiryDate: "2026-01-01" }),
    ];
    const original = [...input];
    sortVouchers(input);
    expect(input[0].id).toBe(original[0].id);
    expect(input[1].id).toBe(original[1].id);
  });
});
