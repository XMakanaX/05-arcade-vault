# SPEC 01 — MVP visual: pantallas de Arcade Vault

> **Status:** Implementado
> **Depends on:** —
> **Date:** 2026-07-13
> **Objective:** Portar las 5 pantallas del prototipo en `references/templates/` a la app Next.js como rutas reales App Router, solo la capa visual, sin ningún juego funcional.

---

## Section 1 — Por qué existe esta spec

El prototipo en `references/templates/` es una SPA con React 18 vía CDN, Babel en el navegador y un router basado en `location.hash`. No es utilizable como base de la app real (Next 16.2.10, React 19, App Router, TypeScript, Tailwind v4). Esta spec traslada ese prototipo a la estructura idiomática de Next para tener un MVP navegable sobre el que luego se enchufarán los juegos reales y la persistencia en base de datos.

---

## Scope

**In:**

- 5 pantallas como rutas App Router:
  - `/` — Biblioteca (grid de juegos, buscador, chips de categoría).
  - `/juego/[id]` — Detalle de juego (portada, info, stats, leaderboard).
  - `/juego/[id]/jugar` — Reproductor (placeholder: simulador visual del template).
  - `/salon` — Salón de la Fama (podio + tabla por juego).
  - `/acceder` — Autenticación (tabs iniciar sesión / crear cuenta, invitado, social).
- Barra de navegación compartida (`Nav`) en el layout, con enlaces activos según la ruta y panel móvil.
- Footer compartido en el layout (© Arcade Vault, versión).
- Datos ficticios en `app/data/` (catálogo de juegos, categorías, generador determinista de puntuaciones).
- Estado de sesión en memoria (React Context) para reflejar login/nombre en Nav, Salón y Reproductor durante la sesión.
- Reutilización del CSS ya portado en `app/globals.css` (temas, tarjetas, portadas CSS, CRT, etc.).

**Out of scope (para futuras specs):**

- Cualquier juego real o lógica de juego jugable.
- Persistencia real (base de datos, API, guardado de puntuaciones entre recargas).
- Autenticación real (validación, OAuth Google/GitHub — los botones son visuales).
- Guardado de puntuación funcional en el reproductor (el modal es visual, no persiste).
- Tests automatizados.
- Internacionalización (la app es solo español).

---

## Data model

Datos ficticios tipados en `app/data/`. No hay base de datos; a futuro estas estructuras se reemplazarán por consultas.

```ts
// app/data/games.ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;        // slug, p.ej. "bloque-buster"
  title: string;
  short: string;     // descripción corta (tarjeta)
  long: string;      // descripción larga (detalle)
  cat: GameCategory;
  cover: string;     // clase CSS de portada, p.ej. "cover-bricks"
  color: GameColor;  // acento del botón JUGAR
  best: number;      // mejor puntuación global
  plays: string;     // partidas, p.ej. "12.4K"
}

export const GAMES: Game[];          // 8 juegos (copiados del template)
export const CATS: readonly string[]; // ["TODOS","ARCADE","PUZZLE","SHOOTER","VERSUS"]
```

```ts
// app/data/leaderboard.ts
export interface ScoreRow { rank: number; name: string; score: number; date: string; }
export function seededScores(seed: number, count?: number): ScoreRow[]; // determinista
```

```ts
// app/components/session-context.tsx
export interface SessionUser { name: string; }  // solo el nombre en el MVP
// Context: { user: SessionUser | null, signIn(name), signOut() } — estado en memoria
```

Convenciones:
- Los `id` de juego son los slugs del template (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`).
- Las clases de portada (`cover-bricks`, `cover-tetro`, …) ya existen en `app/globals.css`.
- `seededScores` es determinista por semilla para que detalle y salón muestren tablas estables.

---

## Implementation plan

Cada paso deja la app compilando y navegable.

1. **Datos.** Crear `app/data/games.ts` (`Game`, `GameCategory`, `GameColor`, `GAMES`, `CATS`) y `app/data/leaderboard.ts` (`ScoreRow`, `seededScores`), portados de `references/templates/data.jsx`.
2. **Sesión.** Crear `app/components/session-context.tsx` (`"use client"`): provider con `user` en memoria y `signIn`/`signOut`; hook `useSession`. Envolver `children` con el provider en `app/layout.tsx`.
3. **Nav + footer.** Crear `app/components/Nav.tsx` (`"use client"`, usa `usePathname`, `next/link`, `useSession`, panel móvil). Montar `<Nav/>` sobre `<main>` y añadir el `<footer>` en `app/layout.tsx`. Verificar: enlaces activos y botón de sesión cambian según ruta/estado.
4. **Biblioteca (`/`).** Reescribir `app/page.tsx` (`"use client"`): hero + buscador + chips + grid de `GameCard`. Extraer `GameCard` a `app/components/GameCard.tsx` (tilt con ref, `Link` a `/juego/[id]`). Verificar: filtro por texto y categoría, estado "sin resultados".
5. **Detalle (`/juego/[id]`).** Crear `app/juego/[id]/page.tsx` (server component, `params` es `Promise`): portada, tags, descripción, `stat-strip`, leaderboard con `seededScores`. Botones a `/juego/[id]/jugar` y `/`. `notFound()` si el `id` no existe. `generateStaticParams` con los ids de `GAMES`.
6. **Reproductor (`/juego/[id]/jugar`).** Crear `app/juego/[id]/jugar/page.tsx` como server wrapper que resuelve `params` y renderiza un client `GamePlayer` (`app/components/GamePlayer.tsx`) portado de `reproductor.jsx`: HUD, simulador CRT, pausa, FIN, modal game-over (guardar es solo visual). Toma el nombre desde `useSession`.
7. **Salón (`/salon`).** Crear `app/salon/page.tsx` (`"use client"`): tabs por juego, podio top-3, tabla con `seededScores`, fila "tu marca" si hay sesión.
8. **Acceder (`/acceder`).** Crear `app/acceder/page.tsx` (`"use client"`): card con tabs, formulario visual, botón invitado y sociales; al enviar llama `signIn(nombre)` y `router.push("/")`.

---

## Acceptance criteria

- [x] `npm run dev` arranca sin errores y `npm run build` compila sin errores de tipos.
- [x] `/` muestra el grid con los 8 juegos; escribir en el buscador filtra por título; los chips filtran por categoría; sin coincidencias aparece "NO HAY RESULTADOS".
- [x] Click en una tarjeta (o en JUGAR) navega a `/juego/[id]` con la URL correcta.
- [x] `/juego/bloque-buster` muestra portada, descripción larga, `stat-strip` y leaderboard; un id inexistente (`/juego/nope`) responde con página 404.
- [x] Desde el detalle, "JUGAR AHORA" navega a `/juego/[id]/jugar` y muestra el HUD + pantalla CRT; la puntuación se incrementa sola, PAUSA la congela, FIN abre el modal de game-over.
- [x] `/salon` cambia de juego con las tabs y muestra podio + tabla; tras iniciar sesión aparece la fila "TU MEJOR MARCA".
- [x] `/acceder` alterna las tabs iniciar sesión / crear cuenta (el campo correo aparece solo en crear cuenta); enviar el formulario o "JUGAR COMO INVITADO" navega a `/` y el Nav refleja el estado de sesión.
- [x] La navegación entre pantallas usa `next/link` y el enlace activo del Nav corresponde a la ruta actual.

---

## Decisions

- **Sí:** rutas reales App Router (`/`, `/juego/[id]`, `/juego/[id]/jugar`, `/salon`, `/acceder`). URLs compartibles y back/forward nativo. Descarta el hash-router del template.
- **Sí:** slugs de ruta en español (`juego`, `salon`, `acceder`), coherente con el idioma del proyecto.
- **Sí:** datos ficticios en `app/data/` como módulos TS tipados. Frontera clara para sustituir por base de datos más adelante.
- **Sí:** sesión en memoria vía React Context. Suficiente para el MVP visual; el Nav/Salón reflejan el login dentro de la sesión.
- **No:** persistir sesión/puntuaciones en `localStorage` (lo hacía el template). El usuario indicó que los datos vendrán de una base de datos; no se introduce almacenamiento intermedio ahora.
- **Sí:** detalle como server component (`seededScores` determinista, `generateStaticParams`); biblioteca, salón, reproductor y acceder como client components por su estado/interacción.
- **Sí:** reutilizar el CSS ya portado en `app/globals.css` sin reescribirlo; solo se añaden clases si faltara alguna.
- **No:** implementar juegos, OAuth o guardado real. Explícitamente fuera de alcance.

---

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `params` es `Promise` en Next 16 y romper si se usa sincrónico | Rutas dinámicas hacen `await params` (usar `PageProps<'/juego/[id]'>`). |
| Estado de sesión en memoria se pierde al recargar | Aceptado para el MVP visual; documentado. Persistencia real irá en otra spec. |
| Componentes con estado/efectos marcados como server component | Marcar `"use client"` en biblioteca, salón, reproductor, acceder, Nav y GameCard. |

---

## Lo que **no** entra en esta spec

- Juegos reales o cualquier lógica jugable.
- Persistencia real (base de datos, API, guardado de puntuaciones).
- Autenticación real (validación / OAuth).
- Tests automatizados e i18n.

Cada uno, si llega, irá en su propia spec.
