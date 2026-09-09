import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import * as THREE from 'three'
globalThis.location={search:''};globalThis.matchMedia=()=>({matches:false});globalThis.window={devicePixelRatio:1};globalThis.screen={width:1280,height:720}
const { state,data }=await import('../engine/state.js')
const { CollisionWorld }=await import('../engine/physics.js')
const { buildLandmarks }=await import('../gen/world.js')
const {initNpcSim,updateNpcSim,npcActivitySnapshot,npcActorCount,resetNpcToStart,disposeNpcSim,setNpcRecording,snapshotNpcRun}=await import('../game/npc-sim.js')
for(const key of ['world','npcs','blocks','props']) data[key]=JSON.parse(fs.readFileSync(new URL(`../data/${key}.json`,import.meta.url),'utf8'))
const atlas={uv:()=>[0,0,1,1],uvAt:(_r,u,v)=>[u,v]},materials={actor:new THREE.MeshBasicMaterial()}
const noop={quad(){},box(){},plane(){},billboard(){},cylinder(){},cone(){},sphere(){},wedge(){}},set={opaque:noop,emissive:noop,alpha:noop}
function setup(){const scene=new THREE.Scene(),collision=new CollisionWorld();for(const d of data.world.districts)collision.addAll(buildLandmarks(set,atlas,data.props,data.world,d.id));Object.assign(state.player,{x:0,z:-380});state.mode='foot';state.interior=null;initNpcSim({scene,materials,atlas,collision,seed:'FIXED'});return scene}
function advance(seconds){for(let i=0;i<seconds*60;i++)updateNpcSim(1/60,{hour:14})}
test('same16 actors complete sidewalk errands, pause intentionally and retain six-verb replay streams',()=>{
  setup();setNpcRecording(true);const visited=new Map();for(let i=0;i<150*60;i++){updateNpcSim(1/60,{hour:14});if(i%30===0)for(const a of npcActivitySnapshot().filter(a=>['npc-0','npc-1'].includes(a.id))){if(!visited.has(a.id))visited.set(a.id,new Set());visited.get(a.id).add(a.target);assert.ok(a.z>=-154.15&&a.z<=-138.85,`${a.id} left authored sidewalks/crossing: ${JSON.stringify(a)}`);if(a.verb!=='walk'&&a.speed<.2)assert.ok(['idle','talk'].includes(a.animation))}}
  assert.equal(npcActorCount(),16);assert.equal(visited.size,2)
  assert.ok([...visited.get('npc-0')].some(t=>t==='willow-deliveries:0'));assert.ok([...visited.get('npc-0')].some(t=>t==='willow-deliveries:2'))
  assert.ok([...visited.get('npc-1')].some(t=>t==='willow-coffee-errand:5'))
  const stream=snapshotNpcRun();assert.ok(stream.decisions.length>30);assert.ok(stream.decisions.every(d=>['walk','enter','talk','buy','flee','idle'].includes(d.verb)))
  resetNpcToStart();const reset=npcActivitySnapshot();for(let i=0;i<2;i++){assert.equal(reset[i].index,1);assert.equal(reset[i].x,data.npcs.neighborhoodActivities[i].points[0].x)}
  disposeNpcSim()
})
test('coffee errand waits at curb for a real vehicle body then crosses after it leaves',()=>{
  const scene=setup(),car=new THREE.Object3D();car.userData={width:1.8,length:4.4};car.position.set(-411,0,-145);car.rotation.y=Math.PI/2;scene.add(car)
  advance(65);let person=npcActivitySnapshot().find(a=>a.id==='npc-1');assert.match(person.target,/wait-crossing/);assert.ok(person.z<-148.6,`waiting pedestrian entered lane: ${person.z}`);assert.equal(person.speed,0);assert.equal(person.animation,'idle')
  scene.remove(car);advance(35);person=npcActivitySnapshot().find(a=>a.id==='npc-1');assert.ok(person.z>-142,JSON.stringify(person));disposeNpcSim()
})
test('idle overlapping pedestrian bodies settle apart without adding people',()=>{
  setup();advance(2);const actors=npcActivitySnapshot();for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++)assert.ok(Math.hypot(actors[i].x-actors[j].x,actors[i].z-actors[j].z)>.77,`overlap ${actors[i].id}/${actors[j].id}`);assert.equal(actors.length,16);disposeNpcSim()
})
