// Synthetic aggregate channel reporting; never store lead identifiers or personal data.
import { evaluateCohort } from "./cohort-economics.mjs";

const safeKey = value => typeof value === "string" &&
  /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value);
const invalid = () => { throw new RangeError("INVALID_CHANNEL_COHORT"); };

// Each row is a disjoint cohort, grouped by UTM source/medium/campaign.
// A missing source must be explicit "unknown"; never silently attribute it to paid Meta.
export function evaluateChannels(rows) {
  if (!Array.isArray(rows) || rows.length === 0) invalid();
  const seen = new Set();
  const channels = rows.map(row => {
    if (!row || typeof row !== "object" || Array.isArray(row)) invalid();
    const { source, medium, campaign, ...metrics } = row;
    if (![source, medium, campaign].every(safeKey)) invalid();
    const key = JSON.stringify([source, medium, campaign]);
    if (seen.has(key)) invalid();
    seen.add(key);
    const result = evaluateCohort(metrics);
    return { source, medium, campaign, ...result };
  });
  // Per-cohort counts are safe integers, but their sum may overflow JS safe-integer precision.
  // Reject misleading aggregate KPIs rather than silently rounding lead counts.
  const countKeys = ["rawLeads", "validLeads", "contacted", "meetingsHeld", "policies"];
  const total = key => {
    const sum = channels.reduce((acc, row) => acc + row[key], 0);
    if (!Number.isFinite(sum) || (countKeys.includes(key) && !Number.isSafeInteger(sum))) invalid();
    return sum;
  };
  const rawLeads = total("rawLeads"), validLeads = total("validLeads");
  const policies = total("policies"), spend = total("acquisitionSpendDkk");
  const contribution = total("contributionDkk");
  const contacted = total("contacted"), meetingsHeld = total("meetingsHeld");
  // Unknown booking counts cannot be treated as zero.
  const bookedMeetings = channels.every(row => row.bookedMeetings !== null)
    ? total("bookedMeetings") : null;
  if (bookedMeetings !== null && !Number.isSafeInteger(bookedMeetings)) invalid();
  const ratio = (a, b) => b ? a / b : null;
  return {
    channels,
    totals: {
      rawLeads, validLeads, contacted, bookedMeetings, meetingsHeld, policies,
      validLeadRate: ratio(validLeads, rawLeads),
      contactRateAmongValid: ratio(contacted, validLeads),
      meetingHeldRateAmongContacted: ratio(meetingsHeld, contacted),
      policyRateAmongContacted: ratio(policies, contacted),
      policyRateAmongHeldMeetings: ratio(policies, meetingsHeld),
      rawLeadToPolicyRate: ratio(policies, rawLeads),
      bookingRateAmongContacted: bookedMeetings === null ? null : ratio(bookedMeetings, contacted),
      meetingShowRate: bookedMeetings === null ? null : ratio(meetingsHeld, bookedMeetings),
      costPerBookedMeetingDkk: bookedMeetings === null ? null : ratio(spend, bookedMeetings),
      costPerHeldMeetingDkk: ratio(spend, meetingsHeld),
      acquisitionSpendDkk: spend, contributionDkk: contribution,
      rawCplDkk: rawLeads ? spend / rawLeads : null,
      validCplDkk: validLeads ? spend / validLeads : null,
      cacDkk: policies ? spend / policies : null
    },
    disclaimer: "Synthetic disjoint cohorts only; no ad spend or launch authorization."
  };
}
