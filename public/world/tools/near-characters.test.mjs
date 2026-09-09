import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { selectNearActors } from '../engine/near-characters.js'

const actor = x => { const object = new THREE.Object3D(); object.position.x = x; return object }
const origin = { x: 0, z: 0 }

test('near character selection respects capacity, distance, and exit hysteresis', () => {
  const a = actor(7), b = actor(12), c = actor(2), outside = actor(19)
  assert.deepEqual(selectNearActors([a,b,c,outside],[],origin),[c,a])
  a.position.x=17
  assert.deepEqual(selectNearActors([a,b,c,outside],[a],origin),[c,b], 'closer foreground actors replace distant occupied slots')
  assert.deepEqual(selectNearActors([a,b,c,outside],[a],origin,3),[c,b,a], 'assigned actors keep the wider exit radius when capacity allows')
  b.position.x=7.5;a.position.x=8
  assert.deepEqual(selectNearActors([a,b],[a],origin,1),[a], 'small distance changes retain the current rig')
  b.position.x=12
  a.position.x=19
  assert.deepEqual(selectNearActors([a,b,c,outside],[a],origin),[c,b])
  assert.deepEqual(selectNearActors([a,b,c,outside],[],origin,0),[])
})

test('hidden pooled actors and hidden exterior parents release presentation slots', () => {
  const a=actor(2),b=actor(3),root=new THREE.Group();root.add(a)
  a.visible=false
  assert.deepEqual(selectNearActors([a,b],[a],origin),[b])
  a.visible=true;root.visible=false
  assert.deepEqual(selectNearActors([a,b],[a],origin),[b])
})


test('an approached conversation host retains a detailed slot in a crowded sidewalk', () => {
  const host={position:{x:3,z:0},visible:true,userData:{conversationCharacter:true}}
  const neighbors=Array.from({length:6},(_,i)=>({position:{x:1+i*.1,z:0},visible:true,userData:{}}))
  const selected=selectNearActors([...neighbors,host],neighbors.slice(0,4),{x:0,z:0},4)
  assert.equal(selected.length,4);assert.ok(selected.includes(host))
  assert.deepEqual(selectNearActors([host],[],{x:0,z:0},0),[])
})
