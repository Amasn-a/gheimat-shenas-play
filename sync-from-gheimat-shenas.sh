#!/usr/bin/env bash
# Updates this Play site from a gheimat-shenas checkout: the player (src/, styles/, fonts/) is copied unchanged, the
# product catalog is rebuilt from data/qeymatshenas_products.json with the backend's import rules, and index.html records
# the source revision. play/ (demo host, in-browser server, reviewer controls) belongs to Play and is not overwritten.
# Usage (Git Bash): ./sync-from-gheimat-shenas.sh ../gheimat-shenas
set -euo pipefail
SRC="${1:?usage: ./sync-from-gheimat-shenas.sh /path/to/gheimat-shenas}"
DST="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$DST/src" "$DST/styles" "$DST/fonts"
cp -R "$SRC/player/src" "$SRC/player/styles" "$SRC/player/fonts" "$DST/"
cp "$SRC/player/dev/reviewer.css" "$DST/play/reviewer.css"
python3 - "$SRC/data/qeymatshenas_products.json" "$DST/play/catalog.json" <<'PY'
import json, sys
src, dst = sys.argv[1], sys.argv[2]
def ok(p):   # CatalogService.invalid + in_game: the rows the backend imports as eligible
    return (p.get("in_game") == 1 and p.get("digikala_product_id", 0) > 0 and (p.get("displayed_variant_id") or 0) > 0
            and p.get("price_toman", 0) > 0 and (p.get("display_title") or "").strip() and len(p["display_title"]) <= 50
            and (p.get("title") or "").strip() and (p.get("image_url") or "").startswith("https://"))
rows = [[p["digikala_product_id"], p["displayed_variant_id"], p["display_title"],
         p["image_url"].replace("h_800,w_800", "h_400,w_400"),   # ProductDatabaseReader: the ~400 px variant
         p["price_toman"]] for p in json.load(open(src, encoding="utf-8"))["products"] if ok(p)]
json.dump(rows, open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(rows), "products in play/catalog.json")
PY
REV="$(git -C "$SRC" rev-parse --short HEAD)"
sed -i.bak "s/data-source=\"[^\"]*\"/data-source=\"$REV\"/" "$DST/index.html" && rm -f "$DST/index.html.bak"
echo "Play now uses the player of gheimat-shenas $REV"
