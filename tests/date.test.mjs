import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDateKey,
  formatMonthKey,
  shiftMonth,
  nextRecurringDate,
} from "../.test-dist/src/utils/date.js";

test("formatDateKey and formatMonthKey keep local calendar values", () => {
  const date = new Date(2026, 2, 26);
  assert.equal(formatDateKey(date), "2026-03-26");
  assert.equal(formatMonthKey(date), "2026-03");
});

test("shiftMonth crosses year boundaries safely", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});

test("nextRecurringDate advances by the selected frequency", () => {
  assert.equal(nextRecurringDate("2026-03-26", "weekly"), "2026-04-02");
  assert.equal(nextRecurringDate("2026-03-26", "monthly"), "2026-04-26");
});
