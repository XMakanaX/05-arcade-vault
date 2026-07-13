# SPEC 03 — About + Contacto con envío de correo (Resend)

> **Status:** Implementado
> **Depends on:** 02-home-landing
> **Date:** 2026-07-13
> **Objective:** Portar `about.jsx` del template como nueva ruta `/about`, reemplazando el envío simulado del formulario de contacto por un envío real de correo vía Resend.

---

## Scope

**In:**

- Nueva ruta `/about` — página "Acerca de" (hero + 3 highlights) y sección Contacto (intro + tips + formulario), portada de `references/templates/home-about/about.jsx`.
- Endpoint `app/api/contact/route.ts` (POST) que valida el formulario y envía un correo real con Resend.
- Variables de entorno `RESEND_API_KEY` y `CONTACT_TO_EMAIL` (`.env.example` commiteado, `.env.local` con placeholder para que el usuario pegue su key).
- Estado de error en el formulario (no existía en el template) para cuando el envío falla.
- Enlace "Acerca de" en `app/components/Nav.tsx` (desktop y panel móvil), apuntando a `/about`.
- CSS de About/Contacto portado a `app/globals.css`.

**Out of scope:**

- Dominio propio verificado en Resend (se usa `onboarding@resend.dev`, que solo entrega al correo de la cuenta Resend).
- Persistencia de mensajes enviados (no se guarda historial).
- Rate limiting / anti-spam del endpoint.
- Tests automatizados.

---

## Data model

No se introducen tipos ni estructuras persistentes. El único dato es el payload del formulario (`name`, `email`, `msg`) enviado por `fetch` a `/api/contact`; no se guarda entre sesiones.

---

## Implementation plan

1. **CSS.** Portar a `app/globals.css` el bloque About/Contacto del template (`.about-hero`, `.about-title`, `.about-mission`, `.highlight-row`/`.highlight`/`.hl-icon`/`.hl-text`, `.about-divider`/`.div-bar`/`.div-pixels`, `.about-contact`/`.contact-grid`/`.contact-intro`/`.contact-title`/`.contact-sub`/`.contact-tips`/`.tip`/`.tip-led`, `.contact-form`/`.shake`, `.terminal-success`/`.term-bar`/`.term-body`). Reutiliza `.field` ya existente en `globals.css` (de `/acceder`).
2. **Endpoint de contacto.** `app/api/contact/route.ts`: `POST` valida `name/email/msg` (no vacíos, email con formato básico) → 400 si inválido; usa `Resend` (`process.env.RESEND_API_KEY`) para enviar con `from: "Arcade Vault <onboarding@resend.dev>"`, `to: process.env.CONTACT_TO_EMAIL`, `replyTo: email`; responde `{ ok: true }` o `{ ok: false, error }` con status apropiado (400/500/502). Si faltan variables de entorno, responde 500 controlado.
3. **Página About.** `app/about/page.tsx` (`"use client"`): porta `About` + `HighlightIcon` del template con hook `useReveal` local (mismo patrón que `app/page.tsx`). El formulario maneja estados `idle | sending | sent | error`: valida campos vacíos con `shake` igual que el template, hace `fetch("/api/contact", { method: "POST", ... })`, muestra `terminal-success` en éxito y mensaje de error + `shake` en fallo (sin perder los datos del formulario).
4. **Nav.** Agregar `Link href="/about"` "Acerca de" en desktop y panel móvil de `app/components/Nav.tsx`; extender `isActive` con el caso `"about"`.
5. **Variables de entorno.** Crear `.env.example` (commiteado, placeholders vacíos) y `.env.local` (gitignored por `.env*` ya existente) con `RESEND_API_KEY` y `CONTACT_TO_EMAIL=luisra1996cr@gmail.com`. El usuario coloca la key real después.
6. **Dependencia.** `npm install resend`.

---

## Acceptance criteria

- [x] `npm install resend` agregado a `package.json`.
- [x] `npm run build` compila sin errores de tipos.
- [x] `/about` renderiza hero, highlights, divider animado y sección contacto, visualmente igual al template.
- [x] Animaciones `.reveal` disparan al hacer scroll.
- [x] Envío con campos vacíos → `shake`, sin llamada a `/api/contact`.
- [ ] Envío válido con `RESEND_API_KEY`/`CONTACT_TO_EMAIL` configurados → correo real recibido con `Reply-To` = email del visitante; UI cambia a `terminal-success`. (No verificable en este entorno: sandbox sin salida de red hacia la API de Resend, respuesta 502. Endpoint y manejo de respuesta correctos; pendiente de confirmar por el usuario en un entorno con acceso a internet.)
- [x] Fallo del endpoint (key inválida/ausente) → estado de error visible, formulario reutilizable.
- [x] Nav muestra "Acerca de" (desktop + móvil) con estado activo en `/about`.
- [x] `RESEND_API_KEY` no aparece en ningún bundle del cliente (solo se usa en `app/api/contact/route.ts`, server-side).

---

## Decisions

- **Sí:** envío real vía route handler `app/api/contact` en vez del `setSent` simulado del template — requerimiento explícito del usuario.
- **Sí:** `from: onboarding@resend.dev` sin dominio verificado — solo entrega al correo de la cuenta Resend; migrar a dominio propio es cambio futuro.
- **Sí:** `Reply-To` = email del visitante, para responder directo desde la bandeja del equipo.
- **Sí:** ruta `/about` (nombre del template) aunque el resto de rutas del proyecto están en español — decisión explícita del usuario.
- **Sí:** estado `error` agregado al formulario (ausente en el template) porque el envío ahora puede fallar de verdad.
- **No:** dominio verificado / rate limiting / historial de mensajes — quedan fuera de esta spec.

---

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `onboarding@resend.dev` solo entrega al correo de la cuenta Resend sin dominio verificado | Documentado; migrar a dominio propio es cambio futuro aislado (solo el string `from` + verificación DNS). |
| Variables de entorno ausentes en runtime | Endpoint responde 500 controlado; UI muestra estado de error sin romper la app. |
| Exponer la API key en el cliente | Solo se usa dentro del route handler (server-side); nunca se pasa al client component. |
