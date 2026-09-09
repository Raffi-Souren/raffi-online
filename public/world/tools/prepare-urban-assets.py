#!/usr/bin/env python3
"""Prepare the selected CC0 NYC surface palette and one street prop.

Run: python3 public/world/tools/prepare-urban-assets.py --download
Requires Pillow12.0.0: python3 -m pip install Pillow==12.0.0
Downloads only named1K channels and the selected glTF files;
source files stay in the temporary cache, never in the browser payload. Each
source's MD5 and each resulting file's SHA256 are recorded in the manifest.
"""
import argparse, hashlib, json, pathlib, tempfile, urllib.request
from PIL import Image, ImageEnhance

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
UA = 'RaffiWorldAssetPrep/1.0 (https://github.com/Raffi-Souren/raffi-online)'
SURFACES = [
    ('brick_wall_003', 'brick', 1.2),
    ('asphalt_03', 'asphalt', 2.0),
    ('concrete_pavement_02', 'concrete', 1.8),
    ('pavement_05', 'cobble', 3.4),
]


def fetch(url, target, enabled, md5=None):
    if not target.exists():
        if not enabled:
            raise SystemExit(f'Missing cached source {target}; use --download to retrieve the selected CC0 asset.')
        target.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(url, headers={'User-Agent': UA})
        target.write_bytes(urllib.request.urlopen(request, timeout=90).read())
    payload = target.read_bytes()
    if md5 and hashlib.md5(payload).hexdigest() != md5:
        raise ValueError(f'Source checksum mismatch: {url}')
    return payload


def metadata(asset, endpoint, cache, download):
    path = cache / f'{asset}-{endpoint}.json'
    return json.loads(fetch(f'https://api.polyhaven.com/{endpoint}/{asset}', path, download))


def record(path):
    payload = path.read_bytes()
    return {'path': str(path.relative_to(ASSETS)), 'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--cache', type=pathlib.Path, default=pathlib.Path(tempfile.gettempdir()) / 'raffi-material-source')
    args = parser.parse_args()
    output = ASSETS / 'materials' / 'urban'
    output.mkdir(parents=True, exist_ok=True)
    sheets = {channel: Image.new('RGB', (2048, 2048)) for channel in ['albedo', 'normal', 'roughness']}
    manifest = {'license': 'CC0-1.0', 'licenseURL': 'https://polyhaven.com/license', 'sources': [], 'outputs': [], 'preparation': 'python3 public/world/tools/prepare-urban-assets.py --download', 'modifications': ['Named 1K surface channels packed into a shared 2x2 sheet without rotation.', 'Albedo retained at1K per surface and encoded WebP quality90; OpenGL normals and roughness reduced to512px per surface using Lanczos and encoded lossless WebP.', 'No displacement geometry. Pavement uses source scale; brick repeat authored at1.2m to match the visible NYC brick module.', 'Asphalt albedo saturation reduced to35% and brightness to74% for weathered charcoal NYC roads.']}
    surface_config = []
    for slot, (asset, role, scale) in enumerate(SURFACES):
        info = metadata(asset, 'info', args.cache, args.download)
        files = metadata(asset, 'files', args.cache, args.download)
        source = {'id': asset, 'name': info['name'], 'role': role, 'source': f'https://polyhaven.com/a/{asset}', 'authors': info.get('authors'), 'license': 'CC0-1.0', 'version': {'published': info.get('date_published'), 'files_hash': info.get('files_hash')}, 'sourceDimensionsMM': info.get('dimensions'), 'metersPerRepeat': scale, 'downloads': []}
        for channel, key in [('albedo', 'Diffuse'), ('normal', 'nor_gl'), ('roughness', 'Rough')]:
            spec = files[key]['1k']['jpg']
            cached = args.cache / asset / f'{channel}.jpg'
            fetch(spec['url'], cached, args.download, spec.get('md5'))
            image = Image.open(cached).convert('RGB')
            image = image.resize((1024, 1024), Image.Resampling.LANCZOS)
            if role == 'asphalt' and channel == 'albedo':
                image = ImageEnhance.Brightness(ImageEnhance.Color(image).enhance(0.35)).enhance(0.74)
            sheets[channel].paste(image, ((slot % 2) * 1024, (slot // 2) * 1024))
            source['downloads'].append({**spec, 'channel': channel})
        manifest['sources'].append(source)
        surface_config.append({'id': asset, 'role': role, 'slot': slot, 'metersPerRepeat': scale})
    for channel, image in sheets.items():
        path = output / f'{channel}.webp'
        if channel == 'albedo': image.save(path, format='WEBP', quality=90, method=6)
        else: image.resize((1024, 1024), Image.Resampling.LANCZOS).save(path, format='WEBP', lossless=True, method=6)
        manifest['outputs'].append(record(path))
    (output / 'surfaces.json').write_text(json.dumps({'materials': surface_config, 'maps': {c: f'./{c}.webp' for c in sheets}}, indent=2) + '\n')
    manifest['outputs'].append(record(output / 'surfaces.json'))
    prop = 'metal_trash_can'
    info = metadata(prop, 'info', args.cache, args.download)
    files = metadata(prop, 'files', args.cache, args.download)
    spec = files['gltf']['1k']['gltf']
    source_root = args.cache / prop
    fetch(spec['url'], source_root / 'source.gltf', args.download, spec.get('md5'))
    downloads = [{'url': spec['url'], 'md5': spec.get('md5'), 'size': spec['size']}]
    for name, dependency in spec.get('include', {}).items():
        fetch(dependency['url'], source_root / name, args.download, dependency.get('md5'))
        downloads.append(dependency)
    manifest['propSource'] = {'id': prop, 'source': f'https://polyhaven.com/a/{prop}', 'authors': info.get('authors'), 'license': 'CC0-1.0', 'version': {'published': info.get('date_published'), 'files_hash': info.get('files_hash')}, 'sourceTriangles': info.get('polycount'), 'downloads': downloads, 'status': 'source cached; runtime GLB prepared separately by prepare-urban-prop.mjs'}
    manifests = ASSETS / 'manifests'
    manifests.mkdir(parents=True, exist_ok=True)
    previous_path = manifests / 'polyhaven-urban.json'
    if previous_path.exists():
        previous = json.loads(previous_path.read_text()).get('propSource', {})
        if previous.get('outputs'):
            for key in ['status', 'outputs', 'modifications', 'preparation', 'toolVersions']:
                if key in previous: manifest['propSource'][key] = previous[key]
    (manifests / 'polyhaven-urban.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'surfaceBytes': sum(x['bytes'] for x in manifest['outputs']), 'propCache': str(source_root), 'outputs': manifest['outputs']}, indent=2))


if __name__ == '__main__': main()
