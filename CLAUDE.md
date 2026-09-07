# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What this is

Angular frontend for **Jimaco Aprobaciones** — a generic document-approval workflow engine
(pilot use case: Orden de Compra). The backend lives in the sibling repo
**`Jimaco.Aprobaciones`** (`../Jimaco.Aprobaciones` relative to this repo) — read that repo's
`CLAUDE.md` first for the domain model (`TipoDocumento`, `DefinicionFlujo`, `PasoFlujo`,
`InstanciaDocumento`, roles-as-data) before touching anything here; this repo has no business
logic of its own, it's a thin client over that API.

Standalone components, no NgModules, Angular Material — same conventions as the sibling
`Jimaco.Cotizaciones.Web` repo (this org's other Angular frontend). If something here looks
inconsistent with a pattern used there, prefer matching that repo rather than inventing a new
convention.

## Local dev environment gotcha — Node version

**This machine's default global Node is 20.18**, but Angular CLI 22 requires Node ≥22.22.3 (or
≥24.15/≥26). `ng`/`npx ng` will hard-fail with a version-check error under the default `node` on
PATH. A portable Node 22 build was downloaded to run `ng new`/`ng add`/`ng build` during initial
setup (extracted zip, prepended to `PATH` for that shell session only — nothing was installed
system-wide). Before running any `ng`/`npm` command in this repo, check `node --version`; if it's
not ≥22.22.3, either install/switch a proper Node 22+ (nvm-windows is present on this machine —
`nvm install 22.22.3` — but its install step needs an elevated/admin shell, which hung
non-interactively during setup; a portable zip from nodejs.org avoids that) or point `PATH` at a
portable Node 22 extraction before invoking `ng`.

## Architecture

- `core/models/` — TypeScript interfaces mirroring the backend's DTOs. **Property names are
  camelCase** (e.g. `numeroReferencia`, `pasoActualId`) because ASP.NET Core's default
  `System.Text.Json` policy for Web API is camelCase — the C# DTOs are PascalCase records but
  serialize camelCase over the wire. Enums (`EstadoInstanciaDocumento`, `TipoAccion`, `TipoCampo`)
  serialize as their **string name**, not a number (`JsonStringEnumConverter` is registered
  globally in the backend) — model them as TS string-literal unions, not numeric enums.
- `core/services/` — one `HttpClient`-based service per backend controller
  (`RolService`↔`RolesController`, etc.). Controller routes are `/api/<ControllerNameSansController>`
  but ASP.NET Core route matching is case-insensitive, so services call lowercase URLs
  (`/api/tiposdocumento`, not `/api/TiposDocumento`) — same convention as Jimaco Cotizaciones' frontend.
- `core/guards/auth.guard.ts` — `authGuard` (any logged-in user) and `adminGuard` (must hold the
  `Admin` role). Unlike Jimaco Cotizaciones (single fixed `rol` string), `AuthService` here holds
  `roles: string[]` from the login response and exposes `tieneRol(nombre)` / `esAdmin()` — roles
  are data on the backend, so don't assume there are only two of them.
- `core/interceptors/auth.interceptor.ts` — attaches `Authorization: Bearer <token>`; on a 401
  logs out and redirects to `/login`. **Does not apply to the adjunto download** — see below.
- **Adjunto download is NOT a plain `<a href>`.** The download endpoint requires the JWT bearer
  header, which only `HttpClient` (via the interceptor) attaches — a raw anchor link hitting the
  API URL directly would get a 401. `DocumentoService.descargarAdjunto()` fetches the file as a
  `Blob` via `HttpClient`, and the component creates a temporary `ObjectURL` + synthetic `<a>`
  click to trigger the save, then revokes the URL. Keep this pattern for any future
  authenticated-file-download feature; don't "simplify" it back to a plain link.
- **`PasoFlujoInputDto.pasoDestinoDevolucionOrden` is an `Orden` (position), not a database
  Id** — because when building a new flow in `flujo-form-dialog.component.ts` none of the steps
  have Ids yet. `0` in the UI means "no destino" (null on the wire, i.e. the document returns to
  the emisor). See the backend's `DefinicionFlujoService.CrearAsync` two-pass save for why this
  shape was chosen — don't change one side without the other.
- **Authorization for document actions is NOT re-derived client-side.** `documento-detalle`
  always shows Aprobar, and Devolver/Rechazar when the current step's `pasoActualPermiteDevolver`/
  `pasoActualPermiteRechazar` flags say so — it does **not** check whether the logged-in user
  actually holds a role allowed on that step (the DTO doesn't expose which roles those are). The
  backend is the enforcement point (`InstanciaDocumentoService.EjecutarAccionAsync` throws
  `UnauthorizedAccessException` → 403) and the resulting error is surfaced via snack bar. Same
  deliberate choice for "Reenviar" (backend checks the caller is the original emisor). Don't add
  client-side role gating here without also asking whether it's worth exposing the per-step role
  list from the API — right now that's intentionally not sent.
- **Dynamic document fields** (`TipoDocumento.campos`) render in `documento-nuevo.component` based
  on `tipoCampo`: `Texto`/`Numero`/`Fecha` as a plain input, `Seleccion` as a `mat-select` from
  `campo.opciones`, and **`Adjunto` is skipped** in that dynamic-values form — file attachment is
  handled by the separate generic adjunto upload (one PDF per document in V1), not as a keyed
  value in the `datos` dictionary. If multiple named attachment slots are ever needed, that's a
  bigger change than just rendering an `<input type="file">` here.

## Commands

```bash
npm start                          # ng serve, dev server against environment.ts (localhost:8081)
npm run build                      # ng build (production config by default per angular.json)
npx ng build --configuration development   # faster build without prod optimizations, for quick error-checking
npm test                           # ng test (vitest)
```

`environment.ts` (dev) points at `http://localhost:8081/api` — matches the backend's local Docker
Compose port (offset from Jimaco Cotizaciones' 8080, see that repo's `docker-compose.yml`
comment). `environment.production.ts` uses `/api` (same-origin, nginx proxies it — see `nginx.conf`).

## Non-obvious gotchas

- **Angular Material dialog CSS: don't fight `.mat-mdc-dialog-content`'s own padding with a
  same-specificity global class.** `.form-dialogo` (this app's shared dialog-content class) tried
  `padding-top` to give the first `mat-form-field`'s floating label room above the content's
  `overflow-y: auto` boundary — it silently did nothing, because Material injects its own
  `.mat-mdc-dialog-content` rule (same specificity, single class) later in the cascade, so it wins
  regardless of source order in `styles.scss`. Confirmed by inspecting real computed styles
  (`getComputedStyle` on the live DOM), not by guessing from a screenshot — `contentPaddingTop`
  measured `0px` even with the rule present. The fix that actually works: `margin-top` on
  `.form-dialogo mat-form-field:first-of-type` — a margin on *your own* child element doesn't
  compete with Material's rule on the parent. If a future dialog still shows a clipped label,
  check computed styles before adding more CSS — a plausible-looking fix can be a complete no-op.
- **Visually verifying a CSS fix needs a real browser, not just re-reading the CSS.** This
  machine has Edge and Chrome installed; `playwright-core` (no browser binary download) launched
  with `channel: 'msedge'` drives either one headless — no need for Playwright's own downloaded
  Chromium. Useful recipe for confirming any visual bug fix in this repo: launch, log in, open the
  dialog/page in question, `getBoundingClientRect()` the elements involved (not just a screenshot —
  the numbers tell you *why*, a screenshot only tells you *that*), then screenshot to confirm.
- **`accion-correo/:id` (2026-09-07) — approve/reject from the email link, no login.** Lives
  outside the `authGuard`-protected parent route in `app.routes.ts` on purpose. Its API calls carry
  a one-off token (from the email link's `?token=` query param) instead of the logged-in session
  token — `TOKEN_CORREO`, an `HttpContextToken` defined in `auth.interceptor.ts`, lets
  `DocumentoService` pass that token per-request (`{ context }` on the `HttpClient` call), and the
  interceptor prefers it over `authService.token` when present, and skips the auto-logout-on-401
  side effect for it (a stale/wrong email link isn't "your session expired"). Backend enforces the
  actual scoping (one document, view + act only) — see backend `CLAUDE.md`, "Aprobar/rechazar desde
  el correo" — this frontend page trusts whatever the API returns, same as any other page.

## Production deployment — NOT set up yet

No server assigned. See the backend repo's `CLAUDE.md` "Production deployment" section — same
constraint applies here (don't deploy without the user's explicit go-ahead), and if it ends up on
Jimaco Cotizaciones' Lightsail box, port/Caddy conflicts need the same treatment described there.

## Pending (mirrors the backend's "Pending decisions")

- No World Office integration — documents are created manually via `documento-nuevo.component`.
- No visual flow designer — `flujo-form-dialog.component` is a plain repeated-row form (add/remove
  step, pick roles from a multi-select, pick a return-target step by position). This was a
  deliberate scope decision for V1, not an oversight — see the backend `CLAUDE.md`.
- No WhatsApp/Email notifications wired — the backend's `Notificacion` table exists but nothing
  sends yet, so there's no "bandeja de notificaciones" UI here either.
