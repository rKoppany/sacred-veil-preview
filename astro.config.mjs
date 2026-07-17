import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

const site = process.env.ASTRO_SITE ?? "https://sacredveil.hu";
const base = process.env.ASTRO_BASE ?? "/";

export default defineConfig({
  build: {
    format: "file"
  },
  integrations: [tailwind()],
  devToolbar: {
    enabled: false
  },
  site,
  base
});
