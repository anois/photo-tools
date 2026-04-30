#!/usr/bin/env bash
# Fetches brand SVG logos into public/logos/, then rebuilds public/logos.json.
# Strategy: prefer Wikimedia Commons (authentic marks in original colors +
# typography), fall back to simple-icons' colored endpoint for brands not on
# Commons under a reachable filename.
#
# Idempotent — skips files already present unless FORCE=1.

set -euo pipefail

COMMONS="https://commons.wikimedia.org/wiki/Special:FilePath"
SIMPLE="https://cdn.simpleicons.org"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/public/logos"
mkdir -p "$DEST"
FORCE="${FORCE:-0}"

# slug | commons-filename(s, colon-separated, first 200 wins) | simple-icons-slug-fallback
# Use `-` for simple-icons slug if no fallback is available.
BRANDS=(
  "fujifilm   | Fujifilm_logo.svg                            | fujifilm"
  "canon      | Canon_logo.svg                                | -"
  "nikon      | Nikon_Logo.svg                                | nikon"
  "sony       | Sony_logo.svg                                 | sony"
  "leica      | Leica_Camera.svg                              | leica"
  "panasonic  | Panasonic_logo_(Blue).svg                     | panasonic"
  "apple      | Apple_logo_black.svg                          | apple"
  "samsung    | Samsung_Logo.svg                              | samsung"
  "google     | Google_2015_logo.svg                          | google"
  "hasselblad | Hasselblad_Logo.svg                           | -"
  "huawei     | -                                             | huawei"
  "xiaomi     | -                                             | xiaomi"
  "oppo       | -                                             | oppo"
  "vivo       | -                                             | vivo"
  "dji        | -                                             | dji"
  "oneplus    | -                                             | oneplus"
  "asus       | -                                             | asus"
  "honor      | -                                             | honor"
  "meizu      | -                                             | meizu"
  "blackmagicdesign | -                                       | blackmagicdesign"
)

fetched=0
skipped=0
missed=0

for entry in "${BRANDS[@]}"; do
  slug=$(echo "$entry" | cut -d'|' -f1 | tr -d ' ')
  commons_names=$(echo "$entry" | cut -d'|' -f2 | tr -d ' ')
  simple_slug=$(echo "$entry" | cut -d'|' -f3 | tr -d ' ')

  out="$DEST/$slug.svg"
  if [[ "$FORCE" != "1" && -s "$out" ]]; then
    skipped=$((skipped + 1))
    continue
  fi

  got=""
  # Try Commons candidates
  if [[ "$commons_names" != "-" ]]; then
    IFS=';' read -ra cands <<< "${commons_names//,/;}"
    # also support ":" inside field
    IFS=':' read -ra cands <<< "$commons_names"
    for c in "${cands[@]}"; do
      [[ -z "$c" || "$c" == "-" ]] && continue
      if curl -fsSL --max-time 20 -A "photo-tools/0.1 (local tool)" -o "$out" "$COMMONS/$c" 2>/dev/null; then
        got="commons:$c"
        sleep 1   # polite rate-limit to avoid Wikimedia 429
        break
      fi
    done
  fi

  # Fallback: simple-icons colored endpoint
  if [[ -z "$got" && "$simple_slug" != "-" ]]; then
    if curl -fsSL --max-time 20 -o "$out" "$SIMPLE/$simple_slug" 2>/dev/null; then
      got="simple-icons:$simple_slug"
    fi
  fi

  if [[ -n "$got" && -s "$out" ]]; then
    fetched=$((fetched + 1))
    printf "  %-18s ← %s\n" "$slug" "$got"
  else
    rm -f "$out"
    missed=$((missed + 1))
    echo "  miss: $slug" >&2
  fi
done

echo "logos: fetched=$fetched skipped=$skipped missed=$missed → $DEST"

# Rebuild the pre-baked logos.json bundle the SPA fetches at boot.
node "$ROOT/scripts/build-logos.js"
