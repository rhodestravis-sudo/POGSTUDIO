import assert from "node:assert/strict";
import test from "node:test";

import {
  gtinCheckDigit,
  isValidGtin,
  lookupBarcodes,
} from "../app/lib/barcodes.ts";

test("normalizes a 10-digit retail UPC", () => {
  assert.deepEqual(lookupBarcodes({ upc: "2840031041" }), [
    "028400310413",
    "2840031041",
  ]);
});

test("normalizes a JDA EAN body into UPC-A and EAN-13", () => {
  assert.deepEqual(lookupBarcodes({ upc: "002840031041" }), [
    "028400310413",
    "2840031041",
    "0028400310413",
  ]);
});

test("removes PSA ID padding before searching for product images", () => {
  assert.deepEqual(lookupBarcodes({ upc: "00004300008217" }), [
    "043000082171",
    "4300008217",
    "00004300008217",
  ]);
});

test("keeps complete valid UPCs and converts leading-zero EANs", () => {
  assert.deepEqual(lookupBarcodes({ upc: "028400310413" }), [
    "028400310413",
  ]);
  assert.deepEqual(lookupBarcodes({ sku: "0028400310413" }), [
    "028400310413",
    "0028400310413",
  ]);
  assert.equal(gtinCheckDigit("002840031041"), "3");
  assert.equal(isValidGtin("028400310413"), true);
});
