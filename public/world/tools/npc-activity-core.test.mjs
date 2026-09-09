import test from 'node:test'
import assert from 'node:assert/strict'
import { createActivityState, planActivity, crossingClear } from '../game/npc-activity-core.js'
const activity = { id: 'delivery', points: [{ x: 0, z: 0, pause: 2, verb: 'buy' }, { x: 10, z: 0, pause: 3, verb: 'enter' }, { x: 20, z: 0, pause: 2, verb: 'talk' }] }
test('delivery follows authored sidewalk points and really pauses at the recipient', () => {
  const state = createActivityState()
  assert.equal(planActivity(activity, state, { x: 0, z: 0 }, 1/60).verb, 'walk')
  for(let i=0;i<120;i++) assert.equal(planActivity(activity,state,{x:10,z:0},1/60).verb,'enter')
  for(let i=0;i<61;i++) planActivity(activity,state,{x:10,z:0},1/60)
  assert.equal(state.index,2)
  assert.equal(planActivity(activity,state,{x:10,z:0},1/60).x,20)
})
test('blocked progress never consumes the next destination pause', () => {
  const state=createActivityState()
  for(let i=0;i<600;i++)planActivity(activity,state,{x:4,z:0},1/60)
  assert.equal(state.index,1);assert.equal(state.remaining,0)
  assert.equal(planActivity(activity,state,{x:10,z:0},0).verb,'enter');assert.equal(state.remaining,3)
})
test('curb waiting forecasts moving traffic and excludes elevated vehicles', () => {
  const from={x:0,z:-5},to={x:0,z:5}
  const car={x:-24,z:1.8,yaw:Math.PI/2,speed:8,width:1.8,length:4.4}
  assert.equal(crossingClear(from,to,[car]),false)
  assert.equal(crossingClear(from,to,[{...car,y:8}]),true)
  assert.equal(crossingClear(from,to,[{...car,x:10}]),true)
  assert.equal(crossingClear(from,to,[{...car,x:0,speed:0}]),false)
})
test('crossers wait outside the road, then finish rather than freeze in a live lane', () => {
  const crossing={id:'commute',points:[{x:0,z:-5},{x:0,z:5,crossing:true}]},state=createActivityState(),car={x:-10,z:1.8,yaw:Math.PI/2,speed:8}
  assert.equal(planActivity(crossing,state,{x:0,z:-5},1/60,[car]).waiting,true)
  assert.equal(state.crossing,false)
  assert.equal(planActivity(crossing,state,{x:0,z:-5},1/60,[]).verb,'walk')
  assert.equal(planActivity(crossing,state,{x:0,z:0},1/60,[car]).verb,'walk')
  assert.equal(state.crossing,true)
})
test('activity restarts from the same authored cursor for two-run replay', () => {
  const first=createActivityState();planActivity(activity,first,{x:10,z:0},.25)
  const reset=createActivityState();assert.deepEqual(reset,{index:1,arrived:false,remaining:0,crossing:false})
  assert.equal(planActivity(activity,reset,{x:0,z:0},0).target,'delivery:1')
})

test('crossing entry reserves enough approach time for the complete walking distance',()=>{
  const crossing={id:'commute',points:[{x:0,z:-5},{x:0,z:5,crossing:true}]},state=createActivityState()
  const farCar={x:-45,z:1.8,yaw:Math.PI/2,speed:8}
  assert.equal(planActivity(crossing,state,{x:0,z:-5},1/60,[farCar]).waiting,true)
})
