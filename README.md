# Sacred Veil Astro Website

Ez a mappa tartalmazza az Astro weboldal aktuális forrását és a frissen generált statikus buildet.

- Forrás: `src/`, `public/`, konfigurációs fájlok
- Kész statikus weboldal: `dist/`
- Függőségek újratelepítése: `pnpm install`
- Fejlesztői futtatás: `pnpm dev`
- Build: `pnpm build`

A `node_modules` mappa nincs exportálva, mert nagy és a `package.json` + `pnpm-lock.yaml` alapján újratelepíthető.
