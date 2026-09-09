import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import * as THREE from 'three'
globalThis.location={search:''}; globalThis.matchMedia=()=>({matches:false}); globalThis.window={devicePixelRatio:1}; globalThis.screen={width:1280,height:720}
const {RESIDENTIAL_LOTS,buildApartmentGeometry,buildResidentialLot}=await import('../gen/residential.js')
const {buildRoadGraph}=await import('../gen/roads.js')
const {layoutLots,lotHalfExtents}=await import('../gen/blocks.js')
const load=id=>JSON.parse(fs.readFileSync(new URL(`../data/${id}.json`,import.meta.url)))
const world=load('world'), blocks=load('blocks')
const lots=layoutLots(world.districts.find(d=>d.id==='downtown'),blocks,buildRoadGraph(world),world).filter(l=>RESIDENTIAL_LOTS[l.id])
const atlas={uv:()=>({u0:0,v0:0,u1:1,v1:1}),uvAt:(_,u,v)=>[u,v]}
const material=new THREE.MeshStandardMaterial()

test('authored apartments occupy only the original lots and reduce far geometry substantially',()=>{
 assert.equal(lots.length,2)
 for(const lot of lots){
  const result=buildResidentialLot(lot,atlas,{opaque:material},{})
  const bounds=lotHalfExtents(lot)
  assert.equal(result.collider.hx,bounds.hx);assert.equal(result.collider.hz,bounds.hz)
  assert.equal(result.collider.x,lot.x);assert.equal(result.collider.z,lot.z)
  const [near,far]=result.group.levels.map(l=>l.object.geometry)
  assert.ok(far.index.count<near.index.count*.25,`${lot.id} far ${far.index.count/3} / near ${near.index.count/3}`)
  for(const g of [near,far]){
   const box=g.boundingBox
   assert.ok(box.min.x>=-lot.w/2-1e-5&&box.max.x<=lot.w/2+1e-5)
   assert.ok(box.min.z>=-lot.d/2-1e-5&&box.max.z<=lot.d/2+1e-5)
   const a=g.attributes.position,n=g.attributes.normal
   for(let i=0;i<a.count;i++){assert.ok(Number.isFinite(a.getX(i)+a.getY(i)+a.getZ(i)));assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5)}
  }
  const camera=new THREE.PerspectiveCamera();result.group.updateMatrixWorld(true)
  camera.position.set(lot.x,2,lot.z+25);camera.updateMatrixWorld();result.group.update(camera)
  assert.equal(result.group.levels[0].object.visible,true)
  camera.position.set(lot.x,2,lot.z+130);camera.updateMatrixWorld();result.group.update(camera)
  assert.equal(result.group.levels[0].object.visible,false);assert.equal(result.group.levels[1].object.visible,true)
 }
})

test('near apartment windows reveal recessed glass instead of a solid facade covering it',()=>{
 for(const lot of lots){
  const {geometry}=buildApartmentGeometry(lot,RESIDENTIAL_LOTS[lot.id],atlas,{},true)
  const mesh=new THREE.Mesh(geometry,material);mesh.updateMatrixWorld(true)
  const count=Math.max(3,Math.floor((lot.w-2.2)/3.05)),pitch=(lot.w-1.8)/count
  const x=(1-(count-1)/2)*pitch, face=lot.d/2-.85
  // First floor, below the sash and clear of decorative curtains/AC.
  const ray=new THREE.Raycaster(new THREE.Vector3(x,4.55,lot.d),new THREE.Vector3(0,0,-1))
  const hits=ray.intersectObject(mesh)
  assert.ok(hits.length>0)
  assert.ok(hits[0].point.z<face-.20,`${lot.id}: window depth ${face-hits[0].point.z}`)
 }
})
