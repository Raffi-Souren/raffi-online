import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {classifyStoryIntent,createStoryState,transitionStory,storySettled} from '../game/story-core.js'
import {classifySportIntent} from '../game/sports-core.js'
import {kickflipPose,catchGrind,stepGrind} from '../game/skate-core.js'
import {punchTarget,createStreetCombat} from '../game/street-combat.js'
import {recoveryFor} from '../engine/boot-recovery.js'
const SKATE_RAILS=JSON.parse(await fs.readFile(new URL('../data/world.json',import.meta.url))).skatePark.rails
const config=JSON.parse(await fs.readFile(new URL('../data/conversations.json',import.meta.url)))
test('negative, quoted, conditional and mixed wording cannot spend money or accept a route',()=>{
  const fresh=createStoryState(config)
  for(const text of ["I can't return the records","I can’t DJ tonight","I can't pay the deposit",'I will not return the records','I will never cover the gig',"I won't cover tonight",'I cannot pay the deposit',"I'll pay if you repay me",'"I will return the records"','She said I can DJ tonight',"I can't return them but I'll cover the gig","I'll return the records or pay the deposit",'Can I pay the deposit?']){
    const result=transitionStory(fresh,{kind:'typed',text},config)
    assert.notEqual(classifyStoryIntent(text).kind,'accept',text)
    for(const key of ['wallet','escrow','branch','stage','trust','favorsOwed'])assert.deepEqual(result.state[key],fresh[key],text+': '+key)
    assert.deepEqual(result.state.rewarded,[])
  }
  assert.equal(transitionStory(fresh,{kind:'typed',text:"I can pay the deposit"},config).state.wallet,15)
  assert.equal(transitionStory(fresh,{kind:'accept',branch:'return'},config).state.branch,'return')
})
test('park refusals, questions and conditional/mixed replies remain distinct',()=>{
  for(const text of ["I can't play tennis",'No boxing',"I don't play soccer","I don’t play soccer",'I will never play tennis'])assert.equal(classifySportIntent(text).kind,'leave',text)
  for(const text of ['What happens if I leave?','How does boxing work?'])assert.equal(classifySportIntent(text).kind,'question')
  for(const text of ["I won't play tennis but soccer is okay",'"I want tennis"','tennis if you let me win'])assert.equal(classifySportIntent(text).kind,'clarify')
  assert.deepEqual(classifySportIntent('tennis'),{kind:'play',id:'tennis'})
})
test('completed remembered Last Crate route never pretends an obligation is unfinished',()=>{
  let s=transitionStory(createStoryState(config),{kind:'accept',branch:'return'},config).state
  s=transitionStory(s,{kind:'interact',id:'delivery'},config).state
  s=transitionStory(s,{kind:'visit-owner'},config).state
  s.listeningDone=true;s.rewarded.push('listening-complete');s.trust++
  assert.equal(storySettled(s),true)
  for(const event of [{kind:'typed',text:"I'll cover the gig"},{kind:'ask'}]){const r=transitionStory(s,event,config);assert.equal(r.changed,false);assert.match(r.reply,/new run|new.*run|save.*before/);assert.doesNotMatch(r.reply,/Finish it/);assert.deepEqual(r.state,s)}
})
test('kickflip has preparation, an independent board revolution, catch and flat landing',()=>{
  const start=kickflipPose(0),prep=kickflipPose(.12),air=kickflipPose(.43),catchPose=kickflipPose(.7),end=kickflipPose(.92)
  assert.equal(start.boardHop,0);assert.equal(prep.boardHop,0);assert.ok(prep.crouch>0)
  assert.ok(air.riderHop>air.boardHop&&air.boardHop>.45);assert.ok(air.flip>0&&air.flip<Math.PI*2)
  assert.equal(catchPose.flip,Math.PI*2);assert.equal(catchPose.catch,true);assert.ok(Math.abs(end.boardHop)<1e-8);assert.ok(Math.abs(end.crouch)<1e-8)
})
test('rails require a moving aligned airborne approach and award only a real slide',()=>{
  const r=SKATE_RAILS[0],v={x:r.x1+.25,z:r.z1+1,yaw:0,speed:5},t={t:.65,duration:.92}
  const g=catchGrind(v,t,SKATE_RAILS);assert.ok(g);assert.equal(catchGrind({...v,speed:0},t,SKATE_RAILS),null);assert.equal(catchGrind({...v,yaw:Math.PI/2},t,SKATE_RAILS),null);assert.equal(catchGrind(v,{t:.05,duration:.92},SKATE_RAILS),null)
  assert.deepEqual(stepGrind(g,0),{done:false});let result
  for(let i=0;i<1000;i++){result=stepGrind(g,1/60);if(result.done)break}
  assert.ok(result.done&&result.points>0);assert.ok(g.distance>2)
})
test('street jab selects only a close person in front, never a bystander behind or far away',()=>{
  const p={x:0,z:0,yaw:0},front={x:.2,z:1.2},behind={x:0,z:-.5},far={x:0,z:3}
  assert.equal(punchTarget(p,[behind,far,front]),front);assert.equal(punchTarget(p,[behind,far]),null)
})
function combatFixture(){
  const actor={visible:true,position:{x:0,z:1},userData:{rig:'biped'}}
  const state={mode:'foot',interior:null,paused:false,time:300,player:{x:0,z:0,yaw:0}}
  const combat=createStreetCombat({scene:{traverse:fn=>fn(actor)},state,collision:{},character:{playPunch(){}},moveCircle:(_c,x,z,dx,dz)=>({x:x+dx,z:z+dz})})
  return {actor,state,combat}
}
test('loading an earlier save clears transient citizen reactions along with pending punches',()=>{
  const {actor,state,combat}=combatFixture();combat.punch();combat.update(.23)
  assert.equal(actor.userData.streetReaction.until,303.5)
  state.time=10;combat.reset()
  assert.equal(actor.userData.streetReaction,undefined)
  assert.equal(combat.snapshot().active,false)
})
test('a jab cannot land after its player enters a vehicle during wind-up',()=>{
  const {actor,state,combat}=combatFixture();combat.punch();state.mode='drive';combat.update(.23)
  assert.equal(actor.userData.streetReaction,undefined)
  assert.equal(combat.snapshot().active,false)
  assert.equal(combat.snapshot().hits,0)
})
test('graphics recovery distinguishes unavailable context, missing assets, and verified saves',()=>{
  const noGpu=recoveryFor(new Error('Error creating WebGL context.'));assert.equal(noGpu.kind,'graphics-unavailable');assert.equal(noGpu.offerPerformance,false);assert.doesNotMatch(noGpu.save,/available/)
  assert.equal(recoveryFor(new Error('Failed to fetch world.json')).kind,'load-failed')
  const lost=recoveryFor(null,{contextLost:true,saveChecked:true,validSave:true});assert.equal(lost.offerPerformance,true);assert.match(lost.save,/verified local save/)
  assert.match(recoveryFor(null,{saveChecked:true}).save,/No valid local save/)
})


test('bounded pedestrian detours go around an obstacle and refuse sealed destinations', async () => {
  const {pedestrianDetour}=await import('../game/npc-navigation.js')
  const clear=(a,b)=>{for(let i=0;i<=40;i++){const t=i/40,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(Math.abs(x)<1.2 && Math.abs(z)<2.2)return false}return true}
  const from={x:-3,z:0},goal={x:3,z:0},path=pedestrianDetour(from,goal,clear)
  assert.ok(path?.length>1)
  let p=from;for(const next of path){assert.ok(clear(p,next));p=next}
  assert.deepEqual(p,goal)
  assert.equal(pedestrianDetour(from,{x:0,z:0},clear),null)
  assert.equal(pedestrianDetour(from,goal,clear,{limit:1}),null)
})
