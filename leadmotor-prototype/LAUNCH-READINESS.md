# Status før rigtig leadmodtagelse

Dette er en teknisk testbranch oven på draft PR #1. Ingen produktion eller annoncer er aktiveret. Syntetiske testleads må ikke rapporteres som kundehenvendelser.

## Bygget på testbranchen

- Samlet lokal formular med syntetisk validering og eksplicit versioneret testsamtykke.
- Servervalidering, oprindelig UTM/kilde og telefon-deduplikering.
- Krypteret lagring, offline verificeret backup/gendannelse og hændelsesbaseret KPI.
- Separate testadgange til modtagelse, CRM og KPI, håndhævet i API'et.
- Kunstige bookingslots, konfliktbesked og blokering efter frabedelse.
- Automatiserede API-/lagringstests og en reel browser-test af kunderejsen.

## Konkret mangler for at skaffe og behandle rigtige leads

| Afhængighed | Faktisk status | Hvad der kræves |
|---|---|---|
| Modtager og opfølgning | Ikke fastlagt i den tekniske opsætning | Ansvarlig person, kontaktvinduer og arbejdsgang for opfølgning |
| CRM, hosting og kalender | Ingen produktionsadgang eller valgt integration i denne branch | Eksisterende system/adgang eller et konkret godkendt valg; HTTPS, personlige identiteter og reel kapacitet |
| Retention/sletning | Prototype gemmer hele loggen; ingen sletning implementeret | Besluttet slettepolitik og teknisk håndtering af data, backups og frabedelser ved recovery |
| Samtykke og privatliv | Kun tydeligt mærket testsamtykke | Verificerede virksomheds-/dataansvarsoplysninger og juridisk gennemgåede tekster og kontaktgrundlag |
| Tilbud og partnerposition | Ingen partneraftale dokumenteret i koden | Bekræftelse af hvad Mega faktisk kan tilbyde; ingen udokumenterede partner- eller besparelsesløfter |
| Trafik og offentlig åbning | Ingen lancering eller kampagne gennemført | Konkret godkendt side/kanal og offentliggørelse. Betalt trafik kræver særskilt budget og stopregler |

Det næste eksterne skridt er ikke endnu en syntetisk test. Det er at få modtager, systemadgang og tilbud fastlagt, så en konkret, gennemtestet produktionsændring kan klargøres til godkendelse. Rigtige leads kan ikke leveres af en localhost-prototype, og kode alene skaber ikke trafik.

Den eksisterende `/forsikringstjek/` er ikke migreret og må ikke forudsættes at være en partnerneutral indgang. Main/live holdes urørt, indtil en konkret produktionsændring er godkendt.
