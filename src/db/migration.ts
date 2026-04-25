import { exec, query } from "./database";
import { GUEST_OWNER_KEY } from "../domain/dataScope";

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
   {
      version: 3,
      up: async () => {
         await exec(`
         ALTER TABLE expenses ADD COLUMN ownerKey TEXT;
         `);

         await exec(`
         ALTER TABLE categories ADD COLUMN ownerKey TEXT;
         `);

         await exec(`
         UPDATE expenses
         SET ownerKey = COALESCE(userId, '${GUEST_OWNER_KEY}')
         WHERE ownerKey IS NULL;
         `);

         await exec(`
         UPDATE categories
         SET ownerKey = COALESCE(userId, '${GUEST_OWNER_KEY}')
         WHERE ownerKey IS NULL;
         `);

         await exec(
            `CREATE INDEX IF NOT EXISTS idx_expenses_ownerKey ON expenses(ownerKey);`
         );
         await exec(
            `CREATE INDEX IF NOT EXISTS idx_categories_ownerKey ON categories(ownerKey);`
         );
      },
   },
   {
      version: 4,
      up: async () => {
         await exec(`
         CREATE TABLE IF NOT EXISTS budgets (
            id TEXT PRIMARY KEY,
            categoryId TEXT NOT NULL,
            monthKey TEXT NOT NULL,
            amountCents INTEGER NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            ownerKey TEXT NOT NULL,
            userId TEXT
         );
         `);

         await exec(`
         CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_scope_category_month
         ON budgets(ownerKey, categoryId, monthKey);
         `);

         await exec(`
         CREATE TABLE IF NOT EXISTS recurring_expenses (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            amountCents INTEGER NOT NULL,
            currency TEXT NOT NULL,
            categoryId TEXT NOT NULL,
            description TEXT,
            frequency TEXT NOT NULL,
            nextDueDate TEXT NOT NULL,
            lastGeneratedDate TEXT,
            isActive INTEGER NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            ownerKey TEXT NOT NULL,
            userId TEXT
         );
         `);

         await exec(`
         CREATE INDEX IF NOT EXISTS idx_recurring_scope
         ON recurring_expenses(ownerKey, isActive, nextDueDate);
         `);
      },
   },
   {
      version: 5,
      up: async () => {
         await exec(`
         ALTER TABLE categories ADD COLUMN budget REAL NOT NULL DEFAULT 0;
         `);

         await exec(`
         UPDATE categories
         SET budget = 0
         WHERE budget IS NULL;
         `);
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
