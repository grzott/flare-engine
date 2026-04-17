---
description: "Research available game assets — sprites, tilesets, sounds, music, fonts, UI kits — that can be used with the Flare engine"
mode: agent
agent: researcher
---

# Research: Game Assets for 2D Development

Audit the current landscape of **accessible, ready-to-download or purchasable 2D game assets** that could be used to build games with the Flare engine (React Native + Skia).

## Scope

Research each asset category below. For each, find **at least 3 free and 3 paid** options:

### 1. Sprite Sheets & Character Art

- Animated character sprites (idle, walk, run, attack, death)
- Top-down, side-scroller, and isometric styles
- Formats: PNG sprite sheets, texture atlases (JSON/XML metadata)
- Check: itch.io, OpenGameArt, Kenney.nl, GameDevMarket, CraftPix

### 2. Tilesets & Level Art

- Terrain tiles, platform tiles, dungeon tiles
- Autotile-compatible sets (RPG Maker format, Tiled-compatible)
- Formats: PNG tilesets with consistent grid sizes (16x16, 32x32, 64x64)

### 3. Sound Effects

- Game SFX packs: explosions, UI clicks, footsteps, combat, pickups
- Formats: WAV, OGG, MP3 — note which formats work best with expo-av / react-native-sound
- Check: Freesound.org, Sonniss GDC bundles, ZapSplat, PMSFX

### 4. Music & Ambient Audio

- Loopable background music for different game genres
- Ambient soundscapes
- Licensing: royalty-free, Creative Commons, commercial-use

### 5. Fonts

- Pixel art fonts, bitmap fonts compatible with SpriteFont rendering
- TTF/OTF fonts with game-friendly licensing
- BMFont format exports (for @flare/render SpriteFont)

### 6. UI Kits

- Health bars, inventory panels, dialog boxes, buttons
- Formats: PNG with 9-slice metadata, or individual elements

## For Each Asset Found, Report

| Field                   | What to include                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| **Name**                | Asset pack name                                                                          |
| **Source**              | URL to download/purchase page                                                            |
| **License**             | CC0, CC-BY, MIT, commercial, etc.                                                        |
| **Price**               | Free / $X                                                                                |
| **Format**              | PNG, JSON atlas, WAV, etc.                                                               |
| **Resolution**          | Pixel size, grid size                                                                    |
| **Flare Compatibility** | Can @flare/assets SpriteSheet loader handle this format directly? Any conversion needed? |
| **Quality**             | Your assessment: professional / hobbyist / placeholder-grade                             |

## Special Focus

Pay particular attention to:

- **Kenney.nl** — massive free CC0 library, check for 2D game packs
- **itch.io asset packs** — filter by "free", "top rated", "2D", "sprite sheet"
- **Sonniss GDC Audio** — annual free bundles of professional game audio
- **Google Fonts** — game-suitable fonts with OFL license
- **TexturePacker / ShoeBox** — tools for atlas generation compatible with Flare's JSON format

## Output

Produce a structured report following the researcher agent's report format. Group by category. Include a final "Starter Kit" recommendation — the best free combination to bootstrap a simple 2D game project with Flare.
