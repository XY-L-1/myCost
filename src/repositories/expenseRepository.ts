import { exec, query, run } from "../db/database";
import { Expense, ExpenseSchema } from "../types/expense";

/**
 * ExpenseRepository
 *
 * Handles all local SQLite access for expenses.
 * This layer contains NO business logic and NO sync logic.
 */
export class ExpenseRepository {
   /**
      * Insert a new expense into SQLite.
      */
   static async create(expense: Expense): Promise<void> {
      await run(
         `
         INSERT INTO expenses (
         id, amountCents, currency, categoryId, description,
         expenseDate, createdAt, updatedAt, deletedAt,
         dirty, version, deviceId, userId
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
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
         expense.userId,
         ]
      );
   }

   /**
      * Update an existing expense.
      * Marks the record as dirty for future sync.
      */
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
         WHERE id = ?;
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
         ]
      );
   }

   /**
      * Soft delete an expense using deletedAt (tombstone).
      */
   static async softDelete(id: string, deletedAt: string): Promise<void> {
      await run(
         `
         UPDATE expenses
         SET deletedAt = ?, dirty = 1
         WHERE id = ?;
         `,
         [deletedAt, id]
      );
   }

   /**
      * Get all expenses for a given month.
      */
   static async getByMonth(year: number, month: number): Promise<Expense[]> {
      const monthStr = `${year}-${String(month).padStart(2, "0")}`;

      const rows = await query<Expense>(
         `
         SELECT *
         FROM expenses
         WHERE deletedAt IS NULL
         AND expenseDate LIKE ? || '%'
         ORDER BY expenseDate DESC;
         `,
         [monthStr]
      );

      return rows.map((row) => ExpenseSchema.parse(row));
   }

   /**
    * Get total spending for a given month.
    */
   static async getMonthlyTotal(
      year: number,
      month: number
   ): Promise<number> {
   const monthStr = `${year}-${String(month).padStart(2, "0")}`;

   const rows = await query<{ total: number }>(
      `
      SELECT SUM(amountCents) as total
      FROM expenses
      WHERE deletedAt IS NULL
         AND expenseDate LIKE ? || '%';
      `,
      [monthStr]
   );

   return rows[0]?.total ?? 0;
   }


   /**
    * Get spending breakdown by category for a given month.
    */
   static async getMonthlyCategoryBreakdown(
      year: number,
      month: number
   ): Promise<{ categoryId: string; total: number }[]> {
   const monthStr = `${year}-${String(month).padStart(2, "0")}`;

   return query(
      `
      SELECT categoryId, SUM(amountCents) as total
      FROM expenses
      WHERE deletedAt IS NULL
         AND expenseDate LIKE ? || '%'
      GROUP BY categoryId;
      `,
      [monthStr]
   );
   }
   
}