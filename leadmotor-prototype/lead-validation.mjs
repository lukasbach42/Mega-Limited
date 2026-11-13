// Mega internal prototype: pure validation only. No network, persistence or PII logging.
// Not a legal determination of marketing consent or a production endpoint.
export function normalizePhone(value) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[\s()-]/g, "");
  if (/^\d{8}$/.test(digits)) return "+45" + digits;
  if (/^\+45\d{8}$/.test(digits)) return digits;
  if (/^0045\d{8}$/.test(digits)) return "+" + digits.slice(2);
  return null;
}

export function validateLead(input, now = new Date()) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["invalid_payload"] };
  }
  const allowed = new Set(["name","phone","postcode","preferred_contact","consent","consent_text_version","consent_at","source","utm_source","utm_campaign"]);
  for (const key of Object.keys(input)) if (!allowed.has(key)) errors.push("unexpected_field:" + key);
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g," ") : "";
  if (name.length < 2 || name.length > 120) errors.push("invalid_name");
  const phone = normalizePhone(input.phone);
  if (!phone) errors.push("invalid_phone");
  if (typeof input.postcode !== "string" || !/^\d{4}$/.test(input.postcode)) errors.push("invalid_postcode");
  if (input.preferred_contact !== undefined && !["formiddag","eftermiddag"].includes(input.preferred_contact)) errors.push("invalid_preferred_contact");
  if (input.consent !== true) errors.push("consent_not_recorded");
  if (typeof input.consent_text_version !== "string" || !/^[A-Za-z0-9._-]{1,80}$/.test(input.consent_text_version)) errors.push("invalid_consent_version");
  const at = typeof input.consent_at === "string" ? new Date(input.consent_at) : new Date(NaN);
  if (!Number.isFinite(at.getTime()) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(input.consent_at ?? "")) errors.push("invalid_consent_timestamp");
  else if (at.getTime() > now.getTime() + 5 * 60_000) errors.push("future_consent_timestamp");
  for (const field of ["source","utm_source","utm_campaign"]) {
    const v = input[field];
    if ((field === "source" && (typeof v !== "string" || !v.trim())) || (v !== undefined && (typeof v !== "string" || v.length > 120))) errors.push("invalid_" + field);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { name, phone, postcode: input.postcode, preferred_contact: input.preferred_contact ?? null, consent: true, consent_text_version: input.consent_text_version, consent_at: at.toISOString(), source: input.source.trim(), utm_source: input.utm_source ?? null, utm_campaign: input.utm_campaign ?? null } };
}
