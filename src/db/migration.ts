// src/db/migrations.ts
import { exec, query } from "./database";

type Migration = {
   version: number;
   up: () => Promise<void>;
};

const migrations: Migration[] = [
   {
      version: 1,
      up: async () => {
         // migrations table
         await exec(`
         CREATE TABLE IF NOT EXISTS migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
         );
         `);

         // expenses
         await exec(`
         CREATE TABLE IF NOT EXISTS expenses (
            id TEXT PRIMARY KEY,
            amountCents INTEGER NOT NULL,
            currency TEXT NOT NULL,
            categoryId TEXT NOT NULL,
            description TEXT,
            expenseDate TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            deletedAt TEXT,
            dirty INTEGER NOT NULL,
            version INTEGER NOT NULL,
            deviceId TEXT NOT NULL,
            userId TEXT
         );
         `);

         // categories
         await exec(`
         CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            deletedAt TEXT,
            dirty INTEGER NOT NULL,
            version INTEGER NOT NULL,
            deviceId TEXT NOT NULL,
            userId TEXT
         );
         `);

         // sync metadata
         await exec(`
         CREATE TABLE IF NOT EXISTS sync_metadata (
            key TEXT PRIMARY KEY,
            value TEXT
         );
         `);

         // indexes
         await exec(`CREATE INDEX IF NOT EXISTS idx_expenses_userId ON expenses(userId);`);
         await exec(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expenseDate);`);
         await exec(`CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(categoryId);`);
         await exec(`CREATE INDEX IF NOT EXISTS idx_expenses_dirty ON expenses(dirty);`);
      },
   },
   {
      version: 2,
      up: async () => {
         // Add normalizedName to categories for deterministic identity.
         await exec(`
         ALTER TABLE categories ADD COLUMN normalizedName TEXT;
         `);

         // Backfill normalizedName for existing rows.
         await exec(`
         UPDATE categories
         SET normalizedName = lower(trim(replace(name, '  ', ' ')))
         WHERE normalizedName IS NULL;
         `);

         // Index for fast lookups and conflict checks.
         await exec(
            `CREATE INDEX IF NOT EXISTS idx_categories_user_norm ON categories(userId, normalizedName);`
         );
      },
   },
   ];

   export async function runMigrations(): Promise<void> {
   // ensure migrations table exists
   await exec(`
      CREATE TABLE IF NOT EXISTS migrations (
         version INTEGER PRIMARY KEY,
         applied_at TEXT NOT NULL
      );
   `);

   const rows = await query<{ version: number }>(
      `SELECT MAX(version) as version FROM migrations;`
   );

   const currentVersion = rows[0]?.version ?? 0;
   const pending = migrations.filter((m) => m.version > currentVersion);

   for (const migration of pending) {
      console.log(`Running migration v${migration.version}`);
      await migration.up();
      await exec(
         `INSERT INTO migrations (version, applied_at) VALUES (${migration.version}, '${new Date().toISOString()}');`
      );
   }
}
