import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const distDir = fileURLToPath(new URL("../dist/", import.meta.url));
const files = await readdir(distDir);

await Promise.all(
  files
    .filter((file) => file.endsWith(".html"))
    .map(async (file) => {
      const path = join(distDir, file);
      const html = await readFile(path, "utf8");
      const normalized = html
        .replaceAll('href="/_astro/', 'href="_astro/')
        .replaceAll('src="/_astro/', 'src="_astro/')
        .replaceAll('href="/./_astro/', 'href="_astro/')
        .replaceAll('src="/./_astro/', 'src="_astro/');

      if (normalized !== html) {
        await writeFile(path, normalized, "utf8");
      }
    })
);
