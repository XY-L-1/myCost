import { v4 as uuidv4 } from "uuid";
import { Category } from "../types/category";
import { CategoryRepository } from "../repositories/categoryRepository";
import * as Constants from "expo-constants";
import { generateUUID } from "../utils/uuid";

const DEFAULT_CATEGORIES = [
   "Food",
   "Transport",
   "Shopping",
   "Entertainment",
   "Housing",
   "Utilities",
   "Healthcare",
   "Other",
];

/**
 * seedCategoriesIfNeeded
 *
 * 在数据库为空时插入默认分类
 * - 只执行一次
 * - 分类是准静态数据
 */
export async function seedCategoriesIfNeeded(deviceId: string) {
   const count = await CategoryRepository.count();
   if (count > 0) return;
   
   const now = new Date().toISOString();
   
   for (const name of DEFAULT_CATEGORIES) {
      await CategoryRepository.insert({
         id: await generateUUID(),
         name,
         createdAt: now,
         updatedAt: now,
         deletedAt: null,
         dirty: 1,
         version: 1,
         deviceId,
         userId: null,
      });
   }
}