# Mega – pilotbeslutning og økonomiske stopregler (5. november 2026)

**Status:** Intern beslutningsstøtte. Ingen leverandør er godkendt, og intet er sat i drift. Ingen persondata må indsamles med prototypen.

## 1. Kontrolleret økonomisk grundlag

- Årspræmie pr. police: 10.000 kr. (scenarie, ikke målt for en ny kanal).
- Partnerprovision: 25 % af årspræmie.
- Vægtet sælgerprovision: 17,7126 % af årspræmie (historisk rapport).
- Gyldige leads: 100 % (optimistisk reference), kontaktgrad 60 % af gyldige, salg 21 % af kontaktede. Dermed 12,6 % af råleads til police.
- Forventet fuldt clawback: 5 % (hypotese), og sælgerprovision tilbagebetales ikke (konservativt).
- Øvrige variable omkostninger: 0 kr. i reference, **ikke** dokumentation for at de reelt er nul.
- Netto pr. udstedt police før leadkøb = 2.500 - 1.771,26 - (0,05 × 2.500) = **603,74 kr.**
- Break-even rå CPL = 603,74 × 0,126 = **76,07 kr.**; med 500 kr. ønsket DB pr. police: (603,74 - 500) × 0,126 = **13,07 kr.**
- Ved kun 2/3 gyldige råleads: break-even rå CPL **50,71 kr.**, maksimal rå CPL ved 500 kr. DB **8,71 kr.**
- Ved 22 % netto partnerprovision: netto pr. police før leadkøb = 2.200 - 1.771,26 - 110 = **318,74 kr.**; break-even rå CPL **40,16 kr.** (ikke 38,27 kr.); negativt rå CPL-budget ved mål om 500 kr. DB. Regnestykket forudsætter, at 5 % clawback beregnes af faktisk netto partnerprovision.
- 5.000 kr. månedlig modregningsreserve pr. sælger er **ikke** indtjening. Deltageraftale kan ikke automatisk allokeres til nye leads som marginalt dækningsbidrag.

## 2. Følsomhed og måleregler

| Gyldige råleads | Kontakt af gyldige | Salg af kontaktede | Rålead→police | Break-even rå CPL |
|---|---|---|---|---|
| 100 % | 60 % | 21 % | 12,60 % | 76,07 kr. |
| 67 % | 60 % | 21 % | 8,44 % | 50,96 kr. |
| 100 % | 45 % | 15 % | 6,75 % | 40,75 kr. |
| 67 % | 45 % | 15 % | 4,52 % | 27,31 kr. |

Tabellen anvender 67 % præcis, ikke 2/3. Konverteringsled må ikke tælles to gange. Faktisk omkostning pr. police skal omfatte leadindkøb, telefoni, bookerbetaling, variable platformomkostninger og estimeret clawback. Brug kohorter fra lead-dato til police og 6-måneders fastholdelse; rapportér både observeret og estimeret clawback.

## 3. Leverandørgate (alle punkter kræves før pilot)

1. Juridisk identitet: CVR, aktiv status, reelle ejere, fakturamodtager og dokumenteret aktivitet.
2. Lead-oprindelse: præcis URL/annonce/landing page, kontaktgrundlag, formål, tidsstempel, ordlyd, version og kilde pr. lead. Ikke blot et generisk 'GDPR-kompatibelt' løfte.
3. Deling og eksklusivitet: antal modtagere pr. lead, videresalg, kontaktvindue, forbud mod genbrug, eventuelle underleverandører.
4. Målgruppe: privatforsikring, postnummer, behov, dækningsområder og faktisk volumen fra seneste 30/90 dage, dokumenteret med aggregerede tal.
5. Priser: pris pr. rå/gyldigt lead, momsbehandling, minimumsforbrug, opstartsgebyr, binding, betalingsfrist, reklamation og refundering for ugyldige/duplikerede leads.
6. Compliance: ansvar for Robinson/frabedelser, indsigts-/sletteanmodninger, databehandlerroller og overførsler. Kræver juridisk godkendelse før live.
7. Pilot: ingen binding, på forhånd aftalt datakvalitetsdefinition, leveringsrapport og stopregler. **Ingen ordre, betaling eller outreach uden godkendelse.**

**Beslutningsregel:** Leverandør med udokumenteret pris, volumen, samtykkekæde eller delingsmodel forbliver 'ikke kvalificeret'. Et offentligt 'fra'-prisniveau er ikke en dokumenteret pris for danske privatforsikringsleads.

## 4. Partnerspor – kontaktbeskyttelse

Før nogen ny kandidat eller person foreslås: sammenhold med kendt kontaktlog, tidligere dialog og afslagsstatus. Allerede kontaktede må aldrig genintroduceres som nye. Aktive/afslåede/deprioriterede spor forbliver i deres kendte status, indtil konkret ny dokumentation foreligger. For enhver **ny** mulig partner skal følgende dokumenteres: licens/registrering, faktisk dansk privatproduktportefølje (bil/hus/indbo/ulykke), risikobærer, distributionsret, netto provision, eventuelle mellemled, eksklusivitet, ejerskab til kunde/lead, opsigelse, seksmåneders modregning og beslutningstagers aktuelle rolle. Mangler ét kritisk punkt, er sporet kun 'screening', ikke anbefalet outreach.

## 5. Næste tekniske leverance

Byg et **lokalt, syntetisk** automatiseret integrationstest-flow, der simulerer: leadoprettelse → validering → dublet → tilbagetrækning → kontaktstatus → møde → police → clawback → kanal-KPI. Test at persondata aldrig optræder i log/URL, og at fejl i CRM-levering ikke mister leadet. Før produktion kræves hosting, krypteret database, adgangsstyring, backup, slettepolitik, juridisk godkendt tekst og reel kalenderintegration. Undgå Meta som kritisk afhængighed.
