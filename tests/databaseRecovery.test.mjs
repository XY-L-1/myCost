import test from "node:test";
import assert from "node:assert/strict";
import {
  addColumnIfMissing,
  runWithDatabaseRecovery,
} from "../.test-dist/src/domain/databaseRecovery.js";

test("database recovery does not reconnect after a successful operation", async () => {
  let attempts = 0;
  let resets = 0;

  await runWithDatabaseRecovery(
    async () => {
      attempts += 1;
    },
    async () => {
      resets += 1;
    }
  );

  assert.equal(attempts, 1);
  assert.equal(resets, 0);
});

test("database recovery reconnects and retries once after a failure", async () => {
  let attempts = 0;
  let resets = 0;

  await runWithDatabaseRecovery(
    async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("database is temporarily unavailable");
    },
    async () => {
      resets += 1;
    }
  );

  assert.equal(attempts, 2);
  assert.equal(resets, 1);
});

test("database recovery preserves the final error after one retry", async () => {
  let attempts = 0;
  let resets = 0;

  await assert.rejects(
    runWithDatabaseRecovery(
      async () => {
        attempts += 1;
        throw new Error("database remains unavailable");
      },
      async () => {
        resets += 1;
      }
    ),
    /database remains unavailable/
  );

  assert.equal(attempts, 2);
  assert.equal(resets, 1);
});

test("partial migration recovery skips a column that already exists", async () => {
  let additions = 0;

  await addColumnIfMissing(
    async () => [{ name: "id" }, { name: "ownerKey" }],
    "ownerKey",
    async () => {
      additions += 1;
    }
  );

  assert.equal(additions, 0);
});

test("partial migration recovery adds a missing column", async () => {
  let additions = 0;

  await addColumnIfMissing(
    async () => [{ name: "id" }],
    "ownerKey",
    async () => {
      additions += 1;
    }
  );

  assert.equal(additions, 1);
});
