import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { devices, webkit } from "playwright";

const port = 4384;
const root = path.resolve("dist");
const server = await startServer(root, port);
const profiles = ["iPhone 11", "iPhone 14", "iPad (gen 6)"];
const results = [];

try {
  for (const profile of profiles) {
    results.push(await checkProfile(profile));
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const output = path.resolve("work", "diagnostics", "apple-network-latest.json");
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
  const requests = [];
  const failures = [];
  const startedAt = performance.now();

  page.on("request", (request) => {
    const url = new URL(request.url());
    requests.push({
      path: url.pathname,
      resourceType: request.resourceType(),
      startedMs: Math.round(performance.now() - startedAt),
      status: "pending",
    });
  });
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    const record = [...requests].reverse().find((item) => item.path === pathname && item.status === "pending");
    if (record) {
      record.responseMs = Math.round(performance.now() - startedAt);
      record.status = response.status();
    }
  });
  page.on("requestfailed", (request) => failures.push(`${request.url()} (${request.failure()?.errorText})`));
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));

  try {
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(900);
    const menu = page.locator("[data-menu-button]");
    if (await menu.isVisible()) await menu.tap();
    const portfolioLink = page.locator('a[href$="portfolio.html"]:visible').first();
    const tapAt = performance.now();
    await portfolioLink.tap({ timeout: 5000 });
    await page.waitForURL(/portfolio\.html$/, { timeout: 20000 });
    const navigationMs = Math.round(performance.now() - tapAt);
    await page.waitForTimeout(4000);

    const state = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".portfolio-card"));
      const images = cards.map((card) => card.querySelector("img"));
      const visible = images.filter((image) => {
        if (!(image instanceof HTMLImageElement)) return false;
        const rect = image.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < innerHeight;
      });
      return {
        bound: document.querySelector("[data-portfolio-masonry]")?.getAttribute("data-portfolio-bound"),
        cards: cards.length,
        columns: document.querySelector("[data-portfolio-masonry]")?.getAttribute("data-columns"),
        enhanced: document.querySelector("[data-portfolio-masonry]")?.classList.contains("is-enhanced"),
        sourced: images.filter((image) => image?.getAttribute("src")).length,
        loaded: images.filter((image) => image?.complete && image.naturalWidth > 0).length,
        visible: visible.length,
        visibleLoaded: visible.filter((image) => image.complete && image.naturalWidth > 0).length,
      };
    });

    return {
      profile,
      navigationMs,
      state,
      requestCounts: {
        html: requests.filter((item) => item.path.endsWith(".html")).length,
        thumbnails: requests.filter((item) => item.path.includes("/portfolio-thumbs/")).length,
        fullImages: requests.filter((item) => item.path.includes("/portfolio-full/")).length,
        appleMask: requests.filter((item) => item.path.includes("lace-mask-apple-packed")).length,
        html2canvas: requests.filter((item) => item.path.includes("html2canvas")).length,
      },
      criticalRequests: requests.filter((item) =>
        item.path.endsWith(".html") ||
        item.path.includes("portfolio-thumbs") ||
        item.path.includes("portfolio-full") ||
        item.path.includes("lace-mask-apple-packed") ||
        item.path.includes("html2canvas")
      ),
      failures,
    };
  } catch (error) {
    return { profile, error: error.message, requests, failures };
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
      const isLargeAsset = data.length > 150_000;
      if (isLargeAsset) await new Promise((resolve) => setTimeout(resolve, 180));
      response.writeHead(200, {
        "Content-Type": contentType(file),
        "Cache-Control": "no-store",
        "Content-Length": data.length,
      });
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
