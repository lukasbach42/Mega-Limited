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
| Modtager og opfølgning | Ejeren har valgt selv at modtage og fordele til egne sælgere | Sælgernavne, personlige brugeradgange og konkret opfølgningsrutine |
| CRM og hosting | Egen leadindbakke er valgt og implementeret som syntetisk prototype | Produktionshosting, HTTPS, personlige identiteter og produktionsklar lagring |
| Retention/sletning | Prototype gemmer hele loggen; ingen sletning implementeret | Besluttet slettepolitik og teknisk håndtering af data, backups og frabedelser ved recovery |
| Samtykke og privatliv | Kun tydeligt mærket testsamtykke | Verificerede virksomheds-/dataansvarsoplysninger og juridisk gennemgåede tekster og kontaktgrundlag |
| Tilbud og partnerposition | Ingen partneraftale dokumenteret i koden | Bekræftelse af hvad Mega faktisk kan tilbyde; ingen udokumenterede partner- eller besparelsesløfter |
| Trafik og offentlig åbning | Ingen lancering eller kampagne gennemført | Konkret godkendt side/kanal og offentliggørelse. Betalt trafik kræver særskilt budget og stopregler |

Arbejdsgangen er nu fastlagt: ejeren modtager henvendelser i egen indbakke og fordeler dem til egne sælgere. Næste driftsafhængighed er produktionshosting og personlige sælgeradgange samt godkendte kundetekster og tilbud. Rigtige leads kan ikke leveres af en localhost-prototype, og kode alene skaber ikke trafik.

Den eksisterende `/forsikringstjek/` er ikke migreret og må ikke forudsættes at være en partnerneutral indgang. Main/live holdes urørt, indtil en konkret produktionsændring er godkendt.

## Ønsket kontakttid i stedet for kalenderintegration

En rigtig kalenderintegration er ikke et krav for den valgte manuelle indbakke: henvendelsen indeholder et ønske om kontakttid, og sælgeren bekræfter en aftale efter opfølgning. Kundeteksten skal tydeligt sige, at indsendelse ikke reserverer eller bekræfter en tid. De eksisterende demo-bookingslots er kun til tests. Se [INBOX.md](INBOX.md).
