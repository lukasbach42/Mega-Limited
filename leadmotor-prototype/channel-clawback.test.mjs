import test from "node:test";
import assert from "node:assert/strict";
import { evaluateChannels } from "./channel-attribution.mjs";

const cohort = (source, matured) => ({
  source, medium: "organic", campaign: "synthetic",
  rawLeads: 10, validLeads: 10, contacted: 5, meetingsHeld: 0,
  policies: 1, premium17Dkk: 10000, premium20Dkk: 0,
  acquisitionSpendDkk: 100, partnerRatePct: 25,
  expectedFutureClawbackRate: 0.1, sixMonthMatured: matured
});

test("mixed six-month maturity remains provisional and exposes future risk", () => {
  const report = evaluateChannels([cohort("referral", true), cohort("google", false)]);
  assert.equal(report.totals.maturityStatus, "provisional_six_month_risk");
  assert.equal(report.totals.futureRiskDkk, 80);
  assert.equal(report.totals.clawbackExposureDkk, 80);
  assert.equal(report.totals.rawCplDkk, 10);
  assert.equal(report.totals.contributionDkk, 1600 - 80 - 200);
});

test("all matured cohorts have no modeled future six-month risk", () => {
  const report = evaluateChannels([cohort("referral", true), cohort("google", true)]);
  assert.equal(report.totals.maturityStatus, "matured_observed");
  assert.equal(report.totals.futureRiskDkk, 0);
  assert.equal(report.totals.clawbackExposureDkk, 0);
});
