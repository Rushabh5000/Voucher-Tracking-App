import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function upsertAutocomplete(field: string, value: string): Promise<void> {
  if (!field || !value?.trim()) return;
  await prisma.autocompleteEntry.upsert({
    where: { field_value: { field, value: value.trim() } },
    update: { count: { increment: 1 } },
    create: { field, value: value.trim() },
  });
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

export async function renameValue(field: string, oldValue: string, newValue: string): Promise<void> {
  const trimNew = newValue.trim();
  if (!trimNew) throw new Error("New value cannot be empty");
  if (trimNew === oldValue) return;

  const conflict = await prisma.autocompleteEntry.findUnique({
    where: { field_value: { field, value: trimNew } },
  });
  if (conflict) throw new Error(`"${trimNew}" already exists for this field`);

  await prisma.$transaction(async (tx) => {
    await tx.autocompleteEntry.update({
      where: { field_value: { field, value: oldValue } },
      data:  { value: trimNew },
    });

    const voucherCol = VOUCHER_FIELDS[field];
    if (voucherCol) {
      await (tx.voucher as any).updateMany({
        where: { [voucherCol]: oldValue },
        data:  { [voucherCol]: trimNew },
      });
    }

    const cardCol = CARD_FIELDS[field];
    if (cardCol) {
      await (tx.card as any).updateMany({
        where: { [cardCol]: oldValue },
        data:  { [cardCol]: trimNew },
      });
    }
  });
}

export async function deleteEntry(field: string, value: string): Promise<void> {
  await prisma.autocompleteEntry.delete({
    where: { field_value: { field, value } },
  });
}
