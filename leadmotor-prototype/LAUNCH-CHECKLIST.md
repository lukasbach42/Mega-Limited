# Mega leadmotor – før lancering

Status: Udkast, ikke live. Ændr ikke eksisterende /forsikringstjek uden særskilt godkendt migrering.

1. Fastlæg ansvarlig for databehandling, privacy notice, slettepolitik og databehandleraftale med CRM/hosting.
2. Opret server-side HTTPS-endpoint med adgangskontrol, rate limiting, validering og logning af formularversion, tidspunkt, kilde, samtykke og UTM-parametre. Ingen personoplysninger til tredjepartsformular eller GitHub.
3. Afklar præcis hvad Mega må tilbyde uden navngiven forsikringspartner. Ingen løfter om forsikringstilbud før partneraftale.
4. Bekræft kunderejse og kontaktgrundlag med juridisk gennemgang. Gem dokumentation og håndter tilbagetrækning/frabedelser.
5. Brug den valgte manuelle leadindbakke med ønsket kontakttid, dubletkontrol og fordeling til egne sælgere. Indsendelse er ikke en bekræftet aftale. Kalenderintegration er valgfri; hvis den tilsluttes, kræves reel kapacitet og bekræftelsesflow.
6. Test ende-til-ende med syntetiske data; verificer CRM, samtykkelog, opkaldsstatus, kontaktgrad og konvertering.
7. KPI'er: visninger, formularstart, afleveret lead, gyldigt lead, kontaktet, møde afholdt, police udstedt, 6-måneders fastholdelse, clawback, CPL og CAC.
8. Ingen annonceforbrug før målinger og stopregler er godkendt.
9. Kritisk: den eksisterende /forsikringstjek-side henviser til Topdanmark og sender til en Topdanmark-mail. Den må ikke bruges som partnerneutral kanal.
