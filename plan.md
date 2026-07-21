# Sacred Veil vegleges tartalmi csere terv

## Osszefoglalo

A `ContentChangePlan.docx` alapjan a Sacred Veil vegleges Astro projektjeben kell atvezetni a lathato weboldali szovegeket. A valtoztatasok kizarolag az Astro forrasfajlokban tortenjenek, hogy az `astro build` utan a `dist` mappa mar az uj vegleges tartalmat tartalmazza.

Nem cel a stilus, betutipus, szinvilag, layout-rendszer, portfolio mukodes, lightbox, vagy lace veil transition animacio atalakitasasa. Ha valamelyik uj szoveg nem fer el a jelenlegi helyen, akkor a szovegdobozt vagy kontenert kell tagitani, nem a betumeretet csokkenteni.

## Altalanos implementacios szabalyok

- A munka a `C:\Users\rolan\Desktop\Astro Website` projektben tortenjen.
- A `dist` mappa kezzel ne legyen szerkesztve; a vegeredmenyt az Astro build generalja.
- A shift+enter sortoreseket HTML-ben `<br />` elemekkel kell megtartani.
- A dupla sortoreses reszeket kulon bekezdeskent kell kezelni, hogy legyen koztuk lathato terkoz.
- A dokumentumban direkt kihagyott kozpontozast nem szabad javitani.
- A dolt betus `b` pontok instrukciok, nem megjelenitendo szovegek.
- A meglovo fontokat, szineket, animaciokat es vizualis rendszert nem szabad lecserelni.
- A regi szovegek torlese utan ne maradjon ures `h1`, `p`, `li`, vagy mas lathato ures elem.

## Komponens szintu elokeszites

### `src/components/PageHero.astro`

A `PageHero` komponens kezelje rugalmasabban a title/lead mezoket:

- A `title` legyen opcionallis. Ha nincs megadva vagy ures, a komponens ne rendereljen `h1` elemet.
- A `lead` legyen opcionallis. Ha nincs megadva vagy ures, a komponens ne rendereljen lead bekezdest.
- A `lead` elfogadhasson stringet vagy string tombot.
- String eseten maradjon a jelenlegi mukodes es stilus.
- Tomb eseten minden elem kulon bekezdeskent jelenjen meg ugyanabban a tipografiai stilusban.
- Egy lead stringen beluli `\n` sortores `<br />`-kent jelenjen meg.

Ez azert kell, mert a `Rolunk` oldalon a hero cim lathatoan torlendo, a lead pedig tobb bekezdesre valik, a `Portfolio` oldalon pedig a lead teljesen torlendo.

## Tartalmi cserek

### Fooldal - `src/pages/index.astro`

1. Hero eyebrow:
   - Regi: `Esküvői fotózás Magyarország`
   - Uj: `Esküvői fotózás Magyarországon és Európában`

2. Hero lead:
   - Regi: `Csendes figyelemmel, finom irányítással és elegáns képi világgal őrizzük meg azt a napot, amelyben minden pillantásnak története van.`
   - Uj:
     ```html
     Egy nap. Egy történet. Egy életre.<br />
     Őszintén, elegánsan és természetesen.
     ```

3. Bevezeto ket bekezdes:
   - Regi elso bekezdes: `Az esküvő napja nem sorozatba rendezett pózokról szól, hanem arról, hogyan érkeztek meg egymáshoz a részletek, gesztusok és csendes pillanatok között.`
   - Regi masodik bekezdes: `A Sacred Veil vizuális világa világos, elegáns és emberközeli. Fontos a jó fény, a tiszta kompozíció, a természetes mozdulat és az a nyugalom, amelyben a párok önmaguk maradhatnak.`
   - Uj elso bekezdes: `Minden pár más, ezért a fotózás sem lehet sablon. Van, akinek néhány kedves instrukció ad magabiztosságot, másoknak az a legfontosabb, hogy szinte észrevétlenül legyünk jelen. Mi mindíg hozzátok és a napotok ritmusához igazodunk.`
   - Uj masodik bekezdes: `Így születnek azok a képek, amelyek nem csak szépek, hanem rólatok szólnak és a ti történeteteket mesélik el életetek egyik legfontosabb napján.`

4. Csomagok szekcio eyebrow:
   - Regi: `Csomagok`
   - Uj: `A Signature Collection`

5. Csomagok szekcio cim:
   - Regi: `Rugalmas fotózási opciók a napotok méretéhez.`
   - Uj:
     ```html
     Öt különböző lehetőség, Egyetlen cél:<br />
     hogy a napotok pontosan úgy maradjon meg, ahogyan megéltétek.
     ```
   - Layout megjegyzes: ha szukseges, a cim koruli wrapper szelesitendo, peldaul `max-w-2xl` helyett `max-w-4xl`. Betumeret nem csokkentheto.

6. Sotet szekcio eyebrow:
   - Regi: `Amit ígérünk`
   - Uj: `Ami számunkra fontos`

7. Sotet szekcio cim:
   - Regi: `Diszkrét jelenlét, időtálló utómunka, átgondolt folyamat.`
   - Uj:
     ```html
     Kommunikáció<br />
     Felkészültség<br />
     Boldog párok
     ```

8. Sotet szekcio elso listaelem:
   - Regi: `A legfontosabb pillanatokat úgy fotózzuk, hogy közben a napotok természetes maradjon.`
   - Uj: `Ingyenes konzultáció biztosítunk mindenkinek mielőtt megegyeznénk. Számunkra nagyon fontos megismerni elképzeléseiteket, Egy esküvő nagy jelentőséggel bír mindenki életében, ezért mint szolgáltatónak nagy felelősség lesz a vállunkon. Abban az esetben, ha olyan elképzeléseitek vannak, amiket nem mi tudunk a legjobban megvalósítani, szeretnénk nektek segíteni, hogy megtaláljátok a tökéletes illetőt.`

9. Sotet szekcio masodik listaelem:
   - Regi: `Visszafogott színek, finom bőrányalatok és olyan képvilág, amely évek múlva sem tűnik divatnak.`
   - Uj: `Azonban, ha minket választotok, ennek a nagy felelősségnek jegyében mindent megteszünk, hogy a lehető legfelkészültebben legyünk ott a nagy napotokon és a legtöbbet hozzuk ki belőle.`

10. Sotet szekcio harmadik listaelem:
    - Regi: `Az első beszélgetéstől a galéria átadásáig pontos, nyugodt és emberi kommunikációra számíthattok.`
    - Uj: `Hiszen ekkor érjük el a legjobb eredményt és lesztek a legboldogabbak, ami a mi végső célunk.`

11. Kovetkezo lepes cim:
    - Regi: `Írjatok pár sort a napotokról, és segítek megtalálni a hozzátok illő fotózási opciót.`
    - Uj: `Írjátok meg elképzeléseiteket és elvárásaitokat, és találjuk meg együtt a hozzátok illő lehetőségeket, hogy méltó módon legyen megörökítve életetek egyik legfontosabb mérföldköve.`

### Footer - `src/components/Footer.astro`

Footer marka alatti szoveg:

- Regi: `Modern, letisztult és érzelmes esküvői fotózás magyar pároknak. Finom jelenlét, természetes pillanatok, elegáns képi világ.`
- Uj:
  ```html
  Egy nap. Egy történet. Egy életre.<br />
  Őszintén, elegánsan és természetesen.
  ```

### Rolunk oldal - `src/pages/rolunk.astro`

1. Hero cim:
   - Regi: `Nyugodt jelenlét a legfontosabb pillanatokban.`
   - Uj: ne legyen lathato hero cim.

2. Hero lead:
   - Regi: `A Sacred Veil nem csak képeket készít, hanem olyan emlékanyagot, amelyben a nap ritmusa, a kapcsolódások és a finom részletek együtt maradnak meg.`
   - Uj, ket kulon bekezdesben:
     - `Kedves Jegyespár!`
     - `Köszönjük, hogy időt szántok ránk, és megismerkedtetek a Sacred Veil világával.`

3. Bevezeto tartalom:
   - A regi ket bekezdes helyere az alabbi bekezdesek keruljenek:
     - `Ezen a ponton írhatnánk arról, hogy az őszinte pillanatokat keressük, hogy a háttérben maradunk, vagy hogy észre sem vesztek majd bennünket az esküvőtök napján. Bár mindez fontos számunkra, úgy gondoljuk ezek nem különleges ígéretek, hanem minden esküvői fotós munkájának alapjai.`
     - `A Sacred Veil nem csupán egy név, hanem egy bizonyos tartás: csendesebb, figyelmesebb, talán kissé régi vágású abban az értelemben, hogy egy fontos nap körül nem kell mindennek hangosnak lennie ahhoz, hogy súlya legyen.`
     - `Tudjuk, hogy egy esküvő mögött hónapok, sokszor évek szervezése áll. Helyszín, dekoráció, meghívók, ruha, vacsora, zene, torta, család, barátok és döntések; a gondosság nyomai, amellyel két ember megérkezik egy közös ünnepbe.`
     - `Mi ehhez szeretnénk méltón kapcsolódni, és semmiképpen sem elvenni belőle.`
     - `Ezért az első beszélgetés nálunk nem formaság: szeretnénk megérteni, milyen világot építetek arra a napra, milyen tempóban érzitek otthon magatokat, és hol van az a finom határ, ahol a jelenlétünk segítség. Az esküvőn nem rendezőként szeretnénk megjelenni, hanem olyan társaságként, amely odafigyel rátok; amikor szükséges, adunk kapaszkodót, amikor a nap magától beszél, inkább hallgatunk.`
     - `Azt szeretnénk, hogy később ne csak arra emlékezzetek, hogyan nézett ki az esküvőtök, hanem arra is, milyen volt benne lenni: a várakozásban, a meghatódásban, a nevetésekben, az egymás felé fordulásban.`
     - `Ha ez a gondolkodás közel áll hozzátok, örömmel ismerünk meg benneteket.`
     - `Szívből gratulálunk az eljegyzésetekhez, és sok boldogságot kívánunk,<br />A Sacred Veil csapata`

4. Kartya listaelem torlese:
   - Torolni kell ezt az egy listaelemet: `Biztonságos, nyugodt légkör a kamera előtt.`

5. Also bizalom / also tartalom cim:
   - Regi: `A jó esküvői fotózás már az első beszélgetésnél elkezdődik.`
   - Uj: `A jó esküvői képek keretét az első beszélgetés adja`

### Csomagok oldal - `src/pages/szolgaltatasok.astro`

1. Hero lead:
   - Regi: `Válasszatok a napotok ritmusához illő jelenlétet: rövid, letisztult polgári fotózástól a teljes napos esküvői történetmesélésig.`
   - Uj: `Találjuk meg a hozzátok illő és méltó Signature Collection-t: a rövid szertartás fotózásától a teljes napos esküvői történetmesélésig, hogy biztosan boldogan zárjátok a napot!`

2. Csomag intro cim:
   - Regi: `Öt csomag, egy közös alap: figyelmes jelenlét és gondosan átadott képek.`
   - Uj:
     ```html
     5 Kollekció<br />
     Egyetlen Sacred Veil élmény
     ```

### Portfolio oldal - `src/pages/portfolio.astro`

1. Hero cim:
   - Regi: `Valódi pillanatok, finoman rendezett ritmusban.`
   - Uj: `Sacred Signature Collection`

2. Hero lead:
   - Regi: `A galéria a páros portrék, szertartások, részletek és teljesebb jelenetek egyensúlyára épül, hogy a képi világ ne csak szép, hanem bizalomépítő is legyen.`
   - Uj: teljesen torlendo, ne jelenjen meg lead bekezdes.

### Kapcsolat oldal - `src/pages/kapcsolat.astro`

1. Hero cim:
   - Regi: `Meséljetek pár sort a napotokról.`
   - Uj: `Minden történet egy beszélgetéssel kezdődik`

2. Hero lead:
   - Regi: `Az ajánlatkéréshez nincs szükség ÁSZF elfogadására. A legfontosabb, hogy lássam, milyen fotózásban gondolkodtok, mikor és hol lesz az esemény.`
   - Uj: `A legfontosabb, hogy lássam, milyen fotózásban gondolkodtok, mikor és hol lesz az esemény.`

3. Uzenet textarea placeholder:
   - Regi: `Írjátok meg, milyen hangulatú napot terveztek, és mi lenne nektek fontos a fotózásban.`
   - Uj: `Írjátok meg elképzeléseitek és mire számítotok, valamint ami nektek fontos lenne az esküvőtök fotózásában.`

## Layout es stilus megjegyzesek

- A `PageHero` komponensben a hianyzo cim vagy lead ne okozzon ures terkozhibat.
- A Fooldal csomag szekcio uj ket soros cime hosszu; ha torik vagy szuk helyre szorul, a kontener szelesitendo.
- A Rolunk oldal uj bevezeto szovege jelentosen hosszabb; a szoveges blokk magassaga termeszetesen novekedhet.
- A sotet Fooldal szekcio uj listaelemei sokkal hosszabbak; ha a korabbi kartya vagy lista nem kezeli jol, a tartalom doboza novekedjen.
- A Portfolio oldalon lead nelkul a hero kep es cim spacingje maradjon vizualisan rendezett.

## Ellenorzesi terv

1. Futtatando:
   ```powershell
   pnpm run build
   ```

2. Regi szovegek keresese:
   ```powershell
   rg "Esküvői fotózás Magyarország|Nyugodt jelenlét a legfontosabb pillanatokban|Valódi pillanatok, finoman rendezett ritmusban|Az ajánlatkéréshez nincs szükség ÁSZF elfogadására" src
   ```
   A cserelt vagy torolt regi szovegek ne maradjanak meg a lathato tartalomban.

3. Manualis ellenorzes bongeszoben:
   - `index.html`
   - `rolunk.html`
   - `szolgaltatasok.html`
   - `portfolio.html`
   - `kapcsolat.html`

4. Vizualisan ellenorizendo:
   - A sortoresek ott jelennek meg, ahol a terv `<br />` elemet jelol.
   - A dupla sortoresek kulon bekezdeskent jelennek meg.
   - A Portfolio hero lead eltunt, nem maradt ures hely vagy ures bekezdes.
   - A Rolunk hero cim eltunt, nem maradt ures h1.
   - A Rolunk kartyabol csak a megjelolt listaelem torlodott.
   - A lace veil transition tovabbra is mukodik oldalvaltasnal.
   - A portfolio galeria es lightbox animaciok nem valtoztak.

## Feltetelezesek

- A Rolunk oldal hosszu uj szovege a hero utani bevezeto tartalomba kerul, a hero lead csak a koszonto ket rovid bekezdese lesz.
- A dokumentumban szereplo helyesirasi alakok, peldaul `mindíg`, valtozatlanul atvezetendok.
- A lathato szovegeken kivul meta title, alt text, aria label es technikai tartalom nem valtozik.
