import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { chromium } from "playwright";

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const videoExtensions = new Set([".mp4", ".mov", ".m4v", ".webm"]);

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith("--"));
const frameArg = args.find((arg) => arg.startsWith("--frames="));
const frames = Math.max(1, Number(frameArg?.split("=")[1] ?? 12));

if (!input) {
  console.error("Usage: pnpm diagnose:media -- \"C:\\path\\video.mp4\" --frames=12");
  process.exit(1);
}

const inputPath = path.resolve(input);
const extension = path.extname(inputPath).toLowerCase();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputRoot = path.resolve("work", "diagnostics", "media", `${path.basename(inputPath, extension)}-${stamp}`);

await fs.mkdir(outputRoot, { recursive: true });

if (imageExtensions.has(extension)) {
  await inspectImage(inputPath, outputRoot);
} else if (videoExtensions.has(extension)) {
  await inspectVideo(inputPath, outputRoot, frames);
} else {
  throw new Error(`Unsupported file type: ${extension}`);
}

console.log(`Diagnostics written to ${outputRoot}`);

async function inspectImage(filePath, outDir) {
  const image = sharp(filePath, { animated: true });
  const [metadata, stats] = await Promise.all([image.metadata(), image.stats()]);
  const report = {
    kind: "image",
    source: filePath,
    metadata,
    stats: summarizeStats(stats),
  };

  await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  await sharp(filePath).resize({ width: 1600, withoutEnlargement: true }).png().toFile(path.join(outDir, "preview.png"));
}

async function inspectVideo(filePath, outDir, frameCount) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const fileUrl = pathToFileURL(filePath).href;
  await page.setContent(`
    <html>
      <body style="margin:0;background:#111">
        <video id="video" src="${fileUrl}" muted playsinline preload="auto"></video>
        <canvas id="canvas"></canvas>
      </body>
    </html>
  `);

  const metadata = await page.evaluate(async () => {
    const video = document.getElementById("video");
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("Video metadata could not be loaded."));
      video.load();
    });
    return {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
    };
  });

  const usableDuration = Number.isFinite(metadata.duration) ? metadata.duration : 0;
  const times = Array.from({ length: frameCount }, (_, index) => {
    if (frameCount === 1) return 0;
    return (usableDuration * index) / (frameCount - 1);
  });

  const frameReports = [];

  for (let index = 0; index < times.length; index += 1) {
    const time = times[index];
    const dataUrl = await page.evaluate(async (targetTime) => {
      const video = document.getElementById("video");
      const canvas = document.getElementById("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      await new Promise((resolve, reject) => {
        const done = () => {
          video.removeEventListener("seeked", done);
          resolve();
        };
        video.addEventListener("seeked", done);
        video.onerror = () => reject(new Error("Video seek failed."));
        video.currentTime = Math.min(Math.max(targetTime, 0), Math.max(video.duration - 0.001, 0));
      });

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    }, time);

    const filename = `frame-${String(index + 1).padStart(3, "0")}-${time.toFixed(3)}s.png`;
    const buffer = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
    const file = path.join(outDir, filename);
    await fs.writeFile(file, buffer);

    const stats = await sharp(buffer).stats();
    frameReports.push({ index, timeSeconds: time, file, stats: summarizeStats(stats) });
  }

  await browser.close();

  const report = {
    kind: "video",
    source: filePath,
    metadata,
    frames: frameReports,
  };

  await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
}

function summarizeStats(stats) {
  return {
    channels: stats.channels.map((channel) => ({
      min: channel.min,
      max: channel.max,
      mean: Number(channel.mean.toFixed(3)),
      stdev: Number(channel.stdev.toFixed(3)),
    })),
    entropy: Number(stats.entropy.toFixed(4)),
    isOpaque: stats.isOpaque,
  };
}
