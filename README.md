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

Open **Home → Options → Network testing tools** to access the existing **Mock network scenario** selector. The native details section is closed by default and supports keyboard focus and activation. Selection persists under `pirate-battle:network-scenario` and now applies immediately, resets read caches and latency counters, and announces a description to assistive technology. No reload is needed to recover a pending write.

- `normal`: original fixtures and successful requests.
- `empty`: both lists return no records.
- `paginated`: twelve additional local fixtures yield three pages in Ranking and Match History (five entries per page). Original normal fixtures remain unchanged.
- `slow`: fixed 900 ms read latency for both lists.
- `variable-latency`: deterministic 1200/150/700 ms cycle per endpoint; selection and refresh restart the sequence.
- `out-of-order`: odd reads wait 1200 ms and even reads 150 ms. Data is captured before the delay, allowing an older response to arrive last.
- `timeout`: read responses wait 4500 ms, exceeding the unchanged Axios 4000 ms timeout.
- `connection-error`: reads fail at the connection level.
- `http-400` / `http-503`: both read endpoints return HTTP 400 / 503.
- `ranking-error` / `history-error`: only the named list returns HTTP 503; the other list remains available.
- `post-timeout`: POST saves the match immediately, but delays its response 4500 ms; retry confirms the same ID.
- `post-unavailable`: POST returns HTTP 503 before saving; reads remain available.

**Reset mock data** restores `normal`, initial fixtures and latency sequences, and clears confirmed mock matches and pending registrations. Gameplay options and sound preferences are preserved.

To reproduce read failures, choose a scenario and open either data tab; **Try again** retries that query. Returning to Options, expanding Network testing tools and selecting `normal` clears the failed read cache. Reads retry transient failures once after 250 ms; HTTP 4xx has no automatic retry. Cached tabs refresh on reopening, and obsolete queries are cancelled through Axios.

To reproduce uncertain registration, choose `post-timeout` or `post-unavailable`, then complete a battle normally. The result shows the pending state and **Retry pending matches**; starting another battle stays available. Refresh restores the queue on Home. Select `normal` to recover automatically, or retry explicitly. Browser `online` events also retry pending entries; a recovery event during an in-flight request is retained until that request settles.

Each completed session uses one ID, persisted with its full record under `pirate-battle:pending-matches` **before** POST. Repeated clicks, refresh and timeout reuse that ID, while MSW returns an existing record idempotently. Confirmation removes only that pending entry and invalidates both data tabs. Several pending sessions can coexist without overwriting each other. If browser storage is unavailable, an accessible warning asks the player to keep the page open; durable recovery requires working localStorage.

The audit and exact coverage are documented in [NETWORK_AUDIT.md](./NETWORK_AUDIT.md). Network-only checks: `npm run test:e2e -- tests/network.spec.ts`. Phase 7 adds 19 scenarios in both desktop/mobile profiles (38 executions), preserving the previous 58, for **96 total**.

The final UX adjustment adds one network-tools accessibility/navigation scenario in both profiles, for **98 total executions**. It checks the clean Home, initially collapsed Options section, keyboard focus/activation, scenario selection/default/persistence and narrow-screen overflow. Existing network behaviors remain covered; only the Home screenshot baseline changes to reflect the relocated controls.

## Accessibility and responsive behaviour

- Semantic buttons, labels, visible focus outlines and status messages.
- Menu tabs use tab roles and selected state.
- Score, hull, time and pause state are presented in the HTML HUD as well as visually in the canvas.
- The Pixi canvas resizes with its container and caps device resolution at 2x.
- Desktop keyboard and mobile touch controls are both available.

## Assets

Official assets are served locally from `public/assets/pirate-battle/`: ships, interface, arena tiles, cannonballs, a static explosion, ten sound effects and the supplied Jungle Gaming logo. The small accessible logo appears only below Home's main content. See that folder's [README](./public/assets/pirate-battle/README.md) for origin and individual uses. Graphics fallbacks keep the arena playable when visual assets fail. Audio unlocks from player gestures and has a persistent accessible mute control.

## Architecture and decisions

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the React/PixiJS boundary, simulation lifecycle, collision rules, persistence and mocked-data design.

See [GAMEPLAY_AUDIT.md](./GAMEPLAY_AUDIT.md) for the Phase 4 requirement table, corrections and deterministic combat coverage. The suite preserves the previous 26 executions and adds 22 gameplay executions across desktop/mobile Chromium.

Phase 5 preserves those 48 executions and adds 6 configuration executions (three scenarios in both profiles), for 54 total. Run them with `npm run test:e2e`; configuration-only coverage is `npm run test:e2e -- tests/config.spec.ts`.

## Visual regression

Phase 6 adds four screenshot tests, for **58 total executions**: desktop Home, desktop arena, mobile arena and desktop result. The four reviewed PNG baselines live in `tests/visual-baselines/`; temporary comparisons and traces remain ignored in `test-results/`.

```bash
npm run test:e2e -- tests/visual                    # compare against baselines
npm run test:e2e -- tests/visual --update-snapshots # regenerate after intentional visual changes
```

Review changed PNGs before accepting them. Baselines use desktop Chromium at 1280×900 and mobile Chromium at 393×852, with screenshots in CSS pixels. Home captures the full page. The existing development-only gameplay clock freezes rendering between updates and advances the real simulation to 5.02 seconds for both arenas. Result uses the real timer-end path and waits for successful MSW registration. Tests fix dates, isolate stored preferences, use normal local network fixtures, await assets/fonts, remove hover/focus, and disable screenshot animations. Deterministic spawns need no random seed.

Generate and compare with the same Playwright Chromium version, OS and available system fonts (the supplied baselines were generated on Windows). Font rasterization and WebGL can differ across operating systems; these snapshots do not replace real iPhone/Safari review.

## Production profiling

Run `npm run profile:game` separately from E2E and other heavy tasks. It builds the optimized app, serves `dist` locally on port 4188, and uses headless Playwright Chromium. Allow approximately four minutes: five real Play/play/Exit cycles followed by a real 180-second session. The external keyboard pilot uses actual controls and island collisions; it does not override gameplay, pause or accelerate time. Set `PROFILE_PORT` to change the preview port. Dependencies and the Playwright Chromium installation are required.

The command writes [performance/profile-results.json](./performance/profile-results.json) and regenerates [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md), then closes browser and preview. The report documents the machine, render submission FPS, P95 intervals, entity peaks and CDP page-heap measurements before/after forced GC. Raw timestamps and the five memory cycles are retained; traces, screenshots and temporary logs are not deliverables. Profiling scripts are never imported into production code or the normal E2E suite.

The recorded complete session averaged **26.05 FPS**, with **49 ms P95**, on software SwiftShader. Memory after GC increased across five cycles even though canvas/app cleanup and DOM/listener counts remained stable. This is evidence requiring further investigation, not proof of a leak or of performance on a physical GPU/iPhone. See the report for values and limitations.

## Known limitations

- The test suite covers gameplay, interface, audio state, the requested deterministic network scenarios and four versioned visual states. Additional visual states remain follow-up work.
- Playwright traces are generated on failure; a committed HTML test report is not included.
- Network storage is a browser-local MSW implementation, not a remote backend. It requires localStorage for durable records and does not provide cross-device synchronization or transactional guarantees between concurrent tabs.
- Production profiling now has recorded three-minute evidence; the 60 FPS target was not achieved in this software-rendered environment. Physical-device performance and heap-retention diagnosis remain follow-up work.
- Real iPhone/Safari playback and hardware performance measurements need manual device validation; Chromium tests do not measure audible output.
