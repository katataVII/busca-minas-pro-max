/* =====================================================================
   BUSCAMINAS TÁCTICO — LÓGICA DEL JUEGO
   JavaScript puro, sin librerías externas.
   ===================================================================== */

'use strict';

// =====================================================================
// 1. CONFIGURACIÓN DE DIFICULTADES
// =====================================================================
const DIFFICULTIES = {
  easy:   { rows: 8,  cols: 8,  mines: 10, label: 'Fácil',  bonus: 150 },
  medium: { rows: 10, cols: 10, mines: 15, label: 'Medio',  bonus: 300 },
  hard:   { rows: 12, cols: 12, mines: 25, label: 'Difícil', bonus: 500 },
};

const POINTS_PER_CELL  = 10;  // puntos por casilla segura revelada
const MAX_LEADERBOARD  = 5;   // entradas máximas en el ranking

// =====================================================================
// 2. ESTADO GLOBAL DEL JUEGO
// =====================================================================
let state = {
  difficulty: 'easy',     // dificultad activa
  grid: [],               // matriz de celdas
  rows: 0,
  cols: 0,
  totalMines: 0,
  minesLeft: 0,           // minas no marcadas
  revealed: 0,            // casillas seguras reveladas
  safeCells: 0,           // total casillas sin mina
  firstClick: true,       // primera jugada (para colocar minas después)
  gameOver: false,
  gameWon: false,
  timerInterval: null,
  elapsedSeconds: 0,
  score: 0,               // puntaje sesión actual
  soundEnabled: true,
};

// =====================================================================
// 3. REFERENCIAS AL DOM
// =====================================================================
const $ = id => document.getElementById(id);

const DOM = {
  board:         $('board'),
  minesLeft:     $('minesLeft'),
  timer:         $('timer'),
  score:         $('score'),
  record:        $('record'),
  faceIcon:      $('faceIcon'),
  restartBtn:    $('restartBtn'),
  soundToggle:   $('soundToggle'),
  themeToggle:   $('themeToggle'),
  patternCanvas: $('patternCanvas'),
  patternStatus: $('patternStatus'),
  patternHistory:$('patternHistory'),
  statWins:      $('statWins'),
  statLosses:    $('statLosses'),
  leaderboard:   $('leaderboard'),
  modalOverlay:  $('modalOverlay'),
  modalIcon:     $('modalIcon'),
  modalTitle:    $('modalTitle'),
  modalMessage:  $('modalMessage'),
  modalScore:    $('modalScore'),
  modalActionBtn:$('modalActionBtn'),
  diffBtns:      document.querySelectorAll('.diff-btn'),
};

// =====================================================================
// 4. PERSISTENCIA (localStorage)
// =====================================================================
const Storage = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};

// Claves de almacenamiento
const KEYS = {
  record:      'bm_record',
  leaderboard: 'bm_leaderboard',
  wins:        'bm_wins',
  losses:      'bm_losses',
  theme:       'bm_theme',
  sound:       'bm_sound',
  patHistory:  'bm_patHistory',
};

// =====================================================================
// 5. MOTOR DE SONIDO (Web Audio API, sin archivos externos)
// =====================================================================
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

/**
 * Reproduce un tono sintético breve.
 * @param {string} type - 'click' | 'flag' | 'win' | 'lose'
 */
function playSound(type) {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case 'click':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start(); osc.stop(ctx.currentTime + 0.12);
        break;

      case 'flag':
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.setValueAtTime(900, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
        break;

      case 'cascade':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.07, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.start(); osc.stop(ctx.currentTime + 0.22);
        break;

      case 'win': {
        // Melodía de victoria (tres notas)
        const notes = [523, 659, 784];
        notes.forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.14);
          g.gain.setValueAtTime(0, ctx.currentTime + i * 0.14);
          g.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.14 + 0.03);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.14 + 0.25);
          o.start(ctx.currentTime + i * 0.14);
          o.stop(ctx.currentTime + i * 0.14 + 0.25);
        });
        break;
      }

      case 'lose': {
        // Descenso de tono para indicar derrota
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
        osc.start(); osc.stop(ctx.currentTime + 0.65);
        break;
      }
    }
  } catch (_) { /* El navegador puede bloquear audio sin interacción */ }
}

// =====================================================================
// 6. UTILIDADES
// =====================================================================

/** Formatea un número como cadena de 3 dígitos con ceros a la izquierda. */
function pad3(n) {
  return String(Math.max(0, Math.min(999, n))).padStart(3, '0');
}

/** Devuelve vecinos válidos de (r, c) en la cuadrícula. */
function neighbors(r, c) {
  const result = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols) {
        result.push([nr, nc]);
      }
    }
  }
  return result;
}

// =====================================================================
// 7. INICIALIZACIÓN Y CONSTRUCCIÓN DEL TABLERO
// =====================================================================

/**
 * Crea la cuadrícula vacía (sin minas aún).
 * Las minas se colocan después del primer clic para evitar que el
 * jugador pierda en la primera jugada.
 */
function createEmptyGrid(rows, cols) {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      r, c,
      mine: false,
      revealed: false,
      flagged: false,
      adjacentMines: 0,
    }))
  );
}

/**
 * Coloca las minas en posiciones aleatorias, evitando la celda
 * clickeada y sus vecinos (para que el primer clic siempre sea seguro).
 */
function placeMines(avoidR, avoidC) {
  const { rows, cols, totalMines } = state;
  const safe = new Set();

  // Excluir la celda inicial y sus 8 vecinos
  safe.add(`${avoidR},${avoidC}`);
  neighbors(avoidR, avoidC).forEach(([r, c]) => safe.add(`${r},${c}`));

  // Recopilar candidatos y mezclar (Fisher-Yates)
  const candidates = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!safe.has(`${r},${c}`)) candidates.push([r, c]);

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  // Colocar minas
  candidates.slice(0, totalMines).forEach(([r, c]) => {
    state.grid[r][c].mine = true;
  });

  // Calcular contador de minas adyacentes para cada celda segura
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!state.grid[r][c].mine) {
        state.grid[r][c].adjacentMines =
          neighbors(r, c).filter(([nr, nc]) => state.grid[nr][nc].mine).length;
      }
    }
  }
}

/**
 * Inicializa un nuevo juego con la dificultad activa.
 * @param {boolean} keepScore - si es true, no reinicia el puntaje de sesión.
 */
function initGame(keepScore = false) {
  const diff = DIFFICULTIES[state.difficulty];

  // Detener temporizador anterior
  clearInterval(state.timerInterval);

  // Actualizar estado
  state.rows        = diff.rows;
  state.cols        = diff.cols;
  state.totalMines  = diff.mines;
  state.minesLeft   = diff.mines;
  state.revealed    = 0;
  state.safeCells   = diff.rows * diff.cols - diff.mines;
  state.firstClick  = true;
  state.gameOver    = false;
  state.gameWon     = false;
  state.elapsedSeconds = 0;
  state.grid        = createEmptyGrid(diff.rows, diff.cols);
  if (!keepScore) state.score = 0;

  // Resetear UI
  DOM.faceIcon.textContent  = '🙂';
  DOM.minesLeft.textContent = pad3(state.minesLeft);
  DOM.timer.textContent     = pad3(0);
  DOM.score.textContent     = state.score;
  updateRecord();
  updateStats();
  renderLeaderboard();
  renderBoard();
  renderPattern(null, 'in-progress');
  hideModal();
}

// =====================================================================
// 8. RENDERIZADO DEL TABLERO
// =====================================================================

/** Genera el DOM del tablero completo. */
function renderBoard() {
  const { rows, cols } = state;
  DOM.board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  DOM.board.innerHTML = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('aria-label', `Fila ${r + 1}, columna ${c + 1}`);

      // Clic izquierdo: revelar
      cell.addEventListener('click', onCellClick);
      // Clic derecho: bandera
      cell.addEventListener('contextmenu', onCellRightClick);
      // Teclado: Enter o Espacio
      cell.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCellClick(e); }
        if (e.key === 'f' || e.key === 'F')      { e.preventDefault(); onCellRightClick(e); }
      });

      DOM.board.appendChild(cell);
    }
  }
}

/** Actualiza la apariencia visual de una celda individual. */
function updateCellDOM(r, c) {
  const cellData = state.grid[r][c];
  const el = getCellEl(r, c);
  if (!el) return;

  el.className = 'cell';
  el.textContent = '';
  el.setAttribute('aria-label', `Fila ${r + 1}, columna ${c + 1}`);

  if (cellData.revealed) {
    el.classList.add('revealed');
    if (cellData.mine) {
      el.classList.add('mine');
      el.textContent = '💣';
    } else if (cellData.adjacentMines > 0) {
      el.classList.add(`n${cellData.adjacentMines}`);
      el.textContent = cellData.adjacentMines;
      el.setAttribute('aria-label', `${cellData.adjacentMines} minas adyacentes`);
    }
  } else if (cellData.flagged) {
    el.classList.add('flagged');
    el.textContent = '🚩';
    el.setAttribute('aria-label', 'Bandera colocada');
  }
}

/** Referencia al elemento DOM de una celda. */
function getCellEl(r, c) {
  return DOM.board.querySelector(`[data-r="${r}"][data-c="${c}"]`);
}

// =====================================================================
// 9. LÓGICA DE JUEGO
// =====================================================================

/** Manejador de clic izquierdo en una celda. */
function onCellClick(e) {
  const el = e.currentTarget;
  const r = +el.dataset.r;
  const c = +el.dataset.c;
  const cellData = state.grid[r][c];

  if (state.gameOver || cellData.revealed || cellData.flagged) return;

  // Primer clic: colocar minas y arrancar el cronómetro
  if (state.firstClick) {
    state.firstClick = false;
    placeMines(r, c);
    renderPattern(state.grid, 'in-progress');
    startTimer();
  }

  playSound('click');
  revealCell(r, c);
  checkWin();
}

/** Manejador de clic derecho (bandera). */
function onCellRightClick(e) {
  e.preventDefault();
  const el = e.currentTarget;
  const r = +el.dataset.r;
  const c = +el.dataset.c;
  const cellData = state.grid[r][c];

  if (state.gameOver || cellData.revealed) return;

  cellData.flagged = !cellData.flagged;
  state.minesLeft += cellData.flagged ? -1 : 1;
  DOM.minesLeft.textContent = pad3(state.minesLeft);

  playSound('flag');
  updateCellDOM(r, c);
}

/**
 * Revela una celda. Si no tiene minas adyacentes, se expande
 * automáticamente (efecto cascada) usando BFS.
 */
function revealCell(startR, startC) {
  const queue  = [[startR, startC]];
  const visited = new Set();
  let cascadeCount = 0;

  while (queue.length) {
    const [r, c] = queue.shift();
    const key = `${r},${c}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const cellData = state.grid[r][c];
    if (cellData.revealed || cellData.flagged) continue;

    cellData.revealed = true;

    if (cellData.mine) {
      // ¡BOOM!
      triggerGameOver(r, c);
      return;
    }

    state.revealed++;
    state.score += POINTS_PER_CELL;
    updateCellDOM(r, c);
    cascadeCount++;

    // Expandir si no hay minas adyacentes
    if (cellData.adjacentMines === 0) {
      neighbors(r, c).forEach(([nr, nc]) => {
        if (!state.grid[nr][nc].revealed && !state.grid[nr][nc].flagged) {
          queue.push([nr, nc]);
        }
      });
    }
  }

  if (cascadeCount > 1) playSound('cascade');
  DOM.score.textContent = state.score;
}

/** Verifica si el jugador ha ganado. */
function checkWin() {
  if (state.revealed === state.safeCells) {
    triggerWin();
  }
}

/** Activa el estado de victoria. */
function triggerWin() {
  clearInterval(state.timerInterval);
  state.gameOver = true;
  state.gameWon  = true;

  const diff  = DIFFICULTIES[state.difficulty];
  const bonus = diff.bonus + Math.max(0, (300 - state.elapsedSeconds) * 2);
  state.score += bonus;
  DOM.score.textContent = state.score;

  // Marcar todas las minas con bandera automáticamente
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.grid[r][c].mine && !state.grid[r][c].flagged) {
        state.grid[r][c].flagged = true;
        updateCellDOM(r, c);
      }
    }
  }

  DOM.faceIcon.textContent = '😎';
  DOM.minesLeft.textContent = pad3(0);

  saveScore(state.score);
  saveStats('win');
  playSound('win');
  renderPattern(state.grid, 'win');
  addPatternToHistory(state.grid, 'win');

  // Mostrar modal tras breve demora para que se vean las banderas
  setTimeout(() => {
    showModal(
      '🏆', '¡Victoria!',
      `Despejaste el tablero en ${state.elapsedSeconds}s · Bono: +${bonus} pts`,
      state.score, '¡Siguiente ronda!'
    );
  }, 600);
}

/** Activa el estado de derrota. */
function triggerGameOver(explodedR, explodedC) {
  clearInterval(state.timerInterval);
  state.gameOver = true;

  DOM.faceIcon.textContent = '😵';

  // Revelar todas las minas
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.grid[r][c];
      if (cell.mine) {
        cell.revealed = true;
        const el = getCellEl(r, c);
        if (el) {
          el.classList.add('revealed', 'mine');
          el.textContent = '💣';
          if (r === explodedR && c === explodedC) {
            el.classList.add('exploded');
          } else {
            el.classList.add('safe-reveal');
          }
        }
      }
      // Marcar banderas incorrectas
      if (cell.flagged && !cell.mine) {
        const el = getCellEl(r, c);
        if (el) { el.textContent = '❌'; el.classList.add('wrong-flag'); }
      }
    }
  }

  saveStats('loss');
  playSound('lose');
  renderPattern(state.grid, 'loss');
  addPatternToHistory(state.grid, 'loss');

  setTimeout(() => {
    showModal(
      '💥', '¡Boom!',
      'Pisaste una mina. Más suerte en el siguiente intento.',
      state.score, 'Intentar de nuevo'
    );
  }, 800);
}

// =====================================================================
// 10. TEMPORIZADOR
// =====================================================================

function startTimer() {
  state.elapsedSeconds = 0;
  DOM.timer.textContent = pad3(0);
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    state.elapsedSeconds++;
    DOM.timer.textContent = pad3(state.elapsedSeconds);
    if (state.elapsedSeconds >= 999) clearInterval(state.timerInterval);
  }, 1000);
}

// =====================================================================
// 11. PUNTAJE Y PERSISTENCIA
// =====================================================================

/** Actualiza el récord si el score actual lo supera. */
function saveScore(score) {
  const record = Storage.get(KEYS.record, 0);
  if (score > record) {
    Storage.set(KEYS.record, score);
    updateRecord();
  }

  // Tabla de mejores puntuaciones
  const board = Storage.get(KEYS.leaderboard, []);
  board.push({ score, diff: DIFFICULTIES[state.difficulty].label, date: new Date().toLocaleDateString('es') });
  board.sort((a, b) => b.score - a.score);
  Storage.set(KEYS.leaderboard, board.slice(0, MAX_LEADERBOARD));
  renderLeaderboard();
}

function updateRecord() {
  DOM.record.textContent = Storage.get(KEYS.record, 0);
}

function saveStats(result) {
  if (result === 'win') {
    const w = Storage.get(KEYS.wins, 0) + 1;
    Storage.set(KEYS.wins, w);
  } else {
    const l = Storage.get(KEYS.losses, 0) + 1;
    Storage.set(KEYS.losses, l);
  }
  updateStats();
}

function updateStats() {
  DOM.statWins.textContent   = Storage.get(KEYS.wins, 0);
  DOM.statLosses.textContent = Storage.get(KEYS.losses, 0);
}

function renderLeaderboard() {
  const board = Storage.get(KEYS.leaderboard, []);
  if (!board.length) {
    DOM.leaderboard.innerHTML = '<li class="empty">Sin puntuaciones aún</li>';
    return;
  }
  DOM.leaderboard.innerHTML = board
    .map(entry => `<li>${entry.diff} · ${entry.date} <span>${entry.score} pts</span></li>`)
    .join('');
}

// =====================================================================
// 12. VISUALIZADOR DE PATRONES DE BOMBAS (Canvas)
// =====================================================================

/**
 * Dibuja una miniatura del patrón de minas en el canvas indicado.
 * @param {HTMLCanvasElement} canvas
 * @param {Array} grid - cuadrícula del juego (puede ser null antes del 1er clic)
 * @param {string} status - 'in-progress' | 'win' | 'loss'
 * @param {number} rows
 * @param {number} cols
 */
function drawPattern(canvas, grid, status, rows, cols) {
  if (!canvas) return;
  const size = canvas.width;
  const ctx  = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  // Fondo
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--cell-revealed').trim() || '#10141d';
  ctx.fillRect(0, 0, size, size);

  if (!grid) {
    // Sin datos aún
    ctx.fillStyle = '#555';
    ctx.font = `${size * 0.15}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', size / 2, size / 2);
    return;
  }

  const cellW = size / cols;
  const cellH = size / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      const x = c * cellW;
      const y = r * cellH;

      if (cell.mine) {
        // Color según resultado
        if (status === 'win')  ctx.fillStyle = '#36e2c4';
        else if (status === 'loss') ctx.fillStyle = '#ff5d5d';
        else ctx.fillStyle = '#ffb454';
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
      }
    }
  }
}

/** Actualiza el canvas principal de patrón. */
function renderPattern(grid, status) {
  const canvas = DOM.patternCanvas;
  const { rows, cols } = state;
  drawPattern(canvas, grid, status, rows, cols);

  const labels = { 'in-progress': 'En juego…', 'win': '¡Victoria!', 'loss': 'Detonado' };
  DOM.patternStatus.textContent = labels[status] || '';
  DOM.patternStatus.style.color =
    status === 'win'  ? 'var(--accent-teal)' :
    status === 'loss' ? 'var(--accent-red)'  : 'var(--accent-amber)';
}

/** Añade un thumbnail al historial de patrones. */
function addPatternToHistory(grid, result) {
  const { rows, cols } = state;

  // Guardar en localStorage (hasta 5 históricos)
  const history = Storage.get(KEYS.patHistory, []);
  const snapshot = grid.map(row => row.map(cell => cell.mine));
  history.unshift({ snapshot, rows, cols, result });
  Storage.set(KEYS.patHistory, history.slice(0, 5));

  renderPatternHistory();
}

/** Renderiza el historial de patrones como miniaturas. */
function renderPatternHistory() {
  const history = Storage.get(KEYS.patHistory, []);
  DOM.patternHistory.innerHTML = '';

  history.forEach((entry, i) => {
    const cvs = document.createElement('canvas');
    cvs.width  = 42;
    cvs.height = 42;
    cvs.className = `pattern-thumb ${entry.result}`;
    cvs.title = `Ronda ${history.length - i} — ${entry.result === 'win' ? '¡Victoria!' : 'Derrota'}`;

    // Reconstruir la cuadrícula mínima para dibujar
    const miniGrid = entry.snapshot.map((row, r) =>
      row.map((mine, c) => ({ mine, r, c }))
    );
    drawPattern(cvs, miniGrid, entry.result, entry.rows, entry.cols);

    // Al hacer clic, mostrar ese patrón en el canvas grande
    cvs.addEventListener('click', () => {
      drawPattern(DOM.patternCanvas, miniGrid, entry.result, entry.rows, entry.cols);
      DOM.patternStatus.textContent = entry.result === 'win' ? '¡Victoria!' : 'Derrota';
    });

    DOM.patternHistory.appendChild(cvs);
  });
}

// =====================================================================
// 13. MODAL
// =====================================================================

function showModal(icon, title, message, score, btnLabel) {
  DOM.modalIcon.textContent    = icon;
  DOM.modalTitle.textContent   = title;
  DOM.modalMessage.textContent = message;
  DOM.modalScore.textContent   = score;
  DOM.modalActionBtn.textContent = btnLabel;
  DOM.modalOverlay.classList.remove('hidden');
}

function hideModal() {
  DOM.modalOverlay.classList.add('hidden');
}

// =====================================================================
// 14. TEMA CLARO / OSCURO
// =====================================================================

function applyTheme(dark) {
  document.body.classList.toggle('light-mode', !dark);
  DOM.themeToggle.textContent = dark ? '🌙' : '☀️';
  Storage.set(KEYS.theme, dark);
}

function toggleTheme() {
  const isDark = !document.body.classList.contains('light-mode');
  applyTheme(!isDark);
  // Redibujar canvas con nuevos colores CSS
  setTimeout(() => renderPattern(state.firstClick ? null : state.grid,
    state.gameWon ? 'win' : state.gameOver ? 'loss' : 'in-progress'), 50);
}

// =====================================================================
// 15. SONIDO
// =====================================================================

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  DOM.soundToggle.textContent = state.soundEnabled ? '🔊' : '🔇';
  Storage.set(KEYS.sound, state.soundEnabled);
}

// =====================================================================
// 16. REGISTRO DE EVENTOS GLOBALES
// =====================================================================

function bindEvents() {
  // Reiniciar partida
  DOM.restartBtn.addEventListener('click', () => {
    playSound('click');
    initGame(false);
  });

  // Botón del modal
  DOM.modalActionBtn.addEventListener('click', () => {
    hideModal();
    // Si ganó, mantener puntaje acumulado; si perdió, reiniciar
    initGame(state.gameWon);
  });

  // Cerrar modal al hacer clic fuera del recuadro
  DOM.modalOverlay.addEventListener('click', e => {
    if (e.target === DOM.modalOverlay) hideModal();
  });

  // Selector de dificultad
  DOM.diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.diffBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.difficulty = btn.dataset.difficulty;
      initGame(false);
    });
  });

  // Sonido
  DOM.soundToggle.addEventListener('click', toggleSound);

  // Tema
  DOM.themeToggle.addEventListener('click', toggleTheme);

  // Prevenir menú contextual en el tablero
  DOM.board.addEventListener('contextmenu', e => e.preventDefault());
}

// =====================================================================
// 17. ENTRADA: ARRANQUE DEL JUEGO
// =====================================================================

function bootstrap() {
  // Restaurar preferencias guardadas
  const savedDark  = Storage.get(KEYS.theme, true);
  const savedSound = Storage.get(KEYS.sound, true);
  state.soundEnabled = savedSound;
  applyTheme(savedDark);
  DOM.soundToggle.textContent = savedSound ? '🔊' : '🔇';

  // Marcar botón de dificultad guardada (por defecto: 'easy')
  DOM.diffBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.difficulty === state.difficulty);
  });

  bindEvents();
  renderPatternHistory();
  initGame(false);
}

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', bootstrap);
