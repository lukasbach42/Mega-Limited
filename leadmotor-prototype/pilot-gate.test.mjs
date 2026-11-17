import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAggregatePilot, wilsonLowerBound } from "./pilot-gate.mjs";

const sample = { rawLeads: 200, validLeads: 150, contacted: 100, policies: 20, spendDkk: 7000 };

test("validity, contact and close rates have distinct denominators", () => {
  const r = evaluateAggregatePilot(sample);
  assert.equal(r.validRate, .75);
  assert.equal(r.contactRateAmongValid, 2/3);
  assert.equal(r.closeRateAmongContacted, .2);
  assert.equal(r.rawLeadToPolicy, .1);
  assert.equal(r.rawCpl, 35);
  assert.ok(Math.abs(r.validCpl - 7000/150) < 1e-9);
  assert.equal(r.cac, 350);
  assert.equal(r.status, "review_before_scaling"); // 500 DKK target + uncertainty.
});

test("pilot with losing contribution stops regardless of sample size", () => {
  const r = evaluateAggregatePilot({ ...sample, rawLeads: 50, validLeads: 40, contacted: 30, policies: 5, spendDkk: 10000 });
  assert.equal(r.status, "stop_negative_contribution");
  assert.ok(r.dbPerPolicy < 0);
});

test("low sample cannot automatically qualify and good sample still needs manual review", () => {
  const low = evaluateAggregatePilot({ rawLeads: 20, validLeads: 18, contacted: 15, policies: 8, spendDkk: 100 });
  assert.equal(low.status, "insufficient_sample");
  const good = evaluateAggregatePilot({ ...sample, spendDkk: 100 });
  assert.equal(good.status, "eligible_for_manual_review");
});

test("reject inconsistent counts, unsafe economics and invalid Wilson parameters", () => {
  assert.throws(() => evaluateAggregatePilot({ ...sample, contacted: 160 }), /INVALID_PILOT_COUNTS/);
  assert.throws(() => evaluateAggregatePilot({ ...sample, spendDkk: -1 }), /INVALID_PILOT_COUNTS/);
  assert.throws(() => evaluateAggregatePilot({ ...sample, economics: { partnerRate: 101 } }), /INVALID_ECONOMICS_INPUT/);
  assert.throws(() => wilsonLowerBound(3, 2), /INVALID_SAMPLE/);
  assert.equal(wilsonLowerBound(0, 0), 0);
  assert.ok(wilsonLowerBound(20, 200) < .1);
});
