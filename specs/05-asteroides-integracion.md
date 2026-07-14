# SPEC 05 — Integración del juego Asteroides en la plataforma Next.js

> **Status:** Implementado
> **Depends on:** 01-mvp-pantallas-visuales (GamePlayer, rutas /juego/[id]/jugar)
> **Date:** 2026-07-14
> **Objective:** Portar el clon vanilla de Asteroides (`references/started-games/02-asteroids/game.js`) a un módulo TypeScript montable en un `<canvas>` React, y hacer que el juego con id `asteroides` se juegue de verdad dentro de `GamePlayer`, con el HUD React alimentado por eventos del motor.

---

## Context

La plataforma ya tiene toda la carcasa de "jugar" (`app/juego/[id]/jugar/page.tsx` → `app/components/GamePlayer.tsx`), pero `GamePlayer` es un **simulador falso**: incrementa `score` con `Math.random()` en un `setInterval` y dibuja enemigos con CSS (`.game-arena`). No hay juego jugable.

Existe un clon real de Asteroides en canvas HTML5 puro (`references/started-games/02-asteroids/game.js`, 510 líneas, 800×600, controles teclado). Este spec lo adapta a la plataforma como **juego nuevo con id `asteroides`** (distinto del `rocas` hardcodeado del catálogo). Resultado esperado: entrar a `/juego/asteroides/jugar` y jugar Asteroides real, con Score/Vidas/Nivel reales en el HUD React y botones Pausa/Fin/Salir funcionales.

Decisiones ya cerradas por el usuario (ver sección Decisions):

- Portar `game.js` a **módulo TS** con `init(canvas, callbacks)` / `destroy()`.
- Solo el juego **`asteroides`** (nuevo) usa el motor; el resto sigue con el placeholder falso.
- **HUD React** manejado por callbacks del motor; se quita el HUD dibujado en canvas.
- Guardado de puntuación **falso** (sin Supabase) — persistencia real queda para spec futura.

---

## Scope

**In:**

- Nueva entrada `asteroides` en `app/data/games.ts` (id `asteroides`, cat `SHOOTER`, reutiliza `cover-rocas`).
- Módulo motor TS: `app/games/asteroids/engine.ts` — porta la lógica de `game.js` a una clase/función con:
  - `init(canvas, opts)` donde `opts` = `{ onScore, onLives, onLevel, onGameOver, onReady? }`.
  - `pause()` / `resume()` / `destroy()` (cancela `requestAnimationFrame`, quita listeners de teclado).
- `app/components/GamePlayer.tsx`: renderiza `<canvas 800×600>` real y conecta el motor **solo** cuando `game.id === "asteroides"`; para el resto mantiene el arena falso actual.
- HUD React (`player-hud` existente) alimentado por los callbacks del motor (score/lives/level).
- Botones **Pausa** → `pause()`/`resume()`, **Fin** → `destroy()` + mostrar modal de fin, **Salir** → navegar a `/juego/asteroides`.
- Se elimina del render del canvas el HUD interno (`drawHUD`/`drawOverlay`) — el HUD y el overlay de fin los pone React.

**Out of scope (specs futuras):**

- Persistencia real de puntuaciones en Supabase (tabla `scores`, RLS, insert al terminar). Se mantiene el `setSaved` falso.
- Portar los otros 7 juegos del catálogo a motores reales.
- Registro genérico de motores (`gameId -> engine`). Por ahora es un `if id === "asteroides"`.
- Controles táctiles / móviles del juego (el motor usa teclado; el diseño responsive del canvas se respeta pero sin joystick táctil).
- Sonido.

---

## Data model

Sin nuevas estructuras persistentes. Solo:

1. **Nueva entrada en `GAMES`** (`app/data/games.ts`) con la interfaz `Game` existente:
   ```ts
   {
     id: "asteroides",
     title: "ASTEROIDES",
     short: "...", long: "...",
     cat: "SHOOTER",
     cover: "cover-rocas",   // reutiliza el cover existente
     color: "yellow",
     best: <n>, plays: "<n>",
   }
   ```
2. **Tipo de opciones del motor** (interno a `engine.ts`, no persistido):
   ```ts
   interface AsteroidsCallbacks {
     onScore: (score: number) => void;
     onLives: (lives: number) => void;
     onLevel: (level: number) => void;
     onGameOver: (finalScore: number) => void;
   }
   ```

---

## Implementation plan

1. **Añadir juego al catálogo.** Nueva entrada `asteroides` en `app/data/games.ts`. Como `generateStaticParams` en `app/juego/[id]/page.tsx` y `.../jugar/page.tsx` mapea sobre `GAMES`, la ruta `/juego/asteroides/jugar` queda generada automáticamente. Sistema sigue funcional (juego aún placeholder).
2. **Portar motor a TS.** Crear `app/games/asteroids/engine.ts` desde `game.js`:
   - Encapsular todo el estado global (`ship, bullets, asteroids, ...`) dentro de una clase/closure (no globals de módulo).
   - `init(canvas, cb)`: obtiene `ctx`, adjunta listeners `keydown`/`keyup` (guardados para poder quitarlos), arranca el loop.
   - Emitir a React: llamar `cb.onScore/onLives/onLevel` cuando cambian (comparar contra valor previo para no spamear), `cb.onGameOver(score)` al pasar a estado `gameover`.
   - Quitar `drawHUD()` y `drawOverlay()` del `draw()` (los pone React). Mantener partículas, nave, asteroides, powerups, wrap toroidal, split, invencibilidad, triple shot.
   - `pause()`: bandera que corta `update()` y cancela/ignora el rAF; `resume()` lo reanuda reseteando `lastTime`. `destroy()`: `cancelAnimationFrame` + `removeEventListener`.
   - Tipar todo (strict mode del repo). Sin `any`.
3. **Cablear `GamePlayer`.** En `app/components/GamePlayer.tsx`:
   - Añadir `useRef<HTMLCanvasElement>` y `useRef` al motor.
   - Si `game.id === "asteroides"`: en `useEffect`, `import` dinámico o estático del engine, `engine.init(canvas, { onScore: setScore, onLives: setLives, onLevel: setLevel, onGameOver: () => setOver(true) })`; cleanup → `engine.destroy()`. Quitar el `setInterval` de score falso **solo** en esa rama.
   - Render: para `asteroides` mostrar `<canvas width={800} height={600}>` (ocupa `.crt-screen`, aspect 4/3 ya coincide); resto mantiene `.game-arena` falso.
   - Botón **Pausa** → `engine.pause()/resume()` (además del estado `paused` para el overlay); **Fin** → `engine.destroy()` + `setOver(true)`; **Salir** sin cambios.
   - `restart()` para asteroides: `engine.destroy()` + re-`init` (o método `engine.restart()`), y reset de estados React.
4. **Ajuste visual del canvas.** CSS mínimo para que el `<canvas>` llene `.crt-screen` (`width:100%; height:100%; display:block`) manteniendo nitidez; el 800×600 interno se escala vía CSS. Verificar que el canvas capta foco de teclado (listeners en `window`, así que basta con que la página tenga foco).
5. **Verificación.** `npm run build` sin errores de tipos; `npm run dev`, jugar en `/juego/asteroides/jugar`.

---

## Acceptance criteria

- [x] `GAMES` incluye entrada con `id: "asteroides"`; `/juego/asteroides` y `/juego/asteroides/jugar` responden (generadas por `generateStaticParams`).
- [x] `app/games/asteroids/engine.ts` exporta un motor con `init/pause/resume/destroy`, sin estado global de módulo, tipado estricto (sin `any`).
- [x] En `/juego/asteroides/jugar` se juega Asteroides real: rotar (←/→), propulsar (↑), disparar (Espacio), wrap de bordes, asteroides se parten, powerup triple, invencibilidad al reaparecer.
- [x] El HUD React muestra Score/Vidas/Nivel **reales** provenientes del motor (no aleatorios). El canvas ya no dibuja su HUD interno.
- [x] Botón **Pausa** congela el juego y lo reanuda; **Fin** termina y abre el modal de fin con la puntuación real; **Salir** vuelve a `/juego/asteroides`.
- [x] Al terminar (Game Over del motor o botón Fin) aparece el modal con la puntuación final real; el guardado sigue siendo el falso (`setSaved`).
- [x] Al desmontar la página (Salir/navegar) el motor hace `destroy()` — sin listeners ni rAF colgando (sin fugas).
- [x] Los otros juegos del catálogo siguen mostrando el placeholder falso sin regresión.
- [x] `npm run build` compila sin errores.

---

## Decisions

- **Sí:** motor portado a **módulo TS** con `init/destroy` y callbacks, en vez de iframe o copiar `game.js` crudo — integra con el HUD React existente y respeta strict mode.
- **Sí:** juego **nuevo `asteroides`**, no reutilizar `rocas`. El `rocas` del catálogo es placeholder de otro estilo; el usuario quiere una entrada propia con id `asteroides`.
- **Sí:** **HUD React** alimentado por eventos del motor; se elimina `drawHUD`/`drawOverlay` del canvas — evita doble HUD y unifica estilo.
- **Sí:** guardado de puntuación **falso** por ahora — no hay tabla `scores` (spec 04 dejó tablas fuera). Persistencia real = spec futura dependiente de Auth + schema.
- **Sí:** solo `asteroides` usa motor real (rama `if id`), sin registro genérico — evita sobre-ingeniería con un único juego portado.
- **Sí:** reutilizar `cover-rocas` como portada — evita añadir CSS de cover nuevo; ajustable después.
- **No:** controles táctiles / sonido — fuera de alcance de esta spec.

---

## Risks

- **Foco de teclado / scroll:** los listeners van en `window`; `Espacio`/flechas pueden hacer scroll de la página. Mitigar con `preventDefault` en las teclas del juego mientras está activo.
- **Fugas al navegar:** si `destroy()` no quita listeners o no cancela rAF, quedan corriendo tras salir. Cubierto por criterio de aceptación y cleanup de `useEffect`.
- **SSR:** el motor toca `window`/`canvas`; debe correr solo en cliente (`GamePlayer` ya es `"use client"`, e `init` va en `useEffect`).
- **Escalado del canvas:** 800×600 escalado por CSS a 4/3 puede verse borroso en pantallas HiDPI; aceptable para MVP, ajuste de `devicePixelRatio` queda como mejora futura.
