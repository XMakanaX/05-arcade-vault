# SPEC 04 — Integración base de Supabase con Next.js

> **Status:** Aprobado
> **Depends on:** —
> **Date:** 2026-07-14
> **Objective:** Instalar y configurar el cliente de Supabase (browser + server) en Next.js con verificación de conexión vía `/api/health`, sin implementar todavía auth real, tablas ni middleware de sesión.

---

## Scope

**In:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr`.
- Cliente Supabase para Browser (Client Components): `app/lib/supabase/client.ts`.
- Cliente Supabase para Server (Server Components / Route Handlers), usando `cookies()` async de `next/headers`: `app/lib/supabase/server.ts`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`.env.template` con placeholders vacíos, `.env.local` con valores reales del proyecto `wyqxsybyurmygvhsiytu`).
- Endpoint `app/api/health/route.ts` (`GET`) que instancia el cliente server y llama `supabase.auth.getSession()`, devuelve `{ ok: true }` si la conexión responde, `{ ok: false, error }` si falla.

**Out of scope (para specs futuras):**

- Auth real (login/signup/logout, reemplazo de `session-context` fake).
- Middleware de refresco de sesión (`middleware.ts`).
- Tablas de base de datos (games, scores, profiles) y su schema/RLS.
- Realtime.
- Edge Functions.

---

## Implementation plan

1. **Dependencias.** `npm install @supabase/supabase-js @supabase/ssr`.
2. **Variables de entorno.** Agregar a `.env.template` (placeholders vacíos) y `.env.local` (valores reales) `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, obtenidos del proyecto Supabase ya linkeado (`wyqxsybyurmygvhsiytu`) vía `mcp__supabase__get_project_url` y `mcp__supabase__get_publishable_keys`.
3. **Cliente browser.** `app/lib/supabase/client.ts`: `createBrowserClient` de `@supabase/ssr` con las env vars `NEXT_PUBLIC_*`.
4. **Cliente server.** `app/lib/supabase/server.ts`: `createServerClient` de `@supabase/ssr`, usando `await cookies()` (API async confirmada en `node_modules/next/dist/docs`) para `getAll`/`setAll`.
5. **Endpoint de salud.** `app/api/health/route.ts`: `GET` crea el cliente server, llama `supabase.auth.getSession()`, responde `{ ok: true }` (200) si no hay error de conexión, `{ ok: false, error: string }` (500) si falla.
6. **Verificación.** `npm run dev`, `GET /api/health` responde `{ ok: true }`.

---

## Acceptance criteria

- [ ] `@supabase/supabase-js` y `@supabase/ssr` agregados a `package.json`.
- [ ] `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` presentes en `.env.template` (vacíos) y `.env.local` (valores reales).
- [ ] `app/lib/supabase/client.ts` exporta un cliente browser funcional (`createBrowserClient`).
- [ ] `app/lib/supabase/server.ts` exporta un cliente server funcional (`createServerClient` con `cookies()` async).
- [ ] `npm run build` compila sin errores de tipos.
- [ ] `GET /api/health` responde `{ ok: true }` con status 200 contra el proyecto real.
- [ ] Ninguna key de Supabase (service role, DB password) queda expuesta en código cliente — solo `NEXT_PUBLIC_*` (anon key, segura para exponer) se usa en `app/lib/supabase/client.ts`.

---

## Decisions

- **Sí:** solo integración base (clientes + health check) — auth real, tablas, middleware, Realtime y Edge Functions quedan fuera, decisión explícita del usuario para no acoplar demasiado en una spec.
- **Sí:** `@supabase/ssr` (paquete estándar App Router) en vez de `@supabase/auth-helpers-nextjs` (deprecado por Supabase).
- **Sí:** `/api/health` como verificación de conexión (llama `auth.getSession()`) en vez de depender de una tabla que todavía no existe.
- **Sí:** cliente server usa `cookies()` async — confirmado contra `node_modules/next/dist/docs` que esta versión de Next (16.2.10) mantiene la API async introducida en v15.
- **No:** middleware de refresco de sesión — se agrega junto con la spec de Auth, cuando haya sesión real que refrescar.
