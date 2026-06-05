#!/usr/bin/env python3
"""
gen-assets.py — regenerate the social share image and favicon set from index.html.

index.html is the single source of truth: the hero photo and the white logo are
inlined as base64 data URIs. This script extracts them and rebuilds:
  - og.jpg              1200x630 social/share image (cover-crop of the hero, faces kept)
  - favicon.ico         multi-size (16/32/48), white house mark on brand navy
  - icon-32.png, icon-16.png
  - apple-touch-icon.png  180x180 (square; iOS rounds corners itself)

Run:  python3 scripts/gen-assets.py
Requires Pillow:  pip install pillow  (or: pip install pillow --break-system-packages)
"""
import os, re, io, base64, sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAVY = (14, 42, 56, 255)  # --navy #0E2A38

html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
uris = re.findall(r"data:image/(png|jpeg);base64,([A-Za-z0-9+/=]+)", html)
imgs = [(ext, Image.open(io.BytesIO(base64.b64decode(b64)))) for ext, b64 in uris]
jpegs = [im for ext, im in imgs if ext == "jpeg"]
pngs  = [im for ext, im in imgs if ext == "png"]
if not jpegs or not pngs:
    sys.exit("ERROR: expected at least one JPEG (hero) and one PNG (logo) inlined in index.html")

# ---- og.jpg : cover-crop hero to 1200x630, biased to the upper third to keep faces ----
hero = jpegs[0].convert("RGB")
og = ImageOps.fit(hero, (1200, 630), method=Image.LANCZOS, centering=(0.5, 0.30))
og.save(os.path.join(ROOT, "og.jpg"), "JPEG", quality=86, optimize=True, progressive=True)

# ---- favicons : isolate the house mark from the white logo, center on navy ----
logo = pngs[0].convert("RGBA")           # the white logo (transparent background)
w, h = logo.size
mark_region = logo.crop((0, 0, w, int(h * 0.72)))   # drop the wordmark band
mark = mark_region.crop(mark_region.getbbox())       # tight crop of the white house+tree

def icon(size, pad=0.14):
    cv = Image.new("RGBA", (size, size), NAVY)
    inner = int(size * (1 - 2 * pad))
    m = mark.copy(); m.thumbnail((inner, inner), Image.LANCZOS)
    cv.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return cv

icon(180).convert("RGB").save(os.path.join(ROOT, "apple-touch-icon.png"), "PNG")
icon(32).save(os.path.join(ROOT, "icon-32.png"), "PNG")
icon(16).save(os.path.join(ROOT, "icon-16.png"), "PNG")
icon(48).save(os.path.join(ROOT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])

print("Wrote og.jpg, favicon.ico, icon-32.png, icon-16.png, apple-touch-icon.png")
