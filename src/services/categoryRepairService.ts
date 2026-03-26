import { query, run } from "../db/database";
import { Category } from "../types/category";
import {
  DEFAULT_CATEGORIES,
  deterministicCategoryId,
  normalizeCategoryName,
} from "../utils/categoryIdentity";

/**
 * repairLocalCategoryDuplicates
 *
 * Deduplicates local categories by normalized name.
 * - Defaults use deterministic UUIDs.
 * - Custom categories keep the earliest created record.
 * - Expenses are repointed to canonical IDs.
 */
export async function repairLocalCategoryDuplicates(
  userId: string,
  deviceId: string
): Promise<void> {
  const categories = await query<Category>(
    `SELECT * FROM categories WHERE userId = ? AND deletedAt IS NULL;`,
    [userId]
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
    if (group.length <= 1) continue;

    const defaultName = defaultsByNorm.get(normalized);
    const canonicalId = defaultName
      ? deterministicCategoryId(userId, defaultName)
      : group
          .slice()
          .sort(
            (a, b) =>
              a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
          )[0].id;

    const existingCanonical = group.find((item) => item.id === canonicalId);
    const canonicalSource =
      existingCanonical ??
      group
        .slice()
        .sort(
          (a, b) =>
            a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
        )[0];

    if (!existingCanonical) {
      await run(
        `
        INSERT INTO categories (
          id, name, normalizedName, createdAt, updatedAt, deletedAt,
          dirty, version, deviceId, userId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        [
          canonicalId,
          canonicalSource.name,
          normalizeCategoryName(canonicalSource.name),
          canonicalSource.createdAt,
          now,
          null,
          1,
          canonicalSource.version,
          deviceId,
          userId,
        ]
      );
    }

    const duplicates = group.filter((item) => item.id !== canonicalId);
    if (duplicates.length === 0) continue;

    const duplicateIds = duplicates.map((item) => item.id);
    const placeholders = duplicateIds.map(() => "?").join(",");

    await run(
      `
      UPDATE expenses
      SET categoryId = ?, updatedAt = ?, dirty = 1, version = version + 1
      WHERE categoryId IN (${placeholders});
      `,
      [canonicalId, now, ...duplicateIds]
    );

    await run(
      `
      UPDATE categories
      SET deletedAt = ?, updatedAt = ?, dirty = 0, version = version + 1
      WHERE id IN (${placeholders});
      `,
      [now, now, ...duplicateIds]
    );
  }
}

/**
 * repairMissingCategoryRefs
 *
 * Ensures every expense references a local category row.
 * Any missing categoryId is reassigned to the deterministic "Other" category.
 */
export async function repairMissingCategoryRefs(
  userId: string,
  deviceId: string
): Promise<void> {
  const expenseRows = await query<{ categoryId: string }>(
    `SELECT DISTINCT categoryId FROM expenses WHERE userId = ?;`,
    [userId]
  );

  if (expenseRows.length === 0) return;

  const referencedIds = expenseRows.map((row) => row.categoryId);
  const placeholders = referencedIds.map(() => "?").join(",");

  const categoryRows = await query<{
    id: string;
    deletedAt: string | null;
  }>(
    `SELECT id, deletedAt FROM categories WHERE id IN (${placeholders});`,
    referencedIds
  );

  const existingIds = new Set(categoryRows.map((row) => row.id));
  const missingIds = referencedIds.filter((id) => !existingIds.has(id));

  if (missingIds.length === 0) return;

  const fallbackName = "Other";
  const fallbackId = deterministicCategoryId(userId, fallbackName);
  const fallbackRow = await query<{ id: string; deletedAt: string | null }>(
    `SELECT id, deletedAt FROM categories WHERE id = ?;`,
    [fallbackId]
  );

  const now = new Date().toISOString();

  if (fallbackRow.length === 0) {
    await run(
      `
      INSERT INTO categories (
        id, name, normalizedName, createdAt, updatedAt, deletedAt,
        dirty, version, deviceId, userId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        fallbackId,
        fallbackName,
        normalizeCategoryName(fallbackName),
        now,
        now,
        null,
        1,
        1,
        deviceId,
        userId,
      ]
    );
  } else if (fallbackRow[0].deletedAt) {
    await run(
      `
      UPDATE categories
      SET deletedAt = NULL, updatedAt = ?, dirty = 1, version = version + 1
      WHERE id = ?;
      `,
      [now, fallbackId]
    );
  }

  const missingPlaceholders = missingIds.map(() => "?").join(",");
  await run(
    `
    UPDATE expenses
    SET categoryId = ?, updatedAt = ?, dirty = 1, version = version + 1
    WHERE categoryId IN (${missingPlaceholders});
    `,
    [fallbackId, now, ...missingIds]
  );
}
