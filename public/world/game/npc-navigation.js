/** Bounded local detours for a sidewalk errand blocked by solid street geometry. */
export function pedestrianDetour(from, goal, clear, { cell = .8, limit = 320 } = {}) {
  const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z)
  if (distance(from,goal)>70 || !clear(goal,goal)) return null
  if (clear(from,goal)) return [goal]
  const start={x:from.x,z:from.z,ix:0,iz:0,g:0,parent:null}, open=[start], best=new Map([['0,0',0]])
  let visited=0
  while(open.length && visited++<limit){
    open.sort((a,b)=>a.g+distance(a,goal)-b.g-distance(b,goal))
    const current=open.shift()
    if(distance(current,goal)<cell*1.5 && clear(current,goal)){
      const path=[goal];for(let n=current;n.parent;n=n.parent)path.unshift({x:n.x,z:n.z})
      return path
    }
    for(const [ix,iz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
      const next={ix:current.ix+ix,iz:current.iz+iz,parent:current,g:current.g+Math.hypot(ix,iz)*cell}
      next.x=from.x+next.ix*cell;next.z=from.z+next.iz*cell
      const key=next.ix+','+next.iz
      if((best.get(key)??Infinity)<=next.g || !clear(current,next))continue
      best.set(key,next.g);open.push(next)
    }
  }
  return null
}
