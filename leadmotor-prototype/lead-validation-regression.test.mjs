// Regression tests for the internal, side-effect-free validator.
// Synthetic data only. These tests do not certify GDPR compliance or production readiness.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, validateLead } from "./lead-validation.mjs";

const now = new Date("2026-11-10T08:00:00Z");
const valid = Object.freeze({
  name: " Test Kunde ", phone: "+45 12 34 56 78", postcode: "9000",
  consent: true, consent_text_version: "v1",
  consent_at: "2026-11-10T07:59:00Z", source: "organic"
});

test("rejects malformed and international non-DK telephone inputs", () => {
  for (const phone of ["+46 12345678", "1234567", "123456789", "abcdefgh", "", null, 12345678]) {
    assert.equal(normalizePhone(phone), null);
  }
});
test("rejects invalid postcode and missing postcode", () => {
  for (const postcode of ["900", "90000", "9O00", 9000, null]) {
    assert.ok(validateLead({...valid, postcode}, now).errors.includes("invalid_postcode"));
  }
});
test("rejects invalid or absent consent text version", () => {
  for (const consent_text_version of ["", "version with spaces", "<script>", null]) {
    assert.ok(validateLead({...valid, consent_text_version}, now).errors.includes("invalid_consent_version"));
  }
});
test("rejects invalid timestamp formats and nonexistent dates", () => {
  for (const consent_at of ["2026-11-10", "not-a-date", "", null, "2026-11-10T08:00:00"]) {
    assert.ok(validateLead({...valid, consent_at}, now).errors.includes("invalid_consent_timestamp"));
  }
});
test("rejects non-whitelisted sensitive fields and oversized attribution", () => {
  assert.ok(validateLead({...valid, diagnosis: "synthetic"}, now).errors.includes("unexpected_field:diagnosis"));
  assert.ok(validateLead({...valid, utm_campaign: "x".repeat(121)}, now).errors.includes("invalid_utm_campaign"));
});
test("rejects malformed payload shapes", () => {
  for (const payload of [null, undefined, [], "text", 3]) {
    assert.equal(validateLead(payload, now).ok, false);
  }
});
test("does not mutate caller's input", () => {
  const input = {...valid};
  const before = structuredClone(input);
  const result = validateLead(input, now);
  assert.equal(result.ok, true);
  assert.deepEqual(input, before);
});
