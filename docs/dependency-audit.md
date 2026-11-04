# Dependency audit: `feat/industry-acquisition-phase1`

Checked on 2026-10-14 with `npm audit --package-lock-only` (npm 11.5.2), against `main` at `3fbf2c0`. Re-checked after the Phase 2 dev dependencies: the totals are unchanged (23 / 13), and none of the added packages has an advisory. Installing them changed no existing package version.

## Summary

| | critical | high | moderate | total |
|---|---|---|---|---|
| `main`: all dependencies | 2 | 16 | 7 | 25 |
| branch: all dependencies | 2 | 14 | 7 | **23** |
| `main`: production only (`--omit=dev`) | 2 | 8 | 5 | 15 |
| branch: production only (`--omit=dev`) | 2 | 6 | 5 | **13** |

**The branch introduces no new advisories.** Every advisory below already exists on `main`. The drop of two comes from patch updates that npm made while installing Vitest 4: `postcss` 8.5.15→8.5.30, `nanoid` 3.3.15→3.3.20, `source-map-js` 1.2.1→1.2.2.

## What the branch added

| Package | Version | Type | Notes |
|---|---|---|---|
| `zod` | 4.1.12 | runtime | No advisories. `openai@6.45.0` declares `zod ^3.25 \|\| ^4.0` as an optional peer dependency, and npm resolves both to one copy. |
| `@testing-library/react` | 16.3.3 | dev only (Phase 2) | React 18 component tests; peer range `^18 \|\| ^19`. No advisories. |
| `@testing-library/dom` | 10.4.2 | dev only (Phase 2) | Peer of the above. No advisories. |
| `jsdom` | 27.4.0 | dev only (Phase 2) | Test DOM. Chosen over 30.x, which needs Node `^22.22.2 \|\| ^24.15` (local Node is 24.6). Engines `^20.19 \|\| ^22.12 \|\| >=24`, the same as Vite 8. No advisories. |
| `tldts` | 7.4.16 | runtime (Phase 2B) | MIT; Public Suffix List; single dependency `tldts-core` 7.4.16 (MIT). Pinned to a ≥2-week-old release (7.4.18 was 7 days old). Was already a transitive dev dependency via jsdom → tough-cookie. No advisories. |
| `vitest` | 4.1.11 | dev only | Clears GHSA-5xrq-8626-4rwp (Vitest UI file read), GHSA-82fw-gwwq-j7x9 (`@vitest/mocker` path traversal), and GHSA-5gmw-xhrv-c9v3 / GHSA-85c8-ppgw-ccpr (`tinypool` prototype pollution). These affect 3.2.4 and also 3.2.7, the fix npm suggested. |

## Node.js compatibility

Neither the repo nor `.vercel/` records the project's Node version (no `engines`, `.nvmrc` or CI config), so I tested all current LTS lines:

| Node | `npm ci` | `tsc --noEmit` | `vitest run` (206 tests) | `next build` |
|---|---|---|---|---|
| 20.20.2 | – | – | pass | pass |
| 22.23.3 | – | – | pass | pass |
| 24.6.0 (local default) | pass, 0 engine warnings | pass | pass | pass |

Minimums: Vite 8 and rolldown, pulled in by Vitest 4, need Node `^20.19 || >=22.12`. Next 14 needs `>=18.17`. Vitest is a dev dependency: Vercel installs it but the build never runs it. **Before deploying, confirm the Vercel project's Node version is 20.19+ or 22.12+** (Project Settings → General → Node.js Version). `next build` doesn't connect to the database: it passed with `DATABASE_URL` pointing at an unused local port.

## Remaining advisories (all pre-existing, none changed here)

Production dependencies (`--omit=dev`):

| Package | Severity | Direct? | Fix | Notes |
|---|---|---|---|---|
| `next` 14.2.35 | critical | direct | `next@16` (**major**) | 23 advisories. Needs a planned framework upgrade. |
| `next-auth` 4.24.14 | critical | direct | available within range, per npm | GHSA-7rqj-j65f-68wh, GHSA-xmf8-cvqr-rfgj, GHSA-x445-f3h2-j279. **Recommended as a separate, approved change**: it affects auth. |
| `nodemailer` 9.0.1 | high | direct | available, per npm | 7 advisories. Recommended as a separate change, with the email routes retested. |
| `xlsx` 0.18.5 | high | direct | **none on npm** | Prototype pollution / ReDoS on parsing untrusted files. Phase 2 deliberately does **not** use it for CSV import. |
| `postcss` (bundled with `next`) | high | transitive | via `next@16` | |
| `brace-expansion`, `browserslist`, `js-yaml` | high | transitive | available | |
| `dompurify`, `uuid`, `baseline-browser-mapping`, `argparse`, `sprintf-js` | moderate | transitive | available | |

Dev-only (in addition to the above): `eslint-config-next` / `@next/eslint-plugin-next` / `glob` (fix requires a major upgrade), and `tailwindcss` 3 → `braces` / `micromatch` / `chokidar` / `fast-glob` / `postcss-nested` / `postcss-selector-parser` (fix requires Tailwind 4, a major upgrade).

None of these were upgraded: no demonstrated need inside this branch's scope. `next-auth` and `nodemailer` have non-major fixes and are the strongest candidates for a separate, reviewed change.
