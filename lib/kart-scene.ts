import * as THREE from "three"
import { CIRCUIT_LENGTH, PICKUPS, type RaceState } from "./kart-race"

const controlPoints = [
  [0, 3, 165],
  [100, 3, 140],
  [190, 4, 65],
  [150, 5, -20],
  [180, 13, -140],
  [80, 16, -200],
  [-20, 7, -155],
  [-115, 3, -190],
  [-195, 3, -70],
  [-145, 3, 30],
  [-180, 3, 135],
  [-70, 3, 190],
]
const curve = new THREE.CatmullRomCurve3(
  controlPoints.map((p) => new THREE.Vector3(...p)),
  true,
  "catmullrom",
  0.4,
)
const scale = CIRCUIT_LENGTH / curve.getLength()
curve.points.forEach((point) => {
  point.x *= scale
  point.z *= scale
})

function trackPosition(distance: number, lane = 0) {
  const fraction = (((distance / CIRCUIT_LENGTH) % 1) + 1) % 1
  const point = curve.getPointAt(fraction)
  const tangent = curve.getTangentAt(fraction).normalize()
  const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
  point.addScaledVector(right, lane)
  return { point, tangent, right }
}

export function trackBend(distance: number): number {
  const a = trackPosition(distance).tangent
  const b = trackPosition(distance + 8).tangent
  return THREE.MathUtils.clamp((a.x * b.z - a.z * b.x) * 7, -2.4, 2.4)
}

export function createKartScene(host: HTMLDivElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0xb9ddec)
  host.appendChild(renderer.domElement)
  renderer.domElement.style.cssText = "display:block;width:100%;height:100%"
  renderer.domElement.setAttribute("aria-hidden", "true")

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0xb9ddec, 125, 470)
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 800)
  scene.add(new THREE.HemisphereLight(0xe9f6ff, 0x796353, 2.6))
  const sun = new THREE.DirectionalLight(0xffe0ad, 2.3)
  sun.position.set(-80, 160, 60)
  scene.add(sun)

  const materials = new Map<number, THREE.MeshStandardMaterial>()
  const material = (color: number) => {
    let found = materials.get(color)
    if (!found) {
      found = new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
      materials.set(color, found)
    }
    return found
  }
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
  const box = (parent: THREE.Object3D, color: number, size: number[], position: number[]) => {
    const mesh = new THREE.Mesh(boxGeometry, material(color))
    mesh.scale.set(size[0], size[1], size[2])
    mesh.position.set(position[0], position[1], position[2])
    parent.add(mesh)
    return mesh
  }
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 10)
  const cylinder = (parent: THREE.Object3D, color: number, radius: number, height: number, position: number[]) => {
    const mesh = new THREE.Mesh(cylinderGeometry, material(color))
    mesh.scale.set(radius, height, radius)
    mesh.position.set(position[0], position[1], position[2])
    parent.add(mesh)
    return mesh
  }

  const water = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), material(0x69adb7))
  water.rotation.x = -Math.PI / 2
  scene.add(water)
  const island = new THREE.Mesh(new THREE.CylinderGeometry(130 * scale, 139 * scale, 2, 12), material(0x7c9285))
  island.position.y = 0.6
  scene.add(island)

  function ribbon(left: number, right: number, elevation: number, color: number, alternating = false) {
    const positions: number[] = []
    const colors: number[] = []
    const indices: number[] = []
    const c = new THREE.Color()
    for (let i = 0; i <= 640; i++) {
      const distance = (i / 640) * CIRCUIT_LENGTH
      const p1 = trackPosition(distance, left).point
      const p2 = trackPosition(distance, right).point
      positions.push(p1.x, p1.y + elevation, p1.z, p2.x, p2.y + elevation, p2.z)
      c.set(alternating && Math.floor(i / 4) % 2 ? 0xfff0d4 : color)
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b)
      if (i < 640) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.95 }),
    )
    scene.add(mesh)
  }
  ribbon(-11.5, 11.5, -0.15, 0xb8a88d)
  ribbon(-8, 8, 0, 0x3f4b60)
  ribbon(-8.6, -7.8, 0.035, 0xee765c, true)
  ribbon(7.8, 8.6, 0.035, 0xee765c, true)
  ribbon(-10.9, -10.65, 0.55, 0xf5d18a)
  ribbon(10.65, 10.9, 0.55, 0xf5d18a)

  const orientOnTrack = (object: THREE.Object3D, distance: number, lane = 0) => {
    const sample = trackPosition(distance, lane)
    object.position.copy(sample.point)
    object.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z)
  }
  for (let i = 0; i < 135; i++) {
    const mark = box(scene, 0xd9dee0, [0.16, 0.018, 3], [0, 0, 0])
    orientOnTrack(mark, i * 10)
    mark.position.y += 0.025
    if (i % 4 === 0) {
      for (const side of [-1, 1]) {
        const post = new THREE.Group()
        cylinder(post, 0x4c626c, 0.12, 6, [0, 3, 0])
        box(post, 0xf7cf83, [1.4, 0.3, 0.7], [side * -0.4, 6, 0])
        orientOnTrack(post, i * 10, side * 11.1)
        scene.add(post)
      }
    }
  }

  const labelTextures: THREE.CanvasTexture[] = []
  function sign(text: string, bg: string, fg: string, width = 512) {
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = 128
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, 128)
    ctx.strokeStyle = fg
    ctx.lineWidth = 5
    ctx.strokeRect(7, 7, width - 14, 114)
    ctx.fillStyle = fg
    ctx.font = "bold 54px Trebuchet MS, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(text, width / 2, 67, width - 34)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    labelTextures.push(texture)
    return new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
  }

  const gate = new THREE.Group()
  box(gate, 0xf0b64a, [0.65, 9, 0.65], [-9.5, 4.5, 0])
  box(gate, 0xf0b64a, [0.65, 9, 0.65], [9.5, 4.5, 0])
  const gateSign = new THREE.Mesh(
    new THREE.PlaneGeometry(19.5, 3.2),
    sign("BOROUGH / GRAND PRIX", "#23567b", "#fff1d0", 1024),
  )
  gateSign.position.y = 8
  gateSign.rotation.y = Math.PI
  gate.add(gateSign)
  orientOnTrack(gate, 1)
  scene.add(gate)
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 16; col++) {
      const square = box(scene, (row + col) % 2 ? 0xfff4d8 : 0x293243, [1, 0.025, 1], [0, 0, 0])
      orientOnTrack(square, 2 + row, col - 7.5)
      square.position.y += 0.04
    }
  }

  const random = (n: number) => {
    const value = Math.sin(n * 127.1 + 311.7) * 43758.5453
    return value - Math.floor(value)
  }
  const buildingColors = [0xb37564, 0xcc956d, 0x8a8e8c, 0xdda47e, 0x8e706d, 0xbca083]
  const windows: THREE.Matrix4[] = []
  const matrix = new THREE.Matrix4()
  for (let i = 0; i < 90; i++) {
    const x = (random(i) - 0.5) * 250 * scale
    const z = (random(i + 160) - 0.5) * 250 * scale
    if (Math.hypot(x, z) > 124 * scale) continue
    let nearRoad = false
    for (let sample = 0; sample < 90; sample++) {
      const p = trackPosition(sample * 15).point
      if (Math.hypot(p.x - x, p.z - z) < 28) {
        nearRoad = true
        break
      }
    }
    if (nearRoad) continue
    const height = 10 + random(i + 320) * 33
    const width = 8 + random(i + 640) * 8
    box(scene, buildingColors[i % buildingColors.length], [width, height, 12], [x, height / 2 + 1.5, z])
    box(scene, 0x676b69, [width + 1.3, 1, 13.3], [x, height + 1.5, z])
    for (let floor = 0; floor < Math.floor(height / 4); floor++) {
      for (let column = 0; column < 3; column++) {
        for (const side of [-1, 1]) {
          matrix.makeScale(1.5, 1.9, 0.12)
          matrix.setPosition(x + (column - 1) * (width / 3.6), 4.6 + floor * 4, z + side * 6.06)
          windows.push(matrix.clone())
        }
      }
    }
    if (i % 4 === 0) {
      cylinder(scene, 0x645b52, 2.5, 4, [x, height + 5, z])
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.5, 10), material(0x4d5557))
      roof.position.set(x, height + 7.7, z)
      scene.add(roof)
      for (const side of [-1, 1]) box(scene, 0x4d5557, [0.3, 3, 0.3], [x + side * 1.8, height + 2.4, z])
    }
  }
  const windowMesh = new THREE.InstancedMesh(boxGeometry, material(0x416072), windows.length)
  windows.forEach((m, index) => windowMesh.setMatrixAt(index, m))
  scene.add(windowMesh)

  // Suspension towers frame the climb over the East River.
  for (const distance of [480, 610]) {
    const tower = new THREE.Group()
    for (const lane of [-12, 12]) {
      box(tower, 0xc6ad89, [3, 36, 4], [lane, 15, 0])
      box(tower, 0xe2c69e, [4.1, 1.6, 5], [lane, 32.5, 0])
    }
    box(tower, 0xc6ad89, [27, 4, 4], [0, 27, 0])
    orientOnTrack(tower, distance)
    scene.add(tower)
    for (const lane of [-12, 12]) {
      for (const direction of [-1, 1]) {
        const start = trackPosition(distance, lane).point.add(new THREE.Vector3(0, 32, 0))
        const end = trackPosition(distance + direction * 68, lane).point
        const cable = new THREE.BufferGeometry().setFromPoints([start, end])
        scene.add(new THREE.Line(cable, new THREE.LineBasicMaterial({ color: 0x778994 })))
        for (let j = 1; j < 8; j++) {
          const top = start.clone().lerp(end, j / 8)
          const foot = trackPosition(distance + (direction * 68 * j) / 8, lane).point
          scene.add(
            new THREE.Line(
              new THREE.BufferGeometry().setFromPoints([top, foot]),
              new THREE.LineBasicMaterial({ color: 0x889aa1 }),
            ),
          )
        }
      }
    }
  }

  for (const [distance, text, color] of [
    [230, "BODEGA RECORDS", "#ca6556"],
    [790, "BROOKLYN RADIO", "#287680"],
    [1130, "LAST EXIT / DANCE", "#345d81"],
  ] as const) {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), sign(text, color, "#fff2cd", 768))
    orientOnTrack(board, distance, -16)
    board.rotateY(Math.PI)
    board.position.y += 6
    scene.add(board)
  }

  const tireGeometry = new THREE.CylinderGeometry(0.48, 0.48, 0.42, 12)
  const helmetGeometry = new THREE.SphereGeometry(0.51, 12, 8)
  function makeKart(color: number, player = false) {
    const group = new THREE.Group()
    box(group, 0x27334c, [1.9, 0.35, 2.75], [0, 0.46, 0])
    box(group, color, [1.65, 0.4, 2.5], [0, 0.68, 0.05])
    box(group, color, [1.2, 0.32, 1.25], [0, 0.89, 0.65])
    box(group, 0xf7edd3, [0.32, 0.04, 1.1], [0, 1.06, 0.73])
    box(group, 0x27334c, [0.85, 0.75, 0.3], [0, 1.06, -0.7])
    box(group, color, [2.3, 0.15, 0.5], [0, 1.22, -1.22])
    box(group, 0x364158, [0.12, 0.5, 0.12], [-0.7, 1, -1.22])
    box(group, 0x364158, [0.12, 0.5, 0.12], [0.7, 1, -1.22])
    for (const x of [-1, 1]) {
      for (const z of [-0.8, 0.85]) {
        const tire = new THREE.Mesh(tireGeometry, material(0x263146))
        tire.rotation.z = Math.PI / 2
        tire.position.set(x, 0.48, z)
        group.add(tire)
      }
    }
    box(group, player ? 0xe98759 : color, [0.7, 0.65, 0.6], [0, 1.1, -0.22])
    const helmet = new THREE.Mesh(helmetGeometry, material(player ? 0xfbe8bd : 0xf0e3d1))
    helmet.position.set(0, 1.73, -0.17)
    group.add(helmet)
    box(group, 0x334d64, [0.77, 0.23, 0.24], [0, 1.74, 0.25])
    if (player) {
      for (const side of [-1, 1])
        cylinder(group, 0x296580, 0.22, 0.18, [side * 0.49, 1.75, -0.17]).rotation.z = Math.PI / 2
    }
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 16),
      new THREE.MeshBasicMaterial({ color: 0x243b50, transparent: true, opacity: 0.25, depthWrite: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.07
    group.add(shadow)
    scene.add(group)
    return group
  }
  const player = makeKart(0x4ac6d0, true)
  const rivals = [0xffbc44, 0xba86eb, 0xf36d57, 0x49ba8f, 0xf18bb8].map((color) => makeKart(color))
  const sparks = new THREE.Group()
  for (const side of [-1, 1]) {
    const spark = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.4, 5), new THREE.MeshBasicMaterial({ color: 0xffc15a }))
    spark.rotation.x = -Math.PI / 2
    spark.position.set(side * 0.87, 0.4, -1.8)
    sparks.add(spark)
  }
  player.add(sparks)
  const pickupGeometry = new THREE.BoxGeometry(1.9, 1.9, 1.9)
  const pickupMaterial = sign("♫", "#f3b550", "#3d4c68", 128)
  const crates = PICKUPS.map((pickup) => {
    const mesh = new THREE.Mesh(pickupGeometry, pickupMaterial)
    orientOnTrack(mesh, pickup.distance, pickup.lane)
    mesh.position.y += 1.55
    scene.add(mesh)
    return mesh
  })
  const mapPoints = Array.from({ length: 81 }, (_, i) => {
    const point = trackPosition((i / 80) * CIRCUIT_LENGTH).point
    return `${(point.x / scale + 220) / 4.4},${(point.z / scale + 230) / 4.6}`
  }).join(" ")
  let firstFrame = true

  const resize = () => {
    const { width, height } = host.getBoundingClientRect()
    if (width < 1 || height < 1) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  return {
    mapPoints,
    mapPosition(distance: number) {
      const p = trackPosition(distance).point
      return { x: (p.x / scale + 220) / 4.4, y: (p.z / scale + 230) / 4.6 }
    },
    render(race: RaceState, dt: number, steer: number) {
      orientOnTrack(player, race.distance, race.lane)
      player.rotation.y -= steer * (race.wasDrifting ? 0.33 : 0.09)
      player.rotation.z = -steer * Math.min(race.speed / 46, 1) * 0.035
      rivals.forEach((kart, index) => orientOnTrack(kart, race.rivals[index].distance, race.rivals[index].lane))
      const lap = Math.floor(race.distance / CIRCUIT_LENGTH)
      crates.forEach((crate, i) => {
        crate.visible = !race.collected.has(`${lap}-${i}`)
        crate.rotation.y = race.elapsed * 1.1 + i
        crate.position.y = trackPosition(PICKUPS[i].distance).point.y + 1.6 + Math.sin(race.elapsed * 3 + i) * 0.22
      })
      sparks.visible = race.boost > 0 || race.driftCharge > 0.3
      sparks.scale.z = race.boost > 0 ? 1.7 + Math.sin(race.elapsed * 30) * 0.25 : 0.5
      const behind = trackPosition(race.distance - 10, race.lane * 0.75).point
      behind.y += camera.aspect < 0.8 ? 7.5 : 5.5
      camera.position.lerp(behind, firstFrame ? 1 : 1 - Math.exp(-dt * 10))
      const lookAt = trackPosition(race.distance + 16, race.lane * 0.35).point
      lookAt.y += 1.6
      camera.lookAt(lookAt)
      const targetFov = race.boost > 0 ? 73 : camera.aspect < 0.8 ? 73 : 62
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 5)
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
      firstFrame = false
    },
    dispose() {
      observer.disconnect()
      const geometries = new Set<THREE.BufferGeometry>()
      const sceneMaterials = new Set<THREE.Material>()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          geometries.add(object.geometry)
          const used = Array.isArray(object.material) ? object.material : [object.material]
          used.forEach((m) => sceneMaterials.add(m))
        }
      })
      geometries.forEach((geometry) => geometry.dispose())
      sceneMaterials.forEach((m) => m.dispose())
      labelTextures.forEach((texture) => texture.dispose())
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
