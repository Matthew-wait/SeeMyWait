# CLAUDE.md

This file provides guidance to Claude Code when working with code in this skill folder.

## What This Is

A Claude Code skill (`aso-appstore-screenshots`) that guides users through creating high-converting App Store screenshots. It is invoked via the `/aso-appstore-screenshots` slash command from within a user's app project.

## Architecture

Four files + one asset make up the skill:

- **SKILL.md** — The skill prompt. Defines a multi-phase workflow: Benefit Discovery → Screenshot Pairing → Generation. Uses memory system to persist state across conversations. Generation first creates a deterministic scaffold via compose.py, then sends it to Nano Banana Pro for AI enhancement.
- **compose.py** — A standalone Python compositing script (Pillow-based) that deterministically renders App Store screenshots. Takes a background hex colour, action verb, benefit descriptor, and simulator screenshot path, then produces a pixel-perfect 1290×2796 PNG with headline text, device frame template, and the screenshot composited inside. Supports macOS, Windows, and Linux fonts automatically.
- **generate_frame.py** — Generates the device frame template PNG (`assets/device_frame.png`). Run once to create or update the template.
- **showcase.py** — Generates a showcase image showing up to 3 final screenshots side-by-side with an optional GitHub link at the bottom.
- **assets/device_frame.png** — Pre-rendered iPhone device frame template used by compose.py.

## Running compose.py

```bash
# Requires: pip install Pillow

python compose.py \
  --bg "#E31837" \
  --verb "TRACK" \
  --desc "WAIT TIMES LIVE" \
  --screenshot path/to/simulator.png \
  --output output.png
```

## Key Design Decisions

- **Two-stage generation**: compose.py creates a deterministic scaffold first (text + frame + screenshot), then Nano Banana Pro enhances it.
- **compose.py outputs exact App Store Connect dimensions** (1290×2796 for iPhone 6.7").
- **Device frame is a template image** (`assets/device_frame.png`).
- **Cross-platform font fallback**: automatically resolves fonts on macOS, Windows, and Linux.
