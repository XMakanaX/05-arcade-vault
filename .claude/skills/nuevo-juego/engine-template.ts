// Plantilla de motor — API estándar validada en app/games/asteroids/engine.ts (spec 05).
// Copiar a app/games/<slug>/engine.ts y adaptar. Reglas:
// - Sin estado global de módulo: todo vive dentro de la clausura devuelta por init<Name>().
// - Sin `any` (strict mode del repo).
// - HUD/overlays los dibuja React vía callbacks — el canvas NO dibuja score/vidas/nivel/pausa/game-over.
// - Listeners propios en `window`, guardados para poder quitarlos en destroy().
// - preventDefault() en las teclas que use el juego (evita scroll de página).

const W = 800;
const H = 600;

export interface GameCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface GameEngine {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
}

// Teclas que el juego captura — agregar/quitar según el port. Cualquier tecla listada
// aquí recibe preventDefault en keydown/keyup mientras el motor está montado.
const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"];

export function initGame(canvas: HTMLCanvasElement, cb: GameCallbacks): GameEngine {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas");
  const ctx: CanvasRenderingContext2D = ctx2d;

  // --- Input: mismo patrón que asteroids/engine.ts (keys held + justPressed edge-detect) ---
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};

  function pressed(code: string): boolean {
    const val = justPressed[code];
    justPressed[code] = false;
    return !!val;
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    keys[e.code] = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // --- Estado del juego (dentro de la clausura, no global de módulo) ---
  let score = 0;
  let lives = 3;
  let level = 1;
  let gameOver = false;

  // --- Diff-emit: solo llama al callback cuando el valor realmente cambió,
  //     evita spamear setState de React en cada frame. ---
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
    if (level !== lastLevel) {
      lastLevel = level;
      cb.onLevel(level);
    }
  }

  function initState() {
    score = 0;
    lives = 3;
    level = 1;
    gameOver = false;
    gameOverReported = false;
    // TODO: inicializar entidades del juego (nave, piezas, tablero, etc.)
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

    // TODO: leer `keys`/`pressed()` y actualizar el estado del juego.
    // Mutar `score`/`lives`/`level`/`gameOver` según la lógica portada.

    emitStats();
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    // TODO: dibujar solo el juego. Nada de HUD/overlay — eso lo pone React.
  }

  // --- Loop con dt clamp (evita saltos grandes tras pestaña en background) ---
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
