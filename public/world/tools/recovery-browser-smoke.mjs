#!/usr/bin/env node
/** Actual context creation failure, failed asset fetch, and host shelf recovery. */
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
const base=process.env.RAFFI_APP_URL||'http://127.0.0.1:3091',out=process.env.RAFFI_SMOKE_OUT||'/tmp/raffi-recovery-browser'
await fs.mkdir(out,{recursive:true});const report={checks:[],expectedFailures:[]}
for(const kind of ['graphics','asset']){
 const b=await chromium.launch({headless:true,args:kind==='graphics'?['--disable-webgl','--disable-webgl2']:['--use-angle=metal']})
 try{
  const p=await b.newPage({viewport:{width:1280,height:800}})
  if(kind==='asset')await p.route('**/world/data/world.json',r=>r.abort('failed'))
  await p.goto(base+'/?app=world&hour=14&tier=low')
  const frame=await p.locator('iframe[title="RAFFI WORLD"]').contentFrame()
  await frame.locator('#graphics-error').waitFor({state:'visible',timeout:90000})
  const copy=await frame.locator('#graphics-error').innerText();report.last={kind,copy};await p.screenshot({path:out+'/'+kind+'.png'})
  if(kind==='graphics'){assert.match(copy,/cannot start 3D/);assert.match(copy,/hardware acceleration/);assert.equal(await frame.locator('#graphics-light').isVisible(),false)}
  else assert.match(copy,/could not load/)
  assert.doesNotMatch(copy,/checkpoint is|place is saved|verified local save/)
  await p.screenshot({path:out+'/'+kind+'.png'})
  await p.getByRole('button',{name:'Game shelf',exact:true}).click()
  await p.getByRole('dialog',{name:'Games',exact:true}).waitFor({state:'visible'})
  report.checks.push({kind,copy,shelf:true})
 }catch(e){report.failure=String(e);process.exitCode=1;break}finally{await b.close()}
}
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
