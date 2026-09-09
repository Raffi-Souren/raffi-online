import * as THREE from 'three'
import { MeshBuilder } from './builder.js'
export function buildSkateRails(scene,materials,atlas,lighting,collision,config){
  const ground=config.ground
  collision.add({type:'ramp',x:ground.x,z:ground.z,w:ground.width,d:ground.depth,h:0,baseHeight:ground.height,ry:0,tag:'skate-plaza-floor'})
  const b=new MeshBuilder(lighting,atlas),white=atlas.uv('white')
  for(const r of config.rails){
    const dx=r.x2-r.x1,dz=r.z2-r.z1,length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz)
    b.box({x:(r.x1+r.x2)/2,y:r.height-.025,z:(r.z1+r.z2)/2,w:.065,h:.05,d:length,ry:-yaw,color:'#a6ada9',rect:white})
    for(const t of[.05,.5,.95]){const x=r.x1+dx*t,z=r.z1+dz*t;b.box({x,y:(r.height+.32)/2,z,w:.06,h:r.height-.32,d:.06,color:'#65786d',rect:white});b.box({x,y:.34,z,w:.3,h:.04,d:.3,color:'#647267',rect:white})}
    collision.add({type:'box',x:(r.x1+r.x2)/2,z:(r.z1+r.z2)/2,hx:.05,hz:length/2,ry:-yaw,height:r.height,tag:'skate-rail'})
  }
  const mesh=new THREE.Mesh(b.build(),materials.opaque);mesh.name='waterfront-skate-rails';mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh)
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#254a3d';c.fillRect(0,0,768,256);c.fillStyle='#eee6ce';c.textAlign='center';c.font='bold 44px system-ui';c.fillText('WATERFRONT SKATE LINE',384,72);c.font='31px system-ui';c.fillText('Roll alongside a rail · F / FLIP to pop on',384,136);c.fillText('Steer to balance · F / FLIP to hop off',384,190)
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.8,1.26),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));sign.name='skate-line-sign';sign.position.set(config.sign.x,config.sign.y,config.sign.z);scene.add(sign)
  return {mesh,rails:config.rails}
}
