import { DataScope } from "./dataScope";
import { inferDefaultCategoryName } from "./categoryInference";
import {
  deterministicCategoryId,
  deterministicGuestCategoryId,
  normalizeCategoryName,
} from "../utils/categoryIdentity";

export type CategorizedExpense = {
  categoryId: string;
  description: string | null;
  amountCents: number;
};

export type ResolvedCategory = {
  categoryId: string;
  name: string;
};

export type CategoryBreakdownRow = ResolvedCategory & {
  total: number;
};

function getCategoryIdForName(
  scope: DataScope,
  categoryNames: Map<string, string>,
  name: string
): string {
  const normalizedName = normalizeCategoryName(name);

  for (const [categoryId, categoryName] of categoryNames) {
    if (normalizeCategoryName(categoryName) === normalizedName) {
      return categoryId;
    }
  }

  return scope.userId
    ? deterministicCategoryId(scope.userId, name)
    : deterministicGuestCategoryId(name);
}

export function isPlaceholderCategoryName(name: string | null | undefined): boolean {
  const normalized = normalizeCategoryName(name ?? "");
  return normalized === "category" || normalized === "other";
}

export function isEmptyFallbackCategory(
  name: string,
  fallbackName: string,
  budgetCents: number,
  actualCents: number
): boolean {
  return (
    normalizeCategoryName(name) === normalizeCategoryName(fallbackName) &&
    budgetCents === 0 &&
    actualCents === 0
  );
}

export function resolveExpenseCategory(
  scope: DataScope,
  expense: Pick<CategorizedExpense, "categoryId" | "description">,
  categoryNames: Map<string, string>,
  fallbackName: string
): ResolvedCategory {
  const categoryName = categoryNames.get(expense.categoryId);
  const inferredName =
    (!categoryName || isPlaceholderCategoryName(categoryName))
      ? inferDefaultCategoryName(expense.description)
      : null;
  const name = inferredName ?? categoryName ?? fallbackName;

  if (inferredName && (!categoryName || isPlaceholderCategoryName(categoryName))) {
    return {
      categoryId: getCategoryIdForName(scope, categoryNames, inferredName),
      name,
    };
  }

  return {
    categoryId: expense.categoryId,
    name,
  };
}

export function resolveExpenseCategoryName(
  expense: Pick<CategorizedExpense, "categoryId" | "description">,
  categoryName: string | undefined,
  fallbackName: string
): string {
  const inferredName =
    (!categoryName || isPlaceholderCategoryName(categoryName))
      ? inferDefaultCategoryName(expense.description)
      : null;
  return inferredName ?? categoryName ?? fallbackName;
}

export function buildResolvedCategoryBreakdown(
  scope: DataScope,
  expenses: CategorizedExpense[],
  categoryNames: Map<string, string>,
  fallbackName: string
): CategoryBreakdownRow[] {
  const rows = new Map<string, CategoryBreakdownRow>();

  expenses.forEach((expense) => {
    const resolved = resolveExpenseCategory(
      scope,
      expense,
      categoryNames,
      fallbackName
    );
    const normalizedName = normalizeCategoryName(resolved.name);
    const existing = rows.get(normalizedName);
    if (existing) {
      existing.total += expense.amountCents;
      return;
    }
    rows.set(normalizedName, {
      ...resolved,
      total: expense.amountCents,
    });
  });

  return Array.from(rows.values()).sort((a, b) => b.total - a.total);
}

export function filterExpensesByResolvedCategory<T extends CategorizedExpense>(
  scope: DataScope,
  expenses: T[],
  categoryNames: Map<string, string>,
  categoryId: string,
  fallbackName: string
): T[] {
  const targetName = categoryNames.get(categoryId);
  const normalizedTargetName = targetName
    ? normalizeCategoryName(targetName)
    : null;

  return expenses.filter((expense) => {
    const resolved = resolveExpenseCategory(
      scope,
      expense,
      categoryNames,
      fallbackName
    );
    return (
      resolved.categoryId === categoryId ||
      (normalizedTargetName !== null &&
        normalizeCategoryName(resolved.name) === normalizedTargetName)
    );
  });
}
