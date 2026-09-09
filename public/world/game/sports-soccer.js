/** Waterfront 2v2. Direct movement and spatial passing share only the park lifecycle. */
import * as THREE from 'three'
import { createSoccerMatch, stepSoccer } from './sports-soccer-core.js'
import { createSportsActor } from './sports-actors.js'

export async function createSoccer({ aspect = 1.6, mode = 'match', finish, playSound }) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#b6cbbb'); scene.fog = new THREE.Fog('#b6cbbb', 42, 90)
  const camera = new THREE.PerspectiveCamera(47, aspect, .1, 100); camera.position.set(0, 22, 24); camera.lookAt(0, 0, -1)
  const resources = [], material = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .9, ...extra }); resources.push(m); return m }
  const turf = material('#527a53'), stripe = material('#598259'), white = material('#eeeade'), asphalt = material('#616b67'), fence = material('#465e50'), wood = material('#967759'), blue = material('#74b5e0'), red = material('#e6987d')
  function box(x, y, z, w, h, d, m) { const g = new THREE.BoxGeometry(w, h, d); resources.push(g); const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); mesh.receiveShadow = true; scene.add(mesh); return mesh }
  box(0, -.17, 0, 26, .3, 35, asphalt); box(0, 0, 0, 16, .035, 24, turf)
  for (const z of [-9, -3, 3, 9]) box(0, .02, z, 16, .006, 3, stripe)
  for (const x of [-8, 8]) box(x, .03, 0, .08, .012, 24, white)
  for (const z of [-12, 0, 12]) box(0, .032, z, 16, .012, .08, white)
  const circleGeo = new THREE.RingGeometry(2.45, 2.53, 48); resources.push(circleGeo); const circle = new THREE.Mesh(circleGeo, white); circle.rotation.x = -Math.PI / 2; circle.position.y = .04; scene.add(circle)
  const netLines = []
  for (const end of [-1, 1]) {
    for (const x of [-2.4, 2.4]) { box(x, 1.1, end * 12.1, .12, 2.2, .12, white).castShadow = true; box(x, 2.15, end * 12.7, .07, .07, 1.2, white) }
    box(0, 2.2, end * 12.1, 4.9, .12, .12, white).castShadow = true
    for (let x = -2.4; x <= 2.4; x += .3) netLines.push(x, .05, end * 13.3, x, 2.2, end * 13.3, x, 2.2, end * 13.3, x, 2.2, end * 12.1)
    for (let y = .1; y <= 2.2; y += .3) netLines.push(-2.4, y, end * 13.3, 2.4, y, end * 13.3)
    for (const x of [-4.4, 4.4]) box(x, .035, end * 10, .07, .01, 4, white)
    box(0, .035, end * 8, 8.8, .01, .07, white)
  }
  const netGeo = new THREE.BufferGeometry(); netGeo.setAttribute('position', new THREE.Float32BufferAttribute(netLines, 3)); resources.push(netGeo)
  const netMat = new THREE.LineBasicMaterial({ color: '#e8e5d5', transparent: true, opacity: .62 }); resources.push(netMat); scene.add(new THREE.LineSegments(netGeo, netMat))
  for (const x of [-9, 9]) {
    for (let z = -14; z <= 14; z += 2) box(x, .65, z, .06, 1.3, .06, fence)
    for (const y of [.35, 1.25]) box(x, y, 0, .045, .045, 28, fence)
    for (const z of [-4, 5]) { box(x * 1.2, .52, z, .65, .16, 3, wood); box(x * 1.23, .85, z, .12, .7, 3, wood) }
  }
  scene.add(new THREE.HemisphereLight('#f4f5e9', '#425f47', 2.15))
  const sun = new THREE.DirectionalLight('#fff5df', 2.2); sun.position.set(-15, 30, 12); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 20, bottom: -20, near: 1, far: 70 }); sun.shadow.normalBias = .025; scene.add(sun)
  const loaded = await Promise.allSettled(['player', 'park:nico', 'park:imani', 'park:mateo'].map(id => createSportsActor({ id })))
  const failed = loaded.find(result => result.status === 'rejected')
  if (failed) { for (const result of loaded) if (result.status === 'fulfilled') result.value.dispose(); for (const resource of resources) resource.dispose(); scene.clear(); throw failed.reason }
  const actors = loaded.map(result => result.value)
  actors.forEach(a => scene.add(a.group))
  const ringGeo = new THREE.RingGeometry(.42, .51, 24); resources.push(ringGeo)
  const markers = actors.map((_, i) => { const mesh = new THREE.Mesh(ringGeo, i < 2 ? blue : red); mesh.rotation.x = -Math.PI / 2; scene.add(mesh); return mesh })
  const possessionGeo = new THREE.ConeGeometry(.12, .22, 4); resources.push(possessionGeo); const possession = new THREE.Mesh(possessionGeo, white); possession.rotation.z = Math.PI; scene.add(possession)
  const passGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); resources.push(passGeo)
  const passMat = new THREE.LineDashedMaterial({ color: '#b9ddf0', dashSize: .28, gapSize: .22, transparent: true, opacity: .65 }); resources.push(passMat); const passLine = new THREE.Line(passGeo, passMat); scene.add(passLine)
  const ballGeo = new THREE.IcosahedronGeometry(.18, 2); resources.push(ballGeo)
  const ballMat = material('#f3ede0', { roughness: .6 }), ball = new THREE.Mesh(ballGeo, ballMat); ball.castShadow = true; scene.add(ball)
  // Dark pentagonal spots keep spin and scale readable without another texture download.
  const spotGeo = new THREE.CircleGeometry(.06, 5); resources.push(spotGeo); const spotMat = material('#303a36')
  for (const [x, y, z] of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) { const spot = new THREE.Mesh(spotGeo, spotMat); spot.position.set(x * .18, y * .18, z * .18); spot.lookAt(x, y, z); ball.add(spot) }
  const model = createSoccerMatch({ mode }), kickTime = [0, 0, 0, 0]; let finished = false
  return {
    scene, camera,
    update(dt, input) {
      if (finished) return
      const previousOwner = model.ball.owner
      stepSoccer(model, dt, input)
      for (const event of model.events) { playSound?.(event === 'goal' ? 'sports-whistle' : event === 'shot' || event === 'pass' ? 'tennis-hit' : event === 'received' || event === 'tackle' ? 'ui-blip' : 'tennis-bounce'); if ((event === 'shot' || event === 'pass') && previousOwner !== null) kickTime[previousOwner] = .25 }
      model.actors.forEach((p, i) => { kickTime[i] = Math.max(0, kickTime[i] - dt); actors[i].update(dt, { ...p, state: kickTime[i] > 0 ? 'interact' : p.speed > .2 ? 'run' : 'idle' }); markers[i].position.set(p.x, .045, p.z) })
      const b = model.ball; ball.position.set(b.x, b.y, b.z); ball.rotation.x += b.vz * dt; ball.rotation.z -= b.vx * dt
      possession.visible = b.owner !== null
      if (b.owner !== null) { const p = model.actors[b.owner]; possession.position.set(p.x, 2.15, p.z) }
      passLine.visible = b.owner === 0
      if (passLine.visible) { const [p, mate] = model.actors; const positions = passGeo.attributes.position; positions.setXYZ(0, p.x, .09, p.z); positions.setXYZ(1, mate.x, .09, mate.z); positions.needsUpdate = true; passLine.computeLineDistances() }
      if (model.phase === 'done') { finished = true; playSound?.('sports-bell'); finish({ won: model.score[0] > model.score[1], scoreFor: model.score[0], scoreAgainst: model.score[1], bestMetric: model.completedPasses, message: model.score[0] > model.score[1] ? 'Nico: “That give-and-go worked. Same team next time?”' : model.score[0] === model.score[1] ? 'Imani: “Even game. We’ll settle it next time.”' : 'Nico: “Good run. We found a few lanes. Another one?”' }) }
    },
    hud() { const owner = model.ball.owner; return { title: mode === 'watch' ? 'PICKUP SOCCER · WATCHING' : mode === 'practice' ? 'PICKUP SOCCER · PRACTICE' : 'PICKUP SOCCER · 2v2', score: `YOU + NICO ${model.score[0]} — ${model.score[1]} IMANI + MATEO${mode === 'match' ? ` · ${Math.ceil(model.remaining)}s` : ''}`, status: model.status, instruction: 'WASD / stick: move · Space: pass, call or press · Q: shoot · E: sprint · attack the far goal', primaryLabel: owner === 0 ? 'PASS' : owner === 1 ? 'CALL' : 'PRESS', secondaryLabel: 'SHOOT', guardLabel: 'SPRINT' } },
    snapshot: () => structuredClone(model),
    resize(value) { camera.aspect = value; camera.updateProjectionMatrix() },
    dispose() { for (const actor of actors) actor.dispose(); for (const resource of resources) resource.dispose(); scene.clear() },
  }
}
