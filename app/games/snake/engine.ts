// Motor de Snake — creado desde cero siguiendo el contrato estándar
// (.claude/skills/nuevo-juego/engine-template.ts). Grid de 40x30 celdas de 20px
// sobre canvas 800x600. El tick de avance de la serpiente está desacoplado del
// rAF vía acumulador de tiempo (dt clamp 0.05s, patrón arkanoid/engine.ts).
// El atlas de frutas carga async desde /sprites/snake/fruits.png; mientras no
// carga, draw() usa un fallback de rect de color por fruta.

const W = 800;
const H = 600;
const CELL = 20;
const GRID_W = W / CELL; // 40
const GRID_H = H / CELL; // 30

const FRUIT_COMMON_SCORE = 10;
const FRUIT_RARE_SCORE = 30;
const FRUIT_RARE_CHANCE = 0.2;
const FRUITS_PER_LEVEL = 5;

const TICK_BASE = 0.15; // segundos por paso al nivel 1
const TICK_MIN = 0.05;
const TICK_LEVEL_FACTOR = 0.9; // se acorta el tick (acelera) por nivel

export interface SnakeCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface SnakeEngine {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
}

interface FruitFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Portado de references/source-assets/snake-assets/sprites.js — coordenadas
// dentro de fruits.png (hoja 3790x442, fila y=136-295, fondo transparente).
const FRUIT_ATLAS: Record<string, FruitFrame> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};

const FRUIT_NAMES = Object.keys(FRUIT_ATLAS);

const FALLBACK_COLORS = [
  "#f87171",
  "#fbbf24",
  "#a3e635",
  "#34d399",
  "#22d3ee",
  "#818cf8",
  "#e879f9",
];

interface Cell {
  x: number;
  y: number;
}

interface Fruit extends Cell {
  sprite: string;
  rare: boolean;
}

const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

export function initSnake(canvas: HTMLCanvasElement, cb: SnakeCallbacks): SnakeEngine {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas");
  const ctx: CanvasRenderingContext2D = ctx2d;

  // --- Input: edge-detect (justPressed) para encolar la próxima dirección sin permitir 180° ---
  const justPressed: Record<string, boolean> = {};

  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!heldKeys[e.code]) justPressed[e.code] = true;
    heldKeys[e.code] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    heldKeys[e.code] = false;
  };
  const heldKeys: Record<string, boolean> = {};

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // --- Carga async del atlas de frutas — no bloquea el arranque del rAF. Mientras
  //     `fruitsImgLoaded` sea false, draw() usa el fallback de rect de color. ---
  let fruitsImgLoaded = false;
  const fruitsImg = new Image();
  fruitsImg.onload = () => {
    fruitsImgLoaded = true;
  };
  fruitsImg.src = "/sprites/snake/fruits.png";

  // --- Estado del juego (dentro de la clausura, no global de módulo) ---
  let snake: Cell[] = [];
  let dir: Cell = { x: 1, y: 0 };
  let pendingDir: Cell = { x: 1, y: 0 };
  let growth = 0;
  let fruit: Fruit | null = null;
  let score = 0;
  let level = 1;
  let fruitsEaten = 0;
  let tickAcc = 0;
  let gameOver = false;

  let lastScore = -1;
  let lastLives = -1;
  let lastLevel = -1;
  let gameOverReported = false;

  function emitStats() {
    if (score !== lastScore) {
      lastScore = score;
      cb.onScore(score);
    }
    if (lastLives !== 1) {
      lastLives = 1;
      cb.onLives(1);
    }
    if (level !== lastLevel) {
      lastLevel = level;
      cb.onLevel(level);
    }
  }

  function tickInterval(): number {
    return Math.max(TICK_MIN, TICK_BASE * Math.pow(TICK_LEVEL_FACTOR, level - 1));
  }

  function randomEmptyCell(): Cell {
    let cell: Cell;
    do {
      cell = { x: Math.floor(Math.random() * GRID_W), y: Math.floor(Math.random() * GRID_H) };
    } while (snake.some((s) => s.x === cell.x && s.y === cell.y));
    return cell;
  }

  function spawnFruit() {
    const rare = Math.random() < FRUIT_RARE_CHANCE;
    const sprite = FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)];
    fruit = { ...randomEmptyCell(), sprite, rare };
  }

  function initState() {
    const cx = Math.floor(GRID_W / 2);
    const cy = Math.floor(GRID_H / 2);
    snake = [
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
      { x: cx - 3, y: cy },
    ];
    dir = { x: 1, y: 0 };
    pendingDir = { x: 1, y: 0 };
    growth = 0;
    score = 0;
    level = 1;
    fruitsEaten = 0;
    tickAcc = 0;
    gameOver = false;
    gameOverReported = false;
    lastScore = -1;
    lastLives = -1;
    lastLevel = -1;
    spawnFruit();
    emitStats();
  }

  function readDirectionInput() {
    let next: Cell | null = null;
    if (justPressed["ArrowLeft"]) next = { x: -1, y: 0 };
    if (justPressed["ArrowRight"]) next = { x: 1, y: 0 };
    if (justPressed["ArrowUp"]) next = { x: 0, y: -1 };
    if (justPressed["ArrowDown"]) next = { x: 0, y: 1 };
    justPressed["ArrowLeft"] = false;
    justPressed["ArrowRight"] = false;
    justPressed["ArrowUp"] = false;
    justPressed["ArrowDown"] = false;

    if (next && !(next.x === -dir.x && next.y === -dir.y)) {
      pendingDir = next;
    }
  }

  function step() {
    dir = pendingDir;
    const head = snake[0];
    const newHead: Cell = { x: head.x + dir.x, y: head.y + dir.y };

    if (newHead.x < 0 || newHead.x >= GRID_W || newHead.y < 0 || newHead.y >= GRID_H) {
      gameOver = true;
      return;
    }
    if (snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      gameOver = true;
      return;
    }

    snake.unshift(newHead);

    if (fruit && newHead.x === fruit.x && newHead.y === fruit.y) {
      score += fruit.rare ? FRUIT_RARE_SCORE : FRUIT_COMMON_SCORE;
      fruitsEaten++;
      growth++;
      if (fruitsEaten % FRUITS_PER_LEVEL === 0) level++;
      spawnFruit();
    }

    if (growth > 0) {
      growth--;
    } else {
      snake.pop();
    }
  }

  function update(dt: number) {
    if (gameOver) {
      if (!gameOverReported) {
        gameOverReported = true;
        emitStats();
        cb.onGameOver(score);
      }
      return;
    }

    readDirectionInput();

    tickAcc += dt;
    const interval = tickInterval();
    while (tickAcc >= interval) {
      step();
      tickAcc -= interval;
      if (gameOver) break;
    }

    emitStats();
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    if (fruit) {
      const fx = fruit.x * CELL;
      const fy = fruit.y * CELL;
      if (fruitsImgLoaded) {
        const frame = FRUIT_ATLAS[fruit.sprite];
        ctx.drawImage(fruitsImg, frame.x, frame.y, frame.w, frame.h, fx, fy, CELL, CELL);
      } else {
        const idx = FRUIT_NAMES.indexOf(fruit.sprite) % FALLBACK_COLORS.length;
        ctx.fillStyle = FALLBACK_COLORS[idx];
        ctx.fillRect(fx, fy, CELL, CELL);
      }
    }

    drawSnake();
  }

  // Cabeza más clara, cola se oscurece gradualmente (mismo tono verde base).
  const HEAD_RGB = { r: 74, g: 222, b: 128 }; // #4ade80
  const TAIL_RGB = { r: 22, g: 101, b: 52 }; // #166534

  function bodyColor(i: number, count: number): string {
    const t = count <= 1 ? 0 : i / (count - 1);
    const r = Math.round(HEAD_RGB.r + (TAIL_RGB.r - HEAD_RGB.r) * t);
    const g = Math.round(HEAD_RGB.g + (TAIL_RGB.g - HEAD_RGB.g) * t);
    const b = Math.round(HEAD_RGB.b + (TAIL_RGB.b - HEAD_RGB.b) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function drawSnake() {
    const count = snake.length;
    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? "#4ade80" : bodyColor(i, count);
      ctx.beginPath();
      ctx.roundRect(seg.x * CELL, seg.y * CELL, CELL - 1, CELL - 1, i === 0 ? 6 : 4);
      ctx.fill();
    });

    // Ojos en la cabeza, posicionados según la dirección de avance.
    const head = snake[0];
    const hx = head.x * CELL;
    const hy = head.y * CELL;
    const eye = 3;
    let e1x: number, e1y: number, e2x: number, e2y: number;
    if (dir.x === 1) {
      e1x = CELL - 7;
      e1y = 4;
      e2x = CELL - 7;
      e2y = CELL - 8;
    } else if (dir.x === -1) {
      e1x = 4;
      e1y = 4;
      e2x = 4;
      e2y = CELL - 8;
    } else if (dir.y === -1) {
      e1x = 4;
      e1y = 4;
      e2x = CELL - 8;
      e2y = 4;
    } else {
      e1x = 4;
      e1y = CELL - 7;
      e2x = CELL - 8;
      e2y = CELL - 7;
    }
    ctx.fillStyle = "#052e16";
    ctx.fillRect(hx + e1x, hy + e1y, eye, eye);
    ctx.fillRect(hx + e2x, hy + e2y, eye, eye);
  }

  let lastTime: number | null = null;
  let rafId = 0;
  let running = true;

  function loop(ts: number) {
    if (!running) return;
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  initState();
  rafId = requestAnimationFrame(loop);

  return {
    pause() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(rafId);
    },
    resume() {
      if (running) return;
      running = true;
      lastTime = null;
      rafId = requestAnimationFrame(loop);
    },
    restart() {
      initState();
      if (!running) {
        running = true;
        lastTime = null;
        rafId = requestAnimationFrame(loop);
      }
    },
    destroy() {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
