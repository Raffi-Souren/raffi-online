#!/usr/bin/env node
/**
 * Browser budget gate for FREE-yaw / multi-mode views.
 * Modern Medium targets: total scene/shadow/post calls <250; visible triangles <150k.
 * This camera matrix checks complexity, not consumer-device frame performance.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import process from 'node:process'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'

const BASE = process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3024/world/index.html'
const OUT = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-camera-budget'
const HARD_DRAWS = 250
const HARD_TRIS = 150_000

// Deliberately matches performance-route.mjs so both reports identify the
// same runtime and asset contents, independent of tool-only edits.
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
const contentHash = await buildFingerprint()
await fs.mkdir(OUT, { recursive: true })

const world = JSON.parse(await fs.readFile(new URL('../data/world.json', import.meta.url), 'utf8'))

const executableCandidates = [
  process.env.RAFFI_AUDIT_CHROME,
  chromium.executablePath(),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)
let executablePath
for (const candidate of executableCandidates) {
  try {
    await fs.access(candidate)
    executablePath = candidate
    break
  } catch {}
}

const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', ...(process.env.RAFFI_GPU === 'metal' ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])],
})

const errors = []
const metricsLog = []
const budgetMisses = []
const report = {
  contentHash, contentHashAfter: null, fingerprintMatches: null,
  measurement: 'Headless camera complexity samples; not consumer-device frame-rate certification.',
  viewport: { width: 1280, height: 800 },
  maxDraws: null, maxTris: null, minFps: null,
  budgetMisses, samples: metricsLog, hard: { HARD_DRAWS, HARD_TRIS },
}

async function readyPage(context, { disableChunk = false } = {}) {
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push('page: ' + error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push('console: ' + message.text())
  })
  if (disableChunk) {
    await page.addInitScript(() => {
      globalThis.__RAFFI_OPAQUE_CHUNK__ = false
    })
  }
  await page.goto(BASE + '?debug=1&auto=1&seed=FIXED&tier=medium', { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.waitForFunction(
    () => window.RAFFI_WORLD?.ready && window.RAFFI_WORLD.stats().drawCalls > 0,
    null,
    { timeout: 180_000 },
  )
  await page.evaluate(() => window.RAFFI_WORLD.dismissDialogue())
  return page
}

async function pressKey(page, key, holdMs = 80) {
  await page.keyboard.down(key)
  await page.waitForTimeout(holdMs)
  await page.keyboard.up(key)
}

async function sample(page, label) {
  // Let a couple frames settle after teleport / cam change.
  await page.waitForTimeout(120)
  const m = await page.evaluate(() => {
    const s = window.RAFFI_WORLD.stats()
    const st = window.RAFFI_WORLD.getState()
    return {
      drawCalls: s.drawCalls,
      triangles: s.visibleTriangles,
      shadowDrawCalls: s.shadowDrawCalls,
      postDrawCalls: s.postDrawCalls,
      totalTriangles: s.triangles,
      fps: s.fps,
      mode: window.RAFFI_WORLD.getCameraMode().id,
      x: st.player.x,
      z: st.player.z,
    }
  })
  metricsLog.push({ label, ...m })
  if (m.drawCalls >= HARD_DRAWS) budgetMisses.push(`${label}: draws ${m.drawCalls} >= ${HARD_DRAWS}`)
  if (m.triangles >= HARD_TRIS) budgetMisses.push(`${label}: tris ${m.triangles} >= ${HARD_TRIS}`)
  return m
}

async function setMode(page, id) {
  await page.evaluate((modeId) => window.RAFFI_WORLD.setCameraMode(modeId), id)
  await page.waitForTimeout(100)
}

try {
  // ---------- mesh contract (chunked scene graph) ----------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await readyPage(ctx)

  // Inspect scene graph via dynamic import of three scene from engine state.
  const graph = await page.evaluate(async () => {
    const { gfx } = await import('/world/engine/render.js')
    const opaque = []
    const emissive = []
    const alpha = []
    gfx.scene.traverse((o) => {
      if (!o.isMesh || !o.name) return
      if (o.name.includes(':opaque')) opaque.push(o.name)
      if (o.name.includes(':emissive')) emissive.push(o.name)
      if (o.name.endsWith(':alpha')) alpha.push(o.name)
    })
    return { opaque, emissive, alpha }
  })

  assert.ok(graph.opaque.length > 5, `opaque should be multi-chunk, got ${graph.opaque.length}`)
  // Opaque emission can be chunked; transparent alpha keeps its district sort.
  for (const d of world.districts) {
    const a = graph.alpha.filter((n) => n === `district:${d.id}:alpha`)
    assert.ok(a.length <= 1, `alpha count for ${d.id}: ${a.length}`)
    assert.ok(!graph.emissive.includes(`district:${d.id}:emissive`), 'opaque emission needs local bounds')
  }
  // No district should have a single unsplit "district:id:opaque" only name
  // without chunk suffix when chunking is on — either spill or cx_cz.
  const unsplit = graph.opaque.filter((n) => /^district:[^:]+:opaque$/.test(n))
  assert.equal(unsplit.length, 0, `unsplit opaque meshes: ${unsplit.join(',')}`)

  // ---------- desktop multi-mode + FREE Q sweep ----------
  const samples = []
  const points = [
    { name: 'heights-spawn', x: world.spawn.x, z: world.spawn.z },
    { name: 'downtown', x: 60, z: -250 },
    { name: 'strip', x: 140, z: 136 },
    { name: 'yards', x: 420, z: 80 },
    { name: 'bowl', x: -420, z: 120 },
    { name: 'blackout-mark', x: -400, z: -380 },
  ]
  const modes = ['classic', 'chase', 'free', 'birds']
  const grades = ['dusk', 'haze', 'night']

  for (const grade of grades) {
    await page.evaluate((g) => window.RAFFI_WORLD.setGrade(g), grade)
    for (const pt of points) {
      await page.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x, z), pt)
      for (const mode of modes) {
        await setMode(page, mode)
        samples.push(await sample(page, `${grade}/${pt.name}/${mode}`))
      }
      // FREE + real Q presses (yaw sweep)
      await setMode(page, 'free')
      for (let q = 0; q < 4; q++) {
        await pressKey(page, 'KeyQ', 90)
        samples.push(await sample(page, `${grade}/${pt.name}/free-Q${q + 1}`))
      }
      for (let x = 0; x < 2; x++) {
        await pressKey(page, 'KeyX', 90)
        samples.push(await sample(page, `${grade}/${pt.name}/free-X${x + 1}`))
      }
    }
  }

  // Mounted board at garage
  const board = world.landmarks
    .find((l) => l.type === 'mobility-hub')
    ?.rides?.find((r) => r.archetype === 'skateboard')
  if (board) {
    await page.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x, z), board.at)
    await pressKey(page, 'KeyE', 80)
    await setMode(page, 'chase')
    samples.push(await sample(page, 'mounted-chase-board'))
    await setMode(page, 'free')
    await pressKey(page, 'KeyQ', 90)
    samples.push(await sample(page, 'mounted-free-Q1-board'))
  }

  // Screenshots for visual gate (alpha yards + night strip)
  await page.evaluate(() => window.RAFFI_WORLD.dismissDialogue())
  if (await page.evaluate(() => Boolean(window.RAFFI_WORLD.getState().player.vehicle))) {
    await pressKey(page, 'KeyE')
    await page.waitForFunction(() => !window.RAFFI_WORLD.getState().player.vehicle)
  }
  await page.evaluate((g) => window.RAFFI_WORLD.setGrade(g), 'haze')
  await page.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x, z), { x: 560, z: 140 })
  await setMode(page, 'classic')
  // The debug HUD refreshes every six frames; allow it and the camera to settle
  // so the screenshot metadata describes the view being captured.
  await page.waitForTimeout(500)
  assert.ok(await page.evaluate(() => { const p = window.RAFFI_WORLD.getState().player; return Math.hypot(p.x - 560, p.z - 140) < 1 }), 'yards screenshot must remain at its declared fixture')
  await page.screenshot({ path: OUT + '/yards-chainlink-classic.png' })
  await page.evaluate((g) => window.RAFFI_WORLD.setGrade(g), 'night')
  await page.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x, z), { x: -60, z: 106 })
  await setMode(page, 'chase')
  await page.waitForTimeout(500)
  assert.ok(await page.evaluate(() => { const p = window.RAFFI_WORLD.getState().player; return Math.hypot(p.x + 60, p.z - 106) < 1 }), 'record-store screenshot must remain at its declared fixture')
  await page.screenshot({ path: OUT + '/strip-night-chase.png' })

  const maxDraws = Math.max(...samples.map((s) => s.drawCalls))
  const maxTris = Math.max(...samples.map((s) => s.triangles))
  const minFps = Math.min(...samples.map((s) => s.fps || 999))
  Object.assign(report, { maxDraws, maxTris, minFps })

  await fs.writeFile(
    OUT + '/metrics.json',
    JSON.stringify(report, null, 2),
  )

  console.log(`[budget] samples=${samples.length} maxDraws=${maxDraws} maxTris=${maxTris} minFps=${minFps}`)
  assert.deepEqual(budgetMisses, [], 'Medium camera complexity targets missed; inspect metrics.json before changing a budget')

  // Mobile layout overlap
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const mpage = await readyPage(mobile)
  await mpage.evaluate(() => {
    document.getElementById('touch')?.classList.remove('hidden')
    const p = document.getElementById('interaction-prompt')
    if (p) {
      p.classList.add('show')
      p.style.opacity = '1'
    }
  })
  const overlap = await mpage.evaluate(() => {
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, left: r.left, top: r.top }
    }
    const hit = (a, b) =>
      a && b && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)
    const prompt = box(document.getElementById('interaction-prompt'))
    const primary = box(document.getElementById('btn-action'))
    const second = box(document.getElementById('btn-second'))
    const radio = box(document.getElementById('btn-radio'))
    return {
      prompt,
      primary,
      second,
      radio,
      hitPrimary: hit(prompt, primary),
      hitSecond: hit(prompt, second),
      hitRadio: hit(prompt, radio),
    }
  })
  await mpage.screenshot({ path: OUT + '/mobile-390-layout.png' })
  assert.equal(overlap.hitPrimary, false, 'interaction-prompt overlaps #btn-action')
  assert.equal(overlap.hitSecond, false, 'interaction-prompt overlaps #btn-second')
  assert.equal(overlap.hitRadio, false, 'interaction-prompt overlaps #btn-radio')

  // ---------- MUTATION: disable chunking → FREE budget must fail ----------
  const mutCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const mutPage = await readyPage(mutCtx, { disableChunk: true })
  await mutPage.evaluate(({ x, z }) => window.RAFFI_WORLD.teleport(x, z), { x: -400, z: -380 })
  await setMode(mutPage, 'free')
  await pressKey(mutPage, 'KeyQ', 100)
  await mutPage.waitForTimeout(150)
  const mutStats = await mutPage.evaluate(() => window.RAFFI_WORLD.stats())
  let mutFailed = false
  let mutMsg = ''
  try {
    assert.ok(
      mutStats.visibleTriangles < HARD_TRIS,
      `pursuit tris ${mutStats.visibleTriangles} >= ${HARD_TRIS}`,
    )
  } catch (err) {
    mutFailed = true
    mutMsg = err.message
  }
  assert.ok(
    mutFailed,
    `mutation expected FREE-yaw tris >= ${HARD_TRIS}, got ${mutStats.visibleTriangles}`,
  )
  assert.match(mutMsg, /tris \d+ >= 150000/)
  console.log(`[mutation] disabled chunking failed as expected: ${mutMsg}`)
  await fs.writeFile(
    OUT + '/mutation.json',
    JSON.stringify({ disabledChunk: true, stats: mutStats, message: mutMsg }, null, 2),
  )

  // Restore path: chunking on already passed above.
  assert.ok(errors.length === 0, 'browser errors: ' + errors.join(' | '))
} catch (error) {
  report.failure = error.stack || String(error)
  throw error
} finally {
  try {
    report.contentHashAfter = await buildFingerprint()
    report.fingerprintMatches = report.contentHashAfter === contentHash
    await fs.writeFile(OUT + '/metrics.json', JSON.stringify(report, null, 2))
    assert.equal(report.contentHashAfter, contentHash, 'runtime or assets changed during the camera budget measurement')
  } finally {
    await browser.close()
  }
}
console.log('[budget] PASS')
