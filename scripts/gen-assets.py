#!/usr/bin/env python3
"""
gen-assets.py — regenerate the social share image + favicons from the root images.

Source of truth: hero.jpg and logo-white.png in the repo root (the same files the
card serves). Produces:
  og.jpg (1200x630) and favicon.ico / icon-32.png / icon-16.png / apple-touch-icon.png

Run:  python3 scripts/gen-assets.py        (requires Pillow)
"""
import os
from PIL import Image, ImageOps
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAVY = (14, 42, 56, 255)

hero  = Image.open(os.path.join(ROOT, "hero.jpg")).convert("RGB")
white = Image.open(os.path.join(ROOT, "logo-white.png")).convert("RGBA")

# Social share image: cover-crop hero to 1200x630, top-biased to keep faces.
ImageOps.fit(hero, (1200, 630), method=Image.LANCZOS, centering=(0.5, 0.30)) \
    .save(os.path.join(ROOT, "og.jpg"), "JPEG", quality=86, optimize=True, progressive=True)

# Favicons: isolate the white house mark, center on brand navy.
w, h = white.size
mark = white.crop((0, 0, w, int(h * 0.72)))
mark = mark.crop(mark.getbbox())
def icon(size, pad=0.14):
    cv = Image.new("RGBA", (size, size), NAVY)
    inner = int(size * (1 - 2 * pad)); m = mark.copy(); m.thumbnail((inner, inner), Image.LANCZOS)
    cv.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2)); return cv
icon(180).convert("RGB").save(os.path.join(ROOT, "apple-touch-icon.png"), "PNG")
icon(32).save(os.path.join(ROOT, "icon-32.png"), "PNG")
icon(16).save(os.path.join(ROOT, "icon-16.png"), "PNG")
icon(48).save(os.path.join(ROOT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
print("Regenerated og.jpg + favicons from hero.jpg / logo-white.png")
