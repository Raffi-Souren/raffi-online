#!/usr/bin/env node
/** Isolated GPU-backed character/loader/animation contract, using local assets. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3000/world/index.html'
const out = process.env.RAFFI_CHARACTER_OUT || '/tmp/raffi-character-smoke'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', ...(process.env.RAFFI_GPU === 'metal' ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])] })
const errors = [], report = []
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.route('**/__character-test', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body style="margin:0"><script type="importmap">{"imports":{"three":"/world/vendor/three.module.js"}}</script><script type="module">
    import * as THREE from 'three';
    import { createPlayerCharacter } from '/world/engine/player-character.js';
    import { GLTFLoader } from '/world/vendor/loaders/GLTFLoader.js';
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#bac7d0');
    const renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setSize(900,800); renderer.toneMapping=THREE.ACESFilmicToneMapping; document.body.append(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(38,900/800,.01,100); camera.position.set(2.5,1.5,3.5); camera.lookAt(0,1,0);
    scene.add(new THREE.HemisphereLight('#d9ecff','#4e4840',2.2)); const sun=new THREE.DirectionalLight('#fff1dc',3);sun.position.set(3,5,5);scene.add(sun);
    const surfaceRoot = new THREE.Group(); const pavement=new THREE.Mesh(new THREE.BoxGeometry(4,.22,4),new THREE.MeshStandardMaterial({color:'#888881',roughness:.95}));pavement.position.y=.11;surfaceRoot.add(pavement);scene.add(surfaceRoot);
    const group=new THREE.Group(),ped=new THREE.Mesh(new THREE.BoxGeometry(.5,1.6,.3),new THREE.MeshBasicMaterial({color:0xff00ff}));group.add(ped);scene.add(group);
    const player={group,ped,vehicle:null};const state={mode:'foot',interior:null,player:{x:0,y:0,z:0,yaw:0,speed:0}};
    const hero=await createPlayerCharacter(player,{tier:'medium',surfaceRoot});
    const step=(seconds=1)=>{for(let i=0;i<Math.ceil(seconds*60);i++)hero.update(1/60,state);scene.updateMatrixWorld(true);renderer.render(scene,camera)};
    const bounds=()=>{const box=new THREE.Box3(),v=new THREE.Vector3();hero.model.traverse(mesh=>{if(!mesh.isMesh)return;mesh.skeleton?.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){v.fromBufferAttribute(mesh.geometry.attributes.position,i);if(mesh.isSkinnedMesh)mesh.applyBoneTransform(i,v);v.applyMatrix4(mesh.matrixWorld);box.expandByPoint(v)}});return{min:box.min.toArray(),max:box.max.toArray()}};
    const snapshot=()=>({stats:{...hero.stats},bounds:bounds(),proxy:ped.visible,position:hero.model.position.toArray(),skinMeshes:(()=>{let n=0;hero.model.traverse(o=>{if(o.isSkinnedMesh)n++});return n})(),draws:renderer.info.render.calls});
    window.test={THREE,scene,renderer,camera,surfaceRoot,player,state,hero,step,bounds,snapshot,createPlayerCharacter,GLTFLoader};step();window.ready=true;
  </script></body></html>` }))
  await page.goto(new URL('/__character-test', base).href)
  await page.waitForFunction(() => window.ready, null, { timeout: 45_000 })
  const idle = await page.evaluate(() => test.snapshot())
  assert.equal(idle.proxy, false)
  assert.equal(idle.stats.animation, 'idle')
  assert.equal(idle.stats.groundQueries, 1)
  assert.equal(idle.stats.groundCandidates, 1)
  assert.ok(Math.abs(idle.stats.groundOffset - .22) < .001)
  assert.ok(idle.bounds.max[1] - idle.bounds.min[1] > 1.5 && idle.bounds.max[1] - idle.bounds.min[1] < 2.1)
  assert.ok(idle.bounds.min[1] > .17 && idle.bounds.min[1] < .33, `idle shoes fail pavement contact: ${JSON.stringify(idle.bounds)}`)
  await page.screenshot({ path: `${out}/idle.png` })
  report.push({ mode: 'idle', ...idle })
  const courtGround = await page.evaluate(() => {
    const { THREE, surfaceRoot, hero, state, step } = test
    const paint = new THREE.Mesh(new THREE.BoxGeometry(2, .34, 2), new THREE.MeshStandardMaterial())
    paint.position.set(4, .17, 0); surfaceRoot.add(paint)
    hero.refreshGroundSurfaces(); state.player.x = 4; step(.5)
    const offset = hero.stats.groundOffset
    paint.removeFromParent(); paint.geometry.dispose(); paint.material.dispose()
    hero.refreshGroundSurfaces(); state.player.x = 0; step(.5)
    return offset
  })
  assert.ok(Math.abs(courtGround - .34) < .001, 'late-built court paint must support rendered shoes despite Float32 height rounding')
  for (const [speed, animation] of [[1.6, 'walk'], [3.4, 'run'], [6.2, 'sprint']]) {
    const sample = await page.evaluate(({ speed }) => { test.state.player.speed = speed; test.step(.8); return test.snapshot() }, { speed })
    assert.equal(sample.stats.animation, animation)
    assert.equal(sample.stats.groundQueries, 3, 'stationary pose tests must use the cached floor result')
    assert.ok(sample.bounds.min.every(Number.isFinite) && sample.bounds.max.every(Number.isFinite))
    assert.ok(sample.bounds.max[1] < 2.6, 'retargeted animation exploded')
    report.push({ mode: animation, ...sample })
  }
  await page.screenshot({ path: `${out}/sprint.png` })
  const qualitySwap = await page.evaluate(async () => {
    const { hero, step, snapshot } = test
    const before = snapshot(), position = hero.model.position.toArray()
    await hero.setQuality('low'); step(.016)
    let normalMaps = 0; hero.model.traverse(object => { if (object.isMesh && object.material.normalMap) normalMaps++ })
    const low = snapshot()
    await hero.setQuality('high'); step(.016)
    const high = snapshot()
    await Promise.all([hero.setQuality('low'), hero.setQuality('high')])
    return { before, low, high, normalMaps, position, finalPosition: hero.model.position.toArray(), lastRequest: hero.stats.lod }
  })
  assert.equal(qualitySwap.low.stats.lod, 'low')
  assert.equal(qualitySwap.normalMaps, 0)
  assert.ok(qualitySwap.low.stats.triangles < qualitySwap.before.stats.triangles * .65)
  assert.equal(qualitySwap.high.stats.triangles, qualitySwap.before.stats.triangles)
  assert.equal(qualitySwap.low.stats.animation, 'sprint')
  assert.equal(qualitySwap.lastRequest, 'standard', 'a stale asynchronous Low request must not override the newer High request')
  qualitySwap.position.forEach((value, i) => assert.ok(Math.abs(value - qualitySwap.finalPosition[i]) < .001))
  report.push({ mode: 'quality-swap', lods: [qualitySwap.low.stats.lod, qualitySwap.high.stats.lod], normalMaps: qualitySwap.normalMaps })
  const memoryCycles = await page.evaluate(async () => {
    const snapshots = []
    for (let i = 0; i < 4; i++) {
      await test.hero.setQuality('low'); test.step(.04)
      await test.hero.setQuality('high'); test.step(.04)
      snapshots.push({ ...test.renderer.info.memory })
    }
    return snapshots
  })
  assert.deepEqual(memoryCycles[3], memoryCycles[0], 'cloned skeleton textures must not leak during repeated quality swaps')
  report.push({ mode: 'quality-resources', memoryCycles })
  const drive = await page.evaluate(async () => {
    const { scene, player, state, step, snapshot, GLTFLoader } = test
    const gltf = await new GLTFLoader().loadAsync('/world/assets/vehicles/grove-gt.glb')
    const car = gltf.scene.getObjectByName('grove-gt-lod0'); car.removeFromParent(); scene.add(car)
    player.vehicle = { x:0, y:0, z:0, yaw:0, riderVisible:false, mesh:{userData:{width:1.92,length:4.72}} }
    state.mode='vehicle';state.player.speed=0;test.surfaceRoot.visible=false;step(1)
    test.camera.position.set(4,2.2,4);test.camera.lookAt(0,.7,0);test.renderer.render(scene,test.camera)
    return snapshot()
  })
  assert.equal(drive.stats.animation, 'drive')
  assert.ok(drive.bounds.max[1] < 1.39, `driver protrudes above car roof: ${JSON.stringify(drive.bounds)}`)
  report.push({ mode: 'drive', ...drive })
  await page.screenshot({ path: `${out}/drive.png` })
  const exit = await page.evaluate(() => { test.player.vehicle=null;test.state.mode='foot';test.state.interior='mainframe';test.state.player.x=3;test.step(1);return test.snapshot() })
  assert.equal(exit.stats.animation, 'idle')
  assert.equal(exit.proxy, false)
  assert.ok(Math.abs(exit.position[0] - 3) < .001 && Math.abs(exit.position[1]) < .001)
  report.push({ mode: 'interior-exit', ...exit })
  const low = await page.evaluate(async () => {
    const { THREE, scene, createPlayerCharacter } = test
    const group=new THREE.Group(),ped=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());group.add(ped);scene.add(group)
    const hero=await createPlayerCharacter({group,ped},{tier:'low'});hero.update(1/60,{mode:'foot',interior:null,player:{x:-3,y:0,z:0,yaw:0,speed:0}})
    let distinctSkeleton=true,normalMaps=0;hero.model.traverse(o=>{if(o.isSkinnedMesh){if(test.hero.model.getObjectByName(o.name)?.skeleton===o.skeleton)distinctSkeleton=false;if(o.material.normalMap)normalMaps++}})
    const result={...hero.stats,distinctSkeleton,normalMaps};hero.dispose();result.proxyRestored=ped.visible;return result
  })
  assert.equal(low.lod, 'low');assert.ok(low.triangles < idle.stats.triangles * .65);assert.equal(low.distinctSkeleton,true);assert.equal(low.normalMaps,0);assert.equal(low.proxyRestored,true)
  report.push({ mode: 'low', ...low })
  assert.deepEqual(errors, [])
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ errors, report }, null, 2))
  process.stdout.write(JSON.stringify({ errors, checks: report.map(({mode,stats,bounds,triangles})=>({mode,animation:stats?.animation,triangles:stats?.triangles||triangles,bounds})) }, null, 2)+'\n')
} finally { await browser.close() }
