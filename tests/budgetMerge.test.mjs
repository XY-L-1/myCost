import test from "node:test";
import assert from "node:assert/strict";
import {
  budgetIdentityKey,
  findMatchingBudgetRecord,
  preferBudgetRecord,
} from "../.test-dist/src/domain/budgetMerge.js";

test("preferBudgetRecord keeps the most recently updated budget", () => {
  const canonical = {
    id: "budget-canonical",
    amountCents: 25000,
    createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-03-05T09:00:00.000Z",
  };
  const duplicate = {
    id: "budget-duplicate",
    amountCents: 31000,
    createdAt: "2026-03-02T09:00:00.000Z",
    updatedAt: "2026-03-07T09:00:00.000Z",
  };

  assert.equal(preferBudgetRecord(canonical, duplicate), duplicate);
});

test("preferBudgetRecord breaks ties deterministically", () => {
  const a = {
    id: "budget-a",
    amountCents: 10000,
    createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-03-05T09:00:00.000Z",
  };
  const b = {
    id: "budget-b",
    amountCents: 20000,
    createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-03-05T09:00:00.000Z",
  };

  assert.equal(preferBudgetRecord(a, b), b);
});

test("guest budget wins a login merge collision when it is newer", () => {
  const userBudget = {
    id: "budget-user",
    amountCents: 20000,
    createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-03-05T09:00:00.000Z",
  };
  const guestBudget = {
    id: "budget-guest",
    amountCents: 30000,
    createdAt: "2026-03-02T09:00:00.000Z",
    updatedAt: "2026-03-08T09:00:00.000Z",
  };

  assert.equal(preferBudgetRecord(userBudget, guestBudget), guestBudget);
});

test("existing user budget survives a login merge collision when it is newer", () => {
  const userBudget = {
    id: "budget-user",
    amountCents: 40000,
    createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-03-09T09:00:00.000Z",
  };
  const guestBudget = {
    id: "budget-guest",
    amountCents: 30000,
    createdAt: "2026-03-02T09:00:00.000Z",
    updatedAt: "2026-03-08T09:00:00.000Z",
  };

  assert.equal(preferBudgetRecord(userBudget, guestBudget), userBudget);
});

test("budgetIdentityKey matches the remote unique budget scope", () => {
  assert.equal(
    budgetIdentityKey({
      categoryId: "category-food",
      monthKey: "2026-04",
    }),
    "category-food:2026-04"
  );
});

test("findMatchingBudgetRecord prefers unique scope matches before id matches", () => {
  const records = [
    {
      id: "same-scope",
      categoryId: "category-food",
      monthKey: "2026-04",
    },
    {
      id: "same-id",
      categoryId: "category-rent",
      monthKey: "2026-05",
    },
  ];

  assert.equal(
    findMatchingBudgetRecord(records, {
      id: "same-id",
      categoryId: "category-food",
      monthKey: "2026-04",
    }),
    records[0]
  );
});

test("findMatchingBudgetRecord falls back to category-month matches", () => {
  const records = [
    {
      id: "remote-budget",
      categoryId: "category-food",
      monthKey: "2026-04",
    },
  ];

  assert.equal(
    findMatchingBudgetRecord(records, {
      id: "local-budget",
      categoryId: "category-food",
      monthKey: "2026-04",
    }),
    records[0]
  );
});
