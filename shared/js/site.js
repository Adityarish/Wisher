(() => {
  "use strict";
  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.animation === "off";
  let activeAudio = null;
  const pauseActive = (except) => {
    document.querySelectorAll("audio, video").forEach((media) => {
      if (media !== except && !media.paused) media.pause();
    });
  };

  const background = document.querySelector("[data-background-music]");
  const musicToggle = document.querySelector("[data-music-toggle]");
  if (background && musicToggle) {
    const icon = musicToggle.querySelector("[data-music-icon]");
    const update = () => {
      const playing = !background.paused;
      musicToggle.setAttribute("aria-pressed", String(playing));
      musicToggle.setAttribute("aria-label", playing ? "Pause background music" : "Play background music");
      icon.textContent = playing ? "Ⅱ" : "♪";
    };
    musicToggle.addEventListener("click", async () => {
      if (background.paused) {
        pauseActive(background);
        try { await background.play(); activeAudio = background; } catch { musicToggle.setAttribute("aria-label", "Music could not play in this browser"); }
      } else background.pause();
      update();
    });
    document.querySelector("[data-volume]")?.addEventListener("input", (event) => { background.volume = Number(event.target.value); });
    background.addEventListener("play", update); background.addEventListener("pause", update);
  }
  document.querySelectorAll("video, audio:not([data-background-music])").forEach((media) => media.addEventListener("play", () => { pauseActive(media); activeAudio = media; }));

  const revealItems = document.querySelectorAll(".reveal-on-scroll");
  if (reduceMotion || !("IntersectionObserver" in window)) revealItems.forEach((item) => item.classList.add("is-visible"));
  else {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }), { threshold: .12, rootMargin: "0px 0px -30px" });
    revealItems.forEach((item) => observer.observe(item));
  }

  const lightbox = document.querySelector("[data-lightbox]");
  if (lightbox) {
    const image = lightbox.querySelector("[data-lightbox-image]");
    document.querySelectorAll("[data-lightbox-src]").forEach((button) => button.addEventListener("click", () => {
      image.src = button.dataset.lightboxSrc; image.alt = button.dataset.lightboxAlt || "Photo preview"; lightbox.showModal();
    }));
    lightbox.querySelector("[data-lightbox-close]").addEventListener("click", () => lightbox.close());
    lightbox.addEventListener("click", (event) => { if (event.target === lightbox) lightbox.close(); });
  }

  document.querySelectorAll("[data-expand-letter]").forEach((button) => button.addEventListener("click", () => {
    const copy = button.parentElement.querySelector("[data-letter-copy]");
    const expanded = copy.classList.toggle("is-expanded");
    button.setAttribute("aria-expanded", String(expanded));
    button.textContent = expanded ? "Fold the letter" : (button.dataset.label || "Read the letter");
  }));

  const confetti = () => {
    if (reduceMotion) return;
    const layer = document.querySelector("[data-confetti]");
    const colors = ["#ff5e79", "#ffd166", "#52d6d3", "#9d7cff", "#ffffff"];
    for (let index = 0; index < 70; index += 1) {
      const piece = document.createElement("i"); piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}%`; piece.style.setProperty("--drift", `${(Math.random() - .5) * 40}vw`);
      piece.style.setProperty("--duration", `${2.5 + Math.random() * 2}s`); piece.style.setProperty("--confetti", colors[index % colors.length]);
      piece.style.animationDelay = `${Math.random() * .35}s`; layer.append(piece); setTimeout(() => piece.remove(), 5000);
    }
  };
  document.querySelectorAll("[data-surprise]").forEach((button) => button.addEventListener("click", () => {
    const message = button.parentElement.querySelector("[data-surprise-message]");
    if (message) { message.hidden = false; message.id = "surprise-message"; message.focus?.(); }
    button.textContent = "This moment is yours ✦"; button.disabled = true; confetti();
  }));
  document.querySelectorAll("[data-open-experience]").forEach((button) => button.addEventListener("click", async () => {
    document.body.classList.add("experience-open");
    document.querySelector("#story-start")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    if (background) { try { await background.play(); } catch { /* visible controls remain available */ } }
  }));
  document.querySelectorAll("[data-celebrate]").forEach((button) => button.addEventListener("click", confetti));

  const countdown = document.querySelector("[data-countdown]");
  if (countdown) {
    const target = new Date(countdown.dataset.countdown);
    const updateCountdown = () => {
      const remaining = Math.max(0, target.getTime() - Date.now());
      const values = [Math.floor(remaining / 86400000), Math.floor(remaining / 3600000) % 24, Math.floor(remaining / 60000) % 60, Math.floor(remaining / 1000) % 60];
      countdown.querySelectorAll("[data-countdown-value]").forEach((node, index) => { node.textContent = String(values[index]).padStart(2, "0"); });
    };
    if (!Number.isNaN(target.getTime())) { updateCountdown(); setInterval(updateCountdown, 1000); }
  }
})();

