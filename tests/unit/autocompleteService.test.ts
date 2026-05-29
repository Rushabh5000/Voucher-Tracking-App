/**
 * Unit tests for autocompleteService.
 *
 * Prisma is mocked so these run without a database.
 *
 * Behaviours under test:
 *  - upsertAutocomplete: guards against empty field / whitespace value
 *  - upsertAutocomplete: creates a new entry when none exists
 *  - upsertAutocomplete: increments count on existing entry
 *  - upsertAutocomplete: trims whitespace from value before saving
 *  - renameValue: rejects empty new value
 *  - renameValue: no-ops when old === new
 *  - renameValue: throws when entry not found
 *  - renameValue: throws on conflict with existing value
 *  - deleteEntry: no-ops gracefully when entry absent
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock @prisma/client before importing the service ──────────────────────────

const mockFindFirst  = vi.fn();
const mockCreate     = vi.fn();
const mockUpdate     = vi.fn();
const mockDelete     = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@prisma/client", () => {
  // Must use a regular function (not arrow) so `new PrismaClient()` works
  function MockPrismaClient() {
    return {
      autocompleteEntry: {
        findFirst:  mockFindFirst,
        create:     mockCreate,
        update:     mockUpdate,
        delete:     mockDelete,
      },
      $transaction: mockTransaction,
    };
  }
  return { PrismaClient: MockPrismaClient };
});

// Import AFTER mock registration
const { upsertAutocomplete, renameValue, deleteEntry } = await import(
  "../../backend/src/services/autocompleteService"
);

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── upsertAutocomplete ────────────────────────────────────────────────────────

describe("upsertAutocomplete", () => {

  it("returns without touching DB if field is empty", async () => {
    await upsertAutocomplete("", "SomeValue", null);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("returns without touching DB if value is whitespace", async () => {
    await upsertAutocomplete("brand", "   ", null);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("returns without touching DB if value is empty string", async () => {
    await upsertAutocomplete("brand", "", null);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("creates a new entry when none exists", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "new-id", field: "brand", value: "Amazon", userId: null });

    await upsertAutocomplete("brand", "Amazon", null);

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { field: "brand", value: "Amazon", userId: null },
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: { field: "brand", value: "Amazon", userId: null },
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("increments count on existing entry (does not create)", async () => {
    mockFindFirst.mockResolvedValue({ id: "existing-id", count: 1 });
    mockUpdate.mockResolvedValue({ id: "existing-id", count: 2 });

    await upsertAutocomplete("brand", "Amazon", null);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "existing-id" },
      data:  { count: { increment: 1 } },
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("trims whitespace from value before lookup and save", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "x" });

    await upsertAutocomplete("brand", "  HDFC  ", "user-123");

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { field: "brand", value: "HDFC", userId: "user-123" },
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: { field: "brand", value: "HDFC", userId: "user-123" },
    });
  });

  it("scopes lookup by userId (guest vs admin)", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "y" });

    await upsertAutocomplete("bank", "SBI", "guest-abc");

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "guest-abc" }) })
    );
  });
});

// ── renameValue ───────────────────────────────────────────────────────────────

describe("renameValue", () => {

  it("throws if new value is empty", async () => {
    await expect(renameValue("brand", "Amazon", "  ", null))
      .rejects.toThrow("New value cannot be empty");
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("no-ops if old === new (returns without DB writes)", async () => {
    await renameValue("brand", "Amazon", "Amazon", null);
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("throws if target entry is not found", async () => {
    mockFindFirst.mockResolvedValueOnce(null); // target lookup → not found
    await expect(renameValue("brand", "Flipkart", "NewName", null))
      .rejects.toThrow("Entry not found");
  });

  it("throws if new name conflicts with an existing entry", async () => {
    mockFindFirst
      .mockResolvedValueOnce({ id: "old-id" })   // target found
      .mockResolvedValueOnce({ id: "conf-id" });  // conflict found
    await expect(renameValue("brand", "Flipkart", "Amazon", null))
      .rejects.toThrow(/already exists/i);
  });

  it("executes a transaction when rename is valid", async () => {
    mockFindFirst
      .mockResolvedValueOnce({ id: "target-id" }) // target found
      .mockResolvedValueOnce(null);               // no conflict
    mockTransaction.mockResolvedValue(undefined);

    await renameValue("brand", "OldBrand", "NewBrand", null);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});

// ── deleteEntry ───────────────────────────────────────────────────────────────

describe("deleteEntry", () => {

  it("does nothing if entry is not found (graceful no-op)", async () => {
    mockFindFirst.mockResolvedValue(null);

    await deleteEntry("brand", "Ghost", null);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes by id when entry exists", async () => {
    mockFindFirst.mockResolvedValue({ id: "del-id" });
    mockDelete.mockResolvedValue({ id: "del-id" });

    await deleteEntry("brand", "Amazon", null);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "del-id" } });
  });

  it("scopes lookup by userId", async () => {
    mockFindFirst.mockResolvedValue(null);

    await deleteEntry("bank", "HDFC", "guest-xyz");
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { field: "bank", value: "HDFC", userId: "guest-xyz" },
    });
  });
});
