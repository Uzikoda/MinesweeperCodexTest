const boardElement = document.getElementById("board");
const mineCountElement = document.getElementById("mine-count");
const flagCountElement = document.getElementById("flag-count");
const timerElement = document.getElementById("timer");
const messageElement = document.getElementById("game-message");
const difficultySelect = document.getElementById("difficulty");
const customSizeX = document.getElementById("custom-size");
const customSizeY = document.getElementById("custom-size-y");
const customMines = document.getElementById("custom-mines");
const newGameButton = document.getElementById("new-game");

const difficultySettings = {
  easy: { rows: 8, cols: 8, mines: 10 },
  medium: { rows: 12, cols: 12, mines: 24 },
  hard: { rows: 16, cols: 16, mines: 40 },
};

let board = [];
let gameOver = false;
let revealedCount = 0;
let flaggedCount = 0;
let mineTotal = 0;
let timerInterval = null;
let seconds = 0;
let firstClick = true;

const numberColors = {
  1: "#2563eb",
  2: "#16a34a",
  3: "#dc2626",
  4: "#7c3aed",
  5: "#ea580c",
  6: "#0891b2",
  7: "#1e293b",
  8: "#6b7280",
};

function buildEmptyBoard(rows, cols) {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      row,
      col,
      mine: false,
      adjacent: 0,
      revealed: false,
      flagged: false,
    }))
  );
}

function placeMines(rows, cols, mines, safeCell) {
  const positions = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (safeCell && safeCell.row === r && safeCell.col === c) {
        continue;
      }
      positions.push({ row: r, col: c });
    }
  }

  for (let i = positions.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  return positions.slice(0, mines);
}

function countAdjacentMines(rows, cols, boardData) {
  const directions = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (boardData[r][c].mine) {
        continue;
      }
      let count = 0;
      directions.forEach(([dr, dc]) => {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          if (boardData[nr][nc].mine) {
            count += 1;
          }
        }
      });
      boardData[r][c].adjacent = count;
    }
  }
}

function renderBoard(rows, cols) {
  boardElement.innerHTML = "";
  boardElement.style.gridTemplateColumns = `repeat(${cols}, 34px)`;

  const fragment = document.createDocumentFragment();

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.setAttribute("aria-label", `Cell ${r + 1}, ${c + 1}`);
      cell.addEventListener("click", handleReveal);
      cell.addEventListener("contextmenu", handleFlag);
      cell.addEventListener("touchstart", handleTouchFlag, { passive: false });
      fragment.appendChild(cell);
    }
  }

  boardElement.appendChild(fragment);
}

function resetStatus() {
  revealedCount = 0;
  flaggedCount = 0;
  gameOver = false;
  firstClick = true;
  seconds = 0;
  stopTimer();
  timerElement.textContent = "0";
  messageElement.textContent = "";
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    seconds += 1;
    timerElement.textContent = String(seconds);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateMineCounter() {
  mineCountElement.textContent = String(mineTotal);
  flagCountElement.textContent = String(flaggedCount);
}

function createGame(settings) {
  const rows = settings.rows;
  const cols = settings.cols;
  mineTotal = settings.mines;

  board = buildEmptyBoard(rows, cols);
  resetStatus();
  renderBoard(rows, cols);
  updateMineCounter();
}

function applyDifficulty() {
  const value = difficultySelect.value;
  const settings = difficultySettings[value];
  customSizeX.value = settings.rows;
  customSizeY.value = settings.cols;
  customMines.value = settings.mines;
  createGame(settings);
}

function setupCustomGame() {
  const rows = Math.max(6, Math.min(24, Number(customSizeX.value)));
  const cols = Math.max(6, Math.min(24, Number(customSizeY.value)));
  let mines = Math.max(5, Math.min(rows * cols - 1, Number(customMines.value)));
  if (mines >= rows * cols) {
    mines = rows * cols - 1;
  }

  customSizeX.value = rows;
  customSizeY.value = cols;
  customMines.value = mines;

  createGame({ rows, cols, mines });
}

function revealCell(cell) {
  if (cell.revealed || cell.flagged) return;
  cell.revealed = true;
  revealedCount += 1;

  const cellElement = document.querySelector(
    `.cell[data-row='${cell.row}'][data-col='${cell.col}']`
  );
  cellElement.classList.add("revealed");

  if (cell.mine) {
    cellElement.textContent = "💣";
    cellElement.classList.add("mine");
    return;
  }

  if (cell.adjacent > 0) {
    cellElement.textContent = cell.adjacent;
    cellElement.style.color = numberColors[cell.adjacent] || "#1f2937";
  }
}

function floodReveal(startCell) {
  const rows = board.length;
  const cols = board[0].length;
  const queue = [startCell];
  const visited = new Set();

  while (queue.length > 0) {
    const cell = queue.shift();
    const key = `${cell.row},${cell.col}`;
    if (visited.has(key)) continue;
    visited.add(key);

    revealCell(cell);

    if (cell.adjacent === 0 && !cell.mine) {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const nr = cell.row + dr;
          const nc = cell.col + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const neighbor = board[nr][nc];
            if (!neighbor.revealed && !neighbor.flagged) {
              queue.push(neighbor);
            }
          }
        }
      }
    }
  }
}

function revealAllMines() {
  board.forEach((row) => {
    row.forEach((cell) => {
      if (cell.mine) {
        revealCell(cell);
      }
    });
  });
}

function checkWin() {
  const totalCells = board.length * board[0].length;
  if (revealedCount === totalCells - mineTotal) {
    gameOver = true;
    stopTimer();
    messageElement.textContent = "You cleared the minefield! 🎉";
    boardElement.classList.add("won");
    document.querySelectorAll(".cell").forEach((cell) => {
      cell.classList.add("disabled");
    });
  }
}

function handleReveal(event) {
  if (gameOver) return;
  const cellElement = event.currentTarget;
  const row = Number(cellElement.dataset.row);
  const col = Number(cellElement.dataset.col);
  const cell = board[row][col];

  if (cell.flagged || cell.revealed) return;

  if (firstClick) {
    const minePositions = placeMines(board.length, board[0].length, mineTotal, cell);
    minePositions.forEach((pos) => {
      board[pos.row][pos.col].mine = true;
    });
    countAdjacentMines(board.length, board[0].length, board);
    firstClick = false;
    startTimer();
  }

  if (cell.mine) {
    revealCell(cell);
    gameOver = true;
    stopTimer();
    messageElement.textContent = "Boom! Try again.";
    revealAllMines();
    document.querySelectorAll(".cell").forEach((button) => {
      button.classList.add("disabled");
    });
    return;
  }

  if (cell.adjacent === 0) {
    floodReveal(cell);
  } else {
    revealCell(cell);
  }

  checkWin();
}

function handleFlag(event) {
  event.preventDefault();
  if (gameOver) return;
  const cellElement = event.currentTarget;
  const row = Number(cellElement.dataset.row);
  const col = Number(cellElement.dataset.col);
  const cell = board[row][col];

  if (cell.revealed) return;

  cell.flagged = !cell.flagged;
  if (cell.flagged) {
    cellElement.classList.add("flagged");
    cellElement.textContent = "🚩";
    flaggedCount += 1;
  } else {
    cellElement.classList.remove("flagged");
    cellElement.textContent = "";
    flaggedCount -= 1;
  }

  updateMineCounter();
}

let touchTimer = null;
function handleTouchFlag(event) {
  if (gameOver) return;
  event.preventDefault();
  const cellElement = event.currentTarget;
  touchTimer = setTimeout(() => {
    handleFlag({ currentTarget: cellElement, preventDefault: () => {} });
  }, 450);

  const cancel = () => {
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
    }
    cellElement.removeEventListener("touchend", cancel);
    cellElement.removeEventListener("touchmove", cancel);
    cellElement.removeEventListener("touchcancel", cancel);
  };

  cellElement.addEventListener("touchend", cancel);
  cellElement.addEventListener("touchmove", cancel);
  cellElement.addEventListener("touchcancel", cancel);
}

newGameButton.addEventListener("click", () => {
  setupCustomGame();
});

difficultySelect.addEventListener("change", applyDifficulty);

applyDifficulty();
