/** Optional evidence capture of the game's WebAudio mix; no game-state writes. */
import fs from 'node:fs/promises'
export async function captureGameAudio(context) {
  await context.addInitScript(() => {
    const captures = [], contexts = new WeakSet(), connect = AudioNode.prototype.connect
    window.__gameAudioEvidence = captures
    AudioNode.prototype.connect = function(destination, ...args) {
      const result = connect.call(this, destination, ...args)
      if (destination instanceof AudioDestinationNode && !contexts.has(this.context)) {
        contexts.add(this.context)
        try {
          const sink = this.context.createMediaStreamDestination()
          connect.call(this, sink)
          const recorder = new MediaRecorder(sink.stream, {mimeType:'audio/webm;codecs=opus', audioBitsPerSecond:48000})
          const capture = {recorder, chunks:[], beganAt:Date.now()}
          recorder.ondataavailable = event => { if(event.data.size)capture.chunks.push(event.data) }
          captures.push(capture); recorder.start(1000)
        } catch (error) { captures.push({error:String(error)}) }
      }
      return result
    }
  })
}
export async function saveGameAudio(page, directory) {
  const captures = await page.evaluate(async () => Promise.all((window.__gameAudioEvidence || []).map(async capture => {
    if(capture.error)return {error:capture.error}
    const stopped=new Promise(resolve=>capture.recorder.addEventListener('stop',resolve,{once:true}))
    capture.recorder.stop();await stopped
    const bytes=new Uint8Array(await new Blob(capture.chunks).arrayBuffer())
    return {beganAt:capture.beganAt,bytes:Array.from(bytes)}
  })))
  const result=[]
  for(let i=0;i<captures.length;i++){
    const {bytes,...metadata}=captures[i]
    if(bytes){metadata.file=directory+`/game-audio-${i}.webm`;await fs.writeFile(metadata.file,Buffer.from(bytes));metadata.bytes=bytes.length}
    result.push(metadata)
  }
  return result
}
