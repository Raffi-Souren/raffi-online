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

export interface ArchitectureSceneController {
  update: (state: ArchitectureSceneState) => void
  overview: (top?: boolean) => void
  rotate: (direction: number) => void
  zoom: (direction: number) => void
  dispose: () => void
}

interface Room {
  center: THREE.Vector3
  floor: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  sign: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  outline: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>
  hit: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>
}

/** Cutaway rooms, route picking and an orbit camera; no account data or assets. */
export function createArchitectureScene(
  host: HTMLDivElement,
  initial: ArchitectureSceneState,
  onSelect: (index: number) => void,
  onEnter: (index: number) => void,
  onUnavailable: () => void,
): ArchitectureSceneController {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" })
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5))
  renderer.setClearColor(0xe8edf2)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.domElement.style.display = "block"
  renderer.domElement.style.width = "100%"
  renderer.domElement.style.height = "100%"
  renderer.domElement.setAttribute("aria-hidden", "true")
  host.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  const model = new THREE.Group()
  scene.add(model)
  const camera = new THREE.OrthographicCamera(-9, 9, 6, -6, 0.1, 100)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false
  controls.minPolarAngle = 0.04
  controls.maxPolarAngle = Math.PI / 2.06
  controls.minZoom = 0.65
  controls.maxZoom = 3
  controls.rotateSpeed = 0.6
  controls.zoomSpeed = 0.8
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7e8d9a, 2.6))
  const light = new THREE.DirectionalLight(0xffffff, 2.5)
  light.position.set(-8, 14, 10)
  scene.add(light)

  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  let rooms: Room[] = []
  let routeMaterials: THREE.MeshBasicMaterial[] = []
  let state = initial
  let frame = 0
  let disposed = false
  let lost = false
  let tween: { from: THREE.Vector3; to: THREE.Vector3; targetFrom: THREE.Vector3; targetTo: THREE.Vector3; zoomFrom: number; zoomTo: number; started: number } | null = null

  const geo = <T extends THREE.BufferGeometry>(value: T) => { geometries.add(value); return value }
  const mat = <T extends THREE.Material>(value: T) => { materials.add(value); return value }
  const finish = (color: number, opacity = 1) => mat(new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.08, transparent: opacity < 1, opacity, depthWrite: opacity === 1 }))
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
    textures.forEach((value) => value.dispose())
    geometries.clear()
    materials.clear()
    textures.clear()
    rooms = []
    routeMaterials = []
  }

  function signTexture(index: number, selected: boolean) {
    const station = state.architecture.stations[index]
    const canvas = document.createElement("canvas")
    canvas.width = 768
    canvas.height = 192
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.fillStyle = selected ? "#225fa5" : "#f5f8fa"
    ctx.fillRect(0, 0, 768, 192)
    ctx.fillStyle = selected ? "#ffffff" : "#255e9a"
    ctx.fillRect(0, 0, 12, 192)
    ctx.font = "bold 41px Tahoma, Arial, sans-serif"
    ctx.fillText(`${String(index + 1).padStart(2, "0")}  ${station.title}`, 30, 83, 710)
    ctx.font = "27px Tahoma, Arial, sans-serif"
    ctx.fillStyle = selected ? "#d9e8fa" : "#60768b"
    ctx.fillText(station.subtitle, 30, 135, 710)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    textures.add(map)
    return map
  }

  function makeRoom(index: number) {
    const column = index % 3
    const level = Math.floor(index / 3)
    const x = (column - 1) * 4.15
    const y = level * 3.05
    const z = level ? -2.35 : 1.3
    const plaster = finish(0xf5f6f5)
    const edge = finish(0xa8b8c6)
    const floor = box([3.82, 0.15, 2.6], [x, y + 0.04, z], finish(0xdce5ed)) as Room["floor"]
    box([3.82, 1.85, 0.12], [x, y + 1.02, z - 1.24], plaster)
    box([0.1, 1.85, 2.6], [x - 1.86, y + 1.02, z], plaster)
    box([0.1, 0.75, 2.6], [x + 1.86, y + 0.47, z], plaster)
    box([3.75, 0.16, 0.18], [x, y + 1.97, z + 1.2], edge)
    box([0.12, 1.9, 0.12], [x + 1.84, y + 1.02, z + 1.2], edge)
    // A workbench and terminal turn each stage into a small room, not a card.
    const bench = finish(0xb4c4cf)
    box([1.65, 0.1, 0.72], [x, y + 0.72, z - 0.1], bench)
    for (const dx of [-0.7, 0.7]) box([0.08, 0.62, 0.5], [x + dx, y + 0.38, z - 0.1], edge)
    box([0.76, 0.49, 0.08], [x, y + 1.04, z - 0.2], finish(0x314a62))
    box([0.66, 0.37, 0.01], [x, y + 1.05, z - 0.151], flat(0x6a9bb9))
    box([0.5, 0.025, 0.18], [x, y + 0.79, z + 0.12], finish(0xe9edf1))
    box([0.42, 0.6, 0.46], [x + 1.2, y + 0.4, z - 0.77], finish(0x738f8d))
    const map = signTexture(index, index === state.selectedIndex)
    const signMaterial = mat(new THREE.MeshBasicMaterial({ map, color: 0xffffff, side: THREE.DoubleSide }))
    const sign = new THREE.Mesh(geo(new THREE.PlaneGeometry(3.5, 0.875)), signMaterial)
    sign.position.set(x, y + 1.42, z + 1.225)
    model.add(sign)
    const outline = new THREE.LineSegments(geo(new THREE.EdgesGeometry(new THREE.BoxGeometry(3.87, 2.02, 2.65))), mat(new THREE.LineBasicMaterial({ color: 0x2265aa, transparent: true, opacity: 0.8 })))
    outline.position.set(x, y + 1.02, z)
    model.add(outline)
    const hit = new THREE.Mesh(geo(new THREE.BoxGeometry(3.85, 2.02, 2.65)), mat(new THREE.MeshBasicMaterial({ visible: false })))
    hit.position.copy(outline.position)
    hit.userData.stationIndex = index
    model.add(hit)
    rooms.push({ center: new THREE.Vector3(x, y + 0.95, z), floor, sign, outline, hit })
  }

  function build() {
    clearModel()
    const slab = finish(0xbed0dd)
    box([13.3, 0.24, 3.5], [0, -0.16, 1.6], slab)
    box([13.3, 0.24, 3.5], [0, 2.89, -2.05], slab)
    const foundation = finish(0xd4dde4)
    box([15.5, 0.18, 9.3], [0.35, -0.42, -0.1], foundation)
    for (const x of [-6.45, 6.45]) for (const z of [-3.65, -0.5]) box([0.14, 3.05, 0.14], [x, 1.35, z], finish(0x90a4b5))
    // The exposed stair is the vertical connection between the two reading levels.
    for (let step = 0; step < 12; step++) {
      box([0.78, 0.11, 0.32], [7.02, -0.02 + step * 0.263, 3.05 - step * 0.32], finish(0xa2b6c7))
    }
    for (let index = 0; index < state.architecture.stations.length; index++) makeRoom(index)
    for (let index = 0; index < rooms.length - 1; index++) {
      const a = rooms[index].center
      const b = rooms[index + 1].center
      const start = new THREE.Vector3(a.x, a.y - 0.68, a.z + 1.55)
      const end = new THREE.Vector3(b.x, b.y - 0.68, b.z + 1.55)
      const points = index === 2
        ? [start, new THREE.Vector3(7.05, start.y, start.z), new THREE.Vector3(7.05, end.y, end.z), end]
        : [start, end]
      const curve = new THREE.CatmullRomCurve3(points, false, "centripetal")
      const route = mat(new THREE.MeshBasicMaterial({ color: 0x6b9dca }))
      routeMaterials.push(route)
      model.add(new THREE.Mesh(geo(new THREE.TubeGeometry(curve, 40, 0.032, 5, false)), route))
      const arrow = new THREE.Mesh(geo(new THREE.ConeGeometry(0.09, 0.22, 8)), route)
      arrow.position.copy(curve.getPoint(0.87))
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(0.87).normalize())
      model.add(arrow)
    }
    highlight()
  }

  function highlight() {
    rooms.forEach((room, index) => {
      const selected = index === state.selectedIndex
      room.floor.material.color.setHex(selected ? 0xa6c8e7 : 0xdce5ed)
      room.outline.visible = selected
      const old = room.sign.material.map
      if (old) { textures.delete(old); old.dispose() }
      room.sign.material.map = signTexture(index, selected)
      room.sign.material.needsUpdate = true
    })
    routeMaterials.forEach((surface, index) => surface.color.setHex(index === state.selectedIndex - 1 || index === state.selectedIndex ? 0x225fa5 : 0x83a6c3))
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
    setCamera(new THREE.Vector3(top ? 0.01 : 12.5, top ? 24 : 11, top ? 0 : 17), new THREE.Vector3(0.35, 1.6, -0.1), 1, animate)
  }

  function enter(index: number) {
    const point = rooms[index]?.center
    if (!point) return
    setCamera(point.clone().add(new THREE.Vector3(3.5, 2.4, 6.8)), point.clone(), 1.65)
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
  const cancelTween = () => { tween = null }
  const contextLost = (event: Event) => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; onUnavailable() }
  const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0 } else request() }
  controls.addEventListener("change", request)
  controls.addEventListener("start", cancelTween)
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
  overview(false, false)
  resize()
  if (state.entered) enter(state.selectedIndex)
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
      tween = null
      const offset = camera.position.clone().sub(controls.target)
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * Math.PI / 12)
      camera.position.copy(controls.target).add(offset)
      controls.update()
      request()
    },
    zoom(direction) {
      tween = null
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
      controls.removeEventListener("start", cancelTween)
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
