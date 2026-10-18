(() => {
  "use strict";
  const form = document.querySelector("#editor-form");
  const steps = [...document.querySelectorAll(".editor-step")];
  const stepButtons = [...document.querySelectorAll("[data-step-target]")];
  const projectSelect = document.querySelector("#project-select");
  const toast = document.querySelector("#toast");
  const state = { step: 0, project: projectSelect.value || "default", content: {}, media: {}, dirty: false };
  const fields = (name) => form.elements.namedItem(name);
  const showToast = (message) => { toast.textContent = message; toast.classList.add("is-visible"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2600); };
  const api = async (url, options = {}) => {
    const response = await fetch(url, options); const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`); return payload;
  };
  const value = (name, fallback = "") => fields(name)?.value ?? fallback;
  const checked = (name) => Boolean(fields(name)?.checked);
  const lines = (name) => value(name).split(/\n+/).map((text) => text.trim()).filter(Boolean).map((text, index) => ({ title: `Memory ${index + 1}`, text }));
  const textLines = (name) => value(name).split(/\n/).map((text) => text.trim());
  const pipeLines = (name) => textLines(name).filter(Boolean).map((line) => line.split("|").map((part) => part.trim()));
  const isoDate = (input) => input ? new Date(input).toISOString() : null;

  function serialize() {
    const chosenOccasion = form.querySelector('[name="occasion"]:checked')?.value || "custom";
    const selectedSections = [...document.querySelectorAll("#section-picker label")].filter((label) => label.querySelector("input").checked).map((label) => label.querySelector("input").value);
    const eventName = value("event_name") || (chosenOccasion.startsWith("wedding") ? "Wedding celebration" : "Celebration");
    const eventVenue = value("event_venue");
    const primaryEvent = eventVenue || value("map_url") || value("rsvp_url") || value("event_description") ? [{ name: eventName, description: value("event_description"), datetime: value("event_datetime"), venue_name: eventVenue, address: value("event_address"), map_url: value("map_url"), rsvp_url: value("rsvp_url") }] : [];
    const additionalEvents = pipeLines("additional_events").map(([name, datetime, description, venue_name, address]) => ({ name: name || "Celebration", datetime: datetime || "", description: description || "", venue_name: venue_name || "", address: address || "" }));
    const hero = value("hero") || null;
    const backgroundMusic = value("background_music") || null;
    const captions = textLines("gallery_captions"); const altText = textLines("gallery_alts"); const videoCaptions = textLines("video_captions"); const voiceCaptions = textLines("voice_captions");
    const photos = state.media.photos || []; const videos = state.media.videos || []; const audioFiles = state.media.audios || [];
    const previousGallery = new Map((state.content.gallery || []).map((item) => [item.src, item]));
    const content = {
      ...state.content,
      occasion: chosenOccasion,
      template_id: Number(form.querySelector('[name="template_id"]:checked')?.value || 1),
      recipient_names: value("recipient_names").split(",").map((item) => item.trim()).filter(Boolean),
      sender_name: value("sender_name"), relationship: value("relationship"), title: value("title"), subtitle: value("subtitle"),
      message: value("message"), letter: value("letter"), closing_message: value("closing_message"), reveal_message: value("reveal_message"),
      age_or_milestone: value("age_or_milestone") || null, language: value("language", "en"), event_datetime: isoDate(value("event_datetime")), timezone: value("timezone", "Asia/Kolkata"),
      couple_names: value("couple_names").split(",").map((item) => item.trim()).filter(Boolean),
      events: [...primaryEvent, ...additionalEvents],
      timeline: pipeLines("timeline").map(([date, title, description]) => ({ date: date || "", title: title || "A memory", description: description || "" })),
      memory_cards: lines("memory_cards"), appreciation_cards: lines("appreciation_cards"),
      quotes: pipeLines("quotes").map(([text, author]) => ({ text: text || "", author: author || "" })),
      button_labels: { open: value("button_open") || "Open your surprise", reveal: value("button_reveal") || "Reveal the surprise", letter: value("button_letter") || "Read the letter" },
      gallery: photos.filter((path) => path !== hero).map((src, index) => ({ src, caption: captions[index] ?? previousGallery.get(src)?.caption ?? "", alt: altText[index] ?? previousGallery.get(src)?.alt ?? "A shared memory" })),
      videos: videos.map((src, index) => ({ src, caption: videoCaptions[index] || "" })),
      voice_messages: audioFiles.filter((src) => src !== backgroundMusic).map((src, index) => ({ src, caption: voiceCaptions[index] || "A voice note for you" })),
      media: { ...(state.content.media || {}), hero, background_music: backgroundMusic, social_preview: value("social_preview") || null, hero_focal_position: value("hero_focal_position", "50% 50%") },
      gif_roles: { ...(state.content.gif_roles || {}), ...(value("gif_welcome") ? { welcome: value("gif_welcome") } : {}) },
      sticker_roles: { ...(state.content.sticker_roles || {}), ...(value("sticker_closing") ? { closing: value("sticker_closing") } : {}) },
      theme: { palette: value("palette", "default"), accent_color: form.querySelector('[name="accent_custom"]')?.checked ? value("accent_color") : "", font_pairing: value("font_pairing"), appearance: value("appearance"), animation_intensity: value("animation_intensity"), decoration_density: value("decoration_density") },
      opening_interaction: value("opening_interaction"), music_enabled: checked("music_enabled"), countdown_enabled: checked("countdown_enabled"), branding_credit: checked("branding_credit"),
      sections: selectedSections.length ? selectedSections : ["hero", "gallery", "letter", "surprise", "closing"]
    };
    delete content._discovered; delete content._warnings; delete content._project_dir; delete content._project_name;
    return content;
  }

  function setValue(name, valueToSet = "") { const element = fields(name); if (element) element.value = valueToSet ?? ""; }
  function populate(content, media) {
    state.content = content; state.media = media;
    const occasion = form.querySelector(`[name="occasion"][value="${CSS.escape(content.occasion || "custom")}"]`) || form.querySelector('[name="occasion"][value="custom"]'); occasion.checked = true;
    const template = form.querySelector(`[name="template_id"][value="${content.template_id || 1}"]`); if (template) template.checked = true;
    ["sender_name","relationship","title","subtitle","message","letter","closing_message","reveal_message","age_or_milestone","language","timezone","opening_interaction"].forEach((key) => setValue(key, content[key]));
    setValue("recipient_names", (content.recipient_names || []).join(", ")); setValue("couple_names", (content.couple_names || []).join(", "));
    setValue("event_datetime", content.event_datetime ? content.event_datetime.slice(0,16) : "");
    const event = content.events?.[0] || {}; setValue("event_name", event.name); setValue("event_description", event.description); setValue("event_venue", event.venue_name); setValue("event_address", event.address); setValue("map_url", event.map_url); setValue("rsvp_url", event.rsvp_url); setValue("additional_events", (content.events || []).slice(1).map((item) => [item.name, item.datetime, item.description, item.venue_name, item.address].join(" | ")).join("\n"));
    setValue("timeline", (content.timeline || []).map((item) => [item.date, item.title, item.description].join(" | ")).join("\n")); setValue("quotes", (content.quotes || []).map((item) => typeof item === "string" ? item : [item.text, item.author].filter(Boolean).join(" | ")).join("\n"));
    setValue("memory_cards", (content.memory_cards || []).map((item) => item.text || item).join("\n")); setValue("appreciation_cards", (content.appreciation_cards || []).map((item) => item.text || item).join("\n"));
    setValue("button_open", content.button_labels?.open); setValue("button_reveal", content.button_labels?.reveal); setValue("button_letter", content.button_labels?.letter);
    setValue("hero", content.media?.hero); setValue("background_music", content.media?.background_music); setValue("social_preview", content.media?.social_preview); setValue("hero_focal_position", content.media?.hero_focal_position || "50% 50%");
    setValue("gif_welcome", content.gif_roles?.welcome); setValue("sticker_closing", content.sticker_roles?.closing);
    setValue("gallery_captions", (content.gallery || []).map((item) => item.caption || "").join("\n")); setValue("gallery_alts", (content.gallery || []).map((item) => item.alt || "").join("\n"));
    setValue("video_captions", (content.videos || []).map((item) => item.caption || "").join("\n")); setValue("voice_captions", (content.voice_messages || []).map((item) => item.caption || "").join("\n"));
    ["palette","accent_color","font_pairing","appearance","animation_intensity","decoration_density"].forEach((key) => setValue(key, content.theme?.[key]));
    { const custom = form.querySelector('[name="accent_custom"]'); if (custom) custom.checked = Boolean(content.theme?.accent_color); }
    ["music_enabled","countdown_enabled","branding_credit"].forEach((key) => { if (fields(key)) fields(key).checked = Boolean(content[key]); });
    const sectionSet = new Set(content.sections || []); document.querySelectorAll("#section-picker input").forEach((input) => { input.checked = sectionSet.has(input.value); });
    updateConditional(); renderMedia(); state.dirty = false; document.querySelector("#save-state").textContent = "Saved";
  }

  function updateConditional() { const occasion = form.querySelector('[name="occasion"]:checked')?.value; document.querySelectorAll("[data-occasion-show]").forEach((panel) => { panel.hidden = !panel.dataset.occasionShow.split(",").includes(occasion); }); }
  function navigate(index) {
    state.step = Math.max(0, Math.min(steps.length - 1, index)); steps.forEach((step, i) => { step.hidden = i !== state.step; });
    stepButtons.forEach((button, i) => { button.setAttribute("aria-current", i === state.step ? "true" : "false"); button.closest("li").classList.toggle("is-active", i === state.step); button.closest("li").classList.toggle("is-complete", i < state.step); });
    document.querySelector("#progress-bar").style.width = `${state.step / (steps.length - 1) * 100}%`; document.querySelector("#previous-step").hidden = state.step === 0; document.querySelector("#next-step").hidden = state.step >= 6;
    if (state.step === 6) generatePreview(); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function save() { document.querySelector("#save-state").textContent = "Saving…"; const payload = await api(`/api/projects/${encodeURIComponent(state.project)}/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(serialize()) }); state.content = serialize(); state.dirty = false; document.querySelector("#save-state").textContent = "Saved"; return payload; }
  async function load(project) { try { const payload = await api(`/api/projects/${encodeURIComponent(project)}`); state.project = project; populate(payload.content, payload.media); } catch (error) { showToast(error.message); } }
  async function generatePreview() { try { const validation = await save(); renderValidation(validation); const result = await api(`/api/projects/${encodeURIComponent(state.project)}/generate`, { method: "POST" }); const frame = document.querySelector("#preview-frame"); frame.src = `${result.preview_url}?t=${Date.now()}`; document.querySelector("#open-preview").href = result.preview_url; document.querySelector("#open-preview").hidden = false; return result; } catch (error) { renderValidation({ errors: [error.message], warnings: [] }); throw error; } }
  function renderValidation(result) { const target = document.querySelector("#validation-summary"); const messages = [...(result.errors || []).map((text) => `<p class="error">${escapeHtml(text)}</p>`), ...(result.warnings || []).map((text) => `<p>${escapeHtml(text)}</p>`)]; target.innerHTML = messages.join("") || "<p>Everything needed is in place.</p>"; }
  function escapeHtml(text) { const span = document.createElement("span"); span.textContent = text; return span.innerHTML; }
  function renderMedia() {
    const library = document.querySelector("#media-library"); const items = Object.entries(state.media).flatMap(([kind, paths]) => paths.map((path) => ({ kind, path })));
    if (!items.length) { library.innerHTML = '<p class="empty-state">Uploaded media will appear here.</p>'; return; }
    library.innerHTML = ""; let draggedPhoto = null; items.forEach(({ kind, path }) => { const tile = document.createElement("article"); tile.className = "media-tile"; tile.draggable = kind === "photos"; tile.dataset.path = path; const url = `/content/${encodeURIComponent(state.project)}/${path.split("/").map(encodeURIComponent).join("/")}`; const preview = kind === "videos" ? `<video src="${url}" muted></video>` : kind === "audios" ? `<audio src="${url}" controls></audio>` : `<img src="${url}" alt="">`; tile.innerHTML = `<b>${kind}</b>${preview}<span title="${escapeHtml(path)}">${escapeHtml(path)}</span>`; tile.addEventListener("dblclick", () => { if (kind === "photos") setValue("hero", path); if (kind === "audios") setValue("background_music", path); showToast(`${kind === "photos" ? "Hero image" : "Background music"} selected`); }); if (kind === "photos") { tile.addEventListener("dragstart", () => { draggedPhoto = path; }); tile.addEventListener("dragover", (event) => event.preventDefault()); tile.addEventListener("drop", (event) => { event.preventDefault(); if (!draggedPhoto || draggedPhoto === path) return; const ordered = [...state.media.photos]; const from = ordered.indexOf(draggedPhoto); const to = ordered.indexOf(path); ordered.splice(from, 1); ordered.splice(to, 0, draggedPhoto); state.media.photos = ordered; state.dirty = true; renderMedia(); showToast("Photo order updated"); }); } library.append(tile); });
  }

  form.addEventListener("input", () => { state.dirty = true; document.querySelector("#save-state").textContent = "Unsaved"; updateConditional(); });
  stepButtons.forEach((button) => button.addEventListener("click", () => navigate(Number(button.dataset.stepTarget))));
  document.querySelector("#next-step").addEventListener("click", () => { if (state.step === 2 && !value("title") && !value("message")) { showToast("Add a title or message before continuing."); return; } navigate(state.step + 1); });
  document.querySelector("#previous-step").addEventListener("click", () => navigate(state.step - 1));
  document.querySelector("#save-project").addEventListener("click", () => save().then(() => showToast("Project saved")).catch((error) => showToast(error.message)));
  projectSelect.addEventListener("change", () => load(projectSelect.value));
  document.querySelector("#new-project").addEventListener("click", async () => { const name = prompt("Project folder name (letters, numbers, hyphens, or underscores):"); if (!name) return; if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name)) { showToast("That project name is not valid."); return; } const starter = { occasion: "custom", template_id: 12, recipient_names: [], title: "A little surprise for you", subtitle: "", message: "", language: "en", timezone: "Asia/Kolkata", media: { hero: null, background_music: null, social_preview: null, hero_focal_position: "50% 50%" }, gallery: [], videos: [], voice_messages: [], gif_roles: {}, sticker_roles: {}, theme: { palette: "default", accent_color: "#5b4ce3", font_pairing: "expressive", appearance: "auto", animation_intensity: "subtle", decoration_density: "medium" }, sections: ["hero", "gallery", "letter", "surprise", "closing"], music_enabled: true, countdown_enabled: false, branding_credit: false }; try { await api(`/api/projects/${encodeURIComponent(name)}/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(starter) }); if (![...projectSelect.options].some((option) => option.value === name)) projectSelect.add(new Option(name, name, true, true)); else projectSelect.value = name; await load(name); showToast("New project created"); } catch (error) { showToast(error.message); } });
  document.querySelectorAll(".drop-zone").forEach((zone) => { const input = zone.querySelector("input"); const upload = async (files) => { if (!files.length) return; const body = new FormData(); [...files].forEach((file) => body.append("files", file)); zone.classList.add("is-dragging"); try { const result = await api(`/api/projects/${encodeURIComponent(state.project)}/upload/${zone.dataset.uploadKind}`, { method: "POST", body }); if (result.rejected.length) showToast(`Skipped: ${result.rejected.join(", ")}`); const loaded = await api(`/api/projects/${encodeURIComponent(state.project)}`); state.media = loaded.media; renderMedia(); showToast(`${result.saved.length} file${result.saved.length === 1 ? "" : "s"} added`); } catch (error) { showToast(error.message); } finally { zone.classList.remove("is-dragging"); input.value = ""; } }; input.addEventListener("change", () => upload(input.files)); zone.addEventListener("dragover", (event) => { event.preventDefault(); zone.classList.add("is-dragging"); }); zone.addEventListener("dragleave", () => zone.classList.remove("is-dragging")); zone.addEventListener("drop", (event) => { event.preventDefault(); upload(event.dataTransfer.files); }); });
  document.querySelector("#refresh-preview").addEventListener("click", () => generatePreview().catch(() => {}));
  document.querySelector("#generate-final").addEventListener("click", async () => { const button = document.querySelector("#generate-final"); button.disabled = true; button.textContent = "Generating…"; try { const result = await generatePreview(); document.querySelector("#export-title").textContent = "Your website is ready"; document.querySelector("#export-path").textContent = `Generated from project “${state.project}”.`; document.querySelector("#open-preview").href = result.preview_url; document.querySelector("#open-preview").hidden = false; showToast("Website generated"); } catch (error) { showToast(error.message); } finally { button.disabled = false; button.textContent = "Generate website"; } });
  let draggedSection = null; document.querySelectorAll("#section-picker label").forEach((label) => { label.addEventListener("dragstart", () => { draggedSection = label; }); label.addEventListener("dragover", (event) => event.preventDefault()); label.addEventListener("drop", (event) => { event.preventDefault(); if (draggedSection && draggedSection !== label) label.before(draggedSection); }); });
  window.addEventListener("beforeunload", (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ""; } });
  window.WishCraftStudio = { state, save, load, showToast };
  navigate(0); load(state.project);
})();

