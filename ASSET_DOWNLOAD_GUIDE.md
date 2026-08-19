# Color Block Jam - Game Asset Download Guide

## 📋 Asset Requirements

This guide provides direct download links for all assets needed for your Color Block Jam puzzle game.

---

## 🎨 1. Block Sprites (Puzzle Blocks)

### Source: Kenney.nl (CC0 License)
**Recommended Pack:** Puzzle Pack or Tiny Town Pack
**Download:** https://kenney.nl/assets/puzzle-pack

**What to download:**
- `blocks/` folder → Save as `color-blocks.png` or `block-spritesheet.png`
- Target size: 64x64 or 48x48 pixels per block
- Need 6-8 different colors for puzzle blocks

**Alternative:** Search "puzzle" on https://itch.io/game-assets/free/tag-2d

### Source: CraftPix.net (Freebies Section)
**Download:** https://craftpix.net/freebies/
**Category:** Casual Game GUI, Block Tiles
**License:** Free for Commercial Use

### Source: GameArt2D (Freebies)
**Download:** https://www.gameart2d.com/freebies.html
**Category:** Sweet/Candy UI, Block Sprites
**License:** Royalty-Free

---

## 🖼️ 2. UI Elements

### Source: Kenney.nl
**Recommended Packs:**
- UI Pack: https://kenney.nl/assets/ui-pack
- Casual Game GUI: https://craftpix.net/freebies/

**What to download:**
- `buttons/` → Save as `ui-buttons.png` (buttons, icons)
- `panels/` → Save as `ui-panels.png` (backgrounds, frames)
- Target: 128x128 or 64x64 per button
- Need: Play button, settings, pause, retry, menu icons

---

## 🌄 3. Backgrounds

### Source: OpenGameArt.org
**Download:** https://opengameart.org/art-search-advanced?keys=puzzle+background&field_art_type=3
**Category:** Background, 2D
**License:** Check individual assets (CC0 or CC-BY)

### Source: Kenney.nl
**Download:** https://kenney.nl/assets/backgrounds-1
**What to download:** Solid color or gradient backgrounds

**Recommended:**
- Main background: Dark gradient or solid color (#1a1a2e)
- Level background: Subtle pattern or colors
- Target: 720x1280 or 1080x1920

---

## 🔊 4. Sound Effects

### Source: Mixkit (Free Game SFX)
**Download:** https://mixkit.co/free-sound-effects/game/
**Categories:**
- UI Click: https://mixkit.co/free-sound-effects/ui/
- Game Actions: https://mixkit.co/free-sound-effects/game/

**What to download:**
- `click.ogg` - Block click/tap sound (short, crisp)
- `match.ogg` - 3-block match success (bright, satisfying)
- `fail.ogg` - Game over sound (dramatic)
- `win.ogg` - Level complete (triumphant)
- `bgm-main.ogg` - Main menu music (looping, chill)
- `bgm-game.ogg` - Game music (looping, energetic)

### Source: Freesound.org
**Download:** https://freesound.org/
**Filter:** CC0 license only
**Search:** "click", "pop", "match", "success"

---

## 🎵 5. Background Music

### Source: Incompetech (Kevin MacLeod)
**Download:** https://incompetech.com/music/royalty-free/music.html
**License:** CC-BY 4.0 (credit required)

**Recommended Tracks:**
- "Carefree" - Casual, happy mood
- "Sagat" - Energetic, puzzle game feel
- "Monkeys Spinning Monkeys" - Light, playful

**What to download:**
- `bgm-main.ogg` - Main menu (slow, relaxing)
- `bgm-game.ogg` - Gameplay (moderate tempo)
- Save as OGG format (best for web/game)

### Source: Pixabay Music
**Download:** https://pixabay.com/sound-effects/
**Filter:** Royalty-free, commercial use
**Categories:** Casual, Chill, Puzzle, Happy

---

## 🔤 6. Fonts

### Source: Google Fonts (Recommended)
**Download:** https://fonts.google.com/

**For Color Block Jam:**
- **Fredoka** - Rounded, playful (perfect for puzzle games)
  - Download: https://fonts.google.com/specimen/Fredoka
  - Files: Fredoka-Regular.ttf, Fredoka-Bold.ttf
- **Poppins** - Clean, modern alternative
  - Download: https://fonts.google.com/specimen/Poppins

**Usage:**
- Main font: Fredoka (UI text, scores, buttons)
- Bold: Fredoka-Bold (titles, emphasis)

### Source: Dafont (Commercial Use)
**Download:** https://www.dafont.com/
**Filter:** "Free for Commercial Use"
**Category:** Cartoon, Casual fonts

---

## 📦 7. Bonus: Particle Effects

### Source: Kenney.nl
**Download:** https://kenney.nl/assets/particle-pack
**What to download:**
- `particles/` → Save as `particles.png`
- Need: Star, sparkle, explosion, confetti sprites

### Source: CraftPix.net Freebies
**Download:** https://craftpix.net/freebies/
**Category:** VFX, Particle effects

---

## 📝 Installation Instructions

### Step 1: Organize Downloaded Assets

Create this structure in `/home/patison/projects/color-block-jam/assets/`:

```
assets/
├── sprites/
│   ├── blocks/
│   │   └── color-blocks.png        (64x64 sprites, 6-8 colors)
│   ├── ui/
│   │   ├── ui-buttons.png          (button icons, 64x64)
│   │   └── ui-panels.png           (background frames)
│   ├── backgrounds/
│   │   └── main-bg.png             (720x1280 or 1080x1920)
│   └── effects/
│       └── particles.png           (particle spritesheet)
├── sounds/
│   ├── click/
│   │   └── block-click.ogg
│   ├── match/
│   │   └── match-3.ogg
│   ├── game/
│   │   ├── bgm-main.ogg
│   │   └── bgm-game.ogg
│   └── ui/
│       ├── ui-click.ogg
│       └── notification.ogg
└── fonts/
    └── Fredoka-Regular.ttf
```

### Step 2: Update Phaser Config

After downloading, update `src/config.ts`:

```typescript
export const ASSET_CONFIG = {
    BLOCK_SPRITE: 'assets/sprites/blocks/color-blocks.png',
    UI_BUTTONS: 'assets/sprites/ui/ui-buttons.png',
    BACKGROUND: 'assets/sprites/backgrounds/main-bg.png',
    PARTICLES: 'assets/sprites/effects/particles.png',
    SOUND_CLICK: 'assets/sounds/click/block-click.ogg',
    SOUND_MATCH: 'assets/sounds/match/match-3.ogg',
    SOUND_BGM: 'assets/sounds/game/bgm-main.ogg',
    FONT: 'assets/fonts/Fredoka-Regular.ttf',
};
```

### Step 3: Test Locally

```bash
cd /home/patison/projects/color-block-jam
npm run dev
```

Open http://localhost:5173 and test with real assets!

---

## 🔗 Quick Download Links

### Kenney (Best for Game Assets)
- Puzzle Pack: https://kenney.nl/assets/puzzle-pack
- UI Pack: https://kenney.nl/assets/ui-pack
- Casual GUI: https://craftpix.net/freebies/

### Sound Effects
- Mixkit: https://mixkit.co/free-sound-effects/game/
- Freesound: https://freesound.org/ (filter CC0)

### Music
- Incompetech: https://incompetech.com/music/royalty-free/music.html
- Pixabay: https://pixabay.com/sound-effects/

### Fonts
- Google Fonts: https://fonts.google.com/ (search "Fredoka")

### Other
- Itch.io: https://itch.io/game-assets/free/tag-2d
- OpenGameArt: https://opengameart.org/

---

## ⚠️ License Reminders

- **CC0 (Public Domain):** Free for commercial use, no credit needed
- **CC-BY (Attribution):** Free for commercial use, credit required
- **Royalty-Free:** Free for commercial use, check terms
- **Non-Commercial (NC):** ❌ DO NOT USE for monetized games

**Recommended:** Stick to CC0 or Royalty-Free assets for AdMob monetization.

---

## 🎯 Priority Order

1. **Block sprites** (essential for gameplay)
2. **UI buttons** (play, pause, retry)
3. **Sound effects** (click, match, win/lose)
4. **Background** (visual context)
5. **Background music** (optional, can skip initially)
6. **Particles** (visual polish)
7. **Fonts** (can use web fonts as fallback)

Start with items 1-3 to make the game playable, then add the rest for polish.

---

## 💡 Pro Tips

1. **Start with Kenney:** All assets are CC0, high quality, game-ready
2. **Keep sprites small:** 64x64 or 48x48 for mobile performance
3. **Use spritesheets:** Combine multiple sprites into one file (reduces load calls)
4. **Compress sounds:** Use OGG format (smaller than MP3, better quality)
5. **Test on mobile early:** Check how assets look on small screens

---

*Generated for Color Block Jam - Phaser 3 Puzzle Game*
*Asset sources from PRD document*
