import assert from "node:assert";
import { test, mock } from "node:test";
import {
  convertBathsForRentometer,
  convertBedroomsForRentometer,
  parseNumber,
  clampLookBackDays,
} from "../../src/lib/rentometer/helpers.js";

test("convertBathsForRentometer rules", () => {
  assert.strictEqual(convertBathsForRentometer(1), "1");
  assert.strictEqual(convertBathsForRentometer(1.25), "1");
  assert.strictEqual(convertBathsForRentometer(1.49), "1");
  assert.strictEqual(convertBathsForRentometer(1.5), "1.5+");
  assert.strictEqual(convertBathsForRentometer(2), "1.5+");
  assert.strictEqual(convertBathsForRentometer(3), "1.5+");
});

test("convertBedroomsForRentometer rounding and clamp", () => {
  assert.strictEqual(convertBedroomsForRentometer(0.8), 1);
  assert.strictEqual(convertBedroomsForRentometer(1.2), 1);
  assert.strictEqual(convertBedroomsForRentometer(1.5), 2);
  assert.strictEqual(convertBedroomsForRentometer(2.4), 2);
  assert.strictEqual(convertBedroomsForRentometer(2.5), 3);
  assert.strictEqual(convertBedroomsForRentometer(2.9), 3);
  assert.strictEqual(convertBedroomsForRentometer(7), 6);
  assert.strictEqual(convertBedroomsForRentometer(-1), 0);
});

test("parseNumber", () => {
  assert.strictEqual(parseNumber("12"), 12);
  assert.strictEqual(parseNumber("12.5"), 12.5);
  assert.strictEqual(parseNumber("abc"), null);
});

test("clampLookBackDays", () => {
  assert.strictEqual(clampLookBackDays(undefined), 365);
  assert.strictEqual(clampLookBackDays(60), 90);
  assert.strictEqual(clampLookBackDays(2000), 1460);
  assert.strictEqual(clampLookBackDays(120), 120);
});

