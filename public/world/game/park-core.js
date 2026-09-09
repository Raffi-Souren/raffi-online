/** Shared authored park footprints. Geometry and collision consume the same segments. */
export const PARK_FENCES = [
  { x1: -357, z1: -436, x2: -270, z2: -436 },
  { x1: -357, z1: -407, x2: -353, z2: -407 },
  { x1: -347, z1: -407, x2: -318, z2: -407 },
  { x1: -303, z1: -407, x2: -285, z2: -407 },
  { x1: -276, z1: -407, x2: -270, z2: -407 },
  { x1: -357, z1: -436, x2: -357, z2: -407 },
  { x1: -343, z1: -436, x2: -343, z2: -407 },
  { x1: -270, z1: -436, x2: -270, z2: -407 },
]
export const PARK_BENCHES = [{ x: -337, z: -409 }, { x: -290, z: -409 }]
export const PARK_ENTRANCES = [{ x: -350, z: -407 }, { x: -310, z: -407 }, { x: -280, z: -407 }]
export const PARK_LOCALS = [
  { id: 'park:nico', appearanceId: 'noah', archetype: 'jogger', role: 'tennis-practice', locomotionStyle: 'light', from: { x: -352, z: -427.5 }, to: { x: -348, z: -427.5 }, speed: 1.35, pause: 2.5, yaw: 0 },
  { id: 'park:imani', appearanceId: 'inez', archetype: 'commuter', role: 'bench-spectator', locomotionStyle: 'relaxed', from: { x: -290, z: -409 }, to: { x: -290, z: -409 }, speed: 0, pause: 8, yaw: Math.PI },
  { id: 'park:rosa', appearanceId: 'rosa', archetype: 'jogger', role: 'shadowboxing', locomotionStyle: 'balanced', from: { x: -281.2, z: -420 }, to: { x: -279.6, z: -420 }, speed: .65, pause: 3, yaw: Math.PI / 2 },
]
export function parkColliders() {
  return [
    ...PARK_FENCES.map(f => ({ type: 'box', x: (f.x1+f.x2)/2, z: (f.z1+f.z2)/2, hx: Math.abs(f.x2-f.x1)/2+.045, hz: Math.abs(f.z2-f.z1)/2+.045, tag: 'park-fence' })),
    ...PARK_BENCHES.map(b => ({ type: 'box', x: b.x, z: b.z, hx: 1.55, hz: .4, tag: 'park-bench' })),
    { type: 'box', x: -350, z: -421, hx: 4.8, hz: .07, tag: 'tennis-net' },
    ...[-325,-295].flatMap(x => [-425,-419].map(z => ({ type: 'circle', x, z, r: .1, tag: 'soccer-goal' }))),
    ...[-283.5,-276.5].flatMap(x => [-423.5,-416.5].map(z => ({ type: 'circle', x, z, r: .12, tag: 'boxing-post' }))),
  ]
}
export function createParkLocal(spec) { return { x: spec.from.x, z: spec.from.z, destination: 1, wait: spec.pause, yaw: spec.yaw, speed: 0, action: spec.role === 'bench-spectator' ? 'sit' : 'talk' } }
export function stepParkLocal(run, spec, dt) {
  if(!Number.isFinite(dt)||dt<=0)return run
  dt=Math.min(dt,.05)
  run.speed=0
  if(run.wait>0){run.wait=Math.max(0,run.wait-dt);run.yaw=spec.yaw;run.action=spec.role==='bench-spectator'?'sit':'talk';return run}
  const target=run.destination?spec.to:spec.from,dx=target.x-run.x,dz=target.z-run.z,d=Math.hypot(dx,dz)
  if(d<.02){run.wait=spec.pause;run.destination=1-run.destination;return run}
  const distance=Math.min(d,spec.speed*dt);run.x+=dx/d*distance;run.z+=dz/d*distance;run.yaw=Math.atan2(dx,dz);run.speed=distance/dt;run.action='walk'
  return run
}
