import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCohort } from "./cohort-economics.mjs";

const cohort = {
  rawLeads: 100, validLeads: 80, contacted: 60, meetingsHeld: 30, policies: 12,
  premium17Dkk: 90000, premium20Dkk: 30000,
  clawbackPremium17Dkk: 10000, acquisitionSpendDkk: 4000,
  variableCostDkk: 600
};

test("matured cohort uses actual premium-weighted 17/20 seller pay and raw CPL", () => {
  const r = evaluateCohort({ ...cohort, sixMonthMatured: true });
  assert.equal(r.status, "matured_observed");
  assert.equal(r.partnerCommissionDkk, 30000);
  assert.equal(r.sellerCommissionDkk, 21300);
  assert.equal(r.premiumWeightedSellerRatePct, 17.75);
  assert.equal(r.observedNetClawbackDkk, 2500);
  assert.equal(r.futureRiskDkk, 0);
  assert.equal(r.marginBeforeAcquisitionDkk, 5600);
  assert.equal(r.contributionDkk, 1600);
  assert.ok(Math.abs(r.dbPerPolicyDkk - 1600 / 12) < 1e-9);
  assert.equal(r.rawCplDkk, 40);
  assert.equal(r.validCplDkk, 50);
  assert.ok(Math.abs(r.cacDkk - 4000 / 12) < 1e-9);
  assert.equal(r.validLeadRate, 0.8);
  assert.equal(r.rawLeadToPolicyRate, 0.12);
});

test("immature cohort keeps observed clawbacks and reserves risk only on remaining premium", () => {
  const r = evaluateCohort(cohort);
  assert.equal(r.status, "provisional_six_month_risk");
  assert.equal(r.observedNetClawbackDkk, 2500);
  assert.equal(r.futureRiskDkk, 1375);
  assert.equal(r.clawbackExposureDkk, 3875);
  assert.equal(r.contributionDkk, 225);
  assert.equal(r.maxRawCplAtTargetDkk, 0);
});

test("seller clawback recovery is opt-in, not presumed", () => {
  const r = evaluateCohort({ ...cohort, sellerRecovery: true });
  assert.ok(Math.abs(r.observedNetClawbackDkk - 800) < 1e-8);
  assert.ok(Math.abs(r.futureRiskDkk - 395) < 1e-8);
  assert.ok(Math.abs(r.clawbackExposureDkk - 1195) < 1e-8);
  assert.ok(Math.abs(r.contributionDkk - 2905) < 1e-8);
});

test("zero leads or policies never produce fake CPL or CAC", () => {
  const r = evaluateCohort({
    rawLeads: 0, validLeads: 0, contacted: 0, meetingsHeld: 0, policies: 0,
    premium17Dkk: 0, premium20Dkk: 0, acquisitionSpendDkk: 100
  });
  assert.equal(r.rawCplDkk, null);
  assert.equal(r.validCplDkk, null);
  assert.equal(r.cacDkk, null);
  assert.equal(r.dbPerPolicyDkk, null);
  assert.equal(r.contributionDkk, -100);
  assert.equal(r.premiumWeightedSellerRatePct, null);
});

test("rejects impossible funnels, negative values, invented premiums and over-clawback", () => {
  const bad = [
    { validLeads: 101 }, { contacted: 81 }, { meetingsHeld: 61 },
    { policies: 61 }, { policies: 0 }, { premium17Dkk: -1 },
    { premium20Dkk: Number.NaN }, { acquisitionSpendDkk: -1 },
    { partnerRatePct: 101 }, { expectedFutureClawbackRate: 1.1 },
    { clawbackPremium17Dkk: 100000 }, { sixMonthMatured: "yes" },
    { sellerRecovery: 1 }, { rawLeads: 1.5 }
  ];
  for (const change of bad) {
    assert.throws(() => evaluateCohort({ ...cohort, ...change }), /INVALID_COHORT_INPUT/,
      JSON.stringify(change));
  }
  assert.throws(() => evaluateCohort(null), /INVALID_COHORT_INPUT/);
});

test("organic leads can have zero spend but are not automatically launch-ready", () => {
  const r = evaluateCohort({ ...cohort, acquisitionSpendDkk: 0 });
  assert.equal(r.rawCplDkk, 0);
  assert.equal(r.status, "provisional_six_month_risk");
  assert.match(r.disclaimer, /No launch or spend authorization/);
});

test("clawback recovery cannot create artificial negative risk", () => {
  const r = evaluateCohort({ ...cohort, partnerRatePct: 10, sellerRecovery: true });
  assert.equal(r.observedNetClawbackDkk, 0);
  assert.equal(r.futureRiskDkk, 0);
  assert.ok(r.contributionDkk < 0);
});


test("funnel KPIs distinguish booked meetings, held meetings and sales", () => {
  const r = evaluateCohort(cohort);
  assert.ok(Math.abs(r.costPerHeldMeetingDkk - 4000 / 30) < 1e-9);
  assert.equal(r.meetingHeldRateAmongContacted, 0.5);
  assert.equal(r.policyRateAmongContacted, 0.2);
  assert.equal(r.policyRateAmongHeldMeetings, 0.4);
  const direct = evaluateCohort({ ...cohort, meetingsHeld: 0 });
  assert.equal(direct.costPerHeldMeetingDkk, null);
  assert.equal(direct.policyRateAmongHeldMeetings, null);
  assert.equal(direct.policyRateAmongContacted, 0.2);
});

test("optional booking KPIs distinguish scheduled from held meetings", () => {
  const r = evaluateCohort({ ...cohort, bookedMeetings: 40 });
  assert.equal(r.bookedMeetings, 40);
  assert.equal(r.costPerBookedMeetingDkk, 100);
  assert.equal(r.bookingRateAmongContacted, 40 / 60);
  assert.equal(r.meetingShowRate, 0.75);
  const legacy = evaluateCohort(cohort);
  assert.equal(legacy.bookedMeetings, null);
  assert.equal(legacy.meetingShowRate, null);
  const none = evaluateCohort({ ...cohort, bookedMeetings: 0, meetingsHeld: 0 });
  assert.equal(none.meetingShowRate, null);
  assert.equal(none.costPerBookedMeetingDkk, null);
  for (const bookedMeetings of [-1, 20, 61, 1.5, "40"]) {
    assert.throws(() => evaluateCohort({ ...cohort, bookedMeetings }), /INVALID_COHORT_INPUT/);
  }
});
