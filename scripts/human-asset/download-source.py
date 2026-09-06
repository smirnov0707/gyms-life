"""Explicit offline acquisition of ONE pinned public MIT asset, not user data."""
import hashlib
import json
import pathlib
import sys
import urllib.request

root = pathlib.Path(sys.argv[1])
root.mkdir(parents=True, exist_ok=True)
ref = '0943055db6ec570bcef9f2c8b41c9e5467c808f9'
base = 'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/' + ref + '/'
folder = 'Assets/Avatars/Adults/Male_Adult_01/'
files = {
    'LICENSE.md': '9bcfb3ece5301a55d3a41bbd00a029ab27d61d13',
    folder+'Export/Male_Adult_01.fbx': 'fdaf4aa7d15054f1601740ea1a09cf111938d210',
    folder+'Male_Adult_01.png': '104f167bd2d1102cd4eee063c7570dd5820abc62',
    folder+'Textures/m002_body_color.tga': '818ec72b6c69655c5853ab0eb1efdd6ab40b2bf0',
    folder+'Textures/m002_body_normal.tga': '31168ae5dca1085bb433988ff18f37fefe7dba0a',
    folder+'Textures/m002_body_specular.tga': '525c3d89d06bc75b5fd1de4b310f17ee03aff148',
    folder+'Textures/m002_head_color.tga': '0becf592ac705b4a2be8a63aa164266ac2a09d9c',
    folder+'Textures/m002_head_normal.tga': '9d2385bd43ec4e2bbc1712168d5317d06f9941e7',
    folder+'Textures/m002_head_specular.tga': '52b700ec4766105fad73bfc8415036d5db26d2a4',
    folder+'Textures/m002_opacity_color.tga': 'a4088df07a8896761bd209d304b12310f90e5003',
}
manifest = []
for path, expected in files.items():
    with urllib.request.urlopen(base + path, timeout=90) as response:
        data = response.read(24 * 1024 * 1024)
    actual = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    if actual != expected:
        raise RuntimeError('Source integrity failed: ' + path)
    (root / pathlib.Path(path).name).write_bytes(data)
    manifest.append({'source': base+path, 'gitBlobSha': actual,
                     'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
(root/'source-manifest.json').write_text(json.dumps({
    'license': 'MIT', 'copyright': 'Copyright (c) 2020 Microsoft',
    'upstreamRef': ref, 'files': manifest,
}, indent=2))
