import { query, run } from "../db/database";
import { Category, CategorySchema } from "../types/category";
import { Expense, ExpenseSchema } from "../types/expense";
import { Budget, BudgetSchema } from "../types/budget";
import {
   RecurringExpense,
   RecurringExpenseSchema,
} from "../types/recurringExpense";
import { supabase } from "../auth/supabaseClient";
import { budgetIdentityKey } from "../domain/budgetMerge";
import { categoryIdentityKey, preferCategoryRecord } from "../domain/categoryMerge";
import { normalizeCategoryName } from "../utils/categoryIdentity";
import { repointCategoryReferences } from "../services/categoryReferenceService";

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
   budget?: number | string | null;
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
   budget?: number | string | null;
   deleted_at: string | null;
   normalized_name?: string | null;
};

type RemoteBudgetRow = {
   id: string;
   user_id: string;
   category_id: string;
   month_key: string;
   amount_cents: number;
   created_at: string;
   updated_at: string;
};

type RemoteRecurringExpenseRow = {
   id: string;
   user_id: string;
   title: string;
   amount_cents: number;
   currency: string;
   category_id: string;
   description: string | null;
   frequency: "weekly" | "monthly";
   next_due_date: string;
   last_generated_date: string | null;
   is_active: number;
   created_at: string;
   updated_at: string;
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
         `UPDATE expenses SET dirty = 0 WHERE id = ? AND userId = ?;`,
         [expense.id, userId]
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
      let remoteMatch: RemoteCategoryNameRow | undefined =
         remoteNameMap.get(normalized);

      if (!remoteMatch) {
         remoteMatch =
            (await fetchRemoteCategoryByNormalized(userId, normalized)) ?? undefined;
      }

      if (remoteMatch && remoteMatch.id !== category.id) {
         // Remote already owns this name; merge locally to avoid unique violation.
         if (remoteMatch.deleted_at) {
            await reviveRemoteCategory(remoteMatch.id, category, userId);
         }
         await mergeLocalCategoryDuplicate(category.id, remoteMatch.id, userId);
         continue;
      }

      const { error } = await supabase.from("categories").upsert({
         id: category.id,
         user_id: userId,
         name: category.name,
         budget: category.budget,
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
               await mergeLocalCategoryDuplicate(category.id, resolved.id, userId);
               continue;
            }
            if (resolved && resolved.id === category.id) {
               // Remote already has this category; mark clean to avoid retries.
               await run(
                  `UPDATE categories SET dirty = 0 WHERE id = ? AND userId = ?;`,
                  [category.id, userId]
               );
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
                      WHERE id = ? AND ownerKey = ?;`,
                     [new Date().toISOString(), localCanonical.id, userId]
                  );
               }
               console.log("[SYNC] Merging duplicate into local canonical", {
                  localId: category.id,
                  canonicalId: localCanonical.id,
                  normalized,
               });
               await mergeLocalCategoryDuplicate(
                  category.id,
                  localCanonical.id,
                  userId
               );
               continue;
            }
            // Last resort: stop retrying this row to avoid infinite loops.
            await run(
               `UPDATE categories SET dirty = 0 WHERE id = ? AND userId = ?;`,
               [category.id, userId]
            );
            console.warn(
               "[SYNC] Cleared dirty flag to avoid retry loop",
               category.id
            );
            continue;
         }
         console.error("[SYNC] Failed to push category", category.id, error);
         throw error;
      }

      await run(`UPDATE categories SET dirty = 0 WHERE id = ? AND userId = ?;`, [
         category.id,
         userId,
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
            "id,user_id,name,budget,normalized_name,created_at,updated_at,deleted_at,version,device_id"
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

   await applyRemoteCategoryChanges(userId, collapseRemoteCategoryRows(remoteRows));
}

export async function pullRemoteBudgets(userId: string): Promise<void> {
   const pageSize = 500;
   let from = 0;
   let to = pageSize - 1;
   const remoteRows: RemoteBudgetRow[] = [];

   while (true) {
      const { data, error } = await supabase
         .from("budgets")
         .select(
            "id,user_id,category_id,month_key,amount_cents,created_at,updated_at"
         )
         .eq("user_id", userId)
         .range(from, to);

      if (error) {
         console.error("[SYNC] Failed to pull budgets", error);
         throw error;
      }

      if (!data || data.length === 0) break;

      remoteRows.push(...(data as RemoteBudgetRow[]));
      if (data.length < pageSize) break;

      from += pageSize;
      to += pageSize;
   }

   await applyRemoteBudgetChanges(userId, remoteRows);
}

export async function pushLocalBudgets(userId: string): Promise<void> {
   const localBudgets = await query<Budget>(
      `SELECT * FROM budgets WHERE userId = ?;`,
      [userId]
   );

   if (localBudgets.length === 0) return;

   const remoteRows = await fetchRemoteBudgets(userId);

   for (const budget of localBudgets) {
      const remote = findRemoteBudgetMatch(remoteRows, budget);

      if (remote) {
         await updateRemoteBudgetIfNewer(userId, budget, remote);
         continue;
      }

      const { error } = await supabase.from("budgets").insert({
         id: budget.id,
         user_id: userId,
         category_id: budget.categoryId,
         month_key: budget.monthKey,
         amount_cents: budget.amountCents,
         created_at: budget.createdAt,
         updated_at: budget.updatedAt,
      });

      if (error) {
         const errorCode = (error as { code?: string }).code;
         if (errorCode === "23505") {
            const existing = await fetchRemoteBudgetByIdOrKey(userId, budget);
            if (existing) {
               await updateRemoteBudgetIfNewer(userId, budget, existing);
               continue;
            }
         }
         console.error("[SYNC] Failed to insert budget", budget.id, error);
         throw error;
      }
   }
}

export async function pullRemoteRecurringExpenses(userId: string): Promise<void> {
   const pageSize = 500;
   let from = 0;
   let to = pageSize - 1;
   const remoteRows: RemoteRecurringExpenseRow[] = [];

   while (true) {
      const { data, error } = await supabase
         .from("recurring_expenses")
         .select(
            "id,user_id,title,amount_cents,currency,category_id,description,frequency,next_due_date,last_generated_date,is_active,created_at,updated_at"
         )
         .eq("user_id", userId)
         .range(from, to);

      if (error) {
         console.error("[SYNC] Failed to pull recurring expenses", error);
         throw error;
      }

      if (!data || data.length === 0) break;

      remoteRows.push(...(data as RemoteRecurringExpenseRow[]));
      if (data.length < pageSize) break;

      from += pageSize;
      to += pageSize;
   }

   await applyRemoteRecurringExpenseChanges(userId, remoteRows);
}

export async function pushLocalRecurringExpenses(userId: string): Promise<void> {
   const localItems = await query<RecurringExpense>(
      `SELECT * FROM recurring_expenses WHERE userId = ?;`,
      [userId]
   );

   if (localItems.length === 0) return;

   const remoteMap = await fetchRemoteRecurringExpenseMap(userId);

   for (const item of localItems) {
      const remote = remoteMap.get(item.id);
      const payload = mapLocalRecurringExpenseToRemote(item, userId);

      if (remote) {
         const localUpdated = new Date(item.updatedAt).getTime();
         const remoteUpdated = new Date(remote.updated_at).getTime();
         if (localUpdated <= remoteUpdated) {
            continue;
         }

         const { error } = await supabase
            .from("recurring_expenses")
            .update(payload)
            .eq("id", item.id)
            .eq("user_id", userId);

         if (error) {
            console.error(
               "[SYNC] Failed to update recurring expense",
               item.id,
               error
            );
            throw error;
         }
         continue;
      }

      const { error } = await supabase
         .from("recurring_expenses")
         .insert({ id: item.id, ...payload });

      if (error) {
         console.error(
            "[SYNC] Failed to insert recurring expense",
            item.id,
            error
         );
         throw error;
      }
   }
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
         `SELECT * FROM expenses WHERE id = ? AND ownerKey = ?;`,
         [remote.id, userId]
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
         `SELECT * FROM categories WHERE id = ? AND ownerKey = ?;`,
         [remote.id, userId]
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

function collapseRemoteCategoryRows(rows: RemoteCategoryRow[]): RemoteCategoryRow[] {
   const groups = new Map<string, RemoteCategoryRow[]>();

   rows.forEach((row) => {
      const key = categoryIdentityKey({
         name: row.name,
         normalizedName: row.normalized_name,
      });
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
   });

   const collapsed: RemoteCategoryRow[] = [];
   groups.forEach((group) => {
      collapsed.push(group.reduce(preferRemoteCategoryRow));
   });

   return collapsed;
}

function preferRemoteCategoryRow(
   a: RemoteCategoryRow,
   b: RemoteCategoryRow
): RemoteCategoryRow {
   const preferred = preferCategoryRecord(
      {
         id: a.id,
         name: a.name,
         normalizedName: a.normalized_name,
         deletedAt: a.deleted_at,
         createdAt: a.created_at,
         updatedAt: a.updated_at,
      },
      {
         id: b.id,
         name: b.name,
         normalizedName: b.normalized_name,
         deletedAt: b.deleted_at,
         createdAt: b.created_at,
         updatedAt: b.updated_at,
      }
   );

   return preferred.id === a.id ? a : b;
}

async function applyRemoteBudgetChanges(
   userId: string,
   remoteRows: RemoteBudgetRow[]
): Promise<void> {
   for (const row of remoteRows) {
      if (row.user_id !== userId) continue;

      const remote = mapRemoteBudget(row);
      const local = await findLocalBudgetByIdOrKey(userId, remote);

      if (!local) {
         await insertLocalBudget(remote);
         continue;
      }

      const localUpdated = new Date(local.updatedAt).getTime();
      const remoteUpdated = new Date(remote.updatedAt).getTime();

      if (remoteUpdated > localUpdated) {
         await updateLocalBudget(local.id, remote);
      }
   }
}

async function applyRemoteRecurringExpenseChanges(
   userId: string,
   remoteRows: RemoteRecurringExpenseRow[]
): Promise<void> {
   for (const row of remoteRows) {
      if (row.user_id !== userId) continue;

      const remote = mapRemoteRecurringExpense(row);
      const localRows = await query<RecurringExpense>(
         `SELECT * FROM recurring_expenses WHERE id = ? AND ownerKey = ?;`,
         [remote.id, userId]
      );

      if (localRows.length === 0) {
         await insertLocalRecurringExpense(remote);
         continue;
      }

      const local = RecurringExpenseSchema.parse(localRows[0]);
      const localUpdated = new Date(local.updatedAt).getTime();
      const remoteUpdated = new Date(remote.updatedAt).getTime();

      if (remoteUpdated > localUpdated) {
         await updateLocalRecurringExpense(remote);
      }
   }
}

function mapRemoteExpense(row: RemoteExpenseRow): Expense {
   return {
      id: row.id,
      userId: row.user_id,
      ownerKey: row.user_id,
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
      ownerKey: row.user_id,
      name: row.name,
      budget: Number(row.budget ?? 0),
      normalizedName: normalized,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      dirty: 0,
      version: row.version,
      deviceId: row.device_id,
   };
}

function mapRemoteBudget(row: RemoteBudgetRow): Budget {
   return {
      id: row.id,
      userId: row.user_id,
      ownerKey: row.user_id,
      categoryId: row.category_id,
      monthKey: row.month_key,
      amountCents: row.amount_cents,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
   };
}

function mapRemoteRecurringExpense(
   row: RemoteRecurringExpenseRow
): RecurringExpense {
   return {
      id: row.id,
      userId: row.user_id,
      ownerKey: row.user_id,
      title: row.title,
      amountCents: row.amount_cents,
      currency: row.currency,
      categoryId: row.category_id,
      description: row.description,
      frequency: row.frequency,
      nextDueDate: row.next_due_date,
      lastGeneratedDate: row.last_generated_date,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
   };
}

function mapLocalRecurringExpenseToRemote(
   item: RecurringExpense,
   userId: string
) {
   return {
      user_id: userId,
      title: item.title,
      amount_cents: item.amountCents,
      currency: item.currency,
      category_id: item.categoryId,
      description: item.description,
      frequency: item.frequency,
      next_due_date: item.nextDueDate,
      last_generated_date: item.lastGeneratedDate,
      is_active: item.isActive,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
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
         id, name, budget, normalizedName, createdAt, updatedAt, deletedAt,
         dirty, version, deviceId, ownerKey, userId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
         category.id,
         category.name,
         category.budget,
         normalizedName,
         category.createdAt,
         category.updatedAt,
         category.deletedAt,
         0,
         category.version,
         category.deviceId,
         category.ownerKey,
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
         budget = ?,
         normalizedName = ?,
         createdAt = ?,
         updatedAt = ?,
         deletedAt = ?,
         dirty = ?,
         version = ?,
         deviceId = ?,
         ownerKey = ?,
         userId = ?
      WHERE id = ? AND ownerKey = ?;
      `,
      [
         category.name,
         category.budget,
         normalizedName,
         category.createdAt,
         category.updatedAt,
         category.deletedAt,
         0,
         category.version,
         category.deviceId,
         category.ownerKey,
         category.userId,
         category.id,
         category.ownerKey,
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
         .select("id,name,budget,deleted_at,normalized_name")
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
      .select("id,name,budget,deleted_at,normalized_name")
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
      `SELECT * FROM categories WHERE ownerKey = ?;`,
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

function budgetKey(categoryId: string, monthKey: string) {
   return budgetIdentityKey({ categoryId, monthKey });
}

async function fetchRemoteBudgets(
   userId: string
): Promise<RemoteBudgetRow[]> {
   const { data, error } = await supabase
      .from("budgets")
      .select("id,user_id,category_id,month_key,amount_cents,created_at,updated_at")
      .eq("user_id", userId);

   if (error) {
      console.error("[SYNC] Failed to fetch budget keys", error);
      throw error;
   }

   return (data as RemoteBudgetRow[] | null) ?? [];
}

function findRemoteBudgetMatch(
   remoteRows: RemoteBudgetRow[],
   budget: Budget
): RemoteBudgetRow | undefined {
   const byId = remoteRows.find((row) => row.id === budget.id);
   if (byId) return byId;

   const key = budgetKey(budget.categoryId, budget.monthKey);
   return remoteRows.find((row) => budgetKey(row.category_id, row.month_key) === key);
}

async function fetchRemoteBudgetByIdOrKey(
   userId: string,
   budget: Budget
): Promise<RemoteBudgetRow | null> {
   const { data: byId, error: byIdError } = await supabase
      .from("budgets")
      .select("id,user_id,category_id,month_key,amount_cents,created_at,updated_at")
      .eq("user_id", userId)
      .eq("id", budget.id)
      .limit(1);

   if (byIdError) {
      console.error("[SYNC] Failed to fetch budget after conflict", byIdError);
      throw byIdError;
   }

   const idMatch = (byId as RemoteBudgetRow[] | null)?.[0];
   if (idMatch) return idMatch;

   const { data: byKey, error: byKeyError } = await supabase
      .from("budgets")
      .select("id,user_id,category_id,month_key,amount_cents,created_at,updated_at")
      .eq("user_id", userId)
      .eq("category_id", budget.categoryId)
      .eq("month_key", budget.monthKey)
      .limit(1);

   if (byKeyError) {
      console.error("[SYNC] Failed to fetch budget by key after conflict", byKeyError);
      throw byKeyError;
   }

   return (byKey as RemoteBudgetRow[] | null)?.[0] ?? null;
}

async function updateRemoteBudgetIfNewer(
   userId: string,
   budget: Budget,
   remote: RemoteBudgetRow
): Promise<void> {
   const localUpdated = new Date(budget.updatedAt).getTime();
   const remoteUpdated = new Date(remote.updated_at).getTime();
   if (localUpdated <= remoteUpdated) return;

   const { error } = await supabase
      .from("budgets")
      .update({
         category_id: budget.categoryId,
         month_key: budget.monthKey,
         amount_cents: budget.amountCents,
         updated_at: budget.updatedAt,
      })
      .eq("id", remote.id)
      .eq("user_id", userId);

   if (error) {
      console.error("[SYNC] Failed to update budget", budget.id, error);
      throw error;
   }
}

async function fetchRemoteRecurringExpenseMap(
   userId: string
): Promise<Map<string, RemoteRecurringExpenseRow>> {
   const { data, error } = await supabase
      .from("recurring_expenses")
      .select(
         "id,user_id,title,amount_cents,currency,category_id,description,frequency,next_due_date,last_generated_date,is_active,created_at,updated_at"
      )
      .eq("user_id", userId);

   if (error) {
      console.error("[SYNC] Failed to fetch recurring expenses", error);
      throw error;
   }

   const map = new Map<string, RemoteRecurringExpenseRow>();
   (data as RemoteRecurringExpenseRow[] | null)?.forEach((row) => {
      map.set(row.id, row);
   });
   return map;
}

async function findLocalBudgetByIdOrKey(
   userId: string,
   budget: Budget
): Promise<Budget | null> {
   const rows = await query<Budget>(
      `
      SELECT *
      FROM budgets
      WHERE ownerKey = ?
        AND (
          id = ?
          OR (categoryId = ? AND monthKey = ?)
        )
      ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
      LIMIT 1;
      `,
      [userId, budget.id, budget.categoryId, budget.monthKey, budget.id]
   );

   return rows[0] ? BudgetSchema.parse(rows[0]) : null;
}

async function insertLocalBudget(budget: Budget): Promise<void> {
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
}

async function updateLocalBudget(
   localId: string,
   budget: Budget
): Promise<void> {
   await run(
      `
      UPDATE budgets
      SET categoryId = ?, monthKey = ?, amountCents = ?, createdAt = ?, updatedAt = ?, ownerKey = ?, userId = ?
      WHERE id = ?
        AND ownerKey = ?;
      `,
      [
         budget.categoryId,
         budget.monthKey,
         budget.amountCents,
         budget.createdAt,
         budget.updatedAt,
         budget.ownerKey,
         budget.userId,
         localId,
         budget.ownerKey,
      ]
   );
}

async function insertLocalRecurringExpense(
   item: RecurringExpense
): Promise<void> {
   await run(
      `
      INSERT INTO recurring_expenses (
         id, title, amountCents, currency, categoryId, description,
         frequency, nextDueDate, lastGeneratedDate, isActive,
         createdAt, updatedAt, ownerKey, userId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
         item.id,
         item.title,
         item.amountCents,
         item.currency,
         item.categoryId,
         item.description,
         item.frequency,
         item.nextDueDate,
         item.lastGeneratedDate,
         item.isActive,
         item.createdAt,
         item.updatedAt,
         item.ownerKey,
         item.userId,
      ]
   );
}

async function updateLocalRecurringExpense(
   item: RecurringExpense
): Promise<void> {
   await run(
      `
      UPDATE recurring_expenses
      SET title = ?, amountCents = ?, currency = ?, categoryId = ?, description = ?,
          frequency = ?, nextDueDate = ?, lastGeneratedDate = ?, isActive = ?,
          createdAt = ?, updatedAt = ?, ownerKey = ?, userId = ?
      WHERE id = ?
        AND ownerKey = ?;
      `,
      [
         item.title,
         item.amountCents,
         item.currency,
         item.categoryId,
         item.description,
         item.frequency,
         item.nextDueDate,
         item.lastGeneratedDate,
         item.isActive,
         item.createdAt,
         item.updatedAt,
         item.ownerKey,
         item.userId,
         item.id,
         item.ownerKey,
      ]
   );
}

async function mergeLocalCategoryDuplicate(
   duplicateId: string,
   canonicalId: string,
   userId: string
): Promise<void> {
   const now = new Date().toISOString();

   await repointCategoryReferences(userId, [duplicateId], canonicalId, now);

   await run(
      `
      UPDATE categories
      SET deletedAt = ?, updatedAt = ?, dirty = 0, version = version + 1
      WHERE id = ?
        AND ownerKey = ?;
      `,
      [now, now, duplicateId, userId]
   );
}

async function reviveRemoteCategory(
   canonicalId: string,
   source: Category,
   userId: string
): Promise<void> {
   const now = new Date().toISOString();
   const rows = await query<Category>(
      `SELECT * FROM categories WHERE id = ? AND ownerKey = ?;`,
      [canonicalId, userId]
   );

   if (rows.length === 0) {
      await run(
         `
         INSERT INTO categories (
            id, name, budget, normalizedName, createdAt, updatedAt, deletedAt,
            dirty, version, deviceId, ownerKey, userId
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
         `,
         [
            canonicalId,
            source.name,
            source.budget,
            normalizeCategoryName(source.name),
            source.createdAt,
            now,
            null,
            1,
            source.version + 1,
            source.deviceId,
            userId,
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
      SET name = ?, budget = ?, normalizedName = ?, updatedAt = ?, deletedAt = NULL, dirty = 1, version = ?
      WHERE id = ? AND ownerKey = ?;
      `,
      [
         source.name,
         source.budget,
         normalizeCategoryName(source.name),
         now,
         nextVersion,
         canonicalId,
         userId,
      ]
   );
}

async function insertLocalExpense(expense: Expense): Promise<void> {
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
         0,
         expense.version,
         expense.deviceId,
         expense.ownerKey,
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
         ownerKey = ?,
         userId = ?
      WHERE id = ? AND ownerKey = ?;
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
         expense.ownerKey,
         expense.userId,
         expense.id,
         expense.ownerKey,
      ]
   );
}
