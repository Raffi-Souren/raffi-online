/** Original Web Audio instruments, driven by the six authored radio patterns.
 * The audio clock schedules ahead of rendering. No downloaded recordings.
 */
import { data, state, bus, clamp } from './state.js'
import { normalizeVolume, stepFootsteps, vehicleMotorSignature } from './audio-core.js'

let context, master, music, engine, ambience, filter, analyser, noise
let motor, motorGain, motorFilter, windGain, hum, humGain
let stationId = null, step = 0, nextStep = 0, beatOrigin = 0
let active = true, muted = false, timer = null, hostMusicPlaying = false
let voices = 0
let volume = 1, settingsLoaded = false, footstepState = null, lastSurface = null
const NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], minorPentatonic: [0, 3, 5, 7, 10], hijaz: [0, 1, 4, 5, 7, 8, 10] }

function loadVolume() {
  if (settingsLoaded) return
  settingsLoaded = true
  try { volume = normalizeVolume(localStorage.getItem('raffi-world-volume'), 1) } catch {}
}
export function getVolume() { loadVolume(); return volume }
export function setVolume(value) {
  loadVolume(); volume = normalizeVolume(value, volume)
  try { localStorage.setItem('raffi-world-volume', String(volume)) } catch {}
  if (context) updateAudio()
  bus.emit('audio-volume-changed', volume)
  return volume
}

export async function unlockAudio() {
  loadVolume()
  if (state.storyPlayingMusic) active = true
  if (!context) {
    const Audio = window.AudioContext || window.webkitAudioContext
    if (!Audio) return false
    context = new Audio({ latencyHint: 'interactive' })
    master = context.createGain()
    master.gain.value = 0
    const limiter = context.createDynamicsCompressor()
    limiter.threshold.value = -12
    limiter.ratio.value = 8
    analyser = context.createAnalyser()
    analyser.fftSize = 256
    master.connect(limiter).connect(analyser).connect(context.destination)
    music = context.createGain()
    filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    music.connect(filter).connect(master)
    engine = context.createGain()
    engine.connect(master)
    ambience = context.createGain()
    ambience.connect(master)
    noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
    const samples = noise.getChannelData(0)
    // Seeded noise gives stable spectrum without any external sound assets.
    let seed = 71
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      samples[i] = (seed / 0xffffffff) * 2 - 1
    }
    motor = context.createOscillator()
    motor.type = 'sawtooth'
    motorGain = context.createGain()
    motorGain.gain.value = 0
    motorFilter = context.createBiquadFilter()
    motorFilter.frequency.value = 280
    motor.connect(motorFilter).connect(motorGain).connect(engine)
    motor.start()
    const wind = context.createBufferSource()
    wind.buffer = noise
    wind.loop = true
    const windFilter = context.createBiquadFilter()
    windFilter.frequency.value = 430
    windGain = context.createGain()
    windGain.gain.value = 0
    wind.connect(windFilter).connect(windGain).connect(ambience)
    wind.start()
    hum = context.createOscillator()
    hum.type = 'sine'
    humGain = context.createGain()
    humGain.gain.value = 0
    hum.connect(humGain).connect(ambience)
    hum.start()
    try { muted = localStorage.getItem('raffi-world-muted') === '1' } catch {}
    bus.on('sfx', playSfx)
    bus.on('pursuit', (event) => { if (event.type === 'caught') playSfx('ui-deny') })
    bus.on('mission-complete', () => playSfx('compliance-clear'))
    timer = setInterval(schedule, Math.max(20, (data.radio.clock.lookaheadMs || 120) / 4))
  }
  if (active && context.state === 'suspended') await context.resume().catch(() => {})
  return context.state === 'running'
}

function voice(config, hz, when, output, scale = 1) {
  if (!context || voices >= 80) return
  const duration = Math.max(0.02, Math.min(3, config.decay || 0.15))
  const source = config.type === 'noise' ? context.createBufferSource() : context.createOscillator()
  if (config.type === 'noise') source.buffer = noise
  else {
    source.type = ['sine', 'square', 'sawtooth', 'triangle'].includes(config.type) ? config.type : 'sine'
    source.frequency.setValueAtTime(hz * (config.pitchEnv || 1), when)
    if (config.pitchEnv) source.frequency.exponentialRampToValueAtTime(Math.max(20, hz), when + Math.min(0.1, duration))
    if (config.slideTo) source.frequency.exponentialRampToValueAtTime(config.slideTo, when + duration * 0.8)
  }
  const envelope = context.createGain()
  const level = Math.min(0.22, (config.gain || 0.15) * 0.12 * scale)
  envelope.gain.setValueAtTime(0.0001, when)
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), when + 0.004)
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration)
  let tone = null
  if (config.lpf || config.hpf || config.bpf) {
    tone = context.createBiquadFilter()
    tone.type = config.hpf ? 'highpass' : config.bpf ? 'bandpass' : 'lowpass'
    tone.frequency.value = config.hpf || config.bpf || config.lpf
    tone.Q.value = config.q || 0.7
    source.connect(tone).connect(envelope)
  } else source.connect(envelope)
  envelope.connect(output)
  voices++
  source.onended = () => { voices--; source.disconnect(); envelope.disconnect(); tone?.disconnect() }
  source.start(when)
  source.stop(when + duration + 0.02)
}

function currentStation() {
  return state.storyPlayingMusic ? data.radio.stations.find(station => station.id === state.storyMusic?.station) || data.radio.stations[0] : data.radio.stations[state.radio.stationIndex]
}
function schedule() {
  if (!context || context.state !== 'running' || !active || muted || volume === 0 || (!state.radio.on && !state.storyPlayingMusic) || (state.paused && !state.storyPlayingMusic)) return
  const station = currentStation()
  if (!station) return
  if (stationId !== station.id) {
    stationId = station.id
    step = 0
    nextStep = context.currentTime + 0.03
    beatOrigin = nextStep
  }
  if (nextStep < context.currentTime - 0.1) nextStep = context.currentTime + 0.02
  const interval = 60 / (state.storyPlayingMusic ? state.storyMusic.bpm : station.bpm) / 4
  const horizon = context.currentTime + (data.radio.clock.scheduleAheadSec || 0.22)
  while (nextStep < horizon) {
    for (const [name, part] of Object.entries(station.synth || {})) {
      if (!part?.steps || part.steps[step % part.steps.length] !== '1') continue
      const root = (NOTES[station.key] || 0) + ((part.octave ?? 2) + 1) * 12
      const scale = SCALES[station.scale] || SCALES.minor
      const noteIndex = part.notes?.[Math.floor(step / 4) % part.notes.length] ?? 0
      const notes = part.voicing || [scale[noteIndex % scale.length] + Math.floor(noteIndex / scale.length) * 12]
      for (const note of notes) {
        const hz = part.hz || 440 * 2 ** ((root + note - 69) / 12)
        voice(part, hz, nextStep, music, name === 'chord' ? 1 / Math.sqrt(notes.length) : 1)
      }
    }
    nextStep += interval
    step++
  }
}

export function setHostMusicPlaying(playing) { hostMusicPlaying = !!playing }
export function requestMusicFocus() {
  if (window.parent !== window) window.parent.postMessage({ type: 'raffi-world:audio-focus', action: 'radio' }, location.origin)
}
export function resetAudioTransport() { stationId = null; step = 0; beatOrigin = 0; nextStep = 0 }

export function audioBeat() {
  if (state.storyPlayingMusic || !context || context.state !== 'running' || !state.radio.on || stationId !== data.radio.stations[state.radio.stationIndex]?.id) return null
  return Math.max(0, context.currentTime - beatOrigin) * state.radio.bpm / 60
}

export function setAudioActive(on) {
  active = !!on
  if (!context) return
  if (!active && context.state === 'running') void context.suspend().catch(() => {})
  else if (active && context.state === 'suspended') void context.resume().catch(() => {})
}

export function updateAudio({ dialogue = false, vehicle = null } = {}) {
  if (!context) return
  const footsteps = stepFootsteps(footstepState, state.player, active && !state.paused && !document.hidden && state.mode === 'foot', data.radio.footsteps)
  footstepState = footsteps.state
  const surface = data.radio.footsteps.surfaces[state.interior?.id] || data.radio.footsteps.defaultSurface
  for (let i = 0; i < footsteps.count; i++) { playSfx('footstep-' + surface); lastSurface = surface }
  const now = context.currentTime
  master.gain.setTargetAtTime(muted || !active || (state.paused && !state.storyPlayingMusic && !state.sportsPlayingSound) ? 0 : (data.radio.mix.masterGain || 0.55) * volume, now, 0.045)
  const quiet = state.paused ? 0 : 1
  const bed = data.radio.ambient[state.interior?.id || state.district] || data.radio.ambient.heights
  windGain.gain.setTargetAtTime((bed.wind + bed.traffic) * 0.12 * quiet, now, 0.5)
  humGain.gain.setTargetAtTime(bed.hum * 0.055 * quiet, now, 0.5)
  hum.frequency.setTargetAtTime(bed.tone, now, 0.5)
  const mounted = !state.paused && state.mode === 'vehicle' && vehicle?.kind !== 'skateboard'
  const signature = vehicleMotorSignature(data.vehicles?.archetypes[vehicle?.archetypeId]?.sound, state.player.speed, vehicle?.throttle || 0)
  if (motor.type !== signature.wave) motor.type = signature.wave
  motorGain.gain.setTargetAtTime(mounted ? signature.gain : 0, now, 0.15)
  motor.frequency.setTargetAtTime(signature.hz, now, 0.1)
  motorFilter.frequency.setTargetAtTime(signature.cutoff, now, .18)
  filter.frequency.setTargetAtTime(mounted ? 11000 : data.radio.mix.outOfVehicleMuffle.hz, now, 0.2)
  music.gain.setTargetAtTime((state.storyPlayingMusic || (!state.paused && state.radio.on)) && !hostMusicPlaying ? (dialogue ? data.radio.mix.duckUnderDialogue : 1) : 0, now, dialogue ? 0.08 : 0.3)
}

export function playSfx(id) {
  const config = data.radio?.sfx?.[id]
  if (!context || context.state !== 'running' || !active || muted || !config) return
  const now = context.currentTime + 0.005
  for (const [i, note] of (config.arp || [0]).entries()) voice(config, (config.hz || 220) * 2 ** (note / 12), now + i * 0.08, master, 1.3)
}

export function toggleMute() {
  muted = !muted
  try { localStorage.setItem('raffi-world-muted', muted ? '1' : '0') } catch {}
  updateAudio()
  return muted
}

export function audioSnapshot() {
  let rms = 0
  if (analyser) {
    const sample = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(sample)
    rms = Math.sqrt(sample.reduce((sum, value) => sum + value * value, 0) / sample.length)
  }
  return { supported: !!(window.AudioContext || window.webkitAudioContext), state: context?.state || 'locked', muted, volume: getVolume(), footsteps: footstepState?.total || 0, footstepSurface: lastSurface, hostMusicPlaying, station: stationId, step, voices, rms: clamp(rms, 0, 1), scheduled: timer !== null }
}
