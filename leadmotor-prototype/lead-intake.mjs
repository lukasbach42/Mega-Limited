// Synthetic-data-only prototype. No database, network or external side effects.
// This does NOT establish lawful marketing consent or production readiness.
import { createHmac } from "node:crypto";
import { validateLead } from "./lead-validation.mjs";

// HMAC prevents offline phone-number enumeration without the server-held secret.
// Never log fingerprints or raw phones. Production also needs secret rotation,
// a durable atomic unique index, scoped dedupe windows and a retention policy.
export function fingerprintLead(phone, secret) {
  if (typeof secret !== "string" || secret.length < 32) throw new Error("missing_strong_secret");
  if (typeof phone !== "string" || !/^\+45\d{8}$/.test(phone)) throw new Error("invalid_normalized_phone");
  return createHmac("sha256", secret).update("mega-lead-dedupe:v1:" + phone).digest("hex");
}

export function prepareLeadForQueue(payload, { now = new Date(), secret, seen = new Set() } = {}) {
  const result = validateLead(payload, now);
  if (!result.ok) return { ok: false, errors: result.errors };
  const key = fingerprintLead(result.value.phone, secret);
  if (seen.has(key)) return { ok: false, errors: ["duplicate_lead"] };
  // The caller must persist lead + consent evidence atomically before acknowledging.
  // Deliberately do not mutate seen: this function is pure with respect to its inputs.
  return { ok: true, duplicate_key: key, lead: result.value };
}
