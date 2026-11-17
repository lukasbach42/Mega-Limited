# Mega 2.0 — regulatory and unit-economics correction, 16 November 2026

Status: internal analysis only; not legal advice or permission to dial. No external contact or ad spend.

## Material regulatory distinction
Forbrugerombudsmanden states insurance is among the limited exceptions allowing unsolicited telephone sales without prior consent under forbrugeraftaleloven §4(2): https://forbrugerombudsmanden.dk/alle-emner/uanmodede-henvendelser/telefonsalg . HOWEVER Robinson-list registration, direct objections and other marketing/data protection restrictions still apply. Example enforcement: https://forbrugerombudsmanden.dk/find-sager/sager/forbrugeraftaleloven/uanmodet-telefonisk-henvendelse/boede-for-ulovlige-opkald-til-forbrugere-paa-robinsonlisten . Purchased lead transfer requires its own lawful data processing/sharing basis; see https://www.datatilsynet.dk/afgoerelser/afgoerelser/2020/jun/videregivelse-af-kundeoplysninger-til-brug-for-direkte-markedsfoering . Hence distinguish (A) right to call for insurance from (B) right to obtain/process/transfer lead data. A blanket 'consent mandatory for every insurance call' gate is inaccurate. A customer-requested callback must be logged; vendor-sourced data still requires documented origin, lawful sharing, objections and Robinson screening as applicable. Legal review before production.

## Partner permission gate
Finanstilsynet 10 April 2025 states insurers must use appropriately licensed intermediaries, with registration verification at contract and ongoing: https://www.finanstilsynet.dk/nyheder-og-presse/nyheder-og-pressemeddelelser/2025/apr/forsikringsselskaber-skal-benytte-formidlere-med-tilladelse . Verify both Mega's relevant permissions and any intermediary's actual status in https://virksomhedsregister.finanstilsynet.dk/ ; verify carrier's underwriting authority, product scope, delegated claims/issuance authority and commission chain. No new contact-ready company/person verified today; Eir remains active, and previously processed leads excluded.

## Cohort economics (illustrative; not measured)
Prior model: annual premium DKK 10,000; partner commission 25%; seller payout 17.7126% of annual premium; clawback reserve 5% of gross partner commission. Net contribution per sold policy before lead cost/overheads: 2500 - 1771.26 - 125 = DKK 603.74. At 12.6% raw-to-policy, CPL break-even = 603.74*0.126 = DKK 76.07124.
At 22% partner commission and same seller payout, contribution = 2200 -1771.26 -110 = DKK 318.74, CPL break-even = DKK 40.16124.
If 1/3 of raw leads are invalid AND 12.6% conversion is measured among valid leads (rather than raw), raw conversion becomes 8.4%; CPL cap at 25% = DKK 50.71416. IMPORTANT: do not reduce 76.07 again for invalid leads if 12.6% already measures RAW-to-sale; this would double-count invalidity.
Formula: raw_CPL_cap = valid_fraction * contacted_per_valid * sold_per_contact * (annual_premium * partner_commission - annual_premium * seller_payout_fraction - expected_clawback_cost_per_sale - other_variable_cost_per_sale) - per_raw_processing_cost. Confirm seller payout basis and timing before reliance.
For 500 DKK target contribution per sold policy, max raw CPL at 12.6% raw conversion = (603.74-500)*0.126 = DKK 13.07124, excluding overhead. At 8.4% raw conversion = DKK 8.71416.

## Next executable steps
1. Add explicit acquisition-type enum: first-party opt-in, customer-requested callback, vendor-transferred, lawful insurance cold prospecting. Each with distinct evidence and suppression checks. No universal consent checkbox requirement; block any case without adequate legal basis.
2. Implement auditable Robinson/objection suppression and vendor lineage before real data; verify API/system capability.
3. Obtain written seller commission definition, clawback exposure and true conversion denominator to calibrate CPL.
4. No supplier passes CVR, consent/data lineage, pricing, exclusivity, volume and refund gates yet. Do not reintroduce prior contacts as new.
