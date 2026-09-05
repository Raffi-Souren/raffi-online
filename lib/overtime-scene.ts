import * as THREE from "three"
import { BALL_RADIUS, PITCH, matchPose, type SoccerMatch, type Car, type SoccerPose } from "./overtime-engine"

export function createOvertimeScene(host: HTMLElement) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color("#22354b")
  scene.fog = new THREE.Fog("#22354b", 95, 180)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.3
  renderer.domElement.setAttribute(
    "aria-label",
    "Overtime rooftop arena. You drive the blue car toward the orange goal.",
  )
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:none"
  host.appendChild(renderer.domElement)
  const camera = new THREE.OrthographicCamera(-35, 35, 22, -22, 0.1, 220)
  scene.add(new THREE.HemisphereLight(0xbfeaff, 0x22353a, 2.6))
  const sun = new THREE.DirectionalLight(0xffecd2, 3.3)
  sun.position.set(-18, 40, 20)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 32, bottom: -32, near: 1, far: 100 })
  sun.shadow.bias = -0.0005
  scene.add(sun)
  const materials = new Map<string, THREE.MeshStandardMaterial>()
  function material(color: string, emissive = false) {
    const key = `${color}-${emissive}`
    if (!materials.has(key))
      materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.68,
          metalness: 0.12,
          ...(emissive ? { emissive: color, emissiveIntensity: 0.75 } : {}),
        }),
      )
    return materials.get(key)!
  }
  function box(parent: THREE.Object3D, size: number[], position: number[], color: string, emissive = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material(color, emissive))
    mesh.position.set(position[0], position[1], position[2])
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }
  function ring(parent: THREE.Object3D, x: number, z: number, radius: number, color: string) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.045, 5, 64), material(color, true))
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(x, 0.04, z)
    parent.add(mesh)
    return mesh
  }
  box(scene, [66, 2, 47], [0, -1.1, 0], "#344554")
  box(scene, [58, 0.3, 38], [0, -0.2, 0], "#192c39")
  for (let i = 0; i < 10; i++) box(scene, [5.2, 0.08, 34], [-23.4 + i * 5.2, -0.01, 0], i % 2 ? "#285c54" : "#2c635a")
  for (const z of [-16.85, 16.85]) box(scene, [52, 0.04, 0.12], [0, 0.045, z], "#c3ddd2")
  for (const x of [-25.85, 0, 25.85]) box(scene, [0.12, 0.04, 34], [x, 0.045, 0], "#c3ddd2")
  ring(scene, 0, 0, 5, "#b5cfc2")
  for (const side of [-1, 1]) {
    const color = side < 0 ? "#57d7f3" : "#ffad55"
    for (const z of [-1, 1]) {
      box(scene, [53.5, 1.1, 0.45], [0, 0.55, z * 17.4], "#3e5264")
      box(scene, [52, 0.08, 0.08], [0, 1.15, z * 17.35], "#b7d2df", true)
      box(scene, [0.35, 1.05, 11.8], [side * 26.4, 0.53, z * 11.65], color)
      box(scene, [0.15, 0.03, 12], [side * 18.5, 0.045, 0], color)
      box(scene, [7.4, 0.03, 0.12], [side * 22.2, 0.045, z * 6], color)
    }
    // Goal posts, crossbar and a real recessed net behind the scoring line.
    for (const z of [-PITCH.goalHalfWidth, PITCH.goalHalfWidth]) {
      box(scene, [0.28, PITCH.goalHeight, 0.28], [side * 26, PITCH.goalHeight / 2, z], color, true)
      box(scene, [3, 0.18, 0.18], [side * 27.5, PITCH.goalHeight, z], color)
    }
    box(scene, [0.25, 0.25, PITCH.goalHalfWidth * 2], [side * 26, PITCH.goalHeight, 0], color, true)
    const netPoints: number[] = []
    for (let z = -5.4; z <= 5.5; z += 0.9) netPoints.push(side * 29, 0, z, side * 29, 4.5, z)
    for (let y = 0; y <= 4.6; y += 0.75) {
      netPoints.push(side * 29, y, -5.4, side * 29, y, 5.4)
      for (const z of [-5.4, 5.4]) netPoints.push(side * 26, y, z, side * 29, y, z)
    }
    const net = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(netPoints, 3)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 }),
    )
    scene.add(net)
    for (const z of [-20, 20]) {
      box(scene, [0.4, 10, 0.4], [side * 28, 5, z], "#54667a")
      box(scene, [3.8, 0.3, 0.9], [side * 28, 10, z], "#d4eff6", true)
      for (let i = 0; i < 7; i++) {
        const bx = side * (3 + i * 3.5)
        box(scene, [2.1, 0.9, 2], [bx, 0.45, z * 1.03], "#475a70")
        box(scene, [1.8, 0.35, 1.7], [bx, 1.05, z * 1.03], i % 2 ? "#b08d73" : "#698b9b")
      }
    }
  }
  // Low-poly Brooklyn skyline beyond the roof; all geometry is local.
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2
    const x = Math.cos(angle) * (49 + (i % 3) * 5),
      z = Math.sin(angle) * (43 + (i % 4) * 4)
    const height = 8 + ((i * 7) % 17)
    box(scene, [5 + (i % 3), height, 5], [x, height / 2 - 9, z], i % 2 ? "#31465c" : "#3c4e63")
    for (let row = 0; row < 3; row++)
      for (let column = 0; column < 2; column++) {
        box(scene, [0.75, 0.8, 0.04], [x - 1.3 + column * 2.3, height - 11 - row * 2.5, z + 2.52], "#c8ae79", true)
      }
  }
  const padMeshes = [-1, 1].flatMap((side) =>
    [-12, 0, 12].map((x) => {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 0.12, 6), material("#f2bd54", true))
      pad.position.set(x, 0.13, side * 11)
      scene.add(pad)
      ring(scene, x, side * 11, 1.6, "#bc9957")
      return pad
    }),
  )
  function buildCar(color: string) {
    const group = new THREE.Group()
    box(group, [2.65, 0.55, 1.65], [0, 0.65, 0], color)
    box(group, [1.2, 0.48, 1.28], [-0.18, 1.13, 0], color)
    box(group, [0.11, 0.37, 1.04], [0.46, 1.16, 0], "#173749")
    box(group, [1.03, 0.12, 1.75], [-1, 1.1, 0], "#142835")
    box(group, [2, 0.06, 0.25], [0.18, 0.95, 0], "#e5f0e9")
    for (const x of [-0.87, 0.86])
      for (const z of [-0.9, 0.9]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), material("#101e29"))
        wheel.rotation.x = Math.PI / 2
        wheel.position.set(x, 0.42, z)
        wheel.castShadow = true
        group.add(wheel)
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.32, 8), material("#b6c6d0"))
        hub.rotation.x = Math.PI / 2
        hub.position.copy(wheel.position)
        group.add(hub)
      }
    for (const z of [-0.5, 0.5]) {
      box(group, [0.06, 0.14, 0.35], [1.34, 0.71, z], "#fff1bd", true)
      box(group, [0.06, 0.16, 0.3], [-1.34, 0.72, z], "#ee7865", true)
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.8, 7), material("#92ebff", true))
    flame.rotation.z = Math.PI / 2
    flame.position.set(-2.6, 0.57, 0)
    group.add(flame)
    scene.add(group)
    return { group, flame }
  }
  const player = buildCar("#57c7ef"),
    rival = buildCar("#f5a05a")
  const playerRing = ring(scene, -15, 0, 1.85, "#7feaff")
  const ballGeometry = new THREE.IcosahedronGeometry(BALL_RADIUS, 1)
  const colors: number[] = []
  const vertices = ballGeometry.getAttribute("position").count
  for (let i = 0; i < vertices; i++) {
    const color = new THREE.Color(Math.floor(i / 3) % 5 === 0 ? "#273d52" : "#fff5d9")
    colors.push(color.r, color.g, color.b)
  }
  ballGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
  const ball = new THREE.Mesh(
    ballGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.12 }),
  )
  ball.castShadow = true
  scene.add(ball)
  const ballShadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.3, 24),
    new THREE.MeshBasicMaterial({ color: "#081a27", opacity: 0.35, transparent: true, depthWrite: false }),
  )
  ballShadow.rotation.x = -Math.PI / 2
  scene.add(ballShadow)
  const ballRing = ring(scene, 0, 0, 1.5, "#f2e4b3")
  let width = 1,
    height = 1
  const resize = () => {
    width = Math.max(1, host.clientWidth)
    height = Math.max(1, host.clientHeight)
    renderer.setSize(width, height, false)
    const aspect = width / height
    const portrait = aspect < 1
    const shortLandscape = aspect > 3
    const vertical = portrait ? Math.max(53, 41 / aspect) : Math.max(shortLandscape ? 24 : 37, 64 / aspect)
    camera.left = (-vertical * aspect) / 2
    camera.right = (vertical * aspect) / 2
    camera.top = vertical / 2
    camera.bottom = -vertical / 2
    camera.position.set(
      portrait ? -48 : 0,
      portrait ? 68 : shortLandscape ? 28 : 49,
      portrait ? 0 : shortLandscape ? 55 : 42,
    )
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()
  function positionCar(view: ReturnType<typeof buildCar>, car: Car, pose: SoccerPose["player"], time: number) {
    view.group.position.set(pose.x, pose.height, pose.z)
    view.group.rotation.y = -pose.angle
    view.flame.visible = car.boosting
    view.flame.scale.y = 0.85 + Math.sin(time * 48) * 0.15
  }
  return {
    render(match: SoccerMatch) {
      const pose = matchPose(match)
      positionCar(player, match.player, pose.player, match.elapsed)
      positionCar(rival, match.rival, pose.rival, match.elapsed)
      playerRing.position.set(pose.player.x, 0.075, pose.player.z)
      ball.position.set(pose.ball.x, pose.ball.height, pose.ball.z)
      ball.rotation.set(pose.ball.spin * 0.6, 0, -pose.ball.spin * 0.7)
      ballShadow.position.set(pose.ball.x, 0.065, pose.ball.z)
      ballShadow.scale.setScalar(1 + (pose.ball.height - BALL_RADIUS) * 0.1)
      ballRing.position.set(pose.ball.x, 0.08, pose.ball.z)
      padMeshes.forEach((pad, index) => {
        pad.visible = match.pads[index].cooldown === 0
      })
      renderer.render(scene, camera)
    },
    dispose() {
      observer.disconnect()
      const geometries = new Set<THREE.BufferGeometry>(),
        usedMaterials = new Set<THREE.Material>()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          geometries.add(object.geometry)
          if (Array.isArray(object.material)) object.material.forEach((item) => usedMaterials.add(item))
          else usedMaterials.add(object.material)
        }
      })
      geometries.forEach((geometry) => geometry.dispose())
      usedMaterials.forEach((item) => item.dispose())
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
