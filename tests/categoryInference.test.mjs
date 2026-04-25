import test from "node:test";
import assert from "node:assert/strict";
import { inferDefaultCategoryName } from "../.test-dist/src/domain/categoryInference.js";

test("inferDefaultCategoryName uses explicit category words", () => {
  assert.equal(inferDefaultCategoryName("Costco Gas"), "Gas");
  assert.equal(inferDefaultCategoryName("Costco Food"), "Food");
});

test("inferDefaultCategoryName uses common vendor and expense keywords", () => {
  assert.equal(inferDefaultCategoryName("monthly rent"), "Housing");
  assert.equal(inferDefaultCategoryName("VISIBLE SIM CARD"), "Subscription");
  assert.equal(inferDefaultCategoryName("pizza night"), "Food");
  assert.equal(inferDefaultCategoryName("Kaiser for April and May"), "Healthcare");
  assert.equal(inferDefaultCategoryName("85C"), "Food");
  assert.equal(inferDefaultCategoryName("99 Ranch"), "Food");
  assert.equal(inferDefaultCategoryName("Shooting and Eating"), "Food");
});

test("inferDefaultCategoryName returns null when there is no useful signal", () => {
  assert.equal(inferDefaultCategoryName("random note"), null);
  assert.equal(inferDefaultCategoryName(null), null);
});
