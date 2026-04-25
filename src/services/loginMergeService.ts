import { query, run } from "../db/database";
import { GUEST_OWNER_KEY } from "../domain/dataScope";
import {
  DEFAULT_CATEGORIES,
  deterministicCategoryId,
  deterministicGuestCategoryId,
  normalizeCategoryName,
} from "../utils/categoryIdentity";
import { repointCategoryReferences } from "./categoryReferenceService";
import { preferBudgetRecord } from "../domain/budgetMerge";

type CategoryRow = {
   id: string;
   name: string;
   normalizedName: string | null;
   deletedAt: string | null;
   version: number;
};

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

/**
 * attachAnonymousDataToUser
 *
 * After a user logs in, this function attaches
 * all locally-created anonymous records to the user.
 *
 * This does NOT sync data yet.
 * It only prepares local data for sync.
 */
export async function attachAnonymousDataToUser(userId: string): Promise<void> {
   const now = new Date().toISOString();

   await promoteGuestDefaultCategories(userId, now);

   // Attach expenses
   await run(
      `
      UPDATE expenses
      SET userId = ?, ownerKey = ?, dirty = 1, updatedAt = ?
      WHERE ownerKey = ?;
      `,
      [userId, userId, now, GUEST_OWNER_KEY]
   );

   await normalizeLegacyDefaultCategoryIds(userId, now);

   // Attach categories (future-proof)
   await run(
      `
      UPDATE categories
      SET userId = ?, ownerKey = ?, dirty = 1, updatedAt = ?
      WHERE ownerKey = ?;
      `,
      [userId, userId, now, GUEST_OWNER_KEY]
   );

   await promoteGuestBudgetsToUser(userId, now);

   await run(
      `
      UPDATE recurring_expenses
      SET userId = ?, ownerKey = ?, updatedAt = ?
      WHERE ownerKey = ?;
      `,
      [userId, userId, now, GUEST_OWNER_KEY]
   );
}

async function promoteGuestBudgetsToUser(userId: string, now: string) {
   const guestBudgets = await query<BudgetRow>(
      `
      SELECT *
      FROM budgets
      WHERE ownerKey = ?
      ORDER BY updatedAt DESC, createdAt DESC, id DESC;
      `,
      [GUEST_OWNER_KEY]
   );

   for (const guestBudget of guestBudgets) {
      const existingRows = await query<BudgetRow>(
         `
         SELECT *
         FROM budgets
         WHERE ownerKey = ?
           AND categoryId = ?
           AND monthKey = ?
         LIMIT 1;
         `,
         [userId, guestBudget.categoryId, guestBudget.monthKey]
      );

      if (existingRows.length === 0) {
         await run(
            `
            UPDATE budgets
            SET userId = ?, ownerKey = ?, updatedAt = ?
            WHERE ownerKey = ?
              AND id = ?;
            `,
            [userId, userId, now, GUEST_OWNER_KEY, guestBudget.id]
         );
         continue;
      }

      const existing = existingRows[0];
      const preferred = preferBudgetRecord(existing, guestBudget);

      if (preferred.id === guestBudget.id) {
         await run(
            `
            UPDATE budgets
            SET amountCents = ?, updatedAt = ?
            WHERE ownerKey = ?
              AND id = ?;
            `,
            [guestBudget.amountCents, now, userId, existing.id]
         );
      }

      await run(
         `
         DELETE FROM budgets
         WHERE ownerKey = ?
           AND id = ?;
         `,
         [GUEST_OWNER_KEY, guestBudget.id]
      );
   }
}

async function promoteGuestDefaultCategories(userId: string, now: string) {
   for (const name of DEFAULT_CATEGORIES) {
      const guestId = deterministicGuestCategoryId(name);
      const canonicalId = deterministicCategoryId(userId, name);

      const guestRows = await query<CategoryRow>(
         `
         SELECT id, name, normalizedName, deletedAt, version
         FROM categories
         WHERE ownerKey = ?
           AND id = ?;
         `,
         [GUEST_OWNER_KEY, guestId]
      );

      if (guestRows.length === 0) {
         continue;
      }

      const guestRow = guestRows[0];
      await repointCategoryReferences(GUEST_OWNER_KEY, [guestId], canonicalId, now);

      const canonicalRows = await query<CategoryRow>(
         `
         SELECT id, name, normalizedName, deletedAt, version
         FROM categories
         WHERE ownerKey = ?
           AND id = ?;
         `,
         [userId, canonicalId]
      );

      if (canonicalRows.length > 0) {
         const canonicalRow = canonicalRows[0];
         if (canonicalRow.deletedAt && !guestRow.deletedAt) {
            await run(
               `
               UPDATE categories
               SET deletedAt = NULL, updatedAt = ?, dirty = 1, version = ?
               WHERE ownerKey = ?
                 AND id = ?;
               `,
               [now, Math.max(canonicalRow.version, guestRow.version) + 1, userId, canonicalId]
            );
         }

         await run(
            `
            DELETE FROM categories
            WHERE ownerKey = ?
              AND id = ?;
            `,
            [GUEST_OWNER_KEY, guestId]
         );
         continue;
      }

      await run(
         `
         UPDATE categories
         SET id = ?, ownerKey = ?, userId = ?, updatedAt = ?, dirty = 1, version = version + 1
         WHERE ownerKey = ?
           AND id = ?;
         `,
         [canonicalId, userId, userId, now, GUEST_OWNER_KEY, guestId]
      );
   }
}

async function normalizeLegacyDefaultCategoryIds(userId: string, now: string) {
   for (const name of DEFAULT_CATEGORIES) {
      const legacyId = deterministicGuestCategoryId(name);
      const canonicalId = deterministicCategoryId(userId, name);

      const legacyRows = await query<CategoryRow>(
         `
         SELECT id, name, normalizedName, deletedAt, version
         FROM categories
         WHERE ownerKey = ?
           AND id = ?;
         `,
         [userId, legacyId]
      );

      if (legacyRows.length === 0) {
         continue;
      }

      const legacyRow = legacyRows[0];
      await repointCategoryReferences(userId, [legacyId], canonicalId, now);

      const canonicalRows = await query<CategoryRow>(
         `
         SELECT id, name, normalizedName, deletedAt, version
         FROM categories
         WHERE ownerKey = ?
           AND id = ?;
         `,
         [userId, canonicalId]
      );

      if (canonicalRows.length > 0) {
         const canonicalRow = canonicalRows[0];
         if (canonicalRow.deletedAt && !legacyRow.deletedAt) {
            await run(
               `
               UPDATE categories
               SET deletedAt = NULL, updatedAt = ?, dirty = 1, version = ?
               WHERE ownerKey = ?
                 AND id = ?;
               `,
               [now, Math.max(canonicalRow.version, legacyRow.version) + 1, userId, canonicalId]
            );
         }

         await run(
            `
            DELETE FROM categories
            WHERE ownerKey = ?
              AND id = ?;
            `,
            [userId, legacyId]
         );
         continue;
      }

      await run(
         `
         UPDATE categories
         SET id = ?, updatedAt = ?, dirty = 1, version = version + 1
         WHERE ownerKey = ?
           AND id = ?;
         `,
         [canonicalId, now, userId, legacyId]
      );
   }
}
