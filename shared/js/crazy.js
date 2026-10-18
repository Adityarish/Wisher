(() => {
  "use strict";
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.animation === "off";
  const finePointer = matchMedia("(pointer: fine)").matches;

  /* scroll progress */
  const bar = document.querySelector("[data-scroll-progress]");
  if (bar) {
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.setProperty("--p", max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0);
      ticking = false;
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* split the main headline into animated letters */
  const h1 = document.querySelector("h1");
  if (h1 && !reduce && h1.children.length === 0) {
    const text = h1.textContent;
    h1.setAttribute("aria-label", text);
    h1.textContent = "";
    let c = 0;
    text.split(/(\s+)/).forEach((part) => {
      if (/^\s+$/.test(part)) { h1.append(" "); return; }
      const word = document.createElement("span");
      word.className = "word"; word.setAttribute("aria-hidden", "true");
      [...part].forEach((ch) => { const s = document.createElement("span"); s.className = "char"; s.style.setProperty("--c", c++); s.textContent = ch; word.append(s); });
      h1.append(word);
    });
    setTimeout(() => h1.classList.add("is-split"), 400 + c * 45 + 800);
  }

  if (reduce) { /* keep functional features only */ }

  /* cursor glow, tilt, magnetic buttons */
  const glow = document.querySelector("[data-cursor-glow]");
  if (finePointer && !reduce) {
    let gx = 0, gy = 0, raf = 0;
    addEventListener("pointermove", (e) => {
      gx = e.clientX; gy = e.clientY;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (glow) { glow.style.transform = `translate(${gx}px,${gy}px)`; glow.classList.add("is-on"); } });
    }, { passive: true });
    document.addEventListener("pointerleave", () => glow?.classList.remove("is-on"));

    document.querySelectorAll("[data-tilt], .story-card, .event-card").forEach((el) => {
      el.setAttribute("data-tilt", "");
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        el.classList.add("is-tilting");
        el.style.setProperty("--ry", `${(px * 14).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(-py * 14).toFixed(2)}deg`);
      });
      el.addEventListener("pointerleave", () => { el.classList.remove("is-tilting"); el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
    });

    document.querySelectorAll(".button, .music-toggle").forEach((el) => {
      el.classList.add("magnetic");
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * .25).toFixed(1)}px,${((e.clientY - r.top - r.height / 2) * .35).toFixed(1)}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  /* click sparkles */
  if (!reduce) {
    const glyphs = ["✦", "✨", "♥", "★", "✿"];
    addEventListener("pointerdown", (e) => {
      for (let i = 0; i < 7; i++) {
        const s = document.createElement("span");
        s.className = "spark"; s.textContent = glyphs[(Math.random() * glyphs.length) | 0];
        const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
        s.style.left = `${e.clientX}px`; s.style.top = `${e.clientY}px`;
        s.style.setProperty("--dx", `${Math.cos(a) * d}px`); s.style.setProperty("--dy", `${Math.sin(a) * d}px`);
        s.style.color = `hsl(${Math.random() * 360} 90% 60%)`;
        document.body.append(s); setTimeout(() => s.remove(), 950);
      }
    }, { passive: true });
  }

  /* collage: play videos only while visible (muted previews) */
  const previews = document.querySelectorAll("video[data-autoplay-visible]");
  if (previews.length && "IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
      const v = entry.target;
      if (entry.isIntersecting) v.play().catch(() => {}); else v.pause();
    }), { threshold: .35 });
    previews.forEach((v) => io.observe(v));
  }

  /* collage lightbox (photos and videos) */
  const box = document.querySelector("[data-lightbox]");
  if (box) {
    const img = box.querySelector("[data-lightbox-image]");
    const vid = box.querySelector("[data-lightbox-video]");
    const cap = box.querySelector("[data-lightbox-caption]");
    const open = (tile) => {
      const isVideo = tile.dataset.kind === "video";
      img.hidden = isVideo; vid.hidden = !isVideo;
      if (isVideo) { vid.src = tile.dataset.src; img.removeAttribute("src"); document.querySelectorAll("audio").forEach((a) => a.pause()); }
      else { img.src = tile.dataset.src; img.alt = tile.dataset.caption || "Photo preview"; }
      cap.textContent = tile.dataset.caption || "";
      box.showModal();
      if (isVideo) vid.play().catch(() => {});
    };
    document.querySelectorAll("[data-collage-open]").forEach((tile) => {
      tile.addEventListener("click", () => open(tile));
      tile.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(tile); } });
    });
    box.addEventListener("close", () => { vid.pause(); vid.removeAttribute("src"); vid.load(); img.hidden = false; vid.hidden = true; });
  }
})();
