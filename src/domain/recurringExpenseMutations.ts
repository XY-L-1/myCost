import type { RecurringExpense } from "../types/recurringExpense";

export function buildSoftDeletedRecurringExpense(
  recurringExpense: RecurringExpense,
  deletedAt: string
): RecurringExpense {
  return {
    ...recurringExpense,
    deletedAt,
    updatedAt: deletedAt,
  };
}
