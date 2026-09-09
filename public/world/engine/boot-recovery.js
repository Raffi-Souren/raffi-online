/** Recovery copy depends on what actually failed, not a blanket network guess. */
export function recoveryFor(error,{contextLost=false,validSave=false,saveChecked=false}={}){
  const unavailable=!contextLost&&/webgl|graphics context|context creation|gpu adapter/i.test(String(error?.message||error||''))
  return {kind:contextLost?'context-lost':unavailable?'graphics-unavailable':'load-failed',
    title:unavailable?'This browser cannot start 3D.':contextLost?'The graphics session was interrupted.':'Part of Brooklyn could not load.',
    message:unavailable?'Enable hardware acceleration and restart the browser, or open the game in another WebGL2-capable browser. Performance mode cannot create a missing graphics context.':contextLost?'Reload to recreate the graphics session. If this keeps happening during play, a lighter graphics setting may help.':'Reload to retry the game assets. If they still fail, check your connection or try again shortly.',
    offerPerformance:contextLost,
    save:validSave?'A verified local save is available in the save menu after reloading.':saveChecked?'No valid local save was found. You can start a new visit after reloading.':'Existing browser saves have not been changed; they can be checked once the game loads.'}
}
