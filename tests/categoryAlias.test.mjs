import test from "node:test";
import assert from "node:assert/strict";
import { buildCategoryAliasMap } from "../.test-dist/src/domain/categoryAlias.js";

test("buildCategoryAliasMap maps archived duplicate ids to the active category", () => {
  const aliases = buildCategoryAliasMap([
    {
      id: "archived-food",
      name: "Food",
      normalizedName: "food",
      deletedAt: "2026-02-09T08:08:18.570Z",
      createdAt: "2026-02-09T06:19:47.839Z",
      updatedAt: "2026-02-09T08:08:18.570Z",
    },
    {
      id: "active-food",
      name: "Food",
      normalizedName: "food",
      deletedAt: null,
      createdAt: "2026-02-09T06:20:20.000Z",
      updatedAt: "2026-05-18T07:00:00.000Z",
    },
  ]);

  assert.equal(aliases.get("archived-food"), "active-food");
  assert.equal(aliases.get("active-food"), "active-food");
});

test("buildCategoryAliasMap does not merge stale normalized names", () => {
  const aliases = buildCategoryAliasMap([
    {
      id: "gas-id",
      name: "Gas",
      normalizedName: "category",
      deletedAt: null,
      createdAt: "2026-02-09T06:19:47.839Z",
      updatedAt: "2026-02-09T06:19:47.839Z",
    },
    {
      id: "category-id",
      name: "Category",
      normalizedName: "category",
      deletedAt: null,
      createdAt: "2026-02-09T06:19:47.839Z",
      updatedAt: "2026-02-09T06:19:47.839Z",
    },
  ]);

  assert.equal(aliases.get("gas-id"), "gas-id");
  assert.equal(aliases.get("category-id"), "category-id");
});
