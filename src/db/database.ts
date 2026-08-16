// src/db/database.ts
import { openDatabaseAsync, SQLiteDatabase } from "expo-sqlite";

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLiteDatabase> {
   dbPromise ??= openDatabaseAsync("expense_tracker.db").catch((error) => {
      dbPromise = null;
      throw error;
   });
   return dbPromise;
}

export async function resetDatabaseConnection(): Promise<void> {
   const currentDbPromise = dbPromise;
   dbPromise = null;

   if (!currentDbPromise) return;

   try {
      const db = await currentDbPromise;
      await db.closeAsync();
   } catch (error) {
      console.warn("Failed to close the previous database connection", error);
   }
}

export async function withTransaction(task: () => Promise<void>): Promise<void> {
   const db = await getDb();
   await db.withTransactionAsync(task);
}

/**
 * Execute SQL that does not return rows (CREATE / INSERT / UPDATE)
 */
export async function exec(sql: string): Promise<void> {
   const db = await getDb();
   await db.execAsync(sql);
}

/**
 * Execute SQL with parameters (INSERT / UPDATE / DELETE)
 */
export async function run(
   sql: string,
   params: any[] = []
): Promise<void> {
   const db = await getDb();
   await db.runAsync(sql, params);
}

/**
 * Execute SELECT queries
 */
export async function query<T = any>(
   sql: string,
   params: any[] = []
): Promise<T[]> {
   const db = await getDb();
   return await db.getAllAsync<T>(sql, params);
}

export async function queryFirst<T = any>(
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
