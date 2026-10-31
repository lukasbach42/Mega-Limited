# Mega Limited – leadmotor, syntetisk prototype

**Status 28. oktober 2026:** Kun intern prototype på draft PR #1. `main`, live-siden og den eksisterende `/forsikringstjek/` er ikke ændret. Ingen rigtig kundedata må indsendes. Ingen partneraftale eller annoncebudget er aktiveret.

## Hvad der virker i prototypen

- `demo-core.mjs`: in-memory CRM-state machine med stram validering, syntetiske testdata, versioneret samtykkelog, UTM, telefon-deduplikering, demo-booking, frabedelser og KPI per kanal/kampagne.
- `demo-server.mjs`: HTTP API **kun på 127.0.0.1**, med tidsbegrænset process-token, adgangskontrol, body-size limit, rate limit og Host/Origin-tjek. Som standard kun i hukommelsen; kan **valgfrit** gemme syntetiske hændelser lokalt.
- `demo-journal.mjs`: lokal append-only journal til **syntetiske** leads, samtykkehændelser, booking og status; genindlæses ved genstart. Fil oprettes med adgangsrettighed `0600`; korrupt eller usikkert tilgængelig fil afvises. Ingen kryptering, backup, retention eller flerproceslås – **ikke til produktion**.
- `demo-journal.test.mjs` og `demo-server-journal.test.mjs`: tests af genstart, deduplikering, samtykke, frabedelser, filrettigheder og HTTP-end-to-end.
- `demo-core.test.mjs`: automatiserede tests af CRM, økonomi, samtykke, dubletter, booking, overgangsregler og HTTP-adgang.
- `economics.html`: scenarieregner med 25 % historisk partnerprovision, faktisk præmievægtet **17,7126 %** sælgerbetaling (8 på 17 %, 3 på 20 %, baseret på 11 personrækker), clawback, CPL og DB. Provisionsgrundlaget er årspræmien. De 5.000 kr. pr. sælger i modregningsreserve er ikke indtægt.

## Lokal operatørkonsol (tilføjet 30. oktober)
Start `node leadmotor-prototype/demo-server.mjs` og åbn **http://127.0.0.1:8787/demo-console** på samme computer. Indsæt det midlertidige token fra terminalen. Konsollen opretter udelukkende syntetiske testleads (navn `Test KundeN`, telefon `0000xxxx`, postnummer `0000`), viser kunstige slots, registrerer statushændelser og henter aggregerede KPI. Token lagres ikke i browseren. Konsollen er **ikke** en offentlig leadformular, og der findes stadig ingen sikker produktionsdatabase eller rigtig bookingkalender.

## Partnerneutral UTM-test uden Meta (30. oktober)

Den lokale konsol læser nu **kun** `utm_source`, `utm_medium` og `utm_campaign` fra sin egen URL og sender dem sammen med et syntetisk testlead til CRM. Tilladte testmedier: `test`, `organic`, `direct`, `referral`. Betalte kanaler afvises i demoen. Dublerede, ugyldige eller personoplysningslignende UTM-værdier afvises; ukendte queryparametre sendes ikke videre. Ingen cookies eller ekstern tracking.

Eksempel: `http://127.0.0.1:8787/demo-console?utm_source=linkedin&utm_medium=organic&utm_campaign=mega_launch`. Opret et testlead, book et syntetisk slot og se `organic/mega_launch` under KPI. Testen bruger hverken Meta eller en ekstern leverandør.

`demo-attribution.mjs` og `demo-attribution.test.mjs` tester parsing, afvisning af ugyldige input og HTTP-API/kanal-KPI. **Det er stadig en lokal prototype, ikke en aktiveret offentlig formular.**


## Formular → CRM → booking: syntetisk end-to-end (31. oktober)

Start `node leadmotor-prototype/demo-server.mjs`, og åbn **http://127.0.0.1:8787/demo-flow?utm_source=linkedin&utm_medium=organic&utm_campaign=mega_launch**. Indsæt det midlertidige lokale token fra terminalen. Formularen har **kun et testnummer (1–9999)**, kontakttidsvalg, kunstige slots og et eksplicit **demosamtykke**. Navn, telefon og postnummer genereres automatisk som `Test KundeN`, `0000xxxx` og `0000`; brugeren kan ikke indtaste rigtige kundeoplysninger. Formularen sender til den eksisterende lokale API, opretter versioneret samtykkelog, deduplikerer, booker valgfrit og viser kampagne-KPI. Dobbeltindsendelse giver ikke dobbeltbooking.

- `demo-flow.html`, `demo-flow.js`, `demo-flow.mjs`: partnerneutral syntetisk formular og genbrugelig testkunderejse.
- `demo-flow.test.mjs`: HTTP-end-to-end-test af statiske assets, oprettelse, booking, dubletter, UTM-KPI og tilbagetrækning af samtykke samt afvisning af ugyldige testinput.
- Kun loopback; ingen live-formular, ingen faktisk kalender, ingen rigtige persondata, ingen Meta eller tredjepartskald.
- Den offentligt tilgængelige `index.html` er stadig **deaktiveret**. Dette flow er **ikke** en produktionslancering eller en lovlig kundesamtykketekst.

## Sådan testes lokalt

Kræver Node.js 22 eller nyere; ingen tredjepartsafhængigheder:

```sh
node --test leadmotor-prototype/*.test.mjs
node leadmotor-prototype/demo-server.mjs
```

Serveren udskriver en **midlertidig** Bearer-token i terminalen. Brug kun lokale tests, eksempelvis:

```sh
curl -s http://127.0.0.1:8787/api/leads \
  -H 'Authorization: Bearer INDSÆT_MIDLERTIDIG_TOKEN' \
  -H 'Content-Type: application/json' \
  --data '{"name":"Test Kunde1","phone":"00000001","postcode":"0000","preferred_contact":"formiddag","consent":true,"consent_text_version":"demo-v1","source":"organic","utm_campaign":"demo_october"}'
```

**Valgfri lokal persistens (kun test):** Opret en privat lokal mappe uden for Git-repositoriet og start med `MEGA_DEMO_JOURNAL=/absolut/privat/sti/demo.journal node leadmotor-prototype/demo-server.mjs`. Uden denne variabel er CRM fortsat in-memory. Journalen må aldrig indeholde rigtige persondata og skal slettes manuelt efter testen. Ved korrupt journal nægter serveren at starte; ved diskfejl stopper journalen yderligere ændringer. Journalen er ikke krypteret og er ikke et produktions-CRM.

Testdata skal **altid** have navne der begynder med `Test `, telefonnumre `0000xxxx` og postnummer `0000`. API afviser rigtige telefonnumre/postnumre og ukendte felter. Demoslots `demo-slot-1` og `demo-slot-2` er ikke kalenderaftaler.

## API (kun localhost)

| Metode | Endpoint | Funktion |
|---|---|---|
| POST | /api/leads | Syntetisk lead, samtykkelog, UTM, dedup |
| GET | /api/slots | Kun to kunstige testslots |
| POST | /api/leads/:id/booking | Reserver testslot |
| POST | /api/leads/:id/events | contacted, meeting_held, policy_issued, clawback, consent_withdrawn |
| GET | /api/kpi | Syntetiske tællinger per kanal og kampagne |

Alle endpoints kræver Bearer-token. Ingen tredjepartsintegrationer og ingen udsendelse af e-mails eller SMS.

## Økonomimodel og forbehold

Standardscenarie: årspræmie 10.000 kr., partnerprovision 25 %, sælgerbetaling 17,7126 %, kontaktgrad 60 %, salgsrate blandt kontaktede 21 %, clawback-sandsynlighed 5 %, CPL 100 kr. Forventet clawback beregnes konservativt som 5 % af **hele partnerprovisionen**, fordi sælgerprovision ikke antages tilbagekrævet. Dette er en **antagelse**, ikke en konstateret tabsprocent eller ny partneraftale.

Formler: rålead→police-konvertering = gyldig-andel × kontaktgrad blandt gyldige × salgsrate blandt kontaktede. DB pr. police = partnerprovision − sælgerbetaling − forventet clawback − andre variable omkostninger − rå CPL / rålead→police-konvertering. Rå CPL og gyldig CPL er forskellige nøgletal; ugyldige leads må ikke dobbelttælles. Hvis konverteringen er nul, er DB pr. police ikke beregnelig.

## Stop før drift

Denne prototype er **ikke** et sikkert produktions-CRM: den mangler en krypteret produktionsdatabase (den lokale journal er kun en syntetisk test), rollebaseret adgang, backupløsning, revisionsspor, slettefrister, databehandleraftaler, juridisk godkendt kundetekst, rigtig bookingkalender, identitets-/sessionsstyring, monitorering og driftsmiljø. Der er ingen valideret markedsføringshjemmel eller partnerneutral produktadgang. **Ingen offentliggørelse eller behandling af reelle leads** før disse punkter er løst og godkendt.

Den gamle `/forsikringstjek/`-side omtaler Topdanmark og sender til en Topdanmark-mail; den må ikke genbruges som partnerneutral kanal.

## Næste tekniske skridt

1. Vælg hosting/CRM og dokumentér adgangsmodel, databehandleraftale og retention; implementér en produktionsklar backend på separat branch.
2. Integrér partnerneutral frontend og rigtig booking med dokumenteret kapacitet, og udfør end-to-end-tests uden rigtige persondata.
3. Etablér kanal-/kampagne-KPI og stopregler på **faktisk** valid-lead-rate, kontaktgrad, policekonvertering og 6-måneders clawback.
4. Juridisk godkendelse og partneraftale før offentlig aktivering. Meta er ikke en forudsætning; organiske og partnergodkendte kanaler kan valideres separat.
