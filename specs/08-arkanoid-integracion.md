# SPEC 08 — Integración de Arkanoid

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-07-20
> **Objective:** Portar el Arkanoid de `references/started-games/04-arkanoid/` al contrato de motor estándar, registrarlo en `app/games/registry.ts` y sembrar su fila y leaderboard en Supabase.

## Scope

**In:**

- Motor `app/games/arkanoid/engine.ts` portado de `references/started-games/04-arkanoid/game.js` (+ `levels.js`) siguiendo el contrato de `.claude/skills/nuevo-juego/engine-template.ts`: `initArkanoid(canvas, cb): { pause, resume, restart, destroy }`, callbacks `{ onScore, onLives, onLevel, onGameOver }`. Sin estado global de módulo, sin `any`.
- Agregar entrada `arkanoid: initArkanoid` en `app/games/registry.ts` (el registro ya existe desde SPEC 07 — solo se añade la línea, sin refactor).
- Fila en `games` (Supabase) con la metadata abajo, vía migración basada en `.claude/skills/nuevo-juego/migration-template.sql`. Seed de 8 filas ficticias en `scores` (rango ~500–5000).
- Reusar clase `.cover-bricks` ya existente en `app/globals.css` — sin CSS nuevo.
- Sonido (`ball-bounce.mp3`, `break-sound.mp3` copiados a `public/sounds/arkanoid/`) y animación de explosión de bloques, portados dentro del motor.
- Spritesheet original (`spritesheet-breakout.png`, copiado a `public/sprites/arkanoid/`) para dibujar pala/bola/bloques y los frames de explosión — reemplaza las primitivas canvas (rects) por los sprites reales del juego original. Carga async no bloquea el arranque del loop: mientras la imagen no cargó, se dibuja el frame previo (fallback primitivo) sin pausar el rAF.

**Out of scope (for future specs):**

- Auth real / anti-cheat en el insert de score (mismo riesgo aceptado que SPEC 06).
- Overlay de pausa dibujado en canvas del original — el contrato lo reemplaza por HUD/pausa en React.
- Controles táctiles.
- Registrar más juegos además de este.

## Data model

Reusa el modelo existente de `games`/`scores` (sin tablas nuevas) — solo una fila nueva. Tipos ya definidos en `app/lib/supabase/queries.ts` (`Game`, `ScoreRow`) sin cambios.

```ts
// app/games/arkanoid/engine.ts
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

export function initArkanoid(canvas: HTMLCanvasElement, cb: ArkanoidCallbacks): ArkanoidEngine;
```

Fila `games` a insertar:

```sql
insert into games (id, title, short, long, cat, cover, color) values (
  'arkanoid',
  'Arkanoid',
  'Rompe todos los ladrillos con la pala y la bola.',
  'Controla la pala con teclado o mouse y rebota la bola para destruir los ladrillos de cada nivel. Supera los 5 niveles, cuida tus 3 vidas y busca el puntaje mas alto antes de que la bola se te escape.',
  'ARCADE',
  'cover-bricks',
  '#ff2d95'
);
```

## Implementation plan

1. **Motor.** Crear `app/games/arkanoid/engine.ts` portando `game.js`/`levels.js`: pala + bola + bloques como estado en closure, colisión AABB, 5 niveles, input teclado (`ArrowLeft/Right`) **y** mouse (`mousemove` mueve la pala), `emitStats` diff-emit para score/lives/level, rAF loop con `dt` clamp, `destroy()` cancela rAF y quita listeners de `window`/`canvas`. HUD y pausa-en-canvas no se portan — bloques/pala/bola se dibujan inicialmente con primitivas canvas (rects) como fallback antes de que cargue el spritesheet.
   1b. **Sonido y explosiones.** Copiar `ball-bounce.mp3`/`break-sound.mp3` a `public/sounds/arkanoid/`. En el motor: reproducir bounce en rebotes de pared/pala (`new Audio(...).cloneNode().play()`, mismo patrón del original, ignorando rechazo de la promesa por autoplay), break al romper bloque, y agregar partículas/frames de explosión al estado del closure, actualizadas en `update` y dibujadas en `draw`.
   1c. **Spritesheet.** Copiar `spritesheet-breakout.png` a `public/sprites/arkanoid/`. Portar las coordenadas `SPRITES`/`EXPLOSION_FRAMES` de `assets/spritesheet.js` al motor. Cargar la imagen con `new Image()` de forma async sin bloquear el arranque del rAF (flag `spritesLoaded`, seteado en `onload`); `draw()` usa `ctx.drawImage` con los sprites si `spritesLoaded`, si no cae al fallback de rects.
2. **Registro.** Editar `app/games/registry.ts`: importar `initArkanoid` y agregar `arkanoid: initArkanoid` al objeto `engineRegistry`. No se toca `GamePlayer.tsx` (ya resuelve por lookup desde SPEC 07).
3. **Supabase.** `apply_migration`: insert en `games` (fila de arriba) + 8 filas seed en `scores` para `game_id='arkanoid'`, puntajes entre 500 y 5000. Verificar con `list_tables`/`execute_sql`.
4. **Verificación.** `npm run build`; `npm run dev`; recorrer `/biblioteca` (tarjeta Arkanoid junto a asteroides/tetris), `/juego/arkanoid` (detalle + leaderboard con las 8 filas), `/juego/arkanoid/jugar` (juego real, HUD real, pausa, ambos controles); jugar hasta game over y confirmar insert real en `scores`. Confirmar que asteroides y tetris siguen funcionando sin regresión.

## Acceptance criteria

- [x] `app/games/arkanoid/engine.ts` exporta motor con `init/pause/resume/restart/destroy`, sin `any`, sin estado global de módulo.
- [x] `GamePlayer.tsx` monta el motor de Arkanoid vía el registro existente, sin rama `if` nueva.
- [x] Fila `arkanoid` existe en `games` (verificable con `list_tables`/`execute_sql`).
- [x] `scores` tiene 8 filas seed para `game_id='arkanoid'`.
- [x] `/biblioteca` muestra la tarjeta de Arkanoid, sin regresión en asteroides/tetris.
- [x] `/juego/arkanoid` y `/juego/arkanoid/jugar` funcionan; jugar una partida inserta score real en `scores`.
- [x] Input funciona con teclado y con mouse.
- [x] Rebotes reproducen `ball-bounce.mp3` y romper un bloque reproduce `break-sound.mp3`.
- [x] Romper un bloque dispara una animación de explosión (partículas) en su posición.
- [x] Pala, bola, bloques y explosiones se dibujan con el spritesheet original una vez cargado; no bloquea el arranque del juego mientras carga.
- [x] `npm run build` compila sin errores.
- [x] Asteroides y tetris siguen jugables sin regresión.

## Decisions

- **Sí:** motor sigue el contrato estándar (`init/pause/resume/restart/destroy` + callbacks) en vez de una API ad-hoc — permite registrarlo sin ramas nuevas en `GamePlayer` y reutiliza el patrón validado en SPEC 05/07.
- **Sí:** reusar `.cover-bricks` en vez de crear una clase nueva — ya representa un campo de ladrillos, cero CSS adicional.
- **Sí:** sembrar 8 filas de scores ficticios (rango 500–5000) — evita leaderboard vacío, mismo patrón de SPEC 06.
- **Sí:** portar ambos esquemas de input (teclado + mouse) — el original los usa simultáneamente y es fiel a la experiencia arcade.
- **Sí:** portar audio (bounce/break) y animación de explosión de bloques — pedido explícito del usuario durante la implementación; se agrega al motor sin tocar HUD/pausa (siguen en React).
- **Sí:** portar el spritesheet original — pedido explícito del usuario. Carga async no gatea el rAF (fallback a rects mientras carga), resolviendo el riesgo que originalmente motivó no portarlo.
- **No:** portar HUD-en-canvas ni overlay de pausa con hit-test de mouse — el contrato del motor delega HUD/pausa a React vía callbacks.

## Risks

| Risk                                                                                                                                   | Mitigation                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El loader de spritesheet original es async y gatea el arranque del loop; el contrato no tiene equivalente de "estado cargando".        | El rAF arranca de inmediato con fallback de rects; `draw()` cambia a sprites en cuanto `spritesLoaded` se activa (asset local, carga casi instantánea).               |
| Input dual (mousemove sobrescribe la posición de la pala cada frame que dispara) puede pisar el input de teclado si no se ordena bien. | Aplicar mousemove y teclado al mismo estado `paddle.x` en el mismo `update(dt)`, replicando el orden del original (mousemove asigna directo, teclado suma velocidad). |

## What is **not** in this spec

- Auth real / anti-cheat en el insert de score.
- Overlay de pausa dibujado en canvas.
- Controles táctiles.
- Registrar juegos adicionales.

Each one of those, if it lands, goes in its own spec.
