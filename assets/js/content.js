/* ==========================================================================
   content.js — the data layer
   Reads content/plan.md and content/weeks/week-NN.md, and finds
   images/weeks/week-NN.jpg. No build step, no dependency.
   ========================================================================== */

const VLD = (() => {
  const CONFIG = {
    weeks: 16,
    contentBase: "content/weeks/",
    imageBase: "images/weeks/",
    planFile: "content/plan.md",
    // Convention is week-NN.jpg; anything else is named in the entry's `image:`.
    imageExt: "jpg",
    source: {
      title: "21 Photography Tips for Intermediate Photographers",
      author: "Spencer Cox",
      site: "Photography Life",
      url: "https://photographylife.com/photography-tips-for-intermediate-photographers",
    },
  };

  /* ---------- helpers ---------- */

  const pad = (n) => String(n).padStart(2, "0");

  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const oneLine = (s) => String(s || "").replace(/\s+/g, " ").trim();

  /* ---------- Markdown subset: paragraphs, bold, italic, links, lists, quotes */

  function inline(text) {
    return esc(text)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/_([^_\n]+)_/g, "<em>$1</em>")
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      )
      .replace(/\n/g, "<br>");
  }

  function markdown(src) {
    if (!src || !src.trim()) return "";
    return src
      .trim()
      .split(/\n{2,}/)
      .map((block) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-*+]\s+/.test(l))) {
          return `<ul>${lines
            .map((l) => `<li>${inline(l.replace(/^\s*[-*+]\s+/, ""))}</li>`)
            .join("")}</ul>`;
        }
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          return `<ol>${lines
            .map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>`)
            .join("")}</ol>`;
        }
        if (lines.every((l) => /^\s*>\s?/.test(l))) {
          return `<blockquote>${inline(
            lines.map((l) => l.replace(/^\s*>\s?/, "")).join("\n")
          )}</blockquote>`;
        }
        return `<p>${inline(block)}</p>`;
      })
      .join("");
  }

  /* ---------- frontmatter ---------- */

  function parseFile(raw) {
    const match = raw.match(/^﻿?---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n)?([\s\S]*)$/);
    if (!match) return { meta: {}, body: raw.trim() };
    const meta = {};
    match[1].split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
      if (m) meta[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, "");
    });
    return { meta, body: match[2].trim() };
  }

  /* ---------- dates ---------- */

  function toDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  const dateLabel = (d) =>
    d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const dateShort = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // ?today=2026-10-20 previews the site as it will look on that date.
  function today() {
    const override = toDate(new URLSearchParams(location.search).get("today"));
    const now = override || new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  /* ---------- reading ----------
     When the author has linked GitHub on this device, files are read straight
     from the repository so a just-published entry shows immediately. Everyone
     else reads the published copy.
  --------------------------------------------------------------------- */

  const author = () =>
    window.VLDAuthor && window.VLDAuthor.connected() ? window.VLDAuthor : null;

  async function readText(path) {
    const a = author();
    if (a) {
      try {
        const text = await a.readText(path);
        if (text !== null) return text;
      } catch (e) {
        /* fall back to the published copy */
      }
    }
    try {
      const res = await fetch(path, { cache: "no-cache" });
      return res.ok ? res.text() : null;
    } catch (e) {
      return null;
    }
  }

  function probe(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  async function findImage(n, explicit) {
    const name = explicit && explicit.trim() ? explicit.trim() : `week-${pad(n)}.${CONFIG.imageExt}`;
    const path = name.includes("/") ? name : CONFIG.imageBase + name;
    if (await probe(path)) return path;
    const a = author();
    if (a) {
      const raw = a.rawUrl(path);
      if (raw && (await probe(`${raw}?t=${Date.now()}`))) return `${raw}?t=${Date.now()}`;
    }
    return "";
  }

  /* ---------- plan ---------- */

  async function loadPlan() {
    const plan = {};
    const text = (await readText(CONFIG.planFile)) || "";
    text.split(/\r?\n/).forEach((line) => {
      if (!line.trim() || line.trim().startsWith("#")) return;
      const [wk, tip, title, ...rest] = line.split("|").map((s) => s.trim());
      const n = parseInt(wk, 10);
      if (n) plan[n] = { tip: tip && tip !== "-" ? tip : "", title: title || "", desc: rest.join(" | ").trim() };
    });
    return plan;
  }

  /* ---------- weeks ---------- */

  async function loadWeek(n, plan, now) {
    const file = `${CONFIG.contentBase}week-${pad(n)}.md`;
    const raw = await readText(file);
    const { meta, body } = parseFile(raw || "");
    const date = toDate(meta.date) || new Date(2026, 8, 1 + 7 * (n - 1));
    const isPlanning = n === 1 || (meta.kind || "").toLowerCase() === "planning";
    const planned = plan[n] || { tip: "", title: "", desc: "" };

    const note = isPlanning ? oneLine(meta.note) || oneLine(body) : "";
    const reflection = isPlanning ? "" : body;
    const written = isPlanning ? Boolean(note) : Boolean(reflection.trim());
    // Upcoming, unwritten weeks cannot have a photo yet — skip the request.
    const mayHavePhoto = !isPlanning && (Boolean(meta.image) || written || date <= now);
    const image = mayHavePhoto ? await findImage(n, meta.image) : "";

    return {
      week: n,
      num: pad(n),
      file,
      date,
      dateISO: isoOf(date),
      dateLabel: dateLabel(date),
      dateShort: dateShort(date),
      isPlanning,
      graded: !isPlanning,
      tip: planned.tip,
      planTitle: planned.title,
      description: planned.desc,
      concept: oneLine(meta.concept) || planned.title,
      settings: oneLine(meta.settings),
      note,
      reflection,
      html: markdown(reflection),
      image,
      hasImage: Boolean(image),
      hasReflection: Boolean(reflection.trim()),
      written,
      status: written ? "written" : date > now ? "upcoming" : "open",
    };
  }

  let cache = null;

  function load() {
    if (cache) return cache;
    const now = today();
    cache = loadPlan().then((plan) =>
      Promise.all(Array.from({ length: CONFIG.weeks }, (_, i) => loadWeek(i + 1, plan, now)))
    );
    return cache;
  }

  const invalidate = () => {
    cache = null;
  };

  function stats(weeks) {
    const now = today();
    const graded = weeks.filter((w) => w.graded);
    const past = weeks.filter((w) => w.date <= now);
    return {
      total: CONFIG.weeks,
      graded: graded.length,
      sessionsSoFar: past.length,
      written: graded.filter((w) => w.written).length,
      photos: graded.filter((w) => w.hasImage).length,
      latest: [...weeks].reverse().find((w) => w.written) || null,
      current: past[past.length - 1] || weeks[0],
    };
  }

  /* ---------- writing: the exact file format loadWeek reads ---------- */

  function serialize(entry) {
    if (entry.isPlanning) {
      return `---\nweek: ${entry.week}\ndate: ${entry.dateISO}\nkind: planning\nnote: ${oneLine(entry.note)}\n---\n`;
    }
    const body = String(entry.reflection || "").replace(/\r\n/g, "\n").trim();
    return (
      `---\nweek: ${entry.week}\ndate: ${entry.dateISO}\nconcept: ${oneLine(entry.concept)}\n` +
      `settings: ${oneLine(entry.settings)}\nimage: ${oneLine(entry.image)}\n---\n\n${body}\n`
    );
  }

  const isFileProtocol = location.protocol === "file:";

  return { CONFIG, load, invalidate, stats, serialize, markdown, esc, pad, today, isFileProtocol };
})();
