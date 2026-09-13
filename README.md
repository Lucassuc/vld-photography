# VLD Photography — Lucas Chen

Website for Virtual Learning & Development, Kang Chiao International School,
Semester 1 2026–27. Sixteen Tuesday sessions, 1 September – 15 December 2026.

Static HTML, CSS and JavaScript on GitHub Pages. No build step and nothing to install.

**Syllabus:** Spencer Cox, [21 Photography Tips for Intermediate Photographers](https://photographylife.com/photography-tips-for-intermediate-photographers), Photography Life.

---

## Publish the site (once)

```bash
git add -A
git commit -m "VLD photography site"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

On GitHub: **Settings → Pages → Deploy from a branch → `main` / `(root)`**.
The site appears at `https://<username>.github.io/<repo>/`.

## Link your browser (once)

Open `https://<username>.github.io/<repo>/studio.html` and follow the four steps
on the page to create a GitHub access token (only this repository,
**Contents: Read and write**). The token stays in that browser only.

## Each week

1. Open the Journal on the live site and click the week.
2. Fill in the box under the entry: photo, reflection, and optional camera settings.
   What you type previews in the page as you go, and drafts are saved on your device.
3. Press **Publish**. Everyone sees it within about a minute.

Visitors — including your teacher — only see the published entry, never the box.

## Weekly plan

| Wk | Date | Tip |
|---|---|---|
| 1 | Sep 1 | Planning (ungraded, one line) |
| 2 | Sep 8 | #21 Memorize Your Camera |
| 3 | Sep 15 | #4 Simplify |
| 4 | Sep 22 | #8 Watch the Edges |
| 5 | Sep 29 | #10 Put It Into Perspective |
| 6 | Oct 6 | #20 Think About Your Scene Abstractly |
| 7 | Oct 13 | #5 Find Good Light – For Your Subject |
| 8 | Oct 20 | #12 Scout |
| 9 | Oct 27 | #19 Don't Avoid Bad Weather |
| 10 | Nov 3 | #15 Capture Your Subject Doing Something |
| 11 | Nov 10 | #17 Wait for Patterns |
| 12 | Nov 17 | #11 Look For Interconnectedness and Visual Puns |
| 13 | Nov 24 | #2 Focus On Emotion |
| 14 | Dec 1 | #7 Refine Your Photos in the Field |
| 15 | Dec 8 | #1 Don't Follow the Rules |
| 16 | Dec 15 | #18 Be Selective |

To change the plan, edit `content/plan.md` (one line per week) and note the
reason under **Course changes** in `plan.html`.

## Files

```
index.html  about.html  plan.html  journal.html  week.html  gallery.html  studio.html  404.html
content/plan.md          weekly plan
content/weeks/           week-01.md … week-16.md (written by the Publish button)
images/weeks/            week-02.jpg … week-16.jpg (uploaded by the Publish button)
images/site/             home page and About photos
assets/js/               content.js · author.js · motion.js · site.js
```

Editing by hand still works: put a photo at `images/weeks/week-07.jpg`, write
the reflection under the `---` line in `content/weeks/week-07.md`, commit and push.

Preview locally with `python3 -m http.server 8000`, then open http://localhost:8000.
