const MIN_SIZE = 5;
const MAX_SIZE = 64;
const MIN_DENSITY = 10;
const MAX_DENSITY = 25;
const TOP_SCORES_LIMIT = 5;
const SCORES_STORAGE_KEY = "minesweeper-top-scores";

const boardEl = document.getElementById("board");
const newGameBtn = document.getElementById("newGameBtn");
const flagModeBtn = document.getElementById("flagModeBtn");
const sizeSlider = document.getElementById("sizeSlider");
const densitySlider = document.getElementById("densitySlider");
const sizeValueEl = document.getElementById("sizeValue");
const densityValueEl = document.getElementById("densityValue");
const mineCounterEl = document.getElementById("mineCounter");
const timerEl = document.getElementById("timer");
const resultBannerEl = document.getElementById("resultBanner");
const resultBannerLogoEl = document.getElementById("resultBannerLogo");
const resultBannerTitleEl = document.getElementById("resultBannerTitle");
const resultBannerNewGameBtn = document.getElementById("resultBannerNewGameBtn");
const resultBannerScoreEl = document.getElementById("resultBannerScore");
const topScoresListEl = document.getElementById("topScoresList");
const cellTemplate = document.getElementById("cellTemplate");

const flagIconPath = "./assets/cursor-logo.svg";
const mineIconPath = "./assets/bomb.svg";

let gameState = null;
let timerHandle = null;
let flagModeEnabled = false;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toCellKey(row, col) {
  return `${row}:${col}`;
}

function fromCellKey(key) {
  return key.split(":").map(Number);
}

function randomInt(maxExclusive) {
  return Math.floor(Math.random() * maxExclusive);
}

function updateControlLabels() {
  const size = clamp(Number(sizeSlider.value), MIN_SIZE, MAX_SIZE);
  const density = clamp(Number(densitySlider.value), MIN_DENSITY, MAX_DENSITY);
  sizeValueEl.textContent = `${size}x${size}`;
  densityValueEl.textContent = `${density}%`;
}

function computeMineCount(size, densityPercent) {
  const cellCount = size * size;
  const mines = Math.floor((cellCount * densityPercent) / 100);
  return clamp(mines, 1, cellCount - 1);
}

function createCell(row, col) {
  return {
    row,
    col,
    isMine: false,
    isRevealed: false,
    isFlagged: false,
    adjacentMines: 0,
  };
}

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

function buildEmptyBoard(size) {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => createCell(row, col))
  );
}

function placeMines(board, mineCount, forbiddenRow, forbiddenCol) {
  const size = board.length;
  const forbiddenKeys = new Set(
    [toCellKey(forbiddenRow, forbiddenCol), ...getNeighbors(forbiddenRow, forbiddenCol, size).map(([r, c]) => toCellKey(r, c))]
  );
  const candidates = [];

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const key = toCellKey(r, c);
      if (!forbiddenKeys.has(key)) {
        candidates.push(key);
      }
    }
  }

  if (candidates.length < mineCount) {
    throw new Error("Not enough safe cells to place mines.");
  }

  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  for (let i = 0; i < mineCount; i += 1) {
    const [r, c] = fromCellKey(candidates[i]);
    board[r][c].isMine = true;
  }
}

function calculateAdjacency(board) {
  const size = board.length;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const cell = board[r][c];
      if (cell.isMine) {
        continue;
      }
      const neighbors = getNeighbors(r, c, size);
      cell.adjacentMines = neighbors.reduce(
        (count, [nr, nc]) => count + (board[nr][nc].isMine ? 1 : 0),
        0
      );
    }
  }
}

function createState(size, densityPercent) {
  const mineCount = computeMineCount(size, densityPercent);
  return {
    size,
    densityPercent,
    mineCount,
    board: buildEmptyBoard(size),
    gameOver: false,
    gameWon: false,
    firstClickDone: false,
    revealedCount: 0,
    flagsCount: 0,
    startedAtMs: null,
  };
}

function stopTimer() {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
}

function startTimer() {
  if (!gameState || gameState.startedAtMs === null || timerHandle) {
    return;
  }
  timerHandle = setInterval(() => {
    if (!gameState || gameState.startedAtMs === null) {
      return;
    }
    const elapsedSeconds = Math.floor((Date.now() - gameState.startedAtMs) / 1000);
    timerEl.textContent = `Time: ${elapsedSeconds}s`;
  }, 250);
}

function resetTimerDisplay() {
  timerEl.textContent = "Time: 0s";
}

function updateMineCounter() {
  if (!gameState) {
    mineCounterEl.textContent = "Mines: 0 left of 0";
    return;
  }
  const remaining = Math.max(0, gameState.mineCount - gameState.flagsCount);
  mineCounterEl.textContent = `Mines: ${remaining} left of ${gameState.mineCount}`;
}

function updateFlagModeButton() {
  flagModeBtn.textContent = flagModeEnabled ? "🚩 Flag Mode: ON" : "🚩 Flag Mode: OFF";
  flagModeBtn.setAttribute("aria-pressed", String(flagModeEnabled));
}

function getElapsedSeconds() {
  if (!gameState || gameState.startedAtMs === null) {
    return 0;
  }
  return Math.floor((Date.now() - gameState.startedAtMs) / 1000);
}

function calculateScore() {
  if (!gameState) {
    return 0;
  }
  const elapsedSeconds = Math.max(1, getElapsedSeconds());
  const difficulty = gameState.size * gameState.size * gameState.densityPercent;
  return Math.round((difficulty / elapsedSeconds) * 10);
}

function loadTopScores() {
  try {
    const raw = localStorage.getItem(SCORES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((entry) => typeof entry.score === "number" && typeof entry.date === "string")
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_SCORES_LIMIT);
  } catch {
    return [];
  }
}

function saveTopScore(score) {
  const entry = {
    score,
    date: new Date().toISOString(),
  };
  const scores = [...loadTopScores(), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_SCORES_LIMIT);
  localStorage.setItem(SCORES_STORAGE_KEY, JSON.stringify(scores));
  return scores;
}

function formatScoreDate(isoDate) {
  return new Date(isoDate).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function renderTopScores() {
  if (!topScoresListEl) {
    return;
  }
  const scores = loadTopScores();
  topScoresListEl.replaceChildren();

  if (scores.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "top-scores-empty";
    emptyItem.textContent = "No scores yet. Win a game to get started.";
    topScoresListEl.append(emptyItem);
    return;
  }

  scores.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "top-score-item";

    const rank = document.createElement("span");
    rank.className = "top-score-rank";
    rank.textContent = `#${index + 1}`;

    const value = document.createElement("span");
    value.className = "top-score-value";
    value.textContent = String(entry.score);

    const date = document.createElement("span");
    date.className = "top-score-date";
    date.textContent = formatScoreDate(entry.date);

    item.append(rank, value, date);
    topScoresListEl.append(item);
  });
}

function hideResultBanner() {
  resultBannerEl.classList.add("hidden");
  if (resultBannerScoreEl) {
    resultBannerScoreEl.textContent = "";
    resultBannerScoreEl.classList.add("hidden");
  }
}

function showResultBanner({ title, logoPath, logoAlt, score = null }) {
  resultBannerTitleEl.textContent = title;
  resultBannerLogoEl.src = logoPath;
  resultBannerLogoEl.alt = logoAlt;
  if (resultBannerScoreEl) {
    if (score === null) {
      resultBannerScoreEl.textContent = "";
      resultBannerScoreEl.classList.add("hidden");
    } else {
      resultBannerScoreEl.textContent = `Score: ${score}`;
      resultBannerScoreEl.classList.remove("hidden");
    }
  }
  resultBannerEl.classList.remove("hidden");
}

function clearBoardDom() {
  boardEl.replaceChildren();
}

function createCellButton(cell) {
  const button = cellTemplate.content.firstElementChild.cloneNode(true);
  button.dataset.row = String(cell.row);
  button.dataset.col = String(cell.col);
  button.addEventListener("click", onCellClick);
  return button;
}

function renderBoard() {
  if (!gameState) {
    return;
  }

  clearBoardDom();
  boardEl.style.gridTemplateColumns = `repeat(${gameState.size}, 28px)`;
  boardEl.style.gridTemplateRows = `repeat(${gameState.size}, 28px)`;

  const fragment = document.createDocumentFragment();
  for (let r = 0; r < gameState.size; r += 1) {
    for (let c = 0; c < gameState.size; c += 1) {
      const cell = gameState.board[r][c];
      const button = createCellButton(cell);
      fragment.append(button);
    }
  }
  boardEl.append(fragment);
  refreshBoardDom();
}

function createIcon(src, alt, extraClass = "") {
  const icon = document.createElement("img");
  icon.className = extraClass ? `icon ${extraClass}` : "icon";
  icon.src = src;
  icon.alt = alt;
  return icon;
}

function setCellContent(button, cell) {
  button.textContent = "";
  button.className = "cell";
  button.classList.toggle("revealed", cell.isRevealed);
  button.classList.toggle("mine", cell.isMine);
  button.classList.toggle("flagged", cell.isFlagged);
  button.classList.toggle("game-over", gameState?.gameOver ?? false);

  if (cell.isFlagged && !cell.isRevealed) {
    button.append(createIcon(flagIconPath, "Flag", "icon-flag"));
    button.ariaLabel = "Flagged cell";
    return;
  }

  if (!cell.isRevealed) {
    button.ariaLabel = "Hidden cell";
    return;
  }

  if (cell.isMine) {
    button.append(createIcon(mineIconPath, "Mine", "icon-mine"));
    button.ariaLabel = "Mine";
    return;
  }

  if (cell.adjacentMines > 0) {
    button.textContent = String(cell.adjacentMines);
    button.classList.add(`n${cell.adjacentMines}`);
    button.ariaLabel = `${cell.adjacentMines} adjacent mines`;
  } else {
    button.ariaLabel = "Empty cell";
  }
}

function refreshBoardDom() {
  if (!gameState) {
    return;
  }
  const buttons = boardEl.querySelectorAll(".cell");
  buttons.forEach((button) => {
    const row = Number(button.dataset.row);
    const col = Number(button.dataset.col);
    const cell = gameState.board[row][col];
    button.disabled = gameState.gameOver || cell.isRevealed;
    setCellContent(button, cell);
  });
}

function ensureBoardSeeded(firstRow, firstCol) {
  if (!gameState || gameState.firstClickDone) {
    return;
  }
  placeMines(gameState.board, gameState.mineCount, firstRow, firstCol);
  calculateAdjacency(gameState.board);
  gameState.firstClickDone = true;
  gameState.startedAtMs = Date.now();
  startTimer();
}

function revealCell(row, col) {
  if (!gameState) {
    return;
  }
  const cell = gameState.board[row][col];
  if (cell.isRevealed || cell.isFlagged) {
    return;
  }
  cell.isRevealed = true;
  gameState.revealedCount += 1;

  if (cell.adjacentMines !== 0 || cell.isMine) {
    return;
  }

  const queue = [[row, col]];
  while (queue.length > 0) {
    const [currentRow, currentCol] = queue.shift();
    const neighbors = getNeighbors(currentRow, currentCol, gameState.size);
    for (const [nr, nc] of neighbors) {
      const neighbor = gameState.board[nr][nc];
      if (neighbor.isRevealed || neighbor.isFlagged || neighbor.isMine) {
        continue;
      }
      neighbor.isRevealed = true;
      gameState.revealedCount += 1;
      if (neighbor.adjacentMines === 0) {
        queue.push([nr, nc]);
      }
    }
  }
}

function revealAllMines() {
  if (!gameState) {
    return;
  }
  for (let r = 0; r < gameState.size; r += 1) {
    for (let c = 0; c < gameState.size; c += 1) {
      const cell = gameState.board[r][c];
      if (cell.isMine) {
        cell.isRevealed = true;
      }
    }
  }
}

function checkWinCondition() {
  if (!gameState) {
    return false;
  }
  const targetRevealed = gameState.size * gameState.size - gameState.mineCount;
  return gameState.revealedCount >= targetRevealed;
}

function endGame(won) {
  if (!gameState) {
    return;
  }
  gameState.gameOver = true;
  gameState.gameWon = won;
  if (!won) {
    revealAllMines();
    newGameBtn.textContent = "😵 New Game";
    showResultBanner({
      title: "Game over",
      logoPath: mineIconPath,
      logoAlt: "Bomb icon",
    });
  } else {
    newGameBtn.textContent = "😎 New Game";
    const score = calculateScore();
    saveTopScore(score);
    renderTopScores();
    const nextSize = clamp(Number(sizeSlider.value) + 1, MIN_SIZE, MAX_SIZE);
    sizeSlider.value = String(nextSize);
    updateControlLabels();
    showResultBanner({
      title: "Well done",
      logoPath: flagIconPath,
      logoAlt: "Cursor logo",
      score,
    });
  }
  stopTimer();
  refreshBoardDom();
}

function toggleFlag(row, col) {
  if (!gameState) {
    return;
  }
  const cell = gameState.board[row][col];
  if (cell.isRevealed) {
    return;
  }
  cell.isFlagged = !cell.isFlagged;
  gameState.flagsCount += cell.isFlagged ? 1 : -1;
  updateMineCounter();
  refreshBoardDom();
}

function onCellClick(event) {
  if (!gameState || gameState.gameOver) {
    return;
  }
  const target = event.currentTarget;
  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);

  if (event.shiftKey || flagModeEnabled) {
    toggleFlag(row, col);
    return;
  }

  const cell = gameState.board[row][col];
  if (cell.isFlagged) {
    return;
  }

  ensureBoardSeeded(row, col);
  revealCell(row, col);
  if (cell.isMine) {
    endGame(false);
    return;
  }

  if (checkWinCondition()) {
    endGame(true);
    return;
  }
  refreshBoardDom();
}

function newGame() {
  stopTimer();
  const size = clamp(Number(sizeSlider.value), MIN_SIZE, MAX_SIZE);
  const density = clamp(Number(densitySlider.value), MIN_DENSITY, MAX_DENSITY);
  gameState = createState(size, density);
  flagModeEnabled = false;
  updateFlagModeButton();
  hideResultBanner();
  updateControlLabels();
  newGameBtn.textContent = "🙂 New Game";
  resetTimerDisplay();
  updateMineCounter();
  renderBoard();
}

newGameBtn.addEventListener("click", newGame);
const toggleFlagMode = () => {
  flagModeEnabled = !flagModeEnabled;
  updateFlagModeButton();
};

flagModeBtn.addEventListener("click", toggleFlagMode);
resultBannerNewGameBtn.addEventListener("click", newGame);
sizeSlider.addEventListener("input", updateControlLabels);
densitySlider.addEventListener("input", updateControlLabels);
sizeSlider.addEventListener("change", newGame);
densitySlider.addEventListener("change", newGame);

updateControlLabels();
updateFlagModeButton();
renderTopScores();
newGame();
