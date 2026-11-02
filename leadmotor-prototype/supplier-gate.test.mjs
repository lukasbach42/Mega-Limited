import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSupplier, REQUIRED_EVIDENCE } from './supplier-gate.mjs';
const evidence = Object.fromEntries(REQUIRED_EVIDENCE.map(k => [k, 'verified']));
const economics = { annualPremium:10000, partnerRate:25, sellerRate:17.7126,
  contactRate:0.6, closeRate:0.21, clawbackProbability:0.05, targetDb:500 };
const base = { evidence, priceBasis:'raw', unitPriceDkk:10, validLeadRate:1, economics };
test('documented, affordable sample is only eligible for manual review', () => {
  const r = auditSupplier(base);
  assert.equal(r.status, 'manual_pilot_review_only');
  assert.ok(Math.abs(r.breakEvenRawCplDkk-76.07124)<0.01);
  assert.ok(Math.abs(r.maxRawCplAtTargetDkk-13.07124)<0.01);
  assert.equal(r.rawEquivalentCplDkk,10);
});
test('vendor website alone does not count as verified evidence', () => {
  const r=auditSupplier({...base,evidence:{...evidence,consentJourney:'missing'}});
  assert.equal(r.status,'evidence_missing');
  assert.deepEqual(r.missing,['consentJourney']);
});
test('documented failure overrides favorable price', () => {
  const r=auditSupplier({...base,evidence:{...evidence,lawfulTelephoneContact:'failed'},unitPriceDkk:0});
  assert.equal(r.status,'reject_documented_failure');
});
test('valid-lead pricing uses valid rate, not raw-lead price', () => {
  const r=auditSupplier({...base,priceBasis:'valid',unitPriceDkk:20,validLeadRate:0.5});
  assert.equal(r.rawEquivalentCplDkk,10);
  assert.ok(r.maxRawCplAtTargetDkk<7);
  assert.equal(r.status,'below_target_db');
});
test('90 DKK raw lead is unprofitable in historical scenario', () => {
  const r=auditSupplier({...base,unitPriceDkk:90});
  assert.equal(r.status,'reject_negative_economics');
  assert.ok(r.dbPerPolicyDkk<0);
});
test('no price quote or observed valid rate means no approval', () => {
  assert.equal(auditSupplier({...base,unitPriceDkk:null}).status,'evidence_missing');
  assert.equal(auditSupplier({...base,validLeadRate:null}).status,'evidence_missing');
});
test('malformed evidence and nonsensical numbers rejected', () => {
  for (const x of [
    {...base,evidence:{...evidence,unknown:'verified'}},
    {...base,evidence:{...evidence,cvrRegistry:'claimed'}},
    {...base,unitPriceDkk:-1},
    {...base,validLeadRate:1.1},
    {...base,economics:{...economics,partnerRate:110}},
    {...base,economics:{...economics,closeRate:NaN}}
  ]) assert.throws(()=>auditSupplier(x),/INVALID_SUPPLIER_AUDIT/);
});
