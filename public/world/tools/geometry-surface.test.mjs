import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

globalThis.location = { search: '' }
globalThis.matchMedia = () => ({ matches: false })
globalThis.window = { devicePixelRatio: 1 }
globalThis.screen = { width: 1280, height: 720 }

const { MeshBuilder, makeBuilderSet, meshesFrom } = await import('../gen/builder.js')
const { makePed, animatePed } = await import('../gen/peds.js')
const { emitProp } = await import('../gen/props.js')
const { buildBuilding } = await import('../gen/buildings.js')
const { buildBrownstoneRow } = await import('../gen/brooklyn.js')
const { buildRoadGraph, buildRoadGeometry } = await import('../gen/roads.js')
const { partitionOpaqueGeometry, triangleAttrSignature } = await import('../gen/chunk-opaque.js')
const { emitBranch, buildFoliage, updateFoliageCell } = await import('../gen/foliage.js')
const THREE = await import('three')
const load = name => JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'))
const npcs = load('npcs')
const props = load('props')
const blocks = load('blocks')
const tiles = new Map()
const atlas = {
  uv(name) {
    if (!tiles.has(name)) tiles.set(name, { name, u0: 0, v0: 0, u1: 1, v1: 1 })
    return tiles.get(name)
  },
  uvAt: (_, u, v) => [u, v],
}

function normalAt(builder, i) { return builder.normals.slice(i * 3, i * 3 + 3) }
function assertUnitNormals(builder) {
  assert.equal(builder.normals.length, builder.pos.length)
  for (let i = 0; i < builder.vertCount; i++) {
    assert.ok(Math.abs(Math.hypot(...normalAt(builder, i)) - 1) < 1e-6, `unit normal at ${i}`)
  }
}

test('closed primitives have outward triangle winding and unit physical normals', () => {
  for (const shape of ['box', 'sphere', 'cylinder', 'cone']) {
    for (const flipY of shape === 'cone' ? [false, true] : [false]) {
      const builder = new MeshBuilder({}, atlas)
      builder[shape]({ r: 1, h: 2, seg: 12, flipY })
      assertUnitNormals(builder)
      for (let t = 0; t < builder.idx.length; t += 3) {
        const p = builder.idx.slice(t, t + 3).map(i => builder.pos.slice(i * 3, i * 3 + 3))
        const u = p[1].map((n, i) => n - p[0][i]), v = p[2].map((n, i) => n - p[0][i])
        const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
        const centre = p[0].map((_, i) => (p[0][i] + p[1][i] + p[2][i]) / 3)
        assert.ok(n.reduce((sum, value, i) => sum + value * centre[i], 0) > 1e-8, `${shape} triangle ${t / 3} faces inward or degenerates`)
        for (const i of builder.idx.slice(t, t + 3)) {
          assert.ok(n.reduce((sum, value, axis) => sum + value * normalAt(builder, i)[axis], 0) > 0, `${shape} normal disagrees with winding`)
        }
      }
    }
  }
})

test('ellipsoid normals use inverse scale and round geometry shares vertices', () => {
  const b = new MeshBuilder({}, atlas)
  b.sphere({ r: 1, sx: 0.6, sy: 1.4, sz: 0.3, seg: 10, rings: 7 })
  assertUnitNormals(b)
  assert.ok(b.vertCount < b.triangleCount, 'shared rings limit animation buffer work')
  for (let i = 0; i < b.vertCount; i++) {
    const p = b.pos.slice(i * 3, i * 3 + 3)
    const expected = [p[0] / (0.6 ** 2), p[1] / (1.4 ** 2), p[2] / (0.3 ** 2)]
    const length = Math.hypot(...expected)
    for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(normalAt(b, i)[axis] - expected[axis] / length) < 1e-6)
  }
})

test('smooth normals survive spatial chunking without recomputation', () => {
  const set = makeBuilderSet({}, atlas)
  set.opaque.sphere({ x: 139, r: 5, seg: 10 })
  const b = set.opaque
  const parts = partitionOpaqueGeometry(b.pos, b.uvs, b.col, b.idx, { normals: b.normals, cellSize: 140 })
  assert.ok(parts.chunks.length > 1)
  for (const part of parts.chunks) {
    assert.equal(part.normals.length, part.positions.length)
    for (let i = 0; i < part.normals.length; i += 3) {
      const expected = [(part.positions[i] - 139) / 5, part.positions[i + 1] / 5, part.positions[i + 2] / 5]
      expected.forEach((value, j) => assert.ok(Math.abs(value - part.normals[i + j]) < 1e-6))
    }
  }
  const meshes = meshesFrom(set, {}, 'normal-test')
  for (const mesh of meshes.children) assert.equal(mesh.geometry.attributes.normal.count, mesh.geometry.attributes.position.count)
})

test('all animated rigs rotate normals with positions and keep bounded buffers', () => {
  for (const archetype of Object.keys(npcs.archetypes)) {
    const ped = makePed(npcs, archetype, 'normal-test', null, atlas, {}, { includeShadow: false })
    const position = ped.geometry.attributes.position, normal = ped.geometry.attributes.normal
    assert.equal(position.count, normal.count)
    assert.ok(ped.geometry.index.count / 3 <= 1100)
    assert.ok(position.count <= 900)
    const before = new Float32Array(normal.array)
    animatePed(ped, npcs, 'run', 0.13, 3)
    assert.ok(normal.array.some((value, i) => Math.abs(value - before[i]) > 0.03), `${archetype} normals must move`)
    for (let i = 0; i < normal.count; i++) {
      assert.ok(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < 1e-6)
      assert.ok(Number.isFinite(position.getX(i) + position.getY(i) + position.getZ(i)))
    }
    ped.geometry.dispose()
  }
})

test('leafy trees preserve collision and placement RNG with bounded separate foliage', async () => {
  const { makeRng } = await import('../engine/state.js')
  for (const name of ['broadleaf', 'broadleaf-tall', 'planter-tree', 'scrub']) {
    const a = makeRng('prop-placement'), b = makeRng('prop-placement')
    for (const list of Object.values(props.props[name].palette || {})) b.pick(list)
    const set = makeBuilderSet({}, atlas)
    atlas.foliageSources = []
    const collider = emitProp(set, atlas, props, name, 20, 0, 30, 0, a)
    assert.equal(a.next(), b.next(), `${name} decoration must not desync placement`)
    if (props.props[name].collide?.type === 'circle') assert.deepEqual(collider, { type: 'circle', x: 20, z: 30, r: props.props[name].collide.r, tag: name })
    assert.ok(set.opaque.triangleCount <= 400)
    assertUnitNormals(set.opaque)
    assert.ok(atlas.foliageSources.length > 0 && atlas.foliageSources.length <= 60)
    for (const card of atlas.foliageSources) {
      assert.ok(Number.isFinite(card.x + card.y + card.z + card.yaw + card.pitch + card.roll))
      assert.ok(card.w > 0 && card.h > 0)
    }
  }
})

test('tapered tree branches face outward and skip zero-length segments', () => {
  const builder = new MeshBuilder({}, atlas)
  emitBranch(builder, atlas, { x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 }, 0.2)
  assertUnitNormals(builder)
  for (let i = 0; i < builder.vertCount; i++) {
    const [x, , z] = builder.pos.slice(i * 3, i * 3 + 3)
    const [nx, , nz] = normalAt(builder, i)
    assert.ok(x * nx + z * nz > 0, 'branch surface points away from its central axis')
  }
  const before = builder.triangleCount
  emitBranch(builder, atlas, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })
  assert.equal(builder.triangleCount, before)
})

test('leaf instances retain a local culling bound and use cutout shadow depth', () => {
  const material = new THREE.MeshStandardMaterial({ alphaTest: 0.42, transparent: false })
  const source = { x: 5, y: 4, z: 2, pitch: 0, yaw: 0, roll: 0, w: 2, h: 2, color: '#4e7040', shade: 1 }
  const { group, triangles } = buildFoliage([source, { ...source, x: 205 }], material)
  assert.equal(group.children.length, 2, 'distant trees must not share a world-sized culling bound')
  assert.equal(triangles, 8)
  const point = new THREE.Vector3(), matrix = new THREE.Matrix4()
  for (const mesh of group.children) {
    assert.ok(mesh.isInstancedMesh && mesh.castShadow && mesh.receiveShadow)
    assert.equal(mesh.material.transparent, false)
    assert.equal(mesh.material.depthWrite, true)
    assert.equal(mesh.customDepthMaterial.alphaTest, material.alphaTest)
    assert.equal(mesh.customDepthMaterial.map, material.map)
    mesh.getMatrixAt(0, matrix)
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      point.fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(matrix)
      assert.ok(mesh.boundingSphere.containsPoint(point), 'animated cell bounds include every resting leaf vertex')
    }
  }
})

test('distance foliage reduction retains every crown and bounds leaf shadows', () => {
  const material = new THREE.MeshStandardMaterial({ alphaTest: 0.42 })
  const sources = []
  for (const x of [5, 25]) for (let layer = 0; layer < 6; layer++) sources.push({ x, y: 4, z: 2, pitch: 0, yaw: layer * Math.PI / 3, roll: 0, w: 2, h: 2, color: '#4e7040', shade: 1, layer })
  const mesh = buildFoliage(sources, material).group.children[0]
  updateFoliageCell(mesh, new THREE.Vector3(15, 1.8, 2), 'balanced')
  assert.equal(mesh.count, 12)
  assert.equal(mesh.castShadow, true)
  updateFoliageCell(mesh, new THREE.Vector3(500, 1.8, 2), 'balanced')
  assert.equal(mesh.count, 6)
  assert.equal(mesh.castShadow, false)
  const matrix = new THREE.Matrix4(), crowns = new Set()
  for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, matrix); crowns.add(Math.round(matrix.elements[12] + mesh.position.x)) }
  assert.deepEqual([...crowns].sort((a,b) => a-b), [5, 25])
  updateFoliageCell(mesh, new THREE.Vector3(15, 1.8, 2), 'performance')
  assert.equal(mesh.count, 6)
  assert.equal(mesh.castShadow, false)
  updateFoliageCell(mesh, new THREE.Vector3(15, 1.8, 2), 'high')
  assert.equal(mesh.count, 12, 'switching back to High restores the full local canopy')
})

test('parapets enclose a lower roof deck instead of filling the roof with a slab', () => {
  const archetype = Object.entries(blocks.archetypes).find(([, arch]) => arch.cap?.type === 'parapet')
  assert.ok(archetype)
  const [archId, arch] = archetype
  const lot = { id: 'roof-test', seed: 3, archetype: archId, district: 'heights', x: 0, z: 0, w: 20, d: 15, ry: 0 }
  const set = makeBuilderSet({}, atlas)
  const boxes = [], planes = []
  const box = set.opaque.box.bind(set.opaque), plane = set.opaque.plane.bind(set.opaque)
  set.opaque.box = o => { boxes.push(o); return box(o) }
  set.opaque.plane = o => { planes.push(o); return plane(o) }
  buildBuilding(set, atlas, lot, blocks, {})
  const roof = planes.find(o => o.rect.name === 'roof-tar')
  assert.ok(roof, 'roof surface exists')
  const wallPieces = boxes.filter(o => o.y > roof.y && o.h <= (arch.cap.height || 0.8) + 0.01)
  assert.ok(wallPieces.length >= 8, 'four parapet walls and four coping pieces')
  for (const piece of wallPieces) {
    assert.ok(Math.abs(piece.x) >= piece.w / 2 || Math.abs(piece.z) >= piece.d / 2, 'raised cap geometry leaves the roof centre open')
  }
})

test('storefront displays have real depth inside the original collision footprint', () => {
  const set = makeBuilderSet({}, atlas), opaquePanels = [], glassPanels = []
  const opaque = set.opaque.billboard.bind(set.opaque), alpha = set.alpha.billboard.bind(set.alpha)
  set.opaque.billboard = o => { opaquePanels.push(o); opaque(o) }
  set.alpha.billboard = o => { glassPanels.push(o); alpha(o) }
  const colliders = buildBrownstoneRow(set, atlas, {x:0,z:0,count:1,bayWidth:14,depth:12,floors:3,retail:true,identity:'records'})
  const glass = glassPanels.filter(o => o.rect.name === 'shop-glass')
  const sleeves = opaquePanels.filter(o => o.rect?.name === 'album-sleeve')
  assert.equal(glass.length, 2)
  assert.ok(sleeves.length > 0)
  for (const pane of glass) {
    const back = opaquePanels.find(o => o.w === pane.w+0.14 && Math.abs(o.x-pane.x)<0.001)
    assert.ok(back && pane.z-back.z > 0.9, 'display back wall must have measurable parallax behind glazing')
  }
  for (const sleeve of sleeves) {
    assert.ok(Math.abs(sleeve.x)+sleeve.w/2 < 7 && sleeve.z < glass[0].z, 'merchandise stays behind glass, clear of the sidewalk')
  }
  assert.equal(colliders.length, 1)
  assert.deepEqual([colliders[0].x,colliders[0].z,colliders[0].hx,colliders[0].hz],[0,0,7,6])
  assertUnitNormals(set.opaque)
})

test('brownstone distance detail preserves every near triangle, surface attribute and collider', () => {
  const row = { x: -450, z: -170, count: 4, bayWidth: 6.8, depth: 18, floors: 4, yaw: .3 }
  const split = makeBuilderSet({}, atlas), original = makeBuilderSet({}, atlas)
  delete original.detail // Legacy single stream is the independent reference.
  const before = buildBrownstoneRow(original, atlas, row)
  const after = buildBrownstoneRow(split, atlas, row)
  const signature = b => triangleAttrSignature(b.pos, b.uvs, b.col, b.idx)
  assert.deepEqual([...signature(split.opaque), ...signature(split.detail)].sort(), signature(original.opaque))
  assert.deepEqual(before, after)
  assert.ok(split.detail.triangleCount > 1000, 'fine rails and frames have independent distant bounds')
  assertUnitNormals(split.opaque); assertUnitNormals(split.detail)
  const materials = { opaque: new THREE.MeshBasicMaterial(), emissive: new THREE.MeshBasicMaterial(), alpha: new THREE.MeshBasicMaterial() }
  const group = meshesFrom(split, materials, 'detail-preservation')
  let triangles = 0
  group.traverse(o => { if (o.isMesh) { triangles += o.geometry.index.count / 3; o.geometry.dispose() } })
  assert.equal(triangles, split.triangleCount, 'render streams retain the declared complete near geometry')
  for (const material of Object.values(materials)) material.dispose()
})

test('opaque emission partitions without changing its material, triangles or alpha ordering', () => {
  const set = makeBuilderSet({}, atlas)
  for (const x of [-180, 0, 180]) set.emissive.box({ x, y: 3, w: .5, h: .05, d: .2, color: '#ff8844', emissive: true })
  for (const x of [-180, 180]) set.alpha.billboard({ x, y: 2, w: 3, h: 2 })
  const materials = { opaque: new THREE.MeshBasicMaterial(), emissive: new THREE.MeshBasicMaterial(), alpha: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }) }
  const group = meshesFrom(set, materials, 'emission-test')
  const light = group.children.filter(o => o.material === materials.emissive)
  assert.ok(light.length >= 3, 'distant lamps have independent bounds')
  assert.equal(light.reduce((sum, o) => sum + o.geometry.index.count / 3, 0), set.emissive.triangleCount)
  assert.ok(light.every(o => o.userData.opaqueChunk && !o.userData.opaqueDetail), 'whole lamps remain visible with ordinary city fog')
  assert.equal(group.children.filter(o => o.material === materials.alpha).length, 1, 'transparent object sorting remains stable')
  group.traverse(o => { if (o.isMesh) o.geometry.dispose() }); for (const m of Object.values(materials)) m.dispose()
})

test('distant brownstone hardware culls with hysteresis while structural masonry remains', async () => {
  const { gfx } = await import('../engine/render.js')
  const { updateOpaqueFogCull } = await import('../engine/cull-opaque.js')
  const priorScene = gfx.scene
  gfx.scene = new THREE.Scene(); gfx.scene.fog = new THREE.Fog(0, 20, 500)
  const root = new THREE.Group(), material = new THREE.MeshBasicMaterial(), geometry = new THREE.BoxGeometry(2, 2, 2)
  geometry.computeBoundingSphere()
  const detail = new THREE.Mesh(geometry, material), wall = new THREE.Mesh(geometry, material)
  detail.userData = { opaqueChunk: true, opaqueDetail: true }; wall.userData.opaqueChunk = true
  root.add(detail, wall)
  const camera = new THREE.PerspectiveCamera()
  const sample = distance => { camera.position.set(0, 0, distance); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); updateOpaqueFogCull(camera, root) }
  try {
    sample(20); assert.equal(detail.visible, true)
    sample(130); assert.equal(detail.visible, false); assert.equal(wall.visible, true)
    sample(116); assert.equal(detail.visible, false, 'do not flicker back inside exit threshold')
    sample(100); assert.equal(detail.visible, true)
    sample(116); assert.equal(detail.visible, true, 'near stream remains until exit threshold')
    gfx.scene.fog = null; sample(400); assert.equal(detail.visible, true, 'interiors do not inherit exterior distance culling')
  } finally { gfx.scene = priorScene; geometry.dispose(); material.dispose() }
})

test('generic physical buildings no longer emit a detached ground shadow blob', () => {
  const [archetype] = Object.keys(blocks.archetypes)
  const set = makeBuilderSet({}, atlas), planes = []
  const plane = set.alpha.plane.bind(set.alpha)
  set.alpha.plane = o => { planes.push(o); plane(o) }
  buildBuilding(set,atlas,{id:'shadow-test',seed:3,archetype,district:'heights',x:0,z:0,w:20,d:15,ry:0},blocks,{})
  assert.ok(!planes.some(o => o.rect?.name === 'blob'))
})

test('local street repairs stay flush and preserve the drivable road graph', () => {
  const world = load('world'), graph = buildRoadGraph(world), set = makeBuilderSet({}, atlas)
  const before = JSON.stringify(graph.segments)
  buildRoadGeometry(set,atlas,graph,world,{id:'street-detail-test',bounds:{minX:-490,maxX:-400,minZ:-153,maxZ:-136}})
  assert.equal(JSON.stringify(graph.segments),before)
  assertUnitNormals(set.opaque)
  for (let i=1;i<set.opaque.pos.length;i+=3) assert.ok(set.opaque.pos[i] <= world.roadGraph.curbHeight+0.0031)
})
