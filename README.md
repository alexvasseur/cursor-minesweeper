# Cursor Minesweeper

Classic-style Minesweeper built with plain HTML, CSS, and JavaScript.

## Features

- Adjustable board size from **5x5** to **64x64**
- Adjustable mine density from **10%** to **25%**
- **Single click** reveals a tile
- **Shift + click** toggles a flag
- First click is always safe (and includes a safe neighborhood)
- Recursive reveal of empty areas, win/loss states, and timer
- Cursor logo used for flags and Anthropic logo used for mines

## Run locally

Open `index.html` in a browser, or serve with a local static server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages

This repository includes a workflow at `.github/workflows/deploy-pages.yml` that deploys the static site with GitHub Pages on pushes to `main`.
