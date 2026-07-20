// Motor de Arkanoid — portado de references/started-games/04-arkanoid/game.js + levels.js
// (+ assets/spritesheet.js) a un módulo TS montable sobre un <canvas> React. Sin estado
// global de módulo: todo vive dentro de la instancia devuelta por initArkanoid().
// HUD-en-canvas y overlay de pausa no se portan — los resuelve React vía callbacks.
// El spritesheet carga async sin bloquear el rAF: mientras carga, draw() usa un fallback
// de primitivas canvas (rects).

const W = 800;
const H = 600;

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const LEVEL_COUNT = 5;

const COLOR_HEX: Record<string, string> = {
  red: "#e63946",
  yellow: "#f0c040",
  cyan: "#22d3ee",
  magenta: "#d946ef",
  hotpink: "#ff2d95",
  green: "#4ade80",
  gray: "#9ca3af",
};

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
}

const EXPLOSION_DURATION = 0.15;

interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  elapsed: number;
}

interface SpriteFrame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

// Portado de assets/spritesheet.js — coordenadas dentro de spritesheet-breakout.png.
const SPRITES: { paddle: SpriteFrame; ball: SpriteFrame; blocks: Record<string, SpriteFrame> } = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
};

const EXPLOSION_FRAMES: Record<string, SpriteFrame[]> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
  hotpink: [
    { sx: 256, sy: 256, sw: 32, sh: 16 },
    { sx: 288, sy: 256, sw: 32, sh: 16 },
    { sx: 320, sy: 256, sw: 32, sh: 16 },
    { sx: 352, sy: 256, sw: 32, sh: 16 },
  ],
  gray: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
};

interface BlockSpec {
  col: number;
  row: number;
  color: string;
}

interface Level {
  speed: number;
  blocks: BlockSpec[];
}

// Portado 1:1 de levels.js — 5 layouts fijos.
const LEVELS: Level[] = (() => {
  const rowColors1 = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
  const rowColors2 = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
  const rowColors4 = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];

  const l1: BlockSpec[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) l1.push({ col, row, color: rowColors1[row] });

  const l2: BlockSpec[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: BlockSpec[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if ((col + row) % 2 === 0) l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: BlockSpec[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if (!gaps4[row].includes(col)) l4.push({ col, row, color: rowColors4[row] });

  const l5: BlockSpec[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

export interface ArkanoidCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface ArkanoidEngine {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
}

const GAME_KEYS = ["ArrowLeft", "ArrowRight"];

export function initArkanoid(canvas: HTMLCanvasElement, cb: ArkanoidCallbacks): ArkanoidEngine {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas");
  const ctx: CanvasRenderingContext2D = ctx2d;

  const keys: Record<string, boolean> = {};

  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    keys[e.code] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    keys[e.code] = false;
  };
  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    paddle.x = Math.max(0, Math.min(W - paddle.w, mouseX - paddle.w / 2));
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("mousemove", onMouseMove);

  const bounceSound = new Audio("/sounds/arkanoid/ball-bounce.mp3");
  const breakSound = new Audio("/sounds/arkanoid/break-sound.mp3");
  function playSound(sound: HTMLAudioElement) {
    const clone = sound.cloneNode() as HTMLAudioElement;
    clone.play().catch(() => {});
  }

  // Carga async del spritesheet — no bloquea el arranque del rAF. Mientras `spritesLoaded`
  // sea false, draw() usa el fallback de primitivas canvas.
  let spritesLoaded = false;
  const spritesheet = new Image();
  spritesheet.onload = () => {
    spritesLoaded = true;
  };
  spritesheet.src = "/sprites/arkanoid/spritesheet-breakout.png";

  const paddle = { x: 0, y: 560, w: 81, h: 14 };
  const ball = { x: 0, y: 0, w: 16, h: 16, vx: BASE_BALL_VX, vy: BASE_BALL_VY };

  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let currentLevel = 1;
  let score = 0;
  let lives = 3;
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
    if (lives !== lastLives) {
      lastLives = lives;
      cb.onLives(lives);
    }
    if (currentLevel !== lastLevel) {
      lastLevel = currentLevel;
      cb.onLevel(currentLevel);
    }
  }

  function initBall() {
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    currentLevel = n;
    const level = LEVELS[n - 1];
    blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    initBall();
  }

  function collideAABB(block: Block): boolean {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  function initState() {
    paddle.x = (W - paddle.w) / 2;
    score = 0;
    lives = 3;
    gameOver = false;
    gameOverReported = false;
    loadLevel(1);
    emitStats();
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

    if (keys["ArrowLeft"]) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys["ArrowRight"]) paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      playSound(bounceSound);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
      playSound(bounceSound);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      playSound(bounceSound);
    }

    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      playSound(bounceSound);
    }

    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += 10;
        ball.vy = -ball.vy;
        playSound(breakSound);
        if (blocks.every((b) => !b.alive)) {
          if (currentLevel < LEVEL_COUNT) {
            loadLevel(currentLevel + 1);
          } else {
            gameOver = true;
          }
        }
        break;
      }
    }

    for (const exp of explosions) exp.elapsed += dt;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    if (ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        gameOver = true;
      } else {
        initBall();
      }
    }

    emitStats();
  }

  function drawSprite(frame: SpriteFrame, x: number, y: number, w: number, h: number) {
    ctx.drawImage(spritesheet, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    for (const block of blocks) {
      if (!block.alive) continue;
      if (spritesLoaded) {
        drawSprite(SPRITES.blocks[block.color], block.x, block.y, block.w, block.h);
      } else {
        ctx.fillStyle = COLOR_HEX[block.color] ?? "#fff";
        ctx.fillRect(block.x, block.y, block.w, block.h);
      }
    }

    for (const exp of explosions) {
      const progress = exp.elapsed / EXPLOSION_DURATION;
      if (spritesLoaded) {
        const frames = EXPLOSION_FRAMES[exp.color];
        const frameIndex = Math.min(Math.floor(progress * frames.length), frames.length - 1);
        drawSprite(frames[frameIndex], exp.x, exp.y, exp.w, exp.h);
      } else {
        const cx = exp.x + exp.w / 2;
        const cy = exp.y + exp.h / 2;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - progress);
        ctx.strokeStyle = COLOR_HEX[exp.color] ?? "#fff";
        ctx.lineWidth = 2;
        const r = Math.max(exp.w, exp.h) * (0.3 + progress * 0.7);
        ctx.strokeRect(cx - r / 2, cy - r / 2, r, r);
        ctx.restore();
      }
    }

    if (spritesLoaded) {
      drawSprite(SPRITES.paddle, paddle.x, paddle.y, paddle.w, paddle.h);
      drawSprite(SPRITES.ball, ball.x, ball.y, ball.w, ball.h);
    } else {
      ctx.fillStyle = "#fff";
      ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
      ctx.beginPath();
      ctx.arc(ball.x + ball.w / 2, ball.y + ball.h / 2, ball.w / 2, 0, Math.PI * 2);
      ctx.fill();
    }
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
      canvas.removeEventListener("mousemove", onMouseMove);
    },
  };
}
