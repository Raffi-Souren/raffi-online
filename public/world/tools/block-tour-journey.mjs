#!/usr/bin/env node
/** Uncut daylight neighborhood tour; imports are strictly read-only observers. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
async function buildFingerprint() {
 const digest=createHash('sha256'),root=new URL('../',import.meta.url)
 async function visit(relative){
  const entries=await fs.readdir(new URL(relative,root),{withFileTypes:true})
  for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){const name=relative+entry.name;if(entry.isDirectory())await visit(name+'/');else if(entry.isFile()){digest.update(name);digest.update(await fs.readFile(new URL(name,root)))}}
 }
 for(const directory of ['engine/','game/','gen/','data/','vendor/','assets/'])await visit(directory)
 for(const file of ['index.html','style.css']){digest.update(file);digest.update(await fs.readFile(new URL(file,root)))}
 return digest.digest('hex')
}
const contentHash=await buildFingerprint()
const OUT = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-block-tour'
await fs.mkdir(OUT, { recursive: true })
const url = new URL(process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3081/world/index.html')
url.searchParams.delete('debug'); url.searchParams.delete('auto'); url.searchParams.set('tier', 'medium'); url.searchParams.set('seed', 'FIXED'); url.searchParams.set('hour', '14')
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', ...(process.env.RAFFI_GPU === 'metal' ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])] })
const report = { contentHash, errors: [], checks: [], checkpoints: [], districts: [], visibleIdentities: [], visibleCarriedItems: [], visibleMovingCars: [], noDebug: true, fixturePositions: false, realKeyboardDriving: true, realTime: true }
const started = Date.now(); let page, context, keys = new Set(), driven = 0, previousDrive = null
async function observe() {
  return page.evaluate(() => {
    const { state, player, movementBasis, storySnapshot, isDialogueBlocking, data } = window.__LOOP_OBSERVERS__
    const v = player.vehicle, {gfx,cam,THREE,trafficSnapshot,npcActivitySnapshot}=window.__LOOP_OBSERVERS__
    const inView=(x,y,z)=>{const p=new THREE.Vector3(x,y,z).project(cam.camera);return Math.abs(p.x)<.98&&Math.abs(p.y)<.98&&p.z>-1&&p.z<1}
    const visiblePeople=(gfx.scene.getObjectByName('near-characters')?.children||[]).filter(o=>o.visible&&o.name.startsWith('population:')&&inView(o.position.x,o.position.y+.9,o.position.z)).map(o=>({name:o.name,x:o.position.x,z:o.position.z,distance:Math.hypot(o.position.x-state.player.x,o.position.z-state.player.z)}))
    const visibleAccessories=(gfx.scene.getObjectByName('near-characters')?.children||[]).filter(o=>o.visible&&o.name.startsWith('character-accessory:')&&inView(o.position.x,o.position.y-.2,o.position.z)).map(o=>o.name.split(':')[1])
    const traffic=trafficSnapshot().cars.filter(c=>c.active&&c.speed>.25&&inView(c.x,.9,c.z)&&Math.hypot(c.x-state.player.x,c.z-state.player.z)<55)
    return { visiblePeople, visibleAccessories, traffic, activities:npcActivitySnapshot(), time: state.time, frame: state.frame, paused: state.paused, waypoint: state.navigation.waypoint && { ...state.navigation.waypoint }, player: { ...state.player }, ride: v && { x: v.x, z: v.z, yaw: v.yaw, speed: v.speed, angularVel: v.angularVel, impact: v.lastImpact }, basis: movementBasis(), story: storySnapshot(), dialogue: document.querySelector('#subtitle').classList.contains('show'), blocking: isDialogueBlocking(), prompt: document.querySelector('#interaction-prompt').textContent.trim(), districts: data.world.districts.filter((d) => state.player.x >= d.bounds.minX && state.player.x <= d.bounds.maxX && state.player.z >= d.bounds.minZ && state.player.z <= d.bounds.maxZ).map((d) => d.id) }
  })
}
async function setKeys(next) { const wanted = new Set(next); for (const key of keys) if (!wanted.has(key)) await page.keyboard.up(key); for (const key of wanted) if (!keys.has(key)) await page.keyboard.down(key); keys = wanted }
async function hold(next, seconds) { await setKeys(next); const time = (await observe()).time + seconds; await page.waitForFunction((time) => window.__LOOP_OBSERVERS__.state.time >= time, time, { timeout: 30000 }); }
async function frames() { const frame = (await observe()).frame + 3; await page.waitForFunction((f) => window.__LOOP_OBSERVERS__.state.frame >= f, frame) }
async function action() { await setKeys([]); await page.keyboard.press('e'); await frames() }
async function finishCall() { for (let i = 0; i < 180 && (await observe()).dialogue; i++) { if ((await observe()).blocking) await action(); else await hold([], 0.25) } assert.equal((await observe()).dialogue, false) }
async function checkpoint(label) { await setKeys([]); const sample = await observe(); noteVisible(sample); report.checkpoints.push({ label, elapsedSeconds: (Date.now() - started) / 1000, drivenMeters: driven, ...sample }); await page.screenshot({ path: `${OUT}/${label}.png` }); process.stdout.write(`Core loop: ${label} (${((Date.now() - started) / 1000).toFixed(1)} s)\n`); }
async function walkTo(x, z, radius = 1) {
  let previous = Infinity, stuck = 0
  for (let i = 0; i < 220; i++) {
    const s = await observe(); noteVisible(s); const dx = x - s.player.x, dz = z - s.player.z, d = Math.hypot(dx, dz)
    if (d <= radius) { await hold([], 0.1); return }
    const h = (dx * s.basis.rx + dz * s.basis.rz) / d, f = (dx * s.basis.fx + dz * s.basis.fz) / d
    await hold([...(h > 0.32 ? ['d'] : h < -0.32 ? ['a'] : []), ...(f > 0.32 ? ['w'] : f < -0.32 ? ['s'] : [])], Math.min(0.2, Math.max(0.05, (d - radius) / 4)))
    stuck = d >= previous - 0.015 ? stuck + 1 : 0; previous = d
    assert.ok(stuck < 25, `Walk blocked toward ${x},${z}: ${JSON.stringify(s)}`)
  }
  assert.fail(`Walk exhausted ${x},${z}`)
}
function noteVisible(sample){for(const p of sample.visiblePeople)if(!report.visibleIdentities.includes(p.name.split(':')[1]))report.visibleIdentities.push(p.name.split(':')[1]);for(const kind of sample.visibleAccessories)if(!report.visibleCarriedItems.includes(kind))report.visibleCarriedItems.push(kind);for(const car of sample.traffic)if(!report.visibleMovingCars.includes(car.id))report.visibleMovingCars.push(car.id)}
const angle = (v) => Math.atan2(Math.sin(v), Math.cos(v))
async function stopCar() { for (let i = 0; i < 100; i++) { const s = await observe(); if (Math.abs(s.ride.speed) < 0.15) break; await hold(s.ride.speed > 0.6 ? ['s'] : s.ride.speed < -0.6 ? ['w'] : [], 0.033) } await hold([], 0.15) }
async function face(yaw) { await stopCar(); for (let i = 0; i < 220; i++) { const s = await observe(), diff = angle(yaw - s.ride.yaw); if (Math.abs(diff) < 0.035 && Math.abs(s.ride.angularVel) < 0.2) break; const predicted = diff - s.ride.angularVel * 0.07; await hold(Math.abs(predicted) > 0.018 ? [predicted > 0 ? 'a' : 'd'] : [], 0.05) } await hold([], 0.2) }
function dense(points) { const result = [points[0]]; for (let i = 1; i < points.length; i++) { const a = points[i - 1], b = points[i], n = Math.max(1, Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/2)); for (let j=1;j<=n;j++) result.push({x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n}) } return result }
async function driveRoute(points, label, maxSpeed = 7.2) {
  const route = dense(points); let cursor = 0, stuckAt = null, lastProgress = 0, lastLog = Date.now()
  for (let i = 0; i < 14000; i++) {
    const s = await observe(), v = s.ride
    noteVisible(s)
    assert.ok(v, 'Lost entered car')
    if (previousDrive) driven += Math.hypot(v.x-previousDrive.x,v.z-previousDrive.z); previousDrive = {x:v.x,z:v.z}
    for(const d of s.districts) if(!report.districts.includes(d)) report.districts.push(d)
    let nearest = cursor, best = Infinity
    for (let j=cursor;j<Math.min(route.length,cursor+15);j++) {const d=Math.hypot(route[j].x-v.x,route[j].z-v.z); if(d<best){best=d;nearest=j}}
    cursor=nearest
    const final=route.at(-1), remaining=Math.hypot(final.x-v.x,final.z-v.z)
    if(cursor>=route.length-3 && remaining<1.6){await stopCar();return}
    const look=Math.max(2,Math.ceil(Math.abs(v.speed)*0.28)), target=route[Math.min(route.length-1,cursor+look)]
    const diff=angle(Math.atan2(target.x-v.x,target.z-v.z)-v.yaw), predicted=diff-v.angularVel*0.1
    const later=route[Math.min(route.length-1,cursor+8)], upcoming=Math.abs(angle(Math.atan2(later.x-target.x,later.z-target.z)-v.yaw))
    let goal=maxSpeed
    if(upcoming>0.3 || Math.abs(diff)>0.18) goal=3.5
    if(Math.abs(diff)>0.7) goal=0
    if(cursor>route.length-8) goal=Math.min(goal,Math.max(0.4,remaining*0.9))
    const next=[]
    if(Math.abs(predicted)>0.025) next.push(predicted>0?'a':'d')
    if(v.speed<goal-0.3 && Math.abs(diff)<0.75) next.push('w')
    else if(v.speed>goal+0.5 && v.speed>0.7) next.push('s')
    await hold(next, 0.05)
    if(cursor>lastProgress){stuckAt=null;lastProgress=cursor}
    else if(!stuckAt) stuckAt=s.time
    assert.ok(!stuckAt||s.time-stuckAt<28,`Driving blocked on ${label} at ${cursor}/${route.length}: ${JSON.stringify(s)} toward ${JSON.stringify(target)}`)
    if(Date.now()-lastLog>12000){process.stdout.write(`Core loop: ${label} ${(cursor/route.length*100).toFixed(0)}%, ${v.speed.toFixed(1)} m/s, ${v.x.toFixed(1)},${v.z.toFixed(1)}\n`);lastLog=Date.now()}
  }
  assert.fail('Drive timeout '+label)
}
async function graphRoute(reverse=false) {
  return page.evaluate((reverse)=>{
    const {network,trafficPath,cfg}=window.__LOOP_OBSERVERS__
    const nodes=['-489|-145','-400|-145','-400|-120','-260|-120','-100|-120','-100|20','-100|102','60|102']
    if(reverse) nodes.reverse()
    const points=[]
    for(let i=0;i<nodes.length-1;i++){const path=trafficPath(network,nodes[i],nodes[i+1],nodes[i+2]||null,cfg); if(!path)throw new Error('Missing authored connection '+nodes[i]+' to '+nodes[i+1]);points.push(...path.points.map(({x,z})=>({x,z})))}
    return points
  },reverse)
}
try {
  context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:OUT+'/video',size:{width:1440,height:900}}});page=await context.newPage()
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())})
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:120000});await page.locator('#boot-start').waitFor({state:'visible',timeout:120000});assert.equal(await page.evaluate(()=>Boolean(window.RAFFI_WORLD)),false)
  await page.locator('#boot-start').click()
  await page.evaluate(async()=>{const {state,data}=await import('/world/engine/state.js');const{player}=await import('/world/game/player.js');const{movementBasis}=await import('/world/engine/camera.js');const{storySnapshot}=await import('/world/game/story.js');const{isDialogueBlocking}=await import('/world/game/dialogue.js');const{buildRoadGraph}=await import('/world/gen/roads.js');const{trafficNetwork,trafficPath}=await import('/world/game/traffic-core.js');const{gfx}=await import('/world/engine/render.js');const{cam}=await import('/world/engine/camera.js');const THREE=await import('three');const{trafficSnapshot}=await import('/world/game/traffic.js');const{npcActivitySnapshot}=await import('/world/game/npc-sim.js');window.__LOOP_OBSERVERS__={state,data,player,movementBasis,storySnapshot,isDialogueBlocking,gfx,cam,THREE,trafficSnapshot,npcActivitySnapshot,network:trafficNetwork(buildRoadGraph(data.world)),trafficPath,cfg:data.traffic}})
  await frames();await finishCall();await page.keyboard.press('Escape');await page.locator('#pause').waitFor({state:'visible'});for(let i=0;i<6&&!(await page.locator('[data-pause=grade]').textContent()).includes('DAYLIGHT');i++)await page.locator('[data-pause=grade]').click();await page.locator('[data-pause=resume]').click();await frames();await checkpoint('01-manual-boot')
  const destination=await page.evaluate(async()=>{const {mapPlaces}=await import('/world/game/minimap-details.js');return mapPlaces(window.__LOOP_OBSERVERS__.data.world).find(place=>place.kind==='record')})
  assert.ok(destination,'Authored map destination missing');await page.keyboard.press('m');await page.locator('#world-map').waitFor({state:'visible'});await page.locator('#world-map-places').getByRole('button',{name:destination.label,exact:true}).click();await page.locator('#world-map-back').click();await page.locator('[data-pause=resume]').click();await frames();assert.equal((await observe()).paused,false);report.mapDestination={x:destination.x,z:destination.z,label:destination.label}
  const assertDestination=async()=>{const waypoint=(await observe()).waypoint;assert.deepEqual(waypoint&&{x:waypoint.x,z:waypoint.z,label:waypoint.label},report.mapDestination,'Explicit map route was replaced')}
  await assertDestination()
  // Follow the public sidewalk past the homes and corner storefront. Orbit is a real mouse drag.
  await walkTo(-444,-151,.8);await checkpoint('02-willow-neighbors')
  await page.mouse.move(820,410);await page.mouse.down();await page.mouse.move(600,410,{steps:24});await page.mouse.up();await hold([],1.2);await checkpoint('03-street-trees-storefronts')
  for(const[x,z]of[[-435,-151],[-423,-151],[-416,-151]])await walkTo(x,z,.8)
  await checkpoint('04-corner-and-traffic');await hold([],1)
  for(const[x,z,r]of[[-435,-151,1],[-450,-151,1],[-462,-151,1],[-470,-150,1],[-473.5,-147,.3]])await walkTo(x,z,r)
  assert.match((await observe()).prompt,/GRAND TOURER|GROVE GT/);await action();await finishCall();assert.equal((await observe()).player.vehicle,'grand-tourer');await assertDestination();await checkpoint('05-garage-gt')
  await driveRoute([{x:-475,z:-146.5},{x:-475,z:-141.8}],'garage-exit',2.8)
  await face(Math.PI/2)
  await driveRoute([{x:-475,z:-141.8},{x:-466,z:-141.8},{x:-462,z:-143.2},{x:-457,z:-143.2}],'garage-merge',3)
  const outbound=await graphRoute();const inbound=await graphRoute(true)
  const outStart=outbound.findIndex(p=>p.x>-456&&p.z<-130),outEnd=outbound.findIndex(p=>p.x>-69&&p.z>90)
  const toShop=[{x:(await observe()).player.x,z:(await observe()).player.z},...outbound.slice(outStart,outEnd),{x:-72,z:103.8}]
  await driveRoute(toShop,'drive-to-b-side',8.0);await checkpoint('06-two-district-drive');await action();assert.equal((await observe()).player.vehicle,null);await finishCall()
  await walkTo(-74,108,.8);await walkTo(-72,110,.8);await checkpoint('07-b-side-record-shop')
  await page.mouse.move(820,410);await page.mouse.down();await page.mouse.move(980,410,{steps:20});await page.mouse.up();await hold([],1.2);await checkpoint('08-b-side-neighbors');await assertDestination()
  assert.ok(report.districts.length>=2);assert.ok(driven>550);assert.ok(report.visibleIdentities.length>=2,'The tour did not show multiple actual population identities');assert.ok(report.visibleCarriedItems.length>0,'No carried errand item appeared on screen');assert.ok(report.visibleMovingCars.length>0,'No moving ordinary traffic car was visible');assert.deepEqual(report.errors,[])
  report.checks.push('Explicit map destination chosen by UI survives garage mount and ordinary route arrival','Fresh manual boot, daylight selected through pause UI, no debug API or state/position writes','Actual sidewalk walk past neighbors, street trees, storefronts and intersection','Real garage GT mount and keyboard lane driving across at least two districts','B-Side arrival on foot with current diverse residents and ordinary moving traffic visible')
  process.stdout.write('Current block tour passed\n')
}catch(error){report.failure=error.stack||String(error);try{report.last=await observe();await page.screenshot({path:OUT+'/failure.png'})}catch{};console.error(report.failure);process.exitCode=1}
finally{if(page){await setKeys([]);report.video=await page.video()?.path()}report.elapsedSeconds=(Date.now()-started)/1000;report.drivenMeters=driven;await context?.close();await browser.close();report.contentHashAfter=await buildFingerprint();if(report.contentHashAfter!==contentHash){report.failure='Runtime or assets changed during this recording';process.exitCode=1}await fs.writeFile(OUT+'/report.json',JSON.stringify(report,null,2))}
