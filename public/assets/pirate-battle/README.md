# Official Pirate Battle assets

Source: local challenge package `reference-assets/game-developer-challenge-main/assets/`.
UI: individual retina PNGs, displayed in logical dimensions. Ships: default PNGs.
Phase 2 adds six individual retina tiles and two default combat PNGs.
No atlas, sample screen, composed scene background or sound is loaded by the arena.

## Copied files

- `ships/ship_12.png`
- `ships/ship_20.png`
- `ships/ship_5.png`
- `ui/controls/button_round_hover.png`
- `ui/controls/button_round_normal.png`
- `ui/controls/button_round_pressed.png`
- `ui/controls/icon_close.png`
- `ui/controls/icon_fire_front.png`
- `ui/controls/icon_fire_left.png`
- `ui/controls/icon_fire_right.png`
- `ui/controls/icon_forward.png`
- `ui/controls/icon_home.png`
- `ui/controls/icon_pause.png`
- `ui/controls/icon_play.png`
- `ui/controls/icon_restart.png`
- `ui/controls/icon_settings.png`
- `ui/controls/icon_turn_left.png`
- `ui/controls/icon_turn_right.png`
- `ui/hud/counter_panel.png`
- `ui/hud/enemy_health_fill_green.png`
- `ui/hud/enemy_health_fill_red.png`
- `ui/hud/enemy_health_frame.png`
- `ui/hud/health_fill_amber.png`
- `ui/hud/health_fill_green.png`
- `ui/hud/health_fill_red.png`
- `ui/hud/health_frame.png`
- `ui/hud/icon_heart.png`
- `ui/hud/icon_score.png`
- `ui/hud/icon_time.png`
- `ui/menu/button_primary_disabled.png`
- `ui/menu/button_primary_hover.png`
- `ui/menu/button_primary_normal.png`
- `ui/menu/button_primary_pressed.png`
- `ui/menu/button_secondary_normal.png`
- `ui/menu/button_secondary_pressed.png`
- `ui/menu/panel_menu.png`
- `ui/menu/title_pirate_battle.png`

## Phase 2: arena and combat

Source folder: `reference-assets/game-developer-challenge-main/assets/png/`.
These eight files are exact local copies, without editing or downloading:

- `tiles/tile_73.png` ← `retina/tiles/tile_73.png`: repeating water (96 logical pixels per tile).
- `tiles/tile_1.png` ← `retina/tiles/tile_1.png`: one coastal corner reused with four rotations for beach relief, clipped to the collision circle.
- `tiles/tile_18.png` ← `retina/tiles/tile_18.png`: repeating sand, clipped to the existing collision circle.
- `tiles/tile_39.png` ← `retina/tiles/tile_39.png`: textured grass with small vegetation, clipped inside the sand.
- `tiles/tile_71.png` ← `retina/tiles/tile_71.png`: palm trees inside the island.
- `tiles/tile_66.png` ← `retina/tiles/tile_66.png`: mossy rocks inside the island.
- `ship_parts/cannon_ball.png` ← `default/ship_parts/cannon_ball.png`: all existing projectiles, 12×12 logical pixels for front/enemy shots and 10×10 for broadsides.
- `effects/explosion_1.png` ← `default/effects/explosion_1.png`: a single static explosion, initially 24×24 logical pixels, keeping the original expansion and 0.5-second fade. The other explosion images are not animation frames here.

The six tile images are 128×128 physical pixels. Sand uses a 64-pixel logical pattern at the desktop radius; grass is drawn once inside its organic mask; island decoration scales by the existing radius (88 desktop, 68 coarse pointer). Only translucent shore foam extends beyond that radius. Graphics masks shape the artwork and never participate in physics.

Textures load once through PixiJS Assets and remain in its shared cache. Water has a single TilingSprite resized in place. Sand, grass, masks and decorations are created once per session and destroyed with the scene; shots and effects are removed by the existing lifetimes. Missing/timed-out images retain the previous Graphics fallback (the island requires all five island textures). No late replacement happens during play, and unmount guards remain in place.
