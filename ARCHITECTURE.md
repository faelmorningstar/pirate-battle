# Architecture

## Overview

Pirate Battle intentionally separates UI state, real-time simulation and remote-style data:

```text
React UI ── callbacks ──> PixiJS simulation
   ▲                           │
   └──── HUD / end result ─────┘

React Query ─ Axios ─ MSW handlers ─ localStorage fixtures/records
```

## React and PixiJS boundary

React owns discrete application screens: menu, options, combat shell, result, ranking and match history. It also owns persistent options, visible HUD values and registration status.

`GameCanvas` owns the PixiJS `Application`, canvas lifecycle, entities and ticker. The continuous state of ships, projectiles, cooldowns, spawn timers, enemy AI and remaining time stays inside the simulation closure. This avoids React rendering on every frame.

The simulation calls React only for meaningful state changes:

- a visible timer second changes;
- health or score changes;
- pause changes;
- the session ends.

## Simulation

Every ticker update uses `ticker.deltaMS / 1000`, so movement, cooldowns, projectile lifetimes, enemy spawns and the session timer are time-based instead of frame-based.

The game is paused before any state update when manual pause is active, the Pause button is used, the window loses focus, or the document becomes hidden. Both keyboard and touch state are cleared on pause and resume; focus/visibility restoration never resumes automatically. Explosion expansion and damage feedback share the simulation clock. A fatal event returns immediately from the current update, preventing additional damage or score in that frame.

Enemies live in a collection. After the existing one-second initial delay, an active-time spawn timer alternates Chaser/Shooter at the configured interval independently of enemy destruction. Spawn candidates retain the four original inset corners and are filtered for island clearance, arena bounds and player separation.

## Input

Keyboard input is captured only while `GameCanvas` is mounted and listeners are removed in effect cleanup. Pointer controls populate a second pressed-key set. Both input sources feed the same simulation checks, allowing touch controls to hold movement and attacks concurrently.

## Collision and combat

Gameplay uses the existing circle radii. Movement and projectile travel additionally use segment/circle intersection to prevent crossing an obstacle between updates:

- ships cannot enter the island or leave the arena;
- projectiles are removed once on target impact, island impact, expiration or leaving the arena;
- player projectiles damage enemies; enemy projectiles damage the player;
- destroyed enemies are removed from movement, firing and collision checks.

Projectiles travel no farther than their remaining lifetime and choose their earliest obstacle/target contact. An island wins a tied contact. A projectile applies damage to at most one target before being removed. Resizing recenters the island at the same relative coordinates and resolves ship positions that have become invalid in the smaller arena, without changing collision radii.

The Chaser rotates toward the player and self-destructs on collision without scoring. The Shooter stops at its configured attack range and fires on its own cooldown. Both have two health points. Health bars use local official textures with numeric values, retaining a Graphics fallback. Persistent damage marks and a brief impact ring are created once per ship and destroyed with its children; color is not the only damage cue.

## Resource lifecycle

`GameCanvas` initializes PixiJS inside `useEffect` and destroys the application, listeners and active touch state on cleanup. This supports React Strict Mode mount/unmount cycles. Official ship textures are loaded through Pixi Assets; procedural Pixi ship shapes remain as a fallback if a texture request fails.

## Configuration and persistence

`src/game/config.ts` is the single source of gameplay balance. `GameSessionOptions` contains only the two preferences exposed in Options; `GameConfig` combines those values with typed, readonly player/enemy stats, island radii, spawn ordering and clearance, projectile/weapon settings, score per kill and effect durations.

`DEFAULT_GAME_CONFIG` preserves the existing numerical balance. `GAME_SESSION_LIMITS` supplies the inclusive integer limits used by the form and preference loader:

- `sessionDurationSeconds` (60–180)
- `enemySpawnIntervalSeconds` (1–12)

Only these two preferences are saved under the existing `pirate-battle:config` key. Older two-field records remain compatible; malformed/out-of-range preferences fall back to defaults and extra stored fields never override internal balance.

Play and Play Again call `createGameConfigSnapshot` before mounting GameCanvas. It deeply clones the defaults plus session options and recursively freezes the resulting object and arrays. Readonly types protect compile-time callers; `Object.freeze` protects runtime mutation. App holds this snapshot separately from editable preferences, and GameCanvas consumes the same immutable object throughout movement, combat, spawns, damage and effects. Saving Options later changes the next session only. Texture caches, visual drawing dimensions and audio state are not part of the copied balance data.

To tune balance, edit `DEFAULT_GAME_CONFIG` in `src/game/config.ts`; do not add new numbers inside simulation code. Velocities use logical pixels/second, player turning uses radians/second, enemy rotation responses retain their existing time-based interpolation coefficients, and durations/cooldowns use seconds. Spawn distribution is a nonempty ordered list of the two existing enemy types, repeated cyclically; broadside offsets remain three parallel projectiles. The desktop/touch island radii are selected from the session snapshot without changing responsive layout. Impact duration is passed to each ship's existing feedback objects at creation.

Completed match records retain the existing two-field `configuration` API shape (`GameSessionOptions`), read from the finished session snapshot rather than current editable preferences. Existing fixtures, ranking/history behavior and local records do not require migration. The last result remains under `pirate-battle:last-result`.

## Ranking and match history

The browser data layer uses Axios for HTTP calls and TanStack Query for query caching, retry and invalidation. `useRegisterMatch` invalidates ranking and history queries after a successful registration.

MSW owns the REST implementation. It uses shared TypeScript contracts and localStorage-backed fixtures, so no private service is required for development, tests or deployment. Posting the same match ID returns the existing record, preventing duplicate records from repeated mutation attempts.

The ranking is sorted by score descending and completion timestamp ascending for deterministic ties. History is filtered to the local player and sorted by most recent completion.

## Performance choices

- React does not own per-frame positions.
- Canvas resolution is capped at device pixel ratio 2.
- Projectiles are destroyed promptly when invalid.
- Asset loading happens before entities are created and falls back safely.
- The production build currently reports a sizeable PixiJS bundle; code splitting and asset packaging are documented follow-up work.

## Testing strategy

Playwright is configured for desktop Chromium and a mobile Chromium profile. The 26 pre-existing executions cover UI, options, ranking, arena loading/fallback/cleanup, mobile HUD and audio unlock/state/failures. Phase 4 adds 22 gameplay executions covering movement, rotation, collisions, weapon cooldowns, damage/scoring, enemy AI/spawns, end/restart and automatic pause.

Phase 5 adds three configuration scenarios in both profiles: Options bounds/persistence, a deeply frozen running-session snapshot unaffected by later preferences, and independently copied adjustable defaults/legacy preference compatibility. The development probe includes the actual readonly session configuration so tests can check deep freezing and observe the same rules used by the game. Existing gameplay tests remain unchanged.

Phase 5 validation (2026-10-10): `npm run test:e2e` passed all 54 desktop/mobile executions; `npm run build` and `npm run lint` passed. The existing large-bundle warning remains (main chunk approximately 615 kB). Real Safari/iPhone behavior, performance profiling and the previously documented visual/data-network coverage remain outside this phase.

Combat tests opt into `window.__PIRATE_BATTLE_TEST__` before loading the development page. The probe exposes read-only snapshots and clock advancement using the real simulation update, normally in 1/60-second steps. Tests use the existing input handlers and rendering, without entity-position, health or score setters. The hook is disabled by `import.meta.env.DEV` in production. Deterministic spawn ordering needs no seed. See [GAMEPLAY_AUDIT.md](./GAMEPLAY_AUDIT.md) for coverage and limits. Failure-after-write recovery, all paging states and profiling remain follow-up work.

## Versioned visual regression

`tests/visual/desktop.spec.ts` covers Home, stable arena and result at 1280×900; `tests/visual/mobile.spec.ts` covers the touch arena at 393×852 and verifies that the small Home attribution stays inside its panel without horizontal overflow. Project filters run each visual scenario only in its intended profile. The original 54 executions remain; these four bring the suite to 58.

The same development probe stops the Pixi ticker and advances actual gameplay to 5.02 seconds, yielding both existing enemy types without extra gameplay logic. Result ends through the real timer update and waits for registration before capture. Dates are fixed, localStorage is reset in isolated contexts, MSW uses its normal local fixtures, fonts/images/network loading settle, focus/hover are cleared, and screenshot animations are disabled. No random seed is required by the deterministic simulation. HTML and Pixi rendering are both included in screenshots, at CSS-pixel scale.

`snapshotPathTemplate` stores only the four reference PNGs under `tests/visual-baselines/{projectName}/`. `test-results/` remains ignored, including differences and failure traces. Run `npm run test:e2e -- tests/visual` to compare, or `npm run test:e2e -- tests/visual --update-snapshots` to regenerate intentionally; inspect every changed image before accepting it. Keep Chromium, OS and system fonts consistent with the Windows baselines; cross-platform font/WebGL differences and real Safari behavior require separate review.

The supplied `branding/logo_jungle_gaming.svg` is copied unchanged from the local challenge package. Its accessible attribution is part of the Home fragment only; no game canvas, balancing, audio or other screen logic changes are needed.

Phase 6 validation (2026-10-10): all 58 E2E executions passed, including comparisons against the four reviewed baselines; build and lint passed. Home desktop, both arenas, result and an unversioned mobile Home capture were visually reviewed. The existing long Home content can require vertical scrolling on small phones; the bounded attribution stays within its panel and introduces no horizontal overflow. Gameplay remains viewport-contained. The existing approximately 615 kB main-chunk warning remains.
