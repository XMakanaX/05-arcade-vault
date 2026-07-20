---
name: nuevo-juego
description: Genera una spec para integrar un juego nuevo (portado de references/started-games o creado desde cero) con su leaderboard en la plataforma — motor TS con API estándar, registro de motores, y siembra de las tablas games/scores en Supabase. Úsalo antes de implementar un juego nuevo.
disable-model-invocation: true
argument-hint: "<carpeta de reference o nuevo:<slug>> (ej. 03-tetris | tetris | nuevo:mi-juego)"
---

# /nuevo-juego — Generador de spec para integrar un juego + leaderboard

Este skill **no escribe código**. Antes de escribir el archivo de especificación, **lee la skill `/spec`** (`.claude/skills/spec/SKILL.md` y `.claude/skills/spec/template.md`) y sigue su método y estructura al pie de la letra. Produce una spec en `specs/`, pre-llenada con el plan concreto para portar/crear el motor del juego, registrarlo, y sembrar Supabase. La implementación real la hace `/spec-impl` después de aprobar la spec.

## Contexto de sesión

Specs en el repo:
!`ls specs/ 2>/dev/null || echo "specs/ no existe"`

Juegos de referencia disponibles:
!`ls references/started-games/ 2>/dev/null || echo "sin references/started-games"`

Motores ya portados:
!`ls app/games/ 2>/dev/null || echo "app/games/ no existe todavía"`

Registro de motores (si ya existe):
!`cat app/games/registry.ts 2>/dev/null || echo "app/games/registry.ts no existe todavía — primer juego nuevo lo crea"`

Config de specs:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, sin archivo de config)"`

---

## Filosofía

Este skill reusa el **contrato ya validado en `specs/05-asteroides-integracion.md` y `specs/06-games-scores-supabase.md`**: motor TS con `init/pause/resume/restart/destroy` + callbacks `onScore/onLives/onLevel/onGameOver`, fila en tabla `games`, filas seed en `scores`. No reinventa ese contrato — lo aplica a un juego nuevo.

Responde siempre en español (idioma del repo).

## Fase 1 — Identificar la fuente

El argumento recibido es: `$ARGUMENTS`

Dos formas válidas:

1. **Reference existente** — nombre de carpeta bajo `references/started-games/` (completo `03-tetris` o parcial `tetris`). Si no calza con ninguna carpeta listada arriba, mostrar las disponibles y pedir corrección.
2. **`nuevo:<slug>`** — motor construido desde cero, sin `game.js` de origen.

Si `$ARGUMENTS` viene vacío, preguntar cuál de las dos formas aplica.

### Si es reference existente

Leer el `game.js` (y `levels.js`/`assets/*` si existen) de esa carpeta. Extraer y reportar al usuario:

- Tamaño de canvas (`W`/`H`).
- Cómo se rastrean score/lives/level (variables, cuándo cambian).
- Input (teclado, mouse, ambos).
- **Esfuerzo de port** (bajo/medio/alto) según acoplamientos detectados:
  - **Bajo** — ya orientado a objetos (`class` con `update(dt)/draw()`), solo teclado, primitivas canvas. Ej.: `02-asteroids` (ya portado, sirve de referencia en `app/games/asteroids/engine.ts`).
  - **Medio** — procedural con estado en `let` globales, HUD/pausa/tema acoplados al DOM (`document.getElementById`, `localStorage`) que hay que desacoplar. Ej.: `03-tetris`.
  - **Medio-alto** — además de lo anterior, depende de un loader de assets (spritesheet, audio) o dibuja UI de pausa en el canvas con hit-test de mouse. Ej.: `04-arkanoid`.
- Señalar explícitamente qué piezas **no** se portan tal cual (HUD en DOM, `localStorage`, audio, mouse UI) porque el contrato del motor las reemplaza por callbacks hacia React.

### Si es `nuevo:<slug>`

No hay `game.js` que leer. Preguntar mecánica básica (qué hace subir el score, qué hace perder una vida, qué dispara nivel) solo para completar la sección de Data model de la spec — sin diseñar el juego en detalle, eso es trabajo de implementación.

## Fase 2 — Recolectar metadata (AskUserQuestion, en bloques)

Necesario para la fila en `games` y para el plan:

1. **`id`** (slug, minúsculas, sin espacios — es la primary key de `games` y la ruta `/juego/<id>`).
2. **`title`**, **`short`** (tarjeta), **`long`** (detalle).
3. **`cat`**: `ARCADE` | `PUZZLE` | `SHOOTER` | `VERSUS`.
4. **`cover`**: reusar clase `cover-*` existente en `app/globals.css` (listar las disponibles: `cover-bricks`, `cover-tetro`, `cover-snake`, `cover-glot`, `cover-invaders`, `cover-rocas`, `cover-rana`, `cover-duelo`) o crear una nueva.
5. **`color`**: acento del botón JUGAR.
6. **Seed de scores ficticios**: sembrar o no, y si sí, cuántas filas / rango de puntuación (para no dejar el leaderboard vacío, mismo patrón que `06-games-scores-supabase.md`).

No asumir valores — si el usuario no da uno, preguntar.

## Fase 3 — Leer la skill `/spec` y escribir la spec

**Paso previo obligatorio, antes de escribir nada:** leer con la herramienta Read, en este orden:

1. `.claude/skills/spec/SKILL.md` — el método completo: orden de secciones, regla del objetivo en una frase, cómo se numeran los archivos en `specs/`, que el estado inicial siempre es `Draft` (nunca `Approved` automático), y que la sección de Decisiones es la de más valor.
2. `.claude/skills/spec/template.md` — la forma exacta de cada sección (Header en blockquote, Scope In/Out ambos obligatorios, Data model con código real no pseudocódigo, Implementation plan con pasos commiteables, Acceptance criteria booleana, Decisions con razón, Risks solo si aplica, cierre "What is NOT in").

La spec generada por este skill debe **seguir ese método y esa forma exactamente** — este skill no define su propia estructura, solo el _contenido_ que llena cada sección (ver más abajo). Numeración: siguiente número tras el último en `specs/` (ver listado arriba). Nombre de archivo: `specs/NN-<slug>-integracion.md`. Status inicial: `Draft`.

**Contenido pre-llenado obligatorio** (adaptar detalles al juego concreto, no copiar literal):

### Scope — In (siempre incluir estos puntos, adaptados)

- Motor `app/games/<slug>/engine.ts` — portado de `references/started-games/<carpeta>/game.js` (o nuevo) siguiendo el contrato de `.claude/skills/nuevo-juego/engine-template.ts`: `init<Name>(canvas, cb): { pause, resume, restart, destroy }`, callbacks `{ onScore, onLives, onLevel, onGameOver }`. Sin estado global de módulo, sin `any`.
- **Si `app/games/registry.ts` no existe todavía**: crearlo y migrar `asteroides` al registro (refactor único, ver `.claude/skills/nuevo-juego/registry-snippet.md`) — reemplaza el `if game.id === "asteroides"` hardcodeado en `GamePlayer.tsx`. Si ya existe, solo agregar la entrada `<id>: init<Name>`.
- Fila en `games` (Supabase) con la metadata de Fase 2, vía migración basada en `.claude/skills/nuevo-juego/migration-template.sql`. Seed de `scores` si se decidió en Fase 2.
- Clase `cover-<slug>` en `app/globals.css` solo si Fase 2 decidió cover nueva.

### Scope — Out (siempre incluir, salvo que ya estén cubiertos)

- Auth real / anti-cheat en el insert de score (mismo riesgo aceptado que spec 06).
- Controles táctiles / sonido, salvo que el usuario pida explícitamente lo contrario.
- Registrar más juegos además de este (el registro queda listo para el próximo, no se anticipan otros).

### Data model

Reusa el modelo ya existente de `games`/`scores` (no se crean tablas nuevas) — solo una fila nueva. Citar los tipos ya existentes en `app/lib/supabase/queries.ts` (`Game`, `ScoreRow`) sin repetirlos si no cambian. Incluir el `AsteroidsCallbacks`-equivalente tipado para este juego (nombre real, no genérico).

### Implementation plan (5 pasos, ajustar numeración si el registro ya existe)

1. **Motor.** Crear `app/games/<slug>/engine.ts` (portar o nuevo) con la API estándar. Sin globals, sin `any`, `destroy()` limpio (cancela rAF, quita listeners).
2. **Registro.** Crear `app/games/registry.ts` si falta (migrando `asteroides`) o agregar entrada `<id>`. Editar `GamePlayer.tsx`: reemplazar el chequeo `game.id === "asteroides"` por lookup en el registro.
3. **Supabase.** `apply_migration`: insert en `games` + seed en `scores` si aplica. Verificar con `list_tables`/`execute_sql`.
4. **Cover CSS** (si aplica). Nueva clase en `app/globals.css`.
5. **Verificación.** `npm run build`; `npm run dev`; recorrer `/biblioteca`, `/juego/<id>` (detalle + leaderboard sembrado), `/juego/<id>/jugar` (juego real, HUD real), jugar hasta game-over y confirmar insert real; `/salon` (tab/podio). Confirmar que asteroides sigue funcionando sin regresión si se tocó el registro.

### Acceptance criteria (booleanas, adaptar al juego)

Incluir siempre:

- [ ] `app/games/<slug>/engine.ts` exporta motor con `init/pause/resume/restart/destroy`, sin `any`, sin estado global de módulo.
- [ ] `GamePlayer.tsx` monta el motor vía el registro (no una rama `if` nueva hardcodeada).
- [ ] Fila `<id>` existe en `games` (verificable con `list_tables`/`execute_sql`).
- [ ] `/biblioteca` muestra la tarjeta del juego nuevo junto a asteroides, sin regresión.
- [ ] `/juego/<id>` y `/juego/<id>/jugar` funcionan; jugar una partida inserta score real en `scores`.
- [ ] `npm run build` compila sin errores.
- [ ] Asteroides sigue jugable sin regresión (si el paso 2 tocó `GamePlayer.tsx`/registro).

### Decisions (siempre incluir esta, con la razón dada por el usuario)

- **Sí:** motor sigue el contrato estándar (`init/pause/resume/restart/destroy` + callbacks) en vez de una API ad-hoc — permite registrarlo sin ramas nuevas en `GamePlayer` y reutiliza el patrón validado en spec 05.

Agregar las decisiones específicas que hayan salido en Fase 1/2 (ej. cover reusada vs nueva, cuántos scores seed).

### Risks (si aplica, según el esfuerzo de port detectado en Fase 1)

Para port medio/alto, incluir el riesgo concreto (ej. "loader de assets/audio no tiene equivalente en el contrato del motor — mitigación: cargar en `init` antes de arrancar el loop, exponer estado 'cargando' si hace falta").

## Fase 4 — Guardar

Mismo procedimiento que `/spec`: confirmar nombre de archivo con el usuario antes de escribir, `Status: Draft`, no tocar `specs/.spec-config.yml` si ya existe, recordar que el siguiente paso es aprobar la spec y correr `/spec-impl NN-<slug>-integracion`.

## Reglas duras

- **Nunca escribir código ni tocar Supabase en este skill.** Solo el archivo `.md` de la spec.
- **Nunca generar la spec completa de un tiro** si el usuario quiere revisar secciones — igual que `/spec`, mostrar y confirmar por sección si el usuario lo pide; si el usuario prefiere ir directo, generar completa pero dejar claro que sigue en `Draft`.
- **No asumir metadata** (id/title/cat/cover/color) sin confirmar — siempre Fase 2.
- Los archivos de apoyo en este mismo directorio (`engine-template.ts`, `registry-snippet.md`, `migration-template.sql`) son la referencia de implementación citada en la spec — no los repitas íntegros dentro de la spec, solo referéncialos por ruta.
