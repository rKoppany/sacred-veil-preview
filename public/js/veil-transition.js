const body = document.body;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let isNavigating = false;
let html2CanvasPromise;
let laceImagePromise;
let lockedScrollY = 0;

const setupNavigationToggle = () => {
  const navToggle = document.querySelector("[data-menu-button]");
  const mainNav = document.querySelector("[data-mobile-menu]");

  if (!navToggle || !mainNav) {
    return;
  }

  if (navToggle.dataset.menuBound === "true") {
    return;
  }

  navToggle.dataset.menuBound = "true";
  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    mainNav.classList.toggle("hidden", isOpen);
  });
};

const setupContactForm = () => {
  const form = document.querySelector("[data-contact-form]");
  const message = document.querySelector("[data-form-message]");

  if (!form || form.dataset.formBound === "true") {
    return;
  }

  form.dataset.formBound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const endpoint = form.getAttribute("data-contact-endpoint");
    const originalButtonText = submitButton?.textContent || "";

    const showMessage = (text) => {
      message?.classList.remove("hidden");

      if (message) {
        message.textContent = text;
      }
    };

    const required = Array.from(form.querySelectorAll("[required]"));
    const invalid = required.find((field) => {
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
        return !field.value.trim();
      }

      return false;
    });

    if (invalid instanceof HTMLElement) {
      showMessage("Kérlek töltsétek ki a csillaggal jelölt mezőket. A telefonszám kötelező, az ÁSZF elfogadása nem szükséges.");
      invalid.focus();
      return;
    }

    const email = form.querySelector("#email");

    if (email instanceof HTMLInputElement && !email.checkValidity()) {
      showMessage("Kérlek adjatok meg érvényes e-mail címet.");
      email.focus();
      return;
    }

    if (!endpoint) {
      showMessage("Az ajánlatkérő űrlap technikai beállítása hiányzik. Kérlek próbáljátok meg később.");
      return;
    }

    const payload = Object.fromEntries(new FormData(form).entries());

    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
      submitButton.textContent = "Küldés folyamatban...";
    }

    showMessage("Az ajánlatkérés küldése folyamatban van...");

    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.ok === false) {
        showMessage(result.message || "Az üzenet küldése most nem sikerült. Kérlek próbáljátok meg később.");
        return;
      }

      showMessage(result.message || "Köszönjük, az ajánlatkérés megérkezett. Hamarosan jelentkezünk.");
      form.reset();
    } catch (error) {
      showMessage("Az üzenet küldése most nem sikerült. Kérlek ellenőrizzétek az internetkapcsolatot, majd próbáljátok meg újra.");
    } finally {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  });
};

const setupPortfolioGallery = () => {
  const masonryWall = document.querySelector("[data-portfolio-masonry]");

  if (!(masonryWall instanceof HTMLElement) || masonryWall.dataset.portfolioBound === "true" || masonryWall.classList.contains("is-enhanced")) {
    return;
  }

  const modal = document.querySelector("[data-lightbox-modal]");
  const modalImage = document.querySelector("[data-lightbox-image]");
  const lightboxStage = document.querySelector(".lightbox-stage");
  const closeButton = document.querySelector("[data-lightbox-close]");
  const previousButton = document.querySelector("[data-lightbox-prev]");
  const nextButton = document.querySelector("[data-lightbox-next]");
  const galleryButtons = Array.from(document.querySelectorAll("[data-lightbox]"));
  const portfolioCards = Array.from(document.querySelectorAll(".portfolio-card"));
  const widthRatioByCount = { 1: 0.9, 2: 0.4, 3: 0.25, 4: 0.2 };
  let currentIndex = 0;
  let isLightboxAnimating = false;
  let lastScrollY = window.scrollY;
  let layoutFrame = 0;

  if (portfolioCards.length === 0) {
    return;
  }

  masonryWall.dataset.portfolioBound = "true";

  const waitForImage = (image) => {
    if (!(image instanceof HTMLImageElement)) return Promise.resolve();
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  };

  const animateImageFromRect = async (fromRect, duration = 600) => {
    if (!(modalImage instanceof HTMLImageElement) || reducedMotion) return;
    await waitForImage(modalImage);
    const targetRect = modalImage.getBoundingClientRect();
    const scaleX = fromRect.width / targetRect.width;
    const scaleY = fromRect.height / targetRect.height;
    const translateX = fromRect.left - targetRect.left;
    const translateY = fromRect.top - targetRect.top;

    modalImage.style.transformOrigin = "top left";
    await modalImage.animate(
      [
        { opacity: 0.72, transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})` },
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1, 1)" }
      ],
      { duration, easing: "cubic-bezier(0.16, 0.84, 0.22, 1)" }
    ).finished;
    modalImage.style.transformOrigin = "";
  };

  const animateImageToRect = async (toRect, duration = 600) => {
    if (!(modalImage instanceof HTMLImageElement) || reducedMotion) return;
    const currentRect = modalImage.getBoundingClientRect();
    const scaleX = toRect.width / currentRect.width;
    const scaleY = toRect.height / currentRect.height;
    const translateX = toRect.left - currentRect.left;
    const translateY = toRect.top - currentRect.top;

    modalImage.style.transformOrigin = "top left";
    await modalImage.animate(
      [
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1, 1)" },
        { opacity: 0.72, transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})` }
      ],
      { duration, easing: "cubic-bezier(0.16, 0.84, 0.22, 1)" }
    ).finished;
    modalImage.style.transformOrigin = "";
  };

  const showImage = (index) => {
    if (!(modalImage instanceof HTMLImageElement) || galleryButtons.length === 0) return;
    currentIndex = (index + galleryButtons.length) % galleryButtons.length;
    modalImage.src = galleryButtons[currentIndex].getAttribute("data-lightbox") || "";
  };

  const close = async () => {
    if (isLightboxAnimating) return;
    isLightboxAnimating = true;
    const targetButton = galleryButtons[currentIndex];
    const targetRect = targetButton?.getBoundingClientRect();
    const targetIsVisible = Boolean(
      targetRect &&
        targetRect.width > 0 &&
        targetRect.height > 0 &&
        targetRect.bottom > 0 &&
        targetRect.right > 0 &&
        targetRect.top < window.innerHeight &&
        targetRect.left < window.innerWidth
    );

    modal?.classList.remove("is-open");
    modal?.classList.add("is-closing");

    if (targetIsVisible && targetRect) {
      await Promise.all([
        animateImageToRect(targetRect, 600),
        new Promise((resolve) => window.setTimeout(resolve, 500))
      ]);
    } else if (modalImage instanceof HTMLImageElement && !reducedMotion) {
      await Promise.all([
        modalImage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing: "ease" }).finished,
        new Promise((resolve) => window.setTimeout(resolve, 500))
      ]);
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 1));
    }

    modal?.classList.add("hidden");
    modal?.classList.remove("block");
    modal?.classList.remove("is-closing");
    modal?.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = "";
    if (modalImage instanceof HTMLImageElement) {
      modalImage.style.opacity = "";
      modalImage.style.transform = "";
    }
    isLightboxAnimating = false;
  };

  const slideLightboxImage = async (direction) => {
    if (!(modalImage instanceof HTMLImageElement) || !(lightboxStage instanceof HTMLElement) || isLightboxAnimating) return;
    if (reducedMotion) {
      showImage(currentIndex + direction);
      return;
    }

    isLightboxAnimating = true;
    const oldRect = modalImage.getBoundingClientRect();
    const ghost = document.createElement("img");
    ghost.className = "lightbox-image-ghost";
    ghost.src = modalImage.src;
    ghost.alt = "";
    ghost.style.left = `${oldRect.left}px`;
    ghost.style.height = `${oldRect.height}px`;
    ghost.style.top = `${oldRect.top}px`;
    ghost.style.width = `${oldRect.width}px`;
    modal?.appendChild(ghost);

    showImage(currentIndex + direction);
    modalImage.style.opacity = "0";
    await waitForImage(modalImage);

    const newRect = modalImage.getBoundingClientRect();
    const oldDistance = oldRect.width * (direction > 0 ? -1 : 1);
    const newDistance = newRect.width * (direction > 0 ? 1 : -1);
    const newAnimation = modalImage.animate(
      [
        { opacity: 0, transform: `translate3d(${newDistance}px, 0, 0)` },
        { opacity: 1, transform: "translate3d(0, 0, 0)" }
      ],
      { duration: 800, easing: "linear", fill: "forwards" }
    ).finished;

    const oldAnimation = new Promise((resolve) => {
      window.setTimeout(() => {
        ghost.animate(
          [
            { opacity: 1, transform: "translate3d(0, 0, 0)" },
            { opacity: 0, transform: `translate3d(${oldDistance}px, 0, 0)` }
          ],
          { duration: 800, easing: "linear", fill: "forwards" }
        ).finished.then(resolve);
      }, 400);
    });

    await Promise.all([oldAnimation, newAnimation]);
    ghost.remove();
    modalImage.style.opacity = "";
    modalImage.style.transform = "";
    isLightboxAnimating = false;
  };

  galleryButtons.forEach((button, index) => {
    button.addEventListener("click", async () => {
      if (isLightboxAnimating) return;
      isLightboxAnimating = true;
      const sourceRect = button.getBoundingClientRect();
      showImage(index);
      modal?.classList.remove("hidden");
      modal?.classList.add("block");
      modal?.classList.remove("is-closing");
      modal?.setAttribute("aria-hidden", "false");
      document.documentElement.style.overflow = "hidden";
      window.requestAnimationFrame(() => modal?.classList.add("is-open"));
      await animateImageFromRect(sourceRect, 600);
      isLightboxAnimating = false;
    });
  });

  closeButton?.addEventListener("click", close);
  previousButton?.addEventListener("click", () => slideLightboxImage(-1));
  nextButton?.addEventListener("click", () => slideLightboxImage(1));
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft") slideLightboxImage(-1);
    if (event.key === "ArrowRight") slideLightboxImage(1);
  });

  const getColumnCount = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isLandscape = width > height;
    const shortSide = Math.min(width, height);

    if (shortSide < 600) return isLandscape ? 2 : 1;
    if (width < 1024) return isLandscape ? 3 : 2;
    return isLandscape ? 4 : 3;
  };

  const revealCards = () => {
    const viewportBottom = window.innerHeight;
    const isScrollingUp = window.scrollY < lastScrollY;
    portfolioCards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      if (rect.top + rect.height / 2 <= viewportBottom) {
        card.classList.add("is-visible");
      } else if (isScrollingUp) {
        card.classList.remove("is-visible");
      }
    });
    lastScrollY = window.scrollY;
  };

  const layoutMasonry = () => {
    layoutFrame = 0;
    const columns = getColumnCount();
    const computedStyle = window.getComputedStyle(masonryWall);
    const gap = parseFloat(computedStyle.getPropertyValue("--portfolio-gap")) || 18;
    const targetWidth = window.innerWidth * widthRatioByCount[columns];
    const availableWidth = masonryWall.clientWidth;
    const itemWidth = Math.floor(Math.min(targetWidth, (availableWidth - gap * (columns - 1)) / columns));
    const totalWidth = itemWidth * columns + gap * (columns - 1);
    const startX = Math.max((availableWidth - totalWidth) / 2, 0);
    const columnHeights = Array.from({ length: columns }, () => 0);

    masonryWall.classList.add("is-enhanced");
    masonryWall.dataset.columns = String(columns);

    portfolioCards.forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      const aspect = Number(card.dataset.aspect) || 1.5;
      const columnIndex = columnHeights.indexOf(Math.min(...columnHeights));
      const x = startX + columnIndex * (itemWidth + gap);
      const y = columnHeights[columnIndex];
      const height = itemWidth / aspect;

      card.style.width = `${itemWidth}px`;
      card.style.height = `${height}px`;
      card.style.setProperty("--portfolio-x", `${x}px`);
      card.style.setProperty("--portfolio-y", `${y}px`);
      columnHeights[columnIndex] += height + gap;
    });

    masonryWall.style.height = `${Math.max(...columnHeights) - gap}px`;
    revealCards();
  };

  const queueLayout = () => {
    if (layoutFrame) return;
    layoutFrame = window.requestAnimationFrame(layoutMasonry);
  };

  const queueReveal = () => {
    window.requestAnimationFrame(revealCards);
  };

  layoutMasonry();
  window.addEventListener("resize", queueLayout);
  window.addEventListener("orientationchange", queueLayout);
  window.addEventListener("scroll", queueReveal, { passive: true });
  window.addEventListener("load", queueLayout, { once: true });

  if (reducedMotion) {
    portfolioCards.forEach((card) => card.classList.add("is-visible"));
  }
};

const setSelectValue = (select, value) => {
  if (!(select instanceof HTMLSelectElement) || !value) {
    return;
  }

  const option = Array.from(select.options).find((item) => item.value === value || item.textContent?.trim() === value);

  if (!option) {
    return;
  }

  select.value = option.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
};

const prefillContactForm = (pageUrl = window.location.href) => {
  const form = document.querySelector("[data-contact-form]");

  if (!form) {
    return;
  }

  const url = new URL(pageUrl, window.location.href);
  const params = url.searchParams;

  setSelectValue(document.querySelector("#serviceType"), params.get("tipus"));
  setSelectValue(document.querySelector("#packageInterest"), params.get("csomag"));
};

const setupPageInteractions = (pageUrl = window.location.href) => {
  setupNavigationToggle();
  prefillContactForm(pageUrl);
  setupContactForm();
  setupPortfolioGallery();
};

const loadHtml2Canvas = () => {
  if (window.html2canvas) {
    return Promise.resolve(window.html2canvas);
  }

  if (html2CanvasPromise) {
    return html2CanvasPromise;
  }

  html2CanvasPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    script.async = true;
    script.onload = () => resolve(window.html2canvas);
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return html2CanvasPromise;
};

const loadLaceImage = () => {
  if (laceImagePromise) {
    return laceImagePromise;
  }

  laceImagePromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = "lace-mask.png?v=5";
  });

  return laceImagePromise;
};

const replacePageContent = (nextDocument, pageUrl = window.location.href) => {
  document.title = nextDocument.title;

  const nextDescription = nextDocument.querySelector('meta[name="description"]');
  const currentDescription = document.querySelector('meta[name="description"]');

  if (nextDescription && currentDescription) {
    currentDescription.setAttribute("content", nextDescription.getAttribute("content") || "");
  }

  ["header", "main#main", "footer"].forEach((selector) => {
    const currentElement = document.querySelector(selector);
    const nextElement = nextDocument.querySelector(selector);

    if (currentElement && nextElement) {
      currentElement.replaceWith(nextElement.cloneNode(true));
    }
  });

  setupPageInteractions(pageUrl);
};

const loadDocument = async (url) => {
  const response = await fetch(url.href, { headers: { "X-Requested-With": "fetch" } });

  if (!response.ok) {
    throw new Error(`Could not load ${url.href}`);
  }

  const html = await response.text();
  return new DOMParser().parseFromString(html, "text/html");
};

const smooth = (value) => {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - (2 * t));
};

const createLacePattern = (ctx, scale) => {
  const size = Math.round(24 * scale);
  const patternCanvas = document.createElement("canvas");
  const patternCtx = patternCanvas.getContext("2d");
  patternCanvas.width = size;
  patternCanvas.height = size;
  patternCtx.scale(scale, scale);
  patternCtx.strokeStyle = "rgba(255, 255, 255, .34)";
  patternCtx.lineWidth = 1;
  patternCtx.beginPath();
  patternCtx.arc(12, 12, 5.5, 0, Math.PI * 2);
  patternCtx.stroke();
  patternCtx.strokeStyle = "rgba(255, 255, 255, .22)";
  patternCtx.beginPath();
  patternCtx.moveTo(0, 12);
  patternCtx.lineTo(24, 12);
  patternCtx.moveTo(12, 0);
  patternCtx.lineTo(12, 24);
  patternCtx.stroke();
  return ctx.createPattern(patternCanvas, "repeat");
};

const captureCurrentViewport = async () => {
  const html2canvas = await loadHtml2Canvas();
  const scale = Math.min(window.devicePixelRatio || 1, 1.15);

  return html2canvas(document.documentElement, {
    backgroundColor: null,
    height: window.innerHeight,
    logging: false,
    scale,
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    useCORS: true,
    width: window.innerWidth,
    windowHeight: window.innerHeight,
    windowWidth: window.innerWidth,
    x: window.scrollX,
    y: window.scrollY
  });
};

const createCanvasOverlay = (snapshot) => {
  const canvas = document.createElement("canvas");
  const scale = snapshot.width / window.innerWidth;
  canvas.className = "veil-canvas-transition";
  canvas.width = snapshot.width;
  canvas.height = snapshot.height;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  canvas.dataset.scale = String(scale);
  document.body.appendChild(canvas);
  return canvas;
};

const createSnapshotFadeOverlay = (snapshot) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.className = "veil-snapshot-fade";
  canvas.width = snapshot.width;
  canvas.height = snapshot.height;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;

  if (context) {
    context.drawImage(snapshot, 0, 0);
  }

  document.body.appendChild(canvas);
  return canvas;
};

const createPageRevealMask = () => {
  const mask = document.createElement("div");
  mask.className = "page-reveal-mask";
  mask.setAttribute("aria-hidden", "true");
  mask.style.setProperty("--reveal-y", `${window.innerHeight}px`);
  document.body.appendChild(mask);
  return mask;
};

const createShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Shader compile failed");
  }

  return shader;
};

const createProgram = (gl, vertexSource, fragmentSource) => {
  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Program link failed");
  }

  return program;
};

const createDomFallbackSheet = () => {
  const sheet = document.createElement("div");
  const surface = document.createElement("div");
  const scrollOffset = window.scrollY;
  const pageHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    window.innerHeight
  );

  sheet.className = "veil-dom-transition";
  sheet.setAttribute("aria-hidden", "true");
  surface.className = "veil-dom-surface";
  surface.style.setProperty("--turn-scroll", `-${scrollOffset}px`);
  surface.style.setProperty("--turn-height", `${pageHeight}px`);

  ["header", "main#main", "footer"].forEach((selector) => {
    const element = document.querySelector(selector);

    if (element) {
      surface.appendChild(element.cloneNode(true));
    }
  });

  sheet.appendChild(surface);
  document.body.appendChild(sheet);

  return sheet;
};

const animateDomFallback = (sheet, revealMask) => new Promise((resolve) => {
  const surface = sheet.querySelector(".veil-dom-surface");

  if (!surface) {
    resolve();
    return;
  }

  const finish = (event) => {
    if (event.animationName !== "domVeilLift") {
      return;
    }

    surface.removeEventListener("animationend", finish);
    resolve();
  };

  if (revealMask) {
    const start = performance.now();
    const introDuration = 500;
    const animationDuration = 1900;
    const updateReveal = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, Math.max(0, (elapsed - introDuration) / animationDuration));
      const revealY = window.innerHeight * (1 - smooth(progress));
      revealMask.style.setProperty("--reveal-y", `${window.innerHeight * (1 - smooth(progress))}px`);
      revealMask.style.clipPath = `polygon(0px 0px, 100vw 0px, 100vw ${revealY}px, 0px ${revealY}px)`;

      if (progress < 1) {
        requestAnimationFrame(updateReveal);
      }
    };

    requestAnimationFrame(updateReveal);
  }

  surface.addEventListener("animationend", finish);
  window.setTimeout(() => sheet.classList.add("is-turning"), 500);
});

const animateVeilCanvas = (canvas, snapshot, revealMask) => new Promise((resolve) => {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    depth: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: false
  });

  if (gl) {
    animateVeilWebGL(canvas, snapshot, gl, revealMask).then(resolve).catch(() => {
      animateVeilCanvas2D(canvas, snapshot, revealMask).then(resolve);
    });
    return;
  }

  animateVeilCanvas2D(canvas, snapshot, revealMask).then(resolve);
});

const animateVeilWebGL = async (canvas, snapshot, gl, revealMask) => new Promise(async (resolve, reject) => {
  let laceImage;

  try {
    laceImage = await loadLaceImage();
  } catch (error) {
    reject(error);
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  const cols = 48;
  const rows = window.innerHeight < 700 ? 14 : 18;
  const vertexCount = (cols + 1) * (rows + 1);
  const positions = new Float32Array(vertexCount * 2);
  const screenPoints = new Float32Array(vertexCount * 2);
  const texcoords = new Float32Array(vertexCount * 2);
  const indices = new Uint16Array(cols * rows * 6);
  const imageAspect = laceImage.width / laceImage.height;
  const canvasAspect = width / height;
  let coverWidth = 1;
  let coverHeight = 1;

  if (canvasAspect > imageAspect) {
    coverHeight = canvasAspect / imageAspect;
  } else {
    coverWidth = imageAspect / canvasAspect;
  }

  const coverOffsetX = (1 - coverWidth) / 2;
  const coverOffsetY = 1 - coverHeight;
  const introDuration = 500;
  const motionDelay = 180;
  const motionDuration = 4000;
  const animationDuration = motionDelay + motionDuration;
  const totalDuration = introDuration + animationDuration;
  const start = performance.now();
  const canvasScale = Number(canvas.dataset.scale) || 1;
  const wideCloth = Math.min(1, Math.max(0, (window.innerWidth - 900) / 420));
  const laceCanvas = document.createElement("canvas");
  const laceContext = laceCanvas.getContext("2d", { willReadFrequently: true });

  if (!laceContext) {
    reject(new Error("Lace mask analysis failed"));
    return;
  }

  laceCanvas.width = laceImage.width;
  laceCanvas.height = laceImage.height;
  laceContext.drawImage(laceImage, 0, 0);
  const laceAlpha = laceContext.getImageData(0, 0, laceCanvas.width, laceCanvas.height).data;
  const hemProfile = Array.from({ length: cols + 1 }, (_, col) => {
    const x01 = col / cols;
    const laceU = (x01 - coverOffsetX) / coverWidth;
    const sampleRadius = .5 / cols / coverWidth;
    let lowest = -1;

    for (let sample = -2; sample <= 2; sample += 1) {
      const sampleU = laceU + (sampleRadius * sample * .5);

      if (sampleU < 0 || sampleU > 1) {
        continue;
      }

      const x = Math.max(0, Math.min(laceCanvas.width - 1, Math.round(sampleU * (laceCanvas.width - 1))));

      for (let y = laceCanvas.height - 1; y >= 0; y -= 1) {
        if (laceAlpha[((y * laceCanvas.width) + x) * 4 + 3] >= 96) {
          lowest = Math.max(lowest, y);
          break;
        }
      }
    }

    if (lowest < 0) {
      return 1;
    }

    return Math.max(.32, Math.min(1, coverOffsetY + ((lowest / (laceCanvas.height - 1)) * coverHeight)));
  });

  for (let pass = 0; pass < 2; pass += 1) {
    const previous = hemProfile.slice();

    for (let index = 1; index < hemProfile.length - 1; index += 1) {
      hemProfile[index] = ((previous[index - 1] * .2) + (previous[index] * .6) + (previous[index + 1] * .2));
    }
  }
  const colData = Array.from({ length: cols + 1 }, (_, col) => {
    const x01 = col / cols;
    const xNorm = x01 - .5;
    const fabricCosh = Math.cosh(xNorm / .46) - 1;

    return {
      centerRegion: smooth((x01 - .45) / .035) * (1 - smooth((x01 - .55) / .035)),
      edgeRegion: Math.max(1 - smooth(x01 / .45), smooth((x01 - .55) / .45)),
      fabricCosh,
      handleDistance: Math.min(Math.abs(x01 - .45), Math.abs(x01 - .55)),
      hemYNorm: hemProfile[col],
      sheetCosh: Math.cosh(xNorm / .72) - 1,
      x01,
      xNorm
    };
  });
  const fabricCoshMax = Math.cosh(.5 / .46) - 1;
  const vertexData = Array.from({ length: vertexCount }, (_, vertex) => {
    const row = Math.floor(vertex / (cols + 1));
    const col = vertex % (cols + 1);
    const yNorm = (row / rows) * colData[col].hemYNorm;

    return {
      anchor: smooth(yNorm / .055),
      bottomGrip: smooth((yNorm - .84) / .16),
      fabricDepth: Math.min(1, Math.max(0, (yNorm - .1) / .9)),
      lowerCorner: smooth((yNorm - .78) / .22),
      lowerEdge: smooth(yNorm / .08),
      lowerRegionY: smooth((yNorm - .95) / .025) * (1 - smooth((yNorm - .99) / .015)),
      releaseDelay: .9 * Math.pow(1 - yNorm, 2.65),
      sideRegionY: smooth((yNorm - .1) / .08),
      topLock: Math.pow(yNorm, 1.22),
      y: yNorm * height,
      yNorm
    };
  });

  let pointer = 0;
  for (let row = 0; row <= rows; row += 1) {
    for (let col = 0; col <= cols; col += 1) {
      const vertex = (row * (cols + 1)) + col;
      texcoords[vertex * 2] = col / cols;
      texcoords[(vertex * 2) + 1] = vertexData[vertex].yNorm;

      if (row < rows && col < cols) {
        const a = vertex;
        const b = vertex + 1;
        const c = vertex + cols + 1;
        const d = c + 1;
        indices[pointer++] = a;
        indices[pointer++] = c;
        indices[pointer++] = b;
        indices[pointer++] = b;
        indices[pointer++] = c;
        indices[pointer++] = d;
      }
    }
  }

  const vertexSource = `
    attribute vec2 a_position;
    attribute vec2 a_texcoord;
    varying vec2 v_texcoord;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texcoord = a_texcoord;
    }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform sampler2D u_pageTexture;
    uniform sampler2D u_laceTexture;
    uniform float u_opacity;
    uniform float u_material;
    uniform float u_white;
    uniform vec4 u_laceCover;
    varying vec2 v_texcoord;
    void main() {
      vec4 color = texture2D(u_pageTexture, v_texcoord);
      vec2 laceUv = (v_texcoord - u_laceCover.zw) / u_laceCover.xy;
      if (laceUv.x < 0.0 || laceUv.x > 1.0 || laceUv.y < 0.0 || laceUv.y > 1.0) {
        laceUv = clamp(laceUv, 0.0, 1.0);
      }
      float laceMask = texture2D(u_laceTexture, laceUv).a;
      laceMask = smoothstep(.18, .86, laceMask);
      vec2 outlineStep = vec2(.0007, .0007);
      float outlineMask = 0.0;
      outlineMask = max(outlineMask, texture2D(u_laceTexture, clamp(laceUv + vec2(outlineStep.x, 0.0), 0.0, 1.0)).a);
      outlineMask = max(outlineMask, texture2D(u_laceTexture, clamp(laceUv - vec2(outlineStep.x, 0.0), 0.0, 1.0)).a);
      outlineMask = max(outlineMask, texture2D(u_laceTexture, clamp(laceUv + vec2(0.0, outlineStep.y), 0.0, 1.0)).a);
      outlineMask = max(outlineMask, texture2D(u_laceTexture, clamp(laceUv - vec2(0.0, outlineStep.y), 0.0, 1.0)).a);
      outlineMask = smoothstep(.12, .62, outlineMask) * (1.0 - laceMask);
      float materialAlpha = mix(.2, 1.0, laceMask);
      vec3 paleFabric = mix(color.rgb, vec3(1.0), .2 * u_material);
      vec3 whiteFabric = mix(paleFabric, vec3(1.0), u_white * .72);
      vec3 laceColor = mix(whiteFabric, vec3(1.0), laceMask * .88);
      color.rgb = mix(whiteFabric, laceColor, laceMask);
      color.rgb = mix(color.rgb, vec3(.831, .686, .216), outlineMask * u_material * .86);
      float verticalOpacity = mix(.6, .8, clamp(v_texcoord.y / .25, 0.0, 1.0));
      verticalOpacity = mix(verticalOpacity, 1.0, clamp((v_texcoord.y - .25) / .25, 0.0, 1.0));
      color.a *= max(materialAlpha, outlineMask * u_material) * u_opacity * verticalOpacity;
      gl_FragColor = color;
    }
  `;

  const program = createProgram(gl, vertexSource, fragmentSource);
  const positionBuffer = gl.createBuffer();
  const texcoordBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  const pageTexture = gl.createTexture();
  const laceTexture = gl.createTexture();
  const positionLocation = gl.getAttribLocation(program, "a_position");
  const texcoordLocation = gl.getAttribLocation(program, "a_texcoord");
  const pageTextureLocation = gl.getUniformLocation(program, "u_pageTexture");
  const laceTextureLocation = gl.getUniformLocation(program, "u_laceTexture");
  const opacityLocation = gl.getUniformLocation(program, "u_opacity");
  const materialLocation = gl.getUniformLocation(program, "u_material");
  const whiteLocation = gl.getUniformLocation(program, "u_white");
  const laceCoverLocation = gl.getUniformLocation(program, "u_laceCover");

  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(program);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, pageTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snapshot);
  gl.uniform1i(pageTextureLocation, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, laceTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, laceImage);
  gl.uniform1i(laceTextureLocation, 1);

  gl.uniform4f(laceCoverLocation, coverWidth, coverHeight, coverOffsetX, coverOffsetY);

  gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(texcoordLocation);
  gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  const render = (now) => {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / totalDuration);
    const intro = smooth(elapsed / introDuration);
    const animationElapsed = Math.max(0, elapsed - introDuration);
    const material = intro;
    const white = smooth((animationElapsed - 580) / 1200);
    const motionT = Math.min(1, Math.max(0, (animationElapsed - motionDelay) / motionDuration));
    const e = smooth(motionT);
    const zStart = height * .78;
    const zMax = zStart * Math.cos((Math.PI / 2) * e);
    const k = .72;
    const globalExit = smooth((e - .82) / .18);
    const opacity = intro * (1 - (globalExit * globalExit));
    const guideRelease = smooth(e);
    const guideVerticalArc = Math.sin(Math.PI * guideRelease);
    const guideHandle = Math.exp(-(.05 * .05) / .018);
    const guideZ = guideRelease * zMax * guideVerticalArc * (.74 + (guideHandle * .46));
    const guideLift = (height * 2 * guideRelease) + (guideZ * (.28 + guideHandle * .3));
    const guideY = height - guideLift - (globalExit * height * .36);
    for (let row = 0; row <= rows; row += 1) {
      for (let col = 0; col <= cols; col += 1) {
        const vertex = (row * (cols + 1)) + col;
        const vertexInfo = vertexData[vertex];
        const { anchor, bottomGrip, fabricDepth, lowerCorner, lowerEdge, lowerRegionY, releaseDelay, sideRegionY, topLock, y, yNorm } = vertexInfo;
        const colInfo = colData[col];
        const { centerRegion, edgeRegion, fabricCosh, handleDistance, sheetCosh, x01, xNorm } = colInfo;
        const release = anchor * smooth((e - releaseDelay) / Math.max(.12, 1 - releaseDelay));
        const verticalArc = Math.sin(Math.PI * release) * Math.pow(yNorm, .7);
        const handleInfluence = Math.exp(-(handleDistance * handleDistance) / .018) * bottomGrip;
        const coshShape = sheetCosh;
        const z = release * zMax * verticalArc * (.74 + (handleInfluence * .46) - (coshShape * .28));
        const sideSetback = release * coshShape * height * .12;
        const bottomPull = bottomGrip * height * .42 * release;
        const lift = (height * 1.58 * topLock * release) + (z * (.28 + handleInfluence * .3)) + bottomPull;
        const xCurve = xNorm * z * .1;
        const projectedScale = 1 + (z / (height * 2.6));
        const sideRegion = Math.max(
          (1 - smooth((x01 - .45) / .045)) * sideRegionY,
          smooth((x01 - .55) / .045) * sideRegionY
        );
        const lowerRegion = centerRegion * lowerRegionY;
        const realismRegion = Math.max(sideRegion, lowerRegion);
        const cornerWeight = sideRegion * smooth((yNorm - .72) / .22);
        const leaderGate = smooth((y - guideY) / (height * (.12 + (wideCloth * cornerWeight * .08))));
        const cornerDelayAmount = wideCloth * cornerWeight;
        const delayedCornerGate = leaderGate * (1 - cornerDelayAmount + (smooth((release - .16) / .84) * cornerDelayAmount));
        const fabricCatenary = fabricCosh / fabricCoshMax;
        const sideWeight = 1;
        const fabricPulse = realismRegion * delayedCornerGate * Math.sin(Math.PI * release) * (1 - (globalExit * .78));
        const fabricBelly = Math.sin(Math.PI * fabricDepth) * fabricPulse;
        const naturalZ = fabricPulse * zMax * (.65 + (fabricDepth * .7)) * (.82 + (fabricCatenary * .36)) * sideWeight;
        const gravitationalSag = fabricPulse * height * (.075 + (fabricDepth * .105)) * (1 - (fabricCatenary * .24));
        const catenarySetback = fabricCatenary * fabricBelly * height * .105;
        const clothCurl = release * release * fabricPulse * height * .085 * (1 - (Math.abs(xNorm) * .46)) / sideWeight;
        const clothSwing = Math.sin((release * Math.PI * 2.4) + (fabricCatenary * Math.PI * 1.6) + (fabricDepth * 1.1)) * fabricPulse;
        let sx = ((xNorm * width * projectedScale) + (width / 2) + xCurve);
        let sy = y - lift - sideSetback - (globalExit * height * .36);
        const lowerEdgeRelease = lowerEdge * edgeRegion * release * (1 - (globalExit * .75));
        const edgeDirection = xNorm < 0 ? 1 : -1;
        const edgeInset = lowerEdgeRelease * width * .045 * (1 + (fabricDepth * .35));
        sx += (clothSwing * width * .018 * (1 - (fabricCatenary * .18))) + (xNorm * naturalZ * .12);
        sx += edgeDirection * edgeInset;
        sy += gravitationalSag + catenarySetback - clothCurl + (naturalZ * .12);
        const cornerLagStrength = edgeRegion * lowerCorner * sideRegion;
        const cornerTargetY = Math.min(height, guideY + (height * .9));
        sy += (cornerTargetY - sy) * cornerLagStrength;
        positions[vertex * 2] = (sx / width * 2) - 1;
        positions[(vertex * 2) + 1] = 1 - (sy / height * 2);
        screenPoints[vertex * 2] = sx / canvasScale;
        screenPoints[(vertex * 2) + 1] = sy / canvasScale;
      }
    }

    if (revealMask) {
      const outline = [];

      for (let col = 0; col <= cols; col += 1) {
        const vertex = col;
        outline.push(`${screenPoints[vertex * 2].toFixed(1)}px ${screenPoints[(vertex * 2) + 1].toFixed(1)}px`);
      }

      for (let row = 1; row <= rows; row += 1) {
        const vertex = (row * (cols + 1)) + cols;
        outline.push(`${screenPoints[vertex * 2].toFixed(1)}px ${screenPoints[(vertex * 2) + 1].toFixed(1)}px`);
      }

      for (let col = cols - 1; col >= 0; col -= 1) {
        const vertex = (rows * (cols + 1)) + col;
        outline.push(`${screenPoints[vertex * 2].toFixed(1)}px ${screenPoints[(vertex * 2) + 1].toFixed(1)}px`);
      }

      for (let row = rows - 1; row >= 1; row -= 1) {
        const vertex = row * (cols + 1);
        outline.push(`${screenPoints[vertex * 2].toFixed(1)}px ${screenPoints[(vertex * 2) + 1].toFixed(1)}px`);
      }

      revealMask.style.clipPath = `polygon(${outline.join(",")})`;
    }

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(opacityLocation, opacity);
    gl.uniform1f(materialLocation, material);
    gl.uniform1f(whiteLocation, white);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

    if (t < 1) {
      requestAnimationFrame(render);
      return;
    }

    resolve();
  };

  requestAnimationFrame(render);
});

const animateVeilCanvas2D = (canvas, snapshot, revealMask) => new Promise((resolve) => {
  const ctx = canvas.getContext("2d", { alpha: true });
  const scale = Number(canvas.dataset.scale) || 1;
  const width = canvas.width;
  const height = canvas.height;
  const stripCount = window.innerHeight < 640 ? 12 : 16;
  const stripHeight = Math.ceil(height / stripCount);
  const overlap = Math.ceil(stripHeight * .34);
  const introDuration = 500;
  const animationDuration = 1480;
  const duration = introDuration + animationDuration;
  const start = performance.now();
  const lacePattern = createLacePattern(ctx, scale);

  const render = (now) => {
    const elapsed = now - start;
    const intro = smooth(elapsed / introDuration);
    const progress = Math.min(1, Math.max(0, (elapsed - introDuration) / animationDuration));
    if (revealMask) {
      const revealY = window.innerHeight * (1 - smooth(progress));
      revealMask.style.setProperty("--reveal-y", `${revealY}px`);
      revealMask.style.clipPath = `polygon(0px 0px, 100vw 0px, 100vw ${revealY}px, 0px ${revealY}px)`;
    }
    ctx.clearRect(0, 0, width, height);

    const shade = smooth(progress / .7) * .08;
    ctx.fillStyle = `rgba(34, 32, 29, ${shade})`;
    ctx.fillRect(0, 0, width, height);

    for (let index = 0; index < stripCount; index += 1) {
      const position = stripCount === 1 ? 1 : index / (stripCount - 1);
      const sourceY = index * stripHeight;
      const visibleHeight = Math.min(stripHeight + overlap, height - sourceY);
      const releaseDelay = .5 * Math.pow(1 - position, 2.1);
      const local = smooth((progress - releaseDelay) / (1 - releaseDelay));
      const fold = Math.sin(local * Math.PI);
      const late = smooth((local - .72) / .28);
      const arc = Math.sin(local * Math.PI * .72);
      const wave = Math.sin((progress * 4.8) + (position * 2.1)) * fold;
      const lift = local * (height * (.38 + position * 1.18)) + arc * (height * (.06 + position * .12));
      const perspectiveSquash = local * (.04 + position * .26) + late * .42;
      const destHeight = visibleHeight * Math.max(.16, 1 - perspectiveSquash);
      const destY = sourceY - lift - (late * height * .22) + (wave * 2.2 * scale);
      const destX = wave * 2.8 * scale;
      const destWidth = width * (1 + (fold * .008));
      const opacity = 1 - (late * late);
      const laceOpacity = smooth(local / .42) * (1 - smooth((local - .78) / .22)) * .56;

      if (destHeight <= 1 || opacity <= .01) {
        continue;
      }

      ctx.save();
      ctx.globalAlpha = opacity * intro;
      ctx.shadowColor = "rgba(34, 32, 29, .16)";
      ctx.shadowBlur = 7 * scale * fold;
      ctx.shadowOffsetY = 9 * scale * fold;
      ctx.drawImage(snapshot, 0, sourceY, width, visibleHeight, destX, destY, destWidth, destHeight);

      const seamFade = Math.min(18 * scale, destHeight * .35);
      if (seamFade > 1) {
        const fade = ctx.createLinearGradient(0, destY, 0, destY + destHeight);
        fade.addColorStop(0, "rgba(255, 255, 255, .12)");
        fade.addColorStop(.22, "rgba(255, 255, 255, 0)");
        fade.addColorStop(.78, "rgba(255, 255, 255, 0)");
        fade.addColorStop(1, "rgba(255, 255, 255, .16)");
        ctx.globalAlpha = opacity * fold * .42 * intro;
        ctx.fillStyle = fade;
        ctx.fillRect(destX, destY, destWidth, destHeight);
      }

      if (laceOpacity > .01) {
        ctx.globalAlpha = laceOpacity * opacity * intro;
        ctx.fillStyle = "rgba(255, 255, 255, .34)";
        ctx.fillRect(destX, destY, destWidth, destHeight);
        ctx.fillStyle = lacePattern;
        ctx.fillRect(destX, destY, destWidth, destHeight);
      }

      ctx.restore();
    }

    if (progress < 1) {
      requestAnimationFrame(render);
      return;
    }

    resolve();
  };

  requestAnimationFrame(render);
});

const finishNavigation = () => {
  body.classList.remove("is-page-turning", "has-visible-scrollbar");
  window.removeEventListener("wheel", keepScrollLocked);
  window.removeEventListener("touchmove", keepScrollLocked);
  isNavigating = false;
};

const keepScrollLocked = (event) => {
  event.preventDefault();
  window.scrollTo(window.scrollX, lockedScrollY);
};

const navigateWithoutAnimation = async (url) => {
  const nextDocument = await loadDocument(url);
  replacePageContent(nextDocument, url.href);
  window.scrollTo(0, 0);
  window.history.pushState({}, "", url.href);
};

const navigateWithPageTurn = async (url) => {
  isNavigating = true;
  lockedScrollY = window.scrollY;
  window.addEventListener("wheel", keepScrollLocked, { passive: false });
  window.addEventListener("touchmove", keepScrollLocked, { passive: false });
  body.classList.toggle("has-visible-scrollbar", document.documentElement.scrollHeight > document.documentElement.clientHeight);
  body.classList.add("is-page-turning");

  try {
    if (reducedMotion) {
      await navigateWithoutAnimation(url);
      finishNavigation();
      return;
    }

    const nextDocumentPromise = loadDocument(url);
    let snapshot = null;

    try {
      snapshot = await captureCurrentViewport();
    } catch (error) {
      snapshot = null;
    }

    const transitionLayer = snapshot ? createCanvasOverlay(snapshot) : createDomFallbackSheet();
    const snapshotFadeLayer = snapshot ? createSnapshotFadeOverlay(snapshot) : null;
    const revealMask = createPageRevealMask();
    const nextDocument = await nextDocumentPromise;

    replacePageContent(nextDocument, url.href);
    window.scrollTo(0, 0);
    window.history.pushState({}, "", url.href);

    if (snapshot) {
      await animateVeilCanvas(transitionLayer, snapshot, revealMask);
    } else {
      await animateDomFallback(transitionLayer, revealMask);
    }

    revealMask.remove();
    snapshotFadeLayer?.remove();
    transitionLayer.remove();
    finishNavigation();
  } catch (error) {
    document.querySelector(".page-reveal-mask")?.remove();
    document.querySelector(".veil-snapshot-fade")?.remove();
    window.location.href = url.href;
  }
};

window.addEventListener("pageshow", () => {
  finishNavigation();
  setupPageInteractions();
  body.classList.add("initial-enter", "page-ready");
  window.setTimeout(() => body.classList.remove("initial-enter"), 700);
});

window.addEventListener("popstate", async () => {
  try {
    await navigateWithoutAnimation(new URL(window.location.href));
  } catch (error) {
    window.location.reload();
  }
});

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");

  if (!link || event.defaultPrevented || isNavigating) {
    return;
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === "_blank") {
    return;
  }

  const url = new URL(link.getAttribute("href"), window.location.href);
  const isSamePageHash = url.pathname === window.location.pathname && url.hash;
  const isInternalPage = url.origin === window.location.origin || window.location.protocol === "file:";

  if (!isInternalPage || isSamePageHash || url.href === window.location.href) {
    return;
  }

  event.preventDefault();
  navigateWithPageTurn(url);
});
