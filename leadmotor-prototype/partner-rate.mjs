// Pure scenario analysis: minimum partner commission required for an acquisition channel.
// All percentages of annual premium. No external requests, PII, or authorization to spend.
const finite = n => typeof n === 'number' && Number.isFinite(n);
export function minimumPartnerRate(input) {
  const {annualPremiumDkk, sellerRatePct, validLeadRate, contactRate, closeRate,
    rawCplDkk, variableCostPerPolicyDkk = 0, targetDbPerPolicyDkk = 500,
    expectedPartnerClawbackRate = 0.05, sellerRecovery = false} = input ?? {};
  if (![annualPremiumDkk,sellerRatePct,validLeadRate,contactRate,closeRate,
    rawCplDkk,variableCostPerPolicyDkk,targetDbPerPolicyDkk,
    expectedPartnerClawbackRate].every(finite) ||
    annualPremiumDkk <= 0 || sellerRatePct < 0 || sellerRatePct > 100 ||
    [validLeadRate,contactRate,closeRate,expectedPartnerClawbackRate].some(x=>x<0||x>1) ||
    [rawCplDkk,variableCostPerPolicyDkk,targetDbPerPolicyDkk].some(x=>x<0) ||
    typeof sellerRecovery !== 'boolean') throw new RangeError('INVALID_PARTNER_SCENARIO');
  const policyRate=validLeadRate*contactRate*closeRate;
  if (policyRate===0) return {status:'no_conversion',requiredPartnerRatePct:null,policyRate};
  const seller=sellerRatePct/100;
  const claw=expectedPartnerClawbackRate;
  // Net after expected clawback: partnerRate*(1-claw) - sellerRate*(1-claw if seller recovery, else 1)
  const required = (rawCplDkk/policyRate + variableCostPerPolicyDkk +
    targetDbPerPolicyDkk)/annualPremiumDkk + seller*(sellerRecovery?1-claw:1);
  const rate=required/(1-claw)*100;
  return {status:rate>100?'commercially_impossible_at_100pct':'scenario_only',
    requiredPartnerRatePct:rate,policyRate,
    warning:'Scenario, not a partner offer. Verify commission basis, seller recovery, conversion and clawback.'};
}
