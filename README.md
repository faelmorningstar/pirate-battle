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

## Known limitations

- The test suite covers gameplay, interface and audio state; it is not yet the full requested data/network E2E matrix or versioned visual-regression suite.
- Playwright traces are generated on failure; a committed HTML test report is not included.
- Network scenarios cover normal, slow, empty and read errors. Timeout-after-write and pending-write recovery are planned next.
- Performance evidence is documented through implementation choices, but a recorded three-minute profiling report is not yet included.
- Real iPhone/Safari playback and hardware performance measurements need manual device validation; Chromium tests do not measure audible output.
