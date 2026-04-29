export type MergeableBudget = {
  id: string;
  amountCents: number;
  createdAt: string;
  updatedAt: string;
};

export type BudgetIdentity = {
  id: string;
  categoryId: string;
  monthKey: string;
};

export function preferBudgetRecord<T extends MergeableBudget>(a: T, b: T): T {
  const updatedDiff =
    new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
  if (updatedDiff !== 0) {
    return updatedDiff > 0 ? a : b;
  }

  const createdDiff =
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (createdDiff !== 0) {
    return createdDiff > 0 ? a : b;
  }

  return a.id >= b.id ? a : b;
}

export function budgetIdentityKey(budget: Pick<BudgetIdentity, "categoryId" | "monthKey">): string {
  return `${budget.categoryId}:${budget.monthKey}`;
}

export function findMatchingBudgetRecord<T extends BudgetIdentity>(
  records: T[],
  budget: BudgetIdentity
): T | undefined {
  const key = budgetIdentityKey(budget);
  const byKey = records.find((record) => budgetIdentityKey(record) === key);
  if (byKey) return byKey;

  return records.find((record) => record.id === budget.id);
}
