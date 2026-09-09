/** Direct-control waterfront tennis. Shared park host owns input, saves and world restoration. */
import * as THREE from 'three'
import { createTennisMatch, stepTennis } from './sports-tennis-core.js'
import { createSportsActor } from './sports-actors.js'

export async function createTennis({aspect=1.6,mode='match',finish,playSound}){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#becdc1');scene.fog=new THREE.Fog('#becdc1',36,78)
  const camera=new THREE.PerspectiveCamera(45,aspect,.1,100);camera.position.set(0,16,22);camera.lookAt(0,0,0)
  const resources=[],material=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.88,...extra});resources.push(m);return m}
  const court=material('#527d95'),apron=material('#447562'),line=material('#f0eddb'),pole=material('#e2e0d2'),fence=material('#526b5b'),ballMaterial=material('#e3f277',{roughness:.55}),racketMaterial=material('#e1a854',{roughness:.45,metalness:.2})
  const box=(x,y,z,w,h,d,m)=>{const g=new THREE.BoxGeometry(w,h,d);resources.push(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.receiveShadow=true;scene.add(mesh);return mesh}
  box(0,-.12,0,18,.2,30,apron);box(0,0,0,8.2,.035,20,court)
  for(const x of[-4.1,4.1])box(x,.026,0,.065,.008,20,line)
  for(const z of[-10,-6.4,0,6.4,10])box(0,.028,z,8.2,.008,.065,line)
  box(0,.03,0,.06,.008,12.8,line)
  for(const x of[-4.8,4.8])box(x,.55,0,.12,1.1,.12,pole)
  const netVertices=[];for(let x=-4.7;x<=4.7;x+=.24)netVertices.push(x,.08,0,x,1.0,0);for(let y=.08;y<=1;y+=.16)netVertices.push(-4.7,y,0,4.7,y,0)
  const netGeometry=new THREE.BufferGeometry();netGeometry.setAttribute('position',new THREE.Float32BufferAttribute(netVertices,3));resources.push(netGeometry);const netMaterial=new THREE.LineBasicMaterial({color:'#e2e8d8',transparent:true,opacity:.65});resources.push(netMaterial);scene.add(new THREE.LineSegments(netGeometry,netMaterial));box(0,1.025,0,9.5,.065,.04,pole)
  for(const z of[-13,13])for(let x=-8;x<=8;x+=2)box(x,1.3,z,.055,2.6,.055,fence)
  for(const x of[-8,8])for(let z=-13;z<=13;z+=2)box(x,1.3,z,.055,2.6,.055,fence)
  const wire=[]
  for(const x of[-8,8]){for(const y of[.2,2.5])box(x,y,0,.035,.04,26,fence);for(let z=-13;z<=13;z+=.3)wire.push(x,.22,z,x,2.48,z);for(let y=.3;y<2.5;y+=.3)wire.push(x,y,-13,x,y,13)}
  for(const z of[-13,13]){for(const y of[.2,2.5]){box(-4.5,y,z,7,.04,.035,fence);box(4.5,y,z,7,.04,.035,fence)}for(let x=-8;x<=8;x+=.3)if(Math.abs(x)>1)wire.push(x,.22,z,x,2.48,z);for(let y=.3;y<2.5;y+=.3){wire.push(-8,y,z,-1,y,z,1,y,z,8,y,z)}}
  const fenceGeometry=new THREE.BufferGeometry();fenceGeometry.setAttribute('position',new THREE.Float32BufferAttribute(wire,3));const wireMaterial=new THREE.LineBasicMaterial({color:'#78917e',transparent:true,opacity:.55});resources.push(fenceGeometry,wireMaterial);scene.add(new THREE.LineSegments(fenceGeometry,wireMaterial))
  for(const x of[-6.6,6.6]){box(x,.55,5.5,.7,.16,3.4,material('#8c795e'));box(x,.88,5.5,.13,.66,3.4,material('#8c795e'))}
  scene.add(new THREE.HemisphereLight('#f3f6e4','#405449',2.1));const sun=new THREE.DirectionalLight('#fff5de',2.2);sun.position.set(-12,25,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-14,right:14,top:18,bottom:-18,near:1,far:65});sun.shadow.normalBias=.03;scene.add(sun)
  const loaded=await Promise.allSettled([createSportsActor({id:'player'}),createSportsActor({id:'park:jules'})])
  if(loaded.some(item=>item.status==='rejected')){for(const item of loaded)if(item.status==='fulfilled')item.value.dispose();for(const resource of resources)resource.dispose();scene.clear();throw new Error('The tennis players could not load.')}
  const people=loaded.map(item=>item.value);for(const person of people)scene.add(person.group)
  const makeRacket=()=>{const g=new THREE.Group(),hoopGeometry=new THREE.TorusGeometry(.3,.025,5,24),handleGeometry=new THREE.CylinderGeometry(.025,.035,.5,7);resources.push(hoopGeometry,handleGeometry);const hoop=new THREE.Mesh(hoopGeometry,racketMaterial);hoop.scale.set(.8,1.08,1);hoop.position.y=.38;const handle=new THREE.Mesh(handleGeometry,racketMaterial);handle.position.y=-.03;g.add(hoop,handle);scene.add(g);return g};const rackets=[makeRacket(),makeRacket()]
  const grips=people.map((person,index)=>createRacketGrip(person,rackets[index]))
  const ballGeometry=new THREE.SphereGeometry(.16,12,8);resources.push(ballGeometry);const ball=new THREE.Mesh(ballGeometry,ballMaterial);ball.castShadow=true;scene.add(ball)
  const ringGeometry=new THREE.RingGeometry(.45,.53,28);resources.push(ringGeometry);const ringMaterial=new THREE.MeshBasicMaterial({color:'#f7e9a3',side:THREE.DoubleSide,transparent:true,opacity:.65});resources.push(ringMaterial);const landing=new THREE.Mesh(ringGeometry,ringMaterial);landing.rotation.x=-Math.PI/2;landing.position.y=.055;scene.add(landing)
  const model=createTennisMatch({target:mode==='match'?3:1000000}),last=[{x:0,z:8.2},{x:0,z:-8}],swing=[0,0];let finished=false
  function inReach(){const b=model.ball;return b&&b.lastHit==='opponent'&&(!b.serve||b.bounces>0)&&Math.abs(b.x-model.player.x)<1.25&&Math.abs(b.z-model.player.z)<1.65&&b.y>.2&&b.y<2.65}
  function watchInput(){const b=model.ball;let x=0;if(b?.lastHit==='opponent'){const t=Math.max(0,(model.player.z-b.z)/b.vz);x=Math.max(-3.8,Math.min(3.8,b.x+b.vx*t))}return {move:{x:Math.abs(x-model.player.x)>.16?Math.sign(x-model.player.x):0,z:Math.abs(8.2-model.player.z)>.2?Math.sign(8.2-model.player.z):0},primaryPressed:model.phase==='serve'&&model.server==='player'||inReach(),pointerAim:{x:0,y:0}}}
  return {
    scene,camera,
    update(dt,input){
      if(finished)return
      stepTennis(model,dt,mode==='watch'?watchInput():input)
      for(const event of model.events){playSound?.(event==='hit'?'tennis-hit':event==='bounce'?'tennis-bounce':event==='point'?'sports-whistle':'ui-blip');if(event==='hit')swing[model.ball?.lastHit==='opponent'?1:0]=.3}
      for(const[i,p]of[model.player,model.opponent].entries()){const speed=dt>0?Math.hypot(p.x-last[i].x,p.z-last[i].z)/dt:0,heading=speed>.2&&swing[i]<=0?Math.atan2(p.x-last[i].x,p.z-last[i].z):i===0?Math.PI:0;grips[i].reset();people[i].update(dt,{x:p.x,z:p.z,y:0,yaw:heading,speed,state:speed>.2?'run':'idle'});grips[i].update(swing[i]);swing[i]=Math.max(0,swing[i]-dt);last[i]={x:p.x,z:p.z}}
      ball.visible=!!model.ball;if(model.ball){ball.position.set(model.ball.x,model.ball.y,model.ball.z);const b=model.ball,t=Math.max(0,(b.vy+Math.sqrt(b.vy*b.vy+19.6*Math.max(0,b.y-.12)))/9.8);landing.position.set(b.x+b.vx*t,.055,b.z+b.vz*t);landing.visible=b.lastHit==='opponent'&&b.bounces===0}else landing.visible=false
      if(model.phase==='done'&&!finished){finished=true;playSound?.('sports-bell');finish({won:model.winner==='player',scoreFor:model.score.player,scoreAgainst:model.score.opponent,bestMetric:model.bestRally,message:model.winner==='player'?'Jules: “Good placement. That one is yours.”':'Jules: “Good rallies. Want another go?”'})}
    },
    hud(){return {title:mode==='watch'?'TENNIS · WATCHING':mode==='practice'?'TENNIS · PRACTICE RALLY':'TENNIS · FIRST TO 3',score:`YOU ${model.score.player} — ${model.score.opponent} JULES`,status:inReach()?'SWING NOW · the ball is in reach':model.status,instruction:'WASD / stick: move · Space / SWING: timing · left/right while swinging: placement · Q / LOB: high return',primaryLabel:model.phase==='serve'&&model.server==='player'?'SERVE':'SWING',secondaryLabel:'LOB',guardLabel:''}},
    snapshot(){return structuredClone({...model,inReach:!!inReach(),mode,handGrips:grips.map(grip=>grip.valid)})},
    resize(value){camera.aspect=value;camera.updateProjectionMatrix()},
    dispose(){sun.shadow.map?.dispose();for(const p of people)p.dispose?.();for(const r of resources)r.dispose?.();scene.clear()},
  }
}

/** A small arm overlay keeps the racket grip in the actual authored right hand. */
function createRacketGrip(actor,racket){
  const bones=[];actor.group.traverse(object=>{if(object.isBone)bones.push(object)})
  const find=roles=>bones.find(bone=>{const name=bone.name.toLowerCase().replace(/[^a-z]/g,'');return roles.some(role=>name.endsWith(role+'r')||name==='right'+role)})
  const upper=find(['upperarm','arm']),elbow=find(['lowerarm','forearm']),hand=find(['hand','wrist']),valid=Boolean(upper&&elbow&&hand)
  const rest=new Map([upper,elbow].filter(Boolean).map(bone=>[bone,bone.quaternion.clone()])),jointPosition=new THREE.Vector3(),handPosition=new THREE.Vector3(),from=new THREE.Vector3(),to=new THREE.Vector3(),target=new THREE.Vector3(),rotation=new THREE.Quaternion(),parentRotation=new THREE.Quaternion(),localRotation=new THREE.Quaternion()
  return {valid,reset(){for(const[bone,q]of rest)bone.quaternion.copy(q)},update(remaining){
    actor.group.updateMatrixWorld(true)
    const arc=Math.sin(Math.max(0,remaining)/.3*Math.PI)
    target.set(.45-arc*.28,1.05+arc*.18,.26+arc*.45);actor.group.localToWorld(target)
    if(valid){for(let pass=0;pass<4;pass++)for(const joint of [elbow,upper]){joint.getWorldPosition(jointPosition);hand.getWorldPosition(handPosition);from.subVectors(handPosition,jointPosition);to.subVectors(target,jointPosition);if(from.lengthSq()<1e-8||to.lengthSq()<1e-8)continue;rotation.setFromUnitVectors(from.normalize(),to.normalize());joint.parent.getWorldQuaternion(parentRotation);localRotation.copy(parentRotation).invert().multiply(rotation).multiply(parentRotation);joint.quaternion.premultiply(localRotation);joint.updateWorldMatrix(false,true)}hand.getWorldPosition(racket.position)}else racket.position.copy(target)
    racket.quaternion.copy(actor.group.quaternion);racket.rotateY(-arc*1.25);racket.rotateZ(-.2)
  }}
}
