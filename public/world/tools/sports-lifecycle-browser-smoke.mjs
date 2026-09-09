#!/usr/bin/env node
/** Read-only resource counters plus real menu cancellation, replay and racket grips. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
const out=process.env.RAFFI_SMOKE_OUT||'/tmp/raffi-sports-lifecycle';await fs.mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=metal']})
const report={errors:[],cycles:[]};let page
try{
 page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())})
 await page.goto((process.env.RAFFI_WORLD_URL||'http://127.0.0.1:3081/world/index.html')+'?debug=1&seed=FIXED&tier=low&hour=14',{waitUntil:'domcontentloaded'});await page.locator('#boot-start').waitFor({state:'visible',timeout:120000});await page.locator('#boot-start').click();await page.evaluate(()=>{RAFFI_WORLD.dismissDialogue();RAFFI_WORLD.teleport(-310,-406)});await page.waitForTimeout(160);await page.keyboard.press('e');await page.locator('#park-sports').waitFor({state:'visible'})
 for(let i=0;i<3;i++){
  await page.getByRole('button',{name:'Tennis',exact:true}).click();await page.getByRole('button',{name:'Practice',exact:true}).click();await page.waitForFunction(()=>RAFFI_WORLD.sportsSnapshot().game?.time>.1,null,{timeout:120000});await page.keyboard.press('Space');await page.waitForTimeout(900);const playing=await page.evaluate(()=>RAFFI_WORLD.sportsSnapshot());assert.deepEqual(playing.game.handGrips,[true,true]);report.cycles.push(playing.graphics);await page.screenshot({path:out+`/racket-${i}.png`});await page.getByRole('button',{name:'Choose another game',exact:true}).click();assert.equal(await page.evaluate(()=>RAFFI_WORLD.sportsSnapshot().game),null)
 }
 assert.deepEqual(report.cycles[2],report.cycles[1],'Repeated matches grew renderer resources after cached assets warmed');assert.deepEqual(report.cycles[1],report.cycles[0],'Second match retained the first match resources')
 // A fresh document gives the module cache a cold June load. Hold that request until Escape.
 let releaseAsset,markPending
 const pending=new Promise(resolve=>{markPending=resolve}),release=new Promise(resolve=>{releaseAsset=resolve})
 await page.route('**/population/june-near.glb',async route=>{markPending();await release;await route.continue()})
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('#boot-start').waitFor({state:'visible',timeout:120000});await page.locator('#boot-start').click();await page.evaluate(()=>{RAFFI_WORLD.dismissDialogue();RAFFI_WORLD.teleport(-310,-406)});await page.waitForTimeout(160);await page.keyboard.press('e');await page.locator('#park-sports').waitFor({state:'visible'})
 await page.getByRole('button',{name:'Tennis',exact:true}).click();await page.getByRole('button',{name:'Play short match',exact:true}).click();await Promise.race([pending,new Promise((_,reject)=>setTimeout(()=>reject(new Error('The cold June request did not start')),10000))]);assert.equal(await page.evaluate(()=>RAFFI_WORLD.sportsSnapshot().game),null)
 await page.keyboard.press('Escape');releaseAsset();await page.waitForTimeout(900);const closed=await page.evaluate(()=>RAFFI_WORLD.sportsSnapshot());assert.equal(closed.open,false);assert.equal(closed.game,null);assert.equal(closed.progress.tennis.played,0);report.canceledPendingAsset=true;assert.deepEqual(report.errors,[])
 process.stdout.write('Sports lifecycle passed: valid hand grips, 3 resource plateaus, cancellation, no rewards\n')
}catch(error){report.failure=error.stack||String(error);try{await page.screenshot({path:out+'/failure.png'})}catch{}process.stderr.write(report.failure+'\n');process.exitCode=1}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
