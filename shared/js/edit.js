(() => {
  "use strict";
  const button = document.querySelector("[data-edit-toggle]");
  const grids = [...document.querySelectorAll("[data-collage]")];
  if (!button || !grids.some((g) => g.querySelector(".tile"))) return;
  button.hidden = false;

  const data = (() => { try { return JSON.parse(document.getElementById("wishcraft-data").textContent); } catch { return {}; } })();
  const storeKey = `wishcraft-layout:${data.slug || "site"}`;
  const MAX_ROWS = 8;
  let layout = { ...(data.collage_layout || {}) };
  try { const local = JSON.parse(localStorage.getItem(storeKey) || "null"); if (local && typeof local === "object") layout = { ...layout, ...local }; } catch { /* storage unavailable */ }

  const tilesOf = () => grids.flatMap((g) => [...g.querySelectorAll(".tile")]);
  const keyOf = (tile) => tile.dataset.key || tile.querySelector("img,video")?.getAttribute("src") || "";
  const colsOf = (grid) => parseInt(getComputedStyle(grid).getPropertyValue("--cols"), 10) || 4;
  /* Size in grid cells, measured from the rendered box (computed spans read back as "auto"). */
  const current = (tile) => {
    const grid = tile.parentElement; const cs = getComputedStyle(grid); const cols = colsOf(grid);
    const gap = parseFloat(cs.columnGap) || 0; const rowGap = parseFloat(cs.rowGap) || gap;
    const pitchX = (grid.getBoundingClientRect().width + gap) / cols; const pitchY = (parseFloat(cs.gridAutoRows) || 160) + rowGap;
    const box = tile.getBoundingClientRect();
    return { c: Math.max(1, Math.min(cols, Math.round((box.width + gap) / pitchX))), r: Math.max(1, Math.min(MAX_ROWS, Math.round((box.height + rowGap) / pitchY))) };
  };
  const paint = (tile, size) => { tile.style.setProperty("--c", size.c); tile.style.setProperty("--r", size.r); };
  const persist = () => { try { localStorage.setItem(storeKey, JSON.stringify(layout)); } catch { /* ignore */ } };
  const toast = (msg) => { const t = document.querySelector(".nav-toast"); if (!t) return; t.textContent = msg; t.classList.add("is-on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("is-on"), 3200); };

  tilesOf().forEach((tile) => { const saved = layout[keyOf(tile)]; if (saved) paint(tile, saved); });

  /* ----- toolbar ----- */
  const bar = document.createElement("div");
  bar.className = "edit-bar"; bar.hidden = true; bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Layout editor");
  bar.innerHTML = '<p><strong>Edit mode.</strong> Drag a picture’s right edge, bottom edge or corner. Or select it and press <kbd>Shift</kbd>+<kbd>Arrows</kbd>.</p>' +
    '<button type="button" class="button button--quiet" data-edit-reset-one>Reset picture</button>' +
    '<button type="button" class="button button--quiet" data-edit-reset-all>Reset all</button>' +
    '<button type="button" class="button button--quiet" data-edit-copy>Copy JSON</button>' +
    '<button type="button" class="button" data-edit-save>Save</button>' +
    '<button type="button" class="button" data-edit-done>Done</button>';
  document.body.append(bar);

  let selected = null;
  const select = (tile) => { selected?.classList.remove("is-selected"); selected = tile; tile?.classList.add("is-selected"); };

  /* ----- handles ----- */
  const addHandles = (tile) => {
    ["e", "s", "se"].forEach((edge) => {
      const h = document.createElement("i"); h.className = `rz rz--${edge}`; h.dataset.edge = edge; h.setAttribute("aria-hidden", "true"); tile.append(h);
      h.addEventListener("pointerdown", (event) => start(event, tile, h, edge));
    });
    const badge = document.createElement("span"); badge.className = "rz-badge"; badge.setAttribute("aria-hidden", "true"); tile.append(badge);
  };
  const removeHandles = () => document.querySelectorAll(".rz, .rz-badge").forEach((n) => n.remove());

  const start = (event, tile, handle, edge) => {
    event.preventDefault(); event.stopPropagation();
    const grid = tile.parentElement; const cs = getComputedStyle(grid);
    const gap = parseFloat(cs.columnGap) || 0; const cols = colsOf(grid);
    const pitchX = (grid.getBoundingClientRect().width + gap) / cols;
    const pitchY = (parseFloat(cs.gridAutoRows) || 160) + (parseFloat(cs.rowGap) || gap);
    const from = current(tile); const x0 = event.clientX, y0 = event.clientY;
    const badge = tile.querySelector(".rz-badge");
    select(tile); tile.classList.add("is-resizing"); handle.classList.add("is-dragging"); handle.setPointerCapture(event.pointerId);
    const move = (e) => {
      const next = { c: from.c, r: from.r };
      if (edge.includes("e")) next.c = Math.max(1, Math.min(cols, from.c + Math.round((e.clientX - x0) / pitchX)));
      if (edge.includes("s")) next.r = Math.max(1, Math.min(MAX_ROWS, from.r + Math.round((e.clientY - y0) / pitchY)));
      paint(tile, next); badge.textContent = `${next.c} × ${next.r}`; tile._size = next;
    };
    const end = () => {
      handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", end); handle.removeEventListener("pointercancel", end);
      tile.classList.remove("is-resizing"); handle.classList.remove("is-dragging");
      if (tile._size) { layout[keyOf(tile)] = tile._size; persist(); }
    };
    handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", end); handle.addEventListener("pointercancel", end);
  };

  /* ----- selecting + keyboard ----- */
  const guardClick = (event) => {
    const tile = event.target.closest(".tile");
    if (!tile) return;
    event.stopPropagation(); event.preventDefault(); select(tile); tile.focus?.({ preventScroll: true });
  };
  const keys = (event) => {
    if (!selected || !event.shiftKey || !event.key.startsWith("Arrow")) return;
    event.preventDefault();
    const size = layout[keyOf(selected)] || current(selected); const cols = colsOf(selected.parentElement);
    const next = { ...size };
    if (event.key === "ArrowRight") next.c = Math.min(cols, size.c + 1);
    if (event.key === "ArrowLeft") next.c = Math.max(1, size.c - 1);
    if (event.key === "ArrowDown") next.r = Math.min(MAX_ROWS, size.r + 1);
    if (event.key === "ArrowUp") next.r = Math.max(1, size.r - 1);
    layout[keyOf(selected)] = next; paint(selected, next); persist();
  };

  /* ----- save / export ----- */
  const payload = () => JSON.stringify(layout, null, 2);
  const save = async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(data.project || "default")}/layout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layout }) });
      if (!res.ok) throw new Error(String(res.status));
      toast("Layout saved to your project ✓ Regenerate to bake it in.");
    } catch {
      try { await navigator.clipboard.writeText(payload()); } catch { /* ignore */ }
      const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([payload()], { type: "application/json" })); link.download = "collage_layout.json"; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      toast("Saved in this browser. JSON copied: paste it into content.json as “collage_layout”.");
    }
  };

  const resetOne = () => { if (!selected) { toast("Select a picture first."); return; } delete layout[keyOf(selected)]; selected.style.removeProperty("--c"); selected.style.removeProperty("--r"); persist(); };
  const resetAll = () => { layout = {}; tilesOf().forEach((t) => { t.style.removeProperty("--c"); t.style.removeProperty("--r"); }); persist(); toast("All pictures back to the original layout."); };

  /* ----- toggle ----- */
  const setMode = (on) => {
    document.body.classList.toggle("edit-mode", on); button.setAttribute("aria-pressed", String(on)); bar.hidden = !on;
    if (on) { tilesOf().forEach(addHandles); document.addEventListener("click", guardClick, true); document.addEventListener("keydown", keys); toast("Edit mode on. Drag the edges of any picture."); }
    else { removeHandles(); select(null); document.removeEventListener("click", guardClick, true); document.removeEventListener("keydown", keys); }
  };
  button.addEventListener("click", () => setMode(!document.body.classList.contains("edit-mode")));
  bar.querySelector("[data-edit-done]").addEventListener("click", () => setMode(false));
  bar.querySelector("[data-edit-save]").addEventListener("click", save);
  bar.querySelector("[data-edit-reset-one]").addEventListener("click", resetOne);
  bar.querySelector("[data-edit-reset-all]").addEventListener("click", resetAll);
  bar.querySelector("[data-edit-copy]").addEventListener("click", async () => { try { await navigator.clipboard.writeText(payload()); toast("Layout JSON copied."); } catch { toast("Could not copy. Use Save instead."); } });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("edit-mode") && !document.querySelector("dialog[open]")) setMode(false); });
})();
