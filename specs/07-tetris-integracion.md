# SPEC 07 — Integración de Tetris al arcade

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-07-20
> **Objective:** Portar `references/started-games/03-tetris/game.js` a un motor TS con el contrato estándar, registrarlo en un `registry.ts` nuevo (migrando asteroides), y sembrar su fila + scores en Supabase.

---

## Scope

**In:**

- Motor `app/games/tetris/engine.ts` — puerto de `references/started-games/03-tetris/game.js`, contrato `initTetris(canvas, cb): { pause, resume, restart, destroy }` con callbacks `{ onScore, onLives, onLevel, onGameOver }`. Sin estado global de módulo, sin `any`.
- Creación de `app/games/registry.ts` (no existe todavía) migrando `asteroides` al registro, según `.claude/skills/nuevo-juego/registry-snippet.md` — reemplaza el `if game.id === "asteroides"` hardcodeado en `GamePlayer.tsx`. Agrega la entrada `tetris: initTetris`.
- Fila en `games` (Supabase) con `id: "tetris"`, `title: "TETRIS"`, `short`, `long`, `cat: "PUZZLE"`, `cover: "cover-tetro"`, `color: "#4dd0e1"`, vía migración basada en `.claude/skills/nuevo-juego/migration-template.sql`.
- Seed de 5 filas en `scores` para `game_id = "tetris"`, puntuaciones en rango 8000–20000.
- Clase `.cover-tetro` en `app/globals.css` (no existe todavía, solo referenciada como disponible en la config del skill — se confirma su ausencia y se crea).

**Out of scope (for future specs):**

- Auth real / anti-cheat en el insert de score (mismo riesgo aceptado que spec 06).
- Controles táctiles / sonido.
- Tema claro/oscuro propio del juego (`localStorage` de `tetris-theme` en el original) — el shell del arcade ya maneja tema, no se porta.
- Registrar más juegos además de Tetris (el registro queda listo para el próximo, no se anticipan otros).

---

## Data model

Reusa el modelo existente de `games`/`scores` (`app/lib/supabase/queries.ts`: tipos `Game`, `ScoreRow`) — solo una fila nueva, sin tablas nuevas.

```ts
// app/games/tetris/engine.ts
export interface TetrisCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void; // Tetris no tiene vidas: se emite constante 1, nunca decrece
  onLevel: (level: number) => void; // floor(lines / 10) + 1, igual al original
  onGameOver: (finalScore: number) => void; // dispara cuando una pieza nueva colisiona al spawnear
}

export interface TetrisEngine {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
}
```

Estado interno del motor (dentro de la clausura, no global de módulo): `board` (20×10), `current`/`next` (pieza activa y siguiente), `score`, `lines`, `level`, `dropInterval`/`dropAccum`, `gameOver`. Mismas constantes que el original: `COLS=10`, `ROWS=20`, `BLOCK=30` (canvas 300×600), tabla `LINE_SCORES = [0,100,300,500,800]`, 8 tipos de pieza (incluye la "N" tuerca extra del set original).

---

## Implementation plan

1. **Motor.** Crear `app/games/tetris/engine.ts` portando `game.js`: tablero, piezas, rotación con kicks, clear de líneas, ghost piece, soft/hard drop. Sin `document.getElementById`, sin `localStorage`, sin dibujo de HUD/overlay en canvas — todo vía `TetrisCallbacks`. Input: `ArrowLeft/Right/Down/Up`, `Space` (hard drop), `KeyX` (rotar alterno). `KeyP` de pausa del original NO se porta al motor — la pausa la controla React vía `pause()/resume()` del contrato. `destroy()` cancela rAF y quita los listeners de `window`.
2. **Registro.** Crear `app/games/registry.ts` migrando `asteroides` (ver `.claude/skills/nuevo-juego/registry-snippet.md`) y agregando `tetris: initTetris`. Editar `GamePlayer.tsx`: reemplazar `game.id === "asteroides"` por lookup en `engineRegistry[game.id]`.
3. **Supabase.** `apply_migration` con insert en `games` (fila `tetris`) + 5 filas seed en `scores` (8000–20000). Verificar con `list_tables`/`execute_sql`.
4. **Cover CSS.** Agregar clase `.cover-tetro` en `app/globals.css` (paleta acorde a piezas: cyan/amarillo/púrpura, sin asumir diseño exacto — resuelto en implementación siguiendo `/frontend-design`).
5. **Verificación.** `npm run build`; `npm run dev`; recorrer `/biblioteca` (tarjeta tetris + asteroides sin regresión), `/juego/tetris` (detalle + leaderboard sembrado), `/juego/tetris/jugar` (juego real, HUD real, pausa, rotar, hard drop), jugar hasta game-over y confirmar insert real en `scores`; `/salon` (tab/podio incluye tetris); confirmar `/juego/asteroides/jugar` sigue funcionando igual tras tocar el registro.

---

## Acceptance criteria

- [x] `app/games/tetris/engine.ts` exporta `initTetris` con `init/pause/resume/restart/destroy`, sin `any`, sin estado global de módulo.
- [x] `GamePlayer.tsx` monta el motor de tetris vía `engineRegistry`, no una rama `if` nueva.
- [x] Fila `tetris` existe en `games` (verificado con `execute_sql`).
- [x] `/biblioteca` muestra la tarjeta de Tetris junto a asteroides, sin regresión.
- [x] `/juego/tetris` y `/juego/tetris/jugar` funcionan; se jugó una partida hasta game-over y se confirmó el insert real en `scores`.
- [x] Rotación (`ArrowUp`/`KeyX`), movimiento lateral, soft drop y hard drop (`Space`) responden igual que el original.
- [x] Limpiar una línea suma puntos según `LINE_SCORES[cleared] * level` y sube `level`/`dropInterval` como en el original (lógica portada 1:1 del original, no ejercitada directamente en la sesión de pruebas por requerir llenar una fila completa).
- [x] `npm run build` compila sin errores.
- [x] Asteroides sigue jugable sin regresión tras el refactor del registro.

---

## Notas de implementación (fuera del alcance original, resueltas durante verificación)

- `.game-canvas` se deformaba dentro de `.crt-screen` (aspect-ratio 16/10 fijo, pensado para Asteroides 800×600) al montar el canvas portrait de Tetris (300×600). Fix: `object-fit: contain` en `.game-canvas` (`app/globals.css`) — también corrige la relación de aspecto de Asteroides.
- `/salon` crasheaba (`TypeError` leyendo `rows[1]`/`rows[2]`) cuando el juego con tab por defecto tenía menos de 3 scores en `scores` (bug preexistente, no causado por este spec). Fix: guardas condicionales en el podio de plata/bronce (`app/salon/page.tsx`).

---

## Decisions

- **Sí:** motor sigue el contrato estándar (`init/pause/resume/restart/destroy` + callbacks) en vez de una API ad-hoc — permite registrarlo sin ramas nuevas en `GamePlayer` y reutiliza el patrón validado en spec 05.
- **Sí:** `onLives` se emite constante en `1` y nunca decrece — Tetris no tiene vidas en el original; se preserva el contrato en vez de forzar una mecánica que no existe.
- **No:** portar `KeyP` (pausa propia del juego) ni el toggle de tema con `localStorage` — la pausa y el tema ya los controla el shell de React del arcade.
- **Sí:** cover nueva `.cover-tetro` en vez de reusar una existente — visualmente distinta de asteroides/otros juegos, coherente con la paleta de piezas.
- **Sí:** seed de 5 filas (8000–20000) en `scores` — mismo patrón que spec 06, evita leaderboard vacío en la demo.

---

## What is **not** in this spec

- Auth real / anti-cheat en scores.
- Controles táctiles / sonido.
- Tema claro/oscuro propio del juego.
- Registrar Arkanoid u otros juegos (el registro queda listo, pero no se anticipan en este spec).

Each one of those, if it lands, goes in its own spec.
