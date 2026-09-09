/** Real street-deck proportions. One merged draw, spinning round wheels. */
import * as THREE from 'three'
import { MeshBuilder } from './builder.js'
export function makeSkateboard(arch,material,atlas,lighting){
  const b=new MeshBuilder(lighting,atlas),white=atlas.uv('white'),wheels=[]
  const point=(row,side,lower=false)=>{const z=(row/20-.5)*.82,cap=Math.max(0,(Math.abs(z)-.29)/.12),width=.109*Math.sqrt(Math.max(.035,1-cap*cap));return{x:side*width,y:.102+.038*cap*cap+.008*side*side-(lower?.012:0),z}}
  for(let row=0;row<20;row++)for(let col=0;col<6;col++){
    const a=col/3-1,c=(col+1)/3-1
    b.quad([point(row,a),point(row+1,a),point(row+1,c),point(row,c)],'#242a29',atlas.uv('asphalt'))
    b.quad([point(row,c,true),point(row+1,c,true),point(row+1,a,true),point(row,a,true)],row>7&&row<13?'#e2ab56':'#315b4d',white)
  }
  for(let row=0;row<20;row++)for(const side of[-1,1]){
    const pts=[point(row,side),point(row,side,true),point(row+1,side,true),point(row+1,side)]
    b.quad(side===1?pts:pts.reverse(),row%2?'#bf925e':'#d8b17c',white)
  }
  for(const row of[0,20]){const pts=[point(row,-1),point(row,1),point(row,1,true),point(row,-1,true)];b.quad(row===20?pts:pts.reverse(),'#caa16d',white)}
  // Reorient a vertical builder cylinder onto its axle, retaining true normals.
  const axle=(x,y,z,r,length,color)=>{const start=b.vertCount;b.cylinder({x:0,y:0,z:0,r,h:length,seg:12,color,rect:white});for(let i=start;i<b.vertCount;i++){const k=i*3,px=b.pos[k],py=b.pos[k+1],pz=b.pos[k+2],nx=b.normals[k],ny=b.normals[k+1];b.pos[k]=x+py;b.pos[k+1]=y-px;b.pos[k+2]=z+pz;b.normals[k]=ny;b.normals[k+1]=-nx}}
  for(const z of[-.235,.235]){
    b.box({x:0,y:.078,z,w:.055,h:.018,d:.062,color:'#a8adb0',rect:white})
    b.cylinder({x:0,y:.056,z,r:.013,h:.04,seg:8,color:'#b48e56',rect:white})
    axle(0,.034,z,.012,.182,'#aab3b7')
    for(const x of[-.101,.101]){const start=b.vertCount;axle(x,.03,z,.03,.023,'#d5c7a2');axle(x+Math.sign(x)*.012,.03,z,.009,.004,'#737b7b');wheels.push({start,end:b.vertCount,front:false,pivot:{x,y:.03,z}})}
    for(const x of[-.026,.026])for(const dz of[-.022,.022])b.cylinder({x,y:.106,z:z+dz,r:.0028,h:.003,seg:6,color:'#a6abad',rect:white})
  }
  const geometry=b.build(),mesh=new THREE.Mesh(geometry,material);mesh.name='vehicle:skateboard';mesh.castShadow=true;mesh.receiveShadow=true
  mesh.userData={archetype:'skateboard',kind:'skateboard',handling:arch.handling,length:.82,width:.218,wheels,wheelRadius:.03,wheelSpin:0,lights:{head:[],tail:[]},basePositions:new Float32Array(geometry.attributes.position.array),baseNormals:new Float32Array(geometry.attributes.normal.array),paint:['#315b4d','#e2ab56']}
  return mesh
}
