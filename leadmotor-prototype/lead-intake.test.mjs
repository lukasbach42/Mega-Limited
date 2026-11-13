import test from "node:test";
import assert from "node:assert/strict";
import { fingerprintLead, prepareLeadForQueue } from "./lead-intake.mjs";
const secret = "synthetic-secret-for-unit-testing-only-1234567890";
const now = new Date("2026-11-11T08:00:00Z");
const lead = { name:"Test Kunde",phone:"12 34 56 78",postcode:"9000",consent:true,consent_text_version:"v1",consent_at:"2026-11-11T07:59:00Z",source:"organic" };
test("valid lead prepares normalized queue payload",()=>{ const r=prepareLeadForQueue(lead,{now,secret}); assert.equal(r.ok,true); assert.equal(r.lead.phone,"+4512345678"); assert.equal(r.duplicate_key.length,64); });
test("same normalized number has same fingerprint",()=>assert.equal(fingerprintLead("+4512345678",secret),fingerprintLead("+4512345678",secret)));
test("rejects previously seen number without leaking phone",()=>{const key=fingerprintLead("+4512345678",secret);const r=prepareLeadForQueue(lead,{now,secret,seen:new Set([key])});assert.deepEqual(r,{ok:false,errors:["duplicate_lead"]});});
test("rejects invalid consent before fingerprint",()=>assert.ok(prepareLeadForQueue({...lead,consent:false},{now,secret}).errors.includes("consent_not_recorded")));
test("requires a strong secret",()=>assert.throws(()=>fingerprintLead("+4512345678","weak"),/missing_strong_secret/));
test("does not mutate seen set",()=>{const seen=new Set();prepareLeadForQueue(lead,{now,secret,seen});assert.equal(seen.size,0);});

test("different secrets produce different keyed fingerprints",()=>{
  assert.notEqual(fingerprintLead("+4512345678",secret),fingerprintLead("+4512345678","another-synthetic-secret-for-testing-123456789"));
});
test("fingerprint is HMAC-SHA256 with explicit domain separation",async()=>{
  const {createHmac}=await import("node:crypto");
  const expected=createHmac("sha256",secret).update("mega-lead-dedupe:v1:+4512345678").digest("hex");
  assert.equal(fingerprintLead("+4512345678",secret),expected);
});
test("rejects unnormalized input before fingerprint",()=>{
  assert.throws(()=>fingerprintLead("12345678",secret),/invalid_normalized_phone/);
});
