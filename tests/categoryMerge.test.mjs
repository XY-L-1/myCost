import test from "node:test";
import assert from "node:assert/strict";
import {
  categoryIdentityKey,
  collapseCategoriesByIdentity,
  preferCategoryRecord,
} from "../.test-dist/src/domain/categoryMerge.js";

test("categoryIdentityKey normalizes names consistently", () => {
  assert.equal(
    categoryIdentityKey({ name: "  Food   Delivery  " }),
    "food delivery"
  );
});

test("preferCategoryRecord keeps active categories over archived duplicates", () => {
  const archived = {
    id: "archived-food",
    name: "Food",
    normalizedName: "food",
    deletedAt: "2026-04-01T00:00:00.000Z",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };
  const active = {
    id: "active-food",
    name: "Food",
    normalizedName: "food",
    deletedAt: null,
    createdAt: "2026-03-02T00:00:00.000Z",
    updatedAt: "2026-03-02T00:00:00.000Z",
  };

  assert.equal(preferCategoryRecord(archived, active), active);
});

test("collapseCategoriesByIdentity hides archived duplicates when active exists", () => {
  const categories = [
    {
      id: "archived-food",
      name: "Food",
      normalizedName: "food",
      deletedAt: "2026-04-01T00:00:00.000Z",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
    {
      id: "active-food",
      name: "Food",
      normalizedName: "food",
      deletedAt: null,
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
    },
  ];

  assert.deepEqual(collapseCategoriesByIdentity(categories, { includeArchived: true }), [
    categories[1],
  ]);
});

test("collapseCategoriesByIdentity keeps one archived category when no active row exists", () => {
  const categories = [
    {
      id: "older-food",
      name: "Food",
      normalizedName: "food",
      deletedAt: "2026-04-01T00:00:00.000Z",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
    {
      id: "newer-food",
      name: "Food",
      normalizedName: "food",
      deletedAt: "2026-04-02T00:00:00.000Z",
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    },
  ];

  assert.deepEqual(collapseCategoriesByIdentity(categories, { includeArchived: true }), [
    categories[1],
  ]);
});
