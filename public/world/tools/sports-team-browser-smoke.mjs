#!/usr/bin/env node
/** Position fixture only at park entry; team play and sparring use real keyboard events. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import {chromium} from 'playwright'
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
const url=new URL(process.env.RAFFI_WORLD_URL||'http://127.0.0.1:3081/world/index.html');for(const[k,v]of Object.entries({debug:'1',seed:'FIXED',tier:'low',hour:'14'}))url.searchParams.set(k,v)
const out=process.env.RAFFI_SMOKE_OUT||'/tmp/raffi-sports-team';await fs.mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=metal']})
const report={contentHash,checks:[],errors:[],entryPositionFixture:true,realControls:true,peakAudio:0},held=new Set();let page,context
async function snap(){return page.evaluate(()=>({sport:RAFFI_WORLD.sportsSnapshot(),time:window.__CITY__.state.time,player:{...window.__CITY__.state.player},paused:window.__CITY__.state.paused,audio:RAFFI_WORLD.audioSnapshot()}))}
async function keys(list){for(const key of held)if(!list.includes(key)){await page.keyboard.up(key);held.delete(key)}for(const key of list)if(!held.has(key)){held.add(key);await page.keyboard.down(key)}}
function towards(a,b,dead=.18){const list=[];if(Math.abs(b.x-a.x)>dead)list.push(b.x>a.x?'d':'a');if(Math.abs(b.z-a.z)>dead)list.push(b.z>a.z?'s':'w');return list}
function boxingTowards(a,b,basis){if(!basis)return towards(a,b,.08);const dx=b.x-a.x,dz=b.z-a.z,right=dx*basis.right.x+dz*basis.right.z,forward=dx*basis.forward.x+dz*basis.forward.z,list=[];if(Math.abs(right)>.08)list.push(right>0?'d':'a');if(Math.abs(forward)>.08)list.push(forward>0?'w':'s');return list}
async function start(name){await page.locator('#sports-intent').fill(name);await page.locator('.sports-form button').click();await page.getByRole('button',{name:'Play short match',exact:true}).click();await page.waitForFunction(()=>!!RAFFI_WORLD.sportsSnapshot().game,null,{timeout:120000});await page.locator('#sports-view').focus()}
async function screenshot(name){await page.screenshot({path:out+'/'+name+'.png'})}
async function finish(id){await keys([]);const result=(await snap()).sport;assert.equal(result.ended,true,JSON.stringify(result));assert.equal(result.progress[id].played,1);assert.equal(result.progress[id].wins,result.result.won?1:0);report[id]=result;const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('raffi-world:save:v1:auto')));assert.deepEqual(save.sports,result.progress);await screenshot(id+'-result');await page.getByRole('button',{name:'Choose another game',exact:true}).click();return result}
try{
  context=await browser.newContext({viewport:{width:1280,height:900},recordVideo:{dir:out+'/video',size:{width:1280,height:900}}});page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`)})
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:120000});await page.locator('#boot-start').waitFor({state:'visible',timeout:120000});await page.locator('#boot-start').click();await page.evaluate(async()=>{window.__CITY__=await import('/world/engine/state.js');RAFFI_WORLD.dismissDialogue();RAFFI_WORLD.teleport(-310,-406)});await page.waitForTimeout(200);await page.keyboard.press('e');await page.locator('#park-sports').waitFor({state:'visible'});const world=await snap()
  await start('soccer');let began=Date.now(),passed=false,nextPress=0,nextShot=0,peakPass=0
  while(Date.now()-began<125000){const sample=await snap(),sport=sample.sport,s=sport.game;report.peakAudio=Math.max(report.peakAudio,sample.audio.rms);if(sport.ended)break;const p=s.actors[0],b=s.ball;let target=b.owner===0?{x:p.x<0?-4.5:4.5,z:-9}:b.owner===1?{x:-s.actors[1].x*.7,z:s.actors[1].z-3}:b;let wanted=towards(p,target);wanted.push('e');await keys(wanted)
    if(s.phase==='play'){
      if(b.owner===0&&!passed){await page.keyboard.press('Space');passed=true;nextPress=s.clock+1.2}
      else if(b.owner===0&&p.z<-1&&s.clock>nextShot){await page.keyboard.press('q');nextShot=s.clock+1.1}
      else if(b.owner!==0&&b.owner!==null&&s.clock>nextPress){await page.keyboard.press('Space');nextPress=s.clock+.5}
    }
    peakPass=Math.max(peakPass,s.completedPasses)
    if(!report.soccerRallyImage&&s.shots>0&&s.completedPasses>0){await screenshot('soccer-real-pass-shot');report.soccerRallyImage=true}
    await page.waitForTimeout(45)
  }
  const soccer=await finish('soccer');assert.ok(soccer.game.completedPasses>0,'Real passing did not connect');assert.ok(soccer.game.shots>0,'Real shot input did not launch a shot');assert.equal(soccer.game.actors.length,4);report.checks.push('Typed soccer starts real 2v2; keyboard passing, movement, pressing and shooting reach a scored result and checkpoint')
  await start('boxing');began=Date.now();let nextJab=0
  while(Date.now()-began<75000){const sample=await snap(),sport=sample.sport,s=sport.game;report.peakAudio=Math.max(report.peakAudio,sample.audio.rms);if(sport.ended)break;const p=s.player,o=s.opponent,d=Math.hypot(p.x-o.x,p.z-o.z),wind=o.attack&&!o.attack.resolved?o.attack.impactAt-o.attack.elapsed:Infinity;let wanted=[]
    if(d>1.08)wanted=boxingTowards(p,o,s.inputBasis)
    if(d<.9)wanted=boxingTowards(o,p,s.inputBasis)
    if(wind<.27&&wind>0)wanted.push('e')
    await keys(wanted)
    if(p.counterUntil>s.time&&d<1.16&&!p.attack&&!wanted.includes('e'))await page.keyboard.press('q')
    else if(s.perfectGuards>0&&s.counters>0&&!o.guarding&&!o.attack&&d<1.2&&!p.attack&&p.cooldown<=0&&s.time>nextJab){await page.keyboard.press('Space');nextJab=s.time+.8}
    if(!report.boxingGuardImage&&s.perfectGuards>0&&s.counters>0){await screenshot('boxing-real-guard-counter');report.boxingGuardImage=true}
    await page.waitForTimeout(35)
  }
  const boxing=await finish('boxing');assert.ok(boxing.game.perfectGuards>0,'Timed E guard never landed');assert.ok(boxing.game.counters>0,'Real Q counter never scored');assert.ok(boxing.game.score.player>0);assert.ok(boxing.game.riggedGloves.flat().every(Boolean),'Gloves need valid authored hand chains');report.checks.push('Friendly boxing uses real positioning, timed guard, jab and counter for a scored round and saved record')
  const frozen=await snap();assert.equal(frozen.time,world.time);assert.deepEqual(frozen.player,world.player);assert.ok(report.peakAudio>.00001,'Original sport SFX were never audible');await page.keyboard.press('Escape');await page.locator('#park-sports').waitFor({state:'hidden'});await page.waitForTimeout(200);assert.equal((await snap()).paused,false);assert.equal(await page.evaluate(()=>document.activeElement.id),'view');report.checks.push('World pose and clock stayed frozen across both games; SFX gain was audible; Escape restores exploration')
  assert.deepEqual(report.errors,[]);process.stdout.write('Team sports browser passed '+report.checks.length+' checks\n')
}catch(error){report.failure=error.stack||String(error);try{report.last=await snap();await screenshot('failure')}catch{}process.stderr.write(report.failure+'\n');process.exitCode=1}
finally{await keys([]).catch(()=>{});await context?.close();report.video=await page?.video()?.path();report.contentHashAfter=await buildFingerprint();if(report.contentHashAfter!==contentHash){report.failure='Runtime or assets changed during this recording';process.exitCode=1}await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
