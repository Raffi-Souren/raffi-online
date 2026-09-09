#!/usr/bin/env node
/** Reproducible moving renderer benchmark. Fixture setup is disclosed below. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'

const base = process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3000/world/index.html'
const out = process.env.RAFFI_PERF_OUT || '/tmp/raffi-performance-route'
const tiers = (process.env.RAFFI_PERF_TIERS || 'low,medium,high').split(',')
const seconds = Number(process.env.RAFFI_PERF_SECONDS || 60)
const gpu = process.env.RAFFI_GPU || 'metal'
const headless = process.env.RAFFI_HEADED !== '1'
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
globalThis.location={search:''}
globalThis.matchMedia=()=>({matches:false})
globalThis.screen={width:1440,height:900}
globalThis.window={innerWidth:1440,innerHeight:900}
const {buildRoadGraph,isOnRoad}=await import('../gen/roads.js')
const authoredWorld=JSON.parse(await fs.readFile(new URL('../data/world.json',import.meta.url),'utf8'))
const graph=buildRoadGraph(authoredWorld)
for(let x=-500;x<=100;x+=2)assert.ok(isOnRoad(graph,x,-377.2),`benchmark fixture leaves the authored road at ${x},-377.2`)
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless, args: ['--no-sandbox', '--disable-dev-shm-usage', ...(gpu === 'metal' ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])] })
const report = { device: { platform: os.platform(), release: os.release(), cpu: os.cpus()[0].model, logicalCores: os.cpus().length, ramBytes: os.totalmem(), browser: browser.version(), requestedBackend: gpu, headless }, fixture: 'Fresh game boot. Normal E mounts the garage Grove GT. Benchmark setup moves the occupied car once to (-500,-377.2), yaw +PI/2 on the continuous eastbound northern arterial, preflight-checked against the road graph. Simulation/collision remain active. W is pulsed through real keyboard input to cruise near 8.5m/s; no position or time writes occur during the measured route. Warmup at spawn is excluded. This is a renderer benchmark fixture, not a normal-input campaign playthrough.', runs: [] }
const quantile = (numbers, q) => [...numbers].sort((a,b)=>a-b)[Math.min(numbers.length-1,Math.floor(numbers.length*q))] || 0
report.contentHash=contentHash
try {
 for (const tier of tiers) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await context.newPage(), errors = [], responses = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  cdp.on('Network.loadingFinished', event => responses.push(event.encodedDataLength))
  const bootStart = Date.now(), url = new URL(base)
  for (const [key, value] of Object.entries({ debug:'1', auto:'1', tier, hour:'14', seed:'FIXED' })) url.searchParams.set(key,value)
  await page.goto(url.href, { waitUntil:'domcontentloaded', timeout:120_000 })
  await page.waitForFunction(()=>window.RAFFI_WORLD?.ready && document.querySelector('#boot').classList.contains('hidden'),null,{timeout:120_000})
  await page.bringToFront()
  const bootMs = Date.now()-bootStart
  const bootNetworkBytes = responses.reduce((a,b)=>a+b,0)
  await page.evaluate(async()=>{
   const { state }=await import('/world/engine/state.js'),{ player }=await import('/world/game/player.js'),{ gfx }=await import('/world/engine/render.js'),{cam}=await import('/world/engine/camera.js')
   window.perfRoute={state,player,gfx,cam,samples:[],active:false,last:0}
   RAFFI_WORLD.dismissDialogue();RAFFI_WORLD.teleport(-475,-143.9)
  })
  await page.waitForTimeout(700)
  await page.keyboard.press('e')
  await page.waitForFunction(()=>perfRoute.player.vehicle?.archetypeId==='grand-tourer',null,{timeout:10000})
  await page.evaluate(()=>RAFFI_WORLD.dismissDialogue())
  await page.waitForTimeout(4500)
  const setup = await page.evaluate(()=>{
   const {state,player,gfx,cam}=perfRoute,v=player.vehicle
   Object.assign(v,{x:-500,z:-377.2,y:0,yaw:Math.PI/2,speed:0,lateral:0,angularVel:0})
   v.mesh.position.set(v.x,0,v.z);v.mesh.rotation.y=v.yaw
   Object.assign(state.player,{x:v.x,z:v.z,y:0,yaw:v.yaw,vx:0,vz:0,speed:0})
   cam.target.set(v.x,1.4,v.z);cam.currentYaw=cam.desiredYaw=v.yaw+Math.PI
   const gl=gfx.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info')
   const gpu={renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),vendor:gl.getParameter(ext?ext.UNMASKED_VENDOR_WEBGL:gl.VENDOR),version:gl.getParameter(gl.VERSION)}
   return {gpu,visibility:document.visibilityState,focused:document.hasFocus(),quality:RAFFI_WORLD.getQuality(),character:RAFFI_WORLD.characterStats()}
  })
  if (gpu === 'metal') assert.match(setup.gpu.renderer, /Apple.*Metal|Metal.*Apple/i, 'requested Metal did not resolve to the Apple hardware renderer')
  await page.waitForTimeout(1200)
  const warmupNetworkBytes = responses.reduce((a,b)=>a+b,0)
  await page.evaluate(()=>{
   perfRoute.active=true;perfRoute.last=performance.now();perfRoute.started=perfRoute.last
   const sample=now=>{if(!perfRoute.active)return;const {state}=perfRoute;perfRoute.samples.push({ms:now-perfRoute.last,t:now-perfRoute.started,x:state.player.x,z:state.player.z,district:state.district,speed:state.player.speed,visibility:document.visibilityState,focused:document.hasFocus(),...state.stats});perfRoute.last=now;requestAnimationFrame(sample)}
   requestAnimationFrame(sample)
  })
  let gas=false, lastProgress=0
  const started=Date.now()
  while(Date.now()-started<seconds*1000){
   const sample=await page.evaluate(()=>({speed:perfRoute.state.player.speed,x:perfRoute.state.player.x,z:perfRoute.state.player.z}))
   const wantGas=sample.speed<8.5
   if(wantGas!==gas){if(wantGas)await page.keyboard.down('w');else await page.keyboard.up('w');gas=wantGas}
   if(Date.now()-lastProgress>15000){process.stdout.write(`${tier}: ${Math.round((Date.now()-started)/1000)}s x=${sample.x.toFixed(1)} z=${sample.z.toFixed(1)} speed=${sample.speed.toFixed(1)}\n`);lastProgress=Date.now()}
   await page.waitForTimeout(100)
  }
  await page.keyboard.up('w')
  const result=await page.evaluate(()=>{
   perfRoute.active=false
   const {gfx,samples}=perfRoute,textures=new Map()
   gfx.scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)for(const value of Object.values(m))if(value?.isTexture)textures.set(value.uuid,value)})
   let textureBytes=0
   for(const texture of textures.values()){
    const images=Array.isArray(texture.image)?texture.image:[texture.image]
    for(const image of images){if(!image)continue;const width=image.width||0,height=image.height||0,element=image.data?.BYTES_PER_ELEMENT||1;textureBytes+=width*height*4*element*(texture.generateMipmaps?4/3:1)}
   }
   return {samples,rendererMemory:{...gfx.renderer.info.memory,programs:gfx.renderer.info.programs.length},sceneTextureEstimatedBytes:Math.ceil(textureBytes),sceneTextureCount:textures.size,resources:performance.getEntriesByType('resource').map(r=>({name:r.name.split('/world/')[1]||r.name,transfer:r.transferSize,encoded:r.encodedBodySize,decoded:r.decodedBodySize,duration:r.duration})),quality:RAFFI_WORLD.getQuality(),character:RAFFI_WORLD.characterStats()}
  })
  await page.screenshot({path:`${out}/${tier}-finish.png`})
  const samples=result.samples.filter(s=>s.ms>0),first=samples[0],last=samples.at(-1)
  const distance=samples.reduce((d,s,i)=>i?d+Math.hypot(s.x-samples[i-1].x,s.z-samples[i-1].z):d,0)
  const movingFraction=samples.filter(s=>Math.abs(s.speed)>1).length/samples.length
  const summary={tier,...setup,bootMs,measuredSeconds:(last.t-first.t)/1000,frames:samples.length,distanceMetres:distance,districts:[...new Set(samples.map(s=>s.district))],medianMs:quantile(samples.map(s=>s.ms),.5),p95Ms:quantile(samples.map(s=>s.ms),.95),p99Ms:quantile(samples.map(s=>s.ms),.99),framesOver50ms:samples.filter(s=>s.ms>50).length,framesOver100ms:samples.filter(s=>s.ms>100).length,peak:{drawCalls:Math.max(...samples.map(s=>s.drawCalls)),visibleDrawCalls:Math.max(...samples.map(s=>s.visibleDrawCalls)),visibleTriangles:Math.max(...samples.map(s=>s.visibleTriangles)),shadowTriangles:Math.max(...samples.map(s=>s.shadowTriangles)),totalTriangles:Math.max(...samples.map(s=>s.triangles))},internalResolutions:[...new Set(samples.map(s=>`${s.renderWidth}x${s.renderHeight}`))],networkTransferBytes:responses.reduce((a,b)=>a+b,0),runtimeEncodedBodyBytes:result.resources.reduce((a,b)=>a+b.encoded,0),rendererMemory:result.rendererMemory,sceneTextureEstimatedBytes:result.sceneTextureEstimatedBytes,textureEstimateLimit:'Scene material textures only; conservative RGBA storage with mips. Excludes render targets, driver allocation overhead and geometry buffers.',qualityEnd:result.quality,characterEnd:result.character,errors}
  summary.movingFraction=movingFraction
  summary.bootNetworkBytes=bootNetworkBytes
  summary.warmupNetworkBytes=warmupNetworkBytes-bootNetworkBytes
  summary.measuredRouteNetworkBytes=summary.networkTransferBytes-warmupNetworkBytes
  summary.maxLaneDeviationMetres=Math.max(...samples.map(sample=>Math.abs(sample.z+377.2)))
  summary.timingMethod='requestAnimationFrame frame intervals during active simulation/rendering; not GPU execution timestamps'
  summary.foregroundFraction=samples.filter(s=>s.visibility==='visible'&&s.focused).length/samples.length
  if(!headless)assert.equal(summary.foregroundFraction,1,'foreground benchmark lost window focus or visibility')
  assert.ok(summary.maxLaneDeviationMetres<2.5,'measured vehicle drifted outside the comparable arterial lane')
  await fs.writeFile(`${out}/${tier}-raw.json`,JSON.stringify(result,null,2))
  report.runs.push(summary)
  await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2))
  process.stdout.write(JSON.stringify(summary,null,2)+'\n')
  assert.deepEqual(errors,[])
  if(seconds>=60){assert.ok(distance>300,`benchmark route barely moved: ${distance}m`);assert.ok(movingFraction>.95,`benchmark spent too long stopped: ${movingFraction}`);assert.ok(summary.districts.includes('heights')&&summary.districts.includes('downtown'),'route did not cross two districts')}
  await context.close()
 }
 report.contentHashAfter=await buildFingerprint()
 assert.equal(report.contentHashAfter,contentHash,'runtime files changed during the performance measurement')
}finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close()}
