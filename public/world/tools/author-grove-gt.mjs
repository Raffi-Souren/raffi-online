#!/usr/bin/env node
/** Original Grove GT. Metres, +Z forward, Y up; body and wheel pivots survive export. */
import * as T from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const toolchain = process.env.RAFFI_ASSET_TOOLS || fileURLToPath(new URL('../../../scripts/world-asset-tools/node_modules/', import.meta.url))
const validator = createRequire(path.join(toolchain, 'package.json'))('gltf-validator')

// Browser exporter adapter: no canvas or remote assets are required by this model.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((buffer) => { this.result = buffer; this.onloadend?.() }) }
  readAsDataURL(blob) { blob.arrayBuffer().then((buffer) => { this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`; this.onloadend?.() }) }
}
const scene = new T.Scene()
const materials = {
  paint: new T.MeshStandardMaterial({ name: 'grove-paint', color: '#214c42', roughness: .27, metalness: .72 }),
  glass: new T.MeshStandardMaterial({ name: 'grove-glass', color: '#203541', roughness: .12, metalness: .5 }),
  rubber: new T.MeshStandardMaterial({ name: 'grove-rubber', color: '#14191c', roughness: .84, metalness: 0 }),
  chrome: new T.MeshStandardMaterial({ name: 'grove-alloy', color: '#a1a9aa', roughness: .24, metalness: .92 }),
  dark: new T.MeshStandardMaterial({ name: 'grove-trim', color: '#22272b', roughness: .43, metalness: .3 }),
  lamp: new T.MeshStandardMaterial({ name: 'grove-headlight', color: '#fff2d3', emissive: '#fff0cc', emissiveIntensity: 1.8, roughness: .2 }),
  tail: new T.MeshStandardMaterial({ name: 'grove-taillight', color: '#960b20', emissive: '#fa1237', emissiveIntensity: .7, roughness: .2 }),
  plate: new T.MeshStandardMaterial({ name: 'grove-plate', color: '#ecdab1', roughness: .55 }),
}
function mesh(parent, geometry, material, name = '') {
  const m = new T.Mesh(geometry, materials[material]); m.name=name; parent.add(m); return m
}
function box(parent, name, xyz, dimensions, material, round = .025) {
  const geo = new RoundedBoxGeometry(...dimensions, 1, round)
  const m=mesh(parent,geo,material,name);m.position.set(...xyz);return m
}
function quad(parent, name, points, material) {
  const g=new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(points.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();g.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));return mesh(parent,g,material,name)
}
function bar(parent, a, b, width, material) {
  const v0=new T.Vector3(...a),v1=new T.Vector3(...b),delta=v1.clone().sub(v0)
  const m=mesh(parent,new T.CylinderGeometry(width,width,delta.length(),8),material)
  m.position.copy(v0.add(v1).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return m
}
function cleanGeometry(geometry) {
  const position = geometry.attributes.position, index = geometry.index
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), kept = []
  for (let i = 0; i < index.count; i += 3) {
    const ia=index.getX(i),ib=index.getX(i+1),ic=index.getX(i+2)
    a.fromBufferAttribute(position,ia);b.fromBufferAttribute(position,ib);c.fromBufferAttribute(position,ic)
    if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-18) kept.push(ia,ib,ic)
  }
  geometry.setIndex(kept)
  return mergeVertices(geometry)
}
function build(lod) {
  const root=new T.Group();root.name='grove-gt-lod'+lod
  const body=new T.Group();body.name='body';root.add(body)
  // Continuous sculpted body top, with complete front/rear and a dark undertray.
  const profiles=[[-2.31,.72,.68],[-2.07,.93,.85],[-1.48,.97,.92],[-.75,.955,.87],[.6,.94,.88],[1.48,.965,.85],[2.08,.87,.7],[2.32,.69,.62]]
  for(let i=0;i<profiles.length-1;i++) {
    const [z0,w0,y0]=profiles[i], [z1,w1,y1]=profiles[i+1]
    quad(body,'sculpted-deck', [[-w0,y0,z0],[-w1,y1,z1],[w1,y1,z1],[w0,y0,z0]],'paint')
  }
  // Side body follows the wheel arches; tires are never buried in a rectangular hull.
  for(const side of [-1,1]) {
    const outline=new T.Shape();outline.moveTo(-2.31,.34);outline.lineTo(-1.88,.34)
    outline.absarc(-1.41,.35,.47,Math.PI,0,true)
    outline.lineTo(.94,.35);outline.absarc(1.41,.35,.47,Math.PI,0,true)
    outline.lineTo(2.31,.34);outline.lineTo(2.32,.62)
    for(const [z,,y] of profiles.slice().reverse())outline.lineTo(z,y)
    outline.closePath()
    const geo=new T.ExtrudeGeometry(outline,{depth:.045,bevelEnabled:true,bevelThickness:.018,bevelSize:.018,bevelSegments:2,curveSegments:lod?8:16,steps:1})
    // shape x is longitudinal z; extrusion is transverse x. Rotate +Y with forward +Z.
    geo.rotateY(-Math.PI/2);const p=mesh(body,geo,'paint','arched-fender');p.position.x=side*.91
    box(body,'rocker',[side*.92,.3,-.02],[.08,.14,1.9],'dark')
    // Recessed side vent, door seam and a flush alloy handle.
    box(body,'side-vent',[side*.957,.68,.77],[.03,.095,.3],'dark',.018)
    bar(body,[side*.956,.4,-.94],[side*.956,.84,-.94],.005,'dark')
    box(body,'door-handle',[side*.961,.85,-.7],[.025,.027,.16],'chrome',.012)
  }
  box(body,'undertray',[0,.3,0],[1.69,.12,4.06],'rubber',.08)
  box(body,'front-bumper',[0,.46,2.15],[1.74,.27,.3],'paint',.1)
  box(body,'rear-bumper',[0,.48,-2.14],[1.85,.31,.28],'paint',.08)
  box(body,'front-intake',[0,.45,2.32],[1.12,.19,.06],'dark',.05)
  for(let x=-.5;x<=.5;x+=.083)box(body,'grille-fin',[x,.45,2.358],[.018,.15,.018],'chrome',.006)
  box(body,'rear-diffuser',[0,.32,-2.24],[1.31,.14,.2],'dark',.04)
  box(body,'license-plate',[0,.53,-2.293],[.48,.11,.018],'plate',.006)
  for(const side of [-1,1]) {
    box(body,'headlamp',[side*.662,.662,2.157],[.35,.10,.095],'glass',.035)
    box(body,'daylight-strip',[side*.662,.69,2.211],[.32,.022,.019],'lamp',.009)
    box(body,'rear-light',[side*.69,.75,-2.184],[.38,.065,.06],'tail',.02)
    const exhaust=mesh(body,new T.CylinderGeometry(.052,.052,.2,12),'chrome','exhaust');exhaust.rotation.x=Math.PI/2;exhaust.position.set(side*.66,.3,-2.27)
  }
  // Low cabin: sloped laminated glass, complete roof and structural pillars.
  const roofFront=.34, roofBack=-.88, roofY=1.39, beltY=.89
  quad(body,'windscreen',[[-.81,beltY,.91],[.81,beltY,.91],[.68,roofY,roofFront],[-.68,roofY,roofFront]],'glass')
  quad(body,'rear-glass',[[.77,.91,-1.56],[-.77,.91,-1.56],[-.66,roofY,roofBack],[.66,roofY,roofBack]],'glass')
  box(body,'roof',[0,1.405,-.29],[1.36,.055,1.23],'paint',.05)
  for(const side of [-1,1]) {
    const a=[side*.81,beltY,.91],b=[side*.68,roofY,roofFront],c=[side*.66,roofY,roofBack],d=[side*.77,.91,-1.56]
    const points=side===1?[d,c,b,a]:[a,b,c,d]
    quad(body,'side-glass',points,'glass')
    bar(body,a,b,.038,'paint');bar(body,b,c,.032,'paint');bar(body,c,d,.059,'paint');bar(body,d,a,.025,'chrome')
    bar(body,[side*.77,.91,-.57],[side*.67,1.39,-.55],.022,'dark')
    box(body,'mirror-stem',[side*.895,1.015,.53],[.17,.035,.04],'dark')
    box(body,'mirror',[side*1.014,1.04,.52],[.18,.1,.22],'paint',.04)
    box(body,'mirror-glass',[side*1.017,1.045,.399],[.126,.06,.015],'glass',.018)
  }
  // Bonnet seam and restrained raised central spine.
  for(const side of [-1,1])bar(body,[side*.5,.872,.94],[side*.57,.719,2.0],.005,'dark')
  // Four separate steering/spinning wheel groups with true pivots.
  for(const side of [-1,1])for(const front of [false,true]) {
    const wheel=new T.Group();wheel.name=`wheel-${front?'front':'rear'}-${side<0?'left':'right'}`;wheel.position.set(side*.83,.35,front?1.41:-1.41);root.add(wheel)
    const tire=mesh(wheel,new T.TorusGeometry(.263,.087, lod?6:10,lod?16:28),'rubber','tire');tire.rotation.y=Math.PI/2
    const rim=mesh(wheel,new T.CylinderGeometry(.244,.244,.17,lod?16:28),'dark','wheel-barrel');rim.rotation.z=Math.PI/2
    const lip=mesh(wheel,new T.TorusGeometry(.23,.013,6,lod?16:28),'chrome','rim-lip');lip.rotation.y=Math.PI/2;lip.position.x=side*.094
    const hub=mesh(wheel,new T.CylinderGeometry(.055,.055,.035,12),'chrome','hub');hub.rotation.z=Math.PI/2;hub.position.x=side*.1
    for(let i=0;i<5;i++) {
      const angle=i*Math.PI*2/5
      bar(wheel,[side*.108,Math.cos(angle)*.06,Math.sin(angle)*.06],[side*.108,Math.cos(angle+.17)*.222,Math.sin(angle+.17)*.222],.025,'chrome')
    }
    if(!lod) {
      const disc=mesh(wheel,new T.CylinderGeometry(.18,.18,.014,24),'chrome','brake-disc');disc.rotation.z=Math.PI/2;disc.position.x=side*.062
      box(wheel,'brake-caliper',[side*.073,.08,.12],[.032,.14,.055],'tail',.014)
    }
  }
  // Merge static surfaces by material within body/wheel; never lose pivots.
  for(const part of [...root.children]) {
    part.updateMatrixWorld(true);const buckets=new Map()
    for(const m of [...part.children]) {
      if(!m.isMesh)continue
      m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix)
      // These original materials use no texture maps, so UV buffers are waste.
      for(const key of Object.keys(g.attributes))if(!['position','normal'].includes(key))g.deleteAttribute(key)
      const list=buckets.get(m.material)||[];list.push(g);buckets.set(m.material,list);part.remove(m)
    }
    for(const [material, geos]of buckets){const g=cleanGeometry(mergeVertices(mergeGeometries(geos)));const m=new T.Mesh(g,material);m.name=material.name;part.add(m)}
  }
  return root
}
const lod0=build(0),lod1=build(1);scene.add(lod0,lod1)
const exporter=new GLTFExporter()
const bytes=await exporter.parseAsync(scene,{binary:true,onlyVisible:false})
const validation=await validator.validateBytes(new Uint8Array(bytes),{uri:'grove-gt.glb',maxIssues:100})
if(validation.issues.numErrors||validation.issues.numWarnings)throw new Error('Grove GT validation failed: '+JSON.stringify(validation.issues))
const out=path.resolve('public/world/assets/vehicles/grove-gt.glb');await fs.writeFile(out,Buffer.from(bytes))
const stats={}
for(const root of [lod0,lod1]){let triangles=0,draws=0;root.traverse(m=>{if(m.isMesh){draws++;triangles+=(m.geometry.index?.count || m.geometry.attributes.position.count)/3}});stats[root.name]={triangles,draws}}
const manifest={id:'grove-gt-v1',author:'Raffi World project',source:'Original hand-authored model: public/world/tools/author-grove-gt.mjs',license:'Original project asset; no third-party model or branding',file:'vehicles/grove-gt.glb',bytes:bytes.byteLength,units:'metres; +Z forward; +Y up',dimensions:[2.208,1.44,4.736],collision:'existing grand-tourer simple circle simulation, authored4.72×1.92m silhouette',lods:stats,modifications:'Sculpted deck, wheel-arch side panels, sloped glass, structural pillars, mirrors, grille, alloy wheels and separate wheel pivots. Low detail retained.',reproduce:'node public/world/tools/author-grove-gt.mjs',toolchain:{three:T.REVISION,blender:'Not installed; authored and exported reproducibly with Three GLTFExporter.'}}
manifest.sha256=createHash('sha256').update(Buffer.from(bytes)).digest('hex')
manifest.validation=validation.issues
manifest.reproduce=['npm ci --prefix scripts/world-asset-tools','RAFFI_ASSET_TOOLS="$PWD/scripts/world-asset-tools/node_modules" node public/world/tools/author-grove-gt.mjs']
manifest.toolchain.gltfValidator='2.0.0-dev.3.10'
await fs.writeFile('public/world/assets/manifests/grove-gt.json',JSON.stringify(manifest,null,2)+'\n')
console.info(JSON.stringify(manifest,null,2))
