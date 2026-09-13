/* ==========================================================================
   author.js — writing entries from the live site.
   The site stays static: GitHub is the storage, exactly as it is when files
   are edited by hand. A browser the author has linked (studio.html) can save
   week files and photos straight into the repository; GitHub Pages then
   republishes them for every visitor. Nothing is sent anywhere else.
   ========================================================================== */

const VLDAuthor = (() => {
  const KEY = "vld-github";
  const API = "https://api.github.com";
  const HEADERS = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const enc = encodeURIComponent;
  const pathUrl = (p) => p.split("/").map(enc).join("/");

  /* ---------- connection (stored in this browser only) ---------- */

  function config() {
    try {
      const c = JSON.parse(localStorage.getItem(KEY) || "null");
      return c && c.token && c.owner && c.repo ? c : null;
    } catch (e) {
      return null;
    }
  }

  const connected = () => Boolean(config());
  const save = (c) => localStorage.setItem(KEY, JSON.stringify(c));
  const disconnect = () => localStorage.removeItem(KEY);

  // On https://owner.github.io/repo/ the owner and repository can be read off the URL.
  function guess() {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (!m) return { owner: "", repo: "" };
    const first = location.pathname.split("/").filter(Boolean)[0] || "";
    const repo = first && !first.includes(".") ? first : `${m[1]}.github.io`;
    return { owner: m[1], repo };
  }

  /* ---------- GitHub REST ---------- */

  const request = (c, url, opts = {}) =>
    fetch(url, {
      ...opts,
      headers: { ...HEADERS, Authorization: `Bearer ${c.token}`, ...(opts.headers || {}) },
    });

  const repoBase = (c) => `${API}/repos/${enc(c.owner)}/${enc(c.repo)}`;

  async function describe(res) {
    let msg = "";
    try {
      msg = (await res.json()).message || "";
    } catch (e) {
      /* no body */
    }
    if (res.status === 401) return "GitHub rejected the access token. Reconnect in the Studio.";
    if (res.status === 403) return "GitHub refused to save. Check the token has Contents: Read and write.";
    if (res.status === 404) return "Repository not found. Check the name, and that the token can access it.";
    if (res.status === 409 || res.status === 422) return "The file changed on GitHub at the same moment. Press Publish again.";
    return msg ? `GitHub: ${msg}` : `GitHub error ${res.status}.`;
  }

  async function test(c) {
    let res;
    try {
      res = await request(c, repoBase(c));
    } catch (e) {
      throw new Error("Couldn't reach GitHub. Check your connection.");
    }
    if (!res.ok) throw new Error(await describe(res));
    const repo = await res.json();
    if (repo.permissions && repo.permissions.push === false) {
      throw new Error("This token can see the repository but can't write to it.");
    }
    const branch = c.branch || repo.default_branch;
    const b = await request(c, `${repoBase(c)}/branches/${enc(branch)}`);
    if (!b.ok) throw new Error(`Branch "${branch}" wasn't found in ${c.owner}/${c.repo}.`);
    return branch;
  }

  async function readText(path) {
    const c = config();
    if (!c) return null;
    const res = await request(c, `${repoBase(c)}/contents/${pathUrl(path)}?ref=${enc(c.branch)}`, {
      headers: { Accept: "application/vnd.github.raw+json" },
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await describe(res));
    return res.text();
  }

  async function putFile(path, base64, message) {
    const c = config();
    if (!c) throw new Error("This browser isn't linked to GitHub. Open the Studio to connect.");
    const url = `${repoBase(c)}/contents/${pathUrl(path)}`;

    let sha;
    const current = await request(c, `${url}?ref=${enc(c.branch)}`, { cache: "no-store" });
    if (current.ok) sha = (await current.json()).sha;
    else if (current.status !== 404) throw new Error(await describe(current));

    const res = await request(c, url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, content: base64, branch: c.branch, ...(sha ? { sha } : {}) }),
    });
    if (!res.ok) throw new Error(await describe(res));
    return res.json();
  }

  function rawUrl(path) {
    const c = config();
    return c
      ? `https://raw.githubusercontent.com/${enc(c.owner)}/${enc(c.repo)}/${enc(c.branch)}/${pathUrl(path)}`
      : "";
  }

  /* ---------- encoding ---------- */

  function textToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(new Error("Couldn't read the photo."));
      reader.readAsDataURL(blob);
    });

  /* ---------- photos: resized in the browser before upload ---------- */

  async function decode(file) {
    if ("createImageBitmap" in window) {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (e) {
        try {
          return await createImageBitmap(file);
        } catch (e2) {
          /* try an <img> below */
        }
      }
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async function prepareImage(file, max = 1600, quality = 0.82) {
    if (!file) throw new Error("Choose a photo first.");
    let src;
    try {
      src = await decode(file);
    } catch (e) {
      throw new Error("This photo can't be opened in the browser. Export it as a JPEG and try again.");
    }
    const w0 = src.naturalWidth || src.width;
    const h0 = src.naturalHeight || src.height;
    const scale = Math.min(1, max / Math.max(w0, h0));
    const width = Math.round(w0 * scale);
    const height = Math.round(h0 * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(src, 0, 0, width, height);

    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob) throw new Error("Couldn't prepare the photo. Try a different file.");
    return { blob, url: URL.createObjectURL(blob), width, height };
  }

  return {
    config,
    connected,
    save,
    disconnect,
    guess,
    test,
    readText,
    putFile,
    rawUrl,
    textToBase64,
    blobToBase64,
    prepareImage,
  };
})();

// A top-level const is not a window property; the other scripts look for this.
window.VLDAuthor = VLDAuthor;
