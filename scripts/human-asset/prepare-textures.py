"""Offline conversion of the pinned MIT Rocketbox textures; no generated skin.

FBX flipY is baked for glTF. Constant roughness is a presentation approximation,
not scanned skin optics. Requires Pillow; never imported by the web product.
"""
import sys
from pathlib import Path
from PIL import Image, ImageOps
source, destination = map(Path, sys.argv[1:3])
destination.mkdir(parents=True, exist_ok=True)
for name, size, suffix in [
    ('m002_body_color', 2048, '.jpg'),
    ('m002_head_color', 2048, '.jpg'),
    ('m002_opacity_color', 1024, '.png'),
    ('m002_body_normal', 1024, '.png'),
    ('m002_head_normal', 1024, '.png'),
]:
    image = ImageOps.flip(Image.open(source / (name + '.tga')))
    image.thumbnail((size, size), Image.Resampling.LANCZOS)
    output = destination / (name + suffix)
    if suffix == '.jpg':
        image.convert('RGB').save(output, quality=88, subsampling=0, optimize=True)
    else:
        image.save(output, optimize=True)
