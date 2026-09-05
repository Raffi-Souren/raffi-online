import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { canonicalJson, RAF_CANONICAL } = require("../.test-build/lib/raf-os-canonical.js")
const { validateCritique, comparisonVerdict, CHANGE_LABELS, RAF_RUBRIC } = require("../.test-build/lib/raf-os.js")

// Offline verification reuses the shipped contract. It does not call the model.
try {
  if (!process.argv[2]) throw new Error("Usage: npm run verify:raf-os -- /path/to/raf-os-review-record.json")
  const bytes = await readFile(process.argv[2])
  if (bytes.length > 3 * 1024 * 1024) throw new Error("Record exceeds the 3 MB verification limit.")
  const record = JSON.parse(bytes.toString("utf8"))
  if (record.rubric !== RAF_RUBRIC) throw new Error("This record requires a different rubric version.")
  if (record.audit?.canonicalization !== RAF_CANONICAL) throw new Error("Unknown or missing canonical format.")
  const hash = createHash("sha256").update(canonicalJson(record.result)).digest("hex")
  if (hash !== record.audit.outputSha256) throw new Error("The output hash does not match the review.")
  if (!Array.isArray(record.sources) || record.sources.some(s => !s || typeof s.id !== "string" || typeof s.label !== "string" || (s.text !== null && typeof s.text !== "string"))) throw new Error("Invalid source index.")
  if (new Set(record.sources.map(s => s.id)).size !== record.sources.length) throw new Error("Duplicate source IDs.")
  const result = validateCritique(record.result, record.sources, record.result.changes.length > 0)
  const counts = Object.fromEntries(Object.keys(CHANGE_LABELS).map(kind => [kind, result.changes.filter(c => c.kind === kind).length]))
  if (canonicalJson(counts) !== canonicalJson(record.changeCounts)) throw new Error("Change counts do not match the ledger.")
  if (record.verdict !== comparisonVerdict(result.changes)) throw new Error("Verdict does not match the ledger.")
  process.stdout.write("PASS: output hash, response contract, source references, text quotations, change counts and verdict.\n")
  process.stdout.write("Unchecked: original input/model-request hashes without original payloads, PDF quotations, business facts, authorship and model judgment. A rewritten bundle can be rehashed.\n")
} catch (error) {
  process.stderr.write(`FAIL: ${error instanceof Error ? error.message : "Invalid record"}\n`)
  process.exitCode = 1
}
