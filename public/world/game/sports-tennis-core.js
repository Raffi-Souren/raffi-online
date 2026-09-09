/** Singles tiebreak with gravity, net, legal bounces, timed shots and a fallible opponent. */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n))
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296}
export function createTennisMatch({seed=27183,target=3}={}){return {seed:seed>>>0,target,cap:target,phase:'serve',server:'player',pointTimer:0,time:0,player:{x:0,z:8.2},opponent:{x:0,z:-8},ball:null,score:{player:0,opponent:0},rally:0,bestRally:0,returns:0,aim:0,cooldown:0,status:'Your serve · Space or SWING',winner:null,events:[]}}
function launch(s,side,aim=0,lob=false,serve=false){
  const person=side==='player'?s.player:s.opponent,sign=side==='player'?-1:1
  const targetX=clamp(aim,-1,1)*3.4,targetZ=sign*6.6
  const flight=lob?1.85:1.34,startY=1.15,gravity=9.8
  s.ball={x:person.x,y:startY,z:person.z+sign*.45,vx:(targetX-person.x)/flight,vz:(targetZ-(person.z+sign*.45))/flight,vy:(.5*gravity*flight*flight-startY)/flight,lastHit:side,bounces:0,serve}
  s.phase='rally';s.cooldown=.2;s.events.push('hit');s.status=side==='player'?'Get ready for the return':'Move to the ball · time your swing'
}
export function swingTennis(s,{aim=s.aim,lob=false}={}){
  if(s.phase==='done'||s.cooldown>0)return false
  if(s.phase==='serve'&&s.server==='player'){launch(s,'player',aim,lob,true);return true}
  const b=s.ball
  if(s.phase!=='rally'||!b||b.lastHit!=='opponent'||(b.serve&&b.bounces===0))return false
  s.cooldown=.18
  if(Math.abs(b.x-s.player.x)>1.25||Math.abs(b.z-s.player.z)>1.65||b.y<.2||b.y>2.65){s.status='Too early · let it come into reach';s.events.push('miss');return false}
  s.rally++;s.returns++;s.bestRally=Math.max(s.bestRally,s.rally);launch(s,'player',aim,lob);return true
}
function point(s,winner,reason){
  s.score[winner]++;s.ball=null;s.phase='point';s.pointTimer=1.4;s.status=(winner==='player'?'Your point':'Their point')+' · '+reason;s.events.push(winner==='player'?'point':'miss')
  const a=s.score.player,b=s.score.opponent
  if(Math.max(a,b)>=s.target){s.phase='done';s.winner=a>b?'player':'opponent';s.status=s.winner==='player'?'You won the waterfront tiebreak':'Good match · try another tiebreak';return}
  const total=a+b;s.server=total%4===0||total%4===3?'player':'opponent';s.rally=0
}
export function stepTennis(s,dt,input={}){
  if(!Number.isFinite(dt)||dt<=0||s.phase==='done')return s
  s.events=[]
  const move=input.move||{x:0,z:0};if(Math.abs(move.x)>.15)s.aim=clamp(move.x,-1,1)
  if(Number.isFinite(input.pointerAim?.x))s.aim=clamp(input.pointerAim.x,-1,1)
  if(input.primaryPressed||input.secondaryPressed)swingTennis(s,{aim:s.aim,lob:!!input.secondaryPressed})
  for(let remaining=Math.min(dt,.1);remaining>.00001;){const h=Math.min(1/120,remaining);remaining-=h;s.time+=h;s.cooldown=Math.max(0,s.cooldown-h)
    s.player.x=clamp(s.player.x+clamp(move.x||0,-1,1)*4.8*h,-4.1,4.1);s.player.z=clamp(s.player.z+clamp(move.z||0,-1,1)*4.8*h,2.8,9.5)
    if(s.phase==='point'){s.pointTimer-=h;if(s.pointTimer<=0){s.phase='serve';s.player.z=8.2;s.opponent.z=-8;s.status=s.server==='player'?'Your serve · Space or SWING':'Opponent serves shortly';s.pointTimer=1.1}continue}
    if(s.phase==='serve'){if(s.server==='opponent'){s.pointTimer-=h;if(s.pointTimer<=0)launch(s,'opponent',(random(s)-.5)*1.1,false,true)}continue}
    const b=s.ball;if(!b)continue
    const oldZ=b.z;b.x+=b.vx*h;b.z+=b.vz*h;b.y+=b.vy*h;b.vy-=9.8*h
    if(oldZ*b.z<0&&b.y<1.04){point(s,b.lastHit==='player'?'opponent':'player','net');continue}
    if(b.y<=.12&&b.vy<0){
      if(b.bounces===0&&(Math.abs(b.x)>4.1||Math.abs(b.z)>10)){point(s,b.lastHit==='player'?'opponent':'player','out');continue}
      b.bounces++;b.y=.12;b.vy=-b.vy*.7;s.events.push('bounce')
      if(b.bounces>=2){point(s,b.lastHit,'second bounce');continue}
    }
    if(Math.abs(b.z)>12.5||Math.abs(b.x)>7){point(s,b.lastHit,'not returned');continue}
    const target=b.lastHit==='player'?clamp(b.x+b.vx*Math.max(0,(-8-b.z)/b.vz),-3.9,3.9):0
    s.opponent.x+=clamp(target-s.opponent.x,-3.05*h,3.05*h)
    if(b.lastHit==='player'&&b.bounces>0&&Math.abs(b.z-s.opponent.z)<1.45&&Math.abs(b.x-s.opponent.x)<1.05&&b.y>.25&&b.y<2.7&&s.cooldown<=0){
      s.rally++;s.bestRally=Math.max(s.bestRally,s.rally)
      // Every return is played; occasional wide placement is a visible, physical error.
      const error=random(s)>.9,aim=error?(random(s)>.5?1.42:-1.42):clamp((s.player.x+(random(s)-.5)*4)/3.4,-.95,.95)
      launch(s,'opponent',aim,false);if(error)s.ball.vx=((Math.sign(aim)||1)*5.5-s.opponent.x)/1.34
    }
  }
  return s
}
