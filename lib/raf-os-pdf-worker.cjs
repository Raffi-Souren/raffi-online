const { parentPort, workerData } = require("node:worker_threads")
// The self-contained distribution needs no runtime dependency resolution in the
// isolated deployment. next.config.mjs includes this file and the distribution.
const { PDFDocument, ParseSpeeds } = require("../node_modules/pdf-lib/dist/pdf-lib.min.js")

;(async () => {
  try {
    const pdf = await PDFDocument.load(workerData, {
      ignoreEncryption: false,
      throwOnInvalidObject: true,
      parseSpeed: ParseSpeeds.Slow,
      updateMetadata: false,
    })
    parentPort.postMessage(pdf.isEncrypted ? null : pdf.getPageCount())
  } catch {
    // Parser errors and warnings can contain PDF content. Only this fixed result
    // crosses the message channel; the parent discards the worker's log streams.
    parentPort.postMessage(null)
  }
})()
