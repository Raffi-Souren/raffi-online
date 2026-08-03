import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

// The generator shares its deterministic RNG with the browser state module.
// Provide only the globals that module reads during import; no DOM is needed.
globalThis.location = { search: '' }
globalThis.matchMedia = () => ({ matches: false })
globalThis.window = { devicePixelRatio: 1 }
globalThis.screen = { width: 1280, height: 720 }

const { buildRoadGraph, nearestRoad } = await import('../gen/roads.js')
const { layoutAllLots, layoutLots, ryForRoadSide } = await import('../gen/blocks.js')
const { lotPoint } = await import('../gen/buildings.js')

const world = JSON.parse(fs.readFileSync(new URL('../data/world.json', import.meta.url), 'utf8'))
const blocks = JSON.parse(fs.readFileSync(new URL('../data/blocks.json', import.meta.url), 'utf8'))
const graph = buildRoadGraph(world)
const margin = world.roadGraph.sidewalkWidth + blocks.lotting.blockPadding

function extents(lot) {
  const c = Math.abs(Math.cos(lot.ry))
  const s = Math.abs(Math.sin(lot.ry))
  return { hx: (lot.w * c + lot.d * s) / 2, hz: (lot.w * s + lot.d * c) / 2 }
}

function allLots(cfg = blocks) {
  return Array.from(layoutAllLots(cfg, graph, world).values()).flat()
}

function closestOnSegment(segment, x, z) {
  if (segment.horizontal) {
    return {
      x: Math.max(Math.min(segment.ax, segment.bx), Math.min(x, Math.max(segment.ax, segment.bx))),
      z: segment.az,
    }
  }
  return {
    x: segment.ax,
    z: Math.max(Math.min(segment.az, segment.bz), Math.min(z, Math.max(segment.az, segment.bz))),
  }
}

test('road-side rotation covers all four facade directions', () => {
  const horizontal = { horizontal: true, ax: -10, bx: 10, az: 0, bz: 0 }
  const vertical = { horizontal: false, ax: 0, bx: 0, az: -10, bz: 10 }
  assert.equal(ryForRoadSide({ x: 0, z: -4 }, horizontal), 0)
  assert.equal(ryForRoadSide({ x: 0, z: 4 }, horizontal), Math.PI)
  assert.equal(ryForRoadSide({ x: -4, z: 0 }, vertical), -Math.PI / 2)
  assert.equal(ryForRoadSide({ x: 4, z: 0 }, vertical), Math.PI / 2)
})

test('generated lot footprints clear roads, sidewalks, and block padding', () => {
  for (const lot of allLots()) {
    const { hx, hz } = extents(lot)
    for (const segment of graph.segments) {
      if (segment.horizontal) {
        const along = lot.x + hx > Math.min(segment.ax, segment.bx) - margin && lot.x - hx < Math.max(segment.ax, segment.bx) + margin
        assert.ok(!along || Math.abs(lot.z - segment.az) >= hz + segment.halfWidth + margin, `${lot.id} overlaps horizontal road ${segment.a}>${segment.b}`)
      } else {
        const along = lot.z + hz > Math.min(segment.az, segment.bz) - margin && lot.z - hz < Math.max(segment.az, segment.bz) + margin
        assert.ok(!along || Math.abs(lot.x - segment.ax) >= hx + segment.halfWidth + margin, `${lot.id} overlaps vertical road ${segment.a}>${segment.b}`)
      }
    }
  }
})

test('generated facades face their nearest road', () => {
  for (const lot of allLots()) {
    const { segment } = nearestRoad(graph, lot.x, lot.z)
    assert.ok(segment, `${lot.id} has no nearest road`)
    const closest = closestOnSegment(segment, lot.x, lot.z)
    const dx = closest.x - lot.x
    const dz = closest.z - lot.z
    const length = Math.hypot(dx, dz) || 1
    const frontX = -Math.sin(lot.ry)
    const frontZ = Math.cos(lot.ry)
    assert.ok((frontX * dx + frontZ * dz) / length > 0.5, `${lot.id} faces away from ${segment.a}>${segment.b}`)
  }
})

test('generated footprints stay on district land and outside keepouts', () => {
  const keepouts = world.landmarks.map((landmark) => landmark.keepout).filter(Boolean)
  for (const district of world.districts) {
    for (const lot of layoutLots(district, blocks, graph, world)) {
      const { hx, hz } = extents(lot)
      assert.ok(lot.x - hx >= district.bounds.minX && lot.x + hx <= district.bounds.maxX, `${lot.id} leaves district X bounds`)
      assert.ok(lot.z - hz >= district.bounds.minZ && lot.z + hz <= district.bounds.maxZ, `${lot.id} leaves district Z bounds`)
      for (const harbor of world.harbor) {
        const overlap = lot.x + hx > harbor.minX && lot.x - hx < harbor.maxX && lot.z + hz > harbor.minZ && lot.z - hz < harbor.maxZ
        assert.ok(!overlap, `${lot.id} overlaps harbor ${harbor.id}`)
      }
      for (const keepout of keepouts) {
        const overlap = lot.x + hx > keepout.minX - blocks.lotting.keepoutMargin && lot.x - hx < keepout.maxX + blocks.lotting.keepoutMargin && lot.z + hz > keepout.minZ - blocks.lotting.keepoutMargin && lot.z - hz < keepout.maxZ + blocks.lotting.keepoutMargin
        assert.ok(!overlap, `${lot.id} overlaps landmark keepout`)
      }
    }
  }
})

test('generated lot footprints do not overlap each other', () => {
  for (const district of world.districts) {
    const lots = layoutLots(district, blocks, graph, world)
    for (let i = 0; i < lots.length; i++) {
      const a = lots[i]
      const ae = extents(a)
      for (let j = i + 1; j < lots.length; j++) {
        const b = lots[j]
        const be = extents(b)
        const overlap = Math.abs(a.x - b.x) < ae.hx + be.hx + 2 && Math.abs(a.z - b.z) < ae.hz + be.hz + 2
        assert.ok(!overlap, `${a.id} overlaps ${b.id}`)
      }
    }
  }
})

test('lot generation is deterministic and density remains data-driven', () => {
  const first = Array.from(layoutAllLots(blocks, graph, world).entries())
  const second = Array.from(layoutAllLots(blocks, graph, world).entries())
  assert.deepEqual(second, first)

  const none = structuredClone(blocks)
  none.districts.heights.density = 0
  const noneMap = layoutAllLots(none, graph, world)
  assert.equal(noneMap.get('heights').length, 0)
  for (const district of world.districts.filter((item) => item.id !== 'heights')) {
    assert.deepEqual(noneMap.get(district.id), layoutLots(district, blocks, graph, world), `${district.id} changed with Heights density`)
  }

  const full = structuredClone(blocks)
  full.districts.heights.density = 1
  assert.notDeepEqual(layoutLots(world.districts[0], full, graph, world), layoutLots(world.districts[0], blocks, graph, world))
})

test('front attachments follow every legal lot rotation', () => {
  const directions = [
    { ry: 0, x: 0, z: 5 },
    { ry: Math.PI, x: 0, z: -5 },
    { ry: -Math.PI / 2, x: 5, z: 0 },
    { ry: Math.PI / 2, x: -5, z: 0 },
  ]
  for (const expected of directions) {
    const point = lotPoint({ x: 0, z: 0, ry: expected.ry }, 0, 5)
    assert.ok(Math.abs(point.x - expected.x) < 1e-9)
    assert.ok(Math.abs(point.z - expected.z) < 1e-9)
  }
})
