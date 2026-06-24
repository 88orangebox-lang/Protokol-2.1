# HANDOFF — Protokol 2.1 — sekcia Nastavenia + Archív + ďalšie (pokračovanie)

> Tento súbor vlož ako prvý prompt do novej Claude Code session v projekte **Protokol-2.0**
> (`C:\Users\NOVO\Desktop\Clode code\Protokol-2.0`). Slúži na pokračovanie presne tam, kde sme skončili.
> Komunikuj so mnou po slovensky. Pracovný štýl: **najprv plán, potom kód; pýtať sa pred pushom; vysvetliť prečo.**

---

## 0. Rýchly kontext projektu

- **Appka:** PWA „Protokol o spustení klimatizácie" pre jedného technika. Jednosúborové `index.html` (CSS+JS inline) + `sw.js` + `lib/` (html5-qrcode, Tesseract).
- **GitHub:** `https://github.com/88orangebox-lang/Protokol-2.1` (public), nasadené cez GitHub Pages na `https://88orangebox-lang.github.io/Protokol-2.1/`.
- **Posledný commit:** `79fc095` (OCR pinch-zoom). Vetva `main`, sleduje origin.
- **Service Worker:** `CACHE_VERSION = 'v7'`. Bumpni iba ak meníš `sw.js` alebo pridávaš/meníš cachované súbory (napr. nový model).
- **Testovacie zariadenie:** Samsung Galaxy S24, Chrome ako PWA.
- **Workflow:** zmeny over v preview (`.claude/launch.json` → Python http.server :8000, `.claude/` je gitignored), commit lokálne, **pred `git push` sa opýtať**, po pushe počkať na test na zariadení.

### CHRÁNENÉ ZÓNY (TABU — nemeniť!)
- **Generovanie PDF obsahu** — `generateProtoHTML`, `@media print`, `#proto-print-content`/`#proto-modal-content`. *(POZOR: `doPrint()` len mení `document.title` pred `window.print()` — to MENIŤ SMIEM, to je názov súboru, nie obsah PDF.)*
- **Prideľovanie čísla okruhu** — `nextOkruh`, `getMaxOkruhForNext`, `rememberLastOkruh`, `selectOkruhType`, `updateOkruhBadge`.
- **Jadro `Store`** (get/set/getRaw/setRaw) a localStorage perzistencia.

### Existujúce localStorage kľúče (prefix `mpk_`)
- `mpk_protocols` (pole protokolov; každý má `id`, `savedAt`, `modifiedAt`, `deleted?`=tombstone), `mpk_draft` (rozrobený koncept), `mpk_technik_profil` (profil – spojený reťazec „Meno, Číslo"), `mpk_last_okruh_pov`/`mpk_last_okruh_bez` (okruh počítadlá), `mpk_theme`, `mpk_device_label`, `mpk_meta` ({modifiedAt:{protocols,profil}}), `mpk_last_sync_ms`, `mpk_drive_token` ({token,expiresAt}), `mpk_drive_email`, `mpk_drive_last`.

### Hotové doteraz (stručne)
Skener kódov (ML Kit `BarcodeDetector`) + OCR (Tesseract `tessdata_best`) + natívny foťák + galéria + pinch-zoom pri výreze; svetlý/tmavý režim; vyhľadávanie histórie; validácia; **kompletný Google Drive cloud sync (fázy 1–4):** verzované zálohy, listing, auto-push (debounce 10 min), pull-on-open, 3-way merge + konflikt dialóg s názvami zariadení, tombstones na mazanie, držanie tokenu + výstražný modál pri vypršaní. Podrobný popis sync logiky je v `C:\Users\NOVO\Desktop\EASYCENA_SYNC_LOGIKA.md` (vzor z EasyCeny).

---

## 1. ČO IDEME ROBIŤ (pending — odsúhlasený smer, čaká na pár upresnení)

Cieľ: zjednotiť appku vizuálne a funkčne s **EasyCenou** (rovnaký používateľ), pridať sekciu Nastavenia, sekciu Archív, lepšie tlačidlo „Nový protokol" a predvolený názov PDF. Všetko **aditívne**, chránené zóny nedotknuté.

### A) Sekcia „⚙️ Nastavenia" (nahradí terajší modál „Profil technika")
Jeden prehľadný modál/obrazovka s rozbaľovacími kartami (podľa EasyCeny — viď opis fotky 2 nižšie):
1. **Technik** — DVE samostatné polia: *Meno a priezvisko* + *Číslo osvedčenia*.
   - Ukladať zvlášť (napr. `mpk_technik_meno`, `mpk_technik_cislo`) + helper `technikSpojeny()` = `meno + (cislo ? ', ' + cislo : '')`.
   - Migrácia: existujúci `mpk_technik_profil` rozdeliť podľa **poslednej čiarky** na meno/číslo.
   - **Formulár protokolu (`#technik`) aj PDF ostanú nezmenené** — dostanú spojený reťazec (ako teraz). PDF generovanie NEMENIŤ.
2. **Cloud záloha (Google Drive)** — skonsolidovať sem: stav „✅ Prihlásený · email", tlačidlá **Zálohovať teraz** / **Obnoviť zo zálohy…** / **Odhlásiť sa** / (Prihlásiť sa keď odhlásený), pole **Názov tohto zariadenia** (presunúť zo sidebaru). Funkcie už existujú: `driveBackup`, `openDriveList`, `cloudReconnect`, `setCloudStatus`, indikátor `#cloud-status`. **Odhlásenie ešte NEEXISTUJE** — dorobiť: zmazať `mpk_drive_token` + `mpk_drive_email` (email sa maže LEN pri vedomom odhlásení!) + `setCloudStatus('logged-out')`.
3. **Predvolený názov PDF** — viď bod C.
4. **Lokálna záloha (JSON)** — export/import (už máme `exportBackup`/`importBackup`).
5. (voliteľne) **Vzhľad** — svetlý/tmavý (už máme `toggleTheme`).

### B) Technik – dve polia → v protokole/PDF spojené cez čiarku
Viď A.1. Kľúčové: PDF aj formulár dostávajú spojený reťazec, takže **PDF sa nemení**.

### C) Predvolený názov PDF (šablóna s automatickým doplnením)
- V nastaveniach textová šablóna s „premennými", napr. `{zakazka} - Protokol o spustení`.
- Pri tlači v `doPrint()` sa premenné nahradia z dát protokolu a výsledok sa dá do `document.title` (= navrhovaný názov súboru). **Nemení obsah PDF.**
- Tokeny na zváženie: `{zakazka}` (cislo_zakazky), `{zakaznik}` (priezvisko), `{datum}`, `{okruh}`.
- **OTVORENÁ OTÁZKA:** v príklade používateľa `Z2026001 - č.o.0001 - Protokol o spustení` — čo je „č.o.0001"? Protokol môže mať VIAC okruhov. Treba ujasniť: (a) číslo okruhu prvej klímy, (b) nové samostatné pole, alebo (c) vynechať. **Opýtať sa na začiatku.**

### D) Sekcia „📁 Archív"
- Zoznam protokolov (terajšia „História protokolov" v sidebari) ako samostatná, jasne pomenovaná sekcia s vyhľadávaním. Logika ostáva (`renderHistory`, `ziveProtokoly`, `loadById`, `deleteById`), len prehľadnejšie umiestnenie. EasyCena má dole tab-bar: Ponuka · Katalóg · Archív · Nastavenia — zvážiť podobný pattern (u nás: Protokol · Archív · Nastavenia), alebo ponechať sidebar a len pridať Nastavenia ako kartu.

### E) Tlačidlo „➕ Nový protokol" pri Náhľad/Vymazať + potvrdenie
- Pridať do hlavičky (`main-header` → `btn-group`) vedľa **Náhľad** a **Vymazať** (funkcia `newProtocol` už existuje, je v sidebari).
- Pri kliknutí confirm: *„Naozaj vytvoriť nový protokol? Neuložené zmeny v aktuálnom sa stratia — najprv ulož."* (prípadne detegovať neuložené zmeny porovnaním `collectData()` vs uložený protokol a varovať len vtedy).

### Navrhované poradie (samostatné commity, po každom test):
1. **Krok 1:** Tlačidlo „Nový protokol" + potvrdenie (malé, rýchle).
2. **Krok 2:** Sekcia Nastavenia (technik 2 polia + Google Disk konsolidácia + Odhlásiť + device label).
3. **Krok 3:** Predvolený názov PDF (šablóna).
4. **Krok 4:** Sekcia Archív (reorganizácia histórie).

---

## 2. REFERENČNÉ OBRÁZKY (EasyCena) — slovný opis (obrázky priložiť, viď bod 4)

### Obrázok 1 — Výstraha „Cloud záloha je odpojená" (in-form karta, NIE modal overlay)
- Hlavička: „Úprava ponuky ✏️", vpravo badge „💾 Uložené" + červený „🔒 Nesync." + prepínač tmavý/svetlý (mesiac).
- Veľké žlté tlačidlo „+ NOVÁ CENOVÁ PONUKA".
- Krokové taby: „1 KLIENT · 2 POLOŽKY · 3 PODMIENKY · 4 SÚHRN".
- **Výstražná karta (červený okraj):**
  - Nadpis červený: „⚠️ Cloud záloha je odpojená".
  - Sivý box s textom: „Prihlásenie do **Google Drive** vypršalo, takže **zálohy sa teraz nesynchronizujú**. Ak si na inom zariadení medzitým niečo zmenil, zmeny sa nestiahnu, kým sa znova neprihlásiš."
  - Žlto-orámované tlačidlo: „🔒 PRIHLÁSIŤ SA DO GOOGLE DRIVE" + podtext „OBNOVÍ PRIHLÁSENIE A STIAHNE NAJNOVŠIU ZÁLOHU."
  - Dim textové tlačidlo: „NESKÔR (PRIPOMENIE SA PRI ĎALŠOM OTVORENÍ)".
- Dole akčný bar: zelené „💾 ULOŽIŤ DO ARCHÍVU", sivé „📄 PDF", žlté „📤 ZDIEĽAŤ".
- Spodný tab-bar: **PONUKA · KATALÓG · ARCHÍV · NASTAVENIA** (ikony: edit, knihy, priečinok, ozubené koleso).
- **Pozn.:** EasyCena ukazuje výstrahu ako KARTU vnútri obsahu (nie overlay). Náš Protokol má teraz `#drive-expired-modal` (overlay) s rovnakými voľbami Prihlásiť/Neskôr → preštýlovať do tohto vzhľadu (červený okraj, žlté login tlačidlo, text presne ako vyššie).

### Obrázok 2 — Obrazovka NASTAVENIA (rozbaľovacie karty)
- Karta „📄 **Číslovanie a predvolené texty** / Formát čísla ponuky · poznámky do PDF" (›) — tu žije formát názvu/čísla + predvolené texty do PDF (náš ekvivalent = predvolený názov PDF).
- Karta „🎨 **Vzhľad aplikácie** / Tmavý / svetlý režim" (›).
- Karta „☁️ **Cloud záloha (Google Drive)**" (ROZBALENÁ, žltý okraj): „✅ Prihlásený · 88orangebox@gmail.com". Obsah:
  - „Prihlásený ako: **88orangebox@gmail.com**" (žlté).
  - „NÁZOV TOHTO ZARIADENIA" pole = „Mobil".
  - Zelené tlačidlo „💾 ZÁLOHOVAŤ TERAZ".
  - „Posledná záloha: 15.06.2026 16:39".
  - Sivé „💾 OBNOVIŤ ZO ZÁLOHY…".
  - Sivé „ODHLÁSIŤ SA".
- Karta „💾 **Lokálna záloha (JSON súbor)** / Export do JSON · import zo súboru" (›).
- Dole žlté „💾 ULOŽIŤ ZMENY".
- Spodný tab-bar: PONUKA · KATALÓG · ARCHÍV · **NASTAVENIA** (aktívne).

---

## 3. NA ZAČIATKU NOVEJ SESSION SA OPÝTAJ
1. **PDF názov „č.o."** — čo to je (číslo okruhu prvej klímy / nové pole / vynechať)? + aké tokeny chce v šablóne.
2. **Rozsah/poradie** — ísť podľa navrhnutého poradia (Nový → Nastavenia → PDF → Archív), alebo inak?
3. **Spodný tab-bar vs sidebar** — chce prejsť na EasyCena štýl (spodné taby Protokol/Archív/Nastavenia), alebo ponechať sidebar a pridať Nastavenia ako modál/kartu? (Ovplyvní to rozsah práce.)

---

## 4. OBRÁZKY — ako ich pridať do novej session
Claude nevie uložiť nahraté fotky na disk, takže ich tu mám len slovne. Sprav jedno z:
- **Najjednoduchšie:** v novej session po vložení tohto `.md` rovno **nahraj tie dve fotky znova** (výstraha + Nastavenia) a napíš „toto sú referenčné obrázky k handoffu".
- **Alebo:** ulož si ich do priečinka projektu (napr. `C:\Users\NOVO\Desktop\Clode code\Protokol-2.0\docs\easycena_vystraha.jpg` a `…\easycena_nastavenia.jpg`) a v novej session napíš cestu — Claude ich vie prečítať (Read tool zobrazí obrázky).

---

## 5. Ako pokračovať (postup)
1. Otvor novú Claude Code session v `C:\Users\NOVO\Desktop\Clode code\Protokol-2.0`.
2. Vlož tento súbor (alebo napíš `@HANDOFF_NASTAVENIA.md`).
3. Nahraj 2 referenčné fotky (bod 4).
4. Odpovedz na 3 otázky (bod 3).
5. Claude pripraví plán, po schválení ide po krokoch (commit + push po každom, s tvojím potvrdením pred pushom).
