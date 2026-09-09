#!/usr/bin/env node
/** Matched camera fixtures only. These captures do not stand in for gameplay. */
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createHash } from 'node:crypto'

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

const out = process.env.RAFFI_COMPARE_OUT || '/tmp/raffi-visual-comparison'
const sources = { before: process.env.RAFFI_BEFORE_URL || 'http://127.0.0.1:3082/world/index.html', after: process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3081/world/index.html' }
const views = [
  { id: 'willow-place', player: [-460, -145], camera: [-468, 4.1, -143], target: [-446, 2.4, -145], yaw: Math.PI / 2 },
  { id: 'b-side-records', player: [-69, 110], camera: [-71, 3.4, 99], target: [-60, 3, 119], yaw: 0 },
  { id: 'grove-gt', player: [-470, -150], camera: [-468, 3.2, -138], target: [-475, 0.9, -146.5], yaw: Math.PI },
]
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] })
const report = { contentHash, fixture: 'Same world coordinates, explicit perspective camera position/target/FOV and 1280×800 viewport. Original HEAD 1dfb7d6 versus working tree. Grade forced; transient interface hidden only for art comparison. Original internal resolution and materials are retained. This is fixture evidence, separate from normal-input playthroughs.', views, captures: [], errors: [] }
try {
  for (const [version, base] of Object.entries(sources)) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    page.on('pageerror', e => report.errors.push(version + ': ' + e.message))
    const url = new URL(base)
    for (const [name, value] of Object.entries({ auto: '1', debug: '1', tier: 'medium', hour: '14', seed: 'FIXED' })) url.searchParams.set(name, value)
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForFunction(() => window.RAFFI_WORLD?.ready, null, { timeout: 120000 })
    await page.addStyleTag({ content: '#hud,#debug,#touch,#pause,#toast,#subtitle,#desktop-tools,#game-question{visibility:hidden!important}' })
    await page.evaluate(async () => {
      const { state } = await import('/world/engine/state.js')
      const { cam } = await import('/world/engine/camera.js')
      const { gfx, renderFrame } = await import('/world/engine/render.js')
      window.art = { state, cam, gfx, renderFrame }
      RAFFI_WORLD.dismissDialogue()
      RAFFI_WORLD.setCameraMode('chase')
    })
    for (const view of views) for (const grade of ['haze', 'dusk', 'night']) {
      await page.evaluate(({ view, grade }) => {
        art.state.paused = false
        art.state.player.yaw = view.yaw
        RAFFI_WORLD.teleport(...view.player)
        RAFFI_WORLD.setGrade(grade)
      }, { view, grade })
      await page.waitForTimeout(600)
      let stats = await page.evaluate(view => {
        const { state, cam, gfx, renderFrame } = art
        state.paused = true
        const camera = cam.persp
        camera.fov = 58; camera.aspect = 1280 / 800; camera.updateProjectionMatrix()
        camera.position.set(...view.camera); camera.lookAt(...view.target); camera.updateMatrixWorld(true)
        // Fixed view needs a fresh cull pass after replacing the normal chase camera.
        gfx.scene.traverse(object => { if (object.name.includes(':opaque')) object.visible = true })
        if (RAFFI_WORLD.renderAuditView) RAFFI_WORLD.renderAuditView(camera)
        else renderFrame(camera)
        return { ...state.stats, internal: { ...gfx.internal } }
      }, view)
      // A newly visible identity may need its near GLB. Refresh the same camera,
      // with simulation paused, so comparison fixtures do not show stale proxies.
      await page.waitForTimeout(700)
      stats = await page.evaluate(() => { if (RAFFI_WORLD.renderAuditView) RAFFI_WORLD.renderAuditView(art.cam.persp); return { ...art.state.stats, internal: { ...art.gfx.internal } } })
      const name = `${view.id}-${grade}-${version}.png`
      await page.screenshot({ path: `${out}/${name}` })
      report.captures.push({ version, view: view.id, grade, name, stats })
    }
    await context.close()
  }
  assert.deepEqual(report.errors, [])
  report.contentHashAfter=await buildFingerprint()
  assert.equal(report.contentHashAfter,contentHash,'runtime changed during matched comparisons')
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2))
  await browser.close()
}
