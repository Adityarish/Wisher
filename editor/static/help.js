(() => {
  "use strict";
  const dialog = document.querySelector("#help-dialog");
  if (!dialog) return;
  const studio = () => window.WishCraftStudio;
  const drop = dialog.querySelector("#smart-drop");
  const preview = dialog.querySelector("#smart-preview");
  const list = dialog.querySelector("#smart-list");
  const inputs = [dialog.querySelector("#smart-files"), dialog.querySelector("#smart-folder")];
  let pending = [];

  const project = () => studio()?.state.project || "default";
  const post = async (files, dryRun) => {
    const body = new FormData();
    files.forEach((file) => body.append("files", file, file.name));
    if (dryRun) body.append("dry_run", "1");
    const response = await fetch(`/api/projects/${encodeURIComponent(project())}/smart-upload`, { method: "POST", body });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Upload failed (${response.status})`);
    return payload;
  };
  const text = (value) => { const span = document.createElement("span"); span.textContent = value; return span; };

  const render = (payload) => {
    list.textContent = "";
    payload.results.forEach((item) => {
      const row = document.createElement("li");
      row.classList.toggle("is-skipped", item.status !== "added");
      row.append(text(item.source));
      const arrow = text(item.status === "added" ? "→" : "✕"); arrow.className = "arrow"; row.append(arrow);
      row.append(text(item.status === "added" ? item.target : "skipped"));
      if (item.note) { const note = document.createElement("small"); note.textContent = item.note; row.append(note); }
      list.append(row);
    });
    preview.hidden = false; preview.scrollIntoView({ behavior: "smooth", block: "nearest" });
    dialog.querySelector("#smart-confirm").disabled = payload.added === 0;
    dialog.querySelector("#smart-confirm").textContent = payload.added ? `Add ${payload.added} file${payload.added === 1 ? "" : "s"} to my website` : "Nothing to add";
  };

  const stage = async (files) => {
    files = [...files].filter((file) => file.name && !file.name.startsWith("."));
    if (!files.length) return;
    pending = files;
    try { render(await post(files, true)); } catch (error) { studio()?.showToast(error.message); }
  };

  const walk = async (entry) => {            // drag-and-drop of folders
    if (entry.isFile) return [await new Promise((resolve) => entry.file(resolve))];
    const reader = entry.createReader(); const all = [];
    for (;;) { const batch = await new Promise((resolve) => reader.readEntries(resolve)); if (!batch.length) break; all.push(...batch); }
    return (await Promise.all(all.map(walk))).flat();
  };

  drop.addEventListener("dragover", (event) => { event.preventDefault(); drop.classList.add("is-over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
  drop.addEventListener("drop", async (event) => {
    event.preventDefault(); drop.classList.remove("is-over");
    const entries = [...(event.dataTransfer.items || [])].map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
    stage(entries.length ? (await Promise.all(entries.map(walk))).flat() : event.dataTransfer.files);
  });
  inputs.forEach((input) => input.addEventListener("change", () => { stage(input.files); input.value = ""; }));

  dialog.querySelector("#smart-cancel").addEventListener("click", () => { pending = []; preview.hidden = true; });
  dialog.querySelector("#smart-confirm").addEventListener("click", async (event) => {
    const button = event.currentTarget; button.disabled = true; button.textContent = "Adding…";
    try {
      await studio().save().catch(() => {});             // keep unsaved text edits
      const payload = await post(pending, false);
      pending = []; preview.hidden = true; dialog.close();
      await studio().load(project());                     // reloads media + auto captions/hero
      studio().showToast(`Added ${payload.added} file${payload.added === 1 ? "" : "s"}${payload.skipped ? `, skipped ${payload.skipped}` : ""}`);
    } catch (error) { studio()?.showToast(error.message); }
    button.disabled = false;
  });

  const open = () => {
    dialog.querySelectorAll("#help-project, [data-help-project]").forEach((node) => { node.textContent = project(); });
    if (!dialog.open) dialog.showModal();
  };
  document.querySelector("#open-help").addEventListener("click", open);
  document.querySelectorAll("[data-open-help]").forEach((button) => button.addEventListener("click", open));
  dialog.querySelector("#help-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  addEventListener("keydown", (event) => { if (event.key === "?" && !/input|textarea|select/i.test(event.target.tagName) && !dialog.open) { event.preventDefault(); open(); } });
})();
