import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
const assets = new URL('../assets/', import.meta.url)
const manifest = JSON.parse(await fs.readFile(new URL('manifests/nyc-population.json', assets), 'utf8'))

test('twelve independently authored adults retain licensed Blender provenance and measured LOD hashes', async () => {
  assert.equal(manifest.license, 'CC0-1.0')
  assert.equal(manifest.identities.length, 12)
  assert.equal(manifest.geometry.uniqueNearNpcGeometry, 12)
  assert.equal(manifest.blender.version, '4.5.13 LTS')
  assert.match(manifest.blender.mpfbRevision, /^[a-f0-9]{40}$/)
  assert.ok(manifest.sourceFiles.length > 300)
  assert.equal(manifest.authoring.length, 13)
  assert.ok(manifest.identities.filter(identity => identity.presentation === 'woman').length >= 5)
  assert.ok(manifest.identities.filter(identity => identity.presentation === 'man').length >= 4)
  assert.ok(new Set(manifest.identities.map(identity => identity.garment)).size >= 7)
  assert.ok(new Set(manifest.identities.map(identity => identity.face)).size >= 10)
  for (const source of manifest.sources) assert.match(await fs.readFile(new URL(source.licenseFile, assets), 'utf8'), /CC0 1.0/)
  assert.equal(manifest.lods.length, 26)
  assert.equal(new Set(manifest.lods.filter(lod => lod.lod === 'near' && lod.id !== 'player').map(lod => lod.geometrySha256)).size, 12)
  for (const lod of manifest.lods) {
    const bytes = await fs.readFile(new URL(lod.file, assets))
    assert.equal(bytes.length, lod.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), lod.sha256)
    assert.ok(lod.bytes < 1_300_000)
    assert.equal(lod.validation.numErrors, 0); assert.equal(lod.validation.numWarnings, 0)
    assert.ok(lod.draws <= 4)
    if (lod.id !== 'player') assert.ok(lod.triangles <= (lod.lod === 'near' ? 6500 : lod.id === 'rosa' ? 1750 : 1600), `${lod.file}: ${lod.triangles}`)
  }
  const player = manifest.lods.filter(lod => lod.id === 'player')
  assert.ok(player.find(lod => lod.lod === 'far').triangles < player.find(lod => lod.lod === 'near').triangles * .65)
})

test('near and far GLBs retain independently animated skeletons and only local embedded textures', async () => {
  for (const lod of manifest.lods) {
    const bytes = await fs.readFile(new URL(lod.file, assets))
    assert.equal(bytes.readUInt32LE(0), 0x46546c67); assert.equal(bytes.readUInt32LE(4), 2)
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
    const clips = json.animations.map(clip => clip.name)
    for (const name of ['idle', 'walk', 'purposeful', 'run', 'sprint', 'talk', 'sit']) assert.ok(clips.includes(name), `${lod.file}: ${name}`)
    if (lod.lod === 'near' || lod.id === 'player') for (const name of ['drive', 'enter', 'exit', 'interact', 'jab']) assert.ok(clips.includes(name))
    assert.ok(json.skins.every(skin => skin.joints.length >= 50))
    assert.ok(json.extensionsRequired.includes('EXT_meshopt_compression'))
    assert.ok(json.extensionsUsed.includes('EXT_texture_webp'))
    assert.ok(json.images.every(image => image.bufferView !== undefined && image.uri === undefined))
    assert.ok(json.animations.every(clip => clip.channels.length > 20))
  }
})
