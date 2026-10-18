(() => {
  "use strict";
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.animation === "off";
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } }
  };
  const toastEl = document.createElement("div"); toastEl.className = "nav-toast"; toastEl.setAttribute("role", "status"); document.body.append(toastEl);
  const toast = (msg) => { toastEl.textContent = msg; toastEl.classList.add("is-on"); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove("is-on"), 2200); };

  /* ----- splash ----- */
  const splash = document.querySelector("[data-splash]");
  if (splash) {
    document.body.classList.add("splash-lock");
    const go = document.querySelector("[data-splash-open]");
    const close = async () => {
      splash.classList.add("is-gone"); document.body.classList.remove("splash-lock");
      window.WishCraftBurst?.(innerWidth / 2, innerHeight / 2, 26);
      const music = document.querySelector("[data-background-music]");
      if (music && !root.dataset.noAutoMusic) { try { await music.play(); } catch { /* controls stay visible */ } }
      document.querySelector("h1")?.focus?.({ preventScroll: true });
    };
    go?.addEventListener("click", close);
    if (location.hash === "#nosplash") close();
    addEventListener("keydown", (e) => { if (e.key === "Escape" && !splash.classList.contains("is-gone")) close(); });
  }

  /* ----- nav built from the sections that exist ----- */
  const nav = document.querySelector("[data-site-nav]");
  if (nav) {
    const labels = { timeline: "Our story", events: "Events", gallery: "Memories", media: "Videos", memories: "Moments", memory: "Moments", reasons: "Reasons", letter: "Letter", quotes: "Quotes", surprise: "Surprise", closing: "Wishes", countdown: "Countdown" };
    const list = nav.querySelector("[data-nav-links]");
    const targets = [...document.querySelectorAll("main [data-section][id], main footer[id]")];
    const seen = new Set();
    targets.forEach((section) => {
      const key = section.dataset.section || section.id;
      if (seen.has(section.id)) return; seen.add(section.id);
      const li = document.createElement("li"); const a = document.createElement("a");
      a.href = `#${section.id}`; a.textContent = section.dataset.nav || labels[key] || labels[section.id] || key;
      li.append(a); list.append(li);
    });
    if (!list.children.length) nav.querySelector("[data-nav-menu]")?.remove();
    const links = [...list.querySelectorAll("a")];
    if ("IntersectionObserver" in window && links.length) {
      const map = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
      const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) { links.forEach((l) => l.classList.remove("is-active")); map.get(entry.target.id)?.classList.add("is-active"); }
      }), { rootMargin: "-40% 0px -55% 0px" });
      targets.forEach((t) => io.observe(t));
    }
    list.addEventListener("click", () => nav.classList.remove("is-open"));
    nav.querySelector("[data-nav-menu]")?.addEventListener("click", (e) => { const open = nav.classList.toggle("is-open"); e.currentTarget.setAttribute("aria-expanded", String(open)); });

    /* hide on scroll down, show on scroll up */
    let last = scrollY;
    addEventListener("scroll", () => {
      const y = scrollY; nav.classList.toggle("is-hidden", y > last && y > 400 && !nav.classList.contains("is-open")); last = y;
    }, { passive: true });

    /* theme toggle */
    const themeBtn = nav.querySelector("[data-theme-toggle]");
    if (root.classList.contains("scheme-dark")) themeBtn?.remove(); /* designed dark, nothing to toggle */
    const dark = () => (root.dataset.theme || (root.dataset.appearance === "dark" ? "dark" : matchMedia("(prefers-color-scheme: dark)").matches && root.dataset.appearance === "auto" ? "dark" : "light")) === "dark";
    const saved = store.get("wishcraft-theme"); if (saved) root.dataset.theme = saved;
    const paint = () => { if (themeBtn) { themeBtn.textContent = dark() ? "☀" : "☾"; themeBtn.setAttribute("aria-label", dark() ? "Switch to light mode" : "Switch to dark mode"); } };
    themeBtn?.addEventListener("click", () => { root.dataset.theme = dark() ? "light" : "dark"; store.set("wishcraft-theme", root.dataset.theme); paint(); });
    paint();

    /* share */
    nav.querySelector("[data-share]")?.addEventListener("click", async () => {
      const data = { title: document.title, text: document.querySelector('meta[name="description"]')?.content || document.title, url: location.href };
      if (navigator.share) { try { await navigator.share(data); return; } catch { /* cancelled */ } }
      try { await navigator.clipboard.writeText(location.href); toast("Link copied ♥"); } catch { toast("Copy the address bar link to share"); }
    });
  }

  document.querySelector("[data-share-footer]")?.addEventListener("click", (e) => { e.preventDefault(); nav?.querySelector("[data-share]")?.click(); });

  /* ----- back to top ----- */
  const top = document.querySelector("[data-to-top]");
  if (top) {
    addEventListener("scroll", () => top.classList.toggle("is-on", scrollY > 900), { passive: true });
    top.addEventListener("click", () => scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }));
  }

  /* ----- particles: hearts / confetti / stars ----- */
  const canvas = document.querySelector("[data-particles]");
  if (canvas && !reduce) {
    const mode = canvas.dataset.particles;
    const ctx = canvas.getContext("2d");
    const glyphs = mode === "hearts" ? ["♥", "♥", "❤", "♡"] : mode === "stars" ? ["✦", "✧", "★"] : ["●", "◆", "■", "▲"];
    const colors = mode === "hearts" ? ["#ff5f87", "#ff8fab", "#ffb3c6", "#e63e6d"] : ["#ff5e79", "#ffd166", "#52d6d3", "#9d7cff", "#ffffff"];
    let w = 0, h = 0, dpr = 1, items = [], running = true;
    const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); w = canvas.width = innerWidth * dpr; h = canvas.height = innerHeight * dpr; };
    const make = (initial) => ({ x: Math.random() * w, y: initial ? Math.random() * h : h + 40 * dpr, s: (10 + Math.random() * 22) * dpr, v: (.25 + Math.random() * .8) * dpr, sway: Math.random() * 6, a: .15 + Math.random() * .35, g: glyphs[(Math.random() * glyphs.length) | 0], c: colors[(Math.random() * colors.length) | 0], r: Math.random() * 6 });
    size(); const count = innerWidth < 700 ? 14 : 26; items = Array.from({ length: count }, () => make(true));
    addEventListener("resize", size);
    document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) requestAnimationFrame(tick); });
    let t = 0;
    function tick() {
      if (!running) return; t += .01; ctx.clearRect(0, 0, w, h);
      for (const p of items) {
        p.y -= p.v; p.x += Math.sin(t * 2 + p.sway) * .4 * dpr;
        if (p.y < -50 * dpr) Object.assign(p, make(false));
        ctx.globalAlpha = p.a; ctx.fillStyle = p.c; ctx.font = `${p.s}px serif`; ctx.fillText(p.g, p.x, p.y);
      }
      requestAnimationFrame(tick);
    }
    tick();
  }
})();
