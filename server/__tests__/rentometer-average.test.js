import assert from "node:assert";
import { test } from "node:test";
import { mapRentometerSummary } from "../../src/lib/rentometer/client.js";

test("maps mean to average_rent and quickview_url", () => {
  const sample = {
    mean: 1850,
    quickview_url: "https://www.rentometer.com/quickview/abc",
  };

  const result = mapRentometerSummary(sample, { retrievedAt: "2026-02-17T00:00:00Z" });

  assert.strictEqual(result.average_rent, 1850);
  assert.strictEqual(result.quickview_url, "https://www.rentometer.com/quickview/abc");
  assert.strictEqual(result.retrieved_at, "2026-02-17T00:00:00.000Z");
});

test("handles missing mean", () => {
  const sample = { quickview_url: "https://www.rentometer.com/quickview/abc" };
  const result = mapRentometerSummary(sample);

  assert.strictEqual(result.average_rent, null);
  assert.ok(result.notes.some((note) => note.toLowerCase().includes("mean")));
});
