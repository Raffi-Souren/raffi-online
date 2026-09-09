/** One non-injurious street jab: authored pose, timed contact, bounded recovery. */
export function punchTarget(player,candidates){
  return candidates.filter(actor=>{const dx=actor.x-player.x,dz=actor.z-player.z,d=Math.hypot(dx,dz);return d>.15&&d<1.65&&(dx*Math.sin(player.yaw)+dz*Math.cos(player.yaw))/d>.45}).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0]||null
}
export function createStreetCombat({scene,state,collision,character,moveCircle,onHit=()=>{}}){
  let attack=null,cooldown=0,hits=0
  return {
    punch(){if(state.mode!=='foot'||state.interior||attack||cooldown>0||state.paused)return false;attack={time:0,contact:false};cooldown=.72;character.playPunch();return true},
    update(dt){
      if(state.mode!=='foot'||state.interior){attack=null;cooldown=0;return}
      cooldown=Math.max(0,cooldown-dt);if(!attack)return
      attack.time+=dt
      if(!attack.contact&&attack.time>=.22){
        attack.contact=true;const actors=[]
        scene.traverse(o=>{if(o.userData.rig!=='biped'||o.parent?.name==='player')return;for(let p=o;p;p=p.parent)if(!p.visible)return;actors.push({x:o.position.x,z:o.position.z,mesh:o})})
        const target=punchTarget(state.player,actors)
        if(target){const p=state.player,contact=moveCircle(collision,p.x,p.z,target.x-p.x,target.z-p.z,.08)
          if(Math.hypot(contact.x-target.x,contact.z-target.z)<.18){target.mesh.userData.streetReaction={start:state.time,until:state.time+3.5,x:p.x,z:p.z};hits++;onHit(target.mesh)}
        }
      }
      if(attack.time>=.58)attack=null
    },
    snapshot:()=>({active:!!attack,cooldown,hits}),
    reset(){attack=null;cooldown=0;scene.traverse(o=>{delete o.userData.streetReaction})},
  }
}
