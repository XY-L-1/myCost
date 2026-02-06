// src/db/database.ts
import { openDatabaseSync, SQLiteDatabase } from "expo-sqlite";

export const db: SQLiteDatabase = openDatabaseSync("expense_tracker.db");

/**
 * Execute SQL that does not return rows (CREATE / INSERT / UPDATE)
 */
export async function exec(sql: string): Promise<void> {
   await db.execAsync(sql);
}

/**
 * Execute SQL with parameters (INSERT / UPDATE / DELETE)
 */
export async function run(
   sql: string,
   params: any[] = []
): Promise<void> {
   await db.runAsync(sql, params);
}

/**
 * Execute SELECT queries
 */
export async function query<T = any>(
   sql: string,
   params: any[] = []
): Promise<T[]> {
   return await db.getAllAsync<T>(sql, params);
}
