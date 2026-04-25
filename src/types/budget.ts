import { z } from "zod";

// Budgets are local-only until backend storage and sync support are added.
export const BudgetSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  monthKey: z.string(),
  amountCents: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  ownerKey: z.string(),
  userId: z.string().nullable(),
});

export type Budget = z.infer<typeof BudgetSchema>;
