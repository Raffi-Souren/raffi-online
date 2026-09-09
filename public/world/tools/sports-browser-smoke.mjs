#!/usr/bin/env node
/** Park entry position fixture; every menu, serve, rally, pause and result uses real controls. */
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
const url=new URL(process.env.RAFFI_WORLD_URL||'http://127.0.0.1:3081/world/index.html')
for(const[k,v]of Object.entries({debug:'1',seed:'FIXED',tier:'low',hour:'14'}))url.searchParams.set(k,v)
url.searchParams.delete('auto')
const out=process.env.RAFFI_SMOKE_OUT||'/tmp/raffi-sports-browser'
await fs.mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--no-sandbox',...(process.env.RAFFI_GPU==='metal'?['--use-angle=metal']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'])]})
const report={contentHash,checks:[],errors:[],entryPositionFixture:true,realKeyboardRallies:true,realTouchControls:true,started:Date.now()}
let page,context
const pressed=new Set()
async function observe(){return page.evaluate(()=>({sport:RAFFI_WORLD.sportsSnapshot(),time:window.__CITY__.state.time,frame:window.__CITY__.state.frame,player:{...window.__CITY__.state.player},paused:window.__CITY__.state.paused,audio:RAFFI_WORLD.audioSnapshot(),mission:RAFFI_WORLD.missionSnapshot(),vehicles:window.__GFX__.gfx.scene.children.filter(mesh=>mesh.name.startsWith('vehicle:')).map(mesh=>({id:mesh.uuid,x:mesh.position.x,z:mesh.position.z,yaw:mesh.rotation.y})),active:document.activeElement?.id}))}
async function observers(){await page.evaluate(async()=>{window.__CITY__=await import('/world/engine/state.js');window.__GFX__=await import('/world/engine/render.js')})}
async function frames(n=2){const end=(await observe()).frame+n;await page.waitForFunction(frame=>window.__CITY__.state.frame>=frame,end,{timeout:20000})}
async function ready(){await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:120000});await page.locator('#boot-start').waitFor({state:'visible',timeout:120000});await page.locator('#boot-start').click();await observers();await page.evaluate(()=>RAFFI_WORLD.dismissDialogue());await frames()}
async function enter(){await page.evaluate(()=>RAFFI_WORLD.teleport(-310,-406));await frames(3);await page.keyboard.press('e');await page.locator('#park-sports').waitFor({state:'visible'});await frames()}
async function type(text){await page.locator('#sports-intent').fill(text);await page.locator('.sports-form button').click();await frames()}
async function release(){for(const key of pressed)await page.keyboard.up(key);pressed.clear()}
async function keys(desired){for(const key of pressed)if(!desired.includes(key)){await page.keyboard.up(key);pressed.delete(key)}for(const key of desired)if(!pressed.has(key)){await page.keyboard.down(key);pressed.add(key)}}
async function start(mode='Play short match'){await page.getByRole('button',{name:mode,exact:true}).click();await page.waitForFunction(()=>!!RAFFI_WORLD.sportsSnapshot().game,null,{timeout:120000});await page.locator('#sports-view').focus();await frames()}
async function steer({seconds=150,returns=Infinity,finish=true}={}){
  const began=Date.now();let swings=0,maxReturns=0,lastAim=0
  while(Date.now()-began<seconds*1000){
    const {sport}=await observe(),s=sport.game
    if(!s)throw new Error('Court closed during rally')
    maxReturns=Math.max(maxReturns,s.returns)
    if(sport.ended||(!finish&&s.returns>=returns))break
    let targetX=0,targetZ=8.2
    if(s.ball?.lastHit==='opponent'){
      const b=s.ball,flight=Math.max(0,(8.2-b.z)/Math.max(.001,b.vz))
      targetX=Math.max(-3.8,Math.min(3.8,b.x+b.vx*flight))
    }
    const desired=[]
    if(Math.abs(targetX-s.player.x)>.22)desired.push(targetX>s.player.x?'d':'a')
    if(Math.abs(targetZ-s.player.z)>.18)desired.push(targetZ>s.player.z?'s':'w')
    await keys(desired)
    if(s.phase==='serve'&&s.server==='player'||s.inReach&&s.cooldown<=0){
      // Placement is a real click on the court. Position/score are observations only.
      const aim=s.opponent.x>0?-.95:.95
      if(aim!==lastAim){const box=await page.locator('#sports-view').boundingBox();await page.mouse.click(box.x+box.width*(aim+1)/2,box.y+box.height*.65);lastAim=aim}
      await page.keyboard.press('Space');swings++
    }
    await page.waitForTimeout(42)
  }
  await release()
  const s=(await observe()).sport
  report.keyboard={...(report.keyboard||{}),swings:(report.keyboard?.swings||0)+swings,maxReturns:Math.max(report.keyboard?.maxReturns||0,maxReturns)}
  if(finish)assert.equal(s.ended,true,JSON.stringify(s))
  else assert.ok(s.game.returns>=returns,JSON.stringify(s.game))
  return s
}
async function screenshot(name){await page.screenshot({path:out+'/'+name+'.png'})}
function unchangedWorld(a,b){assert.equal(b.time,a.time);assert.deepEqual(b.player,a.player);assert.deepEqual(b.vehicles,a.vehicles);assert.deepEqual(b.mission,a.mission)}
try{
  context=await browser.newContext({viewport:{width:1280,height:900},recordVideo:{dir:out+'/video',size:{width:1280,height:900}}})
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`)})
  await ready();await enter();const world=await observe()
  await type('How does boxing work?');assert.equal((await observe()).sport.game,null);assert.match(await page.locator('.sports-reply').textContent(),/sparring/i)
  await type('Can I play tennis');assert.equal((await observe()).sport.game,null);assert.match(await page.locator('.sports-reply').textContent(),/3 points/i)
  await type('tennis or soccer');assert.match(await page.locator('.sports-reply').textContent(),/Which one/);assert.equal((await observe()).sport.game,null)
  await type('Maybe tennis');assert.equal(await page.locator('.sports-brief').isVisible(),false)
  await screenshot('01-typed-question');unchangedWorld(world,await observe());report.checks.push('Typed questions and ambiguity explain without joining; world and parked vehicles freeze')
  await type('tennis');await start('Watch first');await page.waitForFunction(()=>RAFFI_WORLD.sportsSnapshot().game.rally>0,null,{timeout:20000});assert.equal((await observe()).sport.progress.tennis.played,0);await page.getByRole('button',{name:'Choose another game',exact:true}).click()
  await page.getByRole('button',{name:'Tennis',exact:true}).click();await start('Practice');await steer({seconds:70,returns:2,finish:false});assert.equal((await observe()).sport.progress.tennis.played,0);await screenshot('02-practice-real-rally');report.checks.push('Watch and practice are distinct; two real keyboard returns in practice grant no match reward')
  await page.keyboard.down('d');await page.keyboard.press('p');pressed.clear();await page.keyboard.up('d');await page.waitForTimeout(100);const paused=await observe();assert.equal(paused.sport.paused,true);await page.waitForTimeout(1100);assert.deepEqual((await observe()).sport.game,paused.sport.game);assert.equal((await observe()).audio.state,'suspended');await screenshot('03-paused')
  await page.getByRole('button',{name:'Resume match',exact:true}).click();const resume=(await observe()).sport.game;await page.waitForTimeout(150);const resumed=(await observe()).sport.game;assert.ok(resumed.time-resume.time<.4);assert.equal(resumed.player.x,resume.player.x,'Pause left D held')
  await page.evaluate(()=>window.postMessage({type:'raffi-world:activity',active:false},location.origin));await page.waitForTimeout(120);const hidden=await observe();await page.waitForTimeout(1000);assert.deepEqual((await observe()).sport.game,hidden.sport.game);await page.evaluate(()=>window.postMessage({type:'raffi-world:activity',active:true},location.origin));await page.waitForTimeout(120);assert.ok((await observe()).sport.game.time-hidden.sport.game.time<.4);report.checks.push('Explicit pause and host inactivity freeze ball, clock and controls without catch-up')
  await page.getByRole('button',{name:'Start a match',exact:true}).click();await page.waitForFunction(()=>RAFFI_WORLD.sportsSnapshot().mode==='match'&&RAFFI_WORLD.sportsSnapshot().game?.time>.05);const result=await steer();report.match=result;assert.deepEqual(result.game.handGrips,[true,true]);assert.ok(result.game.returns>0,'Result must include a real player return');assert.equal(result.progress.tennis.played,1);assert.equal(Math.max(result.game.score.player,result.game.score.opponent),3);await screenshot('04-match-result');unchangedWorld(world,await observe());const auto=await page.evaluate(()=>JSON.parse(localStorage.getItem('raffi-world:save:v1:auto')));assert.deepEqual(auto.sports,result.progress);report.checks.push('First-to-three match completed with real serves, positioning and timed returns; checkpoint saved once')
  await page.waitForTimeout(600);assert.equal((await observe()).sport.progress.tennis.played,1)
  await page.getByRole('button',{name:'Back to Jules',exact:true}).click();assert.match(await page.locator('.sports-memory').textContent(),result.result.won?/last win/:/last match/)
  await start();assert.deepEqual((await observe()).sport.game.score,{player:0,opponent:0});await page.keyboard.press('Space');await page.waitForFunction(()=>!!RAFFI_WORLD.sportsSnapshot().game.ball);await screenshot('05-rematch');await page.keyboard.press('Escape');await page.locator('#park-sports').waitFor({state:'hidden'});await frames();const afterExit=await observe();assert.equal(afterExit.paused,false);assert.equal(afterExit.active,'view');assert.equal(afterExit.sport.progress.tennis.played,1);assert.ok(Math.hypot(afterExit.player.x-world.player.x,afterExit.player.z-world.player.z)<.01);report.checks.push('Jules recalls win or loss; rematch resets score and abandoning it does not duplicate rewards; Escape restores exploration focus')
  await page.keyboard.press('Escape');await page.locator('[data-pause=saves]').click();await page.locator('[data-save-slot=slot-1][data-save-action=save]').click();assert.match(await page.locator('#save-notice').textContent(),/Saved/)
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('#boot-continue').waitFor({state:'visible',timeout:120000});await page.locator('#boot-continue').click();await observers();await frames();assert.deepEqual((await observe()).sport.progress,result.progress);await enter();await type('tennis');assert.match(await page.locator('.sports-memory').textContent(),/Jules remembers/);report.checks.push('Manual save and boot Continue reload the exact sports record and remembered result')
  // A phone viewport and real touch pointer stream exercise independent on-screen controls.
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Not now',exact:true}).click();await type('What is tennis?');await screenshot('06-phone-question');assert.equal(await page.evaluate(()=>document.querySelector('.sports-card').getBoundingClientRect().right>innerWidth),false)
  await type('tennis');await start('Practice');await screenshot('07-phone-court')
  const cdp=await context.newCDPSession(page),zone=await page.locator('.sports-stick').boundingBox();await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});const touch={x:zone.x+zone.width/2+30,y:zone.y+zone.height/2,id:1}
  const initialPhone=(await observe()).sport.game.player.x;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});await page.waitForTimeout(350);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok((await observe()).sport.game.player.x-initialPhone>.5)
  const primary=await page.locator('[data-sport-control=primary]').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:primary.x+primary.width/2,y:primary.y+primary.height/2,id:2}]});await page.waitForTimeout(90);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(()=>!!RAFFI_WORLD.sportsSnapshot().game.ball);await screenshot('08-phone-serve');assert.equal((await observe()).sport.progress.tennis.played,1)
  await page.setViewportSize({width:844,height:390});await page.waitForFunction(()=>{const c=document.querySelector('#sports-view');return c.width/c.height>1.8});await screenshot('09-phone-landscape');assert.equal(await page.evaluate(()=>document.querySelector('.sports-card').getBoundingClientRect().right>innerWidth),false);await page.keyboard.press('Escape');await frames();report.checks.push('Phone typed questions fit; real touch stick moves and touch serve starts ball physics; landscape resizes; exit preserves record')
  assert.deepEqual(report.errors,[]);report.seconds=(Date.now()-report.started)/1000;process.stdout.write('Sports browser smoke passed '+report.checks.length+' checks\n')
}catch(error){report.failure=error.stack||String(error);try{report.last=await observe();await screenshot('failure')}catch{}process.stderr.write(report.failure+'\n');process.exitCode=1}
finally{await release().catch(()=>{});await context?.close();report.video=await page?.video()?.path();report.contentHashAfter=await buildFingerprint();if(report.contentHashAfter!==contentHash){report.failure='Runtime or assets changed during this recording';process.exitCode=1}await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
