import { query, run } from "../db/database";
import { CategoryRepository } from "../repositories/categoryRepository";
import {
  DEFAULT_CATEGORIES,
  deterministicCategoryId,
  normalizeCategoryName,
} from "../utils/categoryIdentity";

/**
 * ensureDefaultCategories
 *
 * Seeds default categories only after remote pull.
 * Uses deterministic UUIDs to keep identity stable across devices.
 */
export async function ensureDefaultCategories(
  userId: string,
  deviceId: string
): Promise<void> {
  const now = new Date().toISOString();
  const normalizedDefaults = DEFAULT_CATEGORIES.map((name) =>
    normalizeCategoryName(name)
  );
  const existing = await query<{
    id: string;
    name: string;
    normalizedName: string | null;
    deletedAt: string | null;
    createdAt: string;
  }>(
    `SELECT id, name, normalizedName, deletedAt, createdAt
     FROM categories
     WHERE userId = ?;`,
    [userId]
  );

  const groupedByNormalized = new Map<string, typeof existing>();
  existing.forEach((row) => {
    const normalized = normalizeCategoryName(row.normalizedName ?? row.name);
    const group = groupedByNormalized.get(normalized) ?? [];
    group.push(row);
    groupedByNormalized.set(normalized, group);
  });

  for (let i = 0; i < DEFAULT_CATEGORIES.length; i += 1) {
    const name = DEFAULT_CATEGORIES[i];
    const normalized = normalizedDefaults[i];
    const group = groupedByNormalized.get(normalized) ?? [];
    const deterministicId = deterministicCategoryId(userId, name);

    const deterministicRow = group.find((row) => row.id === deterministicId);
    const activeRow = group.find((row) => !row.deletedAt);

    if (deterministicRow || activeRow) {
      const canonical = deterministicRow ?? activeRow!;
      if (canonical.deletedAt && !activeRow) {
        // Only revive if no active row exists for this normalized name.
        await run(
          `UPDATE categories
           SET deletedAt = NULL, updatedAt = ?, dirty = 1, version = version + 1
           WHERE id = ?;`,
          [now, canonical.id]
        );
      }
      continue;
    }

    const id = deterministicId;

    await CategoryRepository.insert({
      id,
      name,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      dirty: 1,
      version: 1,
      deviceId,
      userId,
    });
  }
}
