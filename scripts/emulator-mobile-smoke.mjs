import assert from 'node:assert/strict'
import { chromium, devices } from 'playwright'
import fs from 'node:fs/promises'
const base=process.env.RAFFI_APP_URL||'http://127.0.0.1:3000'
const out=process.env.RAFFI_QA_OUTPUT_DIR||'/tmp/emulator-qa'
await fs.mkdir(out,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,headless:true})
const page=await browser.newPage({...devices['iPhone 13']})
page.setDefaultTimeout(45000)
const errors=[];page.on('pageerror',e=>errors.push(e.message))
// An original tiny NES program sets a plain blue background and loops.
// This tests a real core without using a copyrighted game ROM.
const rom=Buffer.alloc(16+16384,0xea);rom.fill(0,0,16);rom.set([0x4e,0x45,0x53,0x1a,1,0],0)
const program=[0x78,0xd8,0xa2,0xff,0x9a,0xad,0x02,0x20,0x10,0xfb,0xa9,0x3f,0x8d,0x06,0x20,0xa9,0,0x8d,0x06,0x20,0xa9,0x22,0x8d,0x07,0x20,0xa9,0,0x8d,0x05,0x20,0x8d,0x05,0x20,0xa9,0x08,0x8d,0x01,0x20,0x4c,0x26,0x80]
rom.set(program,16);rom.set([0,0x80,0,0x80,0,0x80],rom.length-6)
try{
 const main=await page.goto(base+'/games/emulator',{waitUntil:'networkidle'})
 assert.ok(!main.headers()['content-security-policy'].includes('cdn.emulatorjs.org'))
 const embedded=await page.request.get(base+'/emulator/index.html')
 assert.ok(embedded.headers()['content-security-policy'].includes('cdn.emulatorjs.org'))
 await page.getByRole('button',{name:'I Understand & Accept'}).click()
 await page.getByRole('heading',{name:'Nintendo (NES)',exact:true}).click()
 assert.equal(await page.locator('iframe').count(),0)
 await page.locator('input[type=file]').setInputFiles({name:'original-blue-test.nes',mimeType:'application/octet-stream',buffer:rom})
 await page.getByRole('status').filter({hasText:'Press Start Game'}).waitFor({timeout:90000})
 let frame=page.frames().find(f=>f.url().includes('/emulator/index.html'))
 const config=await frame.evaluate(()=>({core:EJS_core,name:EJS_gameName,type:EJS_VirtualGamepadSettings[0].type,blob:EJS_gameUrl.startsWith('blob:')}))
 assert.deepEqual(config,{core:'nes',name:'original-blue-test.nes',type:'zone',blob:true})
 await frame.getByText('Start Game',{exact:true}).tap()
 await page.getByRole('status').filter({hasText:'Playing.'}).waitFor({timeout:120000})
 assert.equal(await frame.evaluate(()=>EJS_emulator.getSettingValue('virtual-gamepad')),'enabled')
 await page.screenshot({path:out+'/playing.png'})
 await page.getByLabel('Emulator touch controls').selectOption('dpad')
 await page.getByRole('status').filter({hasText:'Press Start Game'}).waitFor({timeout:90000})
 frame=page.frames().find(f=>f.url().includes('/emulator/index.html'))
 assert.equal(await frame.evaluate(()=>EJS_VirtualGamepadSettings[0].type),'dpad')
 await page.getByRole('button',{name:'Close emulator'}).click();assert.equal(await page.locator('iframe').count(),0)
 assert.deepEqual(errors,[])
 process.stdout.write('Emulator real NES core startup, scoped CSP, mobile joystick config, D-pad restart, iframe replacement and close passed.\n')
}catch(e){process.stderr.write(e.stack+'\n');process.stderr.write(JSON.stringify(errors)+'\n');await page.screenshot({path:out+'/failure.png'});process.exitCode=1}finally{await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,3000))]);process.exit(process.exitCode||0)}
