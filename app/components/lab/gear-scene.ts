import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

export type GearSetup = "xdj" | "rotary"
export interface GearSceneState {
  setup: GearSetup
  separation: number
  selectedLayer: number
  active: boolean
  motionPaused: boolean
  autoRotate: boolean
}

export interface GearSceneController {
  update: (state: GearSceneState) => void
  reset: (top?: boolean) => void
  rotate: (direction: number) => void
  zoom: (direction: number) => void
  dispose: () => void
}

const COLORS = {
  sage: 0x7b8f85,
  sageEdge: 0x5d7068,
  black: 0x171c22,
  rubber: 0x0e1319,
  gold: 0xc6a55a,
  silver: 0xbec7cc,
  white: 0xe8eae5,
  board: 0x264b42,
  blue: 0x74c6d5,
}

class Resources {
  geometries = new Set<THREE.BufferGeometry>()
  materials = new Set<THREE.Material>()
  textures = new Set<THREE.Texture>()

  geometry<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometries.add(geometry)
    return geometry
  }

  material<T extends THREE.Material>(material: T): T {
    this.materials.add(material)
    return material
  }

  dispose() {
    this.geometries.forEach((geometry) => geometry.dispose())
    this.materials.forEach((material) => material.dispose())
    this.textures.forEach((texture) => texture.dispose())
    this.geometries.clear()
    this.materials.clear()
    this.textures.clear()
  }
}

/** A small, deliberately schematic model; the interior is not a service diagram. */
export function createGearScene(host: HTMLDivElement, onContextLost: () => void): GearSceneController {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setClearColor(0x112137)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.22
  renderer.domElement.style.display = "block"
  renderer.domElement.style.width = "100%"
  renderer.domElement.style.height = "100%"
  renderer.domElement.setAttribute("aria-hidden", "true")
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-9, 9, 6, -6, 0.1, 100)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false
  controls.enablePan = false
  controls.minPolarAngle = 0.1
  controls.maxPolarAngle = Math.PI / 2.05
  controls.minZoom = 0.65
  controls.maxZoom = 2.2
  controls.autoRotateSpeed = 0.6
  controls.touches.ONE = THREE.TOUCH.ROTATE
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN
  // OrbitControls claims every touch gesture when it connects. Hand vertical
  // swipes back to the page so the Lab still scrolls past the stage on a phone.
  renderer.domElement.style.touchAction = "pan-y"

  const fixedResources = new Resources()
  let rigResources = new Resources()
  const assembly = new THREE.Group()
  scene.add(assembly)
  let layers: THREE.Group[] = []
  let state: GearSceneState = { setup: "xdj", separation: 0, selectedLayer: 4, active: true, motionPaused: false, autoRotate: false }
  let currentSeparation = 0
  let frameId = 0
  let disposed = false
  let contextLost = false
  let previousTime = 0

  scene.add(new THREE.HemisphereLight(0xdce8f7, 0x24384c, 2.1))
  const key = new THREE.DirectionalLight(0xffefd2, 3.0)
  key.position.set(-7, 12, 8)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0x8cbbff, 2)
  fill.position.set(7, 6, -8)
  scene.add(fill)

  const stageMaterial = fixedResources.material(new THREE.MeshStandardMaterial({ color: 0x182b43, roughness: 0.92 }))
  const stage = new THREE.Mesh(fixedResources.geometry(new THREE.BoxGeometry(15.3, 0.12, 6.5)), stageMaterial)
  stage.position.y = -0.25
  scene.add(stage)
  const grid = new THREE.GridHelper(15, 30, 0x426078, 0x294157)
  grid.position.y = -0.18
  grid.scale.z = 0.43
  scene.add(grid)
  fixedResources.geometries.add(grid.geometry)
  if (Array.isArray(grid.material)) grid.material.forEach((material) => fixedResources.materials.add(material))
  else fixedResources.materials.add(grid.material)

  function material(color: number, metalness = 0.1, roughness = 0.6) {
    return rigResources.material(new THREE.MeshStandardMaterial({ color, metalness, roughness }))
  }

  function box(parent: THREE.Group, size: [number, number, number], position: [number, number, number], surface: THREE.Material) {
    const mesh = new THREE.Mesh(rigResources.geometry(new THREE.BoxGeometry(...size)), surface)
    mesh.position.set(...position)
    parent.add(mesh)
    return mesh
  }

  function disc(parent: THREE.Group, radius: number, height: number, position: [number, number, number], surface: THREE.Material, segments = 48) {
    const mesh = new THREE.Mesh(rigResources.geometry(new THREE.CylinderGeometry(radius, radius, height, segments)), surface)
    mesh.position.set(...position)
    parent.add(mesh)
    return mesh
  }

  function ring(parent: THREE.Group, radius: number, tube: number, position: [number, number, number], surface: THREE.Material) {
    const mesh = new THREE.Mesh(rigResources.geometry(new THREE.TorusGeometry(radius, tube, 5, 64)), surface)
    mesh.rotation.x = Math.PI / 2
    mesh.position.set(...position)
    parent.add(mesh)
  }

  function line(parent: THREE.Group, points: THREE.Vector3[], surface: THREE.Material, radius = 0.025) {
    const curve = new THREE.CatmullRomCurve3(points)
    const mesh = new THREE.Mesh(rigResources.geometry(new THREE.TubeGeometry(curve, 20, radius, 6, false)), surface)
    parent.add(mesh)
  }

  function print(parent: THREE.Group, text: string, position: [number, number, number], width: number, height: number, color = "#d9c17f", background?: string) {
    const canvas = document.createElement("canvas")
    canvas.width = 512
    canvas.height = 128
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    if (background) {
      ctx.fillStyle = background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.fillStyle = color
    ctx.font = "bold 64px Arial, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(text, 256, 66, 498)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    rigResources.textures.add(texture)
    const surface = rigResources.material(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }))
    const mesh = new THREE.Mesh(rigResources.geometry(new THREE.PlaneGeometry(width, height)), surface)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(...position)
    parent.add(mesh)
  }

  function makeDeck(x: number) {
    const chassis = layers[0]
    const circuit = layers[1]
    const top = layers[2]
    const buttons = layers[3]
    const vinyl = layers[4]
    const black = material(COLORS.black)
    const rubber = material(COLORS.rubber)
    const sage = material(COLORS.sage, 0.38, 0.4)
    const edge = material(COLORS.sageEdge, 0.2)
    const gold = material(COLORS.gold, 0.72, 0.28)
    const silver = material(COLORS.silver, 0.75, 0.3)
    box(chassis, [2.85, 0.37, 2.3], [x, 0.16, 0], black)
    for (const dx of [-1.12, 1.12]) for (const z of [-0.84, 0.84]) disc(chassis, 0.18, 0.16, [x + dx, -0.07, z], rubber, 16)
    box(circuit, [2.56, 0.06, 1.98], [x, 0.39, 0], material(COLORS.board))
    for (let i = 0; i < 5; i++) {
      box(circuit, [0.34, 0.05, 0.16], [x - 0.9 + i * 0.4, 0.445, -0.68], black)
      box(circuit, [0.02, 0.012, 0.8], [x - 0.92 + i * 0.4, 0.427, 0.08], gold)
    }
    disc(circuit, 0.41, 0.1, [x - 0.35, 0.48, 0.08], silver)
    box(top, [2.88, 0.14, 2.33], [x, 0.54, 0], edge)
    box(top, [2.85, 0.07, 2.3], [x, 0.64, 0], sage)
    disc(vinyl, 0.96, 0.13, [x - 0.3, 0.75, 0.04], gold)
    for (const radius of [0.94, 0.91, 0.88]) ring(vinyl, radius, 0.009, [x - 0.3, 0.824, 0.04], silver)
    disc(vinyl, 0.86, 0.026, [x - 0.3, 0.84, 0.04], rubber)
    for (const radius of [0.78, 0.68, 0.58]) ring(vinyl, radius, 0.003, [x - 0.3, 0.855, 0.04], material(0x27302d))
    print(vinyl, "Technics", [x - 0.3, 0.858, -0.11], 1.22, 0.3)
    print(vinyl, "50", [x - 0.3, 0.859, 0.2], 0.45, 0.2, "#81918a")
    disc(vinyl, 0.025, 0.065, [x - 0.3, 0.89, 0.04], silver, 12)
    // The gold S-shaped arm is the most recognizable detail in Raffi's reference.
    disc(vinyl, 0.21, 0.11, [x + 1.02, 0.77, -0.73], gold, 24)
    disc(vinyl, 0.1, 0.25, [x + 1.02, 0.94, -0.73], black, 20)
    line(vinyl, [new THREE.Vector3(x + 1.02, 1.08, -0.73), new THREE.Vector3(x + 0.88, 1.09, -0.43), new THREE.Vector3(x + 0.89, 1.03, 0.11), new THREE.Vector3(x + 0.58, 0.99, 0.52)], gold, 0.036)
    box(vinyl, [0.19, 0.06, 0.27], [x + 0.54, 0.98, 0.6], gold).rotation.y = 0.45
    box(vinyl, [0.08, 0.08, 0.11], [x + 0.49, 0.91, 0.69], black)
    box(buttons, [0.055, 0.02, 0.77], [x + 1.12, 0.7, 0.47], black)
    box(buttons, [0.21, 0.05, 0.11], [x + 1.12, 0.75, 0.39], gold)
    box(buttons, [0.32, 0.05, 0.17], [x - 1.1, 0.73, 0.91], gold)
    disc(buttons, 0.075, 0.1, [x - 1.15, 0.75, -0.84], gold, 16)
    print(top, "Technics", [x, 0.685, 0.98], 0.47, 0.1, "#d4dfd7")
    print(top, "50 YEARS", [x + 0.98, 0.685, 0.95], 0.48, 0.1)
  }

  function addBoard(width: number, depth: number) {
    const dark = material(COLORS.black)
    const gold = material(COLORS.gold, 0.5)
    box(layers[1], [width - 0.25, 0.06, depth - 0.25], [0, 0.4, 0], material(COLORS.board))
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * (width - 0.5) / 6
      box(layers[1], [0.21, 0.07, 0.34], [x, 0.47, -0.38], dark)
      box(layers[1], [0.015, 0.01, depth - 0.5], [x, 0.437, 0.04], gold)
    }
  }

  function makeController() {
    const black = material(COLORS.black)
    const white = material(COLORS.white, 0.16, 0.45)
    const silver = material(COLORS.silver, 0.75, 0.3)
    const dark = material(0x344152)
    box(layers[0], [5.55, 0.43, 3.02], [0, 0.18, 0], black)
    addBoard(5.55, 3.02)
    box(layers[2], [5.65, 0.16, 3.05], [0, 0.61, 0], white)
    const screen = material(0x162e40, 0.0, 0.3)
    box(layers[3], [1.24, 0.05, 0.56], [0, 0.73, -1.02], black)
    box(layers[3], [1.11, 0.014, 0.43], [0, 0.768, -1.02], screen)
    const cyan = material(COLORS.blue)
    const amber = material(0xd9ae5e)
    for (let i = 0; i < 13; i++) {
      const x = -0.48 + i * 0.08
      box(layers[3], [0.045, 0.008, 0.035 + Math.sin(i * 2.4) * 0.025], [x, 0.78, -1.08], cyan)
      box(layers[3], [0.045, 0.008, 0.035 + Math.cos(i * 1.8) * 0.024], [x, 0.78, -0.96], amber)
    }
    for (const side of [-1, 1]) {
      const x = side * 1.79
      disc(layers[4], 0.71, 0.1, [x, 0.8, 0.05], black)
      disc(layers[4], 0.64, 0.025, [x, 0.866, 0.05], silver)
      disc(layers[4], 0.25, 0.014, [x, 0.886, 0.05], black)
      ring(layers[4], 0.6, 0.011, [x, 0.888, 0.05], dark)
      disc(layers[4], 0.18, 0.005, [x, 0.898, 0.05], screen)
      for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) {
        const color = [0x738da5, 0x8cab9e, 0xb29b79, 0xb58a80][col]
        box(layers[3], [0.27, 0.045, 0.16], [x - 0.51 + col * 0.34, 0.735, 0.95 + row * 0.24], material(color))
      }
      disc(layers[3], 0.1, 0.035, [x - 0.67, 0.74, 0.45], material(0x94aa7d), 20)
      disc(layers[3], 0.1, 0.035, [x - 0.67, 0.74, 0.71], material(0xb7a273), 20)
      for (let j = 0; j < 3; j++) disc(layers[3], 0.055, 0.065, [x - 0.47 + j * 0.43, 0.75, -0.96], black, 12)
    }
    for (let channel = 0; channel < 4; channel++) {
      const x = (channel - 1.5) * 0.32
      for (let row = 0; row < 4; row++) disc(layers[3], 0.062, 0.11, [x, 0.77, -0.52 + row * 0.3], black, 12)
      box(layers[3], [0.024, 0.015, 0.61], [x, 0.712, 0.78], dark)
      box(layers[3], [0.15, 0.07, 0.1], [x, 0.76, 0.75], black)
    }
    box(layers[3], [0.86, 0.015, 0.025], [0, 0.714, 1.28], dark)
    box(layers[3], [0.12, 0.07, 0.19], [0, 0.76, 1.28], black)
    print(layers[2], "Pioneer DJ", [-2.05, 0.7, -1.36], 0.71, 0.12, "#283238")
    print(layers[2], "XDJ-XZ", [2.22, 0.7, -1.36], 0.52, 0.12, "#283238")
  }

  function makeRotary() {
    const black = material(0x151c24, 0.24, 0.45)
    const silver = material(0x9ca9b0, 0.7, 0.3)
    const white = material(0xdddcc9)
    box(layers[0], [1.92, 0.41, 2.5], [0, 0.18, 0], black)
    addBoard(1.92, 2.5)
    box(layers[2], [1.95, 0.13, 2.53], [0, 0.6, 0], material(0x232b33, 0.45, 0.5))
    for (const x of [-0.51, 0.51]) {
      for (let row = 0; row < 3; row++) {
        disc(layers[3], 0.1, 0.13, [x, 0.76, -0.74 + row * 0.36], black, 20)
        box(layers[3], [0.022, 0.008, 0.055], [x, 0.832, -0.78 + row * 0.36], white)
      }
      disc(layers[4], 0.27, 0.18, [x, 0.8, 0.71], silver, 32)
      disc(layers[4], 0.235, 0.009, [x, 0.899, 0.71], black, 32)
      box(layers[4], [0.026, 0.009, 0.14], [x, 0.908, 0.66], white)
    }
    for (let i = 0; i < 7; i++) {
      const lit = i < 4 ? 0x91a965 : 0x614e33
      box(layers[3], [0.05, 0.015, 0.055], [-0.1, 0.685, -0.48 + i * 0.09], material(lit))
      box(layers[3], [0.05, 0.015, 0.055], [0.1, 0.685, -0.48 + i * 0.09], material(lit))
    }
    print(layers[2], "ROTARY", [0, 0.68, -1.08], 0.65, 0.12, "#c6c8bd")
    print(layers[2], "1", [-0.51, 0.68, 1.08], 0.12, 0.09, "#c6c8bd")
    print(layers[2], "2", [0.51, 0.68, 1.08], 0.12, 0.09, "#c6c8bd")
  }

  function buildRig() {
    assembly.clear()
    rigResources.dispose()
    rigResources = new Resources()
    layers = Array.from({ length: 5 }, (_, index) => {
      const group = new THREE.Group()
      group.name = `layer-${index}`
      assembly.add(group)
      return group
    })
    const offset = state.setup === "xdj" ? 4.5 : 2.65
    makeDeck(-offset)
    makeDeck(offset)
    if (state.setup === "xdj") makeController()
    else makeRotary()
    // Parts share base finishes, but highlighting belongs to a physical layer.
    layers.forEach((layer) => {
      const finishes = new Map<THREE.Material, THREE.Material>()
      layer.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const copyFinish = (surface: THREE.Material) => {
          if (!(surface instanceof THREE.MeshStandardMaterial)) return surface
          let copy = finishes.get(surface)
          if (!copy) {
            copy = rigResources.material(surface.clone())
            finishes.set(surface, copy)
          }
          return copy
        }
        object.material = Array.isArray(object.material) ? object.material.map(copyFinish) : copyFinish(object.material)
      })
    })
    setLayerHighlight()
  }

  function setLayerHighlight() {
    layers.forEach((layer, index) => {
      layer.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((surface) => {
          if (surface instanceof THREE.MeshStandardMaterial) {
            surface.emissive.setHex(index === state.selectedLayer ? 0x3f5961 : 0x000000)
            surface.emissiveIntensity = index === state.selectedLayer ? 0.18 : 0
          }
        })
      })
    })
  }

  function requestRender() {
    if (disposed || contextLost || !state.active || document.hidden || frameId) return
    frameId = requestAnimationFrame(render)
  }

  function render(time: number) {
    frameId = 0
    if (disposed || contextLost || !state.active || document.hidden) return
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 1 / 60
    previousTime = time
    const difference = state.separation - currentSeparation
    currentSeparation = state.motionPaused || Math.abs(difference) < 0.001
      ? state.separation : currentSeparation + difference * Math.min(delta * 11, 1)
    layers.forEach((group, index) => { group.position.y = currentSeparation * index * 0.7 })
    controls.autoRotate = state.autoRotate && !state.motionPaused
    controls.update(delta)
    renderer.render(scene, camera)
    host.dataset.gearSeparation = currentSeparation.toFixed(2)
    host.dataset.gearSetup = state.setup
    host.dataset.gearRendered = "true"
    if (controls.autoRotate || Math.abs(state.separation - currentSeparation) >= 0.001) requestRender()
  }

  function reset(top = false) {
    camera.position.set(top ? 0.01 : 8.5, top ? 18 : 12, top ? 0 : 12)
    controls.target.set(0, 0.75, 0)
    // The three-quarter view fills the stage with the decks rather than the floor grid.
    camera.zoom = top ? 1 : 1.2
    camera.updateProjectionMatrix()
    controls.update()
    requestRender()
  }

  function resize() {
    const width = host.clientWidth
    const height = host.clientHeight
    if (!width || !height) return
    renderer.setSize(width, height, false)
    const aspect = width / height
    const halfWidth = Math.max(7.7, 4.6 * aspect)
    camera.left = -halfWidth
    camera.right = halfWidth
    camera.top = halfWidth / aspect
    camera.bottom = -halfWidth / aspect
    camera.updateProjectionMatrix()
    requestRender()
  }

  function onLost(event: Event) {
    event.preventDefault()
    contextLost = true
    cancelAnimationFrame(frameId)
    frameId = 0
    onContextLost()
  }

  function onVisibility() {
    previousTime = 0
    if (document.hidden) {
      cancelAnimationFrame(frameId)
      frameId = 0
    } else requestRender()
  }

  controls.addEventListener("change", requestRender)
  renderer.domElement.addEventListener("webglcontextlost", onLost)
  document.addEventListener("visibilitychange", onVisibility)
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  buildRig()
  reset()
  resize()

  return {
    update(next) {
      const setupChanged = state.setup !== next.setup
      const layerChanged = state.selectedLayer !== next.selectedLayer
      state = next
      controls.enabled = next.active
      if (setupChanged) buildRig()
      else if (layerChanged) setLayerHighlight()
      if (!state.active) {
        cancelAnimationFrame(frameId)
        frameId = 0
        previousTime = 0
      } else requestRender()
    },
    reset,
    rotate(direction) {
      const offset = camera.position.clone().sub(controls.target)
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * Math.PI / 12)
      camera.position.copy(controls.target).add(offset)
      controls.update()
      requestRender()
    },
    zoom(direction) {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom + direction * 0.15, controls.minZoom, controls.maxZoom)
      camera.updateProjectionMatrix()
      requestRender()
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(frameId)
      observer.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
      renderer.domElement.removeEventListener("webglcontextlost", onLost)
      controls.removeEventListener("change", requestRender)
      controls.dispose()
      rigResources.dispose()
      fixedResources.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
