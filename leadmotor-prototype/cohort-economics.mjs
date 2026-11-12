// Aggregate-only Mega cohort economics. NO customer records or automatic spend decisions.
// Rates 17/20 are percentages of annual premium; 25% is a historical partner scenario.
const divide = (a, b) => b === 0 ? null : a / b;
const money = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
const count = value => Number.isSafeInteger(value) && value >= 0;
const invalid = () => { throw new RangeError("INVALID_COHORT_INPUT"); };

export function evaluateCohort(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid();
  const {
    rawLeads, validLeads, contacted, meetingsHeld, policies,
    bookedMeetings = null,
    premium17Dkk, premium20Dkk, acquisitionSpendDkk,
    clawbackPremium17Dkk = 0, clawbackPremium20Dkk = 0,
    variableCostDkk = 0, partnerRatePct = 25,
    expectedFutureClawbackRate = 0.05, sellerRecovery = false,
    sixMonthMatured = false, targetDbPerPolicyDkk = 500
  } = input;
  if (![rawLeads, validLeads, contacted, meetingsHeld, policies].every(count) ||
      validLeads > rawLeads || contacted > validLeads ||
      meetingsHeld > contacted || policies > contacted ||
      (bookedMeetings !== null && (!count(bookedMeetings) ||
        bookedMeetings < meetingsHeld || bookedMeetings > contacted))) invalid();
  if (![premium17Dkk, premium20Dkk, acquisitionSpendDkk,
        clawbackPremium17Dkk, clawbackPremium20Dkk, variableCostDkk,
        partnerRatePct, expectedFutureClawbackRate, targetDbPerPolicyDkk].every(money) ||
      partnerRatePct > 100 || expectedFutureClawbackRate > 1 ||
      typeof sellerRecovery !== "boolean" || typeof sixMonthMatured !== "boolean" ||
      clawbackPremium17Dkk > premium17Dkk ||
      clawbackPremium20Dkk > premium20Dkk) invalid();
  const annualPremiumDkk = premium17Dkk + premium20Dkk;
  if ((policies === 0) !== (annualPremiumDkk === 0)) invalid();

  const partnerRate = partnerRatePct / 100;
  const partnerCommissionDkk = annualPremiumDkk * partnerRate;
  const sellerCommissionDkk = premium17Dkk * 0.17 + premium20Dkk * 0.20;
  const observedPartnerClawbackDkk =
    (clawbackPremium17Dkk + clawbackPremium20Dkk) * partnerRate;
  const observedSellerRecoveryDkk = sellerRecovery ?
    clawbackPremium17Dkk * 0.17 + clawbackPremium20Dkk * 0.20 : 0;
  const observedNetClawbackDkk = Math.max(0,
    observedPartnerClawbackDkk - observedSellerRecoveryDkk);
  // On immature cohorts, model future loss only on premium not already clawed back.
  const remaining17 = premium17Dkk - clawbackPremium17Dkk;
  const remaining20 = premium20Dkk - clawbackPremium20Dkk;
  const remainingPartnerCommission = (remaining17 + remaining20) * partnerRate;
  const remainingSellerRecovery = sellerRecovery ?
    remaining17 * 0.17 + remaining20 * 0.20 : 0;
  const futureRiskDkk = sixMonthMatured ? 0 :
    expectedFutureClawbackRate * Math.max(0, remainingPartnerCommission - remainingSellerRecovery);
  const clawbackExposureDkk = observedNetClawbackDkk + futureRiskDkk;
  const marginBeforeAcquisitionDkk =
    partnerCommissionDkk - sellerCommissionDkk - clawbackExposureDkk - variableCostDkk;
  const contributionDkk = marginBeforeAcquisitionDkk - acquisitionSpendDkk;
  return {
    status: sixMonthMatured ? "matured_observed" : "provisional_six_month_risk",
    rawLeads, validLeads, contacted, bookedMeetings, meetingsHeld, policies,
    annualPremiumDkk, partnerCommissionDkk, sellerCommissionDkk,
    premiumWeightedSellerRatePct: divide(sellerCommissionDkk * 100, annualPremiumDkk),
    observedNetClawbackDkk, futureRiskDkk, clawbackExposureDkk,
    acquisitionSpendDkk, variableCostDkk, marginBeforeAcquisitionDkk,
    contributionDkk, dbPerPolicyDkk: divide(contributionDkk, policies),
    rawCplDkk: divide(acquisitionSpendDkk, rawLeads),
    validCplDkk: divide(acquisitionSpendDkk, validLeads),
    cacDkk: divide(acquisitionSpendDkk, policies),
    costPerHeldMeetingDkk: divide(acquisitionSpendDkk, meetingsHeld),
    costPerBookedMeetingDkk: bookedMeetings === null ? null : divide(acquisitionSpendDkk, bookedMeetings),
    bookingRateAmongContacted: bookedMeetings === null ? null : divide(bookedMeetings, contacted),
    meetingShowRate: bookedMeetings === null ? null : divide(meetingsHeld, bookedMeetings),
    meetingHeldRateAmongContacted: divide(meetingsHeld, contacted),
    policyRateAmongContacted: divide(policies, contacted),
    policyRateAmongHeldMeetings: divide(policies, meetingsHeld),
    validLeadRate: divide(validLeads, rawLeads),
    contactRateAmongValid: divide(contacted, validLeads),
    rawLeadToPolicyRate: divide(policies, rawLeads),
    observedPremiumClawbackRate: divide(
      clawbackPremium17Dkk + clawbackPremium20Dkk, annualPremiumDkk),
    breakEvenRawCplDkk: rawLeads ? Math.max(0, marginBeforeAcquisitionDkk / rawLeads) : null,
    maxRawCplAtTargetDkk: rawLeads ?
      Math.max(0, (marginBeforeAcquisitionDkk - targetDbPerPolicyDkk * policies) / rawLeads) : null,
    disclaimer: "Aggregate cohort scenario only; six-month maturity must be verified. No launch or spend authorization."
  };
}
