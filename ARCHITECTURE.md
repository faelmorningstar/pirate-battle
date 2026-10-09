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

The game is paused before any state update when manual pause is active, the Pause button is used, or `document.visibilityState` becomes hidden. Keyboard state is cleared on pause so resuming never applies held movement from the inactive period.

## Input

Keyboard input is captured only while `GameCanvas` is mounted and listeners are removed in effect cleanup. Pointer controls populate a second pressed-key set. Both input sources feed the same simulation checks, allowing touch controls to hold movement and attacks concurrently.

## Collision and combat

All gameplay collision uses circle-distance checks:

- ships cannot enter the island or leave the arena;
- projectiles are removed once on target impact, island impact, expiration or leaving the arena;
- player projectiles damage enemies; enemy projectiles damage the player;
- destroyed enemies are removed from movement, firing and collision checks.

The Chaser rotates toward the player and self-destructs on collision. The Shooter stops at its configured attack range and fires on a cooldown. Both have two health points. Health bars are Pixi graphics drawn above each ship.

## Resource lifecycle

`GameCanvas` initializes PixiJS inside `useEffect` and destroys the application, listeners and active touch state on cleanup. This supports React Strict Mode mount/unmount cycles. Official ship textures are loaded through Pixi Assets; procedural Pixi ship shapes remain as a fallback if a texture request fails.

## Configuration and persistence

`GameConfig` centralizes the two exposed balance values:

- `sessionDurationSeconds` (60–180)
- `enemySpawnIntervalSeconds` (1–12)

Options are saved under `pirate-battle:config`. Each completed match saves the configuration snapshot used at its start. The last result is also persisted under `pirate-battle:last-result`.

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

Playwright is configured for desktop Chromium and a mobile Chromium profile. Current smoke tests cover option persistence, ranking mock loading and game-start/mobile-control availability. Test isolation clears localStorage before each test.

Future coverage should add deterministic combat-time control, pause timing assertions, projectile damage/cooldown rules, failure-after-write recovery, all paging states and visual baselines.
