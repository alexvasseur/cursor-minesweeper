import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { rename } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const artifactPath = "/opt/cursor/artifacts/minesweeper-score-demo.mp4";
const port = 8765;

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};

function getNeighbors(row, col, size) {
  const neighbors = [];
  for (let r = row - 1; r <= row + 1; r += 1) {
    for (let c = col - 1; c <= col + 1; c += 1) {
      if (r === row && c === col) {
        continue;
      }
      if (r >= 0 && r < size && c >= 0 && c < size) {
        neighbors.push([r, c]);
      }
    }
  }
  return neighbors;
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const requestPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
      const filePath = path.join(rootDir, requestPath);
      try {
        const data = await readFile(filePath);
        const ext = path.extname(filePath);
        res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    server.listen(port, () => resolve(server));
  });
}

async function readBoard(page) {
  return page.evaluate(() => {
    const buttons = [...document.querySelectorAll(".cell")];
    const side = Math.round(Math.sqrt(buttons.length));
    const cells = buttons.map((button) => ({
      row: Number(button.dataset.row),
      col: Number(button.dataset.col),
      revealed: button.classList.contains("revealed"),
      flagged: button.classList.contains("flagged"),
      number: button.classList.contains("revealed") && button.textContent ? Number(button.textContent) : null,
    }));
    const banner = document.getElementById("resultBanner");
    const gameOver = banner && !banner.classList.contains("hidden");
    const won = gameOver && document.getElementById("resultBannerTitle").textContent === "Well done";
    return { side, cells, gameOver, won };
  });
}

async function clickCell(page, row, col) {
  await page.locator(`.cell[data-row="${row}"][data-col="${col}"]`).click();
  await page.waitForTimeout(180);
}

async function flagCell(page, row, col) {
  await page.locator(`.cell[data-row="${row}"][data-col="${col}"]`).click({ modifiers: ["Shift"] });
  await page.waitForTimeout(180);
}

async function solveCurrentGame(page) {
  let board = await readBoard(page);
  const center = Math.floor(board.side / 2);
  await clickCell(page, center, center);

  for (let iteration = 0; iteration < 250; iteration += 1) {
    board = await readBoard(page);
    if (board.gameOver) {
      return board.won;
    }

    let moved = false;

    for (const cell of board.cells) {
      if (!cell.revealed || cell.number === null || cell.number === 0) {
        continue;
      }

      const neighbors = getNeighbors(cell.row, cell.col, board.side);
      const hidden = [];
      const flagged = [];

      for (const [r, c] of neighbors) {
        const neighbor = board.cells.find((entry) => entry.row === r && entry.col === c);
        if (!neighbor || neighbor.revealed) {
          continue;
        }
        if (neighbor.flagged) {
          flagged.push([r, c]);
        } else {
          hidden.push([r, c]);
        }
      }

      if (hidden.length > 0 && hidden.length + flagged.length === cell.number) {
        for (const [r, c] of hidden) {
          await flagCell(page, r, c);
          moved = true;
        }
      } else if (hidden.length > 0 && flagged.length === cell.number) {
        for (const [r, c] of hidden) {
          await clickCell(page, r, c);
          moved = true;
        }
      }
    }

    if (!moved) {
      for (const cell of board.cells) {
        if (!cell.revealed) {
          continue;
        }
        const neighbors = getNeighbors(cell.row, cell.col, board.side);
        for (const [r, c] of neighbors) {
          const neighbor = board.cells.find((entry) => entry.row === r && entry.col === c);
          if (neighbor && !neighbor.revealed && !neighbor.flagged) {
            await clickCell(page, r, c);
            moved = true;
            break;
          }
        }
        if (moved) {
          break;
        }
      }
    }

    if (!moved) {
      break;
    }
  }

  board = await readBoard(page);
  return board.won;
}

async function configureBoard(page, size, density) {
  await page.locator("#sizeSlider").fill(String(size));
  await page.locator("#densitySlider").fill(String(density));
  await page.locator("#newGameBtn").click();
  await page.waitForTimeout(400);
}

async function waitForWinBanner(page) {
  await page.locator("#resultBannerTitle", { hasText: "Well done" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
}

async function playWinningGame(page, gameNumber) {
  await configureBoard(page, 8, 12);
  const won = await solveCurrentGame(page);
  if (!won) {
    throw new Error(`Game ${gameNumber} did not finish with a win`);
  }
  await waitForWinBanner(page);
}

async function main() {
  const server = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    recordVideo: {
      dir: "/opt/cursor/artifacts",
      size: { width: 1280, height: 900 },
    },
  });
  const page = await context.newPage();

  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    await playWinningGame(page, 1);
    await page.locator("#resultBannerNewGameBtn").click();
    await page.waitForTimeout(800);

    await playWinningGame(page, 2);
    await page.waitForTimeout(1500);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.locator(".top-scores-title").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();
    server.close();

    if (video) {
      const recordedPath = await video.path();
      await rename(recordedPath, artifactPath);
      console.log(`Saved demo video to ${artifactPath}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
