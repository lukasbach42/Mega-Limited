# Mega – leverandørverifikation og pilotbeslutning (6. november 2026)

**Intern arbejdsfil. Status: ingen leverandør godkendt.** Ingen eksterne kontakter, persondata, betalinger eller live-ændringer.

## Dokumentationsregister – udfyld én række pr. NY kandidat
| Felt | Krav | Verifikationsstatus |
|---|---|---|
| Juridisk enhed | Juridisk navn, CVR, aktiv status, CVR-kilde, dato | Mangler |
| Forsikringsrelevans | Dansk privatforsikring (bil, indbo, hus, ulykke), konkret produkt og kunderejse | Mangler |
| Lead-oprindelse | URL, annoncer, formular, fuld samtykkeordlyd og versionshistorik | Mangler |
| Lovligt kontaktgrundlag | Dokumenteret lovlig behandling, kontaktformål, frabedelser/Robinson-håndtering | Mangler |
| Deling | Eksklusivt eller antal modtagere, genbrug, videresalg og dataroller | Mangler |
| Volumen | Faktisk leverede danske privatforsikringsleads sidste 30/90 dage, ikke salgspåstand | Mangler |
| Pris | DKK pr. rålead og pr. godkendt lead, moms, minimum, binding, refundering | Mangler |
| Drift | Leveringsformat, SLA, svartid, dubletkontrol, afmeldinger og fejlhåndtering | Mangler |
| Reference | Dokumenterbar aktuel drift og sammenlignelig kundecase | Mangler |

**Gate:** Ingen kandidat anbefales til outreach eller pilot, før kritiske forhold er verificeret. Et CVR alene er ikke kvalitetsbevis.

## Økonomisk acceptregel
Antagelser fra Mega-rapport og tidligere intern analyse: gennemsnitlig årspræmie 10.000 kr., nettoprovision 25 %, vægtet sælgerbetaling 17,7126 %, 5 % fuldt provisionsclawback uden sælgerregres, 60 % kontaktgrad og 21 % salg blandt kontaktede. Øvrige variable omkostninger antaget 0 kr. i referencen (skal måles).

- Netto før acquisition pr. police: 10.000 × (0,25 − 0,177126 − 0,05 × 0,25) = **603,74 kr.**
- Rålead→police ved 100 % gyldige: 1 × 0,60 × 0,21 = **12,60 %**.
- Break-even CPL = 603,74 × 0,126 = **76,07 kr.** (før øvrige omkostninger).
- Ved 2/3 gyldige leads: break-even CPL = 603,74 × (2/3) × 0,60 × 0,21 = **50,71 kr.**
- Ved mål om 500 kr. DB pr. police: maksimal CPL **13,07 kr.** (100 % gyldige) eller **8,71 kr.** (2/3 gyldige).
- **Konservativ intern pilotgrænse:** Brug ikke teoretisk break-even som indkøbspris. Ukendt konvertering, modregning, bookerbetaling, telefoni og platform kan gøre selv 50 kr. urentabelt.

### Beregn på den rigtige enhed
`NettoDB pr. police = P × (r_partner − r_sælger − p_clawback × (r_partner − r_sælger × recoverable_fraction)) − øvrige variable omkostninger − CPL / (gyldigandel × kontaktgrad × salgsrate)`

Her er `recoverable_fraction` den del af sælgerprovisionen, der faktisk kan genindvindes ved clawback (0 i konservativ reference). Formel kræver særskilt vurdering af præmie-/provisionsperiodisering og delvise modregninger. Brug kun aggregerede, anonymiserede kohorter.

## Pilot – stop/go uden binding
1. Før betaling: CVR, samtykkedokumentation, lead-eksklusivitet, priser, refundering og teknisk integration skriftligt bekræftet; juridisk godkendelse.
2. Start med syntetisk testflow: gyldigt lead, ugyldigt telefonnummer, dublet, tilbagekaldt samtykke, CRM-nedbrud, bookingkonflikt, police, seksmåneders clawback.
3. Først efter særskilt godkendelse: afgrænset rigtig pilot med måling af rå CPL, gyldigandel, kontaktgrad, policer og forventet DB pr. police.
4. **Stop** hvis samtykkebevis mangler, leverandøren videresælger i strid med aftalen, CRM taber leads, eller estimeret DB bliver negativt ved realistisk konvertering.

## Partner-gate og kontaktstatus
Kendte bearbejdede spor er ikke nye: If/Topdanmark, Himmerland, Forsia, Gjensidige, Købstædernes, Forsikr, Forsikringsportalen; Alm. Brand og Codan er fravalgt; Eir er aktivt. Tidligere research/screening omfatter bl.a. Insurance Partners, RISB, MNK, ERGO, Wakam, Spira og Accelerant. Disse må ikke genintroduceres som nye uden en konkret udvikling. Før en ny beslutningstager navngives, sammenholdes fuld historik og kontaktlog.

**Vigtigste næste tekniske leverance:** En krypteret server-side kø/CRM-integration med idempotent modtagelse, samtykkeaudit, rollebaseret adgang, sikker sletning og testet genforsøg. Ingen produktionsdata før juridisk og sikkerhedsmæssig godkendelse.
