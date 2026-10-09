import assert from "node:assert/strict";
import { test } from "node:test";
import { formatInr } from "./money.ts";

test("formats Indian grouping without floats", () => {
  assert.equal(formatInr("12500.00"), "₹12,500.00");
  assert.equal(formatInr("10.1"), "₹10.10");
  assert.equal(formatInr("0.00"), "₹0.00");
  assert.equal(formatInr(null), "—");
  assert.equal(formatInr("40.10"), "₹40.10");
});
