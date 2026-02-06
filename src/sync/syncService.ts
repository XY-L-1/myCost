import { query, run } from "../db/database";
import { Expense } from "../types/expense";
import { supabase } from "../auth/supabaseClient";

/**
 * pushDirtyExpenses
 *
 * Pushes locally modified (dirty) expenses to Supabase.
 * This function is idempotent and safe to retry.
 */
export async function pushDirtyExpenses(userId: string): Promise<void> {
   // 1. Find dirty expenses
   const dirtyExpenses = await query<Expense>(
      `SELECT * FROM expenses WHERE dirty = 1 AND userId = ?;`,
      [userId]
   );

   console.log(`[SYNC] Found ${dirtyExpenses.length} dirty expenses`);

   for (const expense of dirtyExpenses) {
      console.log(`[SYNC] Pushing expense ${expense.id}`);

      const { error } = await supabase
         .from("expenses")
         .upsert({
         id: expense.id,
         user_id: userId,
         amount_cents: expense.amountCents,
         currency: expense.currency,
         category_id: expense.categoryId,
         description: expense.description,
         expense_date: expense.expenseDate,
         created_at: expense.createdAt,
         updated_at: expense.updatedAt,
         deleted_at: expense.deletedAt,
         version: expense.version,
         device_id: expense.deviceId,
         });

      if (error) {
         console.error("[SYNC] Failed to push expense", expense.id, error);
         throw error;
      }

      // Mark local record as clean
      await run(
         `UPDATE expenses SET dirty = 0 WHERE id = ?;`,
         [expense.id]
      );
   }
}