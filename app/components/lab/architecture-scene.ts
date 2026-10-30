import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { ResearchArchitecture } from "@/data/research-architectures"

export interface ArchitectureSceneState {
  architecture: ResearchArchitecture
  selectedIndex: number
  entered: boolean
  active: boolean
  motionPaused: boolean
}

/** A room label's anchor on the stage, in CSS pixels from its top-left corner. */
export interface RoomLabelPoint {
  x: number
  y: number
  /** Normalized camera depth: lower values are nearer the viewer. */
  depth: number
  visible: boolean
}

export interface ArchitectureSceneController {
  update: (state: ArchitectureSceneState) => void
  overview: (top?: boolean) => void
  rotate: (direction: number) => void
  zoom: (direction: number) => void
  dispose: () => void
}

interface Room {
  bounds: THREE.Box3
  label: THREE.Vector3
  floor: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  outline: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>
  hit: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>
}

// The overview keeps the original three-quarter view; rooms are seen more
// frontally so their benches and screens read once you step inside.
const OVERVIEW_DIRECTION = new THREE.Vector3(12.15, 9.4, 17.1).normalize()
const TOP_DIRECTION = new THREE.Vector3(0, 1, 0.09).normalize()
const ROOM_DIRECTION = new THREE.Vector3(2.6, 3.3, 7.4).normalize()
const CAMERA_DISTANCE = 30
const ROOM_SIZE = new THREE.Vector3(3.87, 2.02, 2.65)

/**
 * Cutaway rooms, route picking and an orbit camera; no account data or assets.
 * Room names are drawn by the page as HTML labels at the points this scene
 * projects, so they stay sharp and readable at every size.
 */
export function createArchitectureScene(
  host: HTMLDivElement,
  initial: ArchitectureSceneState,
  onSelect: (index: number) => void,
  onEnter: (index: number) => void,
  onUnavailable: () => void,
  onLabels: (points: RoomLabelPoint[]) => void,
): ArchitectureSceneController {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" })
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5))
  renderer.setClearColor(0xdde5ec)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.domElement.style.display = "block"
  renderer.domElement.style.width = "100%"
  renderer.domElement.style.height = "100%"
  renderer.domElement.setAttribute("aria-hidden", "true")
  host.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  const model = new THREE.Group()
  scene.add(model)
  const camera = new THREE.OrthographicCamera(-9, 9, 6, -6, 0.1, 100)
  camera.position.set(12.5, 11, 17)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false
  controls.minPolarAngle = 0.04
  controls.maxPolarAngle = Math.PI / 2.06
  controls.minZoom = 0.5
  controls.maxZoom = 4
  controls.rotateSpeed = 0.6
  controls.zoomSpeed = 0.8
  scene.add(new THREE.HemisphereLight(0xffffff, 0x71818f, 2.5))
  const light = new THREE.DirectionalLight(0xfff8ee, 2.7)
  light.position.set(-8, 14, 10)
  scene.add(light)

  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  let rooms: Room[] = []
  let routeMaterials: THREE.MeshBasicMaterial[] = []
  let stairBounds = new THREE.Box3()
  let state = initial
  let frame = 0
  let disposed = false
  let lost = false
  // Which view the camera keeps fitted on resize. A drag or wheel hands the
  // camera to the visitor until they pick a view again.
  let framing: "overview" | "top" | "room" | null = initial.entered ? "room" : "overview"
  let tween: { from: THREE.Vector3; to: THREE.Vector3; targetFrom: THREE.Vector3; targetTo: THREE.Vector3; zoomFrom: number; zoomTo: number; started: number } | null = null

  const geo = <T extends THREE.BufferGeometry>(value: T) => { geometries.add(value); return value }
  const mat = <T extends THREE.Material>(value: T) => { materials.add(value); return value }
  const finish = (color: number, opacity = 1) => mat(new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.06, transparent: opacity < 1, opacity, depthWrite: opacity === 1 }))
  const flat = (color: number) => mat(new THREE.MeshBasicMaterial({ color }))
  const box = (size: [number, number, number], position: [number, number, number], surface: THREE.Material) => {
    const mesh = new THREE.Mesh(geo(new THREE.BoxGeometry(...size)), surface)
    mesh.position.set(...position)
    model.add(mesh)
    return mesh
  }

  function clearModel() {
    model.clear()
    geometries.forEach((value) => value.dispose())
    materials.forEach((value) => value.dispose())
    geometries.clear()
    materials.clear()
    rooms = []
    routeMaterials = []
  }

  function makeRoom(index: number) {
    const column = index % 3
    const level = Math.floor(index / 3)
    const x = (column - 1) * 4.15
    const y = level * 3.05
    const z = level ? -2.35 : 1.3
    const plaster = finish(0xf7f7f3)
    const edge = finish(0x93a8ba)
    const floor = box([3.82, 0.15, 2.6], [x, y + 0.04, z], finish(0xd3dde6)) as Room["floor"]
    box([3.82, 1.85, 0.12], [x, y + 1.02, z - 1.24], plaster)
    box([0.1, 1.85, 2.6], [x - 1.86, y + 1.02, z], plaster)
    box([0.1, 0.75, 2.6], [x + 1.86, y + 0.47, z], plaster)
    box([3.75, 0.16, 0.18], [x, y + 1.97, z + 1.2], edge)
    box([0.12, 1.9, 0.12], [x + 1.84, y + 1.02, z + 1.2], edge)
    // A workbench and terminal turn each stage into a small room, not a card.
    const bench = finish(0xa9bccb)
    box([1.65, 0.1, 0.72], [x, y + 0.72, z - 0.1], bench)
    for (const dx of [-0.7, 0.7]) box([0.08, 0.62, 0.5], [x + dx, y + 0.38, z - 0.1], edge)
    box([0.76, 0.49, 0.08], [x, y + 1.04, z - 0.2], finish(0x2c4359))
    box([0.66, 0.37, 0.01], [x, y + 1.05, z - 0.151], flat(0x74a8c8))
    box([0.5, 0.025, 0.18], [x, y + 0.79, z + 0.12], finish(0xe9edf1))
    box([0.42, 0.6, 0.46], [x + 1.2, y + 0.4, z - 0.77], finish(0x6f8d8a))
    const center = new THREE.Vector3(x, y + 1.02, z)
    const outline = new THREE.LineSegments(
      geo(new THREE.EdgesGeometry(new THREE.BoxGeometry(ROOM_SIZE.x, ROOM_SIZE.y, ROOM_SIZE.z))),
      mat(new THREE.LineBasicMaterial({ color: 0x8299ad, transparent: true, opacity: 0.6 })),
    )
    outline.position.copy(center)
    model.add(outline)
    const hit = new THREE.Mesh(geo(new THREE.BoxGeometry(ROOM_SIZE.x - 0.02, ROOM_SIZE.y, ROOM_SIZE.z)), mat(new THREE.MeshBasicMaterial({ visible: false })))
    hit.position.copy(center)
    hit.userData.stationIndex = index
    model.add(hit)
    rooms.push({
      bounds: new THREE.Box3().setFromCenterAndSize(center, ROOM_SIZE),
      // The label hangs just above the room's front beam.
      label: new THREE.Vector3(x, y + 2.2, z + 1.05),
      floor,
      outline,
      hit,
    })
  }

  function build() {
    clearModel()
    const slab = finish(0xb3c3d1)
    box([13.3, 0.24, 3.5], [0, -0.16, 1.6], slab)
    box([13.3, 0.24, 3.5], [0, 2.89, -2.05], slab)
    const foundation = finish(0xc9d3dc)
    box([15.5, 0.18, 9.3], [0.35, -0.42, -0.1], foundation)
    for (const x of [-6.45, 6.45]) for (const z of [-3.65, -0.5]) box([0.14, 3.05, 0.14], [x, 1.35, z], finish(0x8599ab))
    // The exposed stair is the vertical connection between the two reading levels.
    for (let step = 0; step < 12; step++) {
      box([0.78, 0.11, 0.32], [7.02, -0.02 + step * 0.263, 3.05 - step * 0.32], finish(0x9db1c3))
    }
    stairBounds = new THREE.Box3(new THREE.Vector3(6.6, -0.1, -0.6), new THREE.Vector3(7.45, 3.0, 3.25))
    for (let index = 0; index < state.architecture.stations.length; index++) makeRoom(index)
    for (let index = 0; index < rooms.length - 1; index++) {
      const a = rooms[index].bounds.getCenter(new THREE.Vector3())
      const b = rooms[index + 1].bounds.getCenter(new THREE.Vector3())
      const start = new THREE.Vector3(a.x, a.y - 0.75, a.z + 1.55)
      const end = new THREE.Vector3(b.x, b.y - 0.75, b.z + 1.55)
      const points = index === 2
        ? [start, new THREE.Vector3(7.05, start.y, start.z), new THREE.Vector3(7.05, end.y, end.z), end]
        : [start, end]
      const curve = new THREE.CatmullRomCurve3(points, false, "centripetal")
      const route = mat(new THREE.MeshBasicMaterial({ color: 0x7f9fbd }))
      routeMaterials.push(route)
      model.add(new THREE.Mesh(geo(new THREE.TubeGeometry(curve, 40, 0.045, 6, false)), route))
      const arrow = new THREE.Mesh(geo(new THREE.ConeGeometry(0.12, 0.28, 10)), route)
      arrow.position.copy(curve.getPoint(0.87))
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(0.87).normalize())
      model.add(arrow)
    }
    highlight()
  }

  function highlight() {
    rooms.forEach((room, index) => {
      const selected = index === state.selectedIndex
      room.floor.material.color.setHex(selected ? 0x9cc1e4 : 0xd3dde6)
      room.outline.material.color.setHex(selected ? 0x225fa5 : 0x8299ad)
      room.outline.material.opacity = selected ? 1 : 0.6
    })
    routeMaterials.forEach((surface, index) => surface.color.setHex(index === state.selectedIndex - 1 || index === state.selectedIndex ? 0x225fa5 : 0x7f9fbd))
  }

  const scratch = new THREE.OrthographicCamera()
  const corner = new THREE.Vector3()
  /** Camera placement that fits a box on the stage from the given direction. */
  function fit(bounds: THREE.Box3, direction: THREE.Vector3, padding: number) {
    const target = bounds.getCenter(new THREE.Vector3())
    const position = target.clone().addScaledVector(direction, CAMERA_DISTANCE)
    scratch.position.copy(position)
    scratch.up.copy(camera.up)
    scratch.lookAt(target)
    scratch.updateMatrixWorld(true)
    let halfX = 0.01
    let halfY = 0.01
    for (let index = 0; index < 8; index++) {
      corner.set(index & 1 ? bounds.max.x : bounds.min.x, index & 2 ? bounds.max.y : bounds.min.y, index & 4 ? bounds.max.z : bounds.min.z)
      corner.applyMatrix4(scratch.matrixWorldInverse)
      halfX = Math.max(halfX, Math.abs(corner.x))
      halfY = Math.max(halfY, Math.abs(corner.y))
    }
    const zoom = Math.min((camera.right - camera.left) / (2 * halfX * padding), (camera.top - camera.bottom) / (2 * halfY * padding))
    return { position, target, zoom: THREE.MathUtils.clamp(zoom, controls.minZoom, controls.maxZoom) }
  }

  function mallBounds() {
    const bounds = stairBounds.clone()
    for (const room of rooms) {
      bounds.union(room.bounds)
      bounds.expandByPoint(corner.copy(room.label).setY(room.label.y + 0.75))
    }
    return bounds
  }

  function roomBounds(index: number) {
    const room = rooms[index]
    return room.bounds.clone().expandByPoint(corner.copy(room.label).setY(room.label.y + 0.6)).expandByScalar(0.2)
  }

  function request() {
    if (frame || disposed || lost || !state.active || document.hidden) return
    frame = requestAnimationFrame(draw)
  }

  function setCamera(position: THREE.Vector3, target: THREE.Vector3, zoom: number, animate = true) {
    if (!animate || state.motionPaused) {
      tween = null
      camera.position.copy(position)
      controls.target.copy(target)
      camera.zoom = zoom
      camera.updateProjectionMatrix()
      controls.update()
    } else {
      tween = { from: camera.position.clone(), to: position, targetFrom: controls.target.clone(), targetTo: target, zoomFrom: camera.zoom, zoomTo: zoom, started: performance.now() }
    }
    request()
  }

  function overview(top = false, animate = true) {
    if (!rooms.length) return
    framing = top ? "top" : "overview"
    const view = fit(mallBounds(), top ? TOP_DIRECTION : OVERVIEW_DIRECTION, top ? 1.06 : 1.08)
    setCamera(view.position, view.target, view.zoom, animate)
  }

  function enter(index: number, animate = true) {
    if (!rooms[index]) return
    framing = "room"
    const view = fit(roomBounds(index), ROOM_DIRECTION, 1.16)
    setCamera(view.position, view.target, view.zoom, animate)
  }

  const projected = new THREE.Vector3()
  function placeLabels() {
    const width = host.clientWidth
    const height = host.clientHeight
    onLabels(rooms.map((room) => {
      projected.copy(room.label).project(camera)
      return {
        x: (projected.x + 1) / 2 * width,
        y: (1 - projected.y) / 2 * height,
        depth: projected.z,
        visible: Math.abs(projected.x) <= 1.05 && Math.abs(projected.y) <= 1.05 && projected.z > -1 && projected.z < 1,
      }
    }))
  }

  function draw(now: number) {
    frame = 0
    if (disposed || lost || !state.active || document.hidden) return
    if (tween) {
      const t = state.motionPaused ? 1 : Math.min(1, (now - tween.started) / 430)
      const smooth = t * t * (3 - 2 * t)
      camera.position.lerpVectors(tween.from, tween.to, smooth)
      controls.target.lerpVectors(tween.targetFrom, tween.targetTo, smooth)
      camera.zoom = THREE.MathUtils.lerp(tween.zoomFrom, tween.zoomTo, smooth)
      camera.updateProjectionMatrix()
      controls.update()
      if (t === 1) tween = null
    }
    try {
      renderer.render(scene, camera)
      placeLabels()
      host.dataset.architectureRendered = "true"
      host.dataset.architectureProject = state.architecture.id
      host.dataset.architectureStation = String(state.selectedIndex + 1)
      host.dataset.architectureMode = state.entered ? "room" : "mall"
    } catch {
      lost = true
      onUnavailable()
    }
    if (tween) request()
  }

  function resize() {
    const width = host.clientWidth
    const height = host.clientHeight
    if (!width || !height) return
    renderer.setSize(width, height, false)
    const aspect = width / height
    const halfWidth = Math.max(8.7, 5.4 * aspect)
    camera.left = -halfWidth
    camera.right = halfWidth
    camera.top = halfWidth / aspect
    camera.bottom = -halfWidth / aspect
    camera.updateProjectionMatrix()
    if (framing === "room") enter(state.selectedIndex, false)
    else if (framing) overview(framing === "top", false)
    request()
  }

  const raycaster = new THREE.Raycaster()
  let pointerStart: { x: number; y: number } | null = null
  let dragged = false
  function pick(event: MouseEvent | PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect()
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera)
    return raycaster.intersectObjects(rooms.map((room) => room.hit))[0]?.object.userData.stationIndex as number | undefined
  }
  const pointerDown = (event: PointerEvent) => { pointerStart = { x: event.clientX, y: event.clientY }; dragged = false }
  const pointerMove = (event: PointerEvent) => {
    if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) dragged = true
    renderer.domElement.style.cursor = pick(event) === undefined ? "grab" : "pointer"
  }
  const pointerUp = () => { pointerStart = null }
  const click = (event: MouseEvent) => { if (!dragged) { const index = pick(event); if (index !== undefined) onSelect(index) } }
  const doubleClick = (event: MouseEvent) => { const index = pick(event); if (!dragged && index !== undefined) onEnter(index) }
  const takeCamera = () => { tween = null; framing = null }
  const contextLost = (event: Event) => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; onUnavailable() }
  const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0 } else request() }
  controls.addEventListener("change", request)
  controls.addEventListener("start", takeCamera)
  renderer.domElement.addEventListener("pointerdown", pointerDown)
  renderer.domElement.addEventListener("pointermove", pointerMove)
  renderer.domElement.addEventListener("pointerup", pointerUp)
  renderer.domElement.addEventListener("pointercancel", pointerUp)
  renderer.domElement.addEventListener("click", click)
  renderer.domElement.addEventListener("dblclick", doubleClick)
  renderer.domElement.addEventListener("webglcontextlost", contextLost)
  document.addEventListener("visibilitychange", visibility)
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  build()
  resize()
  controls.enabled = state.active

  return {
    update(next) {
      const changed = state.architecture.id !== next.architecture.id
      const selected = state.selectedIndex !== next.selectedIndex
      const entered = state.entered !== next.entered
      state = next
      controls.enabled = state.active
      if (changed) { build(); overview(false, false) }
      else if (selected) highlight()
      if (state.entered && (changed || selected || entered)) enter(state.selectedIndex)
      else if (entered) overview()
      if (!state.active) { cancelAnimationFrame(frame); frame = 0 }
      else request()
    },
    overview,
    rotate(direction) {
      takeCamera()
      const offset = camera.position.clone().sub(controls.target)
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * Math.PI / 12)
      camera.position.copy(controls.target).add(offset)
      controls.update()
      request()
    },
    zoom(direction) {
      takeCamera()
      camera.zoom = THREE.MathUtils.clamp(camera.zoom + direction * 0.15, controls.minZoom, controls.maxZoom)
      camera.updateProjectionMatrix()
      request()
    },
    dispose() {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener("visibilitychange", visibility)
      controls.removeEventListener("change", request)
      controls.removeEventListener("start", takeCamera)
      controls.dispose()
      renderer.domElement.removeEventListener("pointerdown", pointerDown)
      renderer.domElement.removeEventListener("pointermove", pointerMove)
      renderer.domElement.removeEventListener("pointerup", pointerUp)
      renderer.domElement.removeEventListener("pointercancel", pointerUp)
      renderer.domElement.removeEventListener("click", click)
      renderer.domElement.removeEventListener("dblclick", doubleClick)
      renderer.domElement.removeEventListener("webglcontextlost", contextLost)
      clearModel()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
