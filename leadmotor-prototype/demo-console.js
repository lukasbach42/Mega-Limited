// Same-origin localhost synthetic demo UI. No PII and no browser persistence.
import { parseDemoAttribution } from "./demo-attribution.mjs";
const el = id => document.getElementById(id);
let leadId = null;
const show = value => { el("output").textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2); };
async function call(path, method = "GET", data) {
  const token = el("token").value.trim();
  if (token.length < 24) throw new Error("Indsæt API-token fra den lokale terminal.");
  const headers = { Authorization: "Bearer " + token };
  if (data !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(path, { method, headers, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "HTTP " + response.status);
  return result;
}
function action(fn) {
  return async () => {
    try { show(await fn()); }
    catch (error) { show("Fejl: " + error.message); }
  };
}
el("attribution").textContent = "Testkilde læses fra URL-parametre: utm_source, utm_medium og utm_campaign. Kun test/organic/direct/referral.";
el("submit").addEventListener("click", action(async () => {
  const n = Number(el("testno").value);
  if (!Number.isSafeInteger(n) || n < 1 || n > 9999) throw new Error("Testnummer skal være 1–9999.");
  const result = await call("/api/leads", "POST", {
    name: "Test Kunde" + n, phone: "0000" + String(n).padStart(4, "0"),
    postcode: "0000", preferred_contact: "formiddag", consent: true,
    consent_text_version: "demo-v1",
    ...parseDemoAttribution(window.location.search)
  });
  leadId = result.leadId;
  el("current").textContent = "Aktivt testlead: " + leadId;
  return result;
}));
el("slots").addEventListener("click", action(() => call("/api/slots")));
el("book").addEventListener("click", action(() => {
  if (!leadId) throw new Error("Opret et testlead først.");
  return call("/api/leads/" + encodeURIComponent(leadId) + "/booking", "POST", { slotId: el("slot").value });
}));
el("record").addEventListener("click", action(() => {
  if (!leadId) throw new Error("Opret et testlead først.");
  return call("/api/leads/" + encodeURIComponent(leadId) + "/events", "POST", { type: el("event").value });
}));
el("kpi").addEventListener("click", action(() => call("/api/kpi")));
