import type { Expense } from "../types/expense";

export function buildSoftDeletedExpense(expense: Expense, deletedAt: string): Expense {
  return {
    ...expense,
    deletedAt,
    updatedAt: deletedAt,
    dirty: 1,
    version: expense.version + 1,
  };
}
