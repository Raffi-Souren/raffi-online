import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PARK_ENTRANCES, PARK_LOCALS, PARK_FENCES, parkColliders, createParkLocal, stepParkLocal } from '../game/park-core.js'
globalThis.location={search:''};globalThis.matchMedia=()=>({matches:false});globalThis.window={devicePixelRatio:1};globalThis.screen={width:1280,height:720}
const {CollisionWorld,resolveCircle,moveCircle}=await import('../engine/physics.js')
const {buildLandmarks}=await import('../gen/world.js')
const read=name=>JSON.parse(fs.readFileSync(new URL('../data/'+name+'.json',import.meta.url),'utf8'))
const atlas={uv:()=>[0,0,1,1],uvAt:(_r,u,v)=>[u,v]},noop=new Proxy({},{get:()=>()=>{}}),set={opaque:noop,alpha:noop,emissive:noop}
const world=read('world'),props=read('props'),solids=new CollisionWorld();const worldSolids=world.districts.flatMap(d=>buildLandmarks(set,atlas,props,world,d.id));solids.addAll(worldSolids);solids.addAll(parkColliders());const seatClearance=new CollisionWorld();seatClearance.addAll(worldSolids);seatClearance.addAll(parkColliders().filter(c=>c.tag!=='park-bench'))
test('court fence segments are physical and all three entrances remain genuinely open',()=>{
  for(const f of PARK_FENCES)assert.equal(resolveCircle(solids,(f.x1+f.x2)/2,(f.z1+f.z2)/2,.45).hit,true)
  for(const e of PARK_ENTRANCES){const crossed=moveCircle(solids,e.x,e.z+3,0,-6,.45);assert.equal(crossed.hit,false,JSON.stringify(e));assert.ok(Math.abs(crossed.z-(e.z-3))<.01)}
  assert.equal(resolveCircle(solids,-310,-408,.45).hit,false,'Jules can be approached inside the main entrance')
  assert.equal(resolveCircle(solids,-333,-403,.45).hit,false,'printing conversation stays accessible')
})
test('fixed named park activities stay clear of existing city geometry and each other for two minutes',()=>{
  assert.equal(PARK_LOCALS.length,3);assert.equal(new Set(PARK_LOCALS.map(p=>p.id)).size,3);assert.equal(new Set(PARK_LOCALS.map(p=>p.appearanceId)).size,3)
  const locals=PARK_LOCALS.map(createParkLocal),moved=new Set()
  for(let i=0;i<120*60;i++)for(let j=0;j<locals.length;j++){
    const run=locals[j],spec=PARK_LOCALS[j];stepParkLocal(run,spec,1/60)
    assert.equal(resolveCircle(spec.role==='bench-spectator'?seatClearance:solids,run.x,run.z,.4).hit,false,spec.id+' '+JSON.stringify(run));if(spec.role==='bench-spectator'){assert.equal(run.action,'sit');assert.equal(resolveCircle(solids,run.x,run.z,.4).hit,true,'seated actor must occupy the actual bench footprint')}
    if(run.speed>0)moved.add(spec.id)
    for(let k=0;k<j;k++)assert.ok(Math.hypot(run.x-locals[k].x,run.z-locals[k].z)>1)
  }
  assert.deepEqual([...moved].sort(),['park:nico','park:rosa'])
})
test('waterfront jogging loop passes beside the new court fences',()=>{
  const route=read('npcs').neighborhoodActivities.find(a=>a.role==='waterfront-jogger').points
  for(let i=0;i<route.length;i++){const a=route[i],b=route[(i+1)%route.length],n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.3);for(let k=0;k<=n;k++)assert.equal(resolveCircle(solids,a.x+(b.x-a.x)*k/n,a.z+(b.z-a.z)*k/n,.4).hit,false,`jog segment ${i} sample ${k}`)}
})
