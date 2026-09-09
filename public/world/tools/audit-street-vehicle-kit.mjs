#!/usr/bin/env node
/** Deterministic inventory for the original, locally generated traffic art. */
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

globalThis.location = { search: '' }
globalThis.matchMedia = () => ({ matches: false })
globalThis.window = { devicePixelRatio: 1 }
globalThis.screen = { width: 1280, height: 720 }
const { makeVehicle } = await import('../gen/vehicles.js')
const root = new URL('../', import.meta.url)
const data = JSON.parse(await fs.readFile(new URL('data/vehicles.json', root)))
const traffic = JSON.parse(await fs.readFile(new URL('data/traffic.json', root)))
const atlas = { uv: () => ({ u0: 0, v0: 0, u1: 1, v1: 1 }), uvAt: (_, u, v) => [u, v] }
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const sources = []
for (const path of ['gen/vehicle-kit.js', 'gen/vehicles.js', 'gen/atlas.js', 'engine/actor-batching.js', 'engine/audio-core.js', 'data/vehicles.json', 'data/traffic.json']) {
  const file = await fs.readFile(new URL(path, root))
  sources.push({ path, bytes: file.length, sha256: sha(file) })
}
const archetypes = []
for (const [id, arch] of Object.entries(data.archetypes)) {
  if (arch.kind || id === 'grand-tourer') continue
  const car = makeVehicle(data, id, 'fleet-audit', null, atlas, {})
  archetypes.push({ id, label: arch.label, appearance: arch.appearance, handling: arch.handling, sound: arch.sound, ambientTraffic: traffic.archetypes.includes(id), parked: arch.weight > 0, collisionFootprint: { length: car.userData.length, width: car.userData.width }, lods: car.userData.vehicleLods.map((lod, level) => {
    const g = lod.geometry, geometryBytes = Object.values(g.attributes).reduce((sum, a) => sum + a.array.byteLength, g.index.array.byteLength)
    const checksum = crypto.createHash('sha256')
    for (const attribute of ['position', 'normal', 'color', 'uv']) checksum.update(Buffer.from(g.attributes[attribute].array.buffer))
    checksum.update(Buffer.from(g.index.array.buffer))
    return { level, triangles: g.index.count / 3, vertices: g.attributes.position.count, geometryBytes, geometrySha256: checksum.digest('hex'), materialSlots: 1, wheelPivots: lod.wheels.map(wheel => wheel.pivot), roofHeight: lod.roofHeight }
  }) })
}
const manifest = {
  name: 'Original Brooklyn street-vehicle kit', version: 2, author: 'Raffi World project',
  provenance: 'Original parametric vehicle art authored for this project. No third-party vehicle models, badges, trademarks, or downloaded textures.',
  license: 'Project-owned original source; distributed under the repository terms. Not represented as a third-party CC0 download.',
  units: 'metres', axes: '+Y up, +Z forward', sources,
  fleet: { traffic: traffic.archetypes, parkedFirstPass: data.parked.curated, rareTrackWeight: data.archetypes['track-coupe'].weight },
  presentation: ['Curved body panels with open wheel arches', 'Separate sloped glazing, pillars and roof', 'Recessed grille, lights, door handles and mirrors', '24-segment tires with alloy spokes in the near mesh', '10-segment wheels and omitted small fittings in the far mesh', 'Original physical car-paint/glass/rubber/chrome atlas tiles', 'Per-instance body/roof palette, GPU wheel spin and steering, independent brake lamps'],
  runtime: { loader: 'Local deterministic generator; no separate fleet-model download', extraNetworkAssetBytes: 0, batches: 'One InstancedMesh per archetype/detail level/material; shared geometry and atlas channels', lodSwitchMetres: 36, hysteresisMetres: 5, simulation: 'Existing handles, dimensions, IDs, ownership, AI and collision remain authoritative' },
  reproducibility: { inventory: 'node public/world/tools/audit-street-vehicle-kit.mjs --write', verify: 'node --test public/world/tools/street-vehicle-kit.test.mjs public/world/tools/actor-batching.test.mjs', fingerprint: 'fleet-audit seed, neutral 0..1 atlas UV rectangle; physical runtime atlas coordinates differ' },
  archetypes,
}
const output = JSON.stringify(manifest, null, 2) + '\n'
if (process.argv.includes('--write')) {
  const destination = new URL('assets/manifests/street-vehicle-kit.json', root)
  await fs.writeFile(destination, output)
  process.stdout.write(fileURLToPath(destination) + '\n')
} else process.stdout.write(output)
