/* ==========================================================================
   motion.js — the whole motion layer, no dependencies.

   Scroll smoothing hijacks the wheel and drives window.scrollTo, rather than
   translating a wrapper. That keeps the real scroll position honest, so
   position:sticky, anchor links and IntersectionObserver all still work.
   ========================================================================== */

(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ======================================================================
     Ticker — one rAF loop, many subscribers
     ====================================================================== */

  const ticker = (() => {
    const subs = new Set();
    let running = false;

    function frame() {
      const y = window.scrollY;
      const vh = window.innerHeight;
      subs.forEach((fn) => {
        try {
          fn(y, vh);
        } catch (err) {
          /* one bad effect must never stop the loop */
        }
      });
      if (running) requestAnimationFrame(frame);
    }

    return {
      add(fn) {
        subs.add(fn);
        if (!running) {
          running = true;
          requestAnimationFrame(frame);
        }
      },
      remove: (fn) => subs.delete(fn),
    };
  })();

  /* ======================================================================
     1. Smooth scroll
     ====================================================================== */

  function initSmoothScroll() {
    if (reduced.matches || !finePointer.matches) return;
    if (window.innerWidth < 1024) return;

    const root = document.documentElement;
    root.classList.add("has-smooth-scroll");

    const maxScroll = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    let target = window.scrollY;
    let current = target;
    let lerping = false;

    function step() {
      current = lerp(current, target, 0.1);
      if (Math.abs(target - current) < 0.4) {
        current = target;
        lerping = false;
        window.scrollTo(0, current);
        return;
      }
      window.scrollTo(0, current);
      requestAnimationFrame(step);
    }

    function begin() {
      if (lerping) return;
      lerping = true;
      requestAnimationFrame(step);
    }

    window.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey) return; // pinch-zoom
        // Text boxes scroll themselves.
        if (e.target.closest && e.target.closest("[data-native-scroll], textarea")) return;
        e.preventDefault();

        let delta = e.deltaY;
        if (e.deltaMode === 1) delta *= 16;
        else if (e.deltaMode === 2) delta *= window.innerHeight;

        target = clamp(target + delta, 0, maxScroll());
        begin();
      },
      { passive: false }
    );

    // Anything that scrolls by other means (keys, scrollbar, anchors) resyncs.
    window.addEventListener(
      "scroll",
      () => {
        if (!lerping) {
          target = window.scrollY;
          current = target;
        }
      },
      { passive: true }
    );

    window.addEventListener("resize", () => {
      target = clamp(target, 0, maxScroll());
    });
  }

  /* ======================================================================
     2. Split text into animatable words / characters
     Walks text nodes only, so inline <em> and <br> inside a heading survive.
     ====================================================================== */

  let splitIndex = 0;

  function splitNode(el, mode) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = "1";

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach((node) => {
      const text = node.nodeValue;
      if (!text.trim()) return;

      const frag = document.createDocumentFragment();

      if (mode === "chars") {
        // Characters are grouped inside a per-word wrapper, otherwise each
        // inline-block letter becomes its own break opportunity and words
        // split across lines.
        text.split(/(\s+)/).forEach((chunk) => {
          if (!chunk) return;
          if (/^\s+$/.test(chunk)) {
            frag.appendChild(document.createTextNode(chunk));
            return;
          }
          const word = document.createElement("span");
          word.className = "split-wordwrap";
          Array.from(chunk).forEach((ch) => {
            const span = document.createElement("span");
            span.className = "split-char";
            span.style.setProperty("--i", splitIndex++);
            span.textContent = ch;
            word.appendChild(span);
          });
          frag.appendChild(word);
        });
      } else {
        text.split(/(\s+)/).forEach((chunk) => {
          if (!chunk) return;
          if (/^\s+$/.test(chunk)) {
            frag.appendChild(document.createTextNode(chunk));
            return;
          }
          const outer = document.createElement("span");
          outer.className = "split-word";
          const inner = document.createElement("span");
          inner.style.setProperty("--i", splitIndex++);
          inner.textContent = chunk;
          outer.appendChild(inner);
          frag.appendChild(outer);
        });
      }

      node.parentNode.replaceChild(frag, node);
    });
  }

  function initSplit(root = document) {
    $$("[data-split]", root).forEach((el) => {
      splitIndex = 0; // restart the stagger per heading
      splitNode(el, el.dataset.split);
    });
  }

  /* ======================================================================
     3. Reveal on scroll
     ====================================================================== */

  let revealObserver = null;

  function initReveal(root = document) {
    const targets = $$("[data-reveal], [data-split], .frame, .mask", root).filter(
      (el) => !el.dataset.revealBound
    );
    if (!targets.length) return;

    if (reduced.matches) {
      targets.forEach((el) => {
        el.dataset.revealBound = "1";
        el.classList.add("is-revealed");
      });
      return;
    }

    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-revealed");
            revealObserver.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
      );
    }

    targets.forEach((el) => {
      el.dataset.revealBound = "1";
      revealObserver.observe(el);
    });
  }

  /* ======================================================================
     4. Parallax
     ====================================================================== */

  function initParallax(root = document) {
    if (reduced.matches) return;
    const items = $$("[data-parallax]", root);
    if (!items.length) return;

    ticker.add((y, vh) => {
      items.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        const speed = parseFloat(el.dataset.parallax) || 0.12;
        const offset = (rect.top + rect.height / 2 - vh / 2) * speed;
        el.style.setProperty("--py", `${offset.toFixed(2)}px`);
      });
    });
  }

  /* ======================================================================
     5. Pinned scene — scroll drives a cross-fading stack
     ====================================================================== */

  function initScenes(root = document) {
    $$("[data-scene]", root).forEach((scene) => {
      const slides = $$("[data-slide]", scene);
      const numEl = $(".scene__num", scene);
      const bg = $(".scene__bg", scene);
      if (!slides.length) return;

      slides[0].classList.add("is-active");

      if (reduced.matches) {
        // Without motion the stack collapses to a readable list.
        scene.style.height = "auto";
        const pin = $(".scene__pin", scene);
        if (pin) {
          pin.style.position = "static";
          pin.style.height = "auto";
          pin.style.paddingBlock = "var(--section)";
        }
        slides.forEach((s) => {
          s.classList.add("is-active");
          s.style.position = "relative";
          s.style.gridArea = "auto";
          s.style.marginBottom = "var(--s-16)";
        });
        return;
      }

      let active = -1;

      ticker.add((y, vh) => {
        const rect = scene.getBoundingClientRect();
        const distance = scene.offsetHeight - vh;
        if (distance <= 0) return;

        const progress = clamp(-rect.top / distance, 0, 1);
        const index = clamp(
          Math.floor(progress * slides.length),
          0,
          slides.length - 1
        );

        if (index !== active) {
          active = index;
          slides.forEach((s, i) => s.classList.toggle("is-active", i === index));
        }

        if (numEl) {
          const from = Number(numEl.dataset.from || 1);
          const to = Number(numEl.dataset.to || 16);
          const value = Math.round(lerp(from, to, progress));
          const text = String(value).padStart(2, "0");
          if (numEl.textContent !== text) numEl.textContent = text;
        }

        if (bg) {
          bg.style.opacity = (0.35 + progress * 0.65).toFixed(3);
          bg.style.transform = `scale(${(1 + progress * 0.35).toFixed(3)})`;
        }
      });
    });
  }

  /* ======================================================================
     6. Horizontal strip — pinned vertically, travels sideways
     ====================================================================== */

  function initStrips(root = document) {
    $$("[data-strip]", root).forEach((strip) => {
      const track = $(".strip__track", strip);
      if (!track) return;

      /* Items travel sideways under a pin, so per-item IntersectionObserver
         reveals fire unreliably. Reveal the whole run on a stagger instead,
         keyed off the strip itself, which has ordinary geometry. */
      const frames = $$(".frame", track);
      frames.forEach((f) => (f.dataset.revealBound = "1"));

      if (reduced.matches) {
        frames.forEach((f) => f.classList.add("is-revealed"));
      } else {
        const io = new IntersectionObserver(
          (entries) => {
            if (!entries.some((e) => e.isIntersecting)) return;
            io.disconnect();
            frames.forEach((f, i) => {
              f.style.setProperty("--reveal-delay", `${(i * 0.09).toFixed(2)}s`);
              f.classList.add("is-revealed");
            });
          },
          { rootMargin: "0px 0px -10% 0px" }
        );
        io.observe(strip);
      }

      const narrow = () =>
        window.innerWidth <= 800 || reduced.matches;

      if (narrow()) {
        track.setAttribute("data-native-scroll", "");
        return;
      }

      // Height of the pinned section is derived from how far the track travels,
      // so the sideways speed reads as natural however many photos there are.
      function measure() {
        const travel = Math.max(0, track.scrollWidth - window.innerWidth);
        strip.style.height = `${window.innerHeight + travel * 1.15}px`;
        return travel;
      }

      let travel = measure();
      window.addEventListener("resize", () => {
        travel = measure();
      });

      ticker.add((y, vh) => {
        const rect = strip.getBoundingClientRect();
        const distance = strip.offsetHeight - vh;
        if (distance <= 0) return;
        const progress = clamp(-rect.top / distance, 0, 1);
        track.style.setProperty("--x", `${(-travel * progress).toFixed(1)}px`);
      });
    });
  }

  /* ======================================================================
     7. Header — sticks, then hides on the way down
     ====================================================================== */

  function initHeader() {
    const header = $(".site-header");
    if (!header) return;
    let last = window.scrollY;

    // Runs on real scroll events as well as the frame loop: animation frames
    // can be paused (background tabs, some mobile browsers), scroll events are not.
    function update() {
      const y = window.scrollY;
      header.classList.toggle("is-stuck", y > 40);
      const menuOpen = document.body.classList.contains("is-locked");
      if (!menuOpen && y > 400 && y > last + 4) header.classList.add("is-hidden");
      else if (y < last - 4 || y <= 400) header.classList.remove("is-hidden");
      last = y;
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    ticker.add(update);
  }

  /* ======================================================================
     8. Chapter chip + sprocket rail
     ====================================================================== */

  function initChapters() {
    const sections = $$("[data-chapter]");
    if (!sections.length) return;

    const chip = $(".chapter");
    const chipNum = $(".chapter__num");
    const chipName = $(".chapter__name");
    const rail = $(".rail");

    if (rail) {
      rail.innerHTML = "";
      sections.forEach((section, i) => {
        const tick = document.createElement("a");
        tick.className = "rail__tick";
        tick.href = `#${section.id || ""}`;
        tick.setAttribute(
          "aria-label",
          `Go to ${section.dataset.chapter || `section ${i + 1}`}`
        );
        rail.appendChild(tick);
      });
    }

    const ticks = rail ? $$(".rail__tick", rail) : [];
    let current = -1;

    ticker.add((y, vh) => {
      let index = -1;
      sections.forEach((section, i) => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= vh * 0.45 && rect.bottom >= vh * 0.35) index = i;
      });

      if (rail) rail.classList.toggle("is-visible", y > vh * 0.6);
      if (chip) chip.classList.toggle("is-visible", index >= 0 && y > vh * 0.6);

      if (index === current) return;
      current = index;

      if (index >= 0) {
        const section = sections[index];
        if (chipNum)
          chipNum.textContent = `Chapter ${String(index + 1).padStart(2, "0")}`;
        if (chipName) chipName.textContent = section.dataset.chapter || "";
      }

      ticks.forEach((tick, i) => {
        tick.classList.toggle("is-passed", i < index);
        tick.classList.toggle("is-current", i === index);
      });
    });
  }

  /* ======================================================================
     9. Count-up figures
     ====================================================================== */

  function initCounters(root = document) {
    const items = $$("[data-count]", root).filter((el) => !el.dataset.countBound);
    if (!items.length) return;

    items.forEach((el) => (el.dataset.countBound = "1"));

    if (reduced.matches) {
      items.forEach((el) => (el.textContent = el.dataset.count));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          io.unobserve(el);

          const to = Number(el.dataset.count) || 0;
          const padTo = el.dataset.pad ? Number(el.dataset.pad) : 0;
          const duration = 1400;
          const start = performance.now();

          const run = (now) => {
            const t = clamp((now - start) / duration, 0, 1);
            const eased = 1 - Math.pow(1 - t, 4); // ease-out-quart
            const value = Math.round(to * eased);
            el.textContent = padTo
              ? String(value).padStart(padTo, "0")
              : String(value);
            if (t < 1) requestAnimationFrame(run);
          };
          requestAnimationFrame(run);
        });
      },
      { threshold: 0.5 }
    );

    items.forEach((el) => io.observe(el));
  }

  /* ======================================================================
     10. Custom cursor
     ====================================================================== */

  function initCursor() {
    if (!finePointer.matches || reduced.matches) return;

    const dot = document.createElement("div");
    dot.className = "cursor";
    dot.setAttribute("aria-hidden", "true");
    const ring = document.createElement("div");
    ring.className = "cursor-ring";
    ring.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    ring.appendChild(label);
    document.body.append(dot, ring);

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;

    window.addEventListener(
      "mousemove",
      (e) => {
        mx = e.clientX;
        my = e.clientY;
        dot.style.translate = `${mx}px ${my}px`;
      },
      { passive: true }
    );

    ticker.add(() => {
      rx = lerp(rx, mx, 0.16);
      ry = lerp(ry, my, 0.16);
      ring.style.translate = `${rx.toFixed(1)}px ${ry.toFixed(1)}px`;
    });

    document.addEventListener(
      "mouseover",
      (e) => {
        const view = e.target.closest("[data-cursor]");
        const link = e.target.closest("a, button, [role='button']");
        document.body.classList.toggle("cursor-view", Boolean(view));
        document.body.classList.toggle("cursor-link", Boolean(link) && !view);
        if (view) label.textContent = view.dataset.cursor || "View";
      },
      { passive: true }
    );

    document.addEventListener(
      "mouseleave",
      () => {
        dot.style.opacity = "0";
        ring.style.opacity = "0";
      },
      true
    );
    document.addEventListener(
      "mouseenter",
      () => {
        dot.style.opacity = "";
        ring.style.opacity = "";
      },
      true
    );
  }

  /* ======================================================================
     11. Magnetic buttons
     ====================================================================== */

  function initMagnetic(root = document) {
    if (!finePointer.matches || reduced.matches) return;

    $$("[data-magnetic]", root).forEach((el) => {
      if (el.dataset.magneticBound) return;
      el.dataset.magneticBound = "1";
      const strength = parseFloat(el.dataset.magnetic) || 0.3;

      el.addEventListener("mousemove", (e) => {
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * strength;
        const y = (e.clientY - rect.top - rect.height / 2) * strength;
        el.classList.add("is-magnet");
        el.style.setProperty("--mx", `${x.toFixed(1)}px`);
        el.style.setProperty("--my", `${y.toFixed(1)}px`);
      });

      el.addEventListener("mouseleave", () => {
        el.classList.remove("is-magnet");
        el.style.setProperty("--mx", "0px");
        el.style.setProperty("--my", "0px");
      });
    });
  }

  /* ======================================================================
     12. Marquee — duplicate the track so the loop is seamless
     ====================================================================== */

  function initMarquee(root = document) {
    $$(".marquee", root).forEach((marquee) => {
      const track = $(".marquee__track", marquee);
      if (!track || marquee.dataset.marqueeBound) return;
      marquee.dataset.marqueeBound = "1";
      const clone = track.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      marquee.appendChild(clone);
    });
  }

  /* ======================================================================
     13. Preloader
     ====================================================================== */

  function initPreloader() {
    const pre = $(".preloader");
    if (!pre) return;

    const blades = $$(".preloader__blade");
    const countEl = $(".preloader__count em");
    const bar = $(".preloader__bar i");
    const root = document.documentElement;

    const dismiss = () => {
      pre.hidden = true;
      blades.forEach((b) => (b.hidden = true));
      root.classList.remove("vld-intro");
    };

    // The <head> script only adds .intro on a first, visible, motion-allowed
    // visit. Anything else goes straight to the page.
    if (!root.classList.contains("vld-intro")) {
      dismiss();
      return;
    }

    try {
      sessionStorage.setItem("vld-intro", "1");
    } catch (e) {
      /* storage blocked — the intro simply plays again next time */
    }

    // Driven by elapsed time, not by counting timer ticks: background tabs
    // throttle timers, and a throttled count is how a curtain gets stuck.
    const MIN = 1500;
    const MAX = 2600;
    const start = Date.now();
    let loaded = document.readyState === "complete";
    window.addEventListener("load", () => (loaded = true), { once: true });

    let done = false;
    function finish() {
      if (done) return;
      done = true;
      if (countEl) countEl.textContent = "100";
      if (bar) bar.style.setProperty("--p", "100%");
      document.body.classList.add("is-opening");
      pre.style.opacity = "0";
      window.setTimeout(dismiss, 1200);
    }

    function tick() {
      if (done) return;
      const elapsed = Date.now() - start;
      const ready = (loaded && elapsed >= MIN) || elapsed >= MAX;
      const pct = Math.min(99, Math.round((elapsed / MAX) * 100));
      if (countEl) countEl.textContent = String(pct).padStart(3, "0");
      if (bar) bar.style.setProperty("--p", `${pct}%`);
      if (ready) finish();
      else window.setTimeout(tick, 60);
    }
    tick();

    // Belt and braces: a hard stop that does not depend on tick() running.
    window.setTimeout(finish, MAX + 200);
  }

  /* ======================================================================
     14. Page transition — View Transitions where supported, wipe elsewhere
     ====================================================================== */

  function initTransitions() {
    if (reduced.matches) return;

    const wipe = document.createElement("div");
    wipe.className = "wipe";
    document.body.appendChild(wipe);

    // Coming back via bfcache must never leave the curtain down.
    const clear = () => {
      wipe.classList.remove("is-out", "is-in");
    };
    window.addEventListener("pageshow", clear);
    window.addEventListener("popstate", clear);

    document.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const link = e.target.closest("a");
      if (!link) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;

      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.hash) return; // in-page

      e.preventDefault();
      wipe.classList.add("is-out");
      window.setTimeout(() => {
        location.href = url.href;
      }, 460);
      // If navigation is blocked for any reason, lift the curtain again.
      window.setTimeout(clear, 3000);
    });
  }

  /* ======================================================================
     Boot
     ====================================================================== */

  function refresh(root = document) {
    initSplit(root);
    initReveal(root);
    initCounters(root);
    initMagnetic(root);
    initMarquee(root);
  }

  function boot() {
    const steps = [
      initPreloader,
      initSmoothScroll,
      // Strips claim their own frames before the generic reveal pass binds them.
      initStrips,
      refresh,
      initParallax,
      initScenes,
      initHeader,
      initChapters,
      initCursor,
      initTransitions,
    ];
    steps.forEach((step) => {
      try {
        step();
      } catch (err) {
        console.error("[VLD motion]", step.name, err);
      }
    });

    // Whatever is on screen at load must end up visible even if the
    // observer never reports (e.g. the page was opened in a hidden tab).
    window.setTimeout(() => {
      const vh = window.innerHeight;
      $$("[data-reveal], [data-split], .frame, .mask").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) el.classList.add("is-revealed");
      });
    }, 1800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Page controllers call this after injecting rendered content.
  window.VLDMotion = { refresh, ticker, initParallax, initStrips, reduced };
})();
