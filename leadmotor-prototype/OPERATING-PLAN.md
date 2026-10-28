# Mega leadmotor – operationel opsætning

## Arkitektur
Landingsside -> server-side HTTPS endpoint -> validering + samtykkebevis -> adgangsbeskyttet CRM -> opgavefordeling -> kontaktlog -> møde -> police -> 6-måneders retention. UTM bevares hele vejen. Ingen kundedata i GitHub, browser analytics eller usikre e-mails.

## Minimumskrav til lead
Navn, telefon, postnummer, kilde, formularversion, præcis samtykketekst, tidsstempel, ønsket kontaktvindue. Dubletter markeres. Dokumenter lovligt kontaktgrundlag og mulighed for tilbagekaldelse. Vurder særskilt telemarketingregler og Robinsonlisten før brug.

## KPI og stopregler
CPL = annonceudgifter / gyldige leads. Kontaktgrad = kontaktede / gyldige. Møderate = afholdte møder / gyldige. Salgsrate = udstedte policer / gyldige. CAC = total anskaffelsesudgift / udstedte policer. DB pr. police = partnerprovision minus sælgerbetaling minus leadanskaffelse minus forventet clawback minus variable driftsudgifter. Skal kunne filtreres på kanal, kampagne og sælger.

## Pilotdesign
Før betalt trafik: test 10 syntetiske cases, adgangsrettigheder, 2 dubletter, 1 tilbagetrukket samtykke og 1 fejlet CRM-levering. Efter godkendelse: begrænset budget og fast stopgrænse ud fra faktiske økonomital. Ingen Meta-afhængighed: organiske kanaler og partnergodkendt distributionsmodel testes først.

## Uafklaret før aktivering
Sikker endpoint/CRM og hosting, juridisk godkendt samtykke og privacy notice, aktiv partner-/produktpositionering, hvem der modtager leads, bookingkapacitet og budget. Eksisterende Topdanmark-formular må ikke bruges til nye partnerneutrale leads.
