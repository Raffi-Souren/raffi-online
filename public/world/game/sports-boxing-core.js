/** Friendly scored sparring. Timing, reach and stamina; no damage or injury model. */
const clamp = (n,a,b) => Math.max(a,Math.min(b,n))
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z)
const fighter = (z) => ({x:0,z,yaw:z>0?Math.PI:0,stamina:100,guarding:false,guardTime:0,attack:null,cooldown:0,recovery:0,counterUntil:0,speed:0})
export function createBoxingMatch({mode='match',duration=55,target=9}={}) {
  return {mode,phase:'ready',phaseTime:1.4,time:0,timeLeft:duration,target,player:fighter(1.5),opponent:fighter(-1.5),score:{player:0,opponent:0},defenses:0,perfectGuards:0,counters:0,turn:0,events:[],status:'Touch gloves. Keep it light.',statusTime:1.4,winner:null}
}
function say(model,text,seconds=.8){model.status=text;model.statusTime=seconds}
function finish(model){model.phase='done';model.winner=model.score.player===model.score.opponent?'draw':model.score.player>model.score.opponent?'player':'opponent';model.player.attack=model.opponent.attack=null;model.player.guarding=model.opponent.guarding=false;model.events.push({type:'bell'})}
function begin(model,who,kind){
  const p=model[who],opponent=who==='opponent'
  const cost=kind==='counter'?26:22
  if(!opponent&&(p.cooldown>0||p.attack||p.guarding))return false
  if(!opponent&&p.stamina<cost){say(model,'Reset your feet · release guard to recover stamina.');return false}
  if(!opponent)p.stamina-=cost
  p.attack={kind,elapsed:0,impactAt:opponent?(model.mode==='practice'?1.0:.72):kind==='counter'?.28:.17,duration:opponent?1.02:kind==='counter'?.68:.53,range:kind==='counter'?1.15:1.25,resolved:false,startDistance:distance(model.player,model.opponent)}
  if(!opponent)p.cooldown=kind==='counter'?.86:.72
  model.events.push({type:opponent?'telegraph':'swing',who,kind})
  return true
}
function impact(model,who){
  const p=model[who],other=who==='player'?model.opponent:model.player,attack=p.attack,close=distance(p,other)<=attack.range
  if(who==='opponent'){
    if(!close){if(attack.startDistance<2.3){model.defenses++;model.player.counterUntil=model.time+.65;model.events.push({type:'evade'});say(model,'Good distance · step in for a counter.')}return}
    if(other.guarding&&other.stamina>=12){
      other.stamina-=12;model.defenses++
      const timed=other.guardTime<=.34
      if(timed){model.perfectGuards++;other.counterUntil=model.time+.85;other.stamina=Math.min(100,other.stamina+5)}
      model.events.push({type:'guard',timed});say(model,timed?'TIMED GUARD · Q for a clean counter.':'Blocked · reset your guard.')
    }else{model.score.opponent++;model.events.push({type:'touch',who});say(model,'Jules: “Nice and light. Watch the next wind-up.”')}
  }else{
    if(!close){model.events.push({type:'miss',who});say(model,'Just out of reach · use your feet.');return}
    const counter=attack.kind==='counter'&&(model.time<=p.counterUntil||other.recovery>0)
    if(other.guarding&&!counter){model.events.push({type:'guard',who:'opponent'});say(model,'Jules is covered · wait for the opening.');return}
    const points=counter?2:1
    model.score.player+=points
    if(counter){model.counters++;p.counterUntil=0}
    model.events.push({type:'touch',who,points});say(model,counter?'CLEAN COUNTER · two points.':'Clean touch · one point.')
  }
}
function stepAttack(model,who,dt){
  const p=model[who],a=p.attack
  if(!a)return
  a.elapsed+=dt
  if(!a.resolved&&a.elapsed>=a.impactAt){a.resolved=true;impact(model,who);if(who==='opponent')p.recovery=.8}
  if(a.elapsed>=a.duration){p.attack=null;if(who==='opponent')p.cooldown=model.mode==='practice'?2.0:1.2}
}
function move(p,x,z,speed,dt){
  const magnitude=Math.max(1,Math.hypot(x,z)),oldX=p.x,oldZ=p.z
  p.x=clamp(p.x+x/magnitude*speed*dt,-2.7,2.7);p.z=clamp(p.z+z/magnitude*speed*dt,-2.7,2.7)
  p.speed=dt>0?Math.hypot(p.x-oldX,p.z-oldZ)/dt:0
}
export function stepBoxing(model,dt,input={}){
  if(model.phase==='done'||!Number.isFinite(dt)||dt<=0)return model
  model.events=[]
  let primary=!!input.primaryPressed,secondary=!!input.secondaryPressed
  for(let remain=Math.min(dt,.25);remain>1e-7;){
    const h=Math.min(1/120,remain);remain-=h;model.time+=h
    if(model.phase==='ready'){model.phaseTime-=h;if(model.phaseTime<=0){model.phase='round';model.events.push({type:'bell'});say(model,'Move into range. Space: jab · E: guard.')}continue}
    const p=model.player,o=model.opponent
    for(const f of [p,o]){f.cooldown=Math.max(0,f.cooldown-h);f.recovery=Math.max(0,f.recovery-h)}
    p.guarding=!!input.guardHeld&&!p.attack&&p.stamina>10
    p.guardTime=p.guarding?p.guardTime+h:0
    p.stamina=clamp(p.stamina+(p.guarding?-3.5:p.attack?1:9)*h,0,100)
    const movement=input.move||{}
    move(p,Number.isFinite(movement.x)?movement.x:0,Number.isFinite(movement.z)?movement.z:0,p.guarding?1.02:p.attack?1.15:p.stamina<18?1.65:2.4,h)
    const gap=distance(p,o)
    if(!o.attack){
      const towards=gap>1.1?1:gap<.92?-.7:0
      const drift=Math.sin(model.time*.7)*.22
      move(o,(p.x-o.x)/Math.max(.01,gap)*towards+drift,(p.z-o.z)/Math.max(.01,gap)*towards,model.mode==='practice'?.95:1.3,h)
      o.guarding=o.cooldown>.5&&model.turn%3===1
      if(o.cooldown<=0&&gap<1.23){begin(model,'opponent',model.turn++%3===2?'body':'jab');o.guarding=false}
    }else{o.speed=0;o.guarding=false}
    const separation=distance(p,o)
    if(separation<.86){const dx=separation?(p.x-o.x)/separation:0,dz=separation?(p.z-o.z)/separation:1,push=(.86-separation)/2;p.x=clamp(p.x+dx*push,-2.7,2.7);p.z=clamp(p.z+dz*push,-2.7,2.7);o.x=clamp(o.x-dx*push,-2.7,2.7);o.z=clamp(o.z-dz*push,-2.7,2.7)}
    p.yaw=Math.atan2(o.x-p.x,o.z-p.z);o.yaw=Math.atan2(p.x-o.x,p.z-o.z)
    if(primary){begin(model,'player','jab');primary=false}
    if(secondary){begin(model,'player','counter');secondary=false}
    stepAttack(model,'player',h);stepAttack(model,'opponent',h)
    model.timeLeft=Math.max(0,model.timeLeft-h);model.statusTime=Math.max(0,model.statusTime-h)
    if(model.mode!=='practice'&&(model.timeLeft<=0||Math.max(model.score.player,model.score.opponent)>=model.target)){finish(model);break}
  }
  return model
}
export function boxingAdvice(model){
  if(model.phase==='done')return 'Good round. Touch gloves.'
  if(model.phase==='ready')return model.status
  const p=model.player,o=model.opponent
  if(o.attack&&!o.attack.resolved)return o.attack.kind==='body'?'Jules steps in · E to guard, or move out of range.':'Jab coming · raise E guard as the gloves move.'
  if(p.counterUntil>model.time)return 'COUNTER WINDOW · release E, step into range, press Q.'
  if(model.statusTime>0)return model.status
  if(p.stamina<26)return 'Low stamina · take a step back and release guard.'
  if(o.guarding)return 'Jules is covered · move and wait for the opening.'
  return distance(p,o)>1.25?'Close the gap with your feet.':'In range · jab, then protect your space.'
}
export function boxingWatchInput(model){
  const p=model.player,o=model.opponent,gap=distance(p,o),wind=o.attack&&!o.attack.resolved?o.attack.impactAt-o.attack.elapsed:Infinity
  const guard=wind<.24&&wind>0
  const counter=p.counterUntil>model.time&&!p.attack
  const go=gap>1.07?1:gap<.94?-.7:0
  return {move:{x:(o.x-p.x)/Math.max(.01,gap)*go,z:(o.z-p.z)/Math.max(.01,gap)*go},guardHeld:guard,secondaryPressed:counter&&!guard,primaryPressed:!guard&&!counter&&!o.attack&&!o.guarding&&p.cooldown<=0&&p.stamina>65}
}
