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
