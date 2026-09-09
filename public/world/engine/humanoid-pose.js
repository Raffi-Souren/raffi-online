/** Small two-bone presentation solver. Simulation/collision stay authoritative. */
import * as THREE from 'three'
const v=()=>new THREE.Vector3(),q=()=>new THREE.Quaternion()
export function createBoardPose(model){
  model.updateMatrixWorld(true)
  const pelvis=model.getObjectByName('pelvis'),rootRotation=model.getWorldQuaternion(q())
  const limbs=['l','r'].map(side=>({side,hip:model.getObjectByName('thigh_'+side),knee:model.getObjectByName('calf_'+side),ankle:model.getObjectByName('foot_'+side)}))
  for(const leg of limbs)if(leg.ankle){leg.footRest=rootRotation.clone().invert().multiply(leg.ankle.getWorldQuaternion(q()))}
  const a=v(),b=v(),c=v(),target=v(),direction=v(),pole=v(),bend=v(),knee=v(),from=v(),to=v(),delta=q(),parent=q(),world=q()
  function aim(joint,child,point){
    joint.getWorldPosition(a);child.getWorldPosition(b);from.copy(b).sub(a).normalize();to.copy(point).sub(a).normalize();delta.setFromUnitVectors(from,to)
    joint.parent.getWorldQuaternion(parent);joint.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));joint.updateWorldMatrix(false,true)
  }
  function solve(leg,point){
    if(!leg.hip||!leg.knee||!leg.ankle)return
    leg.hip.getWorldPosition(a);leg.knee.getWorldPosition(b);leg.ankle.getWorldPosition(c)
    const origin=a.clone(),l1=a.distanceTo(b),l2=b.distanceTo(c),distance=Math.min(l1+l2-.0001,Math.max(.01,a.distanceTo(point)))
    direction.copy(point).sub(a).normalize();pole.set(0,0,1).transformDirection(model.matrixWorld)
    bend.copy(pole).addScaledVector(direction,-pole.dot(direction)).normalize()
    const along=(l1*l1-l2*l2+distance*distance)/(2*distance)
    knee.copy(origin).addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)))
    aim(leg.hip,leg.knee,knee);aim(leg.knee,leg.ankle,point)
    model.getWorldQuaternion(world);world.multiply(leg.footRest);leg.ankle.parent.getWorldQuaternion(parent);leg.ankle.quaternion.copy(parent.invert().multiply(world));leg.ankle.updateWorldMatrix(false,true)
  }
  return {update(pose={},speed=0,time=0){
    model.updateMatrixWorld(true)
    if(pelvis){const p=pelvis.getWorldPosition(v());p.y-=.10+(pose.crouch||0);pelvis.position.copy(pelvis.parent.worldToLocal(p));pelvis.updateWorldMatrix(false,true)}
    for(const leg of limbs){
      const side=leg.side==='l'?1:-1
      target.set(side*.225,.09,side*.012)
      // A small trailing-foot flick clears the deck during the flip; both
      // shoes return to grip before the board descends.
      if(pose.airborne&&!pose.catch){target.y+=.08;target.z+=side===-1?.08:0}
      model.localToWorld(target);solve(leg,target)
    }
    for(const side of['l','r']){const upper=model.getObjectByName('upperarm_'+side),elbow=model.getObjectByName('lowerarm_'+side);if(!upper||!elbow)continue
      const sign=side==='l'?1:-1;target.set(sign*(pose.airborne?.42:.29),1.08-(pose.crouch||0)*.6,.04+(pose.balance||0)*.07);model.localToWorld(target);aim(upper,elbow,target)
    }
  }}
}
