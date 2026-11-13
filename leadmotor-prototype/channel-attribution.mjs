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
  const total = key => channels.reduce((sum, row) => sum + row[key], 0);
  const rawLeads = total("rawLeads"), validLeads = total("validLeads");
  const policies = total("policies"), spend = total("acquisitionSpendDkk");
  const contribution = total("contributionDkk");
  return {
    channels,
    totals: {
      rawLeads, validLeads, policies,
      acquisitionSpendDkk: spend, contributionDkk: contribution,
      rawCplDkk: rawLeads ? spend / rawLeads : null,
      validCplDkk: validLeads ? spend / validLeads : null,
      cacDkk: policies ? spend / policies : null
    },
    disclaimer: "Synthetic disjoint cohorts only; no ad spend or launch authorization."
  };
}
