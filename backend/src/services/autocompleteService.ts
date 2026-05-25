import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function upsertAutocomplete(field: string, value: string, userId: string | null): Promise<void> {
  if (!field || !value?.trim()) return;
  const trimmed = value.trim();
  const existing = await prisma.autocompleteEntry.findFirst({ where: { field, value: trimmed, userId } });
  if (existing) {
    await prisma.autocompleteEntry.update({ where: { id: existing.id }, data: { count: { increment: 1 } } });
  } else {
    await prisma.autocompleteEntry.create({ data: { field, value: trimmed, userId } });
  }
}

// Maps autocomplete field names to the DB column they populate in Voucher
const VOUCHER_FIELDS: Record<string, string> = {
  brand:               "brand",
  sourceProgramOrCard: "sourceProgramOrCard",
  voucherType:         "voucherType",
};

// Maps autocomplete field names to the DB column they populate in Card
const CARD_FIELDS: Record<string, string> = {
  accountOwner: "accountOwner",
  bank:         "bank",
  cardType:     "cardType",
  email:        "email",
  mobileNumber: "mobileNumber",
};

export async function renameValue(field: string, oldValue: string, newValue: string, userId: string | null): Promise<void> {
  const trimNew = newValue.trim();
  if (!trimNew) throw new Error("New value cannot be empty");
  if (trimNew === oldValue) return;

  const target   = await prisma.autocompleteEntry.findFirst({ where: { field, value: oldValue,  userId } });
  if (!target) throw new Error(`Entry not found`);

  const conflict = await prisma.autocompleteEntry.findFirst({ where: { field, value: trimNew, userId } });
  if (conflict) throw new Error(`"${trimNew}" already exists for this field`);

  await prisma.$transaction(async (tx) => {
    await tx.autocompleteEntry.update({ where: { id: target.id }, data: { value: trimNew } });

    // Cascade rename only within this user's vouchers and cards
    const voucherCol = VOUCHER_FIELDS[field];
    if (voucherCol) {
      await (tx.voucher as any).updateMany({
        where: { [voucherCol]: oldValue, userId },
        data:  { [voucherCol]: trimNew },
      });
    }

    const cardCol = CARD_FIELDS[field];
    if (cardCol) {
      await (tx.card as any).updateMany({
        where: { [cardCol]: oldValue, userId },
        data:  { [cardCol]: trimNew },
      });
    }
  });
}

export async function deleteEntry(field: string, value: string, userId: string | null): Promise<void> {
  const entry = await prisma.autocompleteEntry.findFirst({ where: { field, value, userId } });
  if (!entry) return;
  await prisma.autocompleteEntry.delete({ where: { id: entry.id } });
}
