# Gruppkontrakt

## Introduktion
Här är en mall för gruppkontraktet.

Ni väljer själva om ni vill jobba enligt agila metoder, men det är starkt rekommenderat att fortsätta öva på dessa kunskaper. Det ger också struktur till arbetet med backlog refining, planning poker, sprint planning och retrospektiv.

Det är fritt att lägga till/ta bort, men det finns en extremt tydlig koppling mellan välskrivna gruppkontrakt och väl utförda arbeten/portfolio cases.

## Kontraktets innehåll

### Tidigare grupparbeteserfarenheter
- Vilka är respektive gruppmedlems top 3 sämsta erfarenheter med grupparbeten? Vilka "negativa förväntningar" kommer ni in i detta med?

> Exempel: Personer gör inte det dom har lovat inom utsatt tid, och säger att "dom jobbar på det", men det blir aldrig klart.

> [!TIP]
> Det är bra att få ur sig de negativa förväntningarna och att diskutera öppet kring tidigare erfarenheter. Ju öppnare ni är i er kommunikation nu, desto bättre grupparbete kommer ni att få. På en arbetsplats kanske man känner varandra redan och det finns andra "krav". Av någon anledning beter sig många annorlunda i en skolmiljö när det gäller grupparbeten :thinking:

### Mötestider
Vilka dagar och tider jobbar vi gemensamt?

Ni ska planera in:

- Daily standup _varje vardag_. Det får gärna vara samma tid så att det är lätt att komma ihåg, men det är upp till gruppen att bestämma. Ni **ska** fylla i en loggbok dagligen med er daily.
- Tid för backlog refining varje vecka (cirka 1 h).
- Tid för sprint planning varje vecka (cirka 1-2 h).
- Tid för retrospektiv varje vecka (cirka 1 h).

### Möteskanaler & format
- Vi har möten/kontakt på Teams.
- Vi går igenom vad som ska göras på mötet
- Om någon stöter på några problem så kan man skriva i gruppchatten på Teams.

### Kommunikation
- Via vilka kanaler kommunicerar vi?
- Vilka tider kommunicerar vi?
- Inom vilken tidsfrist kan man förvänta sig svar/återkoppling?
- Hur meddelar man förhinder? I hur god tid meddelar man förhinder?
- Överväg att dela er mail/telefonnummer så att ni faktiskt kan nå varandra.
- Hur föredrar vi att jobba? Live-koda tillsammans? På egen hand?
- Ska vi göra kod-merges ihop? När är det OK att göra en merge?
- Hur hanterar vi kodkonflikter?
- Vem ansvarar för att dokumentera daily standup i repot? (Rotera gärna denna roll med någon frekvens så att inte en person gör det enbart).

### Feedback & återkoppling
- **Code review sker via pull requests.** `main` är skyddad: ingen pushar direkt dit, allt går via PR med minst ett godkännande.
- Reviewern läser diffen mot issuens acceptanskriterier — inte mot egen smak. Kommentarer ska vara konkreta och peka på rad.
- **Alla konversationer i en PR måste vara lösta innan merge** (aktiverat i branch protection).
- Nya commits på en redan granskad PR nollställer godkännandet, så granska om efter ändringar.
- **Tidsfrist:** en öppen PR ska få första återkoppling inom 24 timmar på vardagar. Ligger den längre får man påminna i Teams-chatten.
- Ingen mergear sin egen PR utan att någon annan har godkänt den.
- Feedback ges på arbetet, inte på personen. Skriv ut det som är bra också — en PR som bara får kritik är demotiverande, och det märks i gruppen.

### Personlighetstyp
> Det kan kännas obekvämt att diskutera följande, men det är en grund för ett bra samarbete att dels ha lite självinsikt, men också förståelse för hur ens gruppmedlemmar fungerar i olika situationer.

Hurdant reagerar varje gruppmedlem vid stress?
- Flyr situationen, slutar delta, ignorerar situationen/grupparbetet
- Blir konfrontativ/aggressiv
- Fryser till, vet inte vad man ska göra, svårt att komma igång och/eller vidare
- Försöker få alla att må bra/komma överens
- På något annat sätt?

Vilken roll brukar varje gruppmedlem ta på sig i ett grupparbete? Vilken roll har du "i det tysta" för dig själv?
- **Ledaren:** Drivande, dynamisk, tar initiativ.
- **Planeraren/Genomföraren:** Organiserad, praktisk, pålitlig
- **Experten/Specialisten:** Djup kunskap, fokuserad, analytisk
- **Informationssökaren:** Nyfiken, faktabaserad, samlar data
- **Slutföraren/Kvalitetssäkraren:** Noggrann, detaljfokuserad, avslutar i tid.
- **Innovatören/Idésprutan:** Kreativ, fantasifull, ser nya lösningar.
- **Granskaren/Utvärderaren:** Kritisk, strategisk, objektiv, logisk.
- **Djävulens advokat:** Utmanande, ifrågasätter konstruktivt.
- **Lagspelaren/Samordnaren:** Samarbetsvillig, diplomatisk, stöttande. - Anders
- **Pepparen:** Positiv, empatisk, skapar god stämning.
- **Dörrvakten/Processledaren:** Säkerställer deltagande, hanterar diskussionen.

### Uppgiftsfördelning
- Allt arbete ligger som **issues i repot**, grupperade i fem milstolpar (Sprint 0–4) som anger beroendeordning.
- Varje issue har en **spåretikett**: `track:chain`, `track:p2p`, `track:backend`, `track:frontend` eller `track:all`. Varje person äger ett spår och filtrerar på sin etikett.
- Man **tilldelar sig själv** issuen innan man börjar, så att ingen råkar göra samma sak. Det behöver inte vänta till daily standup — men nämn det i standupen dagen efter.
- Man tar en ny issue först när den förra är mergead.
- **Beroenden:** Sprint 0 ska vara klar innan Sprint 1 påbörjas. Blockkedjekärnan måste ligga före `auditLogger` och före allt i Sprint 2.

**Definition av "klar" (Definition of Done)**

En issue är klar när samtliga punkter är uppfyllda:

1. Acceptanskriterierna i issuen är uppfyllda.
2. Koden har tester, och alla tester går igenom.
3. `npm run lint` är rent.
4. En PR är öppnad, granskad och godkänd av minst en annan i gruppen.
5. PR:en är mergead till `main` och issuen är stängd via `Closes #N`.

Arbete som ligger kvar i en lokal branch är inte klart. "Nästan klart" finns inte.

### Övriga förväntningar
- Vilken ambitionsnivå har vi?
- Hur mycket förväntas man delta/hur aktivt ska man vara?
- Vad blir konsekvenserna om man inte är aktiv i projektet? Hur många kontaktförsök gör man? Hur snabbt ska personen återkomma som inte varit aktiv/gått att nå? Hur fort tar man kontakt med läraren om någon inte dyker upp/gör det man kommit överens om?
- Vad är du bra på?
- Vad är du sämre på?
- Finns det något du rent tekniskt vill träna extra på? HTMl, CSS, git? Projektledning?

### Scrum master
Utse gärna en scrum master som ansvarar för att _delegera_ uppgifter. Scrum mastern ska inte _göra allt_, utan se till att alla har att göra och att ingen sitter fast.

Vill ni rotera rollen, så gör det, men det går också bra om en person är bekväm med att ta på sig rollen.

Om ingen vill vara scrum master så bör ni komma överens om vem som styr skutan på annat sätt.

### Övrigt
Om ni vill ta upp någonting utöver det fördefinierade. Skriv gärna en egen rubrik.

### Kodstandard
- **Commit-meddelanden:** Conventional Commits — `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`. Imperativ form, på engelska.
- **Branch per issue:** `gh issue develop <nr> --checkout` skapar och länkar branchen automatiskt. Ingen arbetar direkt i `main`.
- **Merge-strategi:** squash merge, och branchen tas bort efter merge.
- **Kodspråk:** all kod, alla identifierare, kommentarer och commit-meddelanden på **engelska**. Diskussion i gruppen på svenska.
- **Indentering:** 2 mellanslag, aldrig tabbar. Prettier avgör i praktiken.
- **Kommentarer:** bara när *varför* inte är uppenbart. Kommentera inte det som koden redan säger.
- **Linters:** ESLint + Prettier, konfigureras i Sprint 0 (issue #7). Prettier äger formatering, ESLint äger regler — ingen överlappning dem emellan.
- **Mappstruktur:** varje spår äger sin egen katalog (`chain/`, `network/`, `backend/`, `frontend/`) så att merge-konflikter blir sällsynta.
- **Gemensamma typer och format** ligger i `docs/interfaces.md` och ändras bara efter överenskommelse i gruppen.
- **Projektets hårda regel:** inga patientuppgifter får någonsin hamna på blockkedjan — endast hashar och ID:n. Regeln bevakas av ett test som körs i CI (issue #27), inte av minnet.

**Hantering av kodkonflikter**
- Hämta `main` ofta (`git switch main && git pull`) så att brancher inte hinner driva isär.
- Konflikten löses av den som öppnade PR:en. Ligger konflikten i någon annans kod löser ni den tillsammans — gissa inte i kod du inte skrivit.

### Underskrifter
Slutligen ska ni signera dokumentet med era underskrifter.


## Att jobba i grupp

Jobba i grupp är knappast lätt.

Här kommer några tips:
- Bryt ner uppgifter så att de tar ungefär 1 halv dag att göra
- Skriv pseudokod för uppgifterna/förklara tydligt vad det innebär, gärna i grupp
- Våga fråga om hjälp. Våga säga att du inte kan någonting.
- Rak och öppen kommunikation är bäst: om någonting inte fungerar, ta upp det i gruppen, referera till era commitments och ställ frågor!
- Tystnad, frånvaro och icke-kommunikation är garanterade gruppproblems-utlösare :boom: :shushing_face:

---

> [!TIP]
> Det är bara jag som jobbar i gruppen! 😠
<details>
<summary>Det är bara jag som jobbar i gruppen! 😠</summary>
1. Kolla repots contribution graphs, och verifiera att det faktiskt är så.<br>
2. Fråga dina gruppmedlemmar, om de har kört fast med någonting och om ni ska kolla på någonting gemensamt, för att komma vidare.<br>
3. Om svaret istället är ursäkter i stil med "jag har inte hunnit pga. jobb/sjukdom/prioriterade annat/var tvungen att xyz" - OK. Shit business. Så kommer det att vara i verkliga livet också.<br>
4. Ta ett gruppmöte, gå igenom ert gruppkontrakt och punkt 5 nedan:<br>
5. Under gruppmötet, bryt gemensamt ner projektet i X antal uppgifter så att alla har lika många uppgifter var, bestäm vem som gör vad, och kör på med din del.<br>
6. Sedan jobbar du på med dina uppgifter.<br>

Alla är vuxna människor som går det här utbildningen och någonstans krävs det också eget engagemang och eget ansvar. En yrkeshögskoleutbildning ska ligga ganska nära arbetslivet, och fungerar inte gruppen och gruppdynamiken, så går man oftast till sin närmsta chef och tar upp problemet på ett konstruktivt sätt och med några förslag som man har tänkt igenom.

Struntar man dessutom att bidra till projektet så går man miste om värdefulla kunskaper såsom:

- Att arbeta i team (vilket man måste i arbetslivet)<br>
- Att arbeta i team i kod (det kommer vara brutalt, om man inte har tränat på det i skolan)<br>
- Att kommunicera om kod (det kommer också att vara brutalt om man inte tränar på det)<br>
- Kommunikation och hur man skapar en fungerande grupp; det är allas ansvar att bidra<br>
- Genom att förklara lär man sig otroligt mycket och blir en mycket bättre lagkamrat
</details>

---

> [!TIP]
> Vi har en strulig gruppmedlem
<details>
<summary>Vi har en strulig gruppmedlem</summary>
Se avsnittet om "Det är bara jag som jobbar i gruppen".
</details>

---

> [!TIP]
> De andra är så mycket duktigare än vad jag är
<details>
  <summary>De andra är så mycket duktigare än vad jag är</summary>
Så är det tyvärr i arbetslivet också, så här gäller det att ställa frågor, be om förklaringar och vara bekväm i att inte veta.

Ju bättre man kommunicerar och ambitiöst läser på; desto bättre blir slutresultatet.

Sitter man på sin kammare i tysthet så växer GARANTERAT frustrationen i gruppen.
</details>

---

> [!TIP]
> De andra är mycket sämre än vad jag är
<details>
<summary>De andra är mycket sämre än vad jag är</summary>
Så är det tyvärr i arbetslivet också. Omgiven av idioter.

Men alla har inte samma förkunskaper, förutsättningar och "logiska förmåga" out-of-the-box. Det tar ett tag att switcha om till programmeringstänk.

Se det som ett tillfälle för dig att lära dig kommunicera kring kod. Ju bättre man kan prata om och förklara kod, desto mer uppskattad kommer man att bli som team-medlem, och desto oftare hamnar man i (roliga och avancerade) projekt där det krävs bra samarbete och kommunikation för att det ska bli ett bra slutresultat. Fakta.
</details>
