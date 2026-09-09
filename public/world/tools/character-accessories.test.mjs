import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {createCharacterAccessory} from '../engine/character-accessories.js'
test('carried role objects hang below their grip and stay within150triangles/one draw',()=>{
 for(const kind of ['records','groceries','parcel']){
  const group=createCharacterAccessory(kind),bounds=new THREE.Box3().setFromObject(group)
  assert.ok(group.userData.triangles<=150,kind+' triangles '+group.userData.triangles)
  assert.equal(group.children.length,1);assert.equal(Array.isArray(group.children[0].material),false)
  assert.ok(bounds.max.y<=.001,kind+' extends above grip');assert.ok(bounds.min.y>=-.6);assert.ok(Math.abs(bounds.min.x+bounds.max.x)<.02)
  assert.ok(bounds.max.x-bounds.min.x<.4);assert.equal(group.children[0].material.roughness,.92)
  group.dispose();assert.equal(group.children.length,0)
 }
 assert.equal(createCharacterAccessory('unknown'),null)
})
