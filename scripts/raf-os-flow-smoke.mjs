#!/usr/bin/env node
// Run after the test TypeScript build. Every RAF OS request is intercepted;
// fixture reviews are fictional and no material reaches an analysis provider.
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import { chromium } from "playwright"
import { PDFDocument } from "pdf-lib"

const require = createRequire(import.meta.url)
const { sampleRunBefore, sampleRunEvidence, sampleRunWording, sampleSubmissionBefore, sampleSubmissionEvidence, sampleSubmissionWording } = require("../.test-build/lib/raf-os-fixtures.js")
const base = process.env.RAFFI_APP_URL || "http://127.0.0.1:3100"
const out = process.env.RAFFI_QA_OUTPUT_DIR || "/tmp/raffi-raf-os-flow"
await fs.mkdir(out, { recursive: true })
const pdf = await PDFDocument.create()
pdf.addPage().drawText("Fictional test deck. No business or personal data.")
const pdfBytes = Buffer.from(await pdf.save())
const browser = await chromium.launch({ headless: true, ...(process.env.RAFFI_AUDIT_CHROME ? { executablePath: process.env.RAFFI_AUDIT_CHROME } : {}) })

async function downloadText(page, control, name) {
  const received = page.waitForEvent("download")
  await control.click()
  const file = await received
  await file.saveAs(`${out}/${name}`)
  return fs.readFile(`${out}/${name}`, "utf8")
}

try {
  for (const [name, width, height, mobile] of [["desktop", 1366, 768, false], ["phone", 390, 844, true], ["small-phone", 360, 740, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, acceptDownloads: true })
    const page = await context.newPage()
    const errors = []
    const posts = []
    let responseMode = "normal"
    let heldRoute = null
    page.on("pageerror", (error) => errors.push(error.message))
    await page.route("**/api/raf-os", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { available: true, providers: ["openai", "gemini"], defaultProvider: "openai" } })
      const body = route.request().postDataJSON()
      posts.push(body)
      if (responseMode === "hold") { heldRoute = route; return }
      if (responseMode === "error") return route.fulfill({ status: 503, json: { error: "The review could not complete. Your draft is preserved. Try again." } })
      const fixture = body.action === "compare" ? body.current.text === sampleSubmissionWording.text ? sampleRunWording : sampleRunEvidence : sampleRunBefore
      const sources = body.action === "compare" ? fixture.sources : body.current.text.split(/\n\s*\n/).filter(Boolean).map((text, i) => ({ id: `v2:p${i + 1}`, label: `V2 · paragraph ${i + 1}`, text: text.trim() }))
      return route.fulfill({ json: { ...fixture, sources, routing: { provider: body.provider === "gemini" ? "gemini" : "openai", policy: "fictional-browser-fixture", reason: "Intercepted browser test; no provider request." } } })
    })
    const terminal = page.locator(".raf-terminal")
    const command = async (text) => {
      if (!(await terminal.getByLabel("Terminal command").isVisible())) await terminal.getByRole("button", { name: "Commands", exact: true }).click()
      await terminal.getByLabel("Terminal command").fill(text)
      await terminal.getByLabel("Terminal command").press("Enter")
    }
    const version = (number) => number === 1 ? terminal.getByText("Version 1", { exact: true }).waitFor() : page.waitForFunction((n) => document.querySelector('[aria-label="Review version"]')?.selectedOptions[0]?.textContent.trim().startsWith(`Version ${n}`), number)
    const screenshot = async (stage) => page.screenshot({ path: `${out}/${name}-${stage}.png` })
    const checkBounds = async () => {
      const bounds = await terminal.evaluate((element) => {
        const dialog = element.closest('[role="dialog"]')
        const body = element.querySelector(".raf-output")
        const rect = dialog.getBoundingClientRect()
        return { width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom, overflow: body.scrollWidth - body.clientWidth }
      })
      assert.ok(bounds.right <= width + 1, `${name}: window extends beyond viewport`)
      assert.ok(bounds.bottom <= height - 38, `${name}: window covers taskbar`)
      assert.ok(bounds.overflow <= 1, `${name}: main reading region overflows horizontally`)
      return bounds
    }
    try {
      await page.goto(`${base}/?app=startup`, { waitUntil: "domcontentloaded" })
      await terminal.getByLabel("Your pitch", { exact: true }).waitFor()
      await page.waitForFunction(() => document.querySelector('[role="dialog"][aria-label="RAF OS TERMINAL"]')?.contains(document.activeElement))
      if (mobile) assert.notEqual(await page.evaluate(() => document.activeElement?.id), "raf-pitch", "opening a phone should not force its keyboard")
      else await page.waitForFunction(() => document.activeElement?.id === "raf-pitch")
      assert.equal(await terminal.getByRole("button", { name: "Analyze pitch", exact: true }).isDisabled(), true)
      const initial = await checkBounds()
      if (!mobile) { assert.ok(initial.width <= 860); assert.ok(initial.height < 650, `initial terminal is not compact: ${initial.height}`) }
      await screenshot("empty")
      // Commands retain the same input and permission checks as the main action.
      await command("/analyze")
      assert.match(await terminal.getByRole("alert").innerText(), /Paste your idea|attach a PDF/)
      assert.equal(posts.length, 0)
      await terminal.getByRole("button", { name: "Try an example" }).click()
      assert.match(await terminal.getByLabel("Your pitch", { exact: true }).inputValue(), /Fictional example/)
      await screenshot("example")
      await terminal.getByLabel("Upload pitch deck").setInputFiles({ name: "fictional-test.pdf", mimeType: "application/pdf", buffer: pdfBytes })
      await terminal.getByRole("button", { name: "Remove deck", exact: true }).waitFor()
      assert.equal(posts.length, 0, "attaching a PDF must not submit it")
      await terminal.getByRole("button", { name: "Remove deck", exact: true }).click()
      await terminal.getByLabel("Your pitch", { exact: true }).fill(sampleSubmissionBefore.text)
      await terminal.getByRole("button", { name: "Try an example" }).click()
      assert.equal(await terminal.getByLabel("Your pitch", { exact: true }).inputValue(), sampleSubmissionBefore.text, "example overwrote an existing draft")
      await command("/analyze")
      assert.match(await terminal.getByRole("alert").innerText(), /Allow the selected provider/)
      assert.equal(posts.length, 0)
      await terminal.getByRole("button", { name: "Data use", exact: true }).click()
      await terminal.getByRole("link", { name: "OpenAI", exact: true }).waitFor()
      await terminal.getByRole("button", { name: "Back", exact: true }).click()
      assert.equal(await terminal.getByLabel("Your pitch", { exact: true }).inputValue(), sampleSubmissionBefore.text)
      await terminal.locator("#raf-consent").check()
      responseMode = "hold"
      const initialRequest = page.waitForRequest((request) => request.url().endsWith("/api/raf-os") && request.method() === "POST")
      await terminal.getByRole("button", { name: "Analyze pitch", exact: true }).focus()
      await page.keyboard.press("Enter")
      await initialRequest
      await command("/analyze")
      assert.equal(posts.length, 1, "busy commands sent a duplicate request")
      await page.getByRole("button", { name: "Start menu", exact: true }).click()
      await page.getByRole("menuitem", { name: "Notes", exact: true }).click()
      await page.waitForFunction(() => document.querySelector('[data-window-id="notes"]')?.contains(document.activeElement))
      responseMode = "normal"
      await heldRoute.fulfill({ json: sampleRunBefore })
      heldRoute = null
      await version(1)
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      assert.equal(await page.evaluate(() => document.querySelector('[data-window-id="notes"]')?.contains(document.activeElement)), true, "a background review stole keyboard focus from Notes")
      await page.locator('[data-window-task="startup"]').click()
      await page.waitForFunction(() => document.activeElement?.textContent === "The take")
      await page.locator('[data-window-task="notes"]').click()
      await page.locator('[data-window-id="notes"]').getByRole("button", { name: "Close window", exact: true }).click()
      await page.waitForFunction(() => document.querySelector('[data-window-id="startup"]')?.contains(document.activeElement))
      assert.equal(posts[0].action, "analyze")
      assert.equal(posts[0].provider, "auto")
      assert.deepEqual(posts[0].current, sampleSubmissionBefore)
      await checkBounds()
      await screenshot("review")
      const demand = terminal.locator("article").filter({ has: page.getByRole("heading", { name: "Demand and workflow fit", exact: true }) }).first()
      await demand.locator("summary").click()
      await screenshot("evidence")
      const beforeTools = posts.length
      await terminal.getByText("Full review", { exact: true }).click()
      await terminal.getByText("Pilot plan", { exact: true }).click()
      assert.match(await terminal.innerText(), /Proposed decision rule, not a result/)
      await command("/pilot")
      await page.waitForFunction(() => document.activeElement?.textContent === "Pilot plan")
      await command("/valueprop")
      await page.waitForFunction(() => document.activeElement?.textContent === "Value proposition")
      assert.equal(posts.length, beforeTools, "opening a saved pilot/value proposition sent another request")
      await terminal.getByText("Full review", { exact: true }).click()
      if (await terminal.getByLabel("Terminal command").isVisible()) await terminal.getByRole("button", { name: "Commands", exact: true }).click()
      await demand.getByRole("button", { name: "Challenge this finding" }).click()
      await page.waitForFunction(() => document.activeElement?.id === "raf-follow-up")
      const question = "The text says no paid pilot. Separate the specific buyer from willingness to pay."
      await terminal.getByLabel("What should the review reconsider?").fill(question)
      await terminal.getByRole("button", { name: "Recheck this finding" }).click()
      await version(2)
      assert.deepEqual(posts[1].current, sampleSubmissionBefore)
      assert.match(posts[1].challenge, /Demand and workflow fit/)
      assert.match(posts[1].challenge, /Separate the specific buyer/)
      assert.match(await terminal.innerText(), /Rechecked from version 1/)
      assert.match(await terminal.innerText(), /You asked:/)
      await terminal.getByRole("button", { name: "Revise pitch", exact: true }).click()
      await page.waitForFunction(() => document.activeElement?.id === "raf-pitch")
      assert.equal(await terminal.getByLabel("Your pitch", { exact: true }).inputValue(), sampleSubmissionBefore.text)
      await terminal.getByLabel("Your pitch", { exact: true }).fill(sampleSubmissionEvidence.text)
      await screenshot("revision")
      await terminal.getByRole("button", { name: "Compare revision", exact: true }).click()
      await version(3)
      assert.deepEqual(posts[2].previous, sampleSubmissionBefore)
      assert.equal(posts[2].challenge, question)
      await terminal.getByRole("heading", { name: "Mixed changes", exact: true }).waitFor()
      assert.match(await terminal.innerText(), /Added support: 1/)
      assert.match(await terminal.innerText(), /What is still unknown/)
      await terminal.locator("summary").filter({ hasText: "Limited payment support" }).click()
      await screenshot("comparison")
      const markdown = await downloadText(page, terminal.getByRole("button", { name: "Export review as Markdown" }), `${name}-review.md`)
      assert.match(markdown, /two paid pilots/)
      assert.match(markdown, /Review conversation/)
      assert.match(markdown, /Separate the specific buyer/)
      await terminal.locator("summary").filter({ hasText: "Review record" }).click()
      const record = JSON.parse(await downloadText(page, terminal.getByRole("button", { name: "Export evidence record (JSON)" }), `${name}-record.json`))
      assert.equal(record.followUp.sourceVersion, 2)
      assert.equal(record.followUp.question, question)
      assert.equal(record.changeCounts.support_added, 1)
      assert.ok(record.sources.some((source) => source.id.startsWith("v1:")))
      assert.ok(record.sources.some((source) => source.id.startsWith("v2:")))
      // Selecting an older reviewed version establishes that version as the baseline.
      const firstVersion = await terminal.getByLabel("Review version").locator("option").first().getAttribute("value")
      await terminal.getByLabel("Review version").selectOption(firstVersion)
      await terminal.getByRole("button", { name: "Revise pitch", exact: true }).click()
      assert.equal(await terminal.getByLabel("Your pitch", { exact: true }).inputValue(), sampleSubmissionBefore.text)
      await terminal.getByLabel("Your pitch", { exact: true }).fill(sampleSubmissionWording.text)
      await terminal.getByRole("button", { name: "Compare revision", exact: true }).click()
      await version(4)
      await terminal.getByRole("heading", { name: "Wording only", exact: true }).waitFor()
      assert.match(await terminal.innerText(), /Added support: 0/)
      assert.match(await terminal.innerText(), /Wording changes: 1/)
      await terminal.getByRole("button", { name: "Revise pitch", exact: true }).click()
      const changedDraft = sampleSubmissionWording.text + "\n\nNext test: observe another parts handoff."
      await terminal.getByLabel("Your pitch", { exact: true }).fill(changedDraft)
      const beforeFresh = posts.length
      await command("/pilot")
      assert.equal(posts.length, beforeFresh, "changed-draft /pilot must explain before sending")
      assert.match(await terminal.getByRole("status").innerText(), /fresh review/)
      await terminal.getByText("Options", { exact: true }).click()
      await terminal.getByLabel("Provider", { exact: true }).selectOption("gemini")
      assert.equal(await terminal.locator("#raf-consent").isChecked(), false, "provider change kept consent to a different recipient")
      assert.equal(await terminal.getByRole("button", { name: "Analyze pitch", exact: true }).isDisabled(), true)
      await terminal.locator("#raf-consent").check()
      responseMode = "hold"
      const pending = page.waitForRequest((request) => request.url().endsWith("/api/raf-os") && request.method() === "POST")
      await terminal.getByRole("button", { name: "Analyze pitch", exact: true }).click()
      await pending
      assert.equal(posts.at(-1).provider, "gemini")
      assert.equal(posts.at(-1).action, "pilot")
      await page.locator('[data-window-id="startup"]').getByRole("button", { name: "Minimize RAF OS TERMINAL", exact: true }).click()
      await terminal.waitFor({ state: "hidden" })
      await page.locator('[data-window-task="startup"]').click()
      await terminal.getByRole("button", { name: "Cancel request", exact: true }).waitFor()
      assert.equal(await terminal.getByLabel("Your pitch", { exact: true }).inputValue(), changedDraft, "minimize lost the in-progress draft")
      const failed = page.waitForEvent("requestfailed", { predicate: (request) => request.url().endsWith("/api/raf-os") })
      await terminal.getByRole("button", { name: "Cancel request", exact: true }).click()
      await failed
      await heldRoute.abort().catch(() => {})
      heldRoute = null
      assert.equal(await terminal.getByLabel("Your pitch", { exact: true }).inputValue(), changedDraft)
      assert.equal(await terminal.getByLabel("Review version").locator("option").count(), 4)
      responseMode = "error"
      await terminal.getByRole("button", { name: "Analyze pitch", exact: true }).click()
      await terminal.getByRole("alert").filter({ hasText: "Your draft is preserved" }).waitFor()
      assert.equal(await terminal.getByLabel("Your pitch", { exact: true }).inputValue(), changedDraft)
      await screenshot("recoverable-error")
      await checkBounds()
      responseMode = "normal"
      await terminal.getByRole("button", { name: "Analyze pitch", exact: true }).click()
      await version(5)
      await page.waitForFunction(() => document.activeElement?.textContent === "Pilot plan")
      assert.equal(posts.at(-1).current.text, changedDraft, "retry lost the preserved input")
      if (!mobile) {
        // Advanced users can compare two supplied drafts without buying an initial review.
        const beforeManual = posts.length
        await page.reload({ waitUntil: "domcontentloaded" })
        await terminal.getByLabel("Your pitch", { exact: true }).waitFor()
        assert.equal(await terminal.getByLabel("Your pitch", { exact: true }).inputValue(), "", "refresh retained pitch data")
        await terminal.getByLabel("Your pitch", { exact: true }).fill(sampleSubmissionEvidence.text)
        await terminal.getByText("Options", { exact: true }).click()
        await terminal.getByText("Compare two drafts", { exact: true }).click()
        await terminal.getByLabel("Paste or upload a separate earlier version").check()
        await terminal.getByLabel("Earlier pitch", { exact: true }).fill(sampleSubmissionBefore.text)
        await terminal.locator("#raf-consent").check()
        await terminal.getByRole("button", { name: "Compare revision", exact: true }).click()
        await version(1)
        await terminal.getByRole("heading", { name: "Mixed changes", exact: true }).waitFor()
        assert.equal(posts.length, beforeManual + 1)
        assert.equal(posts.at(-1).action, "compare")
        assert.deepEqual(posts.at(-1).previous, sampleSubmissionBefore)
      }
      assert.deepEqual(errors, [], `${name} runtime errors`)
      console.info(`RAF OS ${name}: consent, PDF, review, evidence, zero-request details, challenge, revision, comparison, exports, routing, cancellation and recovery passed`)
    } catch (error) {
      await screenshot("failure").catch(() => {})
      throw error
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}
