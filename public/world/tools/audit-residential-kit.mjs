#!/usr/bin/env node
/** Regenerate provenance and measured original apartment geometry inventory. */
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
globalThis.location={search:''};globalThis.matchMedia=()=>({matches:false});globalThis.window={devicePixelRatio:1};globalThis.screen={width:1280,height:720}
const {RESIDENTIAL_LOTS,buildApartmentGeometry}=await import('../gen/residential.js')
const {buildRoadGraph}=await import('../gen/roads.js')
const {layoutLots}=await import('../gen/blocks.js')
const root=new URL('../',import.meta.url), read=async path=>fs.readFile(new URL(path,root))
const world=JSON.parse(await read('data/world.json')), blocks=JSON.parse(await read('data/blocks.json'))
const lots=layoutLots(world.districts.find(d=>d.id==='downtown'),blocks,buildRoadGraph(world),world).filter(l=>RESIDENTIAL_LOTS[l.id])
const atlas={uv:()=>({u0:0,v0:0,u1:1,v1:1}),uvAt:(_,u,v)=>[u,v]}
const sources=[]
for(const path of ['gen/residential.js','gen/brooklyn.js','gen/atlas.js','data/world.json','data/blocks.json']){const file=await read(path);sources.push({path,bytes:file.length,sha256:crypto.createHash('sha256').update(file).digest('hex')})}
const buildings=lots.map(lot=>({lotId:lot.id,at:{x:lot.x,z:lot.z},existingFootprint:{w:lot.w,d:lot.d,yaw:lot.ry},...RESIDENTIAL_LOTS[lot.id],lods:[true,false].map(detail=>{const g=buildApartmentGeometry(lot,RESIDENTIAL_LOTS[lot.id],atlas,{},detail).geometry;const hash=crypto.createHash('sha256');for(const name of ['position','normal','color','uv'])hash.update(Buffer.from(g.attributes[name].array.buffer));hash.update(Buffer.from(g.index.array.buffer));return{detail,triangles:g.index.count/3,vertices:g.attributes.position.count,bounds:g.boundingBox,geometrySha256:hash.digest('hex')}})}))
const output={name:'Original Brooklyn residential architecture kit',version:1,author:'Raffi World project',provenance:'Original locally authored parametric geometry and original atlas window/trim artwork; no downloaded building models or branded architecture. Existing flat brick texture channels retain their separately recorded urban-surface provenance.',license:'Project-owned source distributed under repository terms; not represented as third-party CC0 geometry.',sources,buildings,runtime:{materialSlotsPerLOD:1,extraNetworkAssetBytes:0,lodDistanceMetres:90,lodHysteresis:.12,collision:'Existing generated lot extents retained. No new sidewalk obstacle footprints.',nearDetail:'Punched masonry openings and glass behind reveals; selected curtains and AC; sheltered residential doors; bounded balcony railings; tower setback and rooftop water tank.',farDetail:'Same silhouette and window rhythm, flattened window/trim geometry, no small fittings.'},reproducibility:{inventory:'node public/world/tools/audit-residential-kit.mjs --write',verify:'node --test public/world/tools/residential-kit.test.mjs',fingerprint:'Neutral atlas UV rectangles; runtime atlas coordinates differ.'}}
const json=JSON.stringify(output,null,2)+'\n'
if(process.argv.includes('--write'))await fs.writeFile(new URL('assets/manifests/residential-kit.json',root),json)
else process.stdout.write(json)
