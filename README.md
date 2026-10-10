# Pirate Battle

A top-down single-player naval shooter built for the Jungle Gaming Frontend Game Developer challenge.

The player sails around an island, uses front and broadside cannons, fights two enemy behaviours, and records completed sessions in a mocked ranking and match history.

## Stack

- React 19 + TypeScript (strict mode) for menus, HUD, forms and dialogs.
- PixiJS 8 for the combat arena, ships, projectiles, health bars and effects.
- Axios + TanStack Query for ranking and match-history data.
- MSW for browser-side REST API mocks that also work in a production build.
- Playwright for E2E coverage.
- Vite for development and production builds.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the URL printed by Vite. No environment variables are required.

## Commands

```bash
npm run dev       # local development server
npm run build     # TypeScript check and production build
npm run preview   # serve the production build locally
npm run lint      # Oxlint
npm run test:e2e  # Playwright tests
```

Before the first E2E run, install the browser:

```bash
npx playwright install chromium
```

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move forward | `W` | Forward button |
| Turn | `A` / `D` | Left / right buttons |
| Front cannon | `Space` | Centre fire button |
| Port broadside | `Q` | `Q` button |
| Starboard broadside | `E` | `E` button |
| Pause / resume | `P` | Pause button |

Touch controls support simultaneous holds, so movement, turning and attacks can be combined.

## Gameplay

- Configurable session duration: 60–180 seconds.
- Configurable enemy spawn interval: 1–12 seconds.
- One island blocks ships and projectiles.
- Chaser: pursues the player and damages the ship on collision.
- Shooter: moves into range and fires at the player.
- Front cannon fires one projectile; each broadside fires three parallel projectiles.
- Enemies require two hits and award one point when destroyed.
- A session ends when time reaches zero or player health reaches zero.
- Spawns alternate the two existing types at the configured interval, independently of earlier enemies being destroyed.
- The simulation pauses on `P`, the Pause button, window focus loss or a hidden browser tab; resuming requires a player action.

## Balance configuration and session options

`src/game/config.ts` centralizes the typed balance in `DEFAULT_GAME_CONFIG`. Options still exposes only **Game session time** (inclusive 60–180 integer seconds, default 90) and **Enemy spawn time** (inclusive 1–12 integer seconds, default 4). `GAME_SESSION_LIMITS` defines these bounds. Preferences survive refresh under `pirate-battle:config`; existing saved preferences remain compatible. Invalid stored preferences fall back to defaults.

Every Play/Play Again creates a deeply copied and frozen configuration snapshot. Later Options changes apply to the next session; they cannot modify a running or completed session's snapshot. Match records keep the existing two-field options format, taken from the completed session.

Internal defaults, adjustable in `DEFAULT_GAME_CONFIG`:

- Player: health 3, collision radius 26, speed 220 logical px/s, turn speed 2.8 rad/s.
- Enemies: health 2 and collision radius 25; Chaser speed 118, rotation response 3 and contact damage 1; Shooter speed 92, rotation response 2.4 and attack range 300.
- Island radius: 88 desktop / 68 touch. Ship artwork dimensions and responsive styles remain unchanged.
- Spawns: first after 1 second, then the configured interval; cyclic Chaser/Shooter order, 56-pixel corner inset and 56 pixels of clearance beyond the player/enemy collision radii.
- Projectiles: speed 620 logical px/s; enemy multiplier 0.72; damage 1 and collision radius 6 for all shots. Front lifetime 1.1 s, cooldown 0.35 s, visual radius 6 and muzzle offset 38. Each broadside lifetime 0.9 s, cooldown 0.8 s, visual radius 5, muzzle offset 33 and parallel offsets −15/0/15. Enemy lifetime 1.4 s, cooldown 1.35 s, visual radius 6 and muzzle offset 38.
- Feedback: explosion lifetime 0.5 s, initial radius 12, expansion coefficient 4 and fade coefficient 2; ship impact highlight 0.18 s. Each player kill still awards 1 point.

Change these source defaults to tune subsequent sessions without editing the combat rules. They are internal developer settings, not additional player controls. Phase 5 preserves all current values and behaviors; no new assets or external URLs are introduced.

## Mocked REST API

MSW intercepts these browser requests:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/ranking?page=n` | Paged score ranking |
| `GET /api/matches?playerId=...&page=n` | Paged match history |
| `POST /api/matches` | Registers a completed session idempotently by match ID |

The menu exposes a **Mock network scenario** selector. It is persisted locally and reloads the application to keep behaviour reproducible.

| Scenario | Expected behaviour |
| --- | --- |
| `normal` | Fixtures and newly completed matches are returned |
| `slow` | Match history waits 900 ms before responding |
| `empty` | Ranking and history return no records |
| `ranking-error` | Ranking returns HTTP 503 |
| `history-error` | History returns HTTP 503 |

**Reset mock data** clears locally stored matches and restores the fixture set.

## Accessibility and responsive behaviour

- Semantic buttons, labels, visible focus outlines and status messages.
- Menu tabs use tab roles and selected state.
- Score, hull, time and pause state are presented in the HTML HUD as well as visually in the canvas.
- The Pixi canvas resizes with its container and caps device resolution at 2x.
- Desktop keyboard and mobile touch controls are both available.

## Assets

Official assets are served locally from `public/assets/pirate-battle/`: ships, interface, arena tiles, cannonballs, a static explosion and ten sound effects. See that folder's [README](./public/assets/pirate-battle/README.md) for origin and individual uses. Graphics fallbacks keep the arena playable when visual assets fail. Audio unlocks from player gestures and has a persistent accessible mute control.

## Architecture and decisions

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the React/PixiJS boundary, simulation lifecycle, collision rules, persistence and mocked-data design.

See [GAMEPLAY_AUDIT.md](./GAMEPLAY_AUDIT.md) for the Phase 4 requirement table, corrections and deterministic combat coverage. The suite preserves the previous 26 executions and adds 22 gameplay executions across desktop/mobile Chromium.

Phase 5 preserves those 48 executions and adds 6 configuration executions (three scenarios in both profiles), for 54 total. Run them with `npm run test:e2e`; configuration-only coverage is `npm run test:e2e -- tests/config.spec.ts`.

## Known limitations

- The test suite covers gameplay, interface and audio state; it is not yet the full requested data/network E2E matrix or versioned visual-regression suite.
- Playwright traces are generated on failure; a committed HTML test report is not included.
- Network scenarios cover normal, slow, empty and read errors. Timeout-after-write and pending-write recovery are planned next.
- Performance evidence is documented through implementation choices, but a recorded three-minute profiling report is not yet included.
- Real iPhone/Safari playback and hardware performance measurements need manual device validation; Chromium tests do not measure audible output.
