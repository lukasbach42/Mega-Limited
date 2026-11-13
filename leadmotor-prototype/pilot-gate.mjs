// Mega: aggregate-only pilot evaluation. No personal data, no automatic spend decisions.
import { calculateLeadEconomics } from "./demo-core.mjs";

// One-sided 95% Wilson lower bound; protects against scaling a lucky small sample.
export function wilsonLowerBound(successes, trials, z = 1.645) {
  if (!Number.isInteger(successes) || !Number.isInteger(trials) || trials < 0 ||
      successes < 0 || successes > trials || !Number.isFinite(z) || z <= 0) {
    throw new RangeError("INVALID_SAMPLE");
  }
  if (trials === 0) return 0;
  const p = successes / trials;
  const z2 = z * z;
  return Math.max(0, (p + z2 / (2 * trials) -
    z * Math.sqrt(p * (1 - p) / trials + z2 / (4 * trials * trials))) /
    (1 + z2 / trials));
}

export function evaluateAggregatePilot({
  rawLeads, validLeads, contacted, policies, spendDkk,
  economics = {}, minRawLeads = 100, minPolicies = 10
}) {
  const counts = [rawLeads, validLeads, contacted, policies, minRawLeads, minPolicies];
  if (counts.some(x => !Number.isSafeInteger(x) || x < 0) ||
      validLeads > rawLeads || contacted > validLeads || policies > contacted ||
      !Number.isFinite(spendDkk) || spendDkk < 0) {
    throw new RangeError("INVALID_PILOT_COUNTS");
  }
  // Economics per issued policy is independent of conversion; conversion comes from actual counts.
  const perPolicy = calculateLeadEconomics({
    ...economics, validLeadRate: 1, contactRate: 1, closeRate: 1, cpl: 0
  });
  const margin = perPolicy.marginBeforeLeads;
  const target = economics.targetDb ?? 500;
  const safeDiv = (a, b) => b ? a / b : null;
  const conversion = safeDiv(policies, rawLeads);
  const lowerBound = wilsonLowerBound(policies, rawLeads);
  const rawCpl = safeDiv(spendDkk, rawLeads);
  const validCpl = safeDiv(spendDkk, validLeads);
  const cac = safeDiv(spendDkk, policies);
  const netContribution = policies * margin - spendDkk;
  const dbPerPolicy = safeDiv(netContribution, policies);
  const breakEvenRawCpl = margin > 0 && conversion !== null ? margin * conversion : 0;
  const conservativeRawCplAtTarget = Math.max(0, margin - target) * lowerBound;
  let status;
  if (policies > 0 && netContribution < 0) status = "stop_negative_contribution";
  else if (rawLeads < minRawLeads || policies < minPolicies) status = "insufficient_sample";
  else if (rawCpl > conservativeRawCplAtTarget) status = "review_before_scaling";
  else status = "eligible_for_manual_review";
  return {
    status, rawLeads, validLeads, contacted, policies, spendDkk,
    validRate: safeDiv(validLeads, rawLeads),
    contactRateAmongValid: safeDiv(contacted, validLeads),
    closeRateAmongContacted: safeDiv(policies, contacted),
    rawLeadToPolicy: conversion, conservativeConversionLowerBound: lowerBound,
    rawCpl, validCpl, cac, marginBeforeLeadsPerPolicy: margin,
    expectedNetContributionDkk: netContribution, dbPerPolicy,
    observedBreakEvenRawCpl: breakEvenRawCpl, conservativeRawCplAtTarget,
    disclaimer: "Aggregate scenario gate only. No automatic launch approval; clawback and partner economics remain assumptions."
  };
}
