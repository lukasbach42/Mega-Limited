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
