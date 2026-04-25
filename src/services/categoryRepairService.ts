import { query, queryFirst, run } from "../db/database";
import { Category, CategorySchema } from "../types/category";
import { DataScope, GUEST_OWNER_KEY } from "../domain/dataScope";
import {
  DEFAULT_CATEGORIES,
  deterministicCategoryId,
  deterministicGuestCategoryId,
  normalizeCategoryName,
} from "../utils/categoryIdentity";
import { inferDefaultCategoryName } from "../domain/categoryInference";
import { repointCategoryReferences } from "./categoryReferenceService";

/**
 * repairLocalCategoryDuplicates
 *
 * Deduplicates local categories by normalized name.
 * - Defaults use deterministic UUIDs.
 * - Custom categories keep the earliest created record.
 * - Expenses are repointed to canonical IDs.
 */
export async function repairLocalCategoryDuplicates(
  scope: DataScope,
  deviceId: string
): Promise<void> {
  const ownerKey = scope.ownerKey;
  const categories = await query<Category>(
    `SELECT * FROM categories WHERE ownerKey = ?;`,
    [ownerKey]
  );

  if (categories.length === 0) return;

  const defaultsByNorm = new Map(
    DEFAULT_CATEGORIES.map((name) => [normalizeCategoryName(name), name])
  );

  const groups = new Map<string, Category[]>();
  categories.forEach((category) => {
    const normalized = normalizeCategoryName(category.name);
    const group = groups.get(normalized) ?? [];
    group.push(category);
    groups.set(normalized, group);
  });

  const now = new Date().toISOString();

  for (const [normalized, group] of groups.entries()) {
    const defaultName = defaultsByNorm.get(normalized);
    const canonicalId = defaultName
      ? scope.userId
        ? deterministicCategoryId(scope.userId, defaultName)
        : deterministicGuestCategoryId(defaultName)
      : null;
    const sortedGroup = group.slice().sort((a, b) => {
      const activeRank = Number(!!a.deletedAt) - Number(!!b.deletedAt);
      if (activeRank !== 0) return activeRank;
      return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    });
    let canonicalRow = canonicalId
      ? group.find((item) => item.id === canonicalId) ?? null
      : null;
    canonicalRow ??= sortedGroup[0] ?? null;

    if (!canonicalRow) {
      continue;
    }

    if (canonicalId && canonicalRow.id !== canonicalId) {
      const globalConflict = await queryFirst<Category>(
        `
        SELECT *
        FROM categories
        WHERE id = ?;
        `,
        [canonicalId]
      );

      if (globalConflict && globalConflict.ownerKey === ownerKey) {
        canonicalRow = CategorySchema.parse(globalConflict);
      } else if (!globalConflict) {
        const canonicalDefaultName = defaultName!;
        await run(
          `
          UPDATE categories
          SET id = ?, name = ?, normalizedName = ?, updatedAt = ?, dirty = 1, version = version + 1
          WHERE ownerKey = ?
            AND id = ?;
          `,
          [
            canonicalId,
            canonicalDefaultName,
            normalized,
            now,
            ownerKey,
            canonicalRow.id,
          ]
        );
        canonicalRow = {
          ...canonicalRow,
          id: canonicalId,
          name: canonicalDefaultName,
          normalizedName: normalized,
          updatedAt: now,
          dirty: 1,
          version: canonicalRow.version + 1,
        };
      }
    }

    const shouldBeActive = !!defaultName || group.some((item) => !item.deletedAt);
    if (canonicalRow.deletedAt && shouldBeActive) {
      await run(
        `
        UPDATE categories
        SET deletedAt = NULL, updatedAt = ?, dirty = 1, version = version + 1
        WHERE ownerKey = ?
          AND id = ?;
        `,
        [now, ownerKey, canonicalRow.id]
      );
      canonicalRow = {
        ...canonicalRow,
        deletedAt: null,
        updatedAt: now,
        dirty: 1,
        version: canonicalRow.version + 1,
      };
    }

    if (
      defaultName &&
      (canonicalRow.name !== defaultName ||
        canonicalRow.normalizedName !== normalized)
    ) {
      await run(
        `
        UPDATE categories
        SET name = ?, normalizedName = ?, updatedAt = ?, dirty = 1, version = version + 1
        WHERE ownerKey = ?
          AND id = ?;
        `,
        [defaultName, normalized, now, ownerKey, canonicalRow.id]
      );
      canonicalRow = {
        ...canonicalRow,
        name: defaultName,
        normalizedName: normalized,
        updatedAt: now,
        dirty: 1,
        version: canonicalRow.version + 1,
      };
    }

    const duplicates = group.filter((item) => item.id !== canonicalRow.id);
    if (duplicates.length === 0) continue;

    const duplicateIds = duplicates.map((item) => item.id);
    await repointCategoryReferences(ownerKey, duplicateIds, canonicalRow.id, now);
    await deleteCategories(ownerKey, duplicateIds);
  }
}

/**
 * repairInvalidScopedDefaultCategoryIds
 *
 * Legacy builds could leave deterministic guest default IDs under a signed-in scope.
 * Those rows are invalid because guest IDs are globally reused when the app returns
 * to local mode, so they must be renamed or removed before guest startup reseeds.
 */
export async function repairInvalidScopedDefaultCategoryIds(): Promise<void> {
  const now = new Date().toISOString();

  for (const name of DEFAULT_CATEGORIES) {
    const invalidId = deterministicGuestCategoryId(name);
    const invalidRows = await query<Category>(
      `
      SELECT *
      FROM categories
      WHERE id = ?
        AND ownerKey != ?;
      `,
      [invalidId, GUEST_OWNER_KEY]
    );

    for (const invalidRow of invalidRows) {
      const ownerKey = invalidRow.ownerKey;
      const resolvedUserId =
        invalidRow.userId ?? (ownerKey !== GUEST_OWNER_KEY ? ownerKey : null);

      if (!resolvedUserId) {
        continue;
      }

      const canonicalId = deterministicCategoryId(resolvedUserId, name);
      await repointCategoryReferences(ownerKey, [invalidId], canonicalId, now);

      const canonicalRows = await query<Category>(
        `
        SELECT *
        FROM categories
        WHERE ownerKey = ?
          AND id = ?;
        `,
        [resolvedUserId, canonicalId]
      );

      if (canonicalRows.length > 0) {
        const canonicalRow = canonicalRows[0];
        if (canonicalRow.deletedAt && !invalidRow.deletedAt) {
          await run(
            `
            UPDATE categories
            SET deletedAt = NULL, updatedAt = ?, dirty = 1, version = version + 1
            WHERE ownerKey = ?
              AND id = ?;
            `,
            [now, resolvedUserId, canonicalId]
          );
        }

        await deleteCategories(ownerKey, [invalidId]);
        continue;
      }

      await run(
        `
        UPDATE categories
        SET id = ?, name = ?, normalizedName = ?, ownerKey = ?, userId = ?, updatedAt = ?, dirty = 1, version = version + 1
        WHERE ownerKey = ?
          AND id = ?;
        `,
        [
          canonicalId,
          name,
          normalizeCategoryName(name),
          resolvedUserId,
          resolvedUserId,
          now,
          ownerKey,
          invalidId,
        ]
      );
    }
  }
}

/**
 * repairMissingCategoryRefs
 *
 * Ensures every record references a local category row.
 * Obvious orphaned expenses are inferred from their description before the
 * remaining records fall back to the deterministic fallback category.
 */
export async function repairMissingCategoryRefs(
  scope: DataScope,
  deviceId: string
): Promise<void> {
  const ownerKey = scope.ownerKey;
  const referencedRows = await query<{ categoryId: string }>(
    `
    SELECT DISTINCT categoryId
    FROM (
      SELECT categoryId FROM expenses WHERE ownerKey = ?
      UNION
      SELECT categoryId FROM budgets WHERE ownerKey = ?
      UNION
      SELECT categoryId FROM recurring_expenses WHERE ownerKey = ?
    );
    `,
    [ownerKey, ownerKey, ownerKey]
  );

  if (referencedRows.length === 0) return;

  const referencedIds = referencedRows.map((row) => row.categoryId);
  const placeholders = referencedIds.map(() => "?").join(",");

  const categoryRows = await query<{
    id: string;
    deletedAt: string | null;
  }>(
    `
    SELECT id, deletedAt
    FROM categories
    WHERE ownerKey = ?
      AND id IN (${placeholders});
    `,
    [ownerKey, ...referencedIds]
  );

  const existingIds = new Set(categoryRows.map((row) => row.id));
  const missingIds = referencedIds.filter((id) => !existingIds.has(id));

  if (missingIds.length === 0) return;

  await repairMissingExpenseCategoryRefs(scope, deviceId, missingIds);
  await repairMissingRecurringCategoryRefs(scope, deviceId, missingIds);

  const fallbackName = DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1];
  const fallbackId = scope.userId
    ? deterministicCategoryId(scope.userId, fallbackName)
    : deterministicGuestCategoryId(fallbackName);
  const fallbackRow = await query<{ id: string; deletedAt: string | null }>(
    `
    SELECT id, deletedAt
    FROM categories
    WHERE id = ?
      AND ownerKey = ?;
    `,
    [fallbackId, ownerKey]
  );

  const now = new Date().toISOString();

  if (fallbackRow.length === 0) {
    await run(
      `
      INSERT INTO categories (
        id, name, budget, normalizedName, createdAt, updatedAt, deletedAt,
        dirty, version, deviceId, ownerKey, userId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        fallbackId,
        fallbackName,
        0,
        normalizeCategoryName(fallbackName),
        now,
        now,
        null,
        1,
        1,
        deviceId,
        ownerKey,
        scope.userId,
      ]
    );
  } else if (fallbackRow[0].deletedAt) {
    await run(
      `
      UPDATE categories
      SET deletedAt = NULL, updatedAt = ?, dirty = 1, version = version + 1
      WHERE id = ? AND ownerKey = ?;
      `,
      [now, fallbackId, ownerKey]
    );
  }

  await repointCategoryReferences(ownerKey, missingIds, fallbackId, now);
}

async function repairMissingExpenseCategoryRefs(
  scope: DataScope,
  deviceId: string,
  missingIds: string[]
): Promise<void> {
  if (missingIds.length === 0) return;

  const ownerKey = scope.ownerKey;
  const placeholders = missingIds.map(() => "?").join(",");
  const rows = await query<{
    id: string;
    categoryId: string;
    description: string | null;
  }>(
    `
    SELECT id, categoryId, description
    FROM expenses
    WHERE ownerKey = ?
      AND categoryId IN (${placeholders});
    `,
    [ownerKey, ...missingIds]
  );

  const now = new Date().toISOString();

  for (const row of rows) {
    const inferredName = inferDefaultCategoryName(row.description);
    if (!inferredName) continue;

    const categoryId = await ensureRepairCategory(scope, deviceId, inferredName, now);
    await run(
      `
      UPDATE expenses
      SET categoryId = ?, updatedAt = ?, dirty = 1, version = version + 1
      WHERE ownerKey = ?
        AND id = ?;
      `,
      [categoryId, now, ownerKey, row.id]
    );
  }
}

async function repairMissingRecurringCategoryRefs(
  scope: DataScope,
  deviceId: string,
  missingIds: string[]
): Promise<void> {
  if (missingIds.length === 0) return;

  const ownerKey = scope.ownerKey;
  const placeholders = missingIds.map(() => "?").join(",");
  const rows = await query<{
    id: string;
    categoryId: string;
    description: string | null;
    title: string;
  }>(
    `
    SELECT id, categoryId, description, title
    FROM recurring_expenses
    WHERE ownerKey = ?
      AND categoryId IN (${placeholders});
    `,
    [ownerKey, ...missingIds]
  );

  const now = new Date().toISOString();

  for (const row of rows) {
    const inferredName = inferDefaultCategoryName(
      `${row.title} ${row.description ?? ""}`
    );
    if (!inferredName) continue;

    const categoryId = await ensureRepairCategory(scope, deviceId, inferredName, now);
    await run(
      `
      UPDATE recurring_expenses
      SET categoryId = ?, updatedAt = ?
      WHERE ownerKey = ?
        AND id = ?;
      `,
      [categoryId, now, ownerKey, row.id]
    );
  }
}

async function ensureRepairCategory(
  scope: DataScope,
  deviceId: string,
  name: string,
  now: string
): Promise<string> {
  const ownerKey = scope.ownerKey;
  const normalizedName = normalizeCategoryName(name);
  const existing = await query<Category>(
    `
    SELECT *
    FROM categories
    WHERE ownerKey = ?
      AND (normalizedName = ? OR LOWER(TRIM(name)) = ?)
    ORDER BY deletedAt IS NOT NULL, createdAt ASC, id ASC
    LIMIT 1;
    `,
    [ownerKey, normalizedName, normalizedName]
  );

  if (existing.length > 0) {
    const row = existing[0];
    if (row.deletedAt) {
      await run(
        `
        UPDATE categories
        SET deletedAt = NULL, updatedAt = ?, dirty = 1, version = version + 1
        WHERE ownerKey = ?
          AND id = ?;
        `,
        [now, ownerKey, row.id]
      );
    }
    return row.id;
  }

  const categoryId = scope.userId
    ? deterministicCategoryId(scope.userId, name)
    : deterministicGuestCategoryId(name);

  await run(
    `
    INSERT INTO categories (
      id, name, budget, normalizedName, createdAt, updatedAt, deletedAt,
      dirty, version, deviceId, ownerKey, userId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      categoryId,
      name,
      0,
      normalizedName,
      now,
      now,
      null,
      1,
      1,
      deviceId,
      ownerKey,
      scope.userId,
    ]
  );

  return categoryId;
}

async function deleteCategories(ownerKey: string, categoryIds: string[]) {
  if (categoryIds.length === 0) {
    return;
  }

  const placeholders = categoryIds.map(() => "?").join(",");
  await run(
    `
    DELETE FROM categories
    WHERE ownerKey = ?
      AND id IN (${placeholders});
    `,
    [ownerKey, ...categoryIds]
  );
}
