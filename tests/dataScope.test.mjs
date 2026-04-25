import test from "node:test";
import assert from "node:assert/strict";
import { guestScope, userScope, buildScopeFilter, GUEST_OWNER_KEY } from "../.test-dist/src/domain/dataScope.js";

test("guest scope uses the dedicated guest owner key", () => {
  const scope = guestScope();
  assert.equal(scope.ownerKey, GUEST_OWNER_KEY);
  assert.equal(scope.userId, null);
  assert.equal(scope.mode, "guest");
});

test("user scope maps owner key to user id", () => {
  const scope = userScope("user-123");
  assert.equal(scope.ownerKey, "user-123");
  assert.equal(scope.userId, "user-123");
  assert.equal(scope.mode, "user");
});

test("scope filter produces a deterministic SQL clause", () => {
  const filter = buildScopeFilter(userScope("u-1"));
  assert.equal(filter.clause, "ownerKey = ?");
  assert.deepEqual(filter.params, ["u-1"]);
});
