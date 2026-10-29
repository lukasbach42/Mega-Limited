# Backup og gendannelse – kun syntetisk CRM

Denne vejledning gælder den lokale prototype. Den aktiverer ingen hosting, eksterne kontakter eller rigtige kalenderaftaler. Brug kun syntetiske data.

## Før du starter

- Stop demoserveren rent med Ctrl+C. Backup og gendannelse afviser en `.lock` fra et aktivt CRM eller en tidligere afbrudt proces. Slet ikke en lås for at omgå en kørende skriver.
- Brug private, lokale mapper uden for Git-repositoriet og alle mapper, der udgives som hjemmeside. På Windows skal mappernes adgangsrettigheder sættes for operatøren; filmode 600 etablerer ikke Windows-ACL'er.
- Brug `.enc` som filendelse. Kilde- og destinationsmapper skal allerede eksistere. Filsystemet skal understøtte hardlinks inden for destinationsmappen; netværksdrev er ikke understøttet.
- Indlæs den eksisterende nøgle i miljøvariablen `DEMO_STORE_KEY` fra en separat sikker placering. Nøglen er 32 bytes kodet som 64 hextegn. Den må ikke ligge i Git, backupmappen, kommandolinjeargumenter eller logs. Uden den oprindelige nøgle kan backup ikke gendannes.

## Tag en verificeret backup

Fra repositoriets rod, erstat `SOURCE.enc` og `BACKUP.enc` med absolutte filstier:

```text
node leadmotor-prototype/store-maintenance.mjs backup SOURCE.enc BACKUP.enc
```

Vælg altid et nyt backupnavn. Værktøjet låser både kilde og destination med samme låseprotokol som CRM'et, læser kildefilen én gang og kontrollerer dens AES-GCM-integritet og hele hændelsesloggen med CRM'ets overgangsregler. Først derefter skrives den uændrede krypterede kopi til en midlertidig fil med eksklusiv oprettelse. Filen flushes og publiceres som destination med et hardlink, der ikke kan overskrive en eksisterende fil. Den midlertidige fil fjernes derefter; kilden ændres ikke.

Succes giver exitkode 0. En eksisterende destination giver `STORE_DESTINATION_EXISTS`; aktiv/stale lås giver `STORE_IN_USE`. Forkert nøgle, korrupt format eller ugyldig hændelseslog giver `STORE_VERIFICATION_FAILED`. Øvrige driftsfejl udskrives som `STORE_MAINTENANCE_FAILED` uden filstier eller nøgler. Undersøg fejlen; brug ikke en ny tom database som erstatning for en fejlende backup.

## Gendan uden at overskrive

Bevar både oprindelig fil og backup. Gendan til et nyt navn:

```text
node leadmotor-prototype/store-maintenance.mjs restore BACKUP.enc RESTORED.enc
```

Værktøjet udfører samme integritets- og replaykontrol før gendannelse. Det overskriver aldrig et eksisterende CRM. Efter succes:

1. Sæt `DEMO_STORE_FILE` til den nye absolutte `RESTORED.enc`-sti og behold den oprindelige `DEMO_STORE_KEY`.
2. Start demoserveren. Brug dens nye midlertidige Bearer-token; token fra før genstart virker ikke længere.
3. Kontrollér `/api/kpi`, de kendte syntetiske leads via `/api/leads/:id` og `/api/slots`. Samtykkehistorik, oprindelig UTM, dubletkontrol og slotreservationer skal svare til tidspunktet for backup.
4. Registrér lokalt, hvilken backup og nøgleversion der blev brugt. Genoptag kun syntetiske tests efter kontrollen.

En tilbageført backup indeholder kun hændelser frem til kopieringstidspunktet. Senere frabedelser findes ikke automatisk i en ældre backup. Reelle kundedata må derfor fortsat ikke anvendes; en produktionsløsning kræver en plan for frabedelser og sletninger ved restore.

## Afbrudte operationer og begrænsninger

En procesafbrydelse kan efterlade `.lock` eller `.enc.<id>.tmp`. Kontrollér først, at ingen server eller vedligeholdelsesproces bruger filerne. Bevar dem til undersøgelse. Ryd kun identificerede, forældede filer efter denne kontrol; værktøjet rydder aldrig andres låse. En allerede publiceret destinationsfil kan være komplet, selv om oprydning eller terminalrapportering fejlede. Efterprøv den ved gendannelse til endnu en ny fil; overskriv den ikke.

Dette er en manuelt udløst, verificeret lokal kopi. Der er ingen automatisk tidsplan, separat geografisk lagring, retention, nøgle-rotation eller garanti ved strømsvigt. Den oprindelige fil og en kopi på samme disk beskytter ikke mod disktab. Komplet log læses i hukommelsen; brug kun små testdatasæt. Backup-adgang, nøglehåndtering, slettepolitik og gendannelsesøvelser skal etableres før produktion.

## Test

```text
node --test leadmotor-prototype/*.test.mjs
```

Tests bruger kun syntetiske værdier og midlertidige mapper. De kontrollerer fuld gendannelse af samtykke/UTM/KPI/booking, ingen overskrivning, aktive/stale låse, forkert nøgle, manipuleret ciphertext, kryptografisk gyldig men ugyldig hændelseslog, stifejl og kommandolinjens fejlhåndtering. CI kører samme suite på Linux og Windows med Node 22.
