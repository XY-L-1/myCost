import { query, queryFirst, run } from "../db/database";
import { DataScope, buildScopeFilter } from "../domain/dataScope";
import { buildSoftDeletedExpense } from "../domain/expenseMutations";
import { Expense, ExpenseSchema } from "../types/expense";
import { notifyExpenseMutation } from "../sync/syncEvents";

type ExpenseListOptions = {
  monthKey?: string;
  categoryId?: string;
  search?: string;
  limit?: number;
};

export class ExpenseRepository {
  static async create(expense: Expense): Promise<void> {
    await run(
      `
      INSERT INTO expenses (
        id, amountCents, currency, categoryId, description,
        expenseDate, createdAt, updatedAt, deletedAt,
        dirty, version, deviceId, ownerKey, userId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        expense.id,
        expense.amountCents,
        expense.currency,
        expense.categoryId,
        expense.description,
        expense.expenseDate,
        expense.createdAt,
        expense.updatedAt,
        expense.deletedAt,
        expense.dirty,
        expense.version,
        expense.deviceId,
        expense.ownerKey,
        expense.userId,
      ]
    );

    notifyExpenseMutation();
  }

  static async update(expense: Expense): Promise<void> {
    await run(
      `
      UPDATE expenses SET
        amountCents = ?,
        currency = ?,
        categoryId = ?,
        description = ?,
        expenseDate = ?,
        updatedAt = ?,
        dirty = ?,
        version = ?
      WHERE id = ? AND ownerKey = ?;
      `,
      [
        expense.amountCents,
        expense.currency,
        expense.categoryId,
        expense.description,
        expense.expenseDate,
        expense.updatedAt,
        expense.dirty,
        expense.version,
        expense.id,
        expense.ownerKey,
      ]
    );

    notifyExpenseMutation();
  }

  static async softDelete(expense: Expense, deletedAt: string): Promise<void> {
    const nextExpense = buildSoftDeletedExpense(expense, deletedAt);
    await run(
      `
      UPDATE expenses
      SET deletedAt = ?, updatedAt = ?, dirty = 1, version = ?
      WHERE id = ? AND ownerKey = ?;
      `,
      [
        nextExpense.deletedAt,
        nextExpense.updatedAt,
        nextExpense.version,
        nextExpense.id,
        nextExpense.ownerKey,
      ]
    );

    notifyExpenseMutation();
  }

  static async getByIdInScope(
    scope: DataScope,
    id: string
  ): Promise<Expense | null> {
    const owner = buildScopeFilter(scope);
    const row = await queryFirst<Expense>(
      `
      SELECT *
      FROM expenses
      WHERE id = ?
        AND ${owner.clause};
      `,
      [id, ...owner.params]
    );
    return row ? ExpenseSchema.parse(row) : null;
  }

  static async list(
    scope: DataScope,
    options: ExpenseListOptions = {}
  ): Promise<Expense[]> {
    const owner = buildScopeFilter(scope);
    const clauses = [`${owner.clause}`, `deletedAt IS NULL`];
    const params: Array<string | number> = [...owner.params];

    if (options.monthKey) {
      clauses.push(`expenseDate LIKE ? || '%'`);
      params.push(options.monthKey);
    }

    if (options.categoryId) {
      clauses.push(`categoryId = ?`);
      params.push(options.categoryId);
    }

    if (options.search?.trim()) {
      clauses.push(`LOWER(COALESCE(description, '')) LIKE ?`);
      params.push(`%${options.search.trim().toLowerCase()}%`);
    }

    const limitClause = options.limit ? `LIMIT ${options.limit}` : "";
    const rows = await query<Expense>(
      `
      SELECT *
      FROM expenses
      WHERE ${clauses.join(" AND ")}
      ORDER BY expenseDate DESC, createdAt DESC
      ${limitClause};
      `,
      params
    );

    return rows.map((row) => ExpenseSchema.parse(row));
  }

  static async getMonthlyTotal(
    scope: DataScope,
    monthKey: string
  ): Promise<number> {
    const owner = buildScopeFilter(scope);
    const rows = await query<{ total: number | null }>(
      `
      SELECT SUM(amountCents) as total
      FROM expenses
      WHERE ${owner.clause}
        AND deletedAt IS NULL
        AND expenseDate LIKE ? || '%';
      `,
      [...owner.params, monthKey]
    );

    return rows[0]?.total ?? 0;
  }

  static async getMonthlyCategoryBreakdown(
    scope: DataScope,
    monthKey: string
  ): Promise<{ categoryId: string; total: number }[]> {
    const owner = buildScopeFilter(scope);
    return query<{ categoryId: string; total: number }>(
      `
      SELECT categoryId, SUM(amountCents) as total
      FROM expenses
      WHERE ${owner.clause}
        AND deletedAt IS NULL
        AND expenseDate LIKE ? || '%'
      GROUP BY categoryId
      ORDER BY total DESC;
      `,
      [...owner.params, monthKey]
    );
  }

  static async getAvailableMonthKeys(scope: DataScope): Promise<string[]> {
    const owner = buildScopeFilter(scope);
    const rows = await query<{ monthKey: string }>(
      `
      SELECT DISTINCT substr(expenseDate, 1, 7) as monthKey
      FROM expenses
      WHERE ${owner.clause}
        AND deletedAt IS NULL
      ORDER BY monthKey DESC;
      `,
      owner.params
    );

    return rows.map((row) => row.monthKey);
  }
}
