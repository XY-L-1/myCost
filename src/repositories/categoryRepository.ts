import { exec, query, run } from "../db/database";
import { Category, CategorySchema } from "../types/category";
import { notifyCategoryMutation } from "../sync/syncEvents";
import { normalizeCategoryName } from "../utils/categoryIdentity";
// Repository 的“铁律”
// 	•	❌ 不做业务判断
// 	•	❌ 不管 UI
// 	•	❌ 不管 sync
// 	•	✅ 只负责 SQLite CRUD

export class CategoryRepository {
   static async getAll(): Promise<Category[]> {
      const rows = await query<Category>(
         `SELECT * FROM categories WHERE deletedAt IS NULL ORDER BY name;`
      );

      // Zod 校验
      return rows.map((row) => CategorySchema.parse(row));
   }

   static async insert(category: Category): Promise<void> {
      const normalizedName = normalizeCategoryName(category.name);

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
         category.dirty,
         category.version,
         category.deviceId,
         category.userId,
         ]
      );

      // Notify sync layer without coupling UI to network logic.
      notifyCategoryMutation();
   }

   static async count(): Promise<number> {
      const rows = await query<{ count: number }>(
         `SELECT COUNT(*) as count FROM categories;`
      );
      return rows[0]?.count ?? 0;
   }

}
