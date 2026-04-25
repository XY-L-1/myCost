import { z } from "zod";

// Recurring rules are local-only until backend storage and sync support are added.
export const RecurringFrequencySchema = z.enum(["weekly", "monthly"]);

export const RecurringExpenseSchema = z.object({
  id: z.string(),
  title: z.string(),
  amountCents: z.number(),
  currency: z.string(),
  categoryId: z.string(),
  description: z.string().nullable(),
  frequency: RecurringFrequencySchema,
  nextDueDate: z.string(),
  lastGeneratedDate: z.string().nullable(),
  isActive: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  ownerKey: z.string(),
  userId: z.string().nullable(),
});

export type RecurringFrequency = z.infer<typeof RecurringFrequencySchema>;
export type RecurringExpense = z.infer<typeof RecurringExpenseSchema>;
