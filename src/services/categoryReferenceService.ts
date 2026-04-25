import { query, run } from "../db/database";
import { preferBudgetRecord } from "../domain/budgetMerge";

type BudgetRow = {
  id: string;
  categoryId: string;
  monthKey: string;
  amountCents: number;
  createdAt: string;
  updatedAt: string;
  ownerKey: string;
  userId: string | null;
};

export async function repointCategoryReferences(
  ownerKey: string,
  fromCategoryIds: string[],
  canonicalId: string,
  now: string
) {
  const sourceIds = fromCategoryIds.filter((id) => id !== canonicalId);
  if (sourceIds.length === 0) {
    return;
  }

  const placeholders = sourceIds.map(() => "?").join(",");

  await run(
    `
    UPDATE expenses
    SET categoryId = ?, updatedAt = ?, dirty = 1, version = version + 1
    WHERE ownerKey = ?
      AND categoryId IN (${placeholders});
    `,
    [canonicalId, now, ownerKey, ...sourceIds]
  );

  const sourceBudgets = await query<BudgetRow>(
    `
    SELECT *
    FROM budgets
    WHERE ownerKey = ?
      AND categoryId IN (${placeholders})
    ORDER BY updatedAt DESC, createdAt DESC, id DESC;
    `,
    [ownerKey, ...sourceIds]
  );

  for (const budget of sourceBudgets) {
    const canonicalBudgetRows = await query<BudgetRow>(
      `
      SELECT *
      FROM budgets
      WHERE ownerKey = ?
        AND categoryId = ?
        AND monthKey = ?
        AND id != ?
      LIMIT 1;
      `,
      [ownerKey, canonicalId, budget.monthKey, budget.id]
    );

    if (canonicalBudgetRows.length === 0) {
      await run(
        `
        UPDATE budgets
        SET categoryId = ?, updatedAt = ?
        WHERE ownerKey = ?
          AND id = ?;
        `,
        [canonicalId, now, ownerKey, budget.id]
      );
      continue;
    }

    const canonicalBudget = canonicalBudgetRows[0];
    const preferred = preferBudgetRecord(canonicalBudget, budget);

    if (preferred.id === budget.id) {
      await run(
        `
        UPDATE budgets
        SET amountCents = ?, updatedAt = ?
        WHERE ownerKey = ?
          AND id = ?;
        `,
        [budget.amountCents, now, ownerKey, canonicalBudget.id]
      );
    }

    await run(
      `
      DELETE FROM budgets
      WHERE ownerKey = ?
        AND id = ?;
      `,
      [ownerKey, budget.id]
    );
  }

  await run(
    `
    UPDATE recurring_expenses
    SET categoryId = ?, updatedAt = ?
    WHERE ownerKey = ?
      AND categoryId IN (${placeholders});
    `,
    [canonicalId, now, ownerKey, ...sourceIds]
  );
}
