# Orbit Rush

Orbit Rush is a quick-session, skill-based arcade game about dodging incoming hazards, collecting sparks, and chasing a personal best.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/orbit-rush/src/game/engine.ts` — movement, hazards, spark scoring, dash, and trail unlock rules
- `artifacts/orbit-rush/src/game/progress.ts` — browser-local best score, lifetime sparks, runs, and selected trail
- `artifacts/orbit-rush/src/App.tsx` and `src/index.css` — game UI, canvas rendering, and visual theme
- `artifacts/orbit-rush-mobile/app/index.tsx` — touch-first native game screen and onboarding
- `artifacts/orbit-rush-mobile/game/` — native play rules and AsyncStorage progress

## Architecture decisions

- Game rules run client-side; no account or network connection is needed to play.
- Browser progress uses local storage; iOS and Android progress uses AsyncStorage on the device. The two versions do not sync across devices.
- Replay value comes from skill, personal-best scores, and cosmetic trail unlocks; stopping never removes progress.

## Product

- Dodge hazards, collect sparks, build a temporary combo multiplier, and use a cooldown dash.
- Pause and resume at any time; unlock and select visual trails with lifetime spark totals.
- The Expo companion runs on iPhone and Android with one-finger steering, a short first-run guide, haptic feedback, and portrait controls.

## User preferences

- Make the game highly engaging through skill and replay value, without punishing players for taking breaks.

## Gotchas

- Keep the logical playfield at the size exported from the game engine; scale pointer coordinates into it before sending input.
- Persist run results only on the first transition from playing to game-over to avoid double-counting.
- The native version is a separate Expo app so it can use touch, haptics, and device-local storage without changing the browser build.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
