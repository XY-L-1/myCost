import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAmountInput,
  parseAmountInput,
} from "../.test-dist/src/utils/amountInput.js";

test("amount input shifts typed digits in from cents", () => {
  let value = "0.00";

  value = formatAmountInput(parseAmountInput(`${value}1`));
  assert.equal(value, "0.01");

  value = formatAmountInput(parseAmountInput(`${value}2`));
  assert.equal(value, "0.12");

  value = formatAmountInput(parseAmountInput(`${value}3`));
  assert.equal(value, "1.23");
});

test("amount input shifts digits back toward cents on delete", () => {
  assert.equal(formatAmountInput(parseAmountInput("1.2")), "0.12");
  assert.equal(formatAmountInput(parseAmountInput("0.1")), "0.01");
  assert.equal(formatAmountInput(parseAmountInput("0.0")), "0.00");
});

test("amount input accepts pasted formatted values", () => {
  assert.equal(formatAmountInput(parseAmountInput("$1,234.56")), "1234.56");
});
