/* wasisteinmensch – app.js
   ARBEITSMODUS: vollständige Datei, keine externen Frameworks
*/

(function () {
  "use strict";

  // ==========
  // 1) Konfiguration (keine Platzhalter)
  // ==========
  const REPO_NAME = "wasisteinmensch";
  const STORAGE_KEY = `${REPO_NAME}::state::v1`;
  const DROPBOX_VIDEO_URL = "https://www.dropbox.com/scl/fi/d3dlrwqcqilxfh2rp5kva/Uncanny-Valley-Verst-rende-hnlichkeit-Kultur-erkl-rt-Flick-Flack-ARTE.mp4?rlkey=tt803xeh6vsg5s9sguc2sw1se&st=zkiy7due&dl=0";

  const MODULES = [
    { id: "m1", title: "Uncanny Valley" },
    { id: "m2", title: "Akzeptanzlücke" },
    { id: "m3", title: "Video ARTE (Dropbox)" },
    { id: "m4", title: "Essay: KI als Spiegel (Wampfler)" },
    { id: "m5", title: "Synthese: Was ist ein Mensch?" },
  ];

  // ==========
  // 2) State – LocalStorage
  // ==========
  function nowISO() {
    return new Date().toISOString();
  }

  function defaultState() {
    const done = {};
    MODULES.forEach(m => done[m.id] = false);

    return {
      version: 1,
      repo: REPO_NAME,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      done,
      notes: {},
      answers: {},
      ui: {
        lastNav: "dashboard"
      }
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      // defensive merge
      const def = defaultState();
      const merged = {
        ...def,
        ...parsed,
        done: { ...def.done, ...(parsed.done || {}) },
        notes: { ...(parsed.notes || {}) },
        answers: { ...(parsed.answers || {}) },
        ui: { ...def.ui, ...(parsed.ui || {}) },
      };
      return merged;
    } catch (e) {
      console.warn("State konnte nicht geladen werden – starte neu.", e);
      return defaultState();
    }
  }

  function saveState() {
    state.updatedAt = nowISO();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateTopbarMeta();
    updateProgressUI();
    updateDashboard();
  }

  // debounce to reduce writes
  function debounce(fn, ms) {
    let t = null;
    return function (...args) {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }
  const saveStateDebounced = debounce(saveState, 200);

  let state = loadState();

  // ==========
  // 3) Helpers – Dropbox Direktlink
  // ==========
  function dropboxToDirect(url) {
    // Dropbox kann mit dl=1 oder raw=1 direkt streamen.
    // Wir erzwingen dl=1, behalten restliche params.
    try {
      const u = new URL(url);
      u.searchParams.set("dl", "1");
      return u.toString();
    } catch {
      // Fallback: wenn URL parsing scheitert, minimal ersetzen.
      return String(url).replace("dl=0", "dl=1");
    }
  }

  // ==========
  // 4) DOM Wiring
  // ==========
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const progressLabel = $("#progressLabel");
  const progressFill = $("#progressFill");
  const progressBar = document.querySelector(".progress__bar");
  const lastSaved = $("#lastSaved");
  const overallPill = $("#overallPill");
  const statusList = $("#statusList");

  const btnDashboard = $("#btnDashboard");
  const btnExportTxt = $("#btnExportTxt");
  const btnExportJson = $("#btnExportJson");
  const btnImportJson = $("#btnImportJson");
  const importFile = $("#importFile");
  const btnResetAll = $("#btnResetAll");
  const btnScrollTop = $("#btnScrollTop");

  const arteVideo = $("#arteVideo");
  const arteVideoSrc = $("#arteVideoSrc");
  const btnCopyDirect = $("#btnCopyDirect");

  // ==========
  // 5) Navigation
  // ==========
  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    state.ui.lastNav = id;
    saveStateDebounced();
  }

  $$(".navbtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-go");
      if (id) scrollToSection(id);
    });
  });

  $$("[data-go]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-go");
      if (id) scrollToSection(id);
    });
  });

  // Dashboard toggle (nur für aria-expanded – section ist sowieso sichtbar in Main)
  btnDashboard.addEventListener("click", () => {
    const expanded = btnDashboard.getAttribute("aria-expanded") === "true";
    btnDashboard.setAttribute("aria-expanded", String(!expanded));
    scrollToSection("dashboard");
  });

  btnScrollTop?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ==========
  // 6) Bind: Done-Checkboxes
  // ==========
  $$("[data-done]").forEach(cb => {
    const mid = cb.getAttribute("data-done");
    cb.checked = Boolean(state.done[mid]);

    cb.addEventListener("change", () => {
      state.done[mid] = cb.checked;
      saveState();
    });
  });

  // ==========
  // 7) Bind: Notes
  // ==========
  $$("textarea[data-notes]").forEach(ta => {
    const key = ta.getAttribute("data-notes");
    ta.value = state.notes[key] ?? "";

    ta.addEventListener("input", () => {
      state.notes[key] = ta.value;
      saveStateDebounced();
    });
  });

  // ==========
  // 8) Bind: Answers (inputs)
  // ==========
  $$("input[data-answer]").forEach(inp => {
    const key = inp.getAttribute("data-answer");
    inp.value = state.answers[key] ?? "";

    inp.addEventListener("input", () => {
      state.answers[key] = inp.value;
      saveStateDebounced();
    });
  });

  // ==========
  // 9) Progress UI + Pills
  // ==========
  function computeProgress() {
    const total = MODULES.length;
    const doneCount = MODULES.filter(m => state.done[m.id]).length;
    const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
    return { total, doneCount, pct };
  }

  function updateProgressUI() {
    const { pct } = computeProgress();
    progressLabel.textContent = `Fortschritt: ${pct}%`;
    progressFill.style.width = `${pct}%`;
    if (progressBar) progressBar.setAttribute("aria-valuenow", String(pct));

    // Module pills
    MODULES.forEach(m => {
      const pill = document.querySelector(`[data-pill-for="${m.id}"]`);
      if (!pill) return;
      const isDone = Boolean(state.done[m.id]);
      pill.textContent = isDone ? "abgeschlossen" : "offen";
      pill.style.borderColor = isDone ? "rgba(157,242,210,.45)" : "rgba(255,255,255,.16)";
      pill.style.background = isDone ? "rgba(157,242,210,.10)" : "rgba(255,255,255,.05)";
    });
  }

  function updateTopbarMeta() {
    const d = new Date(state.updatedAt);
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    lastSaved.textContent = `Letztes Speichern: ${stamp}`;
  }

  function updateDashboard() {
    const { doneCount, total, pct } = computeProgress();
    overallPill.textContent = `${pct}% abgeschlossen`;

    // list
    statusList.innerHTML = "";
    MODULES.forEach((m, idx) => {
      const li = document.createElement("li");
      const mark = state.done[m.id] ? "✅" : "⬜";
      li.textContent = `${mark} ${idx+1}) ${m.title}`;
      statusList.appendChild(li);
    });

    // update also title button label quickly
    btnDashboard.textContent = doneCount === total ? "Dashboard ✓" : "Dashboard";
  }

  // ==========
  // 10) Export / Import
  // ==========
  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  function exportTXT() {
    const lines = [];
    lines.push("WAS IST EIN MENSCH? – EXPORT (TXT)");
    lines.push(`Repo: ${REPO_NAME}`);
    lines.push(`Erstellt: ${state.createdAt}`);
    lines.push(`Aktualisiert: ${state.updatedAt}`);
    const { pct } = computeProgress();
    lines.push(`Fortschritt: ${pct}%`);
    lines.push("");
    lines.push("=== MODULE-STATUS ===");
    MODULES.forEach((m, i) => {
      lines.push(`${i+1}) ${m.title} :: ${state.done[m.id] ? "ABGESCHLOSSEN" : "OFFEN"}`);
    });
    lines.push("");
    lines.push("=== NOTIZEN ===");
    Object.keys(state.notes).sort().forEach(k => {
      lines.push(`-- ${k} --`);
      lines.push(state.notes[k] || "");
      lines.push("");
    });
    lines.push("=== ANTWORTEN (Mini-Check) ===");
    Object.keys(state.answers).sort().forEach(k => {
      lines.push(`${k}: ${state.answers[k] || ""}`);
    });
    lines.push("");
    lines.push("=== LINKS ===");
    lines.push("PDF Uncanny Valley: assets/docs/uncanny_valley.pdf");
    lines.push("PDF KI als Spiegel (Wampfler): assets/docs/wampfler_ki_als_spiegel.pdf");
    lines.push(`ARTE/Dropbox: ${DROPBOX_VIDEO_URL}`);
    lines.push(`Direktlink (dl=1): ${dropboxToDirect(DROPBOX_VIDEO_URL)}`);

    const filename = `${REPO_NAME}_export_${new Date().toISOString().slice(0,10)}.txt`;
    downloadText(filename, lines.join("\n"));
  }

  function exportJSON() {
    const filename = `${REPO_NAME}_export_${new Date().toISOString().slice(0,10)}.json`;
    downloadText(filename, JSON.stringify(state, null, 2));
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        // minimal validation
        if (!parsed || typeof parsed !== "object") throw new Error("Ungültiges JSON");
        if (!parsed.repo) parsed.repo = REPO_NAME;

        // merge with default to keep new fields
        const def = defaultState();
        state = {
          ...def,
          ...parsed,
          done: { ...def.done, ...(parsed.done || {}) },
          notes: { ...(parsed.notes || {}) },
          answers: { ...(parsed.answers || {}) },
          ui: { ...def.ui, ...(parsed.ui || {}) },
        };
        saveState();

        // rehydrate UI fields
        rehydrateInputs();
        alert("Import erfolgreich. Der Stand wurde übernommen.");
      } catch (e) {
        alert("Import fehlgeschlagen: " + (e && e.message ? e.message : String(e)));
      }
    };
    reader.readAsText(file);
  }

  function rehydrateInputs() {
    $$("[data-done]").forEach(cb => {
      const mid = cb.getAttribute("data-done");
      cb.checked = Boolean(state.done[mid]);
    });
    $$("textarea[data-notes]").forEach(ta => {
      const key = ta.getAttribute("data-notes");
      ta.value = state.notes[key] ?? "";
    });
    $$("input[data-answer]").forEach(inp => {
      const key = inp.getAttribute("data-answer");
      inp.value = state.answers[key] ?? "";
    });
    updateTopbarMeta();
    updateProgressUI();
    updateDashboard();
  }

  btnExportTxt.addEventListener("click", exportTXT);
  btnExportJson.addEventListener("click", exportJSON);

  btnImportJson.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", () => {
    const f = importFile.files && importFile.files[0];
    if (f) importJSON(f);
    importFile.value = "";
  });

  // ==========
  // 11) Reset
  // ==========
  btnResetAll.addEventListener("click", () => {
    const ok = confirm("Wirklich alles löschen? (LocalStorage für diese Lernlandschaft wird entfernt)");
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    rehydrateInputs();
    scrollToSection("dashboard");
  });

  // ==========
  // 12) Video wiring
  // ==========
  function initVideo() {
    const direct = dropboxToDirect(DROPBOX_VIDEO_URL);
    if (arteVideoSrc) arteVideoSrc.src = direct;
    if (arteVideo) arteVideo.load();
  }

  btnCopyDirect.addEventListener("click", async () => {
    const direct = dropboxToDirect(DROPBOX_VIDEO_URL);
    try {
      await navigator.clipboard.writeText(direct);
      alert("Direktlink kopiert (dl=1).");
    } catch {
      // fallback
      prompt("Kopiere den Direktlink:", direct);
    }
  });

  // ==========
  // 13) Boot
  // ==========
  updateTopbarMeta();
  updateProgressUI();
  updateDashboard();
  initVideo();

  // restore last navigation target (optional)
  if (state.ui && state.ui.lastNav) {
    // do not jump on very first load; only if user already has progress/notes
    const hasAnyData = Object.values(state.done).some(Boolean) ||
      Object.keys(state.notes).length > 0 ||
      Object.keys(state.answers).length > 0;
    if (hasAnyData && document.getElementById(state.ui.lastNav)) {
      setTimeout(() => scrollToSection(state.ui.lastNav), 150);
    }
  }

})();
