/** Resolution-independent, original artwork. The saved recipe reproduces the actual pulled layers. */
import { PRINT_PALETTES } from './print-core.js'
export function drawPrintArt(ctx, design, layers = null, active = null, guides = false) {
  const w = ctx.canvas.width, h = ctx.canvas.height
  ctx.save(); ctx.setTransform(w / 600, 0, 0, h / 720, 0, 0); ctx.clearRect(0, 0, 600, 720)
  ctx.fillStyle = '#d3c8b3'; ctx.fillRect(0, 0, 600, 720)
  const paper = { x: 66, y: 52, w: 468, h: 610 }
  if (design.format === 'sleeve') { paper.y = 118; paper.h = 468 }
  ctx.fillStyle = '#f4ecda'; ctx.shadowColor = '#31281b35'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4
  if (design.format === 'shirt') { ctx.beginPath(); ctx.moveTo(185, 75); ctx.lineTo(110, 110); ctx.lineTo(50, 220); ctx.lineTo(133, 258); ctx.lineTo(160, 220); ctx.lineTo(160, 646); ctx.lineTo(440, 646); ctx.lineTo(440, 220); ctx.lineTo(467, 258); ctx.lineTo(550, 220); ctx.lineTo(490, 110); ctx.lineTo(415, 75); ctx.quadraticCurveTo(300, 160, 185, 75); ctx.fill(); paper.x = 176; paper.y = 198; paper.w = 248; paper.h = 340 }
  else ctx.fillRect(paper.x, paper.y, paper.w, paper.h)
  ctx.shadowColor = 'transparent'
  const colors = PRINT_PALETTES[design.palette]
  for (let layer = 0; layer < 2; layer++) {
    const spec = layers?.[layer] || (active?.layer === layer ? active : null)
    if (layers && !spec) continue
    ctx.save(); ctx.beginPath(); ctx.rect(paper.x, paper.y, paper.w, paper.h); ctx.clip()
    const offset = spec?.offset || { x: 0, y: 0 }, rows = spec?.coverage || Array(48).fill(1)
    for (let row = 0; row < 48; row++) {
      if (rows[row] <= 0) continue
      const top = Math.floor(paper.y + paper.h * row / 48), bottom = Math.floor(paper.y + paper.h * (row + 1) / 48)
      ctx.save(); ctx.beginPath(); ctx.rect(paper.x, top, paper.w, bottom - top); ctx.clip(); ctx.globalAlpha = rows[row]
      ctx.translate(paper.x + offset.x, paper.y + offset.y); ctx.scale(paper.w / 468, paper.h / 610)
      ctx.fillStyle = colors[layer]; ctx.strokeStyle = colors[layer]; ctx.lineWidth = 3
      if (layer === 0) {
        ctx.fillRect(28, 27, 412, 5); ctx.font = 'bold 11px sans-serif'; ctx.fillText('NEIGHBORHOOD EDITIONS    /    BROOKLYN, NY', 29, 51)
        ctx.font = '900 45px sans-serif'
        const words = design.title.toUpperCase().split(/\s+/); let line = '', y = 112
        for (const word of words) { if (ctx.measureText(line + ' ' + word).width > 405 && line) { ctx.fillText(line, 28, y); line = word; y += 47 } else line += (line ? ' ' : '') + word }
        ctx.fillText(line, 28, y)
        if (design.motif === 'sound-system') for (const x of [138, 330]) { ctx.beginPath(); ctx.arc(x, 345, 84, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - 84, 445, 168, 18) }
        else if (design.motif === 'city-grid') for (let col = 0; col < 6; col++) for (let row = 0; row < 4; row++) ctx.fillRect(30 + col * 70, 260 + row * 51, 54, 37)
        else { ctx.lineWidth = 9; ctx.strokeRect(53, 238, 362, 250); ctx.beginPath(); ctx.moveTo(234, 238); ctx.lineTo(234, 488); ctx.stroke(); ctx.beginPath(); ctx.arc(234, 363, 65, 0, Math.PI * 2); ctx.stroke() }
        ctx.font = 'bold 15px sans-serif'; ctx.fillText('SOUND / SPORT / PEOPLE / PRINT', 29, 551); ctx.font = '12px sans-serif'; ctx.fillText('PULLED BY HAND. MADE IN THE NEIGHBORHOOD.', 29, 575)
      } else {
        ctx.translate(234, 356); ctx.rotate(-.22)
        if (design.motif === 'sound-system') { ctx.lineWidth = 5; for (const x of [-96, 96]) for (const r of [18, 36, 57]) { ctx.beginPath(); ctx.arc(x, 0, r, 0, Math.PI * 2); ctx.stroke() } }
        else if (design.motif === 'city-grid') { ctx.fillRect(-220, -17, 440, 34); ctx.font = '900 26px sans-serif'; ctx.fillText('KEEP THE BLOCK MOVING', -179, 76) }
        else { ctx.beginPath(); ctx.arc(72, -31, 49, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-192, 107, 360, 19) }
        ctx.setTransform(w / 600, 0, 0, h / 720, 0, 0); ctx.translate(paper.x + offset.x, paper.y + offset.y); ctx.scale(paper.w / 468, paper.h / 610)
        ctx.fillRect(29, 190, 93, 25); ctx.fillStyle = '#f4ecda'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('LIVE / LOCAL', 36, 207)
      }
      ctx.restore()
    }
    ctx.restore()
  }
  if (guides) {
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#393e35'
    for (const x of [paper.x - 10, paper.x + paper.w + 10]) for (const y of [paper.y - 10, paper.y + paper.h + 10]) { ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke() }
    if (active) { ctx.strokeStyle = '#de5339'; for (const x of [paper.x - 10, paper.x + paper.w + 10]) for (const y of [paper.y - 10, paper.y + paper.h + 10]) { ctx.beginPath(); ctx.arc(x + active.offset.x, y + active.offset.y, 5, 0, Math.PI * 2); ctx.stroke() } }
  }
  ctx.restore()
  return paper
}
