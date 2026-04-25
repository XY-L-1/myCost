export type MergeableBudget = {
  id: string;
  amountCents: number;
  createdAt: string;
  updatedAt: string;
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
