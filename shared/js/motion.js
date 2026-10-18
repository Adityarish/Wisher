(() => {
  "use strict";
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.animation === "off";

  /* ----- directional slides: alternate left/right inside each group ----- */
  const groups = new Map();
  document.querySelectorAll(".reveal-on-scroll").forEach((el) => {
    const parent = el.parentElement; if (!groups.has(parent)) groups.set(parent, []); groups.get(parent).push(el);
  });
  groups.forEach((items) => items.forEach((el, i) => {
    el.style.setProperty("--i", i % 6);
    if (el.classList.contains("section-heading")) { el.dataset.slide = "up"; return; }
    if (el.classList.contains("tile")) { el.dataset.slide = ["left", "up", "right"][i % 3]; el.setAttribute("data-stagger", ""); return; }
    if (el.classList.contains("timeline-item")) { el.dataset.slide = i % 2 ? "right" : "left"; return; }
    if (el.classList.contains("story-card") || el.classList.contains("event-card") || el.classList.contains("voice-card")) { el.dataset.slide = ["flip", "up", "zoom"][i % 3]; el.setAttribute("data-stagger", ""); return; }
    if (el.matches("blockquote")) { el.dataset.slide = i % 2 ? "right" : "left"; return; }
    if (el.classList.contains("letter-shell") || el.classList.contains("surprise-card")) { el.dataset.slide = "zoom"; return; }
    el.dataset.slide = i % 2 ? "right" : "left";
  }));

  if (reduce) return;

  /* ----- parallax on big pictures ----- */
  const targets = [...document.querySelectorAll(".hero__media img, .modular-photo img, .intimate-message figure img")];
  targets.forEach((img) => img.classList.add("parallax-img"));
  const drifters = [...document.querySelectorAll(".float-gifs img")];
  let ticking = false;
  const frame = () => {
    ticking = false;
    const vh = innerHeight;
    targets.forEach((img) => {
      const r = img.parentElement.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      img.style.setProperty("--py", `${((r.top + r.height / 2 - vh / 2) * -.12).toFixed(1)}px`);
    });
    drifters.forEach((g, i) => { g.style.translate = `0 ${(-scrollY * (.04 + (i % 3) * .03)).toFixed(1)}px`; });
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
  addEventListener("resize", frame); frame();

  /* ----- nav: sliding pill follows hover / active link ----- */
  const list = document.querySelector("[data-nav-links]");
  if (list && matchMedia("(min-width: 821px)").matches) {
    const pill = document.createElement("span"); pill.className = "nav-pill"; list.prepend(pill);
    const moveTo = (a) => {
      if (!a) { pill.classList.remove("is-on"); return; }
      const li = a.parentElement; pill.style.width = `${li.offsetWidth}px`; pill.style.translate = `${li.offsetLeft}px 0`; pill.classList.add("is-on");
    };
    const active = () => list.querySelector("a.is-active");
    list.addEventListener("pointerover", (e) => { const a = e.target.closest("a"); if (a) moveTo(a); });
    list.addEventListener("pointerleave", () => moveTo(active()));
    let last = null;
    new MutationObserver((records) => {   // ignore the pill's own class changes (would loop forever)
      if (records.every((r) => r.target === pill)) return;
      const now = active(); if (now === last) return; last = now;
      if (!list.matches(":hover")) moveTo(now);
    }).observe(list, { subtree: true, attributes: true, attributeFilter: ["class"] });
    setTimeout(() => moveTo(active()), 400);
  }

  /* ----- custom cursor ring (mouse only) ----- */
  if (matchMedia("(pointer: fine)").matches) {
    const ring = document.createElement("div"); ring.className = "cursor-ring"; ring.setAttribute("aria-hidden", "true"); document.body.append(ring);
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, running = false;
    const loop = () => {
      rx += (x - rx) * .2; ry += (y - ry) * .2; ring.style.transform = `translate(${rx.toFixed(1)}px,${ry.toFixed(1)}px)`;
      if (Math.abs(x - rx) > .3 || Math.abs(y - ry) > .3) requestAnimationFrame(loop); else running = false;
    };
    addEventListener("pointermove", (e) => {
      x = e.clientX; y = e.clientY; ring.classList.add("is-on");
      ring.classList.toggle("is-hot", Boolean(e.target.closest?.("a, button, [role=button], .tile, .heart-tile, input, label, summary")));
      if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: true });
    addEventListener("pointerdown", () => ring.classList.add("is-down"));
    addEventListener("pointerup", () => ring.classList.remove("is-down"));
    document.addEventListener("pointerleave", () => ring.classList.remove("is-on"));
  }
})();
