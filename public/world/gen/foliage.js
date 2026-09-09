/** Original branch-and-leaf cutouts, instanced in spatial cells. No downloads. */
import * as THREE from 'three'
import { makeRng } from '../engine/state.js'

export const foliageTime = { value: 0 }
export const foliageWind = { value: 1 }

/** A tapered visible branch; the narrow end points toward the leaf cluster. */
export function emitBranch(builder, atlas, a, b, radius = 0.055) {
  const axis = new THREE.Vector3(b.x-a.x,b.y-a.y,b.z-a.z).normalize()
  if (axis.lengthSq() < 0.001) return
  const right = new THREE.Vector3().crossVectors(axis, Math.abs(axis.y) > 0.94 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0)).normalize()
  const up = new THREE.Vector3().crossVectors(axis,right).normalize()
  const ring = (p,r,i) => {
    const angle = i / 6 * Math.PI * 2
    return {x:p.x+(right.x*Math.cos(angle)+up.x*Math.sin(angle))*r,y:p.y+(right.y*Math.cos(angle)+up.y*Math.sin(angle))*r,z:p.z+(right.z*Math.cos(angle)+up.z*Math.sin(angle))*r}
  }
  for(let i=0;i<6;i++) builder.quad([ring(a,radius,i),ring(a,radius,i+1),ring(b,radius*0.35,i+1),ring(b,radius*0.35,i)],'#645442',atlas.uv('white'))
}

/** The placement stream is separate from prop RNG and never changes collision. */
export function emitLeafCluster(atlas, {x,y,z,r=1,sy=1,color='#5b783c',seed=''}) {
  const random=makeRng(`leaves:${seed}:${x}:${y}:${z}`)
  const sources=atlas.foliageSources ||= []
  for(let i=0;i<6;i++) {
    const angle=i*Math.PI/3+random.range(-0.3,0.3)
    sources.push({x:x+Math.cos(angle)*r*0.15,y:y+random.range(-0.16,0.16)*r,z:z+Math.sin(angle)*r*0.15,
      yaw:angle,pitch:random.range(-0.85,0.85),roll:random.range(-0.7,0.7),w:r*random.range(1.6,2.05),h:r*sy*random.range(1.4,1.85),color,shade:random.range(0.82,1.17),layer:i})
  }
}

function makeLeafTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512
  const ctx=canvas.getContext('2d'),rng=makeRng('london-plane-branch-card-v1')
  ctx.clearRect(0,0,512,512)
  const leaf=(x,y,angle,size,tone) => {
    ctx.save();ctx.translate(x,y);ctx.rotate(angle)
    // Irregular, shallow lobes suggest a plane-tree leaf rather than discs.
    ctx.beginPath();ctx.moveTo(0,0)
    ctx.lineTo(-size*0.38,-size*0.22);ctx.lineTo(-size*0.15,-size*0.31)
    ctx.lineTo(-size*0.49,-size*0.56);ctx.lineTo(-size*0.17,-size*0.55)
    ctx.lineTo(-size*0.24,-size*0.88);ctx.lineTo(-size*0.075,-size*0.74)
    ctx.lineTo(0,-size*1.12);ctx.lineTo(size*0.12,-size*0.77)
    ctx.lineTo(size*0.35,-size*0.9);ctx.lineTo(size*0.27,-size*0.59)
    ctx.lineTo(size*0.52,-size*0.54);ctx.lineTo(size*0.2,-size*0.3)
    ctx.lineTo(size*0.34,-size*0.19);ctx.closePath()
    const gradient=ctx.createLinearGradient(-size/2,-size, size/2,0)
    gradient.addColorStop(0,`hsl(${tone},31%,${rng.range(34,43)}%)`)
    gradient.addColorStop(0.48,`hsl(${tone},32%,${rng.range(29,37)}%)`)
    gradient.addColorStop(1,`hsl(${tone+5},29%,${rng.range(22,30)}%)`)
    ctx.fillStyle=gradient;ctx.fill()
    ctx.strokeStyle='rgba(161,170,93,0.43)';ctx.lineWidth=0.8
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-size*0.97)
    for(const fraction of [0.29,0.5,0.7]) {ctx.moveTo(0,-size*fraction);ctx.lineTo(-size*0.28,-size*(fraction+0.12));ctx.moveTo(0,-size*fraction);ctx.lineTo(size*0.3,-size*(fraction+0.12))}
    ctx.stroke();ctx.restore()
  }
  // Four spreading twigs preserve gaps and a readable branch structure.
  const twigs=[[[257,489],[228,100]],[[255,424],[66,143]],[[252,363],[444,102]],[[251,312],[125,43]],[[258,291],[374,24]]]
  for(const [start,end] of twigs) {
    ctx.strokeStyle='#665b37';ctx.lineCap='round';ctx.lineWidth=3.2
    ctx.beginPath();ctx.moveTo(...start);ctx.quadraticCurveTo((start[0]+end[0])/2+13,(start[1]+end[1])/2,...end);ctx.stroke()
    const direction=Math.atan2(end[0]-start[0],start[1]-end[1])
    for(let i=1;i<=8;i++) {
      const t=i/8,x=start[0]+(end[0]-start[0])*t,y=start[1]+(end[1]-start[1])*t
      for(const side of [-1,1]) {
        const a=direction+side*rng.range(0.6,1.25)
        const stem=rng.range(13,23)
        const lx=x+Math.sin(a)*stem,ly=y-Math.cos(a)*stem
        ctx.strokeStyle='#72703e';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(lx,ly);ctx.stroke()
        leaf(lx,ly,a,rng.range(28,49)*(0.95-t*0.12),rng.range(76,99))
      }
    }
  }
  const map=new THREE.CanvasTexture(canvas)
  map.colorSpace=THREE.SRGBColorSpace;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter
  map.anisotropy=4;map.name='Original plane-tree leaf spray';return map
}

function foliageMotion(shader) {
  shader.uniforms.uFoliageTime=foliageTime;shader.uniforms.uFoliageWind=foliageWind
  shader.vertexShader='uniform float uFoliageTime, uFoliageWind;\n'+shader.vertexShader
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
    #include <begin_vertex>
    #ifdef USE_INSTANCING
      vec3 leafOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float leafPhase = dot(leafOrigin.xz, vec2(0.31, 0.23));
      transformed.z += (sin(uFoliageTime * 1.05 + leafPhase) * 0.023 + sin(uFoliageTime * 2.0 + leafPhase * 1.4) * 0.009) * (position.y + 0.5) * uFoliageWind;
    #endif
  `)
}

/** Shared alpha-tested material: depth writes stay on and blending stays off. */
export function createFoliageMaterial() {
  const material=new THREE.MeshStandardMaterial({name:'world:leaf-cutouts',map:makeLeafTexture(),alphaTest:0.42,transparent:false,depthWrite:true,side:THREE.DoubleSide,roughness:0.9,metalness:0,envMapIntensity:0.75})
  material.onBeforeCompile=foliageMotion
  material.customProgramCacheKey=()=> 'world-leaf-wind-v1'
  return material
}

export function addFoliageMotion(material) {
  const original=material.onBeforeCompile
  material.onBeforeCompile=(shader,renderer)=>{original?.(shader,renderer);foliageMotion(shader)}
  const key=material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey=()=>key()+':leaf-wind-v1'
}

/** Each district retains its own foliage cells, so streaming and interiors
 * hide leaves with their parent city group. One draw per visible spatial cell. */
export function buildFoliage(sources, material) {
  const group=new THREE.Group();group.name='leaf-canopies'
  if(!material || !sources.length)return {group,triangles:0}
  const cells=new Map(),cellSize=70
  for(const source of sources) {const key=`${Math.floor(source.x/cellSize)},${Math.floor(source.z/cellSize)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(source)}
  const geometry=new THREE.PlaneGeometry(1,1,2,1)
  const position=geometry.attributes.position
  for(let i=0;i<position.count;i++)position.setZ(i,(1-Math.abs(position.getX(i))*2)*0.085)
  geometry.computeVertexNormals();geometry.computeBoundingSphere()
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:material.map,alphaTest:material.alphaTest,side:THREE.DoubleSide})
  depth.onBeforeCompile=foliageMotion;depth.customProgramCacheKey=()=> 'world-leaf-depth-wind-v1'
  const transform=new THREE.Object3D(),tint=new THREE.Color()
  for(const [key,cards] of cells) {
    // Keep the first three crossing directions of every cluster contiguous.
    // Reducing instance count then thins every crown instead of removing trees.
    cards.sort((a,b)=>(a.layer || 0)-(b.layer || 0))
    const [cx,cz]=key.split(',').map(Number),ox=(cx+0.5)*cellSize,oz=(cz+0.5)*cellSize
    const mesh=new THREE.InstancedMesh(geometry,material,cards.length)
    mesh.name='leaf-cell:'+key;mesh.position.set(ox,0,oz);mesh.customDepthMaterial=depth;mesh.castShadow=mesh.receiveShadow=true
    mesh.userData.foliage={fullCount:cards.length,reducedCount:cards.filter(card=>(card.layer || 0)<3).length}
    for(const [i,card] of cards.entries()) {
      transform.position.set(card.x-ox,card.y,card.z-oz);transform.rotation.set(card.pitch,card.yaw,card.roll);transform.scale.set(card.w,card.h,1);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix)
      tint.set(card.color);const max=Math.max(tint.r,tint.g,tint.b,0.001)
      tint.setRGB(Math.sqrt(tint.r/max)*card.shade,Math.sqrt(tint.g/max)*card.shade,Math.sqrt(tint.b/max)*card.shade);mesh.setColorAt(i,tint)
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();mesh.boundingSphere.radius+=0.1
    mesh.matrixAutoUpdate=false;mesh.updateMatrix();group.add(mesh)
  }
  return {group,triangles:sources.length*4}
}

/** Bound cutout overdraw and shadow submissions without per-tree draw calls. */
export function updateFoliageCell(mesh, cameraPosition, tier) {
  const {fullCount,reducedCount}=mesh.userData.foliage
  const sphere=mesh.boundingSphere
  const distance=Math.max(0,Math.hypot(cameraPosition.x-mesh.position.x-sphere.center.x,cameraPosition.y-sphere.center.y,cameraPosition.z-mesh.position.z-sphere.center.z)-sphere.radius)
  mesh.count=tier==='performance' || distance>(tier==='high'?95:55)?reducedCount:fullCount
  mesh.castShadow=tier!=='performance' && distance<(tier==='high'?160:75)
}
