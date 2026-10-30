import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createDemoCRM, calculateLeadEconomics } from "./demo-core.mjs";
import { createDemoServer } from "./demo-server.mjs";

function input(n = 1) {
  return {
    name: "Test Kunde" + n,
    phone: "0000000" + n,
    postcode: "0000",
    preferred_contact: "formiddag",
    consent: true,
    consent_text_version: "demo-v1",
    source: "organic",
    utm_source: "website",
    utm_medium: "organic",
    utm_campaign: "demo_october",
  };
}
function fixture() {
  let id = 0;
  return createDemoCRM({ now: () => "2026-10-28T08:00:00.000Z", makeId: () => "demo-" + ++id });
}

test("accepts synthetic-only lead and logs versioned consent + UTM", () => {
  const crm = fixture();
  const result = crm.submit(input());
  const lead = crm.getLead(result.leadId);
  assert.equal(result.duplicate, false);
  assert.equal(lead.events[0].type, "consent_recorded");
  assert.equal(lead.events[0].consentTextVersion, "demo-v1");
  assert.equal(lead.events[0].at, "2026-10-28T08:00:00.000Z");
  assert.equal(lead.utm.campaign, "demo_october");
});

test("rejects real-looking data, unknown fields, and absent consent", () => {
  const crm = fixture();
  assert.throws(() => crm.submit({ ...input(), name: "Actual Name" }), /SYNTHETIC_ONLY/);
  assert.throws(() => crm.submit({ ...input(), phone: "41293030" }), /SYNTHETIC_ONLY/);
  assert.throws(() => crm.submit({ ...input(), postcode: "9000" }), /SYNTHETIC_ONLY/);
  assert.throws(() => crm.submit({ ...input(), consent: false }), /CONSENT_REQUIRED/);
  assert.throws(() => crm.submit({ ...input(), email: "someone@example.com" }), /UNKNOWN_FIELD/);
  assert.throws(() => crm.submit({ ...input(), utm_campaign: "<script>" }), /INVALID_UTM/);
});

test("deduplicates synthetic phone and does not append consent events", () => {
  const crm = fixture();
  const first = crm.submit(input());
  const duplicate = crm.submit(input());
  assert.deepEqual(duplicate, { duplicate: true, leadId: first.leadId });
  assert.equal(crm.kpi().leads, 1);
  assert.equal(crm.getLead(first.leadId).events.length, 1);
});

test("booking reserves a demo slot and rejects double booking", () => {
  const crm = fixture();
  const a = crm.submit(input(1)).leadId;
  const b = crm.submit(input(2)).leadId;
  crm.book(a, "demo-slot-1");
  assert.equal(crm.availableSlots()[0].available, false);
  assert.throws(() => crm.book(b, "demo-slot-1"), /SLOT_TAKEN/);
  crm.recordEvent(a, "consent_withdrawn");
  assert.equal(crm.availableSlots()[0].available, true);
  assert.throws(() => crm.recordEvent(a, "contacted"), /CONSENT_WITHDRAWN/);
});

test("stage transitions and channel KPI count events, not current status", () => {
  const crm = fixture();
  const id = crm.submit(input()).leadId;
  assert.throws(() => crm.recordEvent(id, "policy_issued"), /INVALID_TRANSITION/);
  crm.book(id, "demo-slot-1");
  crm.recordEvent(id, "contacted");
  crm.recordEvent(id, "meeting_held");
  crm.recordEvent(id, "policy_issued");
  crm.recordEvent(id, "clawback");
  assert.equal(crm.kpi().policies, 1);
  assert.equal(crm.kpi().clawbacks, 1);
  assert.equal(crm.kpi().byChannel["organic/demo_october"].meetings, 1);
});

test("economics uses actual premium-weighted seller rate and conservative clawback", () => {
  const result = calculateLeadEconomics();
  assert.ok(Math.abs(result.sellerPay - 1771.26) < 1e-8);
  assert.equal(result.partnerCommission, 2500);
  assert.equal(result.expectedClawback, 125);
  assert.ok(Math.abs(result.breakEvenCpl - 76.07124) < 1e-8);
  assert.ok(Math.abs(result.dbPerPolicy - (603.74 - 100 / 0.126)) < 1e-8);
  const recoverable = calculateLeadEconomics({ sellerClawbackRecoverable: true });
  assert.ok(recoverable.expectedClawback < result.expectedClawback);
  assert.equal(calculateLeadEconomics({ contactRate: 0 }).dbPerPolicy, null);
  assert.throws(() => calculateLeadEconomics({ closeRate: 1.2 }), /INVALID_ECONOMICS_INPUT/);
});

test("raw-lead economics accounts for invalid leads without double-counting contact rate", () => {
  const baseline = calculateLeadEconomics();
  const reduced = calculateLeadEconomics({ validLeadRate: 2 / 3 });
  assert.ok(Math.abs(reduced.conversion - 0.084) < 1e-12);
  assert.ok(Math.abs(reduced.breakEvenCpl - baseline.breakEvenCpl * 2 / 3) < 1e-9);
  assert.ok(Math.abs(reduced.maxCplAtTarget - baseline.maxCplAtTarget * 2 / 3) < 1e-9);
  assert.equal(calculateLeadEconomics({ validLeadRate: 0 }).dbPerPolicy, null);
  assert.throws(() => calculateLeadEconomics({ validLeadRate: 1.01 }), /INVALID_ECONOMICS_INPUT/);
});

test("HTTP API enforces authentication, synthetic-only data, dedup and KPI", async () => {
  const token = "test-token-longer-than-24-chars";
  const server = createDemoServer({ token });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = "http://127.0.0.1:" + server.address().port;
  const request = (path, body, authorization = "Bearer " + token) => fetch(url + path, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  try {
    const unauthorized = await request("/api/leads", input(), "Bearer wrong");
    assert.equal(unauthorized.status, 401);
    const real = await request("/api/leads", { ...input(), phone: "41293030" });
    assert.equal(real.status, 422);
    const created = await request("/api/leads", input());
    assert.equal(created.status, 201);
    const lead = await created.json();
    const duplicate = await request("/api/leads", input());
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).leadId, lead.leadId);
    const kpi = await fetch(url + "/api/kpi", { headers: { Authorization: "Bearer " + token } });
    assert.equal(kpi.status, 200);
    assert.equal((await kpi.json()).leads, 1);
    const booked = await request("/api/leads/" + lead.leadId + "/booking", { slotId: "demo-slot-1" });
    assert.equal(booked.status, 200);
    const withdrawn = await request("/api/leads/" + lead.leadId + "/events", { type: "consent_withdrawn" });
    assert.equal(withdrawn.status, 200);
    const blocked = await request("/api/leads/" + lead.leadId + "/events", { type: "contacted" });
    assert.equal(blocked.status, 422);
  } finally {
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
