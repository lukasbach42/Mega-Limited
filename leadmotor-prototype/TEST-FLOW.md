# Hele det syntetiske leadflow

Start fra repositoriets rod:

```text
node leadmotor-prototype/demo-server.mjs
```

Åbn `http://127.0.0.1:8787/` i en browser på samme computer. Brug en af de tre midlertidige testadgange, serveren udskriver lokalt. Hver genstart giver nye tokens. Del ikke tokens via URL'er, Git eller screenshots. Valgfri krypteret serverlagring og recovery er beskrevet i README-DEMO.md og RECOVERY.md.

| Testrolle | Modtag lead | Testslots/booking | Læs lead/samtykke | Registrer hændelser | KPI |
|---|---|---|---|---|---|
| intake | Ja | Ja | Nej | Nej | Nej |
| operator | Ja | Ja | Ja | Ja | Ja |
| analyst | Nej | Nej | Nej | Nej | Ja |

Det er procesbaserede testroller, ikke personlige brugerkonti, MFA, audit-identiteter eller produktionsegnet autorisation. Intake kan booke kendte testlead-ID'er; intake har ingen individuel ejerskabskontrol. Den senere tilføjede seller-rolle er derimod begrænset til egne aktuelt tildelte leads (se INBOX.md). Dette må ikke være offentlig adgang til reelle leads. `GET /api/session` viser kun den autentificerede testrolle. Serveren håndhæver tilladelserne, også hvis klienten ændres eller kaldes direkte.

## Kontrolleret vej gennem formularen

1. Åbn testsessionen med operator-token. Token fjernes fra inputfeltet efter login og ligger kun i klientens hukommelse. Genindlæsning eller 'Luk testsession' rydder klientadgangen, men tilbagekalder ikke token på serveren; det sker ved genstart.
2. Udfyld et navn med `Test `, telefon `0000xxxx` og testpostnummer `0000`. Markér testsamtykke version demo-v1. Der er ingen juridisk godkendelse af denne demotekst til rigtig markedsføring.
3. Gem leadet. En succesvisning kommer først efter bekræftelse fra API'et. CRM'et registrerer samtykke og den oprindelige UTM/kilde; gentagen indsendelse med samme telefon ændrer ikke attribution eller samtykkehistorik.
4. Vælg og reserver et kunstigt testslot. Slotkonflikter vises uden at miste det gemte lead. Leadmodtagelse og booking er to separate bekræftede handlinger; et gemt lead er ikke i sig selv en aftale.
5. Kontrollér CRM-log og KPI. Operator kan registrere kontakt, møde og simuleret police/clawback. En frabedelse frigiver slot og blokerer videre behandling.

En test-URL kan indeholde kanal/kampagne, eksempelvis `/?source=organic&utm_source=local&utm_medium=organic&utm_campaign=flow_test`. Brug aldrig navne, telefonnumre, andre persondata eller tokens i URL'er. Ugyldig/duplikeret kampagneattribution afvises. Browseren bruger ingen cookies, localStorage, sessionStorage, eksterne scripts, pixels eller analysetjenester. API'et tillader fortsat kun localhost og Bearer-token. Den lille offentligt læsbare localhost-allowlist består kun af HTML, CSS og klientmoduler; backendfiler, krypterede data og tokens udleveres ikke.

## Tests

```text
node --test leadmotor-prototype/*.test.mjs
```

CI kører Node-suiten på Windows og Linux. En separat Chromium-suite afprøver den faktiske HTML/JavaScript-formular: samtykkekrav, UTM, dedup, slotkonflikter, frabedelse, rollevisning, fejlet netværk, ugyldig token og nyt lead efter tidligere booking. Browserafhængigheden er kun en udviklings-/testafhængighed; serveren kræver fortsat ingen tredjepartspakker.

Browser-tests følger Playwrights officielle CI-arbejdsgang: https://playwright.dev/docs/ci . Kør dem lokalt fra `leadmotor-prototype/browser-tests` med `npm install --ignore-scripts --no-package-lock --omit=optional`, `npx playwright install chromium` og `npm test`. Alle testservere er friske localhost-instanser med syntetiske data og testtokens; testene kontakter ikke rigtige kunder eller kalendere.

## Indbakke og egne sælgere

En operator kan nu se og fordele testleads; hver seller-testadgang er bundet til en af de to interne testsælgere og giver kun adgang til aktuelt tildelte leads. Ønsket kontakttid, konfliktkontrol og fordelingshistorik er beskrevet i [INBOX.md](INBOX.md). Den oprindelige rolletabel ovenfor suppleres af denne sælgerrolle.
