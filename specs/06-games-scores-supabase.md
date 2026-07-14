# SPEC 06 — Games table + leaderboard (Supabase)

> **Status:** Aprobado
> **Depends on:** 04-supabase-integracion, 05-asteroides-integracion
> **Date:** 2026-07-14
> **Objective:** Crear tablas `games` y `scores` en Supabase (sembradas con asteroides + scores ficticios), reemplazar los datos en memoria de `app/data/*` por lecturas reales, y guardar el score real al terminar cada partida.

---

## Scope

**In:**

- Tabla `games` en Supabase: solo el juego real (`asteroides`).
- Tabla `scores` en Supabase: referencia `game_id`, guarda nombre + puntuación, insert público (sin auth real).
- Seed inicial: fila `asteroides` en `games` + scores ficticios en `scores` (mismos datos que hoy da `seededScores`, pero insertados como filas reales) para no mostrar vacío.
- `app/biblioteca/page.tsx`, `app/page.tsx` (rail de Home), `app/juego/[id]/page.tsx`, `app/salon/page.tsx` pasan a leer `games`/`scores` reales desde Supabase en vez de `app/data/*`.
- `GamePlayer.tsx`: al llegar a game-over, insert real en `scores` (nombre desde `useSession` o "invitado"), reemplaza el `saved` visual falso por el resultado real del insert.
- Eliminar `app/data/games.ts` y `app/data/leaderboard.ts`.

**Out of scope (para specs futuras):**

- Auth real / `user_id` en `scores` (queda `nombre` como texto libre).
- Más juegos reales aparte de asteroides (cuando se porten, se agregan filas a `games`).
- RLS restrictivo / API route server-side para insertar (insert público directo por ahora, riesgo documentado).
- Anti-cheat / validación de puntuación (nada evita mandar un score arbitrario).
- Paginación de leaderboard (se trae top N fijo).

---

## Data model

Dos tablas nuevas en Supabase (sin ORM, tipos TS derivados con `generate_typescript_types`).

```sql
-- games
create table games (
  id text primary key,           -- slug, ej. 'asteroides'
  title text not null,
  short text not null,            -- descripción corta (tarjeta)
  long text not null,             -- descripción larga (detalle)
  cat text not null,              -- 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS'
  cover text not null,            -- clase CSS de portada, ej. 'cover-rocas'
  color text not null,            -- acento del botón JUGAR
  created_at timestamptz not null default now()
);

-- scores
create table scores (
  id bigint generated always as identity primary key,
  game_id text not null references games(id),
  name text not null,             -- nombre libre (sesión o "invitado")
  score integer not null,
  created_at timestamptz not null default now()
);

create index scores_game_id_score_idx on scores (game_id, score desc);
```

```ts
// app/lib/supabase/queries.ts (nuevo)
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;
  color: string;
}
export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

export function getGames(): Promise<Game[]>;
export function getGame(id: string): Promise<Game | null>;
export function getTopScores(gameId: string, limit?: number): Promise<ScoreRow[]>; // limit default 10
export function insertScore(gameId: string, name: string, score: number): Promise<void>;
```

Convenciones:

- `rank` y `date` (ScoreRow) se calculan en la query/helper, no viven en la tabla (`rank` = orden por `score desc`, `date` = `created_at` formateado `dd/mm/aa`).
- `games.best`/`plays` (que hoy existían en el tipo ficticio) se eliminan del modelo — no hay fuente real para "plays"; "best" se deriva de `getTopScores(id, 1)`.
- Seed: 1 fila en `games` (asteroides, datos migrados desde `app/data/games.ts`) + ~7-10 filas en `scores` para `game_id='asteroides'` (mismos valores que generaba `seededScores` hoy) vía migración SQL.

---

## Implementation plan

Cada paso deja la app compilando y navegable.

1. **Migración SQL.** Crear tablas `games` y `scores` (con índice) vía `mcp__supabase__apply_migration`. Verificar con `mcp__supabase__list_tables`.
2. **Seed.** Insertar fila `asteroides` en `games` (datos migrados de `app/data/games.ts`) y ~8 filas ficticias en `scores` (mismos valores que hoy genera `seededScores`) vía migración SQL o `execute_sql`.
3. **Tipos.** Generar tipos con `mcp__supabase__generate_typescript_types` → `app/lib/supabase/database.types.ts`. Tipar los clientes existentes (`client.ts`, `server.ts`) con `Database`.
4. **Queries.** Crear `app/lib/supabase/queries.ts`: `getGames`, `getGame`, `getTopScores`, `insertScore` (cliente server para lecturas en server components, cliente browser para el insert desde `GamePlayer`).
5. **Biblioteca (`/biblioteca`).** Cambiar `app/biblioteca/page.tsx` a server component (o `use()` async) que llama `getGames()` en vez de importar `GAMES`. Verificar: grid muestra solo asteroides.
6. **Home (`/`).** Cambiar el rail de juegos y el "top 5"/ticker en `app/page.tsx` para usar `getGames()`/`getTopScores()` en vez de `GAMES`/`seededScores`. Verificar: secciones renderizan sin el juego ficticio.
7. **Detalle (`/juego/[id]`).** Cambiar `app/juego/[id]/page.tsx` a usar `getGame(id)` (404 si `null`) y `getTopScores(id)` para el leaderboard. Quitar `generateStaticParams` basado en `GAMES` (o regenerarlo desde `getGames()`).
8. **Salón (`/salon`).** Cambiar `app/salon/page.tsx` para listar tabs desde `getGames()` y tabla/podio desde `getTopScores(gameId)`.
9. **Guardado real.** Editar `GamePlayer.tsx`: en game-over, llamar `insertScore(gameId, name, score)` (nombre desde `useSession` o `"invitado"`); `saved` pasa a reflejar el resultado real del insert (loading/success/error) en vez de estar hardcodeado a `true`.
10. **Limpieza.** Eliminar `app/data/games.ts` y `app/data/leaderboard.ts` y cualquier import residual.
11. **Verificación final.** `npm run build` sin errores; `npm run dev`, recorrer `/`, `/biblioteca`, `/juego/asteroides`, `/salon`, jugar una partida y confirmar que el score nuevo aparece en el leaderboard tras recargar.

---

## Acceptance criteria

- [ ] Tablas `games` y `scores` existen en Supabase (verificable con `list_tables`), con la fila `asteroides` sembrada en `games`.
- [ ] `npm run build` compila sin errores de tipos.
- [ ] `/biblioteca` muestra solo la tarjeta de asteroides, leída desde `getGames()` (no de `app/data/games.ts`, que ya no existe).
- [ ] `/juego/asteroides` muestra detalle real y una tabla de leaderboard con las filas sembradas en `scores`; `/juego/nope` responde 404.
- [ ] `/salon` muestra tabs/podio/tabla con datos de `scores` vía `getTopScores`.
- [ ] Jugar una partida de asteroides hasta game-over inserta una fila real en `scores` (verificable con `execute_sql` o recargando `/juego/asteroides`).
- [ ] El modal de game-over refleja el resultado real del insert (no un `saved=true` hardcodeado).
- [ ] `app/data/leaderboard.ts` ya no existe en el repo y ningún archivo lo importa. `app/data/games.ts` se conserva por decisión explícita del usuario durante la implementación (queda huérfano, sin imports activos).
- [ ] Insert público en `scores` funciona sin sesión iniciada (nombre `"invitado"`).

---

## Decisiones tomadas y descartadas

- **Sí:** una sola spec para `games` + `scores` — están acopladas (`scores.game_id` referencia `games`), separar habría creado una spec 1 sin valor visible hasta la spec 2.
- **Sí:** solo se siembra `asteroides` en `games` — es el único juego real jugable hoy; los 7 ficticios de `app/data/games.ts` no tienen ruta `/jugar` funcional y se descartan en vez de mantenerlos como "próximamente".
- **No:** placeholders de juegos no jugables en la biblioteca — decisión explícita del usuario, prefiere solo mostrar lo real.
- **Sí:** guardado real del score en game-over (lectura + escritura), no solo lectura — decisión explícita del usuario.
- **Sí:** identidad por nombre libre (`useSession` o `"invitado"`), sin `user_id` — no hay auth real todavía; se resuelve en spec futura de auth.
- **No (revertido durante implementación):** guardado automático sin botón — el usuario pidió poder escribir/editar su nombre antes de guardar. Queda: input editable en game-over (precargado con sesión o "INVITADO"), insert real se dispara al confirmar "GUARDAR PUNTUACIÓN".
- **Sí:** insert público abierto en `scores` (sin RLS restrictivo ni API route intermedia) — mismo nivel de confianza que el resto del MVP sin auth; riesgo documentado abajo, se cierra cuando llegue auth real.
- **Sí:** se siembran scores ficticios reales en la tabla (no estado vacío) — decisión explícita del usuario para no perder el leaderboard poblado que ya existía visualmente.
- **Sí:** eliminar `app/data/games.ts` y `app/data/leaderboard.ts` por completo — ya no los importa ninguna página tras el reemplazo.
- **No:** paginación de leaderboard — top N fijo (10) alcanza para el alcance actual; se agrega si hace falta más adelante.

---

## Riesgos identificados

| Riesgo                                                                                                                              | Mitigación                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Insert público abierto en `scores` permite spam/scores arbitrarios (cualquiera con la publishable key inserta lo que quiera)        | Aceptado temporalmente (decisión explícita del usuario); se cierra con RLS + auth real en spec futura.                                     |
| Sin `user_id`, no hay forma de saber si un score es del mismo jugador repetido o de otro con el mismo nombre                        | Aceptado para MVP; nombre es solo texto libre, no identidad única.                                                                         |
| Borrar `app/data/games.ts`/`leaderboard.ts` puede romper imports olvidados en algún componente no listado en el plan                | Paso 10 incluye grep final de imports residuales antes de dar por cerrada la spec.                                                         |
| Migración de seed (scores ficticios) puede quedar desalineada si luego se agregan más juegos reales sin repetir el proceso de seed  | Documentado: cada juego nuevo real requiere su propia fila en `games` + seed opcional en `scores`.                                         |
| `generateStaticParams` en `/juego/[id]` dependía de `GAMES` estático; al pasar a datos dinámicos puede perder el prerender en build | Paso 7 exige regenerar `generateStaticParams` desde `getGames()` (o quitarlo si se prefiere render dinámico, a validar en implementación). |
