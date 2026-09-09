#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
const base=process.env.RAFFI_WORLD_URL||'http://127.0.0.1:3081/world/index.html'
const out=process.env.RAFFI_NEAR_OUT||'/tmp/raffi-near-characters'
await fs.mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']})
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 await page.goto(base+'?debug=1&auto=1&tier=medium&hour=14&seed=FIXED')
 await page.waitForFunction(()=>window.RAFFI_WORLD?.nearCharacterStats?.().ready,null,{timeout:90000})
 await page.evaluate(()=>RAFFI_WORLD.dismissDialogue())
 await page.waitForFunction(()=>RAFFI_WORLD.nearCharacterStats().near>0,null,{timeout:60000})
 await page.waitForTimeout(1500)
 const initial=await page.evaluate(async()=>{
  const {gfx}=await import('/world/engine/render.js'),{state}=await import('/world/engine/state.js'),{actorCollisionBodies}=await import('/world/engine/actor-collisions.js')
  state.paused=true
  const sources=[];gfx.scene.traverse(o=>{if(o.userData.populationIdentity)sources.push(o)})
  window.nearTest={gfx,state,actorCollisionBodies,sources}
  return {stats:structuredClone(RAFFI_WORLD.nearCharacterStats()),render:RAFFI_WORLD.stats(),proxies:sources.map(o=>({id:o.uuid,identity:o.userData.populationIdentity,visible:o.visible,layer:o.layers.mask})),collision:actorCollisionBodies(sources,state.player.x,state.player.z,null,30)}
 })
 assert.ok(initial.stats.near>0&&initial.stats.near<=4)
 assert.equal(initial.stats.error,null)
 assert.ok(initial.proxies.length>=12)
 assert.ok(initial.proxies.every(p=>p.layer===2147483648))
 assert.ok(new Set(initial.proxies.map(p=>p.identity)).size>=10)
 await page.screenshot({path:out+'/medium.png'})
 await page.evaluate(()=>{RAFFI_WORLD.setQuality('performance');window.dispatchEvent(new PointerEvent('pointerdown'))})
 await page.waitForFunction(()=>RAFFI_WORLD.nearCharacterStats().near===0)
 const low=await page.evaluate(()=>({stats:structuredClone(RAFFI_WORLD.nearCharacterStats()),identities:nearTest.sources.map(o=>o.userData.populationIdentity),collision:nearTest.actorCollisionBodies(nearTest.sources,nearTest.state.player.x,nearTest.state.player.z,null,30)}))
 assert.ok(low.stats.far>0);assert.equal(low.stats.near,0)
 assert.deepEqual(low.identities,initial.proxies.map(p=>p.identity))
 assert.deepEqual(low.collision,initial.collision,'visual LOD must preserve every collision proxy')
 await page.evaluate(()=>{RAFFI_WORLD.setQuality('balanced');window.dispatchEvent(new PointerEvent('pointerdown'))})
 await page.waitForFunction(()=>RAFFI_WORLD.nearCharacterStats().near>0)
 await page.evaluate(()=>{nearTest.state.paused=false;RAFFI_WORLD.enterInterior('mainframe')})
 await page.waitForFunction(()=>RAFFI_WORLD.nearCharacterStats().active===0)
 const interior=await page.evaluate(()=>({stats:structuredClone(RAFFI_WORLD.nearCharacterStats()),visible:nearTest.gfx.scene.getObjectByName('near-characters').visible,hero:nearTest.gfx.scene.getObjectByName('player-character').visible}))
 assert.equal(interior.visible,false);assert.equal(interior.hero,true)
 await page.evaluate(()=>RAFFI_WORLD.exitInterior())
 await page.waitForFunction(()=>RAFFI_WORLD.nearCharacterStats().near>0)
 const returned=await page.evaluate(()=>structuredClone(RAFFI_WORLD.nearCharacterStats()))
 assert.ok(returned.near<=4)
 assert.deepEqual(errors,[])
 const result={initial,low,interior,returned,errors}
 await fs.writeFile(out+'/report.json',JSON.stringify(result,null,2))
 process.stdout.write(JSON.stringify({near:initial.stats.near,far:initial.stats.far,proxies:initial.proxies.length,lowFar:low.stats.far,errors})+'\n')
}finally{await browser.close()}
