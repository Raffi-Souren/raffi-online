/** Test the user's actual yellow home-screen box, preserving music and game state. */
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const base = process.env.RAFFI_APP_URL || 'http://127.0.0.1:3090'
const out = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-home-cheats'
await fs.mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']})
const report={checks:[],errors:[]}
try {
 for (const touch of [false,true]) {
  const ctx=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1280,height:850},hasTouch:touch,isMobile:touch,reducedMotion:'reduce'})
  const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message))
  await page.goto(base+'/?tier=low')
  const box=page.getByRole('button',{name:'Question block',exact:true})
  if(touch)await box.tap();else await box.click()
  await page.getByRole('button',{name:/Grand tourer WHIP/}).click()
  const frame=page.frameLocator('iframe[title="RAFFI WORLD"]')
  await frame.locator('#cheat-menu').waitFor({state:'visible',timeout:120000})
  assert.match(await frame.locator('#cheat-result').innerText(),/Grand tourer delivered/)
  const actual=page.frames().find(f=>f.url().includes('/world/index.html'))
  const state=()=>actual.evaluate(async()=>{const{state}=await import('/world/engine/state.js');return{mode:state.mode,vehicle:state.player.vehicle,x:state.player.x,z:state.player.z,time:state.time,paused:state.paused}})
  assert.equal((await state()).vehicle,'grand-tourer')
  await frame.locator('#cheat-close').click()
  if(touch)await frame.locator('#btn-pause').tap();else {await frame.locator('#view').focus();await page.keyboard.press('Escape')}
  await frame.locator('#pause').waitFor({state:'visible'})
  assert.equal(await page.locator('iframe[title="RAFFI WORLD"]').isVisible(),true)
  const before=await state();await page.waitForTimeout(400);assert.deepEqual(await state(),before)
  await frame.locator('[data-pause="saves"]').click()
  await frame.locator('[data-save-slot="slot-1"][data-save-action="save"]').click()
  await frame.locator('#save-notice').filter({hasText:'Saved on this browser'}).waitFor()
  await frame.locator('#save-close').click()
  await frame.locator('[data-pause="cheats"]').click()
  await frame.locator('#cheat-code').fill('MIXTAPE')
  await frame.locator('#cheat-form button').click()
  await frame.locator('#cheat-result').filter({hasText:/six stations/}).waitFor()
  assert.equal(await actual.evaluate(async()=>(await import('/world/engine/state.js')).data.radio.stations.filter(s=>s.unlocked).length),6)
  await page.screenshot({path:out+(touch?'/phone.png':'/desktop.png')})
  report.checks.push((touch?'Touch':'Desktop')+': yellow question box → song crate → delivered driveable WHIP; game pause freezes and keeps window; manual save UI works; typed MIXTAPE unlocks6stations')
  await ctx.close()
 }
 assert.deepEqual(report.errors,[])
} catch(error) {report.failure=error.stack;process.exitCode=1;console.error(error)}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
console.info(JSON.stringify(report))
