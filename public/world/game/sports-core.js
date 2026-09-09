import { inspectIntentLanguage } from './intent-language.js'
/** Park choices and persistent sports records. No rendering or browser effects. */
export const SPORT_IDS = ['tennis', 'soccer', 'boxing']
export function emptySportsProgress() { return Object.fromEntries(SPORT_IDS.map(id => [id,{played:0,wins:0,best:0,medal:false,lastWon:null}])) }
export function validateSportsProgress(value) {
  if(value==null)return {ok:true,state:emptySportsProgress()}
  if(typeof value!=='object'||Array.isArray(value))return {ok:false,error:'The saved sports records are damaged.'}
  const result=emptySportsProgress()
  for(const id of SPORT_IDS){const row=value[id];if(!row||['played','wins','best'].some(key=>!Number.isInteger(row[key])||row[key]<0||row[key]>1000000)||row.wins>row.played||typeof row.medal!=='boolean'||row.medal!==(row.wins>0)||(row.played>0?typeof row.lastWon!=='boolean':row.lastWon!==null))return {ok:false,error:'The saved sports records are inconsistent.'};result[id]={played:row.played,wins:row.wins,best:row.best,medal:row.medal,lastWon:row.lastWon}}
  return {ok:true,state:result}
}
export function recordSportResult(progress,id,result){
  const next=structuredClone(progress)
  if(!SPORT_IDS.includes(id)||typeof result?.won!=='boolean'||!Number.isFinite(result.bestMetric))return {state:next,newMedal:false}
  const row=next[id],newMedal=result.won&&!row.medal
  row.played=Math.min(1000000,row.played+1);row.wins=Math.min(row.played,row.wins+(result.won?1:0));row.best=Math.max(row.best,Math.min(1000000,Math.max(0,Math.round(result.bestMetric))));row.medal||=result.won;row.lastWon=result.won
  return {state:next,newMedal}
}
export function classifySportIntent(raw){
  const {text,guard}=inspectIntentLanguage(raw)
  const ids=SPORT_IDS.filter(id=>new RegExp(id==='soccer'?'\\b(soccer|football|kickabout)\\b':id==='boxing'?'\\b(boxing|box|spar|sparring)\\b':'\\b(tennis|racket|racquet)\\b').test(text))
  if(guard==='question')return {kind:'question',id:ids.length===1?ids[0]:null}
  if(guard==='refuse'||/\b(leave|walk away|cancel|exit)\b/.test(text))return {kind:'leave'}
  if(guard)return {kind:'clarify'}
  if(ids.length===1)return {kind:/\bwatch\b/.test(text)?'watch':/\bpractice\b/.test(text)?'practice':'play',id:ids[0]}
  return {kind:'clarify'}
}
