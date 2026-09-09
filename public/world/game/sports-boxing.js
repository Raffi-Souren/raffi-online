/** Friendly direct-control park sparring, rendered with the shared human assets. */
import * as THREE from 'three'
import { createSportsActor } from './sports-actors.js'
import { createBoxingMatch, stepBoxing, boxingAdvice, boxingWatchInput } from './sports-boxing-core.js'

// Character animation supplies footwork; a small two-joint IK overlay keeps
// actual skinned arms and attached gloves at the visible guard/punch targets.
function makeGloves(actor, scene, material, resources) {
  const bones=[];actor.group.traverse(o=>{if(o.isBone)bones.push(o)})
  const normalized=name=>name.toLowerCase().replace(/[^a-z]/g,'')
  const find=(side,roles)=>bones.find(b=>roles.some(role=>normalized(b.name).endsWith(role+side)||normalized(b.name)===(side==='l'?'left':'right')+role))
  const arms=['l','r'].map(side=>({upper:find(side,['upperarm','arm']),elbow:find(side,['lowerarm','forearm']),hand:find(side,['hand','wrist'])}))
  const geometry=new THREE.SphereGeometry(.125,12,8);resources.add(geometry)
  const gloves=arms.map(()=>{const mesh=new THREE.Mesh(geometry,material);mesh.scale.set(.9,1.08,1.28);mesh.castShadow=true;scene.add(mesh);return mesh})
  const rest=new Map(arms.flatMap(a=>[a.upper,a.elbow]).filter(Boolean).map(b=>[b,b.quaternion.clone()]))
  const jointPosition=new THREE.Vector3(),handPosition=new THREE.Vector3(),from=new THREE.Vector3(),to=new THREE.Vector3(),target=new THREE.Vector3()
  const delta=new THREE.Quaternion(),parentRotation=new THREE.Quaternion(),inverseParent=new THREE.Quaternion(),localDelta=new THREE.Quaternion()
  const solve=(arm,point)=>{
    if(!arm.upper||!arm.elbow||!arm.hand)return false
    for(let pass=0;pass<5;pass++)for(const joint of [arm.elbow,arm.upper]){
      joint.getWorldPosition(jointPosition);arm.hand.getWorldPosition(handPosition)
      from.copy(handPosition).sub(jointPosition);to.copy(point).sub(jointPosition)
      if(from.lengthSq()<1e-8||to.lengthSq()<1e-8)continue
      from.normalize();to.normalize();delta.setFromUnitVectors(from,to)
      joint.parent.getWorldQuaternion(parentRotation);inverseParent.copy(parentRotation).invert()
      localDelta.copy(inverseParent).multiply(delta).multiply(parentRotation)
      joint.quaternion.premultiply(localDelta);joint.updateWorldMatrix(false,true)
    }
    return true
  }
  return {
    reset(){for(const[bone,rotation]of rest)bone.quaternion.copy(rotation)},
    update(fighter){
      actor.group.updateMatrixWorld(true)
      const attack=fighter.attack
      let extension=0,wind=0
      if(attack){
        const remaining=attack.impactAt-attack.elapsed
        if(remaining>0)wind=THREE.MathUtils.clamp(attack.elapsed/attack.impactAt,0,1)
        // Extension peaks exactly on the simulation's contact frame.
        extension=attack.elapsed<attack.impactAt?Math.pow(THREE.MathUtils.clamp((attack.elapsed-(attack.impactAt-.15))/.15,0,1),1.4):Math.max(0,1-(attack.elapsed-attack.impactAt)/.22)
      }
      for(const[i,arm]of arms.entries()){
        const side=i===0?1:-1,lead=attack&&(attack.kind==='counter'||attack.kind==='body'?i===1:i===0)
        const x=side*(fighter.guarding?.20:.25)*(lead?1-extension*.38:1)
        const y=fighter.guarding?1.48:lead&&attack.kind==='body'?1.16:1.36
        const z=(fighter.guarding?.32:.31)+(lead?extension*.54-wind*.06:0)
        target.set(x,y,z);actor.group.localToWorld(target)
        if(solve(arm,target)){
          arm.hand.getWorldPosition(gloves[i].position);arm.hand.getWorldQuaternion(gloves[i].quaternion)
          arm.elbow.getWorldPosition(from);from.subVectors(gloves[i].position,from).normalize()
          // Cover the palm/fingers beyond the wrist joint, not just the cuff.
          gloves[i].position.addScaledVector(from,.065)
        }
        else{gloves[i].position.copy(target);gloves[i].quaternion.copy(actor.group.quaternion)}
      }
    },
    status:arms.map(arm=>Boolean(arm.upper&&arm.elbow&&arm.hand)),
  }
}

export async function createBoxing({aspect=1.6,mode='match',finish=()=>{},playSound=()=>{}}={}) {
  const scene=new THREE.Scene();scene.background=new THREE.Color('#c0cfc5');scene.fog=new THREE.Fog('#c0cfc5',24,62)
  const camera=new THREE.PerspectiveCamera(46,aspect,.1,80)
  const frameCamera=value=>{const scale=Math.max(1,1.15/value);camera.position.set(3.9*scale,4.3*scale,6.9*scale);camera.lookAt(0,1.0,0);camera.aspect=value;camera.updateProjectionMatrix()}
  frameCamera(aspect)
  const viewYaw=Math.atan2(3.9,6.9),viewCos=Math.cos(viewYaw),viewSin=Math.sin(viewYaw)
  const resources=new Set(),mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.87,...extra});resources.add(m);return m}
  const canvas=mat('#657f91'),edge=mat('#435b68'),chalk=mat('#e7e2ce'),iron=mat('#40584d'),wood=mat('#8a7352'),grass=mat('#748b67'),blue=mat('#446ca0',{roughness:.6}),gold=mat('#cba454',{roughness:.6})
  const box=(x,y,z,w,h,d,material)=>{const g=new THREE.BoxGeometry(w,h,d);resources.add(g);const mesh=new THREE.Mesh(g,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh}
  box(0,-.15,0,28,.15,28,grass);box(0,.035,0,7.4,.3,7.4,edge);box(0,.195,0,6.8,.025,6.8,canvas)
  for(const x of[-2.85,2.85])box(x,.213,0,.028,.006,5.7,chalk)
  for(const z of[-2.85,2.85])box(0,.213,z,5.7,.006,.028,chalk)
  box(0,.215,0,.07,.006,1.0,chalk);box(0,.215,0,1.0,.006,.07,chalk)
  for(const x of[-3.35,3.35])for(const z of[-3.35,3.35]){box(x,.98,z,.16,1.56,.16,iron);box(x,1.13,z,.24,.82,.24,z>0?blue:gold)}
  const ropeGeometry=new THREE.CylinderGeometry(.024,.024,6.7,7);resources.add(ropeGeometry)
  for(const y of[.75,1.15,1.55])for(const side of[-1,1]){
    const horizontal=new THREE.Mesh(ropeGeometry,chalk);horizontal.position.set(0,y,side*3.35);horizontal.rotation.z=Math.PI/2;scene.add(horizontal)
    const vertical=new THREE.Mesh(ropeGeometry,chalk);vertical.position.set(side*3.35,y,0);vertical.rotation.x=Math.PI/2;scene.add(vertical)
  }
  for(const x of[-6,6]){box(x,.48,-2.4,.72,.15,3.0,wood);box(x,.85,-2.75,.72,.63,.1,wood);for(const z of[-3.5,-1.3])box(x,.23,z,.45,.4,.1,iron)}
  for(let x=-10;x<=10;x+=2)box(x,1.1,-8,.08,2.2,.08,iron)
  for(const y of[.45,1.8])box(0,y,-8,20,.065,.065,iron)
  scene.add(new THREE.HemisphereLight('#f1f5e6','#586a56',2.0))
  const sun=new THREE.DirectionalLight('#fff3db',2.2);sun.position.set(-8,15,9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:35});sun.shadow.normalBias=.025;scene.add(sun)
  const loaded=await Promise.allSettled([createSportsActor({id:'player'}),createSportsActor({id:'park:jules'})])
  if(loaded.some(r=>r.status==='rejected')){
    for(const r of loaded)if(r.status==='fulfilled')r.value.dispose()
    for(const r of resources)r.dispose();scene.clear()
    throw new Error('The park sparring characters could not load.')
  }
  const people=loaded.map(r=>r.value);for(const person of people)scene.add(person.group)
  const gloves=people.map((person,i)=>makeGloves(person,scene,i===0?blue:gold,resources))
  const ringGeometry=new THREE.RingGeometry(.43,.47,32);resources.add(ringGeometry)
  const markers=[blue,gold].map((_,i)=>{const material=new THREE.MeshBasicMaterial({color:i===0?'#81afe0':'#e4bd71',side:THREE.DoubleSide});resources.add(material);const mesh=new THREE.Mesh(ringGeometry,material);mesh.rotation.x=-Math.PI/2;mesh.position.y=.216;scene.add(mesh);return mesh})
  const model=createBoxingMatch({mode});let finished=false,disposed=false
  const pose=dt=>{
    for(const[i,fighter]of[model.player,model.opponent].entries()){
      if(dt===0)people[i].group.rotation.y=fighter.yaw
      gloves[i].reset();people[i].update(dt,{x:fighter.x,y:.21,z:fighter.z,yaw:fighter.yaw,speed:fighter.speed,state:fighter.speed>.15?'walk':'idle'});gloves[i].update(fighter)
      markers[i].position.set(fighter.x,.216,fighter.z)
      const telegraph=i===1&&fighter.attack&&!fighter.attack.resolved
      markers[i].material.color.set(telegraph?'#e49743':fighter.guarding?'#b2d8bf':i===0?'#81afe0':'#e4bd71')
      markers[i].scale.setScalar(telegraph?1+fighter.attack.elapsed/fighter.attack.impactAt*.3:1)
    }
  }
  pose(0)
  return {
    scene,camera,
    update(dt,input={}){
      if(finished||disposed)return
      const movement=input.move||{x:0,z:0}
      const mx=Number.isFinite(movement.x)?movement.x:0,mz=Number.isFinite(movement.z)?movement.z:0
      const directed={...input,move:{x:mx*viewCos+mz*viewSin,z:-mx*viewSin+mz*viewCos}}
      stepBoxing(model,dt,mode==='watch'?boxingWatchInput(model):directed)
      for(const event of model.events){if(event.type==='bell')playSound('sports-bell');else if(event.type==='touch')playSound('boxing-touch');else if(event.type==='guard')playSound('boxing-guard');else if(event.type==='telegraph')playSound('ui-blip')}
      pose(dt)
      if(model.phase==='done'){
        finished=true
        finish({won:model.winner==='player',scoreFor:model.score.player,scoreAgainst:model.score.opponent,bestMetric:model.defenses+model.counters,message:model.winner==='draw'?'Jules: “Even round. Good work — touch gloves.”':model.winner==='player'?'Jules: “Clean touches and good timing. Your round.”':'Jules: “Good practice. Keep watching the wind-up.”'})
      }
    },
    hud(){return {title:mode==='practice'?'BOXING · FRIENDLY PRACTICE':mode==='watch'?'BOXING · WATCH THE TIMING':'BOXING · FRIENDLY ROUND',score:`YOU ${model.score.player} — ${model.score.opponent} JULES · ${mode==='practice'?'PRACTICE':Math.ceil(model.timeLeft)+'s'} · STAMINA ${Math.round(model.player.stamina)}%`,status:boxingAdvice(model),instruction:'WASD / stick: move · Space: jab · Q: counter · E: guard. A timed guard opens a two-point counter.',primaryLabel:'JAB',secondaryLabel:'COUNTER',guardLabel:'GUARD'}},
    snapshot(){return structuredClone({...model,mode,inputBasis:{right:{x:viewCos,z:-viewSin},forward:{x:-viewSin,z:-viewCos}},riggedGloves:gloves.map(g=>g.status),advice:boxingAdvice(model)})},
    resize(value){frameCamera(value)},
    dispose(){if(disposed)return;disposed=true;for(const person of people)person.dispose();for(const resource of resources)resource.dispose();sun.shadow.map?.dispose();sun.shadow.mapPass?.dispose();scene.clear()},
  }
}
