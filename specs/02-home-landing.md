# SPEC 02 — Home: pantalla de inicio (landing)

> **Status:** Aprobado
> **Depends on:** 01-mvp-pantallas-visuales
> **Date:** 2026-07-13
> **Objective:** Portar `home.jsx` del template como nueva ruta `/` (landing), moviendo la Biblioteca actual a `/biblioteca` y actualizando el Nav, sin implementar `about.jsx`.

---

## Scope

**In:**

- Nueva ruta `/` — Home (landing): hero, sección "Por qué Arcade Vault" (4 features), preview de juegos (6 de `GAMES`), stats, actividad en vivo (ticker de puntuaciones + top 5), pricing/FAQ, CTA final.
- Mover Biblioteca de `/` a `/biblioteca` (renombrar `app/page.tsx` actual a `app/biblioteca/page.tsx`).
- Actualizar `app/components/Nav.tsx`: agregar enlace "Inicio" (`/`), Biblioteca apunta a `/biblioteca`, mantener Salón e Iniciar Sesión. Sin enlace "Acerca de".
- Actualizar todos los `Link`/`navigate` internos que hoy apuntan a `/` esperando Biblioteca (CTAs de Home, GameCard, detalle, reproductor, salón, acceder, footer) para que apunten a `/biblioteca` donde corresponda.
- CSS de Home portado a `app/globals.css` (hero, feature-grid, mini-rail, stats, activity-grid, pricing-grid, final CTA, silhouettes).
- Ticker "últimas puntuaciones" y "top jugadores" alimentados con `seededScores()` de `app/data/leaderboard.ts` (semilla fija) en vez de arrays hardcodeados del template.

**Out of scope (para futuras specs):**

- Pantalla `about.jsx` y su enlace en Nav.
- Cualquier dato real/dinámico (todo sigue siendo visual/ficticio, igual que spec 01).
- Cambios al modelo de datos `Game` o `GAMES`.
- Tests automatizados.

---

## Data model

No se introducen tipos ni estructuras nuevas. Home reutiliza lo existente:

- `GAMES` (`app/data/games.ts`) → `GAMES.slice(0, 6)` para el preview de juegos.
- `seededScores(seed, count)` (`app/data/leaderboard.ts`) → dos usos con semillas fijas distintas:
  - **Ticker "últimas puntuaciones":** `seededScores(seedA, 7)`. Cada `ScoreRow` (`rank, name, score, date`) se combina en el componente con: nombre del juego = `GAMES[i % GAMES.length].title`, etiqueta de tiempo = array estático local `["hace 2 min", "hace 5 min", ...]` (7 valores, mismo criterio visual del template ya que `ScoreRow.date` no es relativo), color = ciclo fijo `["magenta","yellow","green","cyan"]` por índice.
  - **Top 5 jugadores:** `seededScores(seedB, 5)` usado directo (`rank→#, name→jugador, score→puntos`), sin adaptación.
- Stats de la sección `home-stats` (`12+ JUEGOS`, `MILES DE PARTIDAS`, `GLOBAL RANKING`) quedan como texto estático igual que el template (no hay fuente de datos real para partidas/ranking global).

---

## Implementation plan

Cada paso deja la app compilando y navegable.

1. **Mover Biblioteca.** Renombrar `app/page.tsx` → `app/biblioteca/page.tsx` (mismo contenido). Verificar: `/biblioteca` muestra el grid, buscador y chips igual que antes.
2. **CSS de Home.** Portar a `app/globals.css` las clases usadas por `home.jsx` y sus silhouettes: `.home`, `.home-hero`, `.home-silos`/`.silo`, `.hero-eyebrow`, `.home-title`, `.home-sub`, `.home-ctas`, `.hero-scroll`, `.home-section`, `.section-head/.kicker/.section-title/.section-rule`, `.feature-grid/.feature-card/.ft-icon/.ft-title/.ft-desc`, `.mini-rail/.mini-card/.mini-cover/.cover-bg/.mini-meta/.mini-title/.mini-cat`, `.home-stats/.stats-inner/.stat-block/.stat-n/.stat-u/.stat-s`, `.activity-grid/.activity-card/.ac-head/.ac-title/.ticker/.tick-row/.tk-*/.top-list/.top-row/.top1/.top2/.top3/.tp-*`, `.pricing-grid/.price-card/.pc-*/.pricing-faq/.faq-item/.faq-q/.faq-a`, `.home-final/.final-title/.final-cta/.final-tag`, `.reveal/.in` (IntersectionObserver reveal).
3. **Componente Home.** Crear `app/page.tsx` nuevo (`"use client"`, reemplaza la Biblioteca actual): portar `FloatingSilhouettes`, `MiniCard`, `FeatureIcon`, hook `useReveal` y el componente `Home` de `references/templates/home-about/home.jsx`, adaptado a React 19/Next: `useRouter()`/`Link` en vez de `navigate`, `GAMES.slice(0,6)` para el rail, ticker y top 5 desde `seededScores` (ver Data model). CTAs: "EXPLORAR JUEGOS" y "VER TODOS LOS JUEGOS" → `/biblioteca`; "CREAR CUENTA"/"EMPEZAR GRATIS"/"INSERTAR MONEDA" → `/acceder`; "VER SALÓN" → `/salon`. Verificar: `/` renderiza todas las secciones, animaciones `reveal` disparan al hacer scroll, todos los CTA navegan a la ruta correcta.
4. **Nav.** Editar `app/components/Nav.tsx`: agregar `Link href="/"` "Inicio" (desktop + panel móvil), cambiar el `Link` de "Biblioteca" a `href="/biblioteca"`, actualizar `isActive` para distinguir `home` (`pathname === "/"`) de `biblioteca` (`pathname === "/biblioteca" || pathname.startsWith("/juego")`). Verificar: enlace activo correcto en `/`, `/biblioteca` y `/juego/[id]`.
5. **Referencias internas.** Revisar `app/components/GameCard.tsx`, `app/juego/[id]/page.tsx`, `app/juego/[id]/jugar/page.tsx` (incluye `GamePlayer.tsx`), `app/salon/page.tsx`, `app/acceder/page.tsx` y el logo del Nav: todo enlace/botón que hoy navega a `/` esperando volver a la Biblioteca debe apuntar a `/biblioteca`; el logo y cualquier "volver al inicio" real sigue apuntando a `/`. Verificar: no queda ningún enlace roto o que aterrice en Home por error.

---

## Acceptance criteria

- [ ] `npm run dev` arranca sin errores y `npm run build` compila sin errores de tipos.
- [ ] `/` muestra Home completo: hero, 4 feature cards, rail de 6 juegos, stats, ticker de actividad (7 filas) + top 5 jugadores, pricing/FAQ, CTA final.
- [ ] `/biblioteca` muestra el grid de juegos con buscador y chips (comportamiento idéntico al que tenía antes en `/`).
- [ ] Nav muestra Inicio, Biblioteca, Salón de la Fama (sin Acerca de); el enlace activo corresponde a la ruta actual en `/`, `/biblioteca` y `/juego/[id]`.
- [ ] Todos los CTA de Home navegan correctamente: "EXPLORAR JUEGOS"/"VER TODOS LOS JUEGOS" → `/biblioteca`, "CREAR CUENTA"/"EMPEZAR GRATIS"/"INSERTAR MONEDA" → `/acceder`, "VER SALÓN" → `/salon`, click en tarjeta del rail → `/juego/[id]`.
- [ ] Ningún enlace previamente apuntado a `/` (logo excluido) quedó apuntando a Home en vez de Biblioteca.
- [ ] Animaciones `reveal` (IntersectionObserver) funcionan al hacer scroll en `/`.

---

## Decisions

- **Sí:** Home pasa a ser `/`, Biblioteca se mueve a `/biblioteca`. Replica la separación Inicio/Biblioteca del template original (`nav.jsx` ya las trataba como rutas distintas).
- **Sí:** Nav agrega "Inicio" pero no "Acerca de" — about queda explícitamente fuera de alcance, no se agrega un enlace roto.
- **Sí:** ticker y top 5 de Home usan `seededScores()` existente en vez de arrays hardcodeados del template, para reducir duplicación de datos ficticios. El nombre de juego y las etiquetas de tiempo del ticker se resuelven con lógica local simple (no requieren nuevo tipo).
- **Sí:** stats de la sección `home-stats` quedan como texto estático (no hay fuente real de "partidas jugadas" ni "ranking global" en este MVP).
- **No:** tocar `app/data/games.ts` — Home solo lee `GAMES`, no se agregan campos como "destacado".
- **Sí:** Home como client component (`"use client"`), igual criterio que Biblioteca/Salón en spec 01, por el hook `useReveal` (IntersectionObserver) y los CTAs interactivos.

---

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Enlaces rotos al mover Biblioteca de `/` a `/biblioteca` | Paso 5 del plan revisa explícitamente cada archivo que enlaza a `/`. |
| CSS de Home choca con clases existentes en `globals.css` (nombres genéricos como `.stat-block`) | Revisar colisiones al portar; template usa prefijos específicos (`home-`, `mini-`, `tk-`, `tp-`, `pc-`) que ya evitan la mayoría. |
| `seededScores` no trae nombre de juego ni tiempo relativo, forzando lógica extra en el componente Home | Mapeo local descrito en Data model (índice de juego + arrays estáticos de tiempo/color), sin nuevo tipo ni cambio a `leaderboard.ts`. |
