# Leadindbakke til egne sælgere – syntetisk test

Indbakken er et CRM-overblik, ikke en almindelig e-mailkonto. Der er ingen mails, SMS'er, ekstern videresendelse eller kalenderinvitationer. Den bruger samme lokale demoserver, adgangskontrol, krypterede lagring og backup som resten af prototypen. Den er ikke offentliggjort og må kun bruges med syntetiske data.

## Valgt opsætning: kun ejeradgang

Ejeren styrer hele indbakken og fordeler manuelt til egne sælgere. Standardstart af demoserveren udsteder nu kun én midlertidig ejer-token. Fordelingsnavne er ikke brugerkonti; der oprettes ingen personlige links, sælgeradgange eller invitationer. Den udvidede seller-/intake-/analyst-adgang nedenfor findes kun som eksplicit testkonfiguration og aktiveres ikke ved normal start.

## Arbejdsgang

1. Start demoserveren som beskrevet i TEST-FLOW.md. Brug operator-token til din samlede indbakke.
2. Gem et kunstigt lead. Angiv eventuelt en konkret ønsket kontakttid i dansk tid. Ellers vises formiddag/eftermiddag. Tidspunktet gemmes i UTC og vises som Europe/Copenhagen; det opretter ingen booking eller reserverer kapacitet. Ugyldige tider samt de dobbelte/manglende tider ved sommertidsskift afvises.
3. Indbakken viser testnavn, telefon, ønsket kontakt, status, kilde/kampagne og ansvarlig sælger. Filtrér på aktive/nye/frabedelser samt ikke-fordelte eller en bestemt testsælger. Der vises højst 25 ad gangen; API'et tillader højst 50.
4. Vælg Testsælger 1 eller 2 og gem fordelingen. Fordeling/omfordeling logges med tidspunkt, tidligere og ny ansvarlig. Hvis en anden operatør har ændret fordelingen siden visningen blev hentet, afvises din gamle ændring med en konflikt, så den ikke overskriver den nye fordeling.
5. Kun ved eksplicit konfiguration af den udvidede testopsætning kan en separat seller-testsession åbnes. Standardopsætningen har ingen sælger-token. Sælgeren ser kun aktuelt tildelte leads og kan åbne dem, registrere kontaktstatus og reservere kunstige testslots. Sælgeren kan ikke fordele leads, åbne hele teamets KPI eller ændre ansvarlig.
6. Omfordeling fjerner den tidligere sælgers API-adgang med det samme. Allerede viste oplysninger kan ikke trækkes tilbage fra en persons hukommelse eller et screenshot; næste læse-/skrivekald afvises, og UI'et rydder den aktive detaljevisning efter afvisning. En frabedelse fjerner fordelingen, frigiver et testslot og gør leadet utilgængeligt for sælgere. Operatøren kan fortsat se historikken under frabedelser.

## Adgang og datagrænse

| Rolle | Hele indbakken | Egne tildelte leads | Fordele/omfordele | KPI |
|---|---|---|---|---|
| operator | Ja | Ja | Ja | Ja |
| seller | Nej | Ja | Nej | Nej |
| intake | Nej | Nej | Nej | Nej |
| analyst | Nej | Nej | Nej | Ja |

Intake kan fortsat oprette testleads og reservere kendte testlead-ID'er som i det oprindelige testflow; denne rolle er en lokal testintegration og må ikke offentliggøres. Personlige brugeridentiteter, MFA, per-bruger sessionsstyring, revisionsidentiteter og produktionshosting er stadig ikke etableret. Testsælgerne repræsenterer ingen rigtige personer.

API:

- `GET /api/leads?status=active&assignee=unassigned&offset=0&limit=25`: operatørindbakke; sælgeren får automatisk eget scope og kan ikke vælge andre sælgere eller hele indbakken.
- `GET /api/team`: operator-only liste over de to interne testsælgere.
- `POST /api/leads/:id/assignment`: operator-only, med `assignee` og `expectedAssignee` (sælger-ID eller null). Ingen eksterne modtagere eller e-mailadresser accepteres.
- `requested_contact_at`: valgfrit canonical ISO-UTC-tidspunkt i formularpayload. Dubletter bevarer det oprindelige ønske, samtykke og kilde.

Fordeling er en intern statusændring, ikke en udsendt besked eller bekræftet opfølgning. Den ændrer ikke KPI-leadantal. Fordelingshistorik og ønsket kontakttid følger med efter genstart og verificeret recovery. Backupformatets version er uændret, men filer med `assign`-kommandoer kræver den opdaterede kode ved recovery; ældre kommando-logfiler kan fortsat åbnes af den nye kode.

Før rigtige leads: sikker ejeradgang, ansvarlig drift/hosting, retention og sletning, godkendt kundetekst og konkret offentlig lancering. Separate sælgerlogins eller sælgermails er ikke nødvendige for den valgte ejerstyring. Der er ikke oprettet en rigtig mailkonto eller sendt kundedata til nogen.
