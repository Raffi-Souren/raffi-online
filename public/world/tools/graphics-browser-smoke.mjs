#!/usr/bin/env node

/**
 * Graphics smoke: every tier renders with no WebGL or three.js complaint,
 * with the passes it promises (FXAA where there is no MSAA, wide bloom, AO
 * on High and Ultra, soft cascaded shadows), and a picture that is not
 * blank, switching between them live as the pause menu does. Auto mode
 * recognises a software GPU and stays light, and its
 * governor lowers the render resolution under slow frames (with sharpening
 * to match) and restores it when frames recover. Each World runs in its own
 * context, closed before the next one starts.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.RAFFI_WORLD_URL || 'http://127.0.0.1:3000/world/index.html'
const out = process.env.RAFFI_SMOKE_OUT || '/tmp/raffi-world-graphics'
await fs.mkdir(out, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const report = { tiers: {}, auto: null }
const problems = []

async function open(params) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const complaints = []
  page.on('pageerror', (error) => complaints.push('page: ' + error.message))
  page.on('console', (message) => {
    const text = message.text()
    // Shader compile errors, GL errors and three.js deprecations all surface here.
    if (message.type() === 'error' || /THREE\.|WebGL|GL_INVALID|shader/i.test(text)) complaints.push(message.type() + ': ' + text.slice(0, 300))
  })
  const url = new URL(base)
  for (const [key, value] of Object.entries({ debug: '1', auto: '1', seed: 'FIXED', hour: '22', ...params })) url.searchParams.set(key, value)
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.waitForFunction(() => window.RAFFI_WORLD?.ready && window.RAFFI_WORLD.stats().drawCalls > 0, null, { timeout: 180_000 })
  await page.evaluate(async () => {
    const { state } = await import('/world/engine/state.js')
    const { gfx } = await import('/world/engine/render.js')
    window.__GFX__ = { state, gfx }
    window.RAFFI_WORLD.dismissDialogue()
  })
  // Let shadows, cascades and the first bloom chain settle in simulation time.
  const until = await page.evaluate(() => window.__GFX__.state.time + 1.5)
  await page.waitForFunction((until) => window.__GFX__.state.time >= until, until, { timeout: 180_000 })
  return { context, page, complaints }
}

const snapshot = (page) => page.evaluate(() => {
  const q = window.RAFFI_WORLD.getQuality()
  const s = window.RAFFI_WORLD.stats()
  return {
    preset: q.preset, tier: q.tier, gpu: q.gpu, ceiling: q.ceiling, scale: q.scale, samples: q.samples, antialias: q.antialias,
    bloom: q.bloom, bloomLevels: q.bloomLevels, ao: q.ao, shadows: q.activeShadowMaps, shadowRadius: q.shadowRadius, drawDistance: q.drawDistance,
    // The live render target, not last frame's readout: a paused World draws no frames.
    render: [window.__GFX__.gfx.internal.w, window.__GFX__.gfx.internal.h], drawCalls: s.drawCalls, postDrawCalls: s.postDrawCalls, visibleTriangles: s.visibleTriangles,
  }
})

async function picture(page, name) {
  await page.evaluate(() => window.postMessage({ type: 'raffi-world:activity', active: false }, location.origin))
  try {
    await page.screenshot({ path: `${out}/${name}.png`, timeout: 120_000 })
  } finally {
    await page.evaluate(() => window.postMessage({ type: 'raffi-world:activity', active: true }, location.origin))
  }
  return (await fs.stat(`${out}/${name}.png`)).size
}

// What each forced tier must deliver. Post passes at 1280×720 and DPR 1:
// bloom is 2n−1 passes for n levels, plus the output pass, plus FXAA where
// there is no MSAA, plus AO on High and Ultra.
const expectations = {
  low: { tier: 'performance', antialias: true, bloom: false, ao: false, shadows: [], post: 2 },
  medium: { tier: 'balanced', antialias: true, bloom: true, ao: false, shadows: [2048], post: 2 * 4 - 1 + 2 },
  high: { tier: 'high', antialias: false, bloom: true, ao: true, shadows: [1024, 1024, 1024], post: 1 + (2 * 5 - 1) + 1 },
  ultra: { tier: 'ultra', antialias: false, bloom: true, ao: true, shadows: [2048, 2048, 2048], post: 1 + (2 * 5 - 1) + 1 },
}

try {
  // One World, switched tier to tier the way the pause menu does: it boots
  // once (booting is most of the cost on a CPU renderer) and every switch
  // is exercised live, cascades rebuilt and materials swapped included.
  const tiered = await open({ tier: 'low' })
  for (const [param, expected] of Object.entries(expectations)) {
    const { page } = tiered
    const seen = tiered.complaints.length
    if (param !== 'low') {
      await page.evaluate((preset) => window.RAFFI_WORLD.setQuality(preset), param)
      // Shadows refresh at 30 Hz of game time and bloom is immediate, so a few
      // frames settle a switch; on a CPU renderer each High frame takes seconds.
      const until = await page.evaluate(() => window.__GFX__.state.time + 0.4)
      await page.waitForFunction((until) => window.__GFX__.state.time >= until, until, { timeout: 180_000 })
    }
    const complaints = tiered.complaints.slice(seen)
    const state = await snapshot(page)
    state.bytes = await picture(page, `tier-${param}`)
    state.complaints = complaints
    report.tiers[param] = state
    const check = (ok, message) => { if (!ok) problems.push(`${param}: ${message} · ${JSON.stringify(state)}`) }
    check(complaints.length === 0, 'console complaints')
    check(state.tier === expected.tier, 'wrong tier')
    check(state.antialias === expected.antialias, 'anti-aliasing')
    check(expected.antialias ? state.samples === 0 : state.samples >= 2, 'MSAA samples')
    check(state.bloom === expected.bloom, 'bloom')
    check(state.ao === expected.ao, 'ambient occlusion')
    check(JSON.stringify(state.shadows) === JSON.stringify(expected.shadows), 'shadow maps')
    check(state.postDrawCalls === expected.post, `post passes ${state.postDrawCalls} ≠ ${expected.post}`)
    check(state.shadows.length === 0 || state.shadowRadius >= 2, 'shadows have no penumbra')
    // A blank or black frame compresses to almost nothing.
    check(state.bytes > 60_000, 'picture looks blank')
    if (param === 'medium') check(state.drawCalls < 250, 'Medium over its 250 draw-call budget')
    if (param === 'ultra') check(state.drawDistance > report.tiers.high.drawDistance, 'Ultra sees no further than High')
  }
  // Down to Balanced (cascades torn down) and back to High (rebuilt). three
  // reuses a cached shader program for a known key, so a rebuild with the
  // old key drew without its cascade boundaries, or crashed on Ultra.
  {
    const { page } = tiered
    const seen = tiered.complaints.length
    for (const preset of ['balanced', 'high']) {
      await page.evaluate((preset) => window.RAFFI_WORLD.setQuality(preset), preset)
      const until = await page.evaluate(() => window.__GFX__.state.time + 0.3)
      await page.waitForFunction((until) => window.__GFX__.state.time >= until, until, { timeout: 180_000 })
    }
    const cascades = await page.evaluate(() => {
      const { gfx } = window.__GFX__
      const props = gfx.renderer.properties.get(gfx.materials.opaque)
      return { uniforms: !!props.uniforms?.CSM_cascades, maps: window.RAFFI_WORLD.getQuality().activeShadowMaps }
    })
    report.roundTrip = { ...cascades, complaints: tiered.complaints.slice(seen) }
    if (!cascades.uniforms || cascades.maps.length !== 3 || report.roundTrip.complaints.length) problems.push('High → Balanced → High lost its cascades · ' + JSON.stringify(report.roundTrip))
  }
  await tiered.context.close()

  // ---- auto on a software GPU: light tier, then the governor at work.
  {
    const { context, page, complaints } = await open({})
    const start = await snapshot(page)
    // The pause menu says what Auto picked.
    await page.evaluate(() => window.postMessage({ type: 'raffi-world:activity', active: false }, location.origin))
    const label = await page.evaluate(() => {
      document.getElementById('desktop-pause')?.click()
      return document.querySelector('[data-pause="quality"]')?.textContent
    })
    const slow = await page.evaluate(() => window.RAFFI_WORLD.feedQualityGovernor(40, 1200))
    const lowered = await snapshot(page)
    const fast = await page.evaluate(() => window.RAFFI_WORLD.feedQualityGovernor(16, 3000))
    const restored = await snapshot(page)
    report.auto = { start, label, slow, lowered, fast, restored, complaints }
    const check = (ok, message) => { if (!ok) problems.push(`auto: ${message} · ${JSON.stringify(report.auto)}`) }
    check(start.preset === 'auto' && start.gpu === 'software' && start.tier === 'performance' && start.ceiling === 'performance', 'a software GPU should start and stay on Performance')
    check(label === 'Graphics: Auto (Performance)', `pause label "${label}"`)
    check(JSON.stringify(slow.map((change) => change.scale)) === JSON.stringify([0.9, 0.8, 0.7]), 'slow frames should step the resolution down to 70%')
    check(slow.every((change) => !change.tier), 'Performance has no lower tier to drop to')
    check(lowered.scale === 0.7 && lowered.render[0] <= Math.round(start.render[0] * 0.71), 'the render target did not shrink')
    check(lowered.postDrawCalls === start.postDrawCalls, 'the present pass should stay on while sharpening')
    check(restored.scale === 1 && restored.render[0] === start.render[0], 'fast frames should restore full resolution')
    check(complaints.length === 0, 'console complaints')
    await context.close()
  }
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ ...report, problems }, null, 2))
  await browser.close()
}
assert.deepEqual(problems, [], 'graphics smoke')
console.log(JSON.stringify({ tiers: Object.fromEntries(Object.entries(report.tiers).map(([key, value]) => [key, { post: value.postDrawCalls, draws: value.drawCalls, render: value.render, bytes: value.bytes }])), auto: { label: report.auto.label, lowered: report.auto.lowered.render, restored: report.auto.restored.render } }, null, 2))
