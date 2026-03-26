import { query, run } from "../db/database";
import { Category, CategorySchema } from "../types/category";
import { Expense, ExpenseSchema } from "../types/expense";
import { supabase } from "../auth/supabaseClient";
import { normalizeCategoryName } from "../utils/categoryIdentity";

type RemoteExpenseRow = {
   id: string;
   user_id: string;
   amount_cents: number;
   currency: string;
   category_id: string;
   description: string | null;
   expense_date: string;
   created_at: string;
   updated_at: string;
   deleted_at: string | null;
   version: number;
   device_id: string;
};

type RemoteCategoryRow = {
   id: string;
   user_id: string;
   name: string;
   normalized_name?: string | null;
   created_at: string;
   updated_at: string;
   deleted_at: string | null;
   version: number;
   device_id: string;
};

type RemoteCategoryNameRow = {
   id: string;
   name: string;
   deleted_at: string | null;
   normalized_name?: string | null;
};

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

/**
 * pushDirtyCategories
 *
 * Pushes locally modified (dirty) categories to Supabase.
 * This function is idempotent and safe to retry.
 */
export async function pushDirtyCategories(userId: string): Promise<void> {
   const dirtyCategories = await query<Category>(
      `SELECT * FROM categories WHERE dirty = 1 AND userId = ?;`,
      [userId]
   );

   console.log(`[SYNC] Found ${dirtyCategories.length} dirty categories`);

   if (dirtyCategories.length === 0) return;

   const remoteNameMap = await fetchRemoteCategoryNameMap(userId);

   for (const category of dirtyCategories) {
      console.log(`[SYNC] Pushing category ${category.id}`);

      const normalized =
         category.normalizedName ?? normalizeCategoryName(category.name);
      let remoteMatch = remoteNameMap.get(normalized);

      if (!remoteMatch) {
         remoteMatch = await fetchRemoteCategoryByNormalized(userId, normalized);
      }

      if (remoteMatch && remoteMatch.id !== category.id) {
         // Remote already owns this name; merge locally to avoid unique violation.
         if (remoteMatch.deleted_at) {
            await reviveRemoteCategory(remoteMatch.id, category, userId);
         }
         await mergeLocalCategoryDuplicate(category.id, remoteMatch.id);
         continue;
      }

      const { error } = await supabase.from("categories").upsert({
         id: category.id,
         user_id: userId,
         name: category.name,
         normalized_name: normalized,
         created_at: category.createdAt,
         updated_at: category.updatedAt,
         deleted_at: category.deletedAt,
         version: category.version,
         device_id: category.deviceId,
      });

      if (error) {
         const errorCode = (error as { code?: string }).code;
         if (errorCode === "23505") {
            console.warn(
               "[SYNC] Category name conflict; resolving locally",
               category.id
            );
            // Resolve any race with a fresh remote lookup by normalized name.
            const resolved =
               (await fetchRemoteCategoryByNormalized(userId, normalized)) ??
               (await fetchRemoteCategoryNameMap(userId)).get(normalized);
            if (resolved && resolved.id !== category.id) {
               console.log(
                  "[SYNC] Merging duplicate category into remote canonical",
                  {
                     localId: category.id,
                     remoteId: resolved.id,
                     normalized,
                  }
               );
               await mergeLocalCategoryDuplicate(category.id, resolved.id);
               continue;
            }
            if (resolved && resolved.id === category.id) {
               // Remote already has this category; mark clean to avoid retries.
               await run(`UPDATE categories SET dirty = 0 WHERE id = ?;`, [
                  category.id,
               ]);
               console.log(
                  "[SYNC] Marked category clean (already exists remotely)",
                  category.id
               );
               continue;
            }
            const localCanonical = await findLocalCategoryByNormalized(
               userId,
               normalized,
               category.id
            );
            if (localCanonical) {
               if (localCanonical.deletedAt) {
                  // Revive local canonical so expenses point to an active category.
                  await run(
                     `UPDATE categories
                      SET deletedAt = NULL, updatedAt = ?, dirty = 1, version = version + 1
                      WHERE id = ?;`,
                     [new Date().toISOString(), localCanonical.id]
                  );
               }
               console.log("[SYNC] Merging duplicate into local canonical", {
                  localId: category.id,
                  canonicalId: localCanonical.id,
                  normalized,
               });
               await mergeLocalCategoryDuplicate(category.id, localCanonical.id);
               continue;
            }
            // Last resort: stop retrying this row to avoid infinite loops.
            await run(`UPDATE categories SET dirty = 0 WHERE id = ?;`, [
               category.id,
            ]);
            console.warn(
               "[SYNC] Cleared dirty flag to avoid retry loop",
               category.id
            );
            continue;
         }
         console.error("[SYNC] Failed to push category", category.id, error);
         throw error;
      }

      await run(`UPDATE categories SET dirty = 0 WHERE id = ?;`, [
         category.id,
      ]);
   }
}

/**
 * pullRemoteExpenses
 *
 * Pulls all remote expenses for the user and applies them to local SQLite.
 * This is safe to call multiple times (idempotent).
 */
export async function pullRemoteExpenses(userId: string): Promise<void> {
   const pageSize = 500;
   let from = 0;
   let to = pageSize - 1;
   const remoteRows: RemoteExpenseRow[] = [];

   while (true) {
      const { data, error } = await supabase
         .from("expenses")
         .select(
            "id,user_id,amount_cents,currency,category_id,description,expense_date,created_at,updated_at,deleted_at,version,device_id"
         )
         .eq("user_id", userId)
         .range(from, to);

      if (error) {
         console.error("[SYNC] Failed to pull expenses", error);
         throw error;
      }

      if (!data || data.length === 0) {
         break;
      }

      remoteRows.push(...(data as RemoteExpenseRow[]));

      if (data.length < pageSize) {
         break;
      }

      from += pageSize;
      to += pageSize;
   }

   await applyRemoteChanges(userId, remoteRows);
}

/**
 * pullRemoteCategories
 *
 * Pulls all remote categories for the user and applies them to local SQLite.
 * This is safe to call multiple times (idempotent).
 */
export async function pullRemoteCategories(userId: string): Promise<void> {
   const pageSize = 500;
   let from = 0;
   let to = pageSize - 1;
   const remoteRows: RemoteCategoryRow[] = [];

   while (true) {
      const { data, error } = await supabase
         .from("categories")
         .select(
            "id,user_id,name,normalized_name,created_at,updated_at,deleted_at,version,device_id"
         )
         .eq("user_id", userId)
         .range(from, to);

      if (error) {
         console.error("[SYNC] Failed to pull categories", error);
         throw error;
      }

      if (!data || data.length === 0) {
         break;
      }

      remoteRows.push(...(data as RemoteCategoryRow[]));

      if (data.length < pageSize) {
         break;
      }

      from += pageSize;
      to += pageSize;
   }

   await applyRemoteCategoryChanges(userId, remoteRows);
}

/**
 * applyRemoteChanges
 *
 * Applies remote records into SQLite using deterministic conflict rules:
 * - Compare updatedAt first
 * - Higher version wins if timestamps tie
 * - Deletes win over updates
 * - Break ties by deviceId
 */
export async function applyRemoteChanges(
   userId: string,
   remoteRows: RemoteExpenseRow[]
): Promise<void> {
   for (const row of remoteRows) {
      if (row.user_id !== userId) {
         continue;
      }

      const remote = mapRemoteExpense(row);

      const localRows = await query<Expense>(
         `SELECT * FROM expenses WHERE id = ?;`,
         [remote.id]
      );

      if (localRows.length === 0) {
         await insertLocalExpense(remote);
         continue;
      }

      const local = ExpenseSchema.parse(localRows[0]);
      const winner = resolveConflict(local, remote);

      if (winner === "remote") {
         await updateLocalExpense(remote);
      }
   }
}

/**
 * applyRemoteCategoryChanges
 *
 * Applies remote category records into SQLite using deterministic rules.
 */
export async function applyRemoteCategoryChanges(
   userId: string,
   remoteRows: RemoteCategoryRow[]
): Promise<void> {
   for (const row of remoteRows) {
      if (row.user_id !== userId) {
         continue;
      }

      const remote = mapRemoteCategory(row);

      const localRows = await query<Category>(
         `SELECT * FROM categories WHERE id = ?;`,
         [remote.id]
      );

      if (localRows.length === 0) {
         await insertLocalCategory(remote);
         continue;
      }

      const local = CategorySchema.parse(localRows[0]);
      const winner = resolveCategoryConflict(local, remote);

      if (winner === "remote") {
         await updateLocalCategory(remote);
      }
   }
}

function mapRemoteExpense(row: RemoteExpenseRow): Expense {
   return {
      id: row.id,
      userId: row.user_id,
      amountCents: row.amount_cents,
      currency: row.currency,
      categoryId: row.category_id,
      description: row.description,
      expenseDate: row.expense_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      dirty: 0,
      version: row.version,
      deviceId: row.device_id,
   };
}

function resolveConflict(
   local: Expense,
   remote: Expense
): "local" | "remote" {
   const localUpdated = new Date(local.updatedAt).getTime();
   const remoteUpdated = new Date(remote.updatedAt).getTime();

   if (remoteUpdated > localUpdated) return "remote";
   if (remoteUpdated < localUpdated) return "local";

   if (remote.version > local.version) return "remote";
   if (remote.version < local.version) return "local";

   const localDeleted = !!local.deletedAt;
   const remoteDeleted = !!remote.deletedAt;
   if (remoteDeleted && !localDeleted) return "remote";
   if (localDeleted && !remoteDeleted) return "local";

   if (remote.deviceId > local.deviceId) return "remote";
   return "local";
}

function mapRemoteCategory(row: RemoteCategoryRow): Category {
   const normalized =
      row.normalized_name ?? normalizeCategoryName(row.name);
   return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      normalizedName: normalized,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      dirty: 0,
      version: row.version,
      deviceId: row.device_id,
   };
}

function resolveCategoryConflict(
   local: Category,
   remote: Category
): "local" | "remote" {
   const localUpdated = new Date(local.updatedAt).getTime();
   const remoteUpdated = new Date(remote.updatedAt).getTime();

   if (remoteUpdated > localUpdated) return "remote";
   if (remoteUpdated < localUpdated) return "local";

   if (remote.version > local.version) return "remote";
   if (remote.version < local.version) return "local";

   const localDeleted = !!local.deletedAt;
   const remoteDeleted = !!remote.deletedAt;
   if (remoteDeleted && !localDeleted) return "remote";
   if (localDeleted && !remoteDeleted) return "local";

   if (remote.deviceId > local.deviceId) return "remote";
   return "local";
}

async function insertLocalCategory(category: Category): Promise<void> {
   const normalizedName =
      category.normalizedName ?? normalizeCategoryName(category.name);
   await run(
      `
      INSERT INTO categories (
         id, name, normalizedName, createdAt, updatedAt, deletedAt,
         dirty, version, deviceId, userId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
         category.id,
         category.name,
         normalizedName,
         category.createdAt,
         category.updatedAt,
         category.deletedAt,
         0,
         category.version,
         category.deviceId,
         category.userId,
      ]
   );
}

async function updateLocalCategory(category: Category): Promise<void> {
   const normalizedName =
      category.normalizedName ?? normalizeCategoryName(category.name);
   await run(
      `
      UPDATE categories SET
         name = ?,
         normalizedName = ?,
         createdAt = ?,
         updatedAt = ?,
         deletedAt = ?,
         dirty = ?,
         version = ?,
         deviceId = ?,
         userId = ?
      WHERE id = ?;
      `,
      [
         category.name,
         normalizedName,
         category.createdAt,
         category.updatedAt,
         category.deletedAt,
         0,
         category.version,
         category.deviceId,
         category.userId,
         category.id,
      ]
   );
}

async function fetchRemoteCategoryNameMap(
   userId: string
): Promise<Map<string, RemoteCategoryNameRow>> {
   const pageSize = 500;
   let from = 0;
   let to = pageSize - 1;
   const rows: RemoteCategoryNameRow[] = [];

   while (true) {
      const { data, error } = await supabase
         .from("categories")
         .select("id,name,deleted_at,normalized_name")
         .eq("user_id", userId)
         .range(from, to);

      if (error) {
         console.error("[SYNC] Failed to pull category names", error);
         throw error;
      }

      if (!data || data.length === 0) break;

      rows.push(...(data as RemoteCategoryNameRow[]));
      if (data.length < pageSize) break;

      from += pageSize;
      to += pageSize;
   }

   const map = new Map<string, RemoteCategoryNameRow>();
   rows.forEach((row) => {
      const normalized =
         row.normalized_name ?? normalizeCategoryName(row.name);
      map.set(normalized, row);
   });

   return map;
}

async function fetchRemoteCategoryByNormalized(
   userId: string,
   normalized: string
): Promise<RemoteCategoryNameRow | null> {
   const { data, error } = await supabase
      .from("categories")
      .select("id,name,deleted_at,normalized_name")
      .eq("user_id", userId)
      .eq("normalized_name", normalized)
      .limit(1);

   if (error) {
      console.error("[SYNC] Failed to fetch category by normalized_name", error);
      throw error;
   }

   if (!data || data.length === 0) return null;
   return data[0] as RemoteCategoryNameRow;
}

async function findLocalCategoryByNormalized(
   userId: string,
   normalized: string,
   excludeId: string
): Promise<Category | null> {
   const rows = await query<Category>(
      `SELECT * FROM categories WHERE userId = ?;`,
      [userId]
   );

   const matches = rows.filter((row) => {
      if (row.id === excludeId) return false;
      const rowNormalized =
         row.normalizedName ?? normalizeCategoryName(row.name);
      return rowNormalized === normalized;
   });

   if (matches.length === 0) return null;

   matches.sort((a, b) => {
      const deletedRank = (a.deletedAt ? 1 : 0) - (b.deletedAt ? 1 : 0);
      if (deletedRank !== 0) return deletedRank;
      const dirtyRank = (a.dirty ?? 0) - (b.dirty ?? 0);
      if (dirtyRank !== 0) return dirtyRank;
      const createdRank = a.createdAt.localeCompare(b.createdAt);
      if (createdRank !== 0) return createdRank;
      return a.id.localeCompare(b.id);
   });

   return matches[0];
}

async function mergeLocalCategoryDuplicate(
   duplicateId: string,
   canonicalId: string
): Promise<void> {
   const now = new Date().toISOString();

   await run(
      `
      UPDATE expenses
      SET categoryId = ?, updatedAt = ?, dirty = 1, version = version + 1
      WHERE categoryId = ?;
      `,
      [canonicalId, now, duplicateId]
   );

   await run(
      `
      UPDATE categories
      SET deletedAt = ?, updatedAt = ?, dirty = 0, version = version + 1
      WHERE id = ?;
      `,
      [now, now, duplicateId]
   );
}

async function reviveRemoteCategory(
   canonicalId: string,
   source: Category,
   userId: string
): Promise<void> {
   const now = new Date().toISOString();
   const rows = await query<Category>(
      `SELECT * FROM categories WHERE id = ?;`,
      [canonicalId]
   );

   if (rows.length === 0) {
      await run(
         `
         INSERT INTO categories (
            id, name, normalizedName, createdAt, updatedAt, deletedAt,
            dirty, version, deviceId, userId
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
         `,
         [
            canonicalId,
            source.name,
            normalizeCategoryName(source.name),
            source.createdAt,
            now,
            null,
            1,
            source.version + 1,
            source.deviceId,
            userId,
         ]
      );
      return;
   }

   const local = rows[0];
   const nextVersion = Math.max(local.version, source.version) + 1;

   await run(
      `
      UPDATE categories
      SET name = ?, normalizedName = ?, updatedAt = ?, deletedAt = NULL, dirty = 1, version = ?
      WHERE id = ?;
      `,
      [source.name, normalizeCategoryName(source.name), now, nextVersion, canonicalId]
   );
}

async function insertLocalExpense(expense: Expense): Promise<void> {
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
         0,
         expense.version,
         expense.deviceId,
         expense.userId,
      ]
   );
}

async function updateLocalExpense(expense: Expense): Promise<void> {
   await run(
      `
      UPDATE expenses SET
         amountCents = ?,
         currency = ?,
         categoryId = ?,
         description = ?,
         expenseDate = ?,
         createdAt = ?,
         updatedAt = ?,
         deletedAt = ?,
         dirty = ?,
         version = ?,
         deviceId = ?,
         userId = ?
      WHERE id = ?;
      `,
      [
         expense.amountCents,
         expense.currency,
         expense.categoryId,
         expense.description,
         expense.expenseDate,
         expense.createdAt,
         expense.updatedAt,
         expense.deletedAt,
         0,
         expense.version,
         expense.deviceId,
         expense.userId,
         expense.id,
      ]
   );
}
