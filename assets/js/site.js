/* ==========================================================================
   site.js — chrome (nav, menu, footer) and the page renderers.
   Every page reads content/plan.md and content/weeks/*.md, so nothing is
   typed into the HTML twice.
   ========================================================================== */

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = VLD.esc;
  const refresh = (root) => window.VLDMotion && window.VLDMotion.refresh(root);
  const roomUrl = (n) => `week.html?w=${VLD.pad(n)}`;
  const author = () => (window.VLDAuthor && VLDAuthor.connected() ? VLDAuthor : null);

  const STATUS = { written: "Written", open: "Not yet written", upcoming: "Upcoming" };

  const svg = (d, cls = "") =>
    `<svg${cls ? ` class="${cls}"` : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const ARROW_R = "M5 12h14m-6-6 6 6-6 6";
  const ARROW_L = "M19 12H5m6-6-6 6 6 6";
  const CAMERA =
    "M3 9a2 2 0 0 1 2-2h1.5l1.2-1.8a1 1 0 0 1 .8-.5h7a1 1 0 0 1 .8.5L17.5 7H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM15.2 13a3.2 3.2 0 1 1-6.4 0 3.2 3.2 0 0 1 6.4 0Z";

  /* ======================================================================
     Chrome
     ====================================================================== */

  function initNav() {
    const page = document.body.dataset.page;
    const here = page === "week" ? "journal.html" : location.pathname.split("/").pop() || "index.html";
    $$("[data-nav]").forEach((link) => {
      if (link.getAttribute("href") === here) link.setAttribute("aria-current", "page");
    });

    const toggle = $(".nav-toggle");
    const sheet = $(".nav-sheet");
    if (!toggle || !sheet) return;

    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      sheet.classList.toggle("is-open", open);
      sheet.setAttribute("aria-hidden", String(!open));
      document.body.classList.toggle("is-locked", open);
      if (open) {
        const first = $(".nav-sheet__link", sheet);
        if (first) window.setTimeout(() => first.focus(), 420);
      }
    };

    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    sheet.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sheet.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  function initFooter() {
    $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  }

  /* ======================================================================
     Shared pieces
     ====================================================================== */

  const titleText = (w) => (w.isPlanning ? "Week 1" : `Week ${w.week} — ${w.concept}`);

  function frame(w, opts = {}) {
    const cls = opts.class || "";
    if (!w.hasImage) {
      return `<div class="frame frame--empty ${cls}"><div class="frame__placeholder">${svg(CAMERA)}<span class="label">${
        w.status === "upcoming" ? "Upcoming" : "No photo yet"
      }</span></div></div>`;
    }
    return `<div class="frame ${cls}" data-cursor="${esc(opts.cursor || "View")}"><img src="${esc(w.image)}" alt="${esc(
      `Week ${w.week} — ${w.concept}`
    )}" loading="${opts.eager ? "eager" : "lazy"}" decoding="async"></div>`;
  }

  function statusTag(w) {
    if (w.isPlanning) return `<span class="tag tag--planning">Planning · ungraded</span>`;
    return `<span class="tag${w.status === "written" ? " tag--accent" : ""}">${STATUS[w.status]}</span>`;
  }

  /* ======================================================================
     Home
     ====================================================================== */

  async function renderHome() {
    const weeks = await VLD.load();
    const s = VLD.stats(weeks);
    const pct = Math.round((s.written / s.graded) * 100);

    const focus = $("#focus-card");
    if (focus) {
      const w = s.current;
      focus.innerHTML = `
        <span class="label label--accent">This week</span>
        <span class="focus-card__week">Week ${w.num}</span>
        <p class="lead" style="font-size:var(--t-body)">${esc(w.isPlanning ? "Planning week" : w.concept)}</p>
        <span class="label">${esc(w.dateLabel)}</span>
        <div class="meter">
          <div class="meter__row">
            <span class="label">${s.written} / ${s.graded} reflections</span>
            <span class="label">${s.photos} / ${s.graded} photos</span>
          </div>
          <div class="meter__track"><i class="meter__fill" style="width:${pct}%"></i></div>
        </div>
        <a class="btn" href="${roomUrl(w.week)}">Open week ${w.num} ${svg(ARROW_R, "btn__arrow")}</a>`;
    }

    const stats = $("#home-stats");
    if (stats) {
      stats.innerHTML = [
        [s.sessionsSoFar, s.total, "Tuesday sessions so far"],
        [s.written, s.graded, "Reflections written"],
        [s.photos, s.graded, "Weekly photos"],
      ]
        .map(
          ([value, total, label]) => `
        <div class="stat" data-reveal>
          <span class="stat__num"><span data-count="${value}" data-pad="2">00</span><small> / ${total}</small></span>
          <span class="stat__label">${label}</span>
        </div>`
        )
        .join("");
      refresh(stats);
    }

    const latest = $("#latest-entry");
    if (latest) {
      const w = s.latest || s.current;
      const text = w.isPlanning ? w.note : w.reflection;
      const plain = text.replace(/[*_>#[\]()]/g, "");
      const excerpt = text
        ? `${esc(plain.slice(0, 200))}${plain.length > 200 ? "…" : ""}`
        : w.status === "upcoming"
        ? "Upcoming session."
        : "Reflection not yet written.";
      latest.innerHTML = `
        ${w.isPlanning ? "" : frame(w, { class: "latest__frame", cursor: "Read" })}
        <div class="latest__body">
          <span class="label label--accent">${s.latest ? "Latest entry" : "This week"} · ${esc(w.dateLabel)}</span>
          <h3 class="latest__title">${esc(titleText(w))}</h3>
          <p class="lead">${excerpt}</p>
          <div><a class="btn" href="${roomUrl(w.week)}" data-magnetic>Open week ${w.num} ${svg(ARROW_R, "btn__arrow")}</a></div>
        </div>`;
      refresh(latest);
    }
  }

  /* ======================================================================
     Journal — the lobby: one door per week
     ====================================================================== */

  async function renderJournal() {
    const list = $("#lobby");
    if (!list) return;

    const weeks = await VLD.load();
    const s = VLD.stats(weeks);

    list.innerHTML = weeks
      .map((w, i) => {
        const here = s.current.week === w.week;
        const thumb = w.hasImage ? `<img src="${esc(w.image)}" alt="" loading="lazy" decoding="async">` : "";
        return `<li>
          <a class="door is-${w.status}${here ? " is-current" : ""}" href="${roomUrl(w.week)}" data-reveal style="--reveal-delay:${(i * 0.035).toFixed(3)}s">
            <span class="door__num">${w.num}</span>
            <span class="door__main">
              <span class="door__title">${esc(w.isPlanning ? "Planning week" : w.concept)}</span>
              ${w.description ? `<span class="door__desc">${esc(w.description)}</span>` : ""}
              <span class="door__date">${esc(w.dateLabel)}</span>
            </span>
            <span class="door__thumb">${thumb}</span>
            <span class="door__status">${here && !w.written ? "This week" : STATUS[w.status]}</span>
            ${svg(ARROW_R, "door__arrow")}
          </a>
        </li>`;
      })
      .join("");
    refresh(list);

    const progress = $("#journal-progress");
    if (progress) {
      const pct = Math.round((s.written / s.graded) * 100);
      progress.innerHTML = `
        <div class="meter">
          <div class="meter__row">
            <span class="label">${s.written} of ${s.graded} reflections written</span>
            <span class="label label--accent">${pct}%</span>
          </div>
          <div class="meter__track"><i class="meter__fill" style="width:${pct}%"></i></div>
        </div>`;
    }
  }

  /* ======================================================================
     Week — a room of its own
     ====================================================================== */

  function roomEntryHTML(w) {
    const head = `
      <header class="entry__head">
        <div class="entry__meta">
          <time class="entry__date" datetime="${esc(w.dateISO)}">${esc(w.dateLabel)}</time>
          ${statusTag(w)}
        </div>
        <h1 class="entry__title" id="room-title">${esc(titleText(w))}</h1>
        ${w.description ? `<p class="entry__desc">${esc(w.description)}</p>` : ""}
      </header>`;

    if (w.isPlanning) {
      const empty = w.status === "upcoming" ? "Upcoming session." : "Not yet written.";
      return `<article class="entry entry--room entry--planning">${head}
        <p class="entry__line${w.note ? "" : " is-empty"}" id="room-note">${esc(w.note || empty)}</p>
      </article>`;
    }

    const reflection = w.hasReflection
      ? w.html
      : `<p class="entry__empty">${
          w.status === "upcoming" ? `This session is on ${esc(w.dateLabel)}.` : "Reflection not yet written."
        }</p>`;

    return `<article class="entry entry--room">${head}
      <figure class="entry__figure" id="room-figure">
        ${frame(w, { class: "entry__frame", eager: true })}
        <figcaption class="entry__caption"${w.settings ? "" : " hidden"}>
          <span class="label" id="room-settings">${esc(w.settings)}</span>
        </figcaption>
      </figure>
      <div class="entry__reflection prose" id="room-reflection">${reflection}</div>
    </article>`;
  }

  function roomNavHTML(w, weeks) {
    const dots = weeks
      .map(
        (x) =>
          `<a class="roomnav__dot is-${x.status}${x.week === w.week ? " is-here" : ""}" href="${roomUrl(
            x.week
          )}" aria-label="Week ${x.week}"${x.week === w.week ? ' aria-current="page"' : ""}></a>`
      )
      .join("");
    return `<nav class="roomnav" aria-label="Weeks">
      <a class="roomnav__back" href="journal.html">${svg(ARROW_L)}<span>All weeks</span></a>
      <div class="roomnav__dots">${dots}</div>
      <span class="label">Week ${w.num} / ${weeks.length}</span>
    </nav>`;
  }

  function roomDoorsHTML(w, weeks) {
    const door = (x, dir) =>
      x
        ? `<a class="roomdoor roomdoor--${dir}" href="${roomUrl(x.week)}">
            <span class="label">${dir === "prev" ? "Previous" : "Next"} · Week ${x.num}</span>
            <span class="roomdoor__title">${esc(x.isPlanning ? "Planning week" : x.concept)}</span>
          </a>`
        : `<span class="roomdoor roomdoor--${dir} is-none" aria-hidden="true"></span>`;
    return `<nav class="roomdoors" aria-label="Previous and next week">${door(weeks[w.week - 2], "prev")}${door(
      weeks[w.week],
      "next"
    )}</nav>`;
  }

  async function renderWeek() {
    const host = $("#room");
    if (!host) return;

    const weeks = await VLD.load();
    const n = parseInt(new URLSearchParams(location.search).get("w"), 10);
    const w = weeks[n - 1];

    if (!w) {
      host.innerHTML = `<div class="lost__inner" style="margin-inline:auto;text-align:center;justify-items:center">
        <span class="label label--accent">Week not found</span>
        <h1 class="display d2">There's no week ${esc(String(n || ""))} in this course.</h1>
        <a class="btn" href="journal.html">All weeks ${svg(ARROW_R, "btn__arrow")}</a>
      </div>`;
      return;
    }

    document.title = `${titleText(w)} · Lucas Chen`;
    host.innerHTML = roomNavHTML(w, weeks) + roomEntryHTML(w) + roomDoorsHTML(w, weeks);
    refresh(host);

    document.addEventListener("keydown", (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
      const to = e.key === "ArrowLeft" ? w.week - 1 : e.key === "ArrowRight" ? w.week + 1 : 0;
      if (to >= 1 && to <= weeks.length) location.href = roomUrl(to);
    });

    mountEditor(w);
  }

  /* ---------- Inline editing: on a browser linked in the Studio, the empty
     photo frame becomes an upload button and the reflection becomes a text
     box, in place. Everyone else sees the published entry only. ---------- */

  function mountEditor(w) {
    const a = author();
    const room = $("#room");
    if (!a || !room) return;

    const draftKey = `vld-draft-${w.num}`;
    let draft = null;
    try {
      draft = JSON.parse(localStorage.getItem(draftKey) || "null");
    } catch (e) {
      draft = null;
    }
    const v = w.isPlanning
      ? { note: w.note, ...(draft || {}) }
      : { settings: w.settings, reflection: w.reflection, ...(draft || {}) };

    room.classList.add("is-editing");
    let photo = null;
    let fileInput = null;

    if (w.isPlanning) {
      $("#room-note").outerHTML = `<input class="inline-note" id="edit-note" type="text" maxlength="160"
        placeholder="One line about what you planned in this session" aria-label="Planning note" value="${esc(v.note || "")}">`;
    } else {
      const figure = $("#room-figure");
      const frameEl = $(".frame", figure);
      frameEl.classList.add("is-uploadable", "is-revealed");
      const upload = document.createElement("label");
      upload.className = "upload";
      upload.innerHTML = `<input type="file" accept="image/*" class="visually-hidden">
        <span class="upload__cta">${svg(CAMERA)}<span class="label">${w.hasImage ? "Replace photo" : "Upload photo"}</span></span>`;
      frameEl.appendChild(upload);
      fileInput = $("input", upload);

      const caption = $(".entry__caption", figure);
      caption.hidden = false;
      caption.innerHTML = `<input class="inline-settings" id="edit-settings" type="text" aria-label="Camera settings"
        placeholder="Camera settings (optional), e.g. 35mm · f/2.8 · 1/250 · ISO 200" value="${esc(v.settings || "")}">`;

      $("#room-reflection").outerHTML = `<textarea class="inline-reflection" id="edit-reflection" rows="12" aria-label="Reflection"
        placeholder="Write your reflection: what you set out to do, what happened, how focused you stayed, what was difficult, what you changed, and what's next.">${esc(
          v.reflection || ""
        )}</textarea>`;
    }

    const bar = document.createElement("div");
    bar.className = "publishbar";
    bar.innerHTML = `<div class="publishbar__inner">
        <p class="publishbar__status" role="status" aria-live="polite"></p>
        <div class="publishbar__actions">
          <button class="btn" type="button" data-discard hidden>Discard draft</button>
          <button class="btn btn--solid" type="button" data-publish>Publish</button>
        </div>
      </div>`;
    document.body.appendChild(bar);
    document.body.classList.add("has-publishbar");

    const status = $(".publishbar__status", bar);
    const publishBtn = $("[data-publish]", bar);
    const discardBtn = $("[data-discard]", bar);
    const noteEl = $("#edit-note");
    const settingsEl = $("#edit-settings");
    const reflectionEl = $("#edit-reflection");

    const setStatus = (text, state = "") => {
      status.textContent = text;
      if (state) status.dataset.state = state;
      else delete status.dataset.state;
    };

    const values = () => ({
      note: noteEl ? noteEl.value : "",
      settings: settingsEl ? settingsEl.value : "",
      reflection: reflectionEl ? reflectionEl.value : "",
    });

    const grow = () => {
      if (!reflectionEl) return;
      reflectionEl.style.height = "auto";
      reflectionEl.style.height = `${Math.max(reflectionEl.scrollHeight + 2, 288)}px`;
    };
    grow();

    if (draft) {
      discardBtn.hidden = false;
      setStatus("Unpublished draft restored on this device.");
    } else {
      setStatus("Editing mode — only this browser can edit. Visitors see the published page.");
    }

    let saveTimer = 0;
    room.addEventListener("input", (e) => {
      if (e.target.type === "file") return;
      grow();
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        try {
          const d = values();
          localStorage.setItem(
            draftKey,
            JSON.stringify(w.isPlanning ? { note: d.note } : { settings: d.settings, reflection: d.reflection })
          );
          discardBtn.hidden = false;
          setStatus("Draft saved on this device. Press Publish to put it on the website.");
        } catch (err) {
          /* storage blocked: the text is still in the box */
        }
      }, 500);
    });

    if (fileInput) {
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        setStatus("Preparing photo…");
        try {
          photo = await a.prepareImage(file);
          const frameEl = $("#room-figure .frame");
          const upload = $(".upload", frameEl);
          frameEl.classList.remove("frame--empty");
          $$(":scope > :not(.upload)", frameEl).forEach((el) => el.remove());
          frameEl.insertAdjacentHTML("afterbegin", `<img src="${photo.url}" alt="Week ${w.week} photo">`);
          $(".upload__cta .label", upload).textContent = "Replace photo";
          setStatus(`Photo ready (${photo.width} × ${photo.height}). Press Publish to upload it.`);
        } catch (err) {
          photo = null;
          fileInput.value = "";
          setStatus(err.message, "error");
        }
      });
    }

    discardBtn.addEventListener("click", () => {
      localStorage.removeItem(draftKey);
      location.reload();
    });

    publishBtn.addEventListener("click", async () => {
      const d = values();
      if (w.isPlanning ? !d.note.trim() : !d.reflection.trim() && !photo) {
        setStatus(w.isPlanning ? "Write the planning note first." : "Write the reflection or upload a photo first.", "error");
        return;
      }
      // A pending draft save must not re-create the draft after publishing.
      window.clearTimeout(saveTimer);
      publishBtn.disabled = true;
      const imageName = photo ? `week-${w.num}.jpg` : w.hasImage ? w.image.split("/").pop().split("?")[0] : "";
      try {
        if (photo) {
          setStatus("Uploading photo…");
          await a.putFile(`${VLD.CONFIG.imageBase}week-${w.num}.jpg`, await a.blobToBase64(photo.blob), `Week ${w.week}: photo`);
          photo = null;
          fileInput.value = "";
          w.hasImage = true;
          w.image = `${VLD.CONFIG.imageBase}${imageName}`;
        }
        setStatus("Saving…");
        const md = VLD.serialize({ ...w, note: d.note, settings: d.settings, reflection: d.reflection, image: imageName });
        await a.putFile(w.file, a.textToBase64(md), `Week ${w.week}: ${w.isPlanning ? "planning note" : "reflection"}`);
        localStorage.removeItem(draftKey);
        discardBtn.hidden = true;
        VLD.invalidate();

        const tag = $("#room .entry__meta .tag");
        const nowWritten = w.isPlanning ? Boolean(d.note.trim()) : Boolean(d.reflection.trim());
        if (tag && !w.isPlanning) {
          tag.textContent = nowWritten ? STATUS.written : STATUS[w.date > VLD.today() ? "upcoming" : "open"];
          tag.classList.toggle("tag--accent", nowWritten);
        }
        const dot = $(`.roomnav__dot[href="${roomUrl(w.week)}"]`);
        if (dot && nowWritten) dot.className = "roomnav__dot is-written is-here";
        setStatus("Published. Everyone sees it on the website within about a minute.", "ok");
      } catch (err) {
        setStatus(err.message || "Publishing failed. Your text is still here — try again.", "error");
      } finally {
        publishBtn.disabled = false;
      }
    });

    window.addEventListener("beforeunload", (e) => {
      if (photo) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  /* ======================================================================
     Gallery + lightbox
     ====================================================================== */

  async function renderGallery() {
    const sheet = $("#gallery-sheet");
    if (!sheet) return;

    const weeks = (await VLD.load()).filter((w) => w.graded);
    const shots = weeks.filter((w) => w.hasImage);

    sheet.innerHTML = weeks
      .map((w) => {
        const inner = `${frame(w, { class: "shot__frame", cursor: "Open" })}
          <div class="shot__meta">
            <span class="shot__concept">${esc(w.concept)}</span>
            <span class="label">${w.num}</span>
          </div>
          <span class="label">${esc(w.settings || w.dateShort)}</span>`;
        return w.hasImage
          ? `<button class="shot" type="button" data-shot="${shots.indexOf(w)}">${inner}</button>`
          : `<a class="shot" href="${roomUrl(w.week)}">${inner}</a>`;
      })
      .join("");
    refresh(sheet);

    const summary = $("#gallery-summary");
    if (summary) summary.innerHTML = `<span class="label">${shots.length} of ${weeks.length} photos</span>`;

    initLightbox(shots);
  }

  function initLightbox(shots) {
    const box = $(".lightbox");
    if (!box || !shots.length) return;

    const img = $(".lightbox__img", box);
    const title = $("#lightbox-title");
    const meta = $("#lightbox-meta");
    const counter = $("#lightbox-counter");
    const open = $("#lightbox-open");
    const prev = $("[data-lb='prev']");
    const next = $("[data-lb='next']");
    const close = $("[data-lb='close']");
    let index = 0;
    let lastFocus = null;

    if (shots.length < 2) {
      prev.disabled = true;
      next.disabled = true;
    }

    function show(i) {
      index = (i + shots.length) % shots.length;
      const w = shots[index];
      img.src = w.image;
      img.alt = titleText(w);
      title.textContent = titleText(w);
      meta.textContent = [w.dateLabel, w.settings].filter(Boolean).join("  ·  ");
      counter.textContent = `${VLD.pad(index + 1)} / ${VLD.pad(shots.length)}`;
      if (open) open.href = roomUrl(w.week);
    }

    function openBox(i) {
      lastFocus = document.activeElement;
      show(i);
      box.classList.add("is-open");
      box.setAttribute("aria-hidden", "false");
      document.body.classList.add("is-locked");
      // A timeout, not rAF: rAF does not run while the tab is in the background.
      window.setTimeout(() => close.focus(), 60);
    }

    function shut() {
      box.classList.remove("is-open");
      box.setAttribute("aria-hidden", "true");
      document.body.classList.remove("is-locked");
      if (lastFocus) lastFocus.focus();
    }

    document.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-shot]");
      if (trigger) openBox(Number(trigger.dataset.shot));
    });
    close.addEventListener("click", shut);
    prev.addEventListener("click", () => show(index - 1));
    next.addEventListener("click", () => show(index + 1));
    box.addEventListener("click", (e) => {
      if (e.target === box || e.target.classList.contains("lightbox__stage")) shut();
    });

    document.addEventListener("keydown", (e) => {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") shut();
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
      if (e.key === "Tab") {
        const focusables = $$("button, a[href]", box).filter((el) => !el.disabled);
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  /* ======================================================================
     Course plan
     ====================================================================== */

  async function renderPlan() {
    const body = $("#syllabus-rows");
    if (!body) return;
    const weeks = await VLD.load();
    body.innerHTML = weeks
      .map(
        (w) => `<a class="syllabus__row" href="${roomUrl(w.week)}">
          <span class="syllabus__wk">${w.num}</span>
          <span class="syllabus__concept">${esc(w.isPlanning ? w.planTitle : w.concept)}${
          w.tip ? ` <span class="syllabus__tip">Tip ${esc(w.tip)}</span>` : ""
        }${w.description ? `<span class="syllabus__desc">${esc(w.description)}</span>` : ""}</span>
          <span class="syllabus__date">${esc(w.dateShort)}</span>
          <span class="syllabus__type">${w.isPlanning ? "Ungraded" : STATUS[w.status]}</span>
        </a>`
      )
      .join("");
  }

  /* ======================================================================
     Studio — link this browser to GitHub
     ====================================================================== */

  function renderStudio() {
    const form = $("#studio-form");
    if (!form || !window.VLDAuthor) return;

    const status = $("#studio-status");
    const linked = $("#studio-connected");
    const saved = VLDAuthor.config() || {};
    const guess = VLDAuthor.guess();
    form.elements.owner.value = saved.owner || guess.owner;
    form.elements.repo.value = saved.repo || guess.repo;
    form.elements.branch.value = saved.branch || "main";

    const paint = () => {
      const c = VLDAuthor.config();
      linked.hidden = !c;
      form.hidden = Boolean(c);
      if (c) $("#studio-repo").textContent = `${c.owner}/${c.repo} (${c.branch})`;
    };
    paint();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const c = {
        owner: form.elements.owner.value.trim(),
        repo: form.elements.repo.value.trim(),
        branch: form.elements.branch.value.trim(),
        token: form.elements.token.value.trim(),
      };
      if (!c.owner || !c.repo || !c.token) {
        status.textContent = "Fill in the username, repository and token.";
        status.dataset.state = "error";
        return;
      }
      status.textContent = "Checking with GitHub…";
      delete status.dataset.state;
      try {
        c.branch = await VLDAuthor.test(c);
        VLDAuthor.save(c);
        form.elements.token.value = "";
        status.textContent = "Connected.";
        status.dataset.state = "ok";
        paint();
      } catch (err) {
        status.textContent = err.message;
        status.dataset.state = "error";
      }
    });

    $("#studio-disconnect").addEventListener("click", () => {
      VLDAuthor.disconnect();
      status.textContent = "This browser is no longer linked.";
      delete status.dataset.state;
      paint();
    });
  }

  /* ======================================================================
     Opened straight from a folder: fetch() can't read the week files
     ====================================================================== */

  function fileProtocolNotice() {
    if (!VLD.isFileProtocol) return;
    const host = $("#file-warning");
    if (!host) return;
    host.innerHTML = `<div class="notice"><p>Open this site through a web server (or the published link) to see the weekly entries.</p></div>`;
    host.hidden = false;
  }

  /* ======================================================================
     Boot
     ====================================================================== */

  function boot() {
    initNav();
    initFooter();
    fileProtocolNotice();

    const routes = {
      home: renderHome,
      journal: renderJournal,
      week: renderWeek,
      gallery: renderGallery,
      plan: renderPlan,
      studio: renderStudio,
    };
    const render = routes[document.body.dataset.page];
    if (render) {
      Promise.resolve()
        .then(render)
        .catch((err) => console.error("[VLD] render failed", err));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
