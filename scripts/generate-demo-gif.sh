#!/bin/bash
# Converts a screen recording to an optimised GIF for README.md
#
# Requirements: ffmpeg (brew install ffmpeg)
#
# Usage:
#   1. Record a ~30s session clip with QuickTime (File → New Screen Recording)
#      — start from the dashboard, begin a session, order 3-4 tests, end session, see result
#   2. Save the clip as demo-raw.mov in the project root (or any path)
#   3. Run: ./scripts/generate-demo-gif.sh demo-raw.mov
#   4. Output: docs/demo.gif (~3-8 MB, 900px wide, 12 fps)
#   5. Add to README Demo section: ![Demo session](docs/demo.gif)

set -e

INPUT="${1:-demo-raw.mov}"
OUTPUT="docs/demo.gif"
WIDTH=900
FPS=12

if [ ! -f "$INPUT" ]; then
  echo "Error: input file '$INPUT' not found."
  echo "Usage: $0 <recording.mov>"
  exit 1
fi

echo "Generating $OUTPUT from $INPUT (${WIDTH}px wide, ${FPS} fps)..."

ffmpeg -i "$INPUT" \
  -vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[pal];[s1][pal]paletteuse=dither=bayer" \
  -loop 0 \
  -y "$OUTPUT"

SIZE=$(du -sh "$OUTPUT" | cut -f1)
echo "Done: $OUTPUT ($SIZE)"
echo ""
echo "Add to README.md Demo section:"
echo "  ![Demo session](docs/demo.gif)"
