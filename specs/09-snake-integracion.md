# SPEC 09 — Integración del juego Snake

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-07-20
> **Objective:** Crear el motor de Snake desde cero bajo el contrato estándar, registrarlo y sembrar su fila en Supabase para que sea jugable con leaderboard real.

## Scope

**In:**

- Motor `app/games/snake/engine.ts` (nuevo, sin referencia) siguiendo `.claude/skills/nuevo-juego/engine-template.ts`: `initSnake(canvas, cb): SnakeEngine`, callbacks `SnakeCallbacks { onScore, onLives, onLevel, onGameOver }`. Grid sobre canvas 800×600, celda 20px (40×30). Sin globals de módulo, sin `any`, `destroy()` limpio (cancela rAF, quita listeners de teclado).
- Copiar `references/source-assets/snake-assets/fruits.png` a `public/sprites/snake/fruits.png`; portar el atlas de `sprites.js` a un objeto TS tipado dentro del motor (coords `{x,y,w,h}` de las 22 frutas). Carga async con fallback de primitivas (mismo patrón que `app/games/arkanoid/engine.ts`).
- Entrada `snake: initSnake` en `app/games/registry.ts` (el registro ya existe; solo se agrega la entrada).
- Migración Supabase (`.claude/skills/nuevo-juego/migration-template.sql`): 1 fila en `games` + 8 filas seed en `scores`.

**Out of scope (para futuras specs):**

- Auth real / anti-cheat en el insert de score (mismo riesgo aceptado que spec 06).
- Controles táctiles y sonido.
- Registrar más juegos; refactor del registry (ya existe) o de otros motores.
- Nueva clase CSS — `cover-snake` ya existe en `app/globals.css`.

## Data model

Reusa `Game` y `ScoreRow` de `app/lib/supabase/queries.ts` — no se crean tablas nuevas, solo una fila en `games`.

```ts
interface SnakeCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void; // siempre 1 (1 vida clásica)
  onLevel: (level: number) => void; // sube cada 5 frutas comidas
  onGameOver: (finalScore: number) => void;
}

interface SnakeEngine {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
}
```

Reglas del juego:

- Celda de 20px; la serpiente avanza a paso fijo por tick (el tick se acorta al subir de nivel, aumentando la velocidad).
- Fruta común +10, fruta rara +30. Spawn ponderado (comunes más frecuentes) con sprite aleatorio del atlas de 22 frutas.
- Nivel +1 cada 5 frutas comidas.
- Game over inmediato al chocar contra pared o contra el propio cuerpo (1 vida clásica, `onLives` siempre reporta 1).
- No se permite invertir la dirección 180° en un mismo tick.

Fila `games`:

```
id='snake', title='SNAKE', cat='ARCADE', cover='cover-snake', color='#4ade80'
```

(`short`/`long` con tono arcade retro, redactados en el paso de migración.)

## Implementation plan

1. **Assets.** Copiar `references/source-assets/snake-assets/fruits.png` a `public/sprites/snake/fruits.png`.
2. **Motor.** Crear `app/games/snake/engine.ts` desde `engine-template.ts`: grid + tick, dirección por flechas (edge-detect, sin giro 180°), spawn de fruta ponderado con sprite del atlas, crecimiento, colisiones, `onScore/onLevel/onGameOver`, `onLives(1)` fijo. Atlas TS tipado (coords de `sprites.js`) + carga async de `/sprites/snake/fruits.png` con fallback de rect de color por fruta mientras no cargue.
3. **Registro.** Agregar `snake: initSnake` a `app/games/registry.ts`. `GamePlayer.tsx` no se toca — ya usa lookup por registro.
4. **Supabase.** `apply_migration`: insert en `games` + 8 filas seed en `scores` (rango ~50–500, nombres arcade). Verificar con `execute_sql`.
5. **Verificación.** `npm run build`; `npm run dev`; recorrer `/biblioteca` (tarjeta Snake), `/juego/snake` (detalle + leaderboard sembrado), `/juego/snake/jugar` (juego real, HUD real), jugar hasta game-over y confirmar insert real; `/salon` (tab/podio). Confirmar que asteroides/tetris/arkanoid siguen jugables sin regresión.

## Acceptance criteria

- [x] `app/games/snake/engine.ts` exporta `initSnake` con `init/pause/resume/restart/destroy`, sin `any`, sin estado global de módulo.
- [x] `GamePlayer.tsx` monta Snake vía el registro (entrada `snake`, sin rama `if` nueva hardcodeada).
- [x] `public/sprites/snake/fruits.png` existe; las frutas se dibujan desde el atlas (fallback de color si aún no cargó).
- [x] Comer fruta común suma +10, fruta rara suma +30; el nivel sube cada 5 frutas y la serpiente acelera. (verificado por revisión de código; no se pudo forzar en el autoplay de prueba)
- [x] Chocar contra pared o contra el propio cuerpo dispara game over; no se puede invertir la dirección 180°.
- [x] Fila `snake` existe en `games` y hay ≥8 filas seed en `scores` para `game_id='snake'` (verificado con `execute_sql`).
- [x] `/biblioteca`, `/juego/snake` y `/juego/snake/jugar` funcionan; jugar una partida inserta un score real en `scores`.
- [x] `npm run build` compila sin errores.
- [x] Asteroides, tetris y arkanoid siguen jugables sin regresión.

## Decisions

- **Sí:** motor sigue el contrato estándar (`init/pause/resume/restart/destroy` + callbacks) en vez de una API ad-hoc — se registra sin ramas nuevas en `GamePlayer` (patrón validado en spec 05).
- **Sí:** 1 vida clásica (`onLives` fijo en 1) — Snake canónico; el HUD de vidas siempre muestra 1.
- **Sí:** frutas con distinto valor (común +10 / rara +30), spawn ponderado con sprite aleatorio del atlas — aprovecha los 22 sprites disponibles en `fruits.png`.
- **Sí:** reusar `cover-snake` (ya existe en `app/globals.css`) — no se crea CSS nuevo.
- **Sí:** 8 filas seed en `scores` (~50–500) — evita leaderboard vacío, mismo patrón que spec 06.
- **No:** refactor del registry — ya existe (spec 08 lo dejó listo); esta spec solo agrega una entrada.
- **No:** cloud sync / multiplayer / táctil — fuera de alcance, otra spec si aplica.

## Risks

| Riesgo                                                                | Mitigación                                                                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `fruits.png` no carga al montar → frutas invisibles                   | Carga async en `init`; `draw()` usa fallback de rect de color por fruta hasta que `img.complete` (patrón `arkanoid/engine.ts`). |
| Tick fijo desacoplado del rAF puede saltar tras pestaña en background | Acumulador de tiempo con `dt` clamp del template (máx 0.05s) para el paso de la serpiente.                                      |

## What is **not** in this spec

- Auth real / anti-cheat en el insert de score.
- Controles táctiles y sonido.
- Registrar más juegos, refactor del registry o de otros motores.
- Nueva clase CSS de cover.

Cada uno de estos, si aterriza, va en su propia spec.
