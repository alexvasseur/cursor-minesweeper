# Cursor Minesweeper

Classic-style Minesweeper built with plain HTML, CSS, and JavaScript.

## Play online

**Live game:** https://alexvasseur.github.io/cursor-minesweeper/

### Embed attempt (iframe)

GitHub README rendering does **not** support embedded iframes for security reasons, so the block below will not display inside this page on github.com. It is included for use on your own site or docs page:

```html
<iframe
  src="https://alexvasseur.github.io/cursor-minesweeper/"
  title="Cursor Minesweeper"
  width="100%"
  height="720"
  style="border: 1px solid #ccc; border-radius: 8px;"
  loading="lazy"
  allow="fullscreen"
></iframe>
```

### Recommended alternatives on GitHub

- Open the live game directly: [Play Cursor Minesweeper](https://alexvasseur.github.io/cursor-minesweeper/)
- Share the Pages URL in issues, PRs, or docs
- Host a small docs page (GitHub Pages, Notion, internal wiki) that includes the iframe HTML above

## Features

- Adjustable board size from **5x5** to **64x64**
- Adjustable mine density from **10%** to **25%**
- **Single click** reveals a tile
- **Shift + click** toggles a flag
- Mobile-friendly **Flag Mode** button
- First click is always safe (and includes a safe neighborhood)
- Recursive reveal of empty areas, win/loss states, and timer
- Cursor logo used for flags and a bomb icon used for mines

## Run locally

Open `index.html` in a browser, or serve with a local static server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages

This repository includes a workflow at `.github/workflows/deploy-pages.yml` that deploys the static site with GitHub Pages on pushes to `main`.
