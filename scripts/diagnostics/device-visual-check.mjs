import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { webkit, chromium, devices } from "playwright";

const args = process.argv.slice(2);
const explicitUrl = args.find((arg) => /^https?:\/\//i.test(arg));
const includeIpad = args.includes("--include-ipad");
const force2d = args.includes("--force-2d");
const noScreenshots = args.includes("--no-screenshots");
const hideRevealMask = args.includes("--hide-reveal-mask");
const simpleShader = args.includes("--simple-shader");
const skipWebGLDraw = args.includes("--skip-webgl-draw");
const hideTransitionLayers = args.includes("--hide-transition-layers");
const hideWebGLCanvas = args.includes("--hide-webgl-canvas");
const hideSnapshotFade = args.includes("--hide-snapshot-fade");
const absoluteWebGLCanvas = args.includes("--absolute-webgl-canvas");
const disableCanvasContain = args.includes("--disable-canvas-contain");
const transferWebGLTo2D = args.includes("--transfer-webgl-to-2d");
const renderPixels = Number(args.find((arg) => arg.startsWith("--render-pixels="))?.split("=")[1] ?? 0);
const engineArg = args.find((arg) => arg.startsWith("--engine="))?.split("=")[1] ?? "webkit";
const explicitDevice = args.find((arg) => arg.startsWith("--device="))?.slice("--device=".length);
const port = Number(args.find((arg) => arg.startsWith("--port="))?.split("=")[1] ?? 4380);
const baseDir = path.resolve(args.find((arg) => arg.startsWith("--dir="))?.split("=")[1] ?? "dist");

const engines = engineArg === "both" ? ["webkit", "chromium"] : [engineArg];
const deviceNames = explicitDevice
  ? [explicitDevice]
  : ["iPhone X", "iPhone 11", "iPhone 14"];

if (includeIpad && !explicitDevice) {
  deviceNames.push("iPad (gen 6)", "iPad Pro 11");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputRoot = path.resolve("work", "diagnostics", "devices", stamp);
await fs.mkdir(outputRoot, { recursive: true });

let server;
let url = explicitUrl;

if (!url) {
  server = await startStaticServer(baseDir, port);
  url = `http://127.0.0.1:${port}/index.html`;
}

const report = {
  url,
  forcedCanvas2d: force2d,
  screenshotsDisabled: noScreenshots,
  revealMaskDisabled: hideRevealMask,
  simpleShader,
  skipWebGLDraw,
  hideTransitionLayers,
  hideWebGLCanvas,
  hideSnapshotFade,
  absoluteWebGLCanvas,
  disableCanvasContain,
  transferWebGLTo2D,
  renderPixels: renderPixels || null,
  note: "Playwright device profiles emulate viewport, DPR, touch, and UA. They are not true iOS hardware or Mobile Safari.",
  runs: [],
};

try {
  for (const engine of engines) {
    for (const deviceName of deviceNames) {
      const run = await runDeviceCheck(engine, deviceName, url, outputRoot, force2d, noScreenshots, hideRevealMask, renderPixels, simpleShader, skipWebGLDraw, hideTransitionLayers, hideWebGLCanvas, hideSnapshotFade, absoluteWebGLCanvas, disableCanvasContain, transferWebGLTo2D);
      report.runs.push(run);
    }
  }
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
}

await fs.writeFile(path.join(outputRoot, "report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(`Device diagnostics written to ${outputRoot}`);

async function runDeviceCheck(engine, deviceName, targetUrl, root, forceCanvas2d, skipScreenshots, disableRevealMask, targetRenderPixels, useSimpleShader, skipDraw, hideLayers, hideVeilCanvas, hideFadeCanvas, useAbsoluteWebGLCanvas, removeCanvasContain, transferTo2D) {
  const browserType = engine === "chromium" ? chromium : webkit;
  const device = devices[deviceName];

  if (!device) {
    return { engine, deviceName, error: "Unknown Playwright device profile." };
  }

  const dir = path.join(root, `${engine}-${safeName(deviceName)}`);
  await fs.mkdir(dir, { recursive: true });

  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    ...device,
    reducedMotion: "no-preference",
    colorScheme: "light",
    locale: "hu-HU",
    timezoneId: "Europe/Budapest",
  });
  const page = await context.newPage();

  await page.addInitScript(({ forceCanvas2d, disableRevealMask, targetRenderPixels, useSimpleShader, skipDraw, hideLayers, hideVeilCanvas, hideFadeCanvas, useAbsoluteWebGLCanvas, removeCanvasContain, transferTo2D }) => {
    if (transferTo2D) {
      window.__veilDiagnosticTransferWebGLTo2D = true;
    }
    if (Number.isFinite(targetRenderPixels) && targetRenderPixels > 0) {
      window.__veilDiagnosticRenderPixels = targetRenderPixels;
    }

    if (useSimpleShader) {
      window.__veilDiagnosticSimpleShader = true;
    }

    if (skipDraw) {
      window.__veilDiagnosticSkipWebGLDraw = true;
    }

    if (hideLayers || hideVeilCanvas || hideFadeCanvas) {
      const hideTransitionSurfaces = () => {
        const selectors = hideLayers
          ? ".veil-canvas-transition, .veil-snapshot-fade, .page-reveal-mask"
          : [hideVeilCanvas ? ".veil-canvas-transition" : "", hideFadeCanvas ? ".veil-snapshot-fade" : ""]
              .filter(Boolean)
              .join(", ");
        document.querySelectorAll(selectors).forEach((surface) => {
          surface.style.setProperty("display", "none", "important");
        });
      };
      new MutationObserver(hideTransitionSurfaces).observe(document, { childList: true, subtree: true });
      window.addEventListener("DOMContentLoaded", hideTransitionSurfaces);
    }

    if (useAbsoluteWebGLCanvas || removeCanvasContain) {
      const adjustTransitionSurface = () => {
        document.querySelectorAll(".veil-canvas-transition").forEach((surface) => {
          if (useAbsoluteWebGLCanvas) {
            surface.style.setProperty("position", "absolute", "important");
            surface.style.setProperty("top", `${window.scrollY}px`, "important");
          }
          if (removeCanvasContain) {
            surface.style.setProperty("contain", "none", "important");
          }
        });
      };
      new MutationObserver(adjustTransitionSurface).observe(document, { childList: true, subtree: true });
      window.addEventListener("DOMContentLoaded", adjustTransitionSurface);
    }

    window.__veilDiagnostics = {
      activeFrames: [],
      renderers: [],
      firstActiveAt: null,
      lastActiveAt: null,
      tapAt: null,
      firstCanvasAt: null,
    };

    if (forceCanvas2d) {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function patchedGetContext(type, ...contextArgs) {
        if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
          return null;
        }
        return originalGetContext.call(this, type, ...contextArgs);
      };
    }

    if (disableRevealMask) {
      const hideMasks = () => {
        document.querySelectorAll(".page-reveal-mask").forEach((mask) => {
          mask.style.setProperty("display", "none", "important");
        });
      };

      new MutationObserver(hideMasks).observe(document, { childList: true, subtree: true });
      window.addEventListener("DOMContentLoaded", hideMasks);
    }

    const sample = (now) => {
      const diagnostics = window.__veilDiagnostics;
      const isActive = document.body?.classList.contains("is-page-turning") ?? false;

      if (isActive) {
        diagnostics.firstActiveAt ??= now;
        diagnostics.lastActiveAt = now;
        diagnostics.activeFrames.push(now);
        document.querySelectorAll(".veil-canvas-transition").forEach((canvas) => {
          diagnostics.firstCanvasAt ??= now;
          const renderer = canvas.dataset.veilRenderer;
          if (renderer && !diagnostics.renderers.includes(renderer)) {
            diagnostics.renderers.push(renderer);
          }
        });
      }

      window.requestAnimationFrame(sample);
    };

    window.requestAnimationFrame(sample);
  }, { forceCanvas2d, disableRevealMask, targetRenderPixels, useSimpleShader, skipDraw, hideLayers, hideVeilCanvas, hideFadeCanvas, useAbsoluteWebGLCanvas, removeCanvasContain, transferTo2D });

  const events = [];
  page.on("console", (message) => events.push({ type: "console", level: message.type(), text: message.text() }));
  page.on("pageerror", (error) => events.push({ type: "pageerror", text: error.message }));
  page.on("requestfailed", (request) => events.push({ type: "requestfailed", url: request.url(), failure: request.failure()?.errorText }));

  const snapshots = [];

  try {
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 45000 });
    const idleFramePerformance = await measureFrameCadence(page, 2200);
    if (!skipScreenshots) await captureSnapshot(page, dir, snapshots, "initial");

    const menu = page.locator("[data-menu-button]");
    if (await menu.isVisible().catch(() => false)) {
      await menu.tap({ timeout: 5000 });
      await page.waitForTimeout(450);
      if (!skipScreenshots) await captureSnapshot(page, dir, snapshots, "menu-open");
    }

    const about = page.locator('a[href$="rolunk.html"]:visible').first();
    const tapStartedAt = Date.now();
    await page.evaluate(() => {
      window.__veilDiagnostics.tapAt = performance.now();
    });
    await about.tap({ timeout: 5000 });

    if (skipScreenshots) {
      await page.waitForTimeout(Math.max(0, 7000 - (Date.now() - tapStartedAt)));
    } else {
      for (const targetDelay of [0, 200, 500, 1000, 2000, 4500, 5200, 6500]) {
        const wait = targetDelay - (Date.now() - tapStartedAt);
        if (wait > 0) await page.waitForTimeout(wait);
        await captureSnapshot(page, dir, snapshots, `after-tap-${targetDelay}ms`);
      }
    }

    const performance = await readPerformance(page);

    return {
      engine,
      deviceName,
      viewport: device.viewport,
      userAgent: device.userAgent,
      finalUrl: page.url(),
      forcedCanvas2d: forceCanvas2d,
      revealMaskDisabled: disableRevealMask,
      idleFramePerformance,
      performance,
      snapshots,
      events,
    };
  } catch (error) {
    await captureSnapshot(page, dir, snapshots, "error").catch(() => {});
    return {
      engine,
      deviceName,
      viewport: device.viewport,
      userAgent: device.userAgent,
      forcedCanvas2d: forceCanvas2d,
      revealMaskDisabled: disableRevealMask,
      error: error.message,
      performance: await readPerformance(page).catch(() => null),
      snapshots,
      events,
    };
  } finally {
    await browser.close();
  }
}

async function measureFrameCadence(page, durationMs) {
  const timestamps = await page.evaluate((duration) => new Promise((resolve) => {
    const frames = [];
    const startedAt = performance.now();

    const sample = (now) => {
      frames.push(now);
      if (now - startedAt >= duration) {
        resolve(frames);
        return;
      }
      requestAnimationFrame(sample);
    };

    requestAnimationFrame(sample);
  }), durationMs);

  const deltas = timestamps.slice(1).map((time, index) => time - timestamps[index]);
  const sorted = [...deltas].sort((a, b) => a - b);
  const percentile = (ratio) => sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]
    : null;

  return {
    durationMs: timestamps.length > 1 ? timestamps.at(-1) - timestamps[0] : 0,
    frameCount: timestamps.length,
    averageFrameMs: deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : null,
    p95FrameMs: percentile(.95),
    worstFrameMs: sorted.at(-1) ?? null,
    framesOver33ms: deltas.filter((value) => value > 33.4).length,
    framesOver50ms: deltas.filter((value) => value > 50).length,
  };
}

async function readPerformance(page) {
  return page.evaluate(() => {
    const diagnostics = window.__veilDiagnostics;
    const deltas = diagnostics.activeFrames.slice(1).map((time, index) => time - diagnostics.activeFrames[index]);
    const slowFrames = deltas
      .map((duration, index) => ({
        duration,
        offset: diagnostics.firstActiveAt === null
          ? null
          : diagnostics.activeFrames[index + 1] - diagnostics.firstActiveAt,
      }))
      .filter((frame) => frame.duration > 33.4)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 20);
    const sorted = [...deltas].sort((a, b) => a - b);
    const percentile = (ratio) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] : null;

    return {
      renderer: diagnostics.renderers,
      tapToFirstActiveMs: diagnostics.tapAt === null || diagnostics.firstActiveAt === null
        ? null
        : diagnostics.firstActiveAt - diagnostics.tapAt,
      tapToFirstCanvasMs: diagnostics.tapAt === null || diagnostics.firstCanvasAt === null
        ? null
        : diagnostics.firstCanvasAt - diagnostics.tapAt,
      activeDurationMs: diagnostics.firstActiveAt === null ? 0 : diagnostics.lastActiveAt - diagnostics.firstActiveAt,
      frameCount: diagnostics.activeFrames.length,
      averageFrameMs: deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : null,
      p95FrameMs: percentile(.95),
      worstFrameMs: sorted.at(-1) ?? null,
      framesOver33ms: deltas.filter((value) => value > 33.4).length,
      framesOver50ms: deltas.filter((value) => value > 50).length,
      slowFrames,
    };
  });
}

async function captureSnapshot(page, dir, snapshots, label) {
  const file = path.join(dir, `${label}.png`);
  const state = await page.evaluate(() => ({
    url: location.href,
    bodyClasses: document.body.className,
    htmlClasses: document.documentElement.className,
    canvasCount: document.querySelectorAll("canvas").length,
    isPageTurning: document.body.classList.contains("is-page-turning"),
    transitionCanvases: Array.from(document.querySelectorAll(".veil-canvas-transition"), (canvas) => ({
      renderer: canvas.dataset.veilRenderer || null,
      width: canvas.width,
      height: canvas.height,
      visible: getComputedStyle(canvas).visibility !== "hidden",
    })),
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
  }));
  await page.screenshot({ path: file, fullPage: false });
  snapshots.push({ label, file, state });
}

async function startStaticServer(root, listenPort) {
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${listenPort}`);
      const cleanPath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
      let filePath = path.resolve(root, cleanPath || "index.html");

      if (!filePath.startsWith(root)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      const stat = await fs.stat(filePath).catch(() => null);
      if (stat?.isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }

      const data = await fs.readFile(filePath);
      response.writeHead(200, { "Content-Type": contentType(filePath) });
      response.end(data);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  await new Promise((resolve) => server.listen(listenPort, "127.0.0.1", resolve));
  return server;
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  }[ext] ?? "application/octet-stream";
}

function safeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
