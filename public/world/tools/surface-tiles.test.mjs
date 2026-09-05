import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.location = { search: '' }
globalThis.matchMedia = () => ({ matches: false })
globalThis.window = { devicePixelRatio: 1 }
globalThis.screen = { width: 1280, height: 720 }
const { emitSurfaceTiles } = await import('../gen/roads.js')
const { landBasePatches } = await import('../gen/world.js')

test('the land base fills district gaps without covering overlapping harbor cutouts', () => {
  const harbor = [{ minX: 2, maxX: 6, minZ: 3, maxZ: 7 }, { minX: 4, maxX: 8, minZ: 5, maxZ: 9 }]
  const patches = landBasePatches({ bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, harbor })
  assert.equal(patches.reduce((area, p) => area + (p.maxX - p.minX) * (p.maxZ - p.minZ), 0), 72)
  for (let x = 0.5; x < 10; x++) {
    for (let z = 0.5; z < 10; z++) {
      const inside = p => x > p.minX && x < p.maxX && z > p.minZ && z < p.maxZ
      assert.equal(patches.filter(inside).length, harbor.some(inside) ? 0 : 1, `${x},${z} must be water or exactly one land patch`)
    }
  }
})

test('street tiles cover the same authored rectangle at a bounded material scale', () => {
  const tiles = []
  const rect = { material: 'sidewalk' }
  emitSurfaceTiles({ plane: tile => tiles.push(tile) }, { x: 50, y: 0.22, z: -20, w: 160, d: 4, rect }, 8)
  assert.equal(tiles.length, 20)
  assert.equal(tiles.reduce((area, tile) => area + tile.w * tile.d, 0), 640)
  assert.equal(Math.min(...tiles.map(tile => tile.x - tile.w / 2)), -30)
  assert.equal(Math.max(...tiles.map(tile => tile.x + tile.w / 2)), 130)
  for (let index = 0; index < tiles.length; index++) {
    const tile = tiles[index]
    assert.equal(tile.y, 0.22)
    assert.equal(tile.z, -20)
    assert.equal(tile.rect, rect)
    assert.ok(tile.w <= 8 && tile.d <= 8)
    if (index) assert.equal(tiles[index - 1].x + tile.w / 2, tile.x - tile.w / 2)
  }
})

test('roof tiling respects rotated lots and preserves exact surface area', () => {
  const tiles = []
  const surface = { x: 10, y: 23.02, z: 35, w: 25, d: 18, ry: Math.PI / 2 }
  emitSurfaceTiles({ plane: tile => tiles.push(tile) }, surface, 12)
  assert.equal(tiles.length, 6)
  assert.ok(Math.abs(tiles.reduce((area, tile) => area + tile.w * tile.d, 0) - 450) < 1e-8)
  for (const tile of tiles) {
    const localX = tile.z - surface.z
    const localZ = surface.x - tile.x
    assert.ok(Math.abs(localX) + tile.w / 2 <= surface.w / 2 + 1e-8)
    assert.ok(Math.abs(localZ) + tile.d / 2 <= surface.d / 2 + 1e-8)
    assert.equal(tile.ry, surface.ry)
    assert.equal(tile.y, surface.y)
  }
})
