import { query, queryFirst, run } from "../db/database";
import { DataScope, buildScopeFilter } from "../domain/dataScope";
import {
  categoryIdentityKey,
  collapseCategoriesByIdentity,
  preferCategoryRecord,
} from "../domain/categoryMerge";
import { Category, CategorySchema } from "../types/category";
import { notifyCategoryMutation } from "../sync/syncEvents";
import { normalizeCategoryName } from "../utils/categoryIdentity";
import { repointCategoryReferences } from "../services/categoryReferenceService";
import { generateUUID } from "../utils/uuid";

type CategoryListOptions = {
  includeArchived?: boolean;
};

type CategoryLookupOptions = {
  includeArchived?: boolean;
  excludeId?: string;
};

type CreateOrRestoreInput = {
  name: string;
  budget?: number;
  deviceId: string;
  scope: DataScope;
};

type CreateOrRestoreResult = {
  category: Category;
  status: "created" | "restored" | "existing";
};

export class CategoryRepository {
  static async getAll(
    scope: DataScope,
    options: CategoryListOptions = {}
  ): Promise<Category[]> {
    const owner = buildScopeFilter(scope);
    const rows = await query<Category>(
      `
      SELECT *
      FROM categories
      WHERE ${owner.clause}
        ${options.includeArchived ? "" : "AND deletedAt IS NULL"}
      ORDER BY deletedAt IS NOT NULL, name COLLATE NOCASE ASC;
      `,
      owner.params
    );

    const categories = rows.map((row) => CategorySchema.parse(row));
    return collapseCategoriesByIdentity(categories, {
      includeArchived: options.includeArchived,
    });
  }

  static async getDisplayNameMap(scope: DataScope): Promise<Map<string, string>> {
    const owner = buildScopeFilter(scope);
    const rows = await query<Category>(
      `
      SELECT *
      FROM categories
      WHERE ${owner.clause};
      `,
      owner.params
    );
    const categories = rows.map((row) => CategorySchema.parse(row));
    const groups = new Map<string, Category[]>();

    categories.forEach((category) => {
      const key = categoryIdentityKey(category);
      const group = groups.get(key) ?? [];
      group.push(category);
      groups.set(key, group);
    });

    const nameMap = new Map<string, string>();
    groups.forEach((group) => {
      const active = group.filter((category) => !category.deletedAt);
      const canonical = (active.length > 0 ? active : group).reduce(
        preferCategoryRecord
      );
      group.forEach((category) => {
        nameMap.set(category.id, canonical.name);
      });
    });

    return nameMap;
  }

  static async getCanonicalByIdInScope(
    scope: DataScope,
    id: string
  ): Promise<Category | null> {
    const category = await this.getByIdInScope(scope, id);
    if (!category) return null;

    const canonical = await this.findByNormalizedName(scope, category.name);
    return canonical ?? category;
  }

  static async getByIdInScope(
    scope: DataScope,
    id: string
  ): Promise<Category | null> {
    const owner = buildScopeFilter(scope);
    const row = await queryFirst<Category>(
      `
      SELECT *
      FROM categories
      WHERE id = ?
        AND ${owner.clause};
      `,
      [id, ...owner.params]
    );
    return row ? CategorySchema.parse(row) : null;
  }

  static async findByNormalizedName(
    scope: DataScope,
    name: string,
    options: CategoryLookupOptions = {}
  ): Promise<Category | null> {
    const owner = buildScopeFilter(scope);
    const normalizedName = normalizeCategoryName(name);
    const clauses = [`${owner.clause}`, `normalizedName = ?`];
    const params: Array<string> = [...owner.params, normalizedName];

    if (!options.includeArchived) {
      clauses.push("deletedAt IS NULL");
    }

    if (options.excludeId) {
      clauses.push("id != ?");
      params.push(options.excludeId);
    }

    const row = await queryFirst<Category>(
      `
      SELECT *
      FROM categories
      WHERE ${clauses.join(" AND ")}
      ORDER BY deletedAt IS NOT NULL, createdAt ASC, id ASC;
      `,
      params
    );

    return row ? CategorySchema.parse(row) : null;
  }

  static async insert(category: Category): Promise<void> {
    const normalizedName = normalizeCategoryName(category.name);

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
        category.dirty,
        category.version,
        category.deviceId,
        category.ownerKey,
        category.userId,
      ]
    );

    notifyCategoryMutation();
  }

  static async createOrRestore({
    scope,
    deviceId,
    name,
    budget = 0,
  }: CreateOrRestoreInput): Promise<CreateOrRestoreResult> {
    const existing = await this.findByNormalizedName(scope, name, {
      includeArchived: true,
    });

    if (existing && !existing.deletedAt) {
      return { category: existing, status: "existing" };
    }

    if (existing && existing.deletedAt) {
      const restored = await this.restore(existing);
      if (restored.budget !== budget) {
        const updated = await this.update(restored, {
          name: restored.name,
          budget,
        });
        return { category: updated, status: "restored" };
      }
      return { category: restored, status: "restored" };
    }

    const now = new Date().toISOString();
    const created: Category = {
      id: await generateUUID(),
      name: name.trim(),
      budget,
      normalizedName: normalizeCategoryName(name),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      dirty: scope.userId ? 1 : 0,
      version: 1,
      deviceId,
      ownerKey: scope.ownerKey,
      userId: scope.userId,
    };

    await this.insert(created);
    return { category: created, status: "created" };
  }

  static async update(
    category: Category,
    updates: Pick<Category, "name" | "budget">
  ): Promise<Category> {
    const updatedAt = new Date().toISOString();
    const normalizedName = normalizeCategoryName(updates.name);

    await run(
      `
      UPDATE categories
      SET name = ?, budget = ?, normalizedName = ?, updatedAt = ?, dirty = 1, version = ?
      WHERE id = ? AND ownerKey = ?;
      `,
      [
        updates.name,
        updates.budget,
        normalizedName,
        updatedAt,
        category.version + 1,
        category.id,
        category.ownerKey,
      ]
    );

    notifyCategoryMutation();

    return {
      ...category,
      name: updates.name,
      budget: updates.budget,
      normalizedName,
      updatedAt,
      dirty: 1,
      version: category.version + 1,
    };
  }

  static async archive(category: Category): Promise<Category> {
    const now = new Date().toISOString();

    await run(
      `
      UPDATE categories
      SET deletedAt = ?, updatedAt = ?, dirty = 1, version = ?
      WHERE id = ? AND ownerKey = ?;
      `,
      [now, now, category.version + 1, category.id, category.ownerKey]
    );

    notifyCategoryMutation();

    return {
      ...category,
      deletedAt: now,
      updatedAt: now,
      dirty: 1,
      version: category.version + 1,
    };
  }

  static async restore(category: Category): Promise<Category> {
    const now = new Date().toISOString();
    const restoredName = category.name.trim();
    const duplicate = await queryFirst<Category>(
      `
      SELECT *
      FROM categories
      WHERE ownerKey = ?
        AND normalizedName = ?
        AND deletedAt IS NULL
        AND id != ?
      ORDER BY createdAt ASC, id ASC;
      `,
      [
        category.ownerKey,
        category.normalizedName ?? normalizeCategoryName(restoredName),
        category.id,
      ]
    );

    if (duplicate) {
      const canonical = CategorySchema.parse(duplicate);
      await repointCategoryReferences(
        category.ownerKey,
        [category.id],
        canonical.id,
        now
      );
      await run(
        `
        DELETE FROM categories
        WHERE id = ? AND ownerKey = ?;
        `,
        [category.id, category.ownerKey]
      );

      notifyCategoryMutation();
      return canonical;
    }

    await run(
      `
      UPDATE categories
      SET deletedAt = NULL, updatedAt = ?, dirty = 1, version = ?
      WHERE id = ? AND ownerKey = ?;
      `,
      [now, category.version + 1, category.id, category.ownerKey]
    );

    notifyCategoryMutation();

    return {
      ...category,
      deletedAt: null,
      updatedAt: now,
      dirty: 1,
      version: category.version + 1,
    };
  }
}
