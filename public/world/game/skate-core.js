/** Authored park lines, shared by visible rails, collision and trick capture. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v))
const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v)}
export function kickflipPose(time,duration=.92){
  const u=clamp(time/duration,0,1),air=clamp((u-.16)/.68,0,1)
  return {u,boardHop:Math.sin(air*Math.PI)*.57, riderHop:Math.sin(air*Math.PI)*.65,
    flip:Math.PI*2*smooth((u-.25)/.43),pitch:-.22*Math.sin(clamp((u-.13)/.22,0,1)*Math.PI),
    crouch:u<.16?.17*smooth(u/.16):u>.78?.16*Math.sin(clamp((u-.78)/.22,0,1)*Math.PI):.10+.10*Math.sin(air*Math.PI),
    airborne:u>.16&&u<.84,catch:u>.67}
}
export function railProjection(rail,x,z){
  const dx=rail.x2-rail.x1,dz=rail.z2-rail.z1,length=Math.hypot(dx,dz),tx=dx/length,tz=dz/length
  const along=(x-rail.x1)*tx+(z-rail.z1)*tz
  return {along,length,tx,tz,x:rail.x1+tx*clamp(along,0,length),z:rail.z1+tz*clamp(along,0,length),distance:Math.hypot(x-(rail.x1+tx*clamp(along,0,length)),z-(rail.z1+tz*clamp(along,0,length)))}
}
export function catchGrind(ride,trick,rails=[]){
  if(!trick||Math.abs(ride.speed)<1.8)return null
  const pose=kickflipPose(trick.t,trick.duration)
  if(pose.u<.65||pose.u>.82)return null
  for(const rail of rails){const p=railProjection(rail,ride.x,ride.z),alignment=Math.sin(ride.yaw)*p.tx+Math.cos(ride.yaw)*p.tz
    if(p.distance<.62&&p.along>.15&&p.along<p.length-.15&&Math.abs(alignment)>.84){return {rail,along:p.along,direction:Math.sign(alignment)*Math.sign(ride.speed),speed:Math.max(2,Math.abs(ride.speed)),distance:0,balance:0,time:0}}
  }
  return null
}
export function stepGrind(grind,dt,steer=0,brake=0){
  if(!Number.isFinite(dt)||dt<=0)return {done:false}
  const p=railProjection(grind.rail,grind.rail.x1,grind.rail.z1)
  grind.time+=dt;grind.speed=Math.max(0,grind.speed-(.5+brake*8)*dt)
  const step=grind.speed*dt;grind.along+=step*grind.direction;grind.distance+=step
  grind.balance=clamp(grind.balance+(steer*.9+Math.sin(grind.time*2.8)*.17)*dt,-1.2,1.2)
  const done=grind.along<=0||grind.along>=p.length||Math.abs(grind.balance)>1||grind.speed<1.2
  return {done,x:grind.rail.x1+p.tx*clamp(grind.along,0,p.length),z:grind.rail.z1+p.tz*clamp(grind.along,0,p.length),yaw:Math.atan2(p.tx*grind.direction,p.tz*grind.direction),height:grind.rail.height-.055,points:done&&grind.distance>=2?Math.floor(grind.distance)*25:0}
}
