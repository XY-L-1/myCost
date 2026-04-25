import { query, queryFirst, run } from "../db/database";
import { DataScope, buildScopeFilter } from "../domain/dataScope";
import {
  RecurringExpense,
  RecurringExpenseSchema,
  RecurringFrequency,
} from "../types/recurringExpense";
import { generateUUID } from "../utils/uuid";
import { notifyRecurringExpenseMutation } from "../sync/syncEvents";

/**
 * Recurring expenses are local-first and sync when a signed-in account is available.
 */
type RecurringExpenseInput = {
  title: string;
  amountCents: number;
  currency: string;
  categoryId: string;
  description: string | null;
  frequency: RecurringFrequency;
  nextDueDate: string;
};

export class RecurringExpenseRepository {
  static async getAll(scope: DataScope): Promise<RecurringExpense[]> {
    const owner = buildScopeFilter(scope);
    const rows = await query<RecurringExpense>(
      `
      SELECT *
      FROM recurring_expenses
      WHERE ${owner.clause}
      ORDER BY isActive DESC, nextDueDate ASC, title ASC;
      `,
      owner.params
    );

    return rows.map((row) => RecurringExpenseSchema.parse(row));
  }

  static async getByIdInScope(
    scope: DataScope,
    id: string
  ): Promise<RecurringExpense | null> {
    const owner = buildScopeFilter(scope);
    const row = await queryFirst<RecurringExpense>(
      `
      SELECT *
      FROM recurring_expenses
      WHERE id = ?
        AND ${owner.clause};
      `,
      [id, ...owner.params]
    );

    return row ? RecurringExpenseSchema.parse(row) : null;
  }

  static async create(
    scope: DataScope,
    input: RecurringExpenseInput
  ): Promise<RecurringExpense> {
    const now = new Date().toISOString();
    const recurringExpense: RecurringExpense = {
      id: await generateUUID(),
      title: input.title,
      amountCents: input.amountCents,
      currency: input.currency,
      categoryId: input.categoryId,
      description: input.description,
      frequency: input.frequency,
      nextDueDate: input.nextDueDate,
      lastGeneratedDate: null,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
      ownerKey: scope.ownerKey,
      userId: scope.userId,
    };

    await run(
      `
      INSERT INTO recurring_expenses (
        id, title, amountCents, currency, categoryId, description,
        frequency, nextDueDate, lastGeneratedDate, isActive,
        createdAt, updatedAt, ownerKey, userId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        recurringExpense.id,
        recurringExpense.title,
        recurringExpense.amountCents,
        recurringExpense.currency,
        recurringExpense.categoryId,
        recurringExpense.description,
        recurringExpense.frequency,
        recurringExpense.nextDueDate,
        recurringExpense.lastGeneratedDate,
        recurringExpense.isActive,
        recurringExpense.createdAt,
        recurringExpense.updatedAt,
        recurringExpense.ownerKey,
        recurringExpense.userId,
      ]
    );

    notifyRecurringExpenseMutation();

    return recurringExpense;
  }

  static async update(
    recurringExpense: RecurringExpense,
    input: RecurringExpenseInput
  ): Promise<RecurringExpense> {
    const updatedAt = new Date().toISOString();
    await run(
      `
      UPDATE recurring_expenses
      SET title = ?, amountCents = ?, currency = ?, categoryId = ?, description = ?,
          frequency = ?, nextDueDate = ?, updatedAt = ?
      WHERE id = ? AND ownerKey = ?;
      `,
      [
        input.title,
        input.amountCents,
        input.currency,
        input.categoryId,
        input.description,
        input.frequency,
        input.nextDueDate,
        updatedAt,
        recurringExpense.id,
        recurringExpense.ownerKey,
      ]
    );

    notifyRecurringExpenseMutation();

    return {
      ...recurringExpense,
      ...input,
      updatedAt,
    };
  }

  static async setActive(
    scope: DataScope,
    id: string,
    isActive: boolean
  ): Promise<void> {
    const owner = buildScopeFilter(scope);
    await run(
      `
      UPDATE recurring_expenses
      SET isActive = ?, updatedAt = ?
      WHERE id = ? AND ${owner.clause};
      `,
      [isActive ? 1 : 0, new Date().toISOString(), id, ...owner.params]
    );
    notifyRecurringExpenseMutation();
  }

  static async updateGenerationState(
    scope: DataScope,
    id: string,
    nextDueDate: string,
    lastGeneratedDate: string
  ): Promise<void> {
    const owner = buildScopeFilter(scope);
    await run(
      `
      UPDATE recurring_expenses
      SET nextDueDate = ?, lastGeneratedDate = ?, updatedAt = ?
      WHERE id = ? AND ${owner.clause};
      `,
      [nextDueDate, lastGeneratedDate, new Date().toISOString(), id, ...owner.params]
    );
    notifyRecurringExpenseMutation();
  }

  static async remove(scope: DataScope, id: string): Promise<void> {
    const owner = buildScopeFilter(scope);
    await run(
      `DELETE FROM recurring_expenses WHERE id = ? AND ${owner.clause};`,
      [id, ...owner.params]
    );
    notifyRecurringExpenseMutation();
  }
}
