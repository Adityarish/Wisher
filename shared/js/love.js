(() => {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reduce ? 0 : ms));

  /* floating hearts burst from a point */
  const burst = (x, y, count = 14, glyphs = ["♥", "❤", "💗", "✦"]) => {
    if (reduce) return;
    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      el.className = "love-burst"; el.textContent = glyphs[(Math.random() * glyphs.length) | 0];
      el.style.left = `${x}px`; el.style.top = `${y}px`;
      el.style.setProperty("--dx", `${(Math.random() - .5) * 320}px`); el.style.setProperty("--r", `${(Math.random() - .5) * 120}deg`);
      el.style.setProperty("--t", `${1.4 + Math.random() * 1.2}s`);
      el.style.fontSize = `${.9 + Math.random() * 1.6}rem`;
      document.body.append(el); setTimeout(() => el.remove(), 2800);
    }
  };
  window.WishCraftBurst = burst;

  /* ----- envelope -> letter -> typed message ----- */
  document.querySelectorAll("[data-lovemail]").forEach((root) => {
    const envelope = root.querySelector("[data-envelope]");
    const paper = root.querySelector("[data-paper]");
    const target = root.querySelector("[data-typed]");
    const sign = root.querySelector(".lovemail__sign");
    const skip = root.querySelector("[data-skip-typing]");
    if (!envelope || !target) return;
    const full = target.dataset.full || target.textContent;
    sign?.classList.add("is-waiting");
    let skipped = false, opened = false;

    const type = async () => {
      target.textContent = ""; target.classList.add("is-typing"); if (skip) skip.hidden = false;
      for (let i = 0; i < full.length && !skipped; i++) {
        target.textContent += full[i];
        const ch = full[i];
        await wait(/[.!?]/.test(ch) ? 260 : /[,;]/.test(ch) ? 130 : 24);
      }
      target.textContent = full; target.classList.remove("is-typing");
      if (skip) skip.hidden = true; sign?.classList.remove("is-waiting");
      const r = target.getBoundingClientRect(); burst(r.left + r.width / 2, r.bottom, 18);
    };
    skip?.addEventListener("click", () => { skipped = true; });

    const open = async () => {
      if (opened) return; opened = true;
      envelope.classList.add("is-open"); envelope.setAttribute("aria-expanded", "true");
      const r = envelope.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 22);
      await wait(1900);
      envelope.classList.add("is-gone");
      await wait(500);
      root.classList.add("is-read");
      paper.setAttribute("tabindex", "-1");
      paper.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      await wait(900);
      type();
    };
    envelope.addEventListener("click", open);
  });

  /* ----- 100 reasons ----- */
  document.querySelectorAll("[data-reasons]").forEach((root) => {
    const tiles = [...root.querySelectorAll(".heart-tile")];
    const pop = root.querySelector("[data-reason-pop]");
    const textEl = root.querySelector("[data-reason-text]");
    const numEl = root.querySelector("[data-reason-n]");
    const countEl = root.querySelector("[data-reasons-count]");
    const bar = root.querySelector("[data-reasons-bar]");
    const done = root.querySelector("[data-reasons-done]");
    const total = tiles.length;
    let current = 0;

    const update = () => {
      const opened = tiles.filter((t) => t.classList.contains("is-opened")).length;
      countEl.textContent = opened; bar.style.setProperty("--p", (opened / total).toFixed(3));
      if (opened === total && done.hidden) { done.hidden = false; burst(innerWidth / 2, innerHeight / 2, 40); }
    };
    const show = (index, from) => {
      current = (index + total) % total;
      const tile = tiles[current];
      tile.classList.add("is-opened");
      textEl.textContent = tile.dataset.reason; numEl.textContent = tile.dataset.n;
      if (!pop.open) pop.showModal();
      const r = (from || tile).getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 8, ["♥"]);
      update();
    };
    tiles.forEach((tile, i) => tile.addEventListener("click", () => show(i, tile)));
    root.querySelector("[data-reason-next]").addEventListener("click", () => show(current + 1));
    root.querySelector("[data-reason-prev]").addEventListener("click", () => show(current - 1));
    root.querySelector("[data-reason-close]").addEventListener("click", () => pop.close());
    pop.addEventListener("click", (e) => { if (e.target === pop) pop.close(); });
    pop.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") show(current + 1); if (e.key === "ArrowLeft") show(current - 1); });
    root.querySelector("[data-reason-random]").addEventListener("click", () => {
      const left = tiles.map((t, i) => ({ t, i })).filter(({ t }) => !t.classList.contains("is-opened"));
      const pick = (left.length ? left : tiles.map((t, i) => ({ t, i })))[Math.floor(Math.random() * (left.length || total))];
      pick.t.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      show(pick.i);
    });
  });
})();
