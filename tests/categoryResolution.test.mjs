import test from "node:test";
import assert from "node:assert/strict";
import {
  buildResolvedCategoryBreakdown,
  filterExpensesByResolvedCategory,
  isEmptyFallbackCategory,
  resolveExpenseCategoryName,
} from "../.test-dist/src/domain/categoryResolution.js";
import { deterministicCategoryId } from "../.test-dist/src/utils/categoryIdentity.js";

const scope = {
  ownerKey: "user-1",
  userId: "user-1",
  mode: "user",
};

test("resolveExpenseCategoryName infers placeholder categories from descriptions", () => {
  assert.equal(
    resolveExpenseCategoryName(
      { categoryId: "placeholder", description: "Costco Gas" },
      "Category",
      "Category"
    ),
    "Gas"
  );
  assert.equal(
    resolveExpenseCategoryName(
      { categoryId: "other", description: "Chick-fil-A" },
      "Other",
      "Category"
    ),
    "Food"
  );
});

test("buildResolvedCategoryBreakdown groups placeholder rows into inferred categories", () => {
  const categoryNames = new Map([
    ["placeholder", "Category"],
    ["other", "Other"],
    ["food", "Food"],
  ]);
  const rows = buildResolvedCategoryBreakdown(
    scope,
    [
      { categoryId: "placeholder", description: "Costco Gas", amountCents: 3219 },
      { categoryId: "other", description: "Office Lunch", amountCents: 917 },
      { categoryId: "food", description: "McDonald", amountCents: 658 },
    ],
    categoryNames,
    "Category"
  );

  assert.deepEqual(
    rows.map((row) => [row.name, row.total]),
    [
      ["Gas", 3219],
      ["Food", 1575],
    ]
  );
});

test("filterExpensesByResolvedCategory includes inferred placeholder rows", () => {
  const gasId = deterministicCategoryId(scope.userId, "Gas");
  const rows = [
    { categoryId: "placeholder", description: "Costco Gas", amountCents: 3219 },
    { categoryId: "other", description: "Dummy Test", amountCents: 1 },
  ];

  assert.deepEqual(
    filterExpensesByResolvedCategory(
      scope,
      rows,
      new Map([
        ["placeholder", "Category"],
        ["other", "Other"],
      ]),
      gasId,
      "Category"
    ),
    [rows[0]]
  );
});

test("isEmptyFallbackCategory only hides empty fallback placeholder rows", () => {
  assert.equal(isEmptyFallbackCategory("Category", "Category", 0, 0), true);
  assert.equal(isEmptyFallbackCategory("Category", "Category", 1000, 0), false);
  assert.equal(isEmptyFallbackCategory("Category", "Category", 0, 1000), false);
  assert.equal(isEmptyFallbackCategory("Other", "Category", 0, 0), false);
  assert.equal(isEmptyFallbackCategory("Food", "Category", 0, 0), false);
});
