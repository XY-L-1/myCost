import { run } from "../db/database";
import { generateUUID } from "../utils/uuid";
import { CategoryRepository } from "../repositories/categoryRepository";
import { userScope } from "../domain/dataScope";
/**
 * insertTestExpense
 *
 * Inserts a single test expense into local SQLite.
 * This is used ONLY for validating sync logic.
 *
 * IMPORTANT:
 * - categoryId MUST be a real UUID that exists in the categories table
 * - otherwise Supabase (Postgres) will reject the row during sync
 */
export async function insertTestExpense(
   userId: string,
   deviceId: string
   ) {
   // 1. Fetch categories from local SQLite
   const categories = await CategoryRepository.getAll(userScope(userId));

   if (categories.length === 0) {
      throw new Error("No categories found. Did you forget to seed categories?");
   }

   // 2. Pick a real category UUID
   const categoryId = categories[0].id;

   // 3. Prepare expense fields
   const now = new Date().toISOString();
   const expenseId = await generateUUID();

   // 4. Insert into local SQLite
   await run(
      `
      INSERT INTO expenses (
         id,
         userId,
         amountCents,
         currency,
         categoryId,
         description,
         expenseDate,
         createdAt,
         updatedAt,
         deletedAt,
         dirty,
         version,
         deviceId,
         ownerKey
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
         expenseId,
         userId,
         1999,            // $19.99
         "USD",
         categoryId,      // ✅ REAL UUID, NOT FAKE
         "Test expense",
         now.slice(0, 10), // YYYY-MM-DD
         now,
         now,
         null,
         1,               // dirty = 1 (important for sync)
         1,               // version = 1
         deviceId,
         userId,
      ]
   );

   console.log("[DEBUG] Inserted test expense:", expenseId);
}
