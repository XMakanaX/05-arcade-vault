# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Idioma

Responder siempre en español en este proyecto.

## Project

Arcade Vault — online arcade platform, play games, compete for high scores (see README.md). App Router, TS, Tailwind v4. Ya funcional: leaderboard real vía Supabase. Lista de juegos crece con el tiempo — no asumir que solo son asteroids/tetris/arkanoid/snake; consultar `references/implemented-games.md` para saber cuáles están implementados y cómo.

## Critical: non-standard Next.js version

`next` is pinned to `16.2.10` — not the version in your training data. Behavior, APIs, and conventions may differ from what you expect. Before writing any Next.js code (routing, data fetching, config, server/client components, etc.), check `node_modules/next/dist/docs/` for the relevant guide:

- `01-app/` — App Router
- `02-pages/` — Pages Router
- `03-architecture/` — internals
- `04-community/`

Heed deprecation notices found there over prior Next.js knowledge.

## Skills

- Usa siempre `/frontend-design` para diseñar la interfaz de usuario.
- Usa `/nuevo-juego` antes de integrar un juego nuevo (portado de `references/started-games` o desde cero): genera spec + engine template + migration template + snippet de registro.

## Spec-driven workflow

This repo follows spec-driven design via `/spec` and `/spec-impl` commands, based on https://github.com/Klerith/fernando-skills.

Specs viven en `specs/` (9 specs numeradas). 01-05 y 07-09 marcadas "Implementado"; 06 (`06-games-scores-supabase.md`) marcada "Aprobado" pese a que su código ya está en producción — inconsistencia de estado a tener en cuenta, no corregir sin que lo pida el usuario.

`.claude/skills/` es la ubicación autoritativa de skills del proyecto (`spec`, `spec-impl`, `nuevo-juego`). Existe una copia duplicada/antigua en `.agents/skills/` — no usarla.

## Architecture

- App Router bajo `app/` (no hay `components/`/`lib/` en la raíz del repo, todo vive anidado en `app/`).
- Path alias `@/*` apunta a la raíz del repo (ver `tsconfig.json`).
- Estilos: Tailwind CSS v4 vía `@tailwindcss/postcss`, estilos globales en `app/globals.css`.
- `tsconfig.json` en modo strict, `moduleResolution: bundler`, sin emit (solo type-check, Next maneja el build).

### Rutas/páginas

`app/page.tsx` + `HomeClient.tsx` (home), `app/biblioteca/` (catálogo), `app/juego/[id]/` y `app/jugar/` (detalle/jugar), `app/salon/` (hall of fame / leaderboard global), `app/acceder/` (login falso), `app/about/`.

### Juegos

Motores TS de canvas standalone en `app/games/{asteroids,tetris,arkanoid,snake}/engine.ts`, registrados en `app/games/registry.ts` (`engineRegistry`). Montados por `app/components/GamePlayer.tsx`, que al game-over envía el score a Supabase. Portados desde `references/started-games/*` (implementaciones JS de referencia).

### Supabase (datos y scoring)

- Clientes: `app/lib/supabase/client.ts` (browser), `server.ts` (server), `database.types.ts` (tipos generados).
- Capa de acceso a datos: `app/lib/supabase/queries.ts` — `getGames`, `getGame`, `getTopScores`, `getScoreCount`, `insertScore`.
- Tablas `games` y `scores` (ver spec 06). Sin ORM. Sin migraciones locales — el schema se aplicó directo al proyecto remoto vía MCP de Supabase (no hay carpeta `supabase/migrations`).

### Auth

No hay auth real todavía. `app/components/session-context.tsx` es una sesión falsa client-side (solo nombre en estado React). La inserción de scores es pública/no autenticada por diseño (riesgo documentado en spec 06).

### API routes

`app/api/contact/route.ts` (formulario de contacto vía Resend), `app/api/health/route.ts` (chequeo de salud de Supabase).

### Código muerto conocido

`app/data/games.ts` — roster mock estático, ya no se importa en `app/`. La lista real de juegos viene de Supabase. Candidato a eliminar, pero fuera de alcance salvo que se pida explícitamente.
