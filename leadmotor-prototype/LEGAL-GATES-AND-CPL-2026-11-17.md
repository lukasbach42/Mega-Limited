# Mega – beslutningsgate for lovligt leadflow (17.11.2026)

Status: intern specifikation, IKKE juridisk godkendelse eller produktionsklar integration.

## Vigtig korrektion
Undtagelsen fra forbuddet mod uanmodet telefonsalg af forsikringer er IKKE et generelt samtykke til at indsamle, købe eller videregive personoplysninger. Kontaktlovlighed og GDPR-behandlingsgrundlag er separate gates. Databeskyttelseslovens § 13 kan kræve særskilt vurdering ved overdragelse til markedsføring. Robinson/frabedelser skal kontrolleres før opkald, og indsigelser skal straks respekteres.
Kilder: https://www.datatilsynet.dk/regler-og-vejledning/markedsfoering-og-profilering- ; https://www.datatilsynet.dk/afgoerelser/afgoerelser/2020/jun/videregivelse-af-kundeoplysninger-til-brug-for-direkte-markedsfoering ; https://forbrugerombudsmanden.dk/find-sager/sager/markedsfoeringsloven/sager-efter-markedsfoeringsloven/paatraengendemarkedsfoering/1903979-virksomhed-vedtog-boede-paa-100000-kr-for-telefoniske-henvendelser-til-forbrugere-der-havde-frabedt-sig-direkte-markedsfoering

## Minimumsflow
1. Intake: registrer leverandør/CVR, kilde-URL, kampagne, leadtype, indsamlingstidspunkt, privatlivstekst-version, samtykke-/anmodningstekst, dataansvar og videregivelsesgrundlag. Manglende dokumentation = karantæne, ikke ringekø.
2. Valider telefon, dublet og dataminimering; HMAC-fingeraftryk må ikke erstatte krypteret adgangsstyret lagring.
3. Før ringekø: dokumentér Robinson-/frabedelsestjek, tidspunkt, grundlag, ansvarlig og udløb/genkontrol. Ukendt status = blokeret.
4. Ved indsigelse: stop markedsføring, registrer suppression på tværs af kilder og underret relevante databehandlere efter aftale.
5. Mål fra rålead -> gyldigt -> lovligt kontaktbart -> kontakt -> møde -> police -> aktiv 6 mdr. -> modregning. Ingen udbetaling tælles som endeligt tjent før clawback-vinduet.

## Unit economics – eksplicit model
Årspræmie P, partnerprovision r, sælgerandel s af provision, forventet clawback c, rålead-til-police q, øvrig variabel omkostning pr. police V, ønsket DB pr. police D:
**Maks rå-CPL = q × [P × r × (1-s) × (1-c) - V - D] - øvrige variable omkostninger pr. rålead.**
Alternativt hvis kontaktgrad a, kontakt-til-møde b og møde-til-police d: q = a×b×d, men ugyldige leads skal kun fratrækkes én gang.
Illustration (IKKE målte tal): P=10.000, r=.25, s=.20, c=.05, q=.126, V=1.296, D=0 giver 76,23 kr. pr. rålead; præcis 76,07 kræver andre dokumenterede omkostningsantagelser. Forhandlings-CPL skal ligge UNDER break-even med sikkerhedsmargin.

## Partnerkvalificering
Kræv dokumenteret adgang til indbo, bil, hus, ulykke og relevante tillægsprodukter; underwriting, kapacitet, compliance, provisionsgrundlag, ejerforhold til portefølje, leads, clawback, ophør, eksklusivitet og operationel opstart før 01.02.2027. Ingen tidligere kontaktede virksomheder/personer genintroduceres som nye.

## Leverandørgate
Ingen anbefaling før verificeret CVR, drift, dokumenteret kunderejse og kontaktgrundlag, delt/eksklusivt lead, reel pris, returret og forsikringsspecifik leverance. Ingen produktion eller annonceforbrug godkendt.
