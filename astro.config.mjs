import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  build: {
    format: "file"
  },
  integrations: [tailwind()],
  devToolbar: {
    enabled: false
  },
  site: "https://rkoppany.github.io",
  base: "/sacred-veil-preview/",
});
