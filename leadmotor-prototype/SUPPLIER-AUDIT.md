# Leadleverandører: dokumentationskrav og økonomisk stopregel

**Status 2. november 2026:** Intern beslutningsstøtte, ikke leverandørgodkendelse. `supplier-gate.mjs` og `supplier-gate.test.mjs` bruger ingen kundeoplysninger eller navngivne leverandører.

## Inden nogen pilot
Indhent og kontroller: CVR i uafhængigt register, faktisk drift, dokumenteret dansk privatforsikringsvolumen, hele formular- og samtykkerejsen, hvem kunden accepterer kontakt fra, lovligt telefonkontaktgrundlag, om leadet deles eller sælges eksklusivt, skriftlig pris, dokumenteret volumen, kreditnota-/refundregler, databehandlingsvilkår og ubundet pilot. Et udsagn på leverandørens egen hjemmeside er **ikke** uafhængig verifikation.

Hver kontrol får `verified`, `missing` eller `failed`. `failed` blokerer, og `missing` betyder ingen pilotgodkendelse. Ingen softwaretest kan erstatte dokumentgennemgang.

## Pris på rå eller gyldige leads
Betales 20 kr. **kun pr. gyldigt lead** og 50 % er gyldige, er forventet udgift 10 kr. **pr. rå lead**. Betales 20 kr. pr. rå lead, er udgiften 20 kr. uanset gyldighed. Må ikke forveksles med CAC pr. police. Bookingpris kan ikke sammenlignes uden målt bookingrate og definition af et afholdt møde.

Standardscenarie (ikke målte resultater): 10.000 kr. årspræmie, 25 % partnerprovision, historisk 17,7126 % præmievægtet sælgerbetaling, 60 % kontakt blandt gyldige, 21 % salg blandt kontaktede, 5 % fuldt partner-clawback og 500 kr. ønsket DB pr. police. Ved 100 % gyldige er break-even 76,07 kr. pr. rå lead, men **maksimal pris for 500 kr. DB kun 13,07 kr.** Ved 50 % gyldige halveres begge råleadgrænser. Partnerprovision og fremtidig konvertering er endnu ikke dokumenteret.

## Brug
```js
import { auditSupplier, REQUIRED_EVIDENCE } from './supplier-gate.mjs';
const evidence = Object.fromEntries(REQUIRED_EVIDENCE.map(key => [key, 'missing']));
// Skift kun til 'verified' efter konkret dokumentkontrol, aldrig pga. salgstekst.
const result = auditSupplier({
  evidence, priceBasis:'raw', unitPriceDkk:null, validLeadRate:null,
  economics:{ annualPremium:10000, partnerRate:25, sellerRate:17.7126,
    contactRate:0.6, closeRate:0.21, clawbackProbability:0.05, targetDb:500 }
});
```
Resultat `evidence_missing` indtil dokumentation findes. `manual_pilot_review_only` er ikke tilladelse til at kontakte leverandør, acceptere aftale, aktivere annoncer eller behandle personoplysninger.

**Fortrolighed:** Registrér ikke navngivne leverandørforhandlinger, personers kontaktstatus eller kundedata i dette offentlige GitHub-repository. Kontaktlog hører til i et privat adgangsstyret system.
