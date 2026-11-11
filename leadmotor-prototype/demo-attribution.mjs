// Strict, synthetic-only URL attribution for localhost demo. No cookies or PII.
const keys = ["utm_source", "utm_medium", "utm_campaign"];
const allowedMediums = new Set(["", "test", "organic", "direct", "referral"]);

export function parseDemoAttribution(search = "") {
  if (typeof search !== "string" || search.length > 1024) throw new Error("INVALID_QUERY");
  // URLSearchParams silently repairs malformed percent escapes; reject them before parsing.
  if (/%(?![0-9A-Fa-f]{2})/.test(search)) throw new Error("INVALID_QUERY_ENCODING");
  const params = new URLSearchParams(search);
  // Do not allow arbitrary query keys to become a covert PII/tracking channel.
  for (const key of params.keys()) {
    if (!keys.includes(key)) throw new Error("UNSUPPORTED_QUERY_KEY");
  }
  const utm = {};
  for (const key of keys) {
    const all = params.getAll(key);
    if (all.length > 1) throw new Error("DUPLICATE_UTM");
    const value = all[0] ?? "";
    if (value.length > 80 || (value && !/^[A-Za-z0-9._-]+$/.test(value))) {
      throw new Error("INVALID_UTM");
    }
    utm[key] = value;
  }
  const medium = utm.utm_medium.toLowerCase();
  if (!allowedMediums.has(medium)) throw new Error("UNSUPPORTED_DEMO_MEDIUM");
  const source = ["organic", "direct", "referral"].includes(medium) ? medium : "test";
  return { source, ...utm };
}
