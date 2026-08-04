const body = document.body;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isAppleTouchDevice =
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isIPhone = /iPhone|iPod/.test(navigator.userAgent);
const useSyntheticPageTurn = !reducedMotion && !isAppleTouchDevice;
body.classList.toggle("is-iphone", isIPhone);
body.classList.toggle("is-apple-touch", isAppleTouchDevice);
let isNavigating = false;
let html2CanvasPromise;
let laceImagePromise;
let packedLaceImagePromise;
let packedLaceAnalysisPromise;
let lockedScrollY = 0;
const documentCache = new Map();
let touchNavigationCandidate = null;
let preparedViewportSnapshot = null;
let preparedViewportSignature = "";
let preparedViewportCapturePromise = null;
let preparedViewportCaptureSignature = "";
let preparedViewportCaptureClaimed = false;
let preparedViewportTimer = 0;
let preparedViewportVersion = 0;
let lastAppleInteractionAt = performance.now();
let principlesTitleResizeObserver;
let principlesTitleResizeListenerBound = false;
let aboutProfileTextFlowResizeObserver;
let aboutProfileTextFlowListenerBound = false;
let aboutProfileTextFlowSyncing = false;

const withTimeout = (promise, timeoutMs, message) => new Promise((resolve, reject) => {
  let settled = false;
  const timeoutId = window.setTimeout(() => {
    if (settled) {
      return;
    }

    settled = true;
    reject(new Error(message));
  }, timeoutMs);

  Promise.resolve(promise).then(
    (value) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      resolve(value);
    },
    (error) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      reject(error);
    }
  );
});

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

  if (!(masonryWall instanceof HTMLElement) || masonryWall.dataset.portfolioBound === "true") {
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
  let revealFrame = 0;
  let portfolioLayoutViewportWidth = window.innerWidth;
  const revealAnimationTimers = new WeakMap();

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
    if (width < 760) return isLandscape ? 3 : 2;
    return isLandscape ? 4 : 3;
  };

  const revealCards = () => {
    const viewportBottom = window.innerHeight;
    const isScrollingUp = window.scrollY < lastScrollY;
    const wallTop = masonryWall.getBoundingClientRect().top;
    portfolioCards.forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      const cardTop = wallTop + (Number.parseFloat(card.style.getPropertyValue("--portfolio-y")) || 0);
      const cardHeight = Number.parseFloat(card.style.height) || 0;
      if (cardTop + cardHeight / 2 <= viewportBottom) {
        if (!card.classList.contains("is-visible")) {
          card.classList.add("is-visible", "is-reveal-animating");
          window.clearTimeout(revealAnimationTimers.get(card));
          revealAnimationTimers.set(card, window.setTimeout(() => {
            card.classList.remove("is-reveal-animating");
          }, 1550));
        }
      } else if (isScrollingUp) {
        if (card.classList.contains("is-visible")) {
          card.classList.add("is-reveal-animating");
          card.classList.remove("is-visible");
          window.clearTimeout(revealAnimationTimers.get(card));
          revealAnimationTimers.set(card, window.setTimeout(() => {
            card.classList.remove("is-reveal-animating");
          }, 1550));
        }
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

    const shouldApplyInstantLayout = isAppleTouchDevice && masonryWall.classList.contains("is-enhanced");
    if (shouldApplyInstantLayout) {
      masonryWall.classList.add("is-instant-layout");
    }

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

    if (shouldApplyInstantLayout) {
      // Keep transitions disabled until WebKit has committed the new geometry.
      // A single frame is too early on iOS during orientation changes.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => masonryWall.classList.remove("is-instant-layout"));
      });
    }
  };

  const queueLayout = () => {
    if (layoutFrame) return;
    layoutFrame = window.requestAnimationFrame(layoutMasonry);
  };

  const queueReveal = () => {
    if (revealFrame) return;
    revealFrame = window.requestAnimationFrame(() => {
      revealFrame = 0;
      revealCards();
    });
  };

  const handlePortfolioResize = () => {
    const nextWidth = window.innerWidth;

    if (isAppleTouchDevice && Math.abs(nextWidth - portfolioLayoutViewportWidth) < 2) {
      return;
    }

    portfolioLayoutViewportWidth = nextWidth;
    queueLayout();
  };

  const handlePortfolioOrientationChange = () => {
    window.requestAnimationFrame(handlePortfolioResize);
  };

  layoutMasonry();
  window.addEventListener("resize", handlePortfolioResize);
  window.addEventListener("orientationchange", handlePortfolioOrientationChange);
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

let layoutMotionBound = false;
let layoutMotionNextId = 0;
let layoutMotionLastRects = new Map();
let layoutMotionFrame = 0;
let layoutMotionViewportWidth = window.innerWidth;
const layoutMotionActiveAnimations = new WeakMap();
const layoutMotionActiveElements = new Set();
const layoutMotionIds = new WeakMap();
const layoutMotionSelector = [
  "header .site-header-inner > *",
  "main section > .container > *",
  "main .grid > *",
  ".media-frame",
  ".package-card",
  ".package-promo",
  ".package-notes > *",
  ".button",
  ".aszf-card",
  "footer .container > *"
].join(",");

const getLayoutMotionId = (element) => {
  if (!layoutMotionIds.has(element)) {
    layoutMotionIds.set(element, `layout-motion-${layoutMotionNextId++}`);
  }

  return layoutMotionIds.get(element);
};

const getLayoutMotionElements = () => {
  const seen = new Set();
  return Array.from(document.querySelectorAll(layoutMotionSelector)).filter((element) => {
    if (!(element instanceof HTMLElement) || seen.has(element)) return false;
    if (
      element.closest(
        ".portfolio-wall, [data-lightbox-modal], .veil-canvas-transition, .veil-dom-transition, .veil-snapshot-fade, .page-reveal-mask"
      )
    ) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const isVisible =
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > -160 &&
      rect.top < window.innerHeight + 160;

    if (!isVisible) return false;
    seen.add(element);
    return true;
  });
};

const captureLayoutMotionRects = () => {
  const rects = new Map();
  getLayoutMotionElements().forEach((element) => {
    rects.set(getLayoutMotionId(element), element.getBoundingClientRect());
  });
  return rects;
};

const refreshLayoutMotionRects = () => {
  if (reducedMotion || isIPhone) return;
  window.requestAnimationFrame(() => {
    layoutMotionLastRects = captureLayoutMotionRects();
  });
};

const animateLayoutMotion = () => {
  layoutMotionFrame = 0;

  if (reducedMotion || isIPhone || isNavigating) {
    refreshLayoutMotionRects();
    return;
  }

  const elements = getLayoutMotionElements();
  const visualStartRects = new Map();
  const currentRects = new Map();
  const animations = [];

  elements.forEach((element) => {
    const id = getLayoutMotionId(element);
    const activeAnimation = layoutMotionActiveAnimations.get(element);

    if (activeAnimation) {
      visualStartRects.set(id, element.getBoundingClientRect());
    }

    activeAnimation?.cancel();
    layoutMotionActiveAnimations.delete(element);
  });

  elements.forEach((element) => {
    currentRects.set(getLayoutMotionId(element), element.getBoundingClientRect());
  });

  elements.forEach((element) => {
    const id = getLayoutMotionId(element);
    const first = visualStartRects.get(id) || layoutMotionLastRects.get(id);
    const last = currentRects.get(id);
    if (!first || !last) return;

    const deltaX = first.left - last.left;
    const deltaY = first.top - last.top;
    const scaleX = first.width / Math.max(last.width, 1);
    const scaleY = first.height / Math.max(last.height, 1);
    const moved = Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1;
    const resized = Math.abs(scaleX - 1) > 0.02 || Math.abs(scaleY - 1) > 0.02;

    if (!moved && !resized) return;

    const animation = element.animate(
      [
        {
          transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})`,
          transformOrigin: "top left"
        },
        {
          transform: "translate3d(0, 0, 0) scale(1, 1)",
          transformOrigin: "top left"
        }
      ],
      {
        duration: 1500,
        easing: "cubic-bezier(0.42, 0, 0.24, 1)"
      }
    );

    layoutMotionActiveAnimations.set(element, animation);
    layoutMotionActiveElements.add(element);
    animations.push(
      animation.finished
        .then(() => {
          if (layoutMotionActiveAnimations.get(element) === animation) {
            layoutMotionActiveAnimations.delete(element);
            layoutMotionActiveElements.delete(element);
          }
        })
        .catch(() => null)
    );
  });

  layoutMotionLastRects = currentRects;

  if (animations.length === 0) {
    refreshLayoutMotionRects();
    return;
  }

  body.classList.add("is-layout-reflowing");
  Promise.allSettled(animations).then(() => {
    body.classList.remove("is-layout-reflowing");
    refreshLayoutMotionRects();
  });
};

const queueLayoutMotion = () => {
  if (reducedMotion || isIPhone || isNavigating) return;
  if (layoutMotionFrame) return;

  layoutMotionFrame = window.requestAnimationFrame(animateLayoutMotion);
};

const handleLayoutMotionResize = () => {
  if (isIPhone) return;
  const nextWidth = window.innerWidth;

  if (isAppleTouchDevice && Math.abs(nextWidth - layoutMotionViewportWidth) < 2) {
    return;
  }

  layoutMotionViewportWidth = nextWidth;
  queueLayoutMotion();
};

const handleLayoutMotionOrientationChange = () => {
  if (isIPhone) return;
  window.requestAnimationFrame(handleLayoutMotionResize);
};

const disableLayoutMotion = () => {
  if (layoutMotionFrame) {
    window.cancelAnimationFrame(layoutMotionFrame);
    layoutMotionFrame = 0;
  }
  layoutMotionActiveElements.forEach((element) => {
    layoutMotionActiveAnimations.get(element)?.cancel();
    layoutMotionActiveAnimations.delete(element);
  });
  layoutMotionActiveElements.clear();
  layoutMotionLastRects = new Map();
  body.classList.remove("is-layout-reflowing");
  if (layoutMotionBound) {
    window.removeEventListener("resize", handleLayoutMotionResize);
    window.removeEventListener("orientationchange", handleLayoutMotionOrientationChange);
    layoutMotionBound = false;
  }
};

const setupLayoutMotion = () => {
  if (reducedMotion || isAppleTouchDevice) {
    disableLayoutMotion();
    return;
  }

  refreshLayoutMotionRects();
  if (layoutMotionBound) return;

  layoutMotionBound = true;
  window.addEventListener("resize", handleLayoutMotionResize, { passive: true });
  window.addEventListener("orientationchange", handleLayoutMotionOrientationChange, { passive: true });
};

const syncAboutPrinciplesTitleHeight = () => {
  document.querySelectorAll(".about-principles-card").forEach((card) => {
    const title = card.querySelector("h2");
    const list = card.querySelector(".about-principles-list");

    if (!title || !list) {
      card.style.removeProperty("--about-principles-list-height");
      card.style.removeProperty("--about-principles-title-font-size");
      return;
    }

    card.style.removeProperty("--about-principles-title-font-size");

    const listHeight = list.getBoundingClientRect().height;
    card.style.setProperty("--about-principles-list-height", `${listHeight}px`);

    const titleStyles = window.getComputedStyle(title);
    const baseFontSize = Number.parseFloat(titleStyles.fontSize);
    const minFontSize = Math.max(12, baseFontSize * 0.48);
    const wordsFit = () => {
      const titleWidth = title.clientWidth;
      const words = (title.textContent || "").trim().split(/\s+/).filter(Boolean);

      if (titleWidth <= 0 || words.length === 0) {
        return true;
      }

      const styles = window.getComputedStyle(title);
      const probe = document.createElement("span");
      probe.style.font = styles.font;
      probe.style.letterSpacing = styles.letterSpacing;
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.whiteSpace = "nowrap";
      document.body.appendChild(probe);

      const fits = words.every((word) => {
        probe.textContent = word;
        return probe.getBoundingClientRect().width <= titleWidth + 0.5;
      });

      probe.remove();
      return fits;
    };
    const fits = () =>
      title.getBoundingClientRect().height <= listHeight + 0.5 &&
      wordsFit();

    if (!Number.isFinite(baseFontSize) || fits()) {
      return;
    }

    let low = minFontSize;
    let high = baseFontSize;
    let best = minFontSize;

    for (let index = 0; index < 16; index += 1) {
      const mid = (low + high) / 2;
      card.style.setProperty("--about-principles-title-font-size", `${mid}px`);

      if (fits()) {
        best = mid;
        low = mid;
      } else {
        high = mid;
      }
    }

    card.style.setProperty("--about-principles-title-font-size", `${best}px`);
  });
};

const setupAboutPrinciplesTitleHeight = () => {
  syncAboutPrinciplesTitleHeight();
  document.fonts?.ready.then(syncAboutPrinciplesTitleHeight);

  if ("ResizeObserver" in window) {
    principlesTitleResizeObserver?.disconnect();
    principlesTitleResizeObserver = new ResizeObserver(syncAboutPrinciplesTitleHeight);
    document.querySelectorAll(".about-principles-list").forEach((list) => {
      principlesTitleResizeObserver.observe(list);
    });
  }

  if (!principlesTitleResizeListenerBound) {
    principlesTitleResizeListenerBound = true;
    window.addEventListener("resize", syncAboutPrinciplesTitleHeight, { passive: true });
    window.addEventListener("orientationchange", syncAboutPrinciplesTitleHeight, { passive: true });
  }
};

const syncAboutProfileTextFlow = () => {
  if (aboutProfileTextFlowSyncing) return;
  aboutProfileTextFlowSyncing = true;

  document.querySelectorAll(".about-profile-copy-grid").forEach((grid) => {
    const frame = grid.querySelector(".about-profile-frame");
    const image = frame?.querySelector("img");
    const sideCopy = grid.querySelector(".about-side-copy");
    const underCopy = grid.querySelector(".about-under-profile-copy");

    if (!frame || !image || !sideCopy || !underCopy) {
      return;
    }

    sideCopy.querySelectorAll("p").forEach((paragraph) => {
      paragraph.dataset.profileFlowCandidate = "true";
    });

    Array.from(underCopy.querySelectorAll("[data-profile-flow-dynamic='true']")).forEach((paragraph) => {
      sideCopy.appendChild(paragraph);
    });

    const frameRect = frame.getBoundingClientRect();
    const sideRect = sideCopy.getBoundingClientRect();
    const isSideBySide = sideRect.left >= frameRect.right - 2;

    if (!isSideBySide) {
      return;
    }

    let lastParagraph = sideCopy.querySelector("p:last-child");

    while (lastParagraph instanceof HTMLElement && lastParagraph.getBoundingClientRect().bottom > frameRect.bottom + 0.5) {
      lastParagraph.dataset.profileFlowDynamic = "true";
      underCopy.prepend(lastParagraph);
      lastParagraph = sideCopy.querySelector("p:last-child");
    }
  });

  aboutProfileTextFlowSyncing = false;
};

const scheduleAboutProfileTextFlow = () => {
  window.requestAnimationFrame(syncAboutProfileTextFlow);
};

const setupAboutProfileTextFlow = () => {
  syncAboutProfileTextFlow();
  document.fonts?.ready.then(scheduleAboutProfileTextFlow);

  if ("ResizeObserver" in window) {
    aboutProfileTextFlowResizeObserver?.disconnect();
    aboutProfileTextFlowResizeObserver = new ResizeObserver(scheduleAboutProfileTextFlow);
    document.querySelectorAll(".about-profile-copy-grid, .about-profile-frame, .about-side-copy, .about-under-profile-copy").forEach((element) => {
      aboutProfileTextFlowResizeObserver.observe(element);
    });
  }

  document.querySelectorAll(".about-profile-frame img").forEach((image) => {
    if (image instanceof HTMLImageElement && !image.complete) {
      image.addEventListener("load", scheduleAboutProfileTextFlow, { once: true });
    }
  });

  if (!aboutProfileTextFlowListenerBound) {
    aboutProfileTextFlowListenerBound = true;
    window.addEventListener("resize", scheduleAboutProfileTextFlow, { passive: true });
    window.addEventListener("orientationchange", scheduleAboutProfileTextFlow, { passive: true });
  }
};

const setupPageInteractions = (pageUrl = window.location.href) => {
  setupNavigationToggle();
  prefillContactForm(pageUrl);
  setupContactForm();
  setupPortfolioGallery();
  setupAboutPrinciplesTitleHeight();
  setupAboutProfileTextFlow();
  setupLayoutMotion();
};

const loadHtml2Canvas = () => {
  if (window.html2canvas) {
    return Promise.resolve(window.html2canvas);
  }

  if (html2CanvasPromise) {
    return html2CanvasPromise;
  }

  const script = document.createElement("script");
  const loadingPromise = new Promise((resolve, reject) => {
    script.src = new URL("js/html2canvas.min.js?v=1", document.baseURI).href;
    script.async = true;
    script.dataset.veilDependency = "html2canvas";
    script.onload = () => {
      if (typeof window.html2canvas === "function") {
        resolve(window.html2canvas);
        return;
      }

      reject(new Error("html2canvas loaded without exposing its API"));
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });

  html2CanvasPromise = withTimeout(
    loadingPromise,
    isAppleTouchDevice ? 3500 : 7000,
    "html2canvas loading timed out"
  ).catch((error) => {
    script.remove();
    html2CanvasPromise = undefined;
    throw error;
  });

  return html2CanvasPromise;
};

const getResponsiveLacePath = (baseName) => {
  if (isAppleTouchDevice) {
    return baseName === "packed"
      ? "lace-mask-apple-packed.png?v=4"
      : "lace-mask-apple.png?v=4";
  }

  const desiredPixels = Math.max(window.innerWidth, window.innerHeight) * Math.min(window.devicePixelRatio || 1, 2);

  if (baseName === "packed") {
    if (desiredPixels <= 1700) return "lace-mask-packed-1800.webp?v=1";
    if (desiredPixels <= 2300) return "lace-mask-packed-2400.webp?v=1";
    return "lace-mask-packed-3000.webp?v=1";
  }

  return desiredPixels <= 1800
    ? "lace-mask-1800.webp?v=1"
    : "lace-mask-2400.webp?v=1";
};

const loadLaceImage = () => {
  if (laceImagePromise) {
    return laceImagePromise;
  }

  laceImagePromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "high";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = new URL(getResponsiveLacePath("mask"), document.baseURI).href;
  });

  return laceImagePromise;
};

const loadPackedLaceImage = () => {
  if (packedLaceImagePromise) {
    return packedLaceImagePromise;
  }

  packedLaceImagePromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "high";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = new URL(getResponsiveLacePath("packed"), document.baseURI).href;
  });

  return packedLaceImagePromise;
};

const loadPackedLaceAnalysis = () => {
  if (packedLaceAnalysisPromise) {
    return packedLaceAnalysisPromise;
  }

  packedLaceAnalysisPromise = loadPackedLaceImage().then((image) => {
    const analysisCanvas = document.createElement("canvas");
    const analysisContext = analysisCanvas.getContext("2d", { willReadFrequently: true });

    if (!analysisContext) {
      throw new Error("Lace mask analysis failed");
    }

    const analysisScale = Math.min(1, 1024 / image.width);
    analysisCanvas.width = Math.max(1, Math.round(image.width * analysisScale));
    analysisCanvas.height = Math.max(1, Math.round(image.height * analysisScale));
    analysisContext.drawImage(image, 0, 0, analysisCanvas.width, analysisCanvas.height);

    const pixels = analysisContext.getImageData(
      0,
      0,
      analysisCanvas.width,
      analysisCanvas.height
    ).data;
    const lowestLacePixel = new Float32Array(analysisCanvas.width);

    for (let x = 0; x < analysisCanvas.width; x += 1) {
      let lowest = -1;

      for (let y = analysisCanvas.height - 1; y >= 0; y -= 1) {
        if (pixels[((y * analysisCanvas.width) + x) * 4 + 1] >= 96) {
          lowest = y;
          break;
        }
      }

      lowestLacePixel[x] = lowest;
    }

    const analysis = {
      image,
      width: analysisCanvas.width,
      height: analysisCanvas.height,
      lowestLacePixel
    };
    analysisCanvas.width = 1;
    analysisCanvas.height = 1;
    return analysis;
  }).catch((error) => {
    packedLaceAnalysisPromise = undefined;
    throw error;
  });

  return packedLaceAnalysisPromise;
};

const scheduleTransitionWarmup = () => {
  // Keep the initial page load quiet. Transition assets are warmed from real link intent below.
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
};

const loadDocument = (url) => {
  const cacheKey = url.href;
  if (documentCache.has(cacheKey)) return documentCache.get(cacheKey);

  const request = withTimeout(
    fetch(cacheKey, {
      cache: "default",
      credentials: "same-origin",
      headers: { "X-Requested-With": "fetch" }
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Could not load ${cacheKey}`);
      const html = await response.text();
      return new DOMParser().parseFromString(html, "text/html");
    }),
    15000,
    `Loading ${cacheKey} timed out`
  ).catch((error) => {
    documentCache.delete(cacheKey);
    throw error;
  });

  documentCache.set(cacheKey, request);
  return request;
};

const smooth = (value) => {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - (2 * t));
};

const captureCurrentViewport = async () => {
  const html2canvas = await loadHtml2Canvas();
  const scale = isAppleTouchDevice
    ? getVeilRenderScale()
    : Math.min(window.devicePixelRatio || 1, 1.15);

  const captureOptions = {
    backgroundColor: null,
    height: window.innerHeight,
    imageTimeout: isAppleTouchDevice ? 3000 : 3000,
    logging: false,
    foreignObjectRendering: false,
    ignoreElements: (element) => {
      if (!(element instanceof Element)) return false;
      if (element.matches("[data-mobile-menu], [data-lightbox-modal][aria-hidden='true'], .veil-canvas-transition, .veil-snapshot-fade, .page-reveal-mask")) {
        return true;
      }

      if (!isAppleTouchDevice) return false;
      if (!element.matches(".portfolio-card, img, video, iframe, section, footer")) return false;
      const rect = element.getBoundingClientRect();
      return rect.bottom < -96 || rect.top > window.innerHeight + 96;
    },
    removeContainer: true,
    scale,
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    useCORS: true,
    width: window.innerWidth,
    windowHeight: window.innerHeight,
    windowWidth: window.innerWidth,
    x: window.scrollX,
    y: window.scrollY
  };

  const runCapture = () => withTimeout(
    html2canvas(document.body, captureOptions),
    isAppleTouchDevice ? 7500 : 9000,
    "viewport capture timed out"
  );

  const snapshot = await runCapture();
  snapshot.dataset.veilCaptureScale = String(scale);
  return snapshot;
};

const releaseSnapshotCanvas = (snapshot) => {
  if (!(snapshot instanceof HTMLCanvasElement)) return;
  snapshot.width = 1;
  snapshot.height = 1;
};

const getPreparedViewportSignature = () => {
  return [
    window.location.pathname,
    window.innerWidth,
    window.innerHeight,
    Math.round(window.scrollX),
    Math.round(window.scrollY)
  ].join(":");
};

const invalidatePreparedViewportSnapshot = () => {
  preparedViewportVersion += 1;
  window.clearTimeout(preparedViewportTimer);
  preparedViewportTimer = 0;
  releaseSnapshotCanvas(preparedViewportSnapshot);
  preparedViewportSnapshot = null;
  preparedViewportSignature = "";
};

const takePreparedViewportSnapshot = () => {
  const signature = getPreparedViewportSignature();

  if (
    preparedViewportSnapshot instanceof HTMLCanvasElement &&
    preparedViewportSignature === signature
  ) {
    const snapshot = preparedViewportSnapshot;
    preparedViewportSnapshot = null;
    preparedViewportSignature = "";
    preparedViewportVersion += 1;
    return Promise.resolve(snapshot);
  }

  if (
    preparedViewportCapturePromise &&
    preparedViewportCaptureSignature === signature
  ) {
    preparedViewportCaptureClaimed = true;
    preparedViewportVersion += 1;
    window.clearTimeout(preparedViewportTimer);
    preparedViewportTimer = 0;
    return preparedViewportCapturePromise;
  }

  invalidatePreparedViewportSnapshot();
  return null;
};

const schedulePreparedViewportSnapshot = (delay = 650, { ignoreIdle = false } = {}) => {
  if (!isAppleTouchDevice || !useSyntheticPageTurn || isNavigating) return;
  const isPortfolioPage = Boolean(document.querySelector("[data-portfolio-masonry]"));
  const requiredIdleTime = isPortfolioPage ? 3200 : 1400;

  window.clearTimeout(preparedViewportTimer);
  const expectedVersion = preparedViewportVersion;

  preparedViewportTimer = window.setTimeout(() => {
    preparedViewportTimer = 0;

    const prepare = async () => {
      if (isNavigating || expectedVersion !== preparedViewportVersion) return;

      const idleFor = performance.now() - lastAppleInteractionAt;
      if (!ignoreIdle && idleFor < requiredIdleTime) {
        schedulePreparedViewportSnapshot(Math.ceil(requiredIdleTime - idleFor));
        return;
      }

      if (preparedViewportCapturePromise) {
        await preparedViewportCapturePromise.catch(() => null);
        schedulePreparedViewportSnapshot(120, { ignoreIdle });
        return;
      }

      const signature = getPreparedViewportSignature();
      const capturePromise = captureCurrentViewport();
      preparedViewportCapturePromise = capturePromise;
      preparedViewportCaptureSignature = signature;
      preparedViewportCaptureClaimed = false;

      try {
        const snapshot = await capturePromise;

        if (preparedViewportCaptureClaimed) {
          return;
        }

        if (
          isNavigating ||
          expectedVersion !== preparedViewportVersion ||
          signature !== getPreparedViewportSignature()
        ) {
          releaseSnapshotCanvas(snapshot);
          return;
        }

        releaseSnapshotCanvas(preparedViewportSnapshot);
        preparedViewportSnapshot = snapshot;
        preparedViewportSignature = signature;
      } catch (error) {
        // Navigation can still capture on demand if idle preparation is unavailable.
      } finally {
        if (preparedViewportCapturePromise === capturePromise) {
          preparedViewportCapturePromise = null;
          preparedViewportCaptureSignature = "";
          preparedViewportCaptureClaimed = false;
        }
      }
    };

    if (!ignoreIdle && "requestIdleCallback" in window) {
      window.requestIdleCallback(() => void prepare(), {
        timeout: isPortfolioPage ? 1800 : 900
      });
    } else {
      void prepare();
    }
  }, delay);
};

const getVeilRenderScale = () => {
  if (!isAppleTouchDevice) return 1;

  const viewportPixels = window.innerWidth * window.innerHeight;
  const diagnosticTarget = Number(window.__veilDiagnosticRenderPixels);
  const targetRenderPixels = Number.isFinite(diagnosticTarget) && diagnosticTarget > 0
    ? diagnosticTarget
    : isIPhone
      ? 200000
      : 160000;
  const minimumScale = isIPhone ? .38 : .32;
  const maximumScale = isIPhone ? .72 : .56;
  return Math.max(minimumScale, Math.min(maximumScale, Math.sqrt(targetRenderPixels / viewportPixels)));
};

const createCanvasOverlay = (snapshot) => {
  const canvas = document.createElement("canvas");
  const renderScale = getVeilRenderScale();
  canvas.className = "veil-canvas-transition";
  canvas.width = isAppleTouchDevice
    ? Math.max(1, Math.round(window.innerWidth * renderScale))
    : snapshot.width;
  canvas.height = isAppleTouchDevice
    ? Math.max(1, Math.round(window.innerHeight * renderScale))
    : snapshot.height;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  canvas.dataset.scale = String(canvas.width / window.innerWidth);
  document.body.appendChild(canvas);
  return canvas;
};

const createSnapshotFadeOverlay = (snapshot) => {
  const canvas = document.createElement("canvas");
  const renderScale = getVeilRenderScale();
  const context = canvas.getContext("2d");

  canvas.className = "veil-snapshot-fade";
  canvas.width = isAppleTouchDevice
    ? Math.max(1, Math.round(window.innerWidth * renderScale))
    : snapshot.width;
  canvas.height = isAppleTouchDevice
    ? Math.max(1, Math.round(window.innerHeight * renderScale))
    : snapshot.height;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;

  if (context) {
    context.drawImage(snapshot, 0, 0, canvas.width, canvas.height);
  }

  document.body.appendChild(canvas);
  return canvas;
};

const createPageRevealMask = () => {
  const mask = document.createElement("canvas");
  mask.className = "page-reveal-mask";
  mask.setAttribute("aria-hidden", "true");
  mask.width = window.innerWidth;
  mask.height = window.innerHeight;
  mask.style.width = `${window.innerWidth}px`;
  mask.style.height = `${window.innerHeight}px`;
  document.body.appendChild(mask);
  return mask;
};

const paintRevealMask = (mask, points) => {
  if (!(mask instanceof HTMLCanvasElement) || points.length < 3) return;
  const context = mask.getContext("2d", { alpha: true });
  if (!context) return;

  context.clearRect(0, 0, mask.width, mask.height);
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index][0], points[index][1]);
  }
  context.closePath();
  context.fillStyle = "rgba(251, 250, 246, 0.35)";
  context.fill();
};

const paintRectangularRevealMask = (mask, revealY) => {
  paintRevealMask(mask, [
    [0, 0],
    [mask.width, 0],
    [mask.width, revealY],
    [0, revealY]
  ]);
};

const createShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Shader compile failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
};

const createProgram = (gl, vertexSource, fragmentSource) => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  let fragmentShader;

  try {
    fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  } catch (error) {
    gl.deleteShader(vertexShader);
    throw error;
  }

  const program = gl.createProgram();
  let linked = false;

  try {
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Program link failed");
    }

    linked = true;
  } finally {
    gl.detachShader(program, vertexShader);
    gl.deleteShader(vertexShader);
    gl.detachShader(program, fragmentShader);
    gl.deleteShader(fragmentShader);

    if (!linked) {
      gl.deleteProgram(program);
    }
  }

  return program;
};

const releaseWebGLContext = (gl) => {
  if (!gl) return;

  try {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch (error) {
    // Context destruction is best-effort on older WebKit builds.
  }
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

  let settled = false;
  let safetyTimeout;
  const finish = (event) => {
    if (event && event.animationName !== "domVeilLift") {
      return;
    }

    if (settled) {
      return;
    }

    settled = true;
    window.clearTimeout(safetyTimeout);
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
      paintRectangularRevealMask(revealMask, revealY);

      if (progress < 1) {
        requestAnimationFrame(updateReveal);
      }
    };

    requestAnimationFrame(updateReveal);
  }

  surface.addEventListener("animationend", finish);
  safetyTimeout = window.setTimeout(() => finish(), 3100);
  window.setTimeout(() => sheet.classList.add("is-turning"), 500);
});

const createCanvas2DFallback = (canvas) => {
  const fallback = document.createElement("canvas");
  fallback.className = canvas.className;
  fallback.width = canvas.width;
  fallback.height = canvas.height;
  fallback.style.cssText = canvas.style.cssText;
  fallback.style.visibility = "visible";
  fallback.dataset.scale = canvas.dataset.scale;
  canvas.insertAdjacentElement("afterend", fallback);
  canvas.style.visibility = "hidden";
  return fallback;
};

const clearWebGLErrors = (gl) => {
  for (let index = 0; index < 16 && gl.getError() !== gl.NO_ERROR; index += 1) {
    // Drain errors left by WebKit's context initialization before checking uploads.
  }
};

const createScaledTextureSource = (image, maxWidth = 1024) => {
  if (!(image instanceof HTMLImageElement) || image.width <= maxWidth) return image;

  const scale = maxWidth / image.width;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: true });

  if (!context) return image;

  canvas.width = maxWidth;
  canvas.height = Math.max(1, Math.round(image.height * scale));
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "medium";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const animateVeil2DFallback = async (sourceCanvas, snapshot, revealMask) => {
  const physicsCanvas = createCanvas2DFallback(sourceCanvas);

  try {
    await animateVeilCanvas2D(physicsCanvas, snapshot, revealMask);
  } catch (error) {
    const compositorCanvas = createCanvas2DFallback(physicsCanvas);

    try {
      await animateVeilCompositorFallback(compositorCanvas, snapshot, revealMask);
    } finally {
      compositorCanvas.remove();
    }
  } finally {
    physicsCanvas.remove();
  }
};

const getVeilWebGLContext = (canvas, powerPreference = "low-power") => {
  try {
    return canvas.getContext("webgl", {
      alpha: true,
      antialias: !isAppleTouchDevice,
      depth: false,
      failIfMajorPerformanceCaveat: false,
      powerPreference,
      preserveDrawingBuffer: false,
      premultipliedAlpha: true
    });
  } catch (error) {
    return null;
  }
};

const animateVeilCanvas = async (canvas, snapshot, revealMask) => {
  const gl = getVeilWebGLContext(
    canvas,
    isAppleTouchDevice ? "high-performance" : "low-power"
  );
  let attemptedWebGL = false;

  if (gl) {
    attemptedWebGL = true;
    try {
      await animateVeilWebGL(canvas, snapshot, gl, revealMask);
      return;
    } catch (error) {
      // Older mobile WebKit can lose the first context while allocating textures.
      releaseWebGLContext(gl);
    }
  }

  if (isAppleTouchDevice) {
    const retryCanvas = createCanvas2DFallback(canvas);
    const retryGl = getVeilWebGLContext(retryCanvas, "default");

    try {
      if (retryGl) {
        retryCanvas.dataset.veilRenderer = "webgl-retry";
        await animateVeilWebGL(retryCanvas, snapshot, retryGl, revealMask, {
          safeTextureUpload: true,
          rendererName: "webgl-retry"
        });
        return;
      }

      await animateVeil2DFallback(retryCanvas, snapshot, revealMask);
      return;
    } catch (error) {
      releaseWebGLContext(retryGl);
      await animateVeil2DFallback(retryCanvas, snapshot, revealMask);
      return;
    } finally {
      retryCanvas.remove();
    }
  }

  if (attemptedWebGL) {
    await animateVeil2DFallback(canvas, snapshot, revealMask);
  } else {
    await animateVeilCanvas2D(canvas, snapshot, revealMask);
  }
};

const animateVeilWebGL = async (
  canvas,
  snapshot,
  gl,
  revealMask,
  { safeTextureUpload = false, rendererName = "webgl" } = {}
) => {
  const laceAnalysis = await loadPackedLaceAnalysis();
  const laceImage = laceAnalysis.image;
  canvas.dataset.veilRenderer = rendererName;

  return new Promise((resolve, reject) => {

  const width = canvas.width;
  const height = canvas.height;
  const cols = 48;
  const rows = window.innerHeight < 700 ? 14 : 18;
  const vertexCount = (cols + 1) * (rows + 1);
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
  const wideCloth = Math.min(1, Math.max(0, (window.innerWidth - 900) / 420));
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

      const x = Math.max(
        0,
        Math.min(laceAnalysis.width - 1, Math.round(sampleU * (laceAnalysis.width - 1)))
      );
      lowest = Math.max(lowest, laceAnalysis.lowestLacePixel[x]);
    }

    if (lowest < 0) {
      return 1;
    }

    return Math.max(
      .32,
      Math.min(1, coverOffsetY + ((lowest / (laceAnalysis.height - 1)) * coverHeight))
    );
  });

  for (let pass = 0; pass < 2; pass += 1) {
    const previous = hemProfile.slice();

    for (let index = 1; index < hemProfile.length - 1; index += 1) {
      hemProfile[index] = ((previous[index - 1] * .2) + (previous[index] * .6) + (previous[index + 1] * .2));
    }
  }

  let pointer = 0;
  for (let row = 0; row <= rows; row += 1) {
    for (let col = 0; col <= cols; col += 1) {
      const vertex = (row * (cols + 1)) + col;
      texcoords[vertex * 2] = col / cols;
      texcoords[(vertex * 2) + 1] = (row / rows) * hemProfile[col];

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

  const fullVertexSource = `
    precision highp float;
    attribute vec2 a_texcoord;
    uniform float u_width;
    uniform float u_height;
    uniform float u_e;
    uniform float u_zMax;
    uniform float u_globalExit;
    uniform float u_guideY;
    uniform float u_wideCloth;
    varying vec2 v_texcoord;

    float smoothValue(float value) {
      float t = clamp(value, 0.0, 1.0);
      return t * t * (3.0 - (2.0 * t));
    }

    float coshValue(float value) {
      return (exp(value) + exp(-value)) * .5;
    }

    void main() {
      float x01 = a_texcoord.x;
      float yNorm = a_texcoord.y;
      float xNorm = x01 - .5;
      float y = yNorm * u_height;
      float anchor = smoothValue(yNorm / .055);
      float bottomGrip = smoothValue((yNorm - .84) / .16);
      float fabricDepth = clamp((yNorm - .1) / .9, 0.0, 1.0);
      float lowerCorner = smoothValue((yNorm - .78) / .22);
      float lowerEdge = smoothValue(yNorm / .08);
      float lowerRegionY = smoothValue((yNorm - .95) / .025) * (1.0 - smoothValue((yNorm - .99) / .015));
      float releaseDelay = .9 * pow(1.0 - yNorm, 2.65);
      float sideRegionY = smoothValue((yNorm - .1) / .08);
      float topLock = pow(yNorm, 1.22);
      float centerRegion = smoothValue((x01 - .45) / .035) * (1.0 - smoothValue((x01 - .55) / .035));
      float edgeRegion = max(1.0 - smoothValue(x01 / .45), smoothValue((x01 - .55) / .45));
      float fabricCosh = coshValue(xNorm / .46) - 1.0;
      float fabricCoshMax = coshValue(.5 / .46) - 1.0;
      float handleDistance = min(abs(x01 - .45), abs(x01 - .55));
      float sheetCosh = coshValue(xNorm / .72) - 1.0;
      float release = anchor * smoothValue((u_e - releaseDelay) / max(.12, 1.0 - releaseDelay));
      float verticalArc = sin(3.141592653589793 * release) * pow(yNorm, .7);
      float handleInfluence = exp(-(handleDistance * handleDistance) / .018) * bottomGrip;
      float z = release * u_zMax * verticalArc * (.74 + (handleInfluence * .46) - (sheetCosh * .28));
      float sideSetback = release * sheetCosh * u_height * .12;
      float bottomPull = bottomGrip * u_height * .42 * release;
      float lift = (u_height * 1.58 * topLock * release) + (z * (.28 + handleInfluence * .3)) + bottomPull;
      float xCurve = xNorm * z * .1;
      float projectedScale = 1.0 + (z / (u_height * 2.6));
      float sideRegion = max(
        (1.0 - smoothValue((x01 - .45) / .045)) * sideRegionY,
        smoothValue((x01 - .55) / .045) * sideRegionY
      );
      float lowerRegion = centerRegion * lowerRegionY;
      float realismRegion = max(sideRegion, lowerRegion);
      float cornerWeight = sideRegion * smoothValue((yNorm - .72) / .22);
      float leaderGate = smoothValue((y - u_guideY) / (u_height * (.12 + (u_wideCloth * cornerWeight * .08))));
      float cornerDelayAmount = u_wideCloth * cornerWeight;
      float delayedCornerGate = leaderGate * (1.0 - cornerDelayAmount + (smoothValue((release - .16) / .84) * cornerDelayAmount));
      float fabricCatenary = fabricCosh / fabricCoshMax;
      float fabricPulse = realismRegion * delayedCornerGate * sin(3.141592653589793 * release) * (1.0 - (u_globalExit * .78));
      float fabricBelly = sin(3.141592653589793 * fabricDepth) * fabricPulse;
      float naturalZ = fabricPulse * u_zMax * (.65 + (fabricDepth * .7)) * (.82 + (fabricCatenary * .36));
      float gravitationalSag = fabricPulse * u_height * (.075 + (fabricDepth * .105)) * (1.0 - (fabricCatenary * .24));
      float catenarySetback = fabricCatenary * fabricBelly * u_height * .105;
      float clothCurl = release * release * fabricPulse * u_height * .085 * (1.0 - (abs(xNorm) * .46));
      float clothSwing = sin((release * 3.141592653589793 * 2.4) + (fabricCatenary * 3.141592653589793 * 1.6) + (fabricDepth * 1.1)) * fabricPulse;
      float sx = (xNorm * u_width * projectedScale) + (u_width * .5) + xCurve;
      float sy = y - lift - sideSetback - (u_globalExit * u_height * .36);
      float lowerEdgeRelease = lowerEdge * edgeRegion * release * (1.0 - (u_globalExit * .75));
      float edgeDirection = xNorm < 0.0 ? 1.0 : -1.0;
      float edgeInset = lowerEdgeRelease * u_width * .045 * (1.0 + (fabricDepth * .35));
      sx += (clothSwing * u_width * .018 * (1.0 - (fabricCatenary * .18))) + (xNorm * naturalZ * .12);
      sx += edgeDirection * edgeInset;
      sy += gravitationalSag + catenarySetback - clothCurl + (naturalZ * .12);
      float cornerLagStrength = edgeRegion * lowerCorner * sideRegion;
      float cornerTargetY = min(u_height, u_guideY + (u_height * .9));
      sy += (cornerTargetY - sy) * cornerLagStrength;

      gl_Position = vec4((sx / u_width * 2.0) - 1.0, 1.0 - (sy / u_height * 2.0), 0.0, 1.0);
      v_texcoord = a_texcoord;
    }
  `;
  const diagnosticVertexSource = `
    precision highp float;
    attribute vec2 a_texcoord;
    varying vec2 v_texcoord;
    void main() {
      gl_Position = vec4((a_texcoord.x * 2.0) - 1.0, 1.0 - (a_texcoord.y * 2.0), 0.0, 1.0);
      v_texcoord = a_texcoord;
    }
  `;
  const vertexSource = window.__veilDiagnosticSimpleShader
    ? diagnosticVertexSource
    : fullVertexSource;
  const fullFragmentSource = `
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
      vec4 laceSample = texture2D(u_laceTexture, laceUv);
      float laceMask = smoothstep(.18, .86, laceSample.g);
      float outlineMask = smoothstep(.12, .62, laceSample.r) * (1.0 - laceMask);
      float materialAlpha = mix(.2, 1.0, laceMask);
      vec3 paleFabric = mix(color.rgb, vec3(1.0), .2 * u_material);
      vec3 whiteFabric = mix(paleFabric, vec3(1.0), u_white * .72);
      vec3 laceColor = mix(whiteFabric, vec3(1.0), laceMask * .88);
      color.rgb = mix(whiteFabric, laceColor, laceMask);
      color.rgb = mix(color.rgb, vec3(.435, .408, .376), outlineMask * u_material * .86);
      float verticalOpacity = mix(.5, .6, clamp(v_texcoord.y / .25, 0.0, 1.0));
      verticalOpacity = mix(verticalOpacity, .7, clamp((v_texcoord.y - .25) / .25, 0.0, 1.0));
      verticalOpacity = mix(verticalOpacity, .8, clamp((v_texcoord.y - .5) / .25, 0.0, 1.0));
      verticalOpacity = mix(verticalOpacity, 1.0, clamp((v_texcoord.y - .75) / .15, 0.0, 1.0));
      color.a *= max(materialAlpha, outlineMask * u_material) * u_opacity * verticalOpacity;
      float revealAlpha = .35;
      float combinedAlpha = color.a + (revealAlpha * (1.0 - color.a));
      vec3 combinedColor = (
        (color.rgb * color.a) +
        (vec3(.9843, .9804, .9647) * revealAlpha * (1.0 - color.a))
      ) / max(combinedAlpha, .0001);
      gl_FragColor = vec4(combinedColor, combinedAlpha);
    }
  `;
  const diagnosticFragmentSource = `
    precision mediump float;
    uniform sampler2D u_pageTexture;
    varying vec2 v_texcoord;
    void main() {
      gl_FragColor = texture2D(u_pageTexture, v_texcoord);
    }
  `;
  const fragmentSource = window.__veilDiagnosticSimpleShader
    ? diagnosticFragmentSource
    : fullFragmentSource;

  const program = createProgram(gl, vertexSource, fragmentSource);
  const texcoordBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  const pageTexture = gl.createTexture();
  const laceTexture = gl.createTexture();
  const texcoordLocation = gl.getAttribLocation(program, "a_texcoord");
  const widthLocation = gl.getUniformLocation(program, "u_width");
  const heightLocation = gl.getUniformLocation(program, "u_height");
  const progressLocation = gl.getUniformLocation(program, "u_e");
  const zMaxLocation = gl.getUniformLocation(program, "u_zMax");
  const globalExitLocation = gl.getUniformLocation(program, "u_globalExit");
  const guideYLocation = gl.getUniformLocation(program, "u_guideY");
  const wideClothLocation = gl.getUniformLocation(program, "u_wideCloth");
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
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.bindTexture(gl.TEXTURE_2D, pageTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  let pageTextureSource = snapshot;
  let laceTextureSource = laceImage;

  if (snapshot.width !== width || snapshot.height !== height) {
    const scaledSnapshot = document.createElement("canvas");
    const scaledContext = scaledSnapshot.getContext("2d", { alpha: true });
    scaledSnapshot.width = width;
    scaledSnapshot.height = height;

    if (scaledContext) {
      scaledContext.drawImage(snapshot, 0, 0, width, height);
      pageTextureSource = scaledSnapshot;
    }
  }

  clearWebGLErrors(gl);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pageTextureSource);

  if (gl.getError() !== gl.NO_ERROR) {
    throw new Error("WebGL page texture upload failed");
  }

  if (pageTextureSource !== snapshot) {
    pageTextureSource.width = 1;
    pageTextureSource.height = 1;
  }
  gl.uniform1i(pageTextureLocation, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, laceTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (safeTextureUpload) {
    laceTextureSource = createScaledTextureSource(laceImage);
  }
  clearWebGLErrors(gl);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, laceTextureSource);

  if (gl.getError() !== gl.NO_ERROR) {
    throw new Error("WebGL lace texture upload failed");
  }
  if (laceTextureSource !== laceImage) {
    laceTextureSource.width = 1;
    laceTextureSource.height = 1;
  }
  gl.uniform1i(laceTextureLocation, 1);

  gl.uniform4f(laceCoverLocation, coverWidth, coverHeight, coverOffsetX, coverOffsetY);
  gl.uniform1f(widthLocation, width);
  gl.uniform1f(heightLocation, height);
  gl.uniform1f(wideClothLocation, wideCloth);

  gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(texcoordLocation);
  gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  let transferCanvas = null;
  let transferContext = null;
  if (window.__veilDiagnosticTransferWebGLTo2D) {
    transferCanvas = document.createElement("canvas");
    transferCanvas.className = canvas.className;
    transferCanvas.width = canvas.width;
    transferCanvas.height = canvas.height;
    transferCanvas.style.cssText = canvas.style.cssText;
    transferCanvas.dataset.scale = canvas.dataset.scale;
    transferCanvas.dataset.veilRenderer = "webgl-to-2d";
    transferContext = transferCanvas.getContext("2d", {
      alpha: true,
      desynchronized: true
    });

    if (transferContext) {
      canvas.insertAdjacentElement("afterend", transferCanvas);
      canvas.remove();
    } else {
      transferCanvas = null;
    }
  }

  let settled = false;
  let revealMaskHidden = false;
  const hideRevealMask = () => {
    if (!revealMaskHidden && revealMask?.isConnected) {
      revealMask.style.visibility = "hidden";
      revealMaskHidden = true;
    }
  };
  const restoreRevealMask = () => {
    if (revealMaskHidden && revealMask?.isConnected) {
      revealMask.style.visibility = "visible";
    }
    revealMaskHidden = false;
  };
  const cleanupWebGL = () => {
    canvas.removeEventListener("webglcontextlost", handleContextLoss);
    transferCanvas?.remove();

    try {
      gl.deleteBuffer(texcoordBuffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteTexture(pageTexture);
      gl.deleteTexture(laceTexture);
      gl.deleteProgram(program);
    } catch (error) {
      // A lost WebGL context can reject cleanup calls on older WebKit builds.
    } finally {
      releaseWebGLContext(gl);
    }
  };
  const failWebGL = (error) => {
    if (settled) return;
    settled = true;
    restoreRevealMask();
    cleanupWebGL();
    reject(error);
  };
  const handleContextLoss = (event) => {
    event.preventDefault();
    failWebGL(new Error("WebGL context lost"));
  };
  const finishWebGL = () => {
    if (settled) return;
    settled = true;
    if (revealMask instanceof HTMLCanvasElement) {
      revealMask.remove();
      revealMask.width = 1;
      revealMask.height = 1;
    }
    cleanupWebGL();
    resolve();
  };
  canvas.addEventListener("webglcontextlost", handleContextLoss, { once: true });

  const render = (now) => {
    if (settled) return;
    hideRevealMask();
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
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(progressLocation, e);
    gl.uniform1f(zMaxLocation, zMax);
    gl.uniform1f(globalExitLocation, globalExit);
    gl.uniform1f(guideYLocation, guideY);
    gl.uniform1f(opacityLocation, opacity);
    gl.uniform1f(materialLocation, material);
    gl.uniform1f(whiteLocation, white);
    if (!window.__veilDiagnosticSkipWebGLDraw) {
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    }
    if (transferContext && transferCanvas) {
      transferContext.clearRect(0, 0, width, height);
      transferContext.drawImage(canvas, 0, 0, width, height);
    }

    if (t < 1) {
      requestAnimationFrame(safeRender);
      return;
    }

    finishWebGL();
  };

  const safeRender = (now) => {
    try {
      render(now);
    } catch (error) {
      failWebGL(error);
    }
  };

    requestAnimationFrame(safeRender);
  });
};

const drawCoverBottom = (context, image, width, height) => {
  const coverScale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * coverScale;
  const drawHeight = image.height * coverScale;
  const drawX = (width - drawWidth) / 2;
  const drawY = height - drawHeight;
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
};

const createVeilTexture2D = (snapshot, laceImage, width, height) => {
  const texture = document.createElement("canvas");
  const mask = document.createElement("canvas");
  const patternedPage = document.createElement("canvas");
  const outline = document.createElement("canvas");
  const textureContext = texture.getContext("2d", { alpha: true });
  const maskContext = mask.getContext("2d", { alpha: true });
  const patternedContext = patternedPage.getContext("2d", { alpha: true });
  const outlineContext = outline.getContext("2d", { alpha: true });

  [texture, mask, patternedPage, outline].forEach((item) => {
    item.width = width;
    item.height = height;
  });

  drawCoverBottom(maskContext, laceImage, width, height);

  textureContext.globalAlpha = .2;
  textureContext.drawImage(snapshot, 0, 0, width, height);
  textureContext.globalAlpha = 1;

  patternedContext.drawImage(snapshot, 0, 0, width, height);
  patternedContext.globalCompositeOperation = "destination-in";
  patternedContext.drawImage(mask, 0, 0);
  patternedContext.globalCompositeOperation = "source-over";
  textureContext.globalAlpha = .8;
  textureContext.drawImage(patternedPage, 0, 0);
  textureContext.globalAlpha = 1;

  patternedContext.clearRect(0, 0, width, height);
  patternedContext.fillStyle = "rgba(255, 255, 255, .72)";
  patternedContext.fillRect(0, 0, width, height);
  patternedContext.globalCompositeOperation = "destination-in";
  patternedContext.drawImage(mask, 0, 0);
  patternedContext.globalCompositeOperation = "source-over";
  textureContext.drawImage(patternedPage, 0, 0);

  const outlineRadius = Math.max(1, Math.round(Math.max(width, height) * .0005));
  for (let offsetX = -outlineRadius; offsetX <= outlineRadius; offsetX += outlineRadius) {
    for (let offsetY = -outlineRadius; offsetY <= outlineRadius; offsetY += outlineRadius) {
      if (offsetX === 0 && offsetY === 0) continue;
      outlineContext.drawImage(mask, offsetX, offsetY);
    }
  }
  outlineContext.globalCompositeOperation = "destination-out";
  outlineContext.drawImage(mask, 0, 0);
  outlineContext.globalCompositeOperation = "source-in";
  outlineContext.fillStyle = "#6F6860";
  outlineContext.fillRect(0, 0, width, height);
  outlineContext.globalCompositeOperation = "source-over";
  textureContext.drawImage(outline, 0, 0);

  const verticalOpacity = textureContext.createLinearGradient(0, 0, 0, height);
  verticalOpacity.addColorStop(0, "rgba(255,255,255,.5)");
  verticalOpacity.addColorStop(.25, "rgba(255,255,255,.6)");
  verticalOpacity.addColorStop(.5, "rgba(255,255,255,.7)");
  verticalOpacity.addColorStop(.75, "rgba(255,255,255,.8)");
  verticalOpacity.addColorStop(.9, "rgba(255,255,255,1)");
  verticalOpacity.addColorStop(1, "rgba(255,255,255,1)");
  textureContext.globalCompositeOperation = "destination-in";
  textureContext.fillStyle = verticalOpacity;
  textureContext.fillRect(0, 0, width, height);
  textureContext.globalCompositeOperation = "source-over";

  return texture;
};

const animateVeilCompositorFallback = async (canvas, snapshot, revealMask) => {
  const laceImage = await loadLaceImage();
  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    throw new Error("Compositor fallback context is unavailable");
  }

  canvas.dataset.veilRenderer = "compositor";
  const width = canvas.width;
  const height = canvas.height;
  const introDuration = 500;
  const motionDelay = 180;
  const motionDuration = 4000;
  const totalDuration = introDuration + motionDelay + motionDuration;
  const texture = createVeilTexture2D(snapshot, laceImage, width, height);

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "medium";
  context.drawImage(texture, 0, 0, width, height);
  texture.width = 1;
  texture.height = 1;

  canvas.style.transformOrigin = "50% 0%";
  canvas.style.willChange = "transform, opacity";
  const animation = canvas.animate([
    { offset: 0, opacity: 0, transform: "perspective(1200px) translate3d(0, 0, 0) rotateX(0deg) scaleY(1)" },
    { offset: introDuration / totalDuration, opacity: 1, transform: "perspective(1200px) translate3d(0, 0, 0) rotateX(0deg) scaleY(1)" },
    { offset: (introDuration + motionDelay) / totalDuration, opacity: 1, transform: "perspective(1200px) translate3d(0, 0, 0) rotateX(0deg) scaleY(1)" },
    { offset: .56, opacity: 1, transform: "perspective(1200px) translate3d(0, -14%, 0) rotateX(-12deg) scaleY(.9)" },
    { offset: .84, opacity: .96, transform: "perspective(1200px) translate3d(0, -62%, 0) rotateX(-36deg) scaleY(.58)" },
    { offset: 1, opacity: 0, transform: "perspective(1200px) translate3d(0, -106%, 0) rotateX(-68deg) scaleY(.18)" }
  ], {
    duration: totalDuration,
    easing: "linear",
    fill: "forwards"
  });

  if (revealMask?.isConnected) {
    const start = performance.now();
    const updateReveal = (now) => {
      if (!revealMask.isConnected) return;
      const progress = Math.min(
        1,
        Math.max(0, (now - start - introDuration - motionDelay) / motionDuration)
      );
      paintRectangularRevealMask(
        revealMask,
        window.innerHeight * (1 - smooth(progress))
      );

      if (progress < 1) requestAnimationFrame(updateReveal);
    };
    requestAnimationFrame(updateReveal);
  }

  await animation.finished.catch(() => {});
  canvas.style.willChange = "";
};

const animateVeilCanvas2D = async (canvas, snapshot, revealMask) => {
  const laceImage = await loadLaceImage();
  canvas.dataset.veilRenderer = "2d";

  return new Promise((resolve, reject) => {
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      reject(new Error("2D veil context is unavailable"));
      return;
    }
    const scale = Number(canvas.dataset.scale) || 1;
    const width = canvas.width;
    const height = canvas.height;
    const stripCount = window.innerHeight < 640 ? 20 : 24;
    const stripHeight = Math.ceil(height / stripCount);
    const overlap = Math.ceil(stripHeight * .3);
    const introDuration = 500;
    const motionDelay = 180;
    const motionDuration = 4000;
    const totalDuration = introDuration + motionDelay + motionDuration;
    const start = performance.now();
    const texture = createVeilTexture2D(snapshot, laceImage, width, height);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";

    const render = (now) => {
      const elapsed = now - start;
      const intro = smooth(elapsed / introDuration);
      const progress = Math.min(1, Math.max(0, (elapsed - introDuration - motionDelay) / motionDuration));
      let lowestEdge = 0;
      ctx.clearRect(0, 0, width, height);

      for (let index = 0; index < stripCount; index += 1) {
        const position = stripCount === 1 ? 1 : index / (stripCount - 1);
        const sourceY = index * stripHeight;
        const visibleHeight = Math.min(stripHeight + overlap, height - sourceY);
        const releaseDelay = .52 * Math.pow(1 - position, 2.35);
        const local = smooth((progress - releaseDelay) / Math.max(.14, 1 - releaseDelay));
        const fold = Math.sin(local * Math.PI);
        const late = smooth((local - .78) / .22);
        const arc = Math.sin(local * Math.PI * .72);
        const wave = Math.sin((progress * 4.2) + (position * 2.25)) * fold;
        const lift = local * (height * (.36 + position * 1.2)) + arc * (height * (.06 + position * .13));
        const perspectiveSquash = local * (.035 + position * .24) + late * .42;
        const destHeight = visibleHeight * Math.max(.15, 1 - perspectiveSquash);
        const destY = sourceY - lift - (late * height * .24) + (wave * 2 * scale);
        const destX = wave * 2.4 * scale;
        const destWidth = width * (1 + (fold * .006));
        const opacity = 1 - (late * late);

        if (destHeight <= 1 || opacity <= .01) continue;

        lowestEdge = Math.max(lowestEdge, destY + destHeight);
        ctx.save();
        ctx.globalAlpha = opacity * intro;
        ctx.shadowColor = "rgba(34, 32, 29, .14)";
        ctx.shadowBlur = 6 * scale * fold;
        ctx.shadowOffsetY = 8 * scale * fold;
        ctx.drawImage(texture, 0, sourceY, width, visibleHeight, destX, destY, destWidth, destHeight);
        ctx.restore();
      }

      if (revealMask) {
        const revealY = Math.max(0, Math.min(window.innerHeight, lowestEdge / scale));
        paintRectangularRevealMask(revealMask, revealY);
      }

      if (elapsed < totalDuration) {
        requestAnimationFrame(render);
        return;
      }

      texture.width = 1;
      texture.height = 1;
      resolve();
    };

    requestAnimationFrame(render);
  });
};

const finishNavigation = () => {
  body.classList.remove("is-page-turning", "has-visible-scrollbar");
  window.removeEventListener("wheel", keepScrollLocked);
  window.removeEventListener("touchmove", keepScrollLocked);
  isNavigating = false;
  schedulePreparedViewportSnapshot(1800);
};

const keepScrollLocked = (event) => {
  event.preventDefault();
  window.scrollTo(window.scrollX, lockedScrollY);
};

const navigateWithoutAnimation = async (url, shouldPush = false) => {
  const nextDocument = await loadDocument(url);
  replacePageContent(nextDocument, url.href);
  window.scrollTo(0, 0);
  if (shouldPush) {
    window.history.pushState({}, "", url.href);
  }
  setupPageInteractions(url.href);
};

const navigateWithPageTurn = async (url, preparedSnapshotPromise = null) => {
  isNavigating = true;
  lockedScrollY = window.scrollY;
  window.addEventListener("wheel", keepScrollLocked, { passive: false });
  window.addEventListener("touchmove", keepScrollLocked, { passive: false });
  body.classList.toggle("has-visible-scrollbar", document.documentElement.scrollHeight > document.documentElement.clientHeight);
  body.classList.add("is-page-turning");

  try {
    if (!useSyntheticPageTurn) {
      await navigateWithoutAnimation(url, true);
      finishNavigation();
      return;
    }

    const nextDocumentPromise = loadDocument(url);
    let snapshot = null;

    try {
      snapshot = await (preparedSnapshotPromise || captureCurrentViewport());
    } catch (error) {
      console.warn("Veil viewport capture failed; continuing without a synthetic texture.", error);
      snapshot = null;
    }

    const transitionLayer = snapshot ? createCanvasOverlay(snapshot) : null;
    const snapshotFadeLayer = snapshot ? createSnapshotFadeOverlay(snapshot) : null;
    const revealMask = snapshot ? createPageRevealMask() : null;
    const nextDocument = await nextDocumentPromise;

    replacePageContent(nextDocument, url.href);
    window.scrollTo(0, 0);
    window.history.pushState({}, "", url.href);
    setupPageInteractions(url.href);

    if (snapshotFadeLayer) {
      window.setTimeout(() => {
        snapshotFadeLayer.remove();
        snapshotFadeLayer.width = 1;
        snapshotFadeLayer.height = 1;
      }, 560);
    }

    try {
      if (snapshot && transitionLayer && revealMask) {
        await withTimeout(
          animateVeilCanvas(transitionLayer, snapshot, revealMask),
          7000,
          "veil animation timed out"
        );
      }
    } catch (error) {
      // The new page is already in place. A failed animation must never block navigation.
    }

    revealMask?.remove();
    snapshotFadeLayer?.remove();
    transitionLayer?.remove();
    releaseSnapshotCanvas(transitionLayer);
    releaseSnapshotCanvas(snapshot);
    finishNavigation();
  } catch (error) {
    document.querySelector(".page-reveal-mask")?.remove();
    document.querySelector(".veil-snapshot-fade")?.remove();
    document.querySelector(".veil-canvas-transition")?.remove();
    document.querySelector(".veil-dom-transition")?.remove();
    finishNavigation();
    window.location.href = url.href;
  }
};

window.addEventListener("pageshow", () => {
  finishNavigation();
  setupPageInteractions();
  scheduleTransitionWarmup();
  schedulePreparedViewportSnapshot(1600);
  body.classList.add("initial-enter", "page-ready");
  window.setTimeout(() => body.classList.remove("initial-enter"), 700);
});

window.addEventListener("scroll", () => {
  if (!isAppleTouchDevice || isNavigating) return;
  lastAppleInteractionAt = performance.now();
  invalidatePreparedViewportSnapshot();
  schedulePreparedViewportSnapshot(2200);
}, { passive: true });

window.addEventListener("resize", () => {
  if (!isAppleTouchDevice || isNavigating) return;
  lastAppleInteractionAt = performance.now();
  invalidatePreparedViewportSnapshot();
  schedulePreparedViewportSnapshot(1800);
}, { passive: true });

window.addEventListener("orientationchange", () => {
  if (!isAppleTouchDevice || isNavigating) return;
  lastAppleInteractionAt = performance.now();
  invalidatePreparedViewportSnapshot();
  schedulePreparedViewportSnapshot(2200);
}, { passive: true });

window.addEventListener("popstate", async () => {
  try {
    await navigateWithoutAnimation(new URL(window.location.href));
  } catch (error) {
    window.location.reload();
  }
});

const getInternalNavigationUrl = (link) => {
  if (
    !(link instanceof HTMLAnchorElement) ||
    link.target === "_blank" ||
    link.hasAttribute("download")
  ) {
    return null;
  }

  const url = new URL(link.getAttribute("href"), window.location.href);
  const isSamePageHash = url.pathname === window.location.pathname && url.hash;
  const isInternalPage = url.origin === window.location.origin || window.location.protocol === "file:";

  if (!isInternalPage || isSamePageHash || url.href === window.location.href) {
    return null;
  }

  return url;
};

const startInternalNavigation = (url, preparedSnapshotPromise = null) => {
  if (isNavigating) return;
  void navigateWithPageTurn(url, preparedSnapshotPromise);
};

const warmInternalLink = (link) => {
  const url = getInternalNavigationUrl(link);
  if (!url) return null;
  if (!useSyntheticPageTurn) return url;
  loadDocument(url).catch(() => {});
  loadHtml2Canvas().catch(() => {});
  loadPackedLaceAnalysis().catch(() => {});
  return url;
};

document.addEventListener("pointerover", (event) => {
  if (event.pointerType === "touch") return;
  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest("a[href]");
  if (link) warmInternalLink(link);
}, { passive: true });

document.addEventListener("focusin", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest("a[href]");
  if (link) warmInternalLink(link);
});

document.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch" || event.isPrimary === false) return;
  if (isAppleTouchDevice) return;
  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest("a[href]");
  const url = link ? warmInternalLink(link) : null;
  if (!link || !url) {
    touchNavigationCandidate = null;
    return;
  }

  const preparedSnapshotPromise = isAppleTouchDevice && !reducedMotion
    ? takePreparedViewportSnapshot()
    : null;

  touchNavigationCandidate = {
    link,
    url,
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    snapshotPromise: reducedMotion
      ? null
      : isAppleTouchDevice
        ? preparedSnapshotPromise
        : captureCurrentViewport().catch(() => null)
  };
}, { passive: true });

document.addEventListener("pointermove", (event) => {
  const candidate = touchNavigationCandidate;
  if (!candidate || candidate.pointerId !== event.pointerId) return;
  if (Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) > 14) {
    touchNavigationCandidate = null;
  }
}, { passive: true });

document.addEventListener("pointercancel", () => {
  touchNavigationCandidate = null;
}, { passive: true });

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const link = target?.closest("a[href]");
  const candidate = touchNavigationCandidate;
  touchNavigationCandidate = null;

  if (!link || event.defaultPrevented) {
    return;
  }

  if (
    event.button > 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    link.target === "_blank" ||
    link.hasAttribute("download")
  ) {
    return;
  }

  const url = getInternalNavigationUrl(link);

  if (!url) {
    return;
  }

  if (isAppleTouchDevice) {
    return;
  }

  event.preventDefault();

  const preparedSnapshotPromise = candidate?.link === link && candidate.url.href === url.href
    ? candidate.snapshotPromise
    : isAppleTouchDevice && !reducedMotion
      ? takePreparedViewportSnapshot()
      : null;
  startInternalNavigation(url, preparedSnapshotPromise);
});
