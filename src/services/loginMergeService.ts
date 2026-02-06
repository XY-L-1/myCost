import { run } from "../db/database";

/**
 * attachAnonymousDataToUser
 *
 * After a user logs in, this function attaches
 * all locally-created anonymous records to the user.
 *
 * This does NOT sync data yet.
 * It only prepares local data for sync.
 */
export async function attachAnonymousDataToUser(userId: string): Promise<void> {
   const now = new Date().toISOString();

   // Attach expenses
   await run(
      `
      UPDATE expenses
      SET userId = ?, dirty = 1, updatedAt = ?
      WHERE userId IS NULL;
      `,
      [userId, now]
   );

   // Attach categories (future-proof)
   await run(
      `
      UPDATE categories
      SET userId = ?, dirty = 1, updatedAt = ?
      WHERE userId IS NULL;
      `,
      [userId, now]
   );
}