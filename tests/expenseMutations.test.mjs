import test from "node:test";
import assert from "node:assert/strict";
import { buildSoftDeletedExpense } from "../.test-dist/src/domain/expenseMutations.js";

test("soft delete metadata updates the expense for sync correctness", () => {
  const base = {
    id: "exp-1",
    amountCents: 1250,
    currency: "USD",
    categoryId: "cat-1",
    description: "Coffee",
    expenseDate: "2026-03-26",
    createdAt: "2026-03-26T10:00:00.000Z",
    updatedAt: "2026-03-26T10:00:00.000Z",
    deletedAt: null,
    dirty: 0,
    version: 4,
    deviceId: "device-1",
    ownerKey: "guest",
    userId: null,
  };

  const deleted = buildSoftDeletedExpense(base, "2026-03-27T10:00:00.000Z");

  assert.equal(deleted.deletedAt, "2026-03-27T10:00:00.000Z");
  assert.equal(deleted.updatedAt, "2026-03-27T10:00:00.000Z");
  assert.equal(deleted.version, 5);
  assert.equal(deleted.dirty, 1);
});
