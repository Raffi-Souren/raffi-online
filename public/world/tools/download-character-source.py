#!/usr/bin/env python3
"""Download selected CC0 files through ZIP ranges; never retain a full pack."""
import argparse
import hashlib
import http.cookiejar
import json
import pathlib
import re
import struct
import urllib.parse
import urllib.request
import zlib

PACKS = {"character": ("universal-base-characters", "15861669"), "animation": ("universal-animation-library", "17958403")}

def fresh_url(pack):
    slug, upload = PACKS[pack]
    base = "https://quaternius.itch.io/" + slug
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def token_at(url):
        page = opener.open(url, timeout=45).read().decode()
        token = re.search(r'name="csrf_token" value="([^\"]+)', page)
        if not token:
            raise RuntimeError("The download page changed; re-review its workflow")
        return token.group(1)
    def post(route, token):
        request = urllib.request.Request(base + route, data=urllib.parse.urlencode({"csrf_token": token}).encode(), headers={"Referer": base, "X-Requested-With": "XMLHttpRequest"})
        return json.loads(opener.open(request, timeout=45).read())
    landing = post("/download_url", token_at(base))["url"]
    return post("/file/" + upload, token_at(landing))["url"]

def selected(pack, name):
    filename = name.rsplit("/", 1)[-1]
    if pack == "animation":
        return filename in {"UAL1_Standard.glb", "License.txt", "README.txt"}
    if filename == "License_Standard.txt":
        return True
    if "/Godot - UE/" in name:
        return filename in {"Superhero_Male_FullBody.gltf", "Superhero_Male_FullBody.bin", "Superhero_Female_FullBody.gltf", "Superhero_Female_FullBody.bin", "T_Eye_Brown.png", "T_Eye_Normal.png", "T_Superhero_Male_Dark.png", "T_Superhero_Male_Normal.png", "T_Superhero_Male_Roughness.png", "T_Superhero_Female_Dark_BaseColor.png", "T_Superhero_Female_Normal.png", "T_Superhero_Female_Roughness.png"}
    hair = {"Hair_SimpleParted", "Hair_Beard", "Hair_Buns", "Hair_Buzzed", "Hair_BuzzedFemale", "Hair_Long"}
    return "/Origin at 0/glTF (Godot)/" in name and (filename.rsplit(".", 1)[0] in hair or filename in {"T_Hair_1_BaseColor.png", "T_Hair_1_Normal.png", "T_Hair_2_BaseColor.png", "T_Hair_2_Normal.png"})

def ranged(url, extent):
    request = urllib.request.Request(url, headers={"Range": "bytes=" + extent})
    with urllib.request.urlopen(request, timeout=60) as response:
        if response.status != 206:
            raise RuntimeError("The host must support selective range downloads; refusing a whole-pack response")
        return response.read()

def download(pack, out):
    url = fresh_url(pack)
    directory = ranged(url, "-65536")
    entries, offset = [], 0
    while True:
        offset = directory.find(b"PK\x01\x02", offset)
        if offset < 0:
            break
        fields = struct.unpack_from("<4s6H3I5H2I", directory, offset)
        name_len, extra_len, comment_len = fields[10:13]
        name = directory[offset + 46:offset + 46 + name_len].decode()
        entries.append((name, fields[8], fields[9], fields[-1], fields[4], fields[7]))
        offset += 46 + name_len + extra_len + comment_len
    manifest = []
    for name, compressed, size, offset, method, crc in entries:
        if not selected(pack, name):
            continue
        filename = name.rsplit("/", 1)[-1]
        data = ranged(url, f"{offset}-{offset + 30 + len(name.encode()) + 512 + compressed}")
        header = struct.unpack_from("<4s5H3I2H", data)
        start = 30 + header[-2] + header[-1]
        raw = data[start:start + compressed]
        if method not in (0, 8):
            raise RuntimeError("Unsupported ZIP compression")
        decoded = zlib.decompress(raw, -15) if method == 8 else raw
        if len(decoded) != size or zlib.crc32(decoded) != crc:
            raise RuntimeError("Corrupt source entry: " + name)
        if "License" in filename and b"CC0 1.0" not in decoded:
            raise RuntimeError("Re-review changed source license before import")
        (out / filename).write_bytes(decoded)
        manifest.append({"pack": pack, "entry": name, "file": filename, "bytes": size, "sha256": hashlib.sha256(decoded).hexdigest()})
        print(filename, size, flush=True)
    if not manifest:
        raise RuntimeError("No selected source files found; inspect the new pack directory")
    return manifest

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", nargs="?", default="/tmp/raffi-character-source")
    parser.add_argument("--pack", choices=PACKS, help="Refresh one pack; preserve the other verified index entries")
    args = parser.parse_args()
    out = pathlib.Path(args.destination)
    out.mkdir(parents=True, exist_ok=True)
    index = out / "download-index.json"
    manifest = json.loads(index.read_text()) if index.exists() else []
    for pack in ([args.pack] if args.pack else PACKS):
        entries = download(pack, out)
        manifest = [entry for entry in manifest if entry.get("pack") != pack] + entries
        index.write_text(json.dumps(manifest, indent=2) + "\n")
    for gltf_file in out.glob("*.gltf"):
        for image in json.loads(gltf_file.read_text()).get("images", []):
            name = image.get("uri", "")
            if not (out / name).exists() and "_png.png" in name:
                (out / name).write_bytes((out / name.replace("_png.png", ".png")).read_bytes())

if __name__ == "__main__":
    main()
