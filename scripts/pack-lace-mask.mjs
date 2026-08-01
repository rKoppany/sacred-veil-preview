import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const inputs = ["lace-mask.png", "lace-mask-apple.png"];

for (const filename of inputs) {
  const sourcePath = path.resolve("public", filename);
  const isAppleMask = filename === "lace-mask-apple.png";
  const outputPath = path.resolve(
    "public",
    filename.replace(".png", isAppleMask ? "-packed.png" : "-packed.webp")
  );
  const source = sharp(sourcePath).ensureAlpha();
  const preparedSource = isAppleMask
    ? source.resize({
        width: 1536,
        fit: "inside",
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3
      })
    : source;
  const { data, info } = await preparedSource
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.alloc(info.width * info.height * 4);

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = ((y * info.width) + x) * 4;
      const alpha = data[index + 3];
      let outline = alpha;

      if (x > 0) outline = Math.max(outline, data[index - 1]);
      if (x + 1 < info.width) outline = Math.max(outline, data[index + 7]);
      if (y > 0) outline = Math.max(outline, data[index - (info.width * 4) + 3]);
      if (y + 1 < info.height) outline = Math.max(outline, data[index + (info.width * 4) + 3]);

      const outputIndex = ((y * info.width) + x) * 4;
      output[outputIndex] = outline;
      output[outputIndex + 1] = alpha;
      output[outputIndex + 2] = 0;
      output[outputIndex + 3] = 255;
    }
  }

  const packedImage = sharp(output, {
    raw: { width: info.width, height: info.height, channels: 4 }
  });

  if (isAppleMask) {
    await packedImage.png({
      compressionLevel: 9,
      adaptiveFiltering: true
    }).toFile(outputPath);
  } else {
    await packedImage.webp({
      lossless: true,
      effort: 6
    }).toFile(outputPath);
  }

  const stats = await fs.stat(outputPath);
  console.log(`${path.basename(outputPath)}: ${info.width}x${info.height}, ${Math.round(stats.size / 1024)} KiB`);
}
