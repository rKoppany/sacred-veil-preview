import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { devices, webkit } from "playwright";

const port = 4382;
const root = path.resolve("dist");
const profiles = ["iPhone 11", "iPhone 14", "iPad (gen 6)"];
const server = await startServer(root, port);
const results = [];

try {
  for (const profile of profiles) {
    results.push(await checkProfile(profile));
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const output = path.resolve("work", "diagnostics", "apple-regression-latest.json");
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(results, null, 2), "utf8");
console.log(JSON.stringify(results, null, 2));

async function checkProfile(profile) {
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    ...devices[profile],
    locale: "hu-HU",
    reducedMotion: "no-preference",
    timezoneId: "Europe/Budapest",
  });
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => failures.push(`request: ${request.url()} (${request.failure()?.errorText})`));

  try {
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle", timeout: 30000 });
    const menu = page.locator("[data-menu-button]");
    if (await menu.isVisible()) await menu.tap();

    const portfolioLink = page.locator('a[href$="portfolio.html"]:visible').first();
    const start = performance.now();
    await portfolioLink.tap({ timeout: 5000 });
    await page.waitForURL(/portfolio\.html$/, { timeout: 12000 });
    const navigationMs = performance.now() - start;
    await page.waitForTimeout(5200);

    const portfolio = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".portfolio-card"));
      const images = cards.map((card) => card.querySelector("img"));
      const visibleImages = images.filter((image) => {
        if (!(image instanceof HTMLImageElement)) return false;
        const rect = image.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < innerHeight;
      });
      return {
        cardCount: cards.length,
        columns: document.querySelector("[data-portfolio-masonry]")?.getAttribute("data-columns"),
        loadedVisible: visibleImages.filter((image) => image.complete && image.naturalWidth > 0).length,
        sourcedVisible: visibleImages.filter((image) => Boolean(image.currentSrc || image.src)).length,
        visibleCount: visibleImages.length,
      };
    });

    const initialLayoutAnimations = await page.evaluate(() => document.getAnimations().filter((animation) => {
      const target = animation.effect?.target;
      return target instanceof HTMLElement && !target.closest(".portfolio-wall");
    }).length);

    const beforeWidth = page.viewportSize()?.width ?? 0;
    const beforeHeight = page.viewportSize()?.height ?? 0;
    await page.setViewportSize({ width: beforeHeight, height: beforeWidth });
    await page.waitForTimeout(100);
    const rotationLayoutAnimations = await page.evaluate(() => document.getAnimations().filter((animation) => {
      const target = animation.effect?.target;
      return target instanceof HTMLElement && !target.closest(".portfolio-wall");
    }).length);

    return {
      profile,
      navigationMs,
      finalUrl: page.url(),
      portfolio,
      initialLayoutAnimations,
      rotationLayoutAnimations,
      failures,
    };
  } catch (error) {
    return { profile, error: error.message, finalUrl: page.url(), failures };
  } finally {
    await browser.close();
  }
}

async function startServer(directory, listenPort) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://127.0.0.1:${listenPort}`);
      const clean = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
      const file = path.resolve(directory, clean);
      if (!file.startsWith(directory)) throw new Error("Forbidden");
      const data = await fs.readFile(file);
      response.writeHead(200, { "Content-Type": contentType(file), "Cache-Control": "no-cache" });
      response.end(data);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(listenPort, "127.0.0.1", resolve));
  return server;
}

function contentType(file) {
  return {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  }[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}
