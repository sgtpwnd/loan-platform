import assert from "node:assert";
import { test } from "node:test";
import { getSubjectProperty, getSubjectPropertyAVM } from "../../src/lib/attom/client.js";

const originalFetch = global.fetch;
const originalApiKey = process.env.ATTOM_API_KEY;
process.env.ATTOM_API_KEY = process.env.ATTOM_API_KEY || "test-attom-key";

test("maps detailowner fields to subject property response", async () => {
  const sample = {
    property: [
      {
        assessment: { assessed: { assdTtlValue: 325000 } },
        owner: { owner1: { fullname: "Jane Doe" } },
        sale: { amount: { saleAmt: 275000 }, saleTransDate: "2024-01-15" },
        address: { line1: "123 MAIN ST", locality: "AUSTIN", countrySubd: "TX", postal1: "78701" },
      },
    ],
  };

  global.fetch = async (url, options) => {
    assert.ok(options.headers.APIKey, "API key header should be set");
    return new Response(JSON.stringify(sample), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await getSubjectProperty("123 MAIN ST", "Austin", "TX", "78701");
  assert.strictEqual(result.assessor_total_market_value, 325000);
  assert.strictEqual(result.owner_name, "Jane Doe");
  assert.strictEqual(result.last_sale_price, 275000);
  assert.strictEqual(result.last_sale_date, "2024-01-15");
  assert.strictEqual(result.needs_review, false);
});

test("handles AVM unavailable gracefully", async () => {
  global.fetch = async () => new Response("Forbidden", { status: 403 });
  const result = await getSubjectPropertyAVM("123 MAIN ST", "Austin", "TX", "78701");
  assert.strictEqual(result.avm_value, null);
  assert.ok(result.notes[0].includes("AVM endpoint"));
});

test("formats sale dates to YYYY-MM-DD", async () => {
  const sample = {
    property: [
      {
        assessment: { assessed: { assdTtlValue: 500000 } },
        owner: { owner1: { firstnameandmi: "John", lastname: "Smith" } },
        sale: { amount: { saleAmt: 300000 }, saleSearchDate: "2023/06/30" },
        address: { line1: "936 BROWNLEE RD", locality: "MEMPHIS", countrySubd: "TN", postal1: "38116" },
      },
    ],
  };
  global.fetch = async () => new Response(JSON.stringify(sample), { status: 200 });
  const result = await getSubjectProperty("936 Brownlee Rd", "Memphis", "TN", "38116");
  assert.strictEqual(result.last_sale_date, "2023-06-30");
  assert.strictEqual(result.address_matched, true);
});

test.after(() => {
  global.fetch = originalFetch;
  process.env.ATTOM_API_KEY = originalApiKey;
});
