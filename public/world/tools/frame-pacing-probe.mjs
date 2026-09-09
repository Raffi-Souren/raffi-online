#!/usr/bin/env node
/** Distinguish an actual scene cost from browser/window requestAnimationFrame pacing. */
import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const out = process.env.RAFFI_PACING_OUT || '/tmp/raffi-frame-pacing'
await fs.mkdir(out, { recursive:true })
const report = { description:'Same 1440x900 viewport and Apple Metal launch flags as the game route. Ten seconds of animated DOM and ten seconds of a bare WebGL2 clear, each after two seconds warmup. No Three.js, world geometry, game simulation, frame-rate override or throttling flags. Frame intervals measure browser delivery, not GPU execution.', runs:[] }
const quantile=(values,q)=>[...values].sort((a,b)=>a-b)[Math.floor(values.length*q)]
try {
  for (const headless of [true,false]) {
    const browser=await chromium.launch({headless,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=metal']})
    try {
      const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1})
      const page=await context.newPage()
      for(const mode of ['dom','webgl-clear']){
        await page.setContent('<!doctype html><title>Raffi World frame pacing diagnostic</title><style>body{margin:0;background:#19362e;color:#eee7d8;font:22px system-ui}p{position:absolute;left:35px;top:25px}canvas{display:block;width:100vw;height:100vh}</style><canvas width="1440" height="900"></canvas><p>Checking browser frame pacing</p>')
        await page.bringToFront()
        const result=await page.evaluate(async(mode)=>{
          const canvas=document.querySelector('canvas'),label=document.querySelector('p'),gl=mode==='webgl-clear'?canvas.getContext('webgl2'):null
          if(mode==='webgl-clear'&&!gl)throw new Error('No WebGL2 context')
          const ext=gl?.getExtension('WEBGL_debug_renderer_info')
          const gpu=gl?gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER):null
          const samples=[],started=performance.now();let previous=started
          await new Promise(resolve=>{
            function frame(now){
              label.style.transform=`translateX(${Math.sin(now/200)*20}px)`
              if(gl){gl.clearColor(.07,.16+.01*Math.sin(now/300),.13,1);gl.clear(gl.COLOR_BUFFER_BIT)}
              if(now-started>=2000)samples.push({ms:now-previous,focused:document.hasFocus(),visible:document.visibilityState==='visible'})
              previous=now
              if(now-started<12000)requestAnimationFrame(frame);else resolve()
            }
            requestAnimationFrame(frame)
          })
          return {samples,gpu,screen:{width:screen.width,height:screen.height,availWidth:screen.availWidth,availHeight:screen.availHeight,devicePixelRatio,innerWidth,innerHeight,outerWidth,outerHeight},canvas:[canvas.width,canvas.height]}
        },mode)
        const intervals=result.samples.map(sample=>sample.ms).filter(ms=>ms>0)
        const run={headless,mode,browser:browser.version(),gpu:result.gpu,screen:result.screen,frames:intervals.length,medianMs:quantile(intervals,.5),p95Ms:quantile(intervals,.95),p99Ms:quantile(intervals,.99),framesOver50ms:intervals.filter(ms=>ms>50).length,foregroundFraction:result.samples.filter(s=>s.focused&&s.visible).length/result.samples.length}
        if(!headless)assert.equal(run.foregroundFraction,1,'baseline lost focus or visibility')
        report.runs.push(run)
        await fs.writeFile(`${out}/${headless?'headless':'foreground'}-${mode}-raw.json`,JSON.stringify(result,null,2))
        await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2))
        process.stdout.write(JSON.stringify(run)+'\n')
      }
      await context.close()
    }finally{await browser.close()}
  }
}finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2))}
