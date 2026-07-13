# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Idioma

Responder siempre en español en este proyecto.

## Project

Arcade Vault — online arcade platform, play games, compete for high scores (see README.md). Currently a fresh `create-next-app` scaffold (App Router, TS, Tailwind v4) with no game/scoring code yet.

## Critical: non-standard Next.js version

`next` is pinned to `16.2.10` — not the version in your training data. Behavior, APIs, and conventions may differ from what you expect. Before writing any Next.js code (routing, data fetching, config, server/client components, etc.), check `node_modules/next/dist/docs/` for the relevant guide:
- `01-app/` — App Router
- `02-pages/` — Pages Router
- `03-architecture/` — internals
- `04-community/`

Heed deprecation notices found there over prior Next.js knowledge.

## Spec-driven workflow

This repo follows spec-driven design via `/spec` and `/spec-impl` commands, based on https://github.com/Klerith/fernando-skills. Skills are installed via:

```bash
npx skills@latest add Klerith/fernando-skills
```

## Commands

```bash
npm run dev      # start dev server
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint (flat config, eslint-config-next core-web-vitals + typescript)
```

No test runner is configured yet.

## Architecture

- App Router under `app/`: `app/layout.tsx` (root layout, Geist fonts), `app/page.tsx` (home).
- Path alias `@/*` maps to repo root (see `tsconfig.json`).
- Styling: Tailwind CSS v4 via `@tailwindcss/postcss`, global styles in `app/globals.css`.
- `tsconfig.json` is strict mode, `moduleResolution: bundler`, no emit (type-check only, Next handles the build).
