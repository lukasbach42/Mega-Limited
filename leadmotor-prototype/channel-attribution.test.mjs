import test from "node:test";
import assert from "node:assert/strict";
import { evaluateChannels } from "./channel-attribution.mjs";

const row = (source, medium, campaign, acquisitionSpendDkk, rawLeads) => ({
  source, medium, campaign, rawLeads, validLeads: rawLeads,
  contacted: rawLeads, meetingsHeld: 0, policies: 0,
  premium17Dkk: 0, premium20Dkk: 0, acquisitionSpendDkk
});

test("paid and organic sources are reported separately with weighted total CPL", () => {
  const report = evaluateChannels([
    row("google", "cpc", "search_test", 600, 20),
    row("referral", "organic", "partnerneutral", 0, 10)
  ]);
  assert.equal(report.channels.length, 2);
  assert.equal(report.channels[0].rawCplDkk, 30);
  assert.equal(report.channels[1].rawCplDkk, 0);
  assert.equal(report.totals.rawCplDkk, 20);
  assert.equal(report.totals.contributionDkk, -600);
});

test("missing attribution, duplicate groups and PII-like keys are rejected", () => {
  const a = row("unknown", "unknown", "unknown", 0, 0);
  assert.equal(evaluateChannels([a]).totals.rawCplDkk, null);
  for (const rows of [[], [a, a], [{ ...a, source: "john@example.com" }],
    [{ ...a, campaign: "hello world" }], [{ ...a, medium: null }]]) {
    assert.throws(() => evaluateChannels(rows), /INVALID_CHANNEL_COHORT/);
  }
});

test("invalid funnel data is not masked by aggregation", () => {
  assert.throws(() => evaluateChannels([
    { ...row("direct", "none", "site", 0, 1), validLeads: 2 }
  ]), /INVALID_COHORT_INPUT/);
});

test("booking totals use weighted counts rather than averaging channel rates", () => {
  const google = { ...row("google", "cpc", "booking", 120, 10),
    bookedMeetings: 4, meetingsHeld: 3 };
  const referral = { ...row("referral", "organic", "booking", 0, 20),
    bookedMeetings: 2, meetingsHeld: 1 };
  const { totals } = evaluateChannels([google, referral]);
  assert.equal(totals.contacted, 30);
  assert.equal(totals.bookedMeetings, 6);
  assert.equal(totals.meetingsHeld, 4);
  assert.equal(totals.bookingRateAmongContacted, 6 / 30);
  assert.equal(totals.meetingShowRate, 4 / 6);
  assert.equal(totals.costPerBookedMeetingDkk, 20);
  assert.equal(totals.costPerHeldMeetingDkk, 30);
});

test("partially missing booking data stays unknown across channels", () => {
  const known = { ...row("direct", "none", "site", 0, 2),
    bookedMeetings: 1, meetingsHeld: 1 };
  const unknown = row("referral", "organic", "site", 0, 3);
  const { totals } = evaluateChannels([known, unknown]);
  assert.equal(totals.bookedMeetings, null);
  assert.equal(totals.bookingRateAmongContacted, null);
  assert.equal(totals.meetingShowRate, null);
  assert.equal(totals.costPerBookedMeetingDkk, null);
  assert.equal(totals.costPerHeldMeetingDkk, 0);
});

test("cross-channel conversion rates are weighted by underlying funnel counts", () => {
  const google = { ...row("google", "cpc", "funnel", 300, 100),
    validLeads: 80, contacted: 40, meetingsHeld: 10, policies: 4,
    premium17Dkk: 40000 };
  const referral = { ...row("referral", "organic", "funnel", 0, 10),
    validLeads: 10, contacted: 10, meetingsHeld: 0, policies: 1,
    premium20Dkk: 10000 };
  const { totals } = evaluateChannels([google, referral]);
  assert.equal(totals.validLeadRate, 90 / 110);
  assert.equal(totals.contactRateAmongValid, 50 / 90);
  assert.equal(totals.meetingHeldRateAmongContacted, 10 / 50);
  assert.equal(totals.policyRateAmongContacted, 5 / 50);
  assert.equal(totals.policyRateAmongHeldMeetings, 5 / 10);
  assert.equal(totals.rawLeadToPolicyRate, 5 / 110);
});

test("zero denominators remain unknown and direct phone sales need no meetings", () => {
  const empty = evaluateChannels([row("unknown", "none", "empty", 0, 0)]).totals;
  for (const key of ["validLeadRate", "contactRateAmongValid",
    "meetingHeldRateAmongContacted", "policyRateAmongContacted",
    "policyRateAmongHeldMeetings", "rawLeadToPolicyRate"]) {
    assert.equal(empty[key], null);
  }
  const phone = evaluateChannels([{ ...row("direct", "phone", "test", 0, 2),
    policies: 1, premium17Dkk: 10000 }]).totals;
  assert.equal(phone.policyRateAmongContacted, 0.5);
  assert.equal(phone.policyRateAmongHeldMeetings, null);
});

test("aggregate count overflow is rejected instead of producing rounded KPI denominators", () => {
  const huge = { ...row("direct", "none", "large", 0, Number.MAX_SAFE_INTEGER) };
  const one = row("referral", "organic", "one", 0, 1);
  assert.throws(() => evaluateChannels([huge, one]), /INVALID_CHANNEL_COHORT/);
});

test("aggregate booking count overflow is rejected even if each cohort is valid", () => {
  const huge = { ...row("direct", "none", "large_booking", 0, Number.MAX_SAFE_INTEGER),
    bookedMeetings: Number.MAX_SAFE_INTEGER };
  const one = { ...row("referral", "organic", "one_booking", 0, 1),
    bookedMeetings: 1 };
  assert.throws(() => evaluateChannels([huge, one]), /INVALID_CHANNEL_COHORT/);
});


test("booking completeness is explicit for mixed known and unknown channel counts", () => {
  const known = { ...row("google", "cpc", "synthetic_coverage", 200, 10), bookedMeetings: 2 };
  const unknown = row("referral", "organic", "synthetic_coverage", 0, 5);
  const partial = evaluateChannels([known, unknown]).totals;
  assert.equal(partial.bookingReportedChannels, 1);
  assert.equal(partial.bookingTotalChannels, 2);
  assert.equal(partial.bookingCoverageComplete, false);
  assert.equal(partial.bookedMeetings, null);
  assert.equal(partial.costPerBookedMeetingDkk, null);
  const complete = evaluateChannels([known, { ...unknown, bookedMeetings: 0 }]).totals;
  assert.equal(complete.bookingReportedChannels, 2);
  assert.equal(complete.bookingCoverageComplete, true);
  assert.equal(complete.bookedMeetings, 2);
  assert.equal(complete.costPerBookedMeetingDkk, 100);
});
