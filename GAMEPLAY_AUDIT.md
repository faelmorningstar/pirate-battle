# Gameplay audit — Phase 4

Date: 2026-10-09. Official source: local `reference-assets/game-developer-challenge-main/README.md`, sections 2 (Gameplay, Arena/collisions/combat, Match rules, Animations/feedback), 3 (configuration), 4 (PixiJS), 7 (input/accessibility) and 8 (Playwright).

Phase 5 follow-up (2026-10-10): typed balance and immutable session snapshots are now centralized in `src/game/config.ts`. The historical Phase 4 evidence and results below remain unchanged; its complete-balance-configuration limitation is resolved. See README/ARCHITECTURE for the current configuration and six additional configuration test executions.

This phase audits gameplay, fixes demonstrated gaps and adds deterministic combat coverage. No new enemy type, weapon, score rule, sound or asset was introduced. Menus, HUD, touch-button layout, ranking, history and Options remain unchanged.

## Requirement coverage

The evidence names refer to `src/components/GameCanvas.tsx` unless a different file is specified. G01–G11 identify the test titles listed below in `tests/gameplay.spec.ts`; each runs in desktop and mobile Chromium.

| Official requirement | Initial situation | Code/test evidence | Action in this phase / final status | Corresponding test |
| --- | --- | --- | --- | --- |
| Move forward and rotate in both directions; movement and attacks can coexist | Implemented; positions had no direct E2E assertions | `isPressed`, player rotation, `touchControl`; existing `app.spec.ts` | Preserved speeds and controls; added state observations and real input tests | G01, G02, G09 |
| Chaser pursues, rotates, damages on contact and explodes | Implemented, but direct coverage was missing | Enemy update, `damagePlayer`, `explode` | Preserved pursuit speed, rotation response and one-point damage; removed ship children with the entity | G04 |
| Chaser collision does not award points; destroyed entities leave simulation | Existing collision path correctly did not score; destruction did not explicitly destroy children | `removeEnemy`, Chaser contact branch | Centralized removal from the enemy array and destruction of ship/health-bar children; collision still scores zero | G04, G07 |
| Shooter approaches and fires only inside attack range | Implemented; an island could leave its approach stuck without avoidance | Enemy update, `moveShip`, `fireEnemy` | Added the existing Chaser-style turn-around response when the island blocks movement; retained 300-pixel range, speed and firing interval | G03, G06 |
| Both enemy types appear in a standard match | Fragile: only one enemy existed; the other type waited for its destruction | Previous `!chaser && !shooter` gate and respawn reset | A clock-driven spawn timer alternates existing Chaser/Shooter entities without waiting for kills | G03 |
| Enemies spawn on the configured interval until the session ends | Missing during an enemy's lifetime; interval previously started after destruction | `spawnCountdown`, `spawnEnemy` | Preserved initial 1-second delay and configured interval (default 4 seconds); subsequent spawns use active game time | G03, G10, G11 |
| Spawn locations are unobstructed and sufficiently far from the player | Farthest corner selected, but no explicit obstacle/bounds filter | `spawnEnemy` candidate filtering | Kept the four existing 56-pixel inset corners; require arena bounds, island clearance and at least 107 pixels of player separation (26 + 25 + 56); skip an unsafe spawn | G03 |
| Ships stay inside the visible arena and cannot cross the island | Checked only destination before boundary clamping; island position stayed at old resize coordinates; small landscape spawn could overlap it | `clampToArena`, `circleContact` in `src/game/collisions.ts`; `safePosition`, `resizeArena`, `moveShip` | Check the clamped movement path; reposition the same island relative to the resized arena and resolve newly invalid ship positions; radii remain 88 desktop / 68 touch, player 26, enemies 25 | G01, G03 |
| Island blocks projectiles | Destination-only checks could skip an obstacle between frames | Projectile loop; `circleContact` | Test the complete traveled segment and select the earliest collision, with the island taking precedence on a tie | G05 |
| Projectiles obey direction, speed, lifetime and faction | Implemented; expiration was checked after moving and applying damage | `addProjectile`, front/broadside/enemy firing and projectile loop | Preserved all velocities and lifetimes; limit travel to remaining lifetime before evaluating contacts | G02, G05, G08 |
| A projectile applies damage once and is removed on target/obstacle impact, expiration or exit | Removal existed, but independent target checks could hit more than one enemy when supporting multiple entities | Earliest-contact selection and `removeProjectile` | Choose one target only, apply one damage unit and destroy/remove the projectile immediately; ignore shots starting outside the arena | G02, G05, G08 |
| Front cannon fires one projectile; each broadside fires three parallel projectiles | Implemented | `fireFront`, `fireBroadside`, existing offsets −15/0/15 | Preserved projectile count, offsets, direction and independent port/starboard weapons | G02 |
| Every weapon obeys its cooldown | Implemented; no combat assertions | Player cooldowns and per-Shooter `fireCooldown` | Preserved front 0.35 s, each broadside 0.8 s and Shooter 1.35 s; each Shooter owns its existing firing timer | G02, G06 |
| Each enemy destroyed by player attacks gives exactly one point | Implemented; no damage/score assertions | Enemy-health decrement, `removeEnemy`, score increment | Preserved two health points and +1 point per kill; removed enemies cannot be scored again | G07, G08 |
| End by time or zero health; stop all simulation, damage, attacks, spawns and points | Ticker stopped on subsequent frames, but the death frame could continue processing | `finish`, ticker entry guard, returns immediately after fatal damage | Clear both input sets and return from the current update at the first fatal event; time expiration returns before other systems | G10, G11 |
| Restart restores health, score, time and entities | Implemented; direct entity reset coverage absent | Fresh effect closure and App `startGame` | Preserved application flow; verified clean restart with health 3, score 0, time 90 and empty entities | G10 |
| Manual pause and hidden-tab/focus-loss auto-pause; resume only by player action | Hidden tab handled; visible-window blur missing | `onBlur`, `onVisibilityChange`, `togglePause` | Added/removes window blur listener; focus/visibility restoration never resumes automatically | G09; existing `app.spec.ts` |
| Pause suspends time, cooldowns and simulation without accumulated commands | Keyboard cleared, touch holds were retained; explosion had its own continuously running ticker | `togglePause`, shared update for `effects` | Clear keyboard and touch holds on both pause/resume; effects now share the paused simulation clock and keep the existing 0.5-second lifetime | G02, G04, G09 |
| Game keys are captured only in gameplay | Listeners were mounted/unmounted with the game; no post-end assertion | `onKeyDown`, effect cleanup | Preserve session-scoped listeners; accept only game keys and ignore ended/inactive sessions | G10, G11 |
| Deterioration, impact and destruction feedback are perceptible | Only damage tint existed; no persistent damage shapes or brief impact marker | `src/game/shipFeedback.ts`, `explode`, official ship/cannonball/explosion textures | Add persistent cracks at reduced health, additional severe-damage marks at 1/3 health and a fading 0.18-second impact ring; retain numeric health bars and the official static explosion | G04, G07, G08; reviewed desktop/mobile captures |
| Destroy entities and release listeners/resources on exit/restart, including Strict Mode | Lifecycle guards and cleanup existed; enemy children were not explicitly destroyed | `removeEnemy`, `removeProjectile`, cleanup; `arena.spec.ts` | Destroy ship children, reuse feedback Graphics, remove resize/blur listeners; use one simulation ticker for effects; retain asynchronous mounting guards and audio cleanup | G10, G11; existing arena/audio tests |
| Reproducible tests observe state/control time while exercising real inputs, rules and rendering | No combat clock/state instrumentation | `src/game/gameplayTest.ts`, opt-in probe in GameCanvas | Development-only `__PIRATE_BATTLE_TEST__` observes snapshots and advances the same update function; normal stepping is 1/60 s; no entity/health/score setters and no production hook | G01–G11 |

## Test index

- **G01:** `movement, rotation, island blocking and arena bounds survive resize`
- **G02:** `front and parallel broadsides respect independent cooldowns and projectile cleanup`
- **G03:** `spawns alternate on the configured interval while existing enemies remain alive`
- **G04:** `Chaser pursues, damages once on contact, explodes and never awards collision points`
- **G05:** `island stops cannonballs even when a controlled slow frame crosses the whole obstacle`
- **G06:** `Shooter approaches and only fires within range on its cooldown`
- **G07:** `real cannon inputs damage and destroy an enemy with exactly one point`
- **G08:** `a single cannonball deals one hit and is removed before it can damage again`
- **G09:** `blur and hidden pages pause and clear keyboard and simultaneous touch holds until manual resume`
- **G10:** `death stops every simulation system and restart restores the session`
- **G11:** `time expiry stops before attacks, spawns or points and abandonment releases input`

The initial suite has 26 project executions. This phase adds 11 scenarios × 2 profiles = 22 executions, for 48 total. Existing assertions are preserved without weakening coverage. The existing HUD layout test now opts into the stopped clock: its three-viewport measurements previously allowed the idle player to die mid-test after spawn cadence was corrected. Combat tests press real keyboard controls; the mobile pause scenario also holds two touch controls through their pointer handlers. Observations read actual Pixi feedback visibility, positions, entities, cooldowns and counters. Spawns use a deterministic corner selection and alternating distribution, so there is no random source requiring a seed.

## Preserved values and resources

Player health 3; enemy health 2; damage 1; score +1 on player kill; player speed 220 and turn speed 2.8; Chaser speed 118; Shooter speed 92; projectile speed 620 (enemy multiplier 0.72); front lifetime 1.1 seconds, broadside 0.9 seconds, enemy 1.4 seconds; cooldowns 0.35 / 0.8 / 1.35 seconds; Shooter range 300; explosion lifetime 0.5 seconds; all existing collision radii and Options limits remain unchanged.

The necessary behavior change is **spawn cadence**: enemies now appear at the configured interval even while earlier enemies live, as the official specification requires. This can increase concurrent enemies and practical difficulty compared with the previous one-enemy gate; no numerical balance adjustment was made.

No assets were copied or modified. Damage drawings are three reusable Graphics per ship, created when the ship spawns, updated in place and destroyed with its children. The existing local explosion texture remains a single static image. No new sounds or listeners are created per frame. `arenaVisuals.ts`, `audio.ts`, App, HUD CSS, Options and data APIs remain unchanged.

## Validation and limits

Final validation:

- `npm run test:e2e`: **48 passed**, desktop/mobile Chromium, approximately 1.8 minutes. All previous 26 executions are retained; 22 are new.
- `npm run build`: **passed**, including strict TypeScript compilation. The existing large-bundle warning remains (main chunk approximately 611 kB, above Vite's 500 kB warning threshold).
- `npm run lint`: **passed**, without warnings.
- `git diff --check`: **passed**. The test-hook identifier is absent from the generated production JavaScript.

Damage screenshots generated by G04 were reviewed in `test-results/gameplay-Chaser-pursues-da-ce162-ver-awards-collision-points-{chromium,mobile-chromium}/damage-feedback.png`. Cracks, impact ring, numeric health and the existing explosion remain readable in both profiles. These are review artifacts, not versioned regression baselines. No commit or push was performed.

- Chromium desktop/mobile prove the audited core scenarios; real iPhone/Safari and audible sound output are not validated by this run. Existing audio unlock/state/failure tests remain in the suite.
- G11 uses a controlled 90-second frame to exercise the timer end barrier without waiting 90 wall-clock seconds. It does not prove survival throughout a normally stepped 90-second battle; death and combat tests use 1/60-second stepping.
- The suite samples deterministic trajectories and representative viewports, not every possible moving-target or overlapping-target geometry. Continuous collision checks cover the projectile/ship path against each target's current-frame circle; a full moving-circle sweep is not implemented.
- The full challenge's 12-section data/network matrix, versioned menu/arena/result visual baselines and three-minute performance/memory profiling are outside this gameplay phase and remain incomplete.
- Gameplay balance values are unchanged constants inside GameCanvas; only duration/spawn Options are centralized in `GameConfig`. A complete typed balance configuration is still a broader architecture requirement.
- PixiJS still emits its existing Graphics-children deprecation warning for health-bar containers. It is a warning rather than an unhandled exception; the HUD implementation was preserved in this phase.
- README/ARCHITECTURE contained stale statements about remote ship assets, absent audio and smoke-only coverage; the relevant documentation is updated alongside this audit.
