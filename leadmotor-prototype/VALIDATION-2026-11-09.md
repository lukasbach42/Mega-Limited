# Intern leadvalidering – 9. november 2026

Tilføjet `lead-validation.mjs` og `lead-validation.test.mjs`: ren, sideeffektfri inputkontrol af dansk telefonnummer, postnummer, navn, samtykkemarkering, samtykkeversion, tidsstempel, kanal og UTM. Ukendte felter afvises, så følsomme ekstraoplysninger ikke accepteres utilsigtet. Kør lokalt med `node --test leadmotor-prototype/lead-validation.test.mjs`.

**Vigtigt:** At `consent === true` er ikke bevis for et gyldigt samtykke. Den faktiske samtykkeordlyd, formularversion, indsamlingstidspunkt, afsender, kanal, dokumenteret kundehændelse, lovligt kontaktgrundlag, Robinson/frabedelser, retention og mulighed for tilbagetrækning skal håndteres og juridisk godkendes server-side. Klientens `consent_at` må ikke være autoritativt; produktionsserveren skal selv tidsstemple og bevare audit trail. Ingen data sendes eller gemmes af dette modul.

**Ikke produktion:** Ingen HTTP-endpoint, krypteret kø, CRM, autentifikation, idempotens eller bookingkapacitet. Brug kun syntetiske testdata. Eksisterende Topdanmark-formular må ikke bruges til partnerneutrale leads. Ingen ændringer på main/live.

**Kontaktstatus:** Eir aktiv; øvrige tidligere bearbejdede partnere og leverandører er ikke nye leads. Ingen ny partner eller leverandør verificeret i denne tekniske leverance.
