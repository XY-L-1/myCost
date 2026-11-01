import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAmountInputChange,
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

test("amount input appends digits even when the native caret moves", () => {
  assert.equal(formatAmountInput(applyAmountInputChange(1, "20.01")), "0.12");
  assert.equal(formatAmountInput(applyAmountInputChange(1, "02.01")), "0.12");
});

test("amount input never accumulates leading zeros", () => {
  let amountCents = 0;

  for (const digit of "0000012") {
    amountCents = applyAmountInputChange(
      amountCents,
      `${formatAmountInput(amountCents)}${digit}`
    );
  }

  assert.equal(formatAmountInput(amountCents), "0.12");
});

test("amount input appends when a partial selection is replaced", () => {
  assert.equal(formatAmountInput(applyAmountInputChange(12, "9.12")), "1.29");
});

test("amount input deletes digits even when the native caret moves", () => {
  assert.equal(formatAmountInput(applyAmountInputChange(123, "1.3")), "0.12");
});

test("amount input replaces the value when pasted over the whole field", () => {
  assert.equal(formatAmountInput(applyAmountInputChange(1234, "5.67")), "5.67");
});
