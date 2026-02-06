import { z } from "zod";

/**
 * ExpenseSchema
 *
 * Represents a single expense record stored in SQLite.
 * This schema is shared across:
 * - Local database reads
 * - Sync push/pull validation
 */
export const ExpenseSchema = z.object({
   id: z.string(),
   amountCents: z.number(),
   currency: z.string(),
   categoryId: z.string(),
   description: z.string().nullable(),
   expenseDate: z.string(), // ISO date (YYYY-MM-DD or full ISO)
   createdAt: z.string(),
   updatedAt: z.string(),
   deletedAt: z.string().nullable(),

   // sync-related fields
   dirty: z.number(),       // 0 | 1
   version: z.number(),
   deviceId: z.string(),
   userId: z.string().nullable(),
});

export type Expense = z.infer<typeof ExpenseSchema>;