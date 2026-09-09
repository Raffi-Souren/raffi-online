import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { trafficNetwork, trafficPath, trafficPose, createTrafficFleet, stepTraffic, claimTrafficCar, trafficSummary } from '../game/traffic-core.js'
globalThis.location = { search: '' }; globalThis.matchMedia = () => ({ matches: false }); globalThis.window = { devicePixelRatio: 1 }; globalThis.screen = { width: 1280, height: 720 }
const { buildRoadGraph, isOnRoad } = await import('../gen/roads.js')
const read = (id) => JSON.parse(fs.readFileSync(new URL(`../data/${id}.json`, import.meta.url), 'utf8'))
const cfg = read('traffic'), world = read('world'), graph = buildRoadGraph(world)
function overlap(a, b) {
  for (const yaw of [a.yaw, b.yaw]) {
    for (const [x, z] of [[Math.sin(yaw), Math.cos(yaw)], [Math.cos(yaw), -Math.sin(yaw)]]) {
      const extent = (c) => Math.abs(x * Math.sin(c.yaw) + z * Math.cos(c.yaw)) * c.length / 2 + Math.abs(x * Math.cos(c.yaw) - z * Math.sin(c.yaw)) * c.width / 2
      if (Math.abs((a.x - b.x) * x + (a.z - b.z) * z) >= extent(a) + extent(b) - 0.03) return false
    }
  }
  return true
}

test('lane paths honor the connected local street, authored width and smooth intersection joins', () => {
  const network = trafficNetwork(graph)
  const path = trafficPath(network, '-489|-145', '-400|-145', '-400|-120', cfg)
  assert.ok(path); assert.equal(path.edge.halfWidth, 3.6)
  assert.ok(Math.abs(path.points[0].z + 145) <= path.edge.halfWidth - 0.9)
  const after = trafficPath(network, '-400|-145', '-400|-120', '-260|-120', cfg)
  const exit = trafficPose(path, path.length), enter = trafficPose(after, 0)
  assert.ok(Math.hypot(exit.x - enter.x, exit.z - enter.z) < 0.001)
  for (let t = 0; t < path.length; t += 0.25) { const p = trafficPose(path, t); assert.ok(Number.isFinite(p.yaw)); assert.ok(isOnRoad(graph, p.x, p.z, 0.2), JSON.stringify(p)) }
})

test('street fleet is bounded, seeded and places distinct cars onto connected directed lanes', () => {
  const first = createTrafficFleet(graph, cfg, 'test'), second = createTrafficFleet(graph, cfg, 'test')
  assert.equal(first.cars.length, cfg.count.desktop)
  assert.deepEqual(trafficSummary(first), trafficSummary(second))
  assert.deepEqual(first.cars.map((c) => [c.x, c.z, c.path.to]), second.cars.map((c) => [c.x, c.z, c.path.to]))
  for (const car of first.cars) assert.ok(first.network.nodes.get(car.path.to).edges.some((e) => e.a === car.path.next || e.b === car.path.next))
  assert.equal(createTrafficFleet({ segments: [] }, cfg).cars.length, 0)
})

test('traffic yields to a pedestrian then resumes when the crossing clears', () => {
  const fleet = createTrafficFleet(graph, cfg, 'yield', 1), car = fleet.cars[0]
  const pedestrian = { id: 'walker', x: car.x + Math.sin(car.yaw) * 9, z: car.z + Math.cos(car.yaw) * 9, radius: 0.45, type: 'pedestrian' }
  for (let i = 0; i < 160; i++) stepTraffic(fleet, cfg, 0.05, [pedestrian])
  assert.equal(car.speed, 0); assert.equal(car.reason, 'pedestrian'); assert.ok(Math.hypot(car.x - pedestrian.x, car.z - pedestrian.z) > car.length / 2)
  const before = { x: car.x, z: car.z }
  for (let i = 0; i < 80; i++) stepTraffic(fleet, cfg, 0.05)
  assert.ok(Math.hypot(car.x - before.x, car.z - before.z) > 3)
})

test('solid street fixtures block vehicle travel without moving through them', () => {
  const fleet = createTrafficFleet(graph, cfg, 'solid', 1), car = fleet.cars[0], initial = { x: car.x, z: car.z }
  for (let i = 0; i < 100; i++) stepTraffic(fleet, cfg, 0.05, [], () => true)
  assert.equal(car.x, initial.x); assert.equal(car.z, initial.z); assert.equal(car.speed, 0); assert.equal(car.reason, 'obstacle')
})

test('claiming a traffic ride relinquishes AI permanently and releases its intersection', () => {
  const fleet = createTrafficFleet(graph, cfg, 'claim', 1), car = fleet.cars[0]
  fleet.reservations.set(car.path.to, car.id)
  assert.equal(claimTrafficCar(fleet, car.id), true); assert.equal(claimTrafficCar(fleet, car.id), false)
  const position = { x: car.x, z: car.z }
  for (let i = 0; i < 100; i++) stepTraffic(fleet, cfg, 0.05)
  assert.equal(car.x, position.x); assert.equal(car.z, position.z); assert.equal(fleet.reservations.size, 0); assert.equal(trafficSummary(fleet).claimed, 1)
})

test('ten minutes of traffic traverse intersections without vehicle overlap, stale reservations or global gridlock', () => {
  const fleet = createTrafficFleet(graph, cfg, 'long-run')
  let movingSamples = 0
  for (let i = 0; i < 12000; i++) {
    stepTraffic(fleet, cfg, 0.05)
    if (i % 20 !== 0) continue
    const live = fleet.cars.filter((c) => c.active)
    if (live.some((c) => c.speed > 0.5)) movingSamples++
    for (const car of live) { assert.ok(Number.isFinite(car.x + car.z + car.yaw)); assert.ok(car.progress >= 0 && car.progress <= car.path.length + 0.001) }
    for (let a = 0; a < live.length; a++) for (let b = a + 1; b < live.length; b++) assert.equal(overlap(live[a], live[b]), false, `overlap t${fleet.time.toFixed(2)}: ${JSON.stringify([live[a], live[b]])}`)
    for (const [node, owner] of fleet.reservations) assert.ok(live.some((c) => c.id === owner && c.path.to === node))
  }
  const summary = trafficSummary(fleet)
  assert.ok(summary.junctions > 160, JSON.stringify(summary))
  assert.ok(summary.active >= 8, JSON.stringify(summary))
  assert.ok(movingSamples > 570, String(movingSamples))
})

test('shared routes include the largest configured truck and all dimension jitter', async () => {
  const {trafficEnvelope,trafficSegmentClear}=await import('../game/traffic-core.js')
  const archetypes=read('vehicles').archetypes, envelope=trafficEnvelope(archetypes,cfg.archetypes)
  for(const id of cfg.archetypes)for(const axis of ['width','length'])assert.ok(envelope[axis]>=archetypes[id].silhouette[axis]*(1+Math.abs(archetypes[id].jitter?.[axis]||0)))
  assert.ok(envelope.length>=5.8*1.02);assert.ok(envelope.width>=2.12*1.015)
  const segment={ax:0,az:0,bx:40,bz:0,length:40,halfWidth:3.6}
  const oldBody={width:1.9,length:4.6}
  // A narrow post beside the south lane clears a sedan but clips the truck's
  // outer body; the old 4.6x1.9 preflight incorrectly admitted this route.
  const post={x:20,z:1.8+1.10}
  const clear=(pose,body)=>Math.abs(pose.x-post.x)>body.length/2+.03 || Math.abs(pose.z-post.z)>body.width/2+.08
  assert.equal(trafficSegmentClear(segment,cfg,oldBody,clear),true)
  assert.equal(trafficSegmentClear(segment,cfg,envelope,clear),false)
  assert.equal(trafficSegmentClear(segment,cfg,envelope,()=>true),true)
  const network=trafficNetwork({segments:[{...segment,a:'0|0',b:'40|0'}]},s=>trafficSegmentClear(s,cfg,envelope,clear))
  assert.equal(network.edges.size,0,'inadmissible edge is excluded from every route and recycle')
})

test('spawn separation checks actual oriented truck bodies beyond the old 6m threshold', async () => {
  const {trafficBodiesOverlap}=await import('../game/traffic-core.js')
  const truck={x:0,z:0,yaw:0,width:2.15,length:5.916}
  const parked={x:0,z:6.2,yaw:0,mesh:{userData:{width:2.3,length:7.2}}}
  assert.ok(Math.hypot(parked.x-truck.x,parked.z-truck.z)>6)
  assert.equal(trafficBodiesOverlap(truck,parked),true)
  assert.equal(trafficBodiesOverlap(truck,{...parked,z:7.4}),false)
  assert.equal(trafficBodiesOverlap(truck,{...parked,x:3.3,z:0}),false,'safe parallel lane is retained')
  assert.equal(trafficBodiesOverlap(truck,{...parked,x:3.3,z:0,yaw:Math.PI/2}),true,'rotated truck extends into the candidate')
})

test('a mixed truck fleet traverses five simulated minutes without body overlap', async () => {
  const {trafficEnvelope,trafficBodiesOverlap}=await import('../game/traffic-core.js')
  const vehicles=read('vehicles').archetypes, fleet=createTrafficFleet(graph,cfg,'larger-truck-regression')
  for(const [i,car] of fleet.cars.entries())Object.assign(car,trafficEnvelope(vehicles,[cfg.archetypes[i%cfg.archetypes.length]]))
  for(let i=0;i<fleet.cars.length;i++)for(let j=i+1;j<fleet.cars.length;j++)assert.equal(trafficBodiesOverlap(fleet.cars[i],fleet.cars[j],0),false)
  for(let i=0;i<6000;i++){
    stepTraffic(fleet,cfg,.05)
    if(i%5)continue
    const live=fleet.cars.filter(c=>c.active)
    for(let a=0;a<live.length;a++)for(let b=a+1;b<live.length;b++)assert.equal(overlap(live[a],live[b]),false,`truck overlap at ${fleet.time}`)
  }
  assert.ok(fleet.traversals>50,JSON.stringify(trafficSummary(fleet)))
})
