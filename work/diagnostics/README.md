# Sacred Veil Diagnostics

Ez a mappa a helyi hibakereseshez keszult. A script-ek nem modositanak weboldal-tartalmat, csak riportokat es kepernyokepeket keszitenek.

## Media elemzes

Kepek vagy videok valodi kepi tartalmanak vizsgalata:

```powershell
pnpm.cmd diagnose:media -- "C:\Users\rolan\Desktop\video.mp4" --frames=12
```

Eredmeny:

- `work/diagnostics/media/.../report.json`
- videonal mintakepkockak `frame-001-...png` formatumban
- kepnel `preview.png`

## iPhone / iPad profil ellenorzes

Eloszor erdemes buildelni:

```powershell
pnpm.cmd build
```

Majd a `dist` mappabol automatikusan kiszolgalva:

```powershell
pnpm.cmd diagnose:devices
```

iPad profilokkal egyutt:

```powershell
pnpm.cmd diagnose:devices -- --include-ipad
```

WebKit es Chromium osszehasonlitassal:

```powershell
pnpm.cmd diagnose:devices -- --engine=both --include-ipad
```

Eredmeny:

- `work/diagnostics/devices/.../report.json`
- keszulekenkenti screenshot sorozat
- konzolhibak, sikertelen requestek, canvas-szam, URL, viewport es animacios allapotok

## Fontos korlat

A Playwright `iPhone X`, `iPhone 11` es `iPhone 14` profiljai a viewportot, DPR-t, touch beallitast es user-agentet emulaljak. Ez hasznos es gyors helyi ellenorzes, de nem azonos egy valodi iPhone GPU-val, Safari/WebKit rendszerintegracioval es iOS memoria-limitekkel. Teljes bizonyossaghoz valodi eszkozos teszt vagy cloud device farm szukseges.
