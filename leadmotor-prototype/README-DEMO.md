# Mega Limited – leadmotor, syntetisk prototype

**Status 28. oktober 2026:** Kun intern prototype på draft PR #1. `main`, live-siden og den eksisterende `/forsikringstjek/` er ikke ændret. Ingen rigtig kundedata må indsendes. Ingen partneraftale eller annoncebudget er aktiveret.

## Hvad der virker i prototypen

- `demo-core.mjs`: in-memory CRM-state machine med stram validering, syntetiske testdata, versioneret samtykkelog, UTM, telefon-deduplikering, demo-booking, frabedelser og KPI per kanal/kampagne.
- `demo-server.mjs`: HTTP API **kun på 127.0.0.1**, med tidsbegrænset process-token, adgangskontrol, body-size limit, rate limit og Host/Origin-tjek. Valgfri krypteret lagring er beskrevet nedenfor; uden lagringsopsætning skrives ingen data til disk.
- `demo-core.test.mjs`: automatiserede tests af CRM, økonomi, samtykke, dubletter, booking, overgangsregler og HTTP-adgang.
- `economics.html`: scenarieregner med 25 % historisk partnerprovision, vægtet **17,9 %** sælgerbetaling (7 på 17 %, 3 på 20 %), clawback, CPL og DB. Provisionsgrundlaget er årspræmien. De 5.000 kr. pr. sælger i modregningsreserve er ikke indtægt.

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

Standardscenarie: årspræmie 10.000 kr., partnerprovision 25 %, sælgerbetaling 17,9 %, kontaktgrad 60 %, salgsrate blandt kontaktede 21 %, clawback-sandsynlighed 5 %, CPL 100 kr. Forventet clawback beregnes konservativt som 5 % af **hele partnerprovisionen**, fordi sælgerprovision ikke antages tilbagekrævet. Dette er en **antagelse**, ikke en konstateret tabsprocent eller ny partneraftale.

Formler: konvertering = kontaktgrad × salgsrate; DB pr. police = partnerprovision − sælgerbetaling − forventet clawback − andre variable omkostninger − CPL/konvertering. Hvis konverteringen er nul, er DB pr. police ikke beregnelig.

## Stop før drift

Denne prototype er **ikke** et sikkert produktions-CRM: den mangler krypteret persistent database, rollebaseret adgang, backupløsning, revisionsspor, slettefrister, databehandleraftaler, juridisk godkendt kundetekst, rigtig bookingkalender, identitets-/sessionsstyring, monitorering og driftsmiljø. Der er ingen valideret markedsføringshjemmel eller partnerneutral produktadgang. **Ingen offentliggørelse eller behandling af reelle leads** før disse punkter er løst og godkendt.

Den gamle `/forsikringstjek/`-side omtaler Topdanmark og sender til en Topdanmark-mail; den må ikke genbruges som partnerneutral kanal.

## Næste tekniske skridt

1. Vælg hosting/CRM og dokumentér adgangsmodel, databehandleraftale og retention; implementér en produktionsklar backend på separat branch.
2. Integrér partnerneutral frontend og rigtig booking med dokumenteret kapacitet, og udfør end-to-end-tests uden rigtige persondata.
3. Etablér kanal-/kampagne-KPI og stopregler på **faktisk** valid-lead-rate, kontaktgrad, policekonvertering og 6-måneders clawback.
4. Juridisk godkendelse og partneraftale før offentlig aktivering. Meta er ikke en forudsætning; organiske og partnergodkendte kanaler kan valideres separat.

## Persistent synthetic CRM (follow-up to draft PR #1)

Optional encrypted local storage now survives a clean server restart. This is still a **synthetic-only localhost prototype**, not a production CRM.

1. Create a private directory **outside this repository and every static hosting root**. Only the local operator should have access (Windows: set directory ACLs; POSIX: directory mode 700). The file mode 600 used by the code does not establish Windows ACLs.
2. Set `DEMO_STORE_FILE` to an absolute file path in that directory and `DEMO_STORE_KEY` to a securely generated 32-byte key encoded as 64 hex characters. Keep the key outside the data directory, repository and logs. Both variables must be set together. Missing key material prevents startup; never generate a replacement key for an existing store.
3. Run `node leadmotor-prototype/demo-server.mjs`. Without both variables the original in-memory demo remains available. The temporary Bearer token changes on restart; the encryption key must stay the same.
4. Run all tests with `node --test leadmotor-prototype/*.test.mjs`.

`GET /api/leads/:id` now returns a lead and its versioned consent/event history, behind the same Bearer, loopback, Host and Origin controls as every other endpoint. Consent, first-touch UTM, duplicate suppression, slot reservations, withdrawals and historical KPI are rebuilt from the encrypted command log after restart. Duplicate submissions do not append commands or overwrite attribution/consent.

Storage uses AES-256-GCM authenticated encryption with a fresh nonce per write. A validated candidate is written to an exclusive temporary file, flushed and renamed before the mutation is acknowledged or memory is replaced. Invalid requests, failed writes, corrupted ciphertext and wrong keys fail closed. Storage failures return a generic HTTP 503 without filesystem details. A single-writer lock prevents two processes opening the same path.

Stop with Ctrl+C for a clean close. After a crash, the `.lock` and possibly `.tmp` file deliberately require operator inspection: establish that no writer is running, preserve files for recovery, and only then remove stale files. Never delete the committed encrypted file to bypass a startup error. Use a local filesystem; network shares are unsupported. The current implementation rewrites/replays the complete log and is suitable only for small demo datasets. File flush and atomic replacement do not guarantee survival of every filesystem/power failure; there is no backup/restore or key rotation implementation.

Remaining production work: managed identity and roles, durable transactional database, backup/restore validation, deletion and retention policy, approved consent text, real calendar capacity and deployment review. No external calendar, outreach, ad spend or production deployment was added.
