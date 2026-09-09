import test from 'node:test'
import assert from 'node:assert/strict'
import {createBoxingMatch,stepBoxing,boxingWatchInput,boxingAdvice} from '../game/sports-boxing-core.js'
const frame=1/120
const ready=(mode='match')=>{const m=createBoxingMatch({mode});m.phase='round';m.player.z=.55;m.opponent.z=-.55;return m}
function run(m,seconds,input={}){for(let t=0;t<seconds-1e-8;t+=frame)stepBoxing(m,frame,typeof input==='function'?input(m):input)}

test('a jab scores once in reach, misses at distance, and held buttons cannot manufacture repeated touches',()=>{
  for(const close of [true,false]){const m=ready();m.opponent.cooldown=99;if(!close)m.player.z=2.7;stepBoxing(m,frame,{primaryPressed:true});run(m,.6,{primaryHeld:true});assert.equal(m.score.player,close?1:0);assert.ok(m.player.stamina<100);run(m,2,{primaryHeld:true});assert.equal(m.score.player,close?1:0)}
})
test('opponent attacks are telegraphed before contact and timed guard opens a two-point counter',()=>{
 const m=ready();stepBoxing(m,frame,{});assert.ok(m.opponent.attack);assert.ok(boxingAdvice(m).includes('Jab coming'));assert.equal(m.score.opponent,0)
 while(m.opponent.attack.impactAt-m.opponent.attack.elapsed>.20)stepBoxing(m,frame,{})
 run(m,.22,{guardHeld:true});assert.equal(m.score.opponent,0);assert.equal(m.perfectGuards,1);assert.equal(m.defenses,1)
 stepBoxing(m,frame,{secondaryPressed:true});run(m,.32,{});assert.equal(m.score.player,2);assert.equal(m.counters,1)
})
test('leaving punch range prevents contact and rewards readable footwork',()=>{
 const m=ready();stepBoxing(m,frame,{});run(m,.79,{move:{x:0,z:1}});assert.equal(m.score.opponent,0);assert.equal(m.defenses,1);assert.ok(m.player.z-m.opponent.z>1.62)
})
test('continuous guard and punch spamming cost stamina; resetting recovers it',()=>{
 const m=ready('practice');m.opponent.cooldown=999;run(m,4,()=>({primaryPressed:true}));assert.ok(m.score.player<=6);assert.ok(m.player.stamina<22)
 const tired=m.player.stamina;run(m,3,{});assert.ok(m.player.stamina>tired+20)
 const guard=ready('practice');run(guard,30,{guardHeld:true});assert.ok(guard.player.stamina<15);assert.ok(guard.score.opponent>0,'holding E forever is not an invulnerable state')
})
test('watch mode completes through the same controls, while practice remains open and a finished match is immutable',()=>{
 const m=createBoxingMatch({mode:'watch'});run(m,60,boxingWatchInput);assert.equal(m.phase,'done');assert.ok(m.score.player>0);assert.ok(m.defenses>0);const snapshot=JSON.stringify(m);stepBoxing(m,frame,{primaryPressed:true});assert.equal(JSON.stringify(m),snapshot)
 const practice=createBoxingMatch({mode:'practice',duration:2,target:1});run(practice,8,boxingWatchInput);assert.equal(practice.phase,'round');assert.equal(practice.timeLeft,0)
})
test('ring bounds, coincident bodies, invalid time and varied render rates remain finite',()=>{
 const a=ready(),b=ready();a.opponent.cooldown=b.opponent.cooldown=999
 for(let i=0;i<60;i++)stepBoxing(a,1/60,{move:{x:1,z:1}})
 for(let i=0;i<120;i++)stepBoxing(b,1/120,{move:{x:1,z:1}})
 assert.ok(Math.abs(a.player.x-b.player.x)<1e-6);assert.ok(a.player.x<=2.7&&a.player.z<=2.7)
 a.player.x=a.opponent.x=0;a.player.z=a.opponent.z=0;stepBoxing(a,frame,{});assert.ok(Math.hypot(a.player.x-a.opponent.x,a.player.z-a.opponent.z)>=.859)
 const time=a.time;stepBoxing(a,NaN,{});stepBoxing(a,-1,{});assert.equal(a.time,time)
})
