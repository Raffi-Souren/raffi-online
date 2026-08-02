#!/usr/bin/env node

/**
 * Deterministic visual audit for RAFFI WORLD.
 *
 * Start the site first, then run:
 *   node public/world/tools/audit.mjs --phase phase2
 *
 * Environment overrides:
 *   RAFFI_WORLD_URL=http://127.0.0.1:3000/world/index.html
 *   RAFFI_AUDIT_CHROME=/path/to/chrome
 *   RAFFI_AUDIT_SETTLE_MS=650
 */

import { constants as fsConstants } from 'node:fs'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const WORLD_DIR = path.resolve(SCRIPT_DIR, '..')
const GRADES = ['dusk', 'haze', 'night']
const CAMERA_YAWS = [45, 135, 225, 315]
const DEFAULT_URL = 'http://127.0.0.1:3000/world/index.html'
const DEFAULT_VIEWPORT = { width: 1280, height: 720 }

function parseArgs(argv) {
  const values = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--') && !values.phase) {
      values.phase = arg
      continue
    }
    if (arg === '--headed') {
      values.headed = true
      continue
    }
    const [flag, inline] = arg.split('=', 2)
    const name = flag.slice(2)
    const value = inline ?? argv[++i]
    if (!value) throw new Error(`missing value for ${flag}`)
    values[name] = value
  }
  return values
}

function safeSegment(value, label) {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(value)) {
    throw new Error(`${label} must contain only letters, numbers, dot, dash, or underscore`)
  }
  return value
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'position'
}

function html(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function auditUrl(base, seed) {
  const url = new URL(base)
  url.searchParams.set('debug', '1')
  url.searchParams.set('auto', '1')
  url.searchParams.set('seed', seed)
  return url.href
}

function inspectionPositions(district) {
  const { minX, maxX, minZ, maxZ } = district.bounds
  const width = maxX - minX
  const depth = maxZ - minZ
  const candidates = [
    ...(district.spawnPoints || []).filter((point) => point.role !== 'interior').map((point) => ({
      id: point.id,
      source: 'spawn',
      x: point.x,
      z: point.z,
    })),
    { id: 'district-centre', source: 'derived', x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
    { id: 'north-west-quarter', source: 'derived', x: minX + width * 0.25, z: minZ + depth * 0.25 },
    { id: 'south-east-quarter', source: 'derived', x: minX + width * 0.75, z: minZ + depth * 0.75 },
    { id: 'north-east-quarter', source: 'derived', x: minX + width * 0.75, z: minZ + depth * 0.25 },
    { id: 'south-west-quarter', source: 'derived', x: minX + width * 0.25, z: minZ + depth * 0.75 },
  ]

  const unique = []
  for (const candidate of candidates) {
    if (unique.some((point) => Math.hypot(point.x - candidate.x, point.z - candidate.z) < 1)) continue
    unique.push(candidate)
    if (unique.length === 4) break
  }
  if (unique.length < 4) throw new Error(`could not derive four unique positions for ${district.id}`)
  return unique.map((point, index) => ({ ...point, cameraYaw: CAMERA_YAWS[index] }))
}

async function isExecutable(file) {
  if (!file) return false
  try {
    await access(file, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

async function launchChromium(chromium, launchOptions) {
  const explicit = process.env.RAFFI_AUDIT_CHROME || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  const systemCandidates = [
    explicit,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean)

  if (explicit && !await isExecutable(explicit)) {
    throw new Error(`RAFFI_AUDIT_CHROME is not executable: ${explicit}`)
  }

  if (explicit) {
    return {
      browser: await chromium.launch({ ...launchOptions, executablePath: explicit }),
      executable: explicit,
    }
  }

  try {
    return { browser: await chromium.launch(launchOptions), executable: 'playwright-bundled-chromium' }
  } catch (bundledError) {
    for (const executable of systemCandidates) {
      if (!await isExecutable(executable)) continue
      try {
        return {
          browser: await chromium.launch({ ...launchOptions, executablePath: executable }),
          executable,
        }
      } catch {
        // Keep trying the known system browser locations.
      }
    }
    throw new Error(
      `Playwright could not launch Chromium. Install its browser or set RAFFI_AUDIT_CHROME.\n${bundledError.message}`
    )
  }
}

async function settle(page, milliseconds) {
  await page.waitForTimeout(milliseconds)
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  }))
}

function contactSheetDocument(report) {
  const cards = report.screenshots.map((shot) => `
    <figure>
      <img src="${html(shot.file)}" alt="${html(`${shot.district} ${shot.position} ${shot.grade}`)}">
      <figcaption>
        <b>${html(shot.district)} · ${html(shot.position)}</b>
        <span>${html(shot.grade)} · cam ${shot.cameraYaw}° · ${shot.metrics.drawCalls} calls · ${shot.metrics.triangles} tris · ${shot.metrics.fps} fps</span>
      </figcaption>
    </figure>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RAFFI WORLD ${html(report.phase)} visual audit</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; color: #e9ffff; background: #101318; font: 14px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace; }
  header { display: flex; justify-content: space-between; align-items: end; gap: 24px; margin: 0 0 20px; }
  h1 { margin: 0; color: #35dddd; font-size: 24px; letter-spacing: .08em; }
  header p { margin: 4px 0 0; color: #aab7c2; }
  .summary { color: #ffd166; text-align: right; }
  main { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  figure { min-width: 0; margin: 0; overflow: hidden; border: 1px solid #36444f; background: #171d23; }
  img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; image-rendering: pixelated; background: #000; }
  figcaption { display: grid; gap: 2px; padding: 9px 10px 10px; }
  figcaption b { color: #f7b873; text-transform: uppercase; }
  figcaption span { color: #aab7c2; font-size: 12px; }
</style>
</head>
<body>
  <header>
    <div><h1>RAFFI WORLD — ${html(report.phase)}</h1><p>${html(report.seed)} · ${html(report.createdAt)}</p></div>
    <div class="summary">${report.screenshots.length} views · max ${report.summary.maxDrawCalls} calls · ${report.summary.maxTriangles} tris</div>
  </header>
  <main>${cards}</main>
</body>
</html>`
}

async function writeReport(outputDir, report) {
  await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const phase = safeSegment(args.phase || process.env.RAFFI_AUDIT_PHASE || 'phase2', 'phase')
  const seed = safeSegment(args.seed || process.env.RAFFI_AUDIT_SEED || 'FIXED', 'seed')
  const baseUrl = args.url || process.env.RAFFI_WORLD_URL || DEFAULT_URL
  const targetUrl = auditUrl(baseUrl, seed)
  const settleMs = Number(args.settle || process.env.RAFFI_AUDIT_SETTLE_MS || 650)
  if (!Number.isFinite(settleMs) || settleMs < 0) throw new Error('settle time must be a non-negative number')

  const world = JSON.parse(await readFile(path.join(WORLD_DIR, 'data', 'world.json'), 'utf8'))
  const outputDir = path.join(WORLD_DIR, 'audit', phase)
  await mkdir(outputDir, { recursive: true })

  const report = {
    version: 1,
    complete: false,
    phase,
    seed,
    createdAt: new Date().toISOString(),
    url: targetUrl,
    viewport: DEFAULT_VIEWPORT,
    budget: world.render.budget,
    browser: null,
    screenshots: [],
    errors: [],
    summary: { expectedScreenshots: world.districts.length * GRADES.length * 4, capturedScreenshots: 0, maxDrawCalls: 0, maxTriangles: 0, minFps: null, budgetViolations: 0 },
  }

  let browser
  try {
    let playwright
    try {
      playwright = await import('playwright')
    } catch (error) {
      throw new Error(`Playwright is required. Install it with npm before running this audit.\n${error.message}`)
    }

    const launched = await launchChromium(playwright.chromium, {
      headless: !args.headed,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    })
    browser = launched.browser
    report.browser = launched.executable

    const context = await browser.newContext({
      viewport: DEFAULT_VIEWPORT,
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()

    const recordError = (kind, message, extra = {}) => {
      report.errors.push({ kind, message, ...extra })
    }
    page.on('pageerror', (error) => recordError('pageerror', error.message, { stack: error.stack }))
    page.on('console', (message) => {
      if (message.type() === 'error') recordError('console', message.text(), { location: message.location() })
    })
    page.on('requestfailed', (request) => recordError('requestfailed', request.url(), { failure: request.failure() }))
    page.on('response', (response) => {
      if (response.status() >= 400) recordError('http', `${response.status()} ${response.url()}`)
    })

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    try {
      await page.waitForFunction(
        () => window.RAFFI_WORLD?.ready === true && window.RAFFI_WORLD.stats().drawCalls > 0,
        undefined,
        { timeout: 120_000 }
      )
    } catch (error) {
      const bootStatus = await page.locator('#boot-status').textContent().catch(() => null)
      throw new Error(`world did not reach its first frame${bootStatus ? ` (boot: ${bootStatus})` : ''}: ${error.message}`)
    }
    await settle(page, settleMs)
    await page.addStyleTag({ content: '#toast, #subtitle { display: none !important; }' })

    let ordinal = 0
    for (const grade of GRADES) {
      for (const district of world.districts) {
        for (const position of inspectionPositions(district)) {
          ordinal++
          const file = [
            String(ordinal).padStart(2, '0'),
            grade,
            district.id,
            slug(position.id),
          ].join('--') + '.png'

          try {
            await page.evaluate(async ({ x, z, gradeId, cameraYaw }) => {
              const { cam } = await import('/world/engine/camera.js')
              const radians = cameraYaw * Math.PI / 180
              cam.currentYaw = radians
              cam.desiredYaw = radians
              window.RAFFI_WORLD.setGrade(gradeId)
              // Passing Y activates the debug fly camera, preventing collision
              // resolution from moving a deterministic inspection position.
              window.RAFFI_WORLD.teleport(x, z, 0)
            }, { x: position.x, z: position.z, gradeId: grade, cameraYaw: position.cameraYaw })
            await settle(page, settleMs)

            const snapshot = await page.evaluate(() => ({
              state: window.RAFFI_WORLD.getState(),
              stats: { ...window.RAFFI_WORLD.stats() },
              triangleTotal: window.RAFFI_WORLD.triangleTotal,
              readout: document.querySelector('#debug-readout')?.textContent || '',
            }))
            const actual = snapshot.state.player
            if (Math.hypot(actual.x - position.x, actual.z - position.z) > 0.25) {
              recordError('position', `${district.id}/${position.id} drifted from its audit coordinate`, {
                expected: { x: position.x, z: position.z },
                actual: { x: actual.x, z: actual.z },
              })
            }
            if (snapshot.state.grade !== grade) {
              recordError('grade', `${district.id}/${position.id} requested ${grade} but rendered ${snapshot.state.grade}`)
            }

            await page.screenshot({ path: path.join(outputDir, file), animations: 'disabled' })
            const metrics = {
              drawCalls: snapshot.stats.drawCalls,
              triangles: snapshot.stats.triangles,
              fps: snapshot.stats.fps,
              generatedTriangles: snapshot.triangleTotal,
            }
            const overBudget = metrics.drawCalls > world.render.budget.drawCalls || metrics.triangles > world.render.budget.triangles
            report.screenshots.push({
              file,
              grade,
              district: district.id,
              position: position.id,
              positionSource: position.source,
              coordinate: { x: position.x, z: position.z },
              cameraYaw: position.cameraYaw,
              renderedDistrict: snapshot.state.district,
              metrics,
              overBudget,
              debugReadout: snapshot.readout,
            })
            report.summary.maxDrawCalls = Math.max(report.summary.maxDrawCalls, metrics.drawCalls)
            report.summary.maxTriangles = Math.max(report.summary.maxTriangles, metrics.triangles)
            report.summary.minFps = report.summary.minFps === null ? metrics.fps : Math.min(report.summary.minFps, metrics.fps)
            if (overBudget) report.summary.budgetViolations++
          } catch (error) {
            recordError('capture', `${grade}/${district.id}/${position.id}: ${error.message}`, { stack: error.stack })
          }

          report.summary.capturedScreenshots = report.screenshots.length
          await writeReport(outputDir, report)
        }
      }
    }

    const sheetHtml = contactSheetDocument(report)
    const sheetPath = path.join(outputDir, 'contact-sheet.html')
    await writeFile(sheetPath, sheetHtml)
    const contactPage = await context.newPage()
    await contactPage.setViewportSize({ width: 1600, height: 900 })
    await contactPage.goto(pathToFileURL(sheetPath).href, { waitUntil: 'load' })
    await contactPage.waitForFunction(
      () => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
      undefined,
      { timeout: 60_000 }
    )
    await contactPage.screenshot({ path: path.join(outputDir, 'contact-sheet.png'), fullPage: true })
    await contactPage.close()

    report.complete = report.screenshots.length === report.summary.expectedScreenshots
    report.finishedAt = new Date().toISOString()
    await writeReport(outputDir, report)

    const status = report.complete && report.errors.length === 0 && report.summary.budgetViolations === 0
    process.stdout.write(
      `RAFFI WORLD ${phase}: ${report.screenshots.length}/${report.summary.expectedScreenshots} screenshots, ` +
      `max ${report.summary.maxDrawCalls}/${world.render.budget.drawCalls} calls, ` +
      `${report.summary.maxTriangles}/${world.render.budget.triangles} tris, ` +
      `${report.errors.length} errors\n` +
      `Contact sheet: ${path.join(outputDir, 'contact-sheet.png')}\n`
    )
    if (!status) process.exitCode = 1
  } catch (error) {
    report.errors.push({ kind: 'fatal', message: error.message, stack: error.stack })
    report.finishedAt = new Date().toISOString()
    await writeReport(outputDir, report)
    throw error
  } finally {
    await browser?.close()
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`)
  process.exitCode = 1
})
