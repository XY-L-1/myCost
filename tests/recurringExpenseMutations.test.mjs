import test from "node:test";
import assert from "node:assert/strict";
import { buildSoftDeletedRecurringExpense } from "../.test-dist/src/domain/recurringExpenseMutations.js";

test("soft delete metadata keeps a recurring expense tombstone for sync", () => {
  const base = {
    id: "recurring-1",
    title: "Phone plan",
    amountCents: 3500,
    currency: "USD",
    categoryId: "category-1",
    description: null,
    frequency: "monthly",
    nextDueDate: "2026-10-01",
    lastGeneratedDate: null,
    isActive: 1,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    deletedAt: null,
    ownerKey: "user-1",
    userId: "user-1",
  };

  const deletedAt = "2026-09-22T10:00:00.000Z";
  const deleted = buildSoftDeletedRecurringExpense(base, deletedAt);

  assert.equal(deleted.deletedAt, deletedAt);
  assert.equal(deleted.updatedAt, deletedAt);
  assert.equal(deleted.id, base.id);
  assert.equal(deleted.isActive, 1);
});
