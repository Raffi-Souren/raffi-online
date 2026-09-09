#!/usr/bin/env node
/** Uncut ordinary-input delivery + callback; imports are strictly read-only observers. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
import { captureGameAudio, saveGameAudio } from './browser-audio-capture.mjs'
const OUT = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-core-loop'
await fs.mkdir(OUT, { recursive: true })
const url = new URL(process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3081/world/index.html')
url.searchParams.delete('debug'); url.searchParams.delete('auto'); url.searchParams.set('tier', 'low'); url.searchParams.set('seed', 'FIXED'); url.searchParams.set('hour', '14')
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', ...(process.env.RAFFI_GPU === 'metal' ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])] })
const report = { errors: [], checks: [], checkpoints: [], districts: [], noDebug: true, fixturePositions: false, realKeyboardDriving: true, realTime: true }
const started = Date.now(); let page, context, keys = new Set(), driven = 0, previousDrive = null, shopCar, homeCar
async function observe() {
  return page.evaluate(() => {
    const { state, player, movementBasis, storySnapshot, isDialogueBlocking, data } = window.__LOOP_OBSERVERS__
    const v = player.vehicle
    return { time: state.time, frame: state.frame, paused: state.paused, player: { ...state.player }, ride: v && { x: v.x, z: v.z, yaw: v.yaw, speed: v.speed, angularVel: v.angularVel, impact: v.lastImpact }, basis: movementBasis(), story: storySnapshot(), dialogue: document.querySelector('#subtitle').classList.contains('show'), blocking: isDialogueBlocking(), prompt: document.querySelector('#interaction-prompt').textContent.trim(), districts: data.world.districts.filter((d) => state.player.x >= d.bounds.minX && state.player.x <= d.bounds.maxX && state.player.z >= d.bounds.minZ && state.player.z <= d.bounds.maxZ).map((d) => d.id) }
  })
}
async function setKeys(next) { const wanted = new Set(next); for (const key of keys) if (!wanted.has(key)) await page.keyboard.up(key); for (const key of wanted) if (!keys.has(key)) await page.keyboard.down(key); keys = wanted }
async function hold(next, seconds) { await setKeys(next); const time = (await observe()).time + seconds; await page.waitForFunction((time) => window.__LOOP_OBSERVERS__.state.time >= time, time, { timeout: 30000 }); }
async function frames() { const frame = (await observe()).frame + 3; await page.waitForFunction((f) => window.__LOOP_OBSERVERS__.state.frame >= f, frame) }
async function action() { await setKeys([]); await page.keyboard.press('e'); await frames() }
async function finishCall() { for (let i = 0; i < 180 && (await observe()).dialogue; i++) { if ((await observe()).blocking) await action(); else await hold([], 0.25) } assert.equal((await observe()).dialogue, false) }
async function checkpoint(label) { await setKeys([]); const sample = await observe(); report.checkpoints.push({ label, elapsedSeconds: (Date.now() - started) / 1000, drivenMeters: driven, ...sample }); await page.screenshot({ path: `${OUT}/${label}.png` }); process.stdout.write(`Core loop: ${label} (${((Date.now() - started) / 1000).toFixed(1)} s)\n`); }
async function walkTo(x, z, radius = 1) {
  let previous = Infinity, stuck = 0
  for (let i = 0; i < 220; i++) {
    const s = await observe(), dx = x - s.player.x, dz = z - s.player.z, d = Math.hypot(dx, dz)
    if (d <= radius) { await hold([], 0.1); return }
    const h = (dx * s.basis.rx + dz * s.basis.rz) / d, f = (dx * s.basis.fx + dz * s.basis.fz) / d
    await hold([...(h > 0.32 ? ['d'] : h < -0.32 ? ['a'] : []), ...(f > 0.32 ? ['w'] : f < -0.32 ? ['s'] : [])], Math.min(0.2, Math.max(0.05, (d - radius) / 4)))
    stuck = d >= previous - 0.015 ? stuck + 1 : 0; previous = d
    assert.ok(stuck < 25, `Walk blocked toward ${x},${z}: ${JSON.stringify(s)}`)
  }
  assert.fail(`Walk exhausted ${x},${z}`)
}
const angle = (v) => Math.atan2(Math.sin(v), Math.cos(v))
async function stopCar() { for (let i = 0; i < 100; i++) { const s = await observe(); if (Math.abs(s.ride.speed) < 0.15) break; await hold(s.ride.speed > 0.6 ? ['s'] : s.ride.speed < -0.6 ? ['w'] : [], 0.033) } await hold([], 0.15) }
async function face(yaw) { await stopCar(); for (let i = 0; i < 220; i++) { const s = await observe(), diff = angle(yaw - s.ride.yaw); if (Math.abs(diff) < 0.035 && Math.abs(s.ride.angularVel) < 0.2) break; const predicted = diff - s.ride.angularVel * 0.07; await hold(Math.abs(predicted) > 0.018 ? [predicted > 0 ? 'a' : 'd'] : [], 0.05) } await hold([], 0.2) }
function dense(points) { const result = [points[0]]; for (let i = 1; i < points.length; i++) { const a = points[i - 1], b = points[i], n = Math.max(1, Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/2)); for (let j=1;j<=n;j++) result.push({x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n}) } return result }
async function driveRoute(points, label, maxSpeed = 7.2) {
  const route = dense(points); let cursor = 0, stuckAt = null, lastProgress = 0, lastLog = Date.now()
  for (let i = 0; i < 14000; i++) {
    const s = await observe(), v = s.ride
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
async function mountParked(car) {
  const s = await observe(), rx = Math.cos(car.yaw), rz = -Math.sin(car.yaw)
  const side = Math.sign((s.player.x - car.x) * rx + (s.player.z - car.z) * rz) || 1
  await walkTo(car.x + rx * side * 2.05, car.z + rz * side * 2.05, 0.22)
  assert.match((await observe()).prompt,/GRAND TOURER|GROVE GT/)
  await action(); await finishCall(); assert.equal((await observe()).player.vehicle,'grand-tourer')
}
async function visitOwner() { await walkTo(-73,107);await walkTo(-71.4,109,1.4);assert.match((await observe()).prompt,/LAST CRATE|record shop owner/i);await action();await page.locator('#last-crate').waitFor({state:'visible'}) }
try {
  context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:OUT+'/video',size:{width:1280,height:720}}});await captureGameAudio(context);report.videoBeganAt=Date.now();page=await context.newPage()
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())})
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:120000});await page.locator('#boot-start').waitFor({state:'visible',timeout:120000});assert.equal(await page.evaluate(()=>Boolean(window.RAFFI_WORLD)),false)
  await page.locator('#boot-start').click()
  await page.evaluate(async()=>{const {state,data}=await import('/world/engine/state.js');const{player}=await import('/world/game/player.js');const{movementBasis}=await import('/world/engine/camera.js');const{storySnapshot}=await import('/world/game/story.js');const{isDialogueBlocking}=await import('/world/game/dialogue.js');const{buildRoadGraph}=await import('/world/gen/roads.js');const{trafficNetwork,trafficPath}=await import('/world/game/traffic-core.js');window.__LOOP_OBSERVERS__={state,data,player,movementBasis,storySnapshot,isDialogueBlocking,network:trafficNetwork(buildRoadGraph(data.world)),trafficPath,cfg:data.traffic}})
  await frames();await finishCall();await page.keyboard.press('Escape');await page.locator('#pause').waitFor({state:'visible'});for(let i=0;i<6&&!(await page.locator('[data-pause=grade]').textContent()).includes('DAYLIGHT');i++)await page.locator('[data-pause=grade]').click();await page.locator('[data-pause=resume]').click();await frames();await checkpoint('01-manual-boot')
  for(const [x,z,r]of[[-455,-151,1],[-462,-151,1],[-470,-150,1],[-473.5,-147,0.3]])await walkTo(x,z,r)
  assert.match((await observe()).prompt,/GRAND TOURER|GROVE GT/);await action();await finishCall();assert.equal((await observe()).player.vehicle,'grand-tourer');await checkpoint('02-garage-gt')
  await driveRoute([{x:-475,z:-146.5},{x:-475,z:-141.8}],'garage-exit',2.8)
  await face(Math.PI/2)
  await driveRoute([{x:-475,z:-141.8},{x:-466,z:-141.8},{x:-462,z:-143.2},{x:-457,z:-143.2}],'garage-merge',3)
  const outbound=await graphRoute();const inbound=await graphRoute(true)
  const outStart=outbound.findIndex(p=>p.x>-456&&p.z<-130),outEnd=outbound.findIndex(p=>p.x>-69&&p.z>90)
  const toShop=[{x:(await observe()).player.x,z:(await observe()).player.z},...outbound.slice(outStart,outEnd),{x:-72,z:103.8}]
  await driveRoute(toShop,'drive-to-b-side');shopCar=(await observe()).ride;await checkpoint('03-two-district-drive');await action();assert.equal((await observe()).player.vehicle,null)
  await visitOwner();await page.locator('#last-crate-input').fill('What happens if I bring the records back?');await page.locator('#last-crate-input').press('Enter');assert.equal((await observe()).story.branch,null)
  await page.locator('#last-crate-input').fill('I will return your personal records to Lena');await page.locator('#last-crate-input').press('Enter');assert.equal((await observe()).story.branch,'return');await page.getByRole('button',{name:'Follow my route',exact:true}).click();await checkpoint('04-return-accepted')
  await mountParked(shopCar);await face(-Math.PI/2)
  const inStart=inbound.findIndex(p=>p.x<-76&&p.z>90),inEnd=inbound.findIndex(p=>p.x<-452&&p.z<-130)
  await driveRoute([{x:(await observe()).player.x,z:(await observe()).player.z},{x:-77,z:100.2},...inbound.slice(inStart,inEnd),{x:-453,z:-146.8}],'return-to-lena');await stopCar();homeCar=(await observe()).ride;await action();await finishCall();await walkTo(-451,-150.5,1.2);assert.match((await observe()).prompt,/LENA|RECORDS|CRATE/i);await action();await page.locator('#last-crate').waitFor({state:'visible'});assert.equal((await observe()).story.status,'complete');assert.equal((await observe()).story.trust,2);await page.getByRole('button',{name:'Back to the street',exact:true}).click();await checkpoint('05-records-delivered')
  await mountParked(homeCar);await face(Math.PI/2)
  await driveRoute([{x:(await observe()).player.x,z:(await observe()).player.z},{x:-451,z:-143.2},...outbound.slice(outStart,outEnd),{x:-72,z:103.8}],'later-owner-callback');shopCar=(await observe()).ride;await action();await finishCall();await visitOwner()
  assert.equal((await observe()).story.callbackSeen,true);await checkpoint('06-owner-remembers');await page.getByRole('button',{name:'Follow my route',exact:true}).click()
  await mountParked(shopCar);await face(-Math.PI/2)
  await driveRoute([{x:(await observe()).player.x,z:(await observe()).player.z},{x:-77,z:100.2},...inbound.slice(inStart,inEnd),{x:-453,z:-146.8}],'drive-to-listening-night');await stopCar();await action();await finishCall();await walkTo(-451,-150.5,1.2);await action();await page.locator('#last-crate').waitFor({state:'visible'});await page.locator('.last-crate-sleeve').first().click();await page.waitForFunction(()=>window.__LOOP_OBSERVERS__.storySnapshot().listeningDone,{timeout:30000});assert.equal((await observe()).story.trust,3);await checkpoint('06-listening-callback-earned');await page.getByRole('button',{name:'Back to the street',exact:true}).click()
  assert.ok(report.districts.length>=2,'Did not cross two districts');assert.ok(driven>900,'Insufficient actual driving');assert.deepEqual(report.errors,[])
  report.checks.push('Fresh boot and ordinary keyboard garage walk, GT mount and legal street exit','Real keyboard lane driving across at least two districts; no teleports or debug API','Typed question does not accept; typed return promise selects route','Real drive to Lena, visible E delivery, trust reward, later drive back and remembered owner callback','Explicit listening session completed and final trust reward earned')
  await checkpoint('07-finished');process.stdout.write('Core loop journey passed\n')
}catch(error){report.failure=error.stack||String(error);try{report.last=await observe();await page.screenshot({path:OUT+'/failure.png'})}catch{};console.error(report.failure);process.exitCode=1}
finally{if(page){report.audio=await saveGameAudio(page,OUT).catch(error=>[{error:String(error)}]);await setKeys([]);report.video=await page.video()?.path()}report.elapsedSeconds=(Date.now()-started)/1000;report.drivenMeters=driven;await context?.close();await browser.close();await fs.writeFile(OUT+'/report.json',JSON.stringify(report,null,2))}
