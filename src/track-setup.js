// The controls and hierarchy are visible in Tesla's 2026-10-24 (CST) cockpit clip.
// Preset mappings, trim steps and percentages below are local demo behavior.
export const trackPresets=['Auto','Low Drag','High Downforce','Custom'];
const automatic={frontWing:'High Downforce',rearWing:'High Downforce',aeroLoad:'Max Grip',fanMode:'Max Grip',hoodOpen:false,bargeDeploy:true};
export function createTrackSetup(){return {...automatic,preset:'Auto',aeroTrim:0,brakeTrim:0,esc:false,tcs:false};}
export function applyTrackPreset(current,preset,custom){
 if(!trackPresets.includes(preset))return current;
 if(preset==='Custom')return {...current,...custom,preset};
 const aero=preset==='Low Drag'?{frontWing:'Low Drag',rearWing:'Low Drag',aeroLoad:'Low Drag',fanMode:'Low Drag',hoodOpen:false,bargeDeploy:false}:automatic;
 return {...current,...aero,preset};
}
export function balanceValue(kind,trim){
 const front=(kind==='brake'?60:50)-2*trim;
 return {front,rear:100-front,trim,display:trim>0?`+${trim}`:String(trim)};
}
const signed=n=>n>0?`+${n}`:String(n);
export function balanceCard(kind,label,trim){
 const v=balanceValue(kind,trim),key=kind+'Trim';
 return `<section class="trim-card" aria-label="${label}">
  <h3>${label}</h3>
  <div class="trim-value"><div><small>FRONT</small><b data-balance="${kind}-front">${v.front}%</b></div>
   <button data-trim="${key}" data-step="-1" aria-label="Decrease ${label}" ${trim<=-3?'disabled':''}>−</button>
   <output id="${key}-output">${v.display}</output>
   <button data-trim="${key}" data-step="1" aria-label="Increase ${label}" ${trim>=3?'disabled':''}>+</button>
   <div><small>REAR</small><b data-balance="${kind}-rear">${v.rear}%</b></div></div>
  <div class="trim-scale">${Array.from({length:7},(_,i)=>i-3).map(n=>`<button data-trim="${key}" data-trim-value="${n}" aria-label="${label} ${signed(n)}" aria-pressed="${n===trim}"><i></i></button>`).join('')}</div>
 </section>`;
}
export function trackSetupPage(s){
 const row=(label,key,options)=>`<div class="setup-control"><span>${label}</span><div class="segments">${options.map(value=>`<button data-track-set="${key}" data-value="${value}" aria-pressed="${s[key]===value}" class="${s[key]===value?'selected':''}">${value}</button>`).join('')}</div></div>`;
 return `<div class="track-setup" aria-label="Track setup">
  <div class="track-presets">${trackPresets.map(p=>`<button class="preset ${s.preset===p?'selected':''}" data-track-preset="${p}" aria-pressed="${s.preset===p}"><small>${s.preset===p?'ACTIVE':'SELECT'}</small><b>${p}</b></button>`).join('')}</div>
  <div class="setup-wings">${row('Front Wing','frontWing',['Low Drag','High Downforce'])}${row('Rear Wing','rearWing',['Stowed','Low Drag','High Downforce'])}${row('Aero Load','aeroLoad',['Low Drag','Balance','Max Grip'])}${row('Fan','fanMode',['Off','Braking','Low Drag','Max Grip'])}</div>
  <div class="setup-balances">${balanceCard('aero','Aero Balance',s.aeroTrim)}${balanceCard('brake','Brake Balance',s.brakeTrim)}</div>
  <div class="setup-switches">${[['hoodOpen','Hood Vent',s.hoodOpen?'Close':'Open'],['bargeDeploy','Barge Boards',s.bargeDeploy?'Retract':'Deploy'],['esc','ESC',s.esc?'ON':'OFF'],['tcs','TCS',s.tcs?'ON':'OFF']].map(([key,label,value])=>`<button data-track-toggle="${key}" aria-pressed="${s[key]}"><span>${label}</span><b>${value}</b></button>`).join('')}</div>
  <div class="session-tools"><span>DEMO SESSION</span><button data-toggle="telemetry">${s.telemetry?'Pause':'Resume'} telemetry</button><button data-action="reset-track">Reset session</button></div>
 </div>`;
}
