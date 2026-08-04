import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceDirectory = path.resolve("public", "images", "portfolio-full");
const targetDirectory = path.resolve("public", "images", "portfolio-thumbs");
const displayDirectory = path.resolve("public", "images", "portfolio-display");
const supportedExtensions = new Set([".jpg", ".jpeg"]);

await fs.mkdir(targetDirectory, { recursive: true });
await fs.mkdir(displayDirectory, { recursive: true });

const entries = await fs.readdir(sourceDirectory, { withFileTypes: true });
const sourceFiles = entries.filter(
  (entry) => entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase())
);

await Promise.all(
  sourceFiles.map(async (entry) => {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetName = `${path.basename(entry.name, path.extname(entry.name))}.webp`;
    const targetPath = path.join(targetDirectory, targetName);
    const displayPath = path.join(displayDirectory, targetName);
    const [sourceStat, targetStat, displayStat] = await Promise.all([
      fs.stat(sourcePath),
      fs.stat(targetPath).catch(() => null),
      fs.stat(displayPath).catch(() => null)
    ]);

    if (!targetStat || targetStat.mtimeMs < sourceStat.mtimeMs) {
      await sharp(sourcePath)
        .rotate()
        .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toFile(targetPath);
    }

    if (!displayStat || displayStat.mtimeMs < sourceStat.mtimeMs) {
      await sharp(sourcePath)
        .rotate()
        .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 84, effort: 4 })
        .toFile(displayPath);
    }
  })
);

console.log(`${sourceFiles.length} portfolio images ready in ${targetDirectory} and ${displayDirectory}`);
