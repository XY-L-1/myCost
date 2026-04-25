import { query, queryFirst, run } from "../db/database";
import { DataScope, buildScopeFilter } from "../domain/dataScope";
import { Budget, BudgetSchema } from "../types/budget";
import { generateUUID } from "../utils/uuid";
import { notifyBudgetMutation } from "../sync/syncEvents";

/**
 * Budgets are local-first and sync when a signed-in account is available.
 */
type BudgetInput = {
  categoryId: string;
  monthKey: string;
  amountCents: number;
};

export class BudgetRepository {
  static async getByMonth(scope: DataScope, monthKey: string): Promise<Budget[]> {
    const owner = buildScopeFilter(scope);
    const rows = await query<Budget>(
      `
      SELECT *
      FROM budgets
      WHERE ${owner.clause}
        AND monthKey = ?
      ORDER BY categoryId;
      `,
      [...owner.params, monthKey]
    );

    return rows.map((row) => BudgetSchema.parse(row));
  }

  static async upsert(scope: DataScope, input: BudgetInput): Promise<Budget> {
    const existing = await this.findByCategoryAndMonth(
      scope,
      input.categoryId,
      input.monthKey
    );
    const now = new Date().toISOString();

    if (existing) {
      await run(
        `
        UPDATE budgets
        SET amountCents = ?, updatedAt = ?
        WHERE id = ? AND ownerKey = ?;
        `,
        [input.amountCents, now, existing.id, existing.ownerKey]
      );

      notifyBudgetMutation();

      return {
        ...existing,
        amountCents: input.amountCents,
        updatedAt: now,
      };
    }

    const budget: Budget = {
      id: await generateUUID(),
      categoryId: input.categoryId,
      monthKey: input.monthKey,
      amountCents: input.amountCents,
      createdAt: now,
      updatedAt: now,
      ownerKey: scope.ownerKey,
      userId: scope.userId,
    };

    await run(
      `
      INSERT INTO budgets (
        id, categoryId, monthKey, amountCents, createdAt, updatedAt, ownerKey, userId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        budget.id,
        budget.categoryId,
        budget.monthKey,
        budget.amountCents,
        budget.createdAt,
        budget.updatedAt,
        budget.ownerKey,
        budget.userId,
      ]
    );

    notifyBudgetMutation();

    return budget;
  }

  static async findByCategoryAndMonth(
    scope: DataScope,
    categoryId: string,
    monthKey: string
  ): Promise<Budget | null> {
    const owner = buildScopeFilter(scope);
    const row = await queryFirst<Budget>(
      `
      SELECT *
      FROM budgets
      WHERE ${owner.clause}
        AND categoryId = ?
        AND monthKey = ?;
      `,
      [...owner.params, categoryId, monthKey]
    );

    return row ? BudgetSchema.parse(row) : null;
  }
}
