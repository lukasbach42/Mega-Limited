# Mega – økonomi pr. leadkohorte (kun aggregerede tal)

**Status: intern analysefunktion, ikke live og ingen adgang til kundedata.**
Modul: `cohort-economics.mjs`; tests: `cohort-economics.test.mjs`.
Det nye modul gør det muligt at vurdere en konkret kanal/kampagne uden at kende
kundernes navne, telefonnumre eller policenumre.

## Data pr. kanal og modtagelsesmåned

- Råleads, gyldige leads, kontaktede, afholdte møder og udstedte policer.
- Sum af **årspræmie** på policer solgt af sælgere med **17 %** provision.
- Sum af **årspræmie** på policer solgt af sælgere med **20 %** provision.
- Årspræmie på senere modregnede policer, separat for hver sælgerprovisionsgruppe.
- Faktisk anskaffelsesudgift i DKK, øvrige variable omkostninger og
  **eksplicit** flag for om alle policer har passeret seksmånedersgrænsen.

Brug ikke antal sælgere til at kalde en vægtet sats 'faktisk'. Den faktiske
præmievægtede sats er
`(0,17 × præmie_17 + 0,20 × præmie_20) / samlet præmie`.
Den hidtidige **17,7126 %** i prototypens scenarieregner er kun en
**illustrativ antagelse** fra et tidligere regneark, ikke verificeret faktisk
præmievægtning.

## Beregning

`evaluateCohort({...})` returnerer:

- **Rå CPL** = anskaffelsesudgift / råleads, ikke / gyldige leads.
- **Gyldig CPL** = anskaffelsesudgift / gyldige leads.
- **CAC** = anskaffelsesudgift / udstedte policer.
- Partnerprovision (historisk scenarie **25 %** af årspræmie) minus
  sælgerbetaling (faktisk aftalte **17/20 %** af årspræmie).
- Kendte modregninger plus **forventet resterende** modregning på endnu ikke
  modregnet præmie, så samme modregning ikke tælles to gange.
- DB efter anskaffelse og variable omkostninger, break-even rå CPL samt
  rå CPL ved mål-DB pr. police.

Som standard er sælgerprovision **ikke** antaget at kunne tilbagekræves ved
clawback; `sellerRecovery` kan kun sættes til `true`, når den faktiske aftale
og inddrivelse er dokumenteret. For endnu ikke seksmånedersmodnede kohorter
anvendes **5 % forventet fremtidig modregning som et scenarie**, ikke som
et dokumenteret historisk tab. En kohorte markeres `provisional_six_month_risk`,
indtil `sixMonthMatured: true` er dokumenteret.

## Eksempel – kun opdigtede aggregerede testtal

```js
import { evaluateCohort } from "./cohort-economics.mjs";
const report = evaluateCohort({
  rawLeads: 100, validLeads: 80, contacted: 60, meetingsHeld: 30, policies: 12,
  premium17Dkk: 90000, premium20Dkk: 30000,
  clawbackPremium17Dkk: 10000, clawbackPremium20Dkk: 0,
  acquisitionSpendDkk: 4000, variableCostDkk: 600,
  sixMonthMatured: false
});
```

Eksemplet giver 40 kr. rå CPL, 50 kr. gyldig CPL og en faktisk
**præmievægtet** sælgerprovision på 17,75 %. Forventet DB er foreløbig,
fordi seksmånedersperioden ikke er udløbet.

**Vigtigt:** Denne funktion er en økonomisk kontrol, ikke en tilladelse til
at købe leads. Ingen ekstern dataimport, automatiske annoncer, kundedata,
partneraftale eller offentlig formular. Partnerens fremtidige provisionssats,
kontaktgrundlag, faktiske konverteringer og modregningsregler skal verificeres.
