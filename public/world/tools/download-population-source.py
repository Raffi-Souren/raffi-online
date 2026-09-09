#!/usr/bin/env python3
"""Reproduce the CC0 MPFB authoring inputs without shipping source packs to players.

python3 download-population-source.py --work /tmp/raffi --setup --python python3.11
/tmp/raffi-blender-runtime/bin/python author-population.py --help

The authoring script accepts --mpfb-source, --user-data and --output for alternate
work roots. Blender 4.5 LTS runs as its official bpy wheel; MPFB is commit-pinned.
Raw ZIP members are size/CRC checked and their SHA256 recorded in the manifest.
"""
import argparse
import concurrent.futures
import hashlib
import io
import json
import pathlib
import struct
import subprocess
import sys
import time
import urllib.request
import zipfile
import zlib

MPFB_REVISION = '437dd513888a92399d1d3200d2e80859fae55abc'
BPY_VERSION = '4.5.13'
OPTIONAL = {
    'dress01': ['toigo_shift_dress', 'toigo_halter_dress_midi'],
    'skirts01': ['toigo_long_full_skirt', 'toigo_tiered_skirt'],
    'hair01': ['cortu_short_messy_hair', 'toigo_inverted_bob', 'elvs_reverse_french_braid_bun', 'rehmanpolanski_hair_bun_brown'],
}
SKINS = {'young_african_male', 'young_asian_female', 'middleage_asian_male', 'middleage_african_female', 'old_caucasian_male', 'old_caucasian_female'}


class RemoteZip(io.RawIOBase):
    def __init__(self, url):
        self.url, self.pos = url, 0
        with urllib.request.urlopen(urllib.request.Request(url, headers={'Range': 'bytes=-65536'}), timeout=90) as response:
            if response.status != 206:
                raise RuntimeError('Source mirror must support bounded byte ranges')
            self.tail = response.read()
            self.size = int(response.headers['Content-Range'].split('/')[-1])
        self.tail_start = self.size - len(self.tail)

    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos
    def seek(self, value, whence=0):
        self.pos = value if whence == 0 else self.pos + value if whence == 1 else self.size + value
        return self.pos

    def read(self, count=-1):
        if count < 0: count = self.size - self.pos
        start, end = self.pos, min(self.size, self.pos + count)
        self.pos = end
        if start >= self.tail_start: return self.tail[start-self.tail_start:end-self.tail_start]
        with urllib.request.urlopen(urllib.request.Request(self.url, headers={'Range': f'bytes={start}-{end-1}'}), timeout=120) as response:
            if response.status != 206: raise RuntimeError('Source mirror ignored a bounded request')
            return response.read()


def selected(pack, name):
    parts, suffix = name.split('/'), pathlib.Path(name).suffix.lower()
    if len(parts) < 2: return False
    if pack != 'makehuman_system_assets' and parts[1] not in OPTIONAL[pack]: return False
    if parts[0] in ('teeth', 'tongue'): return False
    if parts[0] == 'proxymeshes' and parts[1] not in ('male1591', 'female1605', 'proxy741'): return False
    if suffix not in ('.png', '.jpg', '.jpeg', '.tga', '.bmp'): return True
    return parts[0] in ('hair', 'eyes', 'eyebrows', 'eyelashes') or parts[0] == 'skins' and parts[1] in SKINS or name.startswith('clothes/shoes') and name.endswith('_diffuse.png') or name in ('skins/middleage_asian_female/middleage_lightskinned_female_diffuse2.png', 'skins/young_african_female/young_darkskinned_female_diffuse.png')


def fetch_member(root, item):
    pack, url, entry = item
    path = (root / entry['name']).resolve()
    if not path.is_relative_to(root): raise ValueError('Unsafe source archive path')
    data = path.read_bytes() if path.exists() else None
    if data is None or len(data) != entry['bytes'] or zlib.crc32(data) != entry['crc']:
        start = entry['offset']
        end = start + 30 + len(entry['name'].encode()) + entry['compressed'] + 4096
        for retry in range(4):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={'Range': f'bytes={start}-{end}'}), timeout=180) as response:
                    if response.status != 206: raise RuntimeError('Source mirror ignored a bounded request')
                    raw = response.read()
                header = struct.unpack('<4s5H3I2H', raw[:30])
                if header[0] != b'PK\x03\x04': raise ValueError('Invalid ZIP member header')
                at = 30 + header[-2] + header[-1]
                compressed = raw[at:at+entry['compressed']]
                if entry['method'] not in (0, 8): raise ValueError('Unsupported source compression')
                data = zlib.decompress(compressed, -15) if entry['method'] == 8 else compressed
                if len(data) != entry['bytes'] or zlib.crc32(data) != entry['crc']: raise ValueError('Source member integrity failure')
                path.parent.mkdir(parents=True, exist_ok=True)
                temporary = path.with_suffix(path.suffix + '.part'); temporary.write_bytes(data); temporary.replace(path)
                break
            except Exception:
                if retry == 3: raise
                time.sleep(1 + retry)
    return {'pack': pack, 'file': entry['name'], 'url': url, 'bytes': len(data), 'crc32': entry['crc'], 'sha256': hashlib.sha256(data).hexdigest(), 'license': 'CC0-1.0'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', type=pathlib.Path, default=pathlib.Path('/tmp/raffi'))
    parser.add_argument('--setup', action='store_true', help='Prepare pinned Blender runtime and MPFB checkout')
    parser.add_argument('--python', default='python3.11', help='Python 3.11 interpreter for the official bpy wheel')
    args = parser.parse_args()
    base = str(args.work.resolve()); source = pathlib.Path(base + '-mpfb-source'); runtime = pathlib.Path(base + '-blender-runtime'); indices = pathlib.Path(base + '-mpfb-packs'); root = pathlib.Path(base + '-mpfb-user/data').resolve()
    if args.setup:
        if not source.exists(): subprocess.run(['git', 'clone', 'https://github.com/makehumancommunity/mpfb2.git', str(source)], check=True)
        current = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
        if current != MPFB_REVISION:
            dirty = subprocess.check_output(['git', '-C', str(source), 'status', '--porcelain'], text=True)
            if dirty: raise RuntimeError('Refusing to change an edited MPFB checkout')
            subprocess.run(['git', '-C', str(source), 'checkout', '--detach', MPFB_REVISION], check=True)
        if not runtime.exists(): subprocess.run([args.python, '-m', 'venv', str(runtime)], check=True)
        subprocess.run([str(runtime / 'bin/python'), '-m', 'pip', 'install', f'bpy=={BPY_VERSION}'], check=True)
    root.mkdir(parents=True, exist_ok=True); indices.mkdir(parents=True, exist_ok=True)
    members = []
    for pack in ['makehuman_system_assets', *OPTIONAL]:
        path = indices / (pack + '-index.json')
        url = f'https://files.makehumancommunity.org/asset_packs/{pack}/{pack}_cc0.zip'
        if path.exists(): index = json.loads(path.read_text())
        else:
            with zipfile.ZipFile(RemoteZip(url)) as archive:
                entries = [{'name': i.filename, 'bytes': i.file_size, 'compressed': i.compress_size, 'offset': i.header_offset, 'crc': i.CRC, 'method': i.compress_type} for i in archive.infolist() if not i.is_dir()]
            index = {'url': url, 'entries': entries}; path.write_text(json.dumps(index, indent=2))
        members.extend((pack, url, entry) for entry in index['entries'] if selected(pack, entry['name']))
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        records = list(pool.map(lambda item: fetch_member(root, item), members))
    manifest = {'blenderBpy': BPY_VERSION, 'mpfbRevision': MPFB_REVISION, 'mpfbSource': 'https://github.com/makehumancommunity/mpfb2', 'assetLicense': 'CC0-1.0; source code licenses remain separate', 'files': sorted(records, key=lambda row: row['file'])}
    (indices / 'population-source-manifest.json').write_text(json.dumps(manifest, indent=2))
    print(f'Validated {len(records)} selected source files; manifest: {indices}/population-source-manifest.json')


if __name__ == '__main__':
    main()
