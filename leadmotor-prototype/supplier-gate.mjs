// Mega Limited: document-first supplier audit, aggregate economics only.
// Never treats a vendor website claim as independent verification.
// No customer data, no external contact, no spend authorization.
import { calculateLeadEconomics } from './demo-core.mjs';

export const REQUIRED_EVIDENCE = Object.freeze([
  'cvrRegistry', 'activeOperations', 'danishB2cInsuranceFit',
  'consentJourney', 'namedRecipientAndPurpose', 'lawfulTelephoneContact',
  'exclusivityOrSharingDisclosed', 'writtenPrice', 'volumeProof',
  'refundTerms', 'dataProcessingTerms', 'noBindingPilot'
]);

const fail = () => { throw new RangeError('INVALID_SUPPLIER_AUDIT'); };
const nonnegative = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;

export function auditSupplier(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail();
  const { evidence, priceBasis, unitPriceDkk, validLeadRate, economics } = input;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) ||
      Object.keys(evidence).some(k => !REQUIRED_EVIDENCE.includes(k)) ||
      REQUIRED_EVIDENCE.some(k => !['verified','missing','failed'].includes(evidence[k]))) fail();
  if (!['raw','valid'].includes(priceBasis) ||
      !(unitPriceDkk === null || nonnegative(unitPriceDkk)) ||
      !(validLeadRate === null || (nonnegative(validLeadRate) && validLeadRate <= 1))) fail();
  if (!economics || typeof economics !== 'object' || Array.isArray(economics)) fail();
  const needed = ['annualPremium','partnerRate','sellerRate','contactRate','closeRate','clawbackProbability','targetDb'];
  if (needed.some(k => !nonnegative(economics[k])) ||
      economics.partnerRate > 100 || economics.sellerRate > 100 ||
      economics.contactRate > 1 || economics.closeRate > 1 ||
      economics.clawbackProbability > 1 ||
      (economics.fixedCostPerPolicy !== undefined && !nonnegative(economics.fixedCostPerPolicy)) ||
      (economics.sellerClawbackRecoverable !== undefined && typeof economics.sellerClawbackRecoverable !== 'boolean')) fail();

  const failed = REQUIRED_EVIDENCE.filter(k => evidence[k] === 'failed');
  const missing = REQUIRED_EVIDENCE.filter(k => evidence[k] === 'missing');
  const canCalculate = unitPriceDkk !== null && validLeadRate !== null;
  const result = {
    status: 'evidence_missing', failed, missing,
    rawEquivalentCplDkk: null, breakEvenRawCplDkk: null,
    maxRawCplAtTargetDkk: null, dbPerPolicyDkk: null,
    disclaimer: 'Manual supplier audit only. Evidence is not independently verified by software. No purchase, launch, or outreach authorization.'
  };
  if (canCalculate) {
    // Paying per valid lead: expected spend per raw inquiry = unit price * valid fraction.
    const rawEquivalentCplDkk = priceBasis === 'raw' ? unitPriceDkk : unitPriceDkk * validLeadRate;
    const e = calculateLeadEconomics({
      annualPremium: economics.annualPremium,
      partnerRate: economics.partnerRate,
      sellerRate: economics.sellerRate,
      validLeadRate,
      contactRate: economics.contactRate,
      closeRate: economics.closeRate,
      clawbackProbability: economics.clawbackProbability,
      sellerClawbackRecoverable: economics.sellerClawbackRecoverable ?? false,
      fixedCostPerPolicy: economics.fixedCostPerPolicy ?? 0,
      targetDb: economics.targetDb,
      cpl: rawEquivalentCplDkk
    });
    Object.assign(result, {
      rawEquivalentCplDkk,
      breakEvenRawCplDkk: e.breakEvenCpl,
      maxRawCplAtTargetDkk: e.maxCplAtTarget,
      dbPerPolicyDkk: e.dbPerPolicy
    });
  }
  if (failed.length) result.status = 'reject_documented_failure';
  else if (missing.length || !canCalculate) result.status = 'evidence_missing';
  else if (result.dbPerPolicyDkk === null || result.dbPerPolicyDkk < 0) result.status = 'reject_negative_economics';
  else if (result.dbPerPolicyDkk < economics.targetDb) result.status = 'below_target_db';
  else result.status = 'manual_pilot_review_only';
  return result;
}
