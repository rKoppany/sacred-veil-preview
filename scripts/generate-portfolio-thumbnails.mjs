import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceDirectory = path.resolve("public", "images", "portfolio-full");
const targetDirectory = path.resolve("public", "images", "portfolio-thumbs");
const supportedExtensions = new Set([".jpg", ".jpeg"]);

await fs.mkdir(targetDirectory, { recursive: true });

const entries = await fs.readdir(sourceDirectory, { withFileTypes: true });
const sourceFiles = entries.filter(
  (entry) => entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase())
);

await Promise.all(
  sourceFiles.map(async (entry) => {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetName = `${path.basename(entry.name, path.extname(entry.name))}.webp`;
    const targetPath = path.join(targetDirectory, targetName);
    const [sourceStat, targetStat] = await Promise.all([
      fs.stat(sourcePath),
      fs.stat(targetPath).catch(() => null)
    ]);

    if (targetStat && targetStat.mtimeMs >= sourceStat.mtimeMs) {
      return;
    }

    await sharp(sourcePath)
      .rotate()
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toFile(targetPath);
  })
);

console.log(`${sourceFiles.length} portfolio thumbnail ready in ${targetDirectory}`);
