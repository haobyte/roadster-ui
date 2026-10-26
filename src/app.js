import {CockpitScene} from './scene.js';
import {BoostAudio} from './boost-audio.js';
import {presentation, reducedMotion} from './presentation.js';
import {icon} from './icons.js';
import {vehicleOptions,vehicleSnapshot,manualVehiclePatch,vehiclePresetPatch,lightModes,homeParts} from './vehicle-settings.js';
import {bindTouchShift} from './touch-shift.js';
import {initFullscreen} from './tesla-fullscreen.js';
import {createTrackSetup,applyTrackPreset,balanceValue,trackSetupPage} from './track-setup.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const spec=await fetch('data/ui-spec.json').then(r=>r.json());
const track=Object.fromEntries(spec.pages.Track.fields.map(x=>[x.id,x.value]));
const defaults={page:'Home',subpage:'Dynamics',preset:'Sport',theme:'Dark',appearance:'Dark',brightness:100,units:'Miles',chargeLimit:97,lights:true,lightMode:'On',activeHotspot:null,gear:'P',acceleration:'Sport',handling:'Sport',frontWing:'High Downforce',rearWing:'High Downforce',suspension:'Low',hoodOpen:false,bargeDeploy:false,climateView:'Driver',climatePower:true,climateAuto:true,fanSpeed:5,seatHeat:false,defrost:false,rearDefrost:false,temperature:30,fanOn:true,esc:false,tcs:false,brakeBalance:57,aeroBalance:44,boost:100,boostActive:false,boostPreview:false,telemetry:true,playing:false,trackIndex:0,playTime:0,setup:false,mapDestination:'',mapScale:1,mapX:0,mapY:0};
let saved={};try{saved=JSON.parse(localStorage.getItem('roadster-ui-v1')||'{}');}catch{}
const state={...defaults,...Object.fromEntries(Object.entries(saved).filter(([k])=>['appearance','theme','brightness','units','chargeLimit'].includes(k)))};
let trackSettings=createTrackSetup(),customTrackSettings={...trackSettings,preset:'Custom'};
function changeTrack(patch){
 stopEffects(true);trackSettings={...trackSettings,...patch,preset:'Custom'};customTrackSettings={...trackSettings};render();
}
function chooseTrackPreset(preset){
 stopEffects(true);
 if(trackSettings.preset==='Custom')customTrackSettings={...trackSettings};
 trackSettings=applyTrackPreset(trackSettings,preset,customTrackSettings);render();
}
const songs=[['Slow Mercury','Kite Parish','#152b3b,#713668 44%,#79c8cf 46%,#080b18 50%,#222c48'],['To The Stars','Horizon One','#212d34,#414d55 46%,#b3b0a2 48%,#101d22 50%,#12292a'],['Painted Meridian','Sable Finch','#2c2844,#eb846e 45%,#393a6b 48%,#121424'],['Soft Visage','Juniper Lane','#626875,#b4b8be 40%,#bf7a92 66%,#3d3c4a'],['Linen Hour','Hollow Radio','#b1b29e,#535c54 48%,#7d8073'],['Petal Static','Orchid GI','#5a954e,#a6c56c 35%,#ed92ad 52%,#579451'],['Coral Pressing','Pap','#7e8180,#d95764 30%,#de817d 67%,#606b6c']];
const keys={'Acceleration':'acceleration','Ride & Handling':'handling','Front Wing':'frontWing','Rear Wing':'rearWing','Suspension':'suspension'};
const segment=(key,options,value)=>`<div class="segments">${options.map(o=>`<button data-set="${key}" data-value="${o}" class="${o===value?'selected':''}" aria-pressed="${o===value}">${o}</button>`).join('')}</div>`;
const svgCar=`<svg viewBox="0 0 60 130" aria-hidden="true"><path d="M12 8 Q30 -2 48 8 L54 35 52 112 Q49 128 30 128 Q11 128 8 112 L6 35Z M12 35 48 35 44 59 16 59Z M16 72 44 72 48 108 12 108Z M15 9 16 121 M45 9 44 121"/></svg>`;
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
let scene;let lastPresentationKey='';
try{scene=new CockpitScene($('#scene'),{assemblyIntro:true});scene.load().catch(showError);}catch(e){showError(e);}
function showError(e){console.error(e);$('#loading').hidden=true;$('#scene-error').hidden=false;$('#scene-error').textContent='3D视图加载失败，请刷新页面，或换用支持 WebGL 的浏览器。';}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),2300);}
function persist(){try{localStorage.setItem('roadster-ui-v1',JSON.stringify(Object.fromEntries(['appearance','theme','brightness','units','chargeLimit'].map(k=>[k,state[k]]))));}catch{}}
function theme(){state.theme=state.appearance==='Auto'?(new Date().getHours()>6&&new Date().getHours()<19?'Light':'Dark'):state.appearance;$('#cockpit').dataset.theme=state.theme;$('#cockpit').style.filter=`brightness(${.3+.7*state.brightness/100})`;}
function change(patch,redraw=true){scene?.cancelStartup();if('page' in patch || 'subpage' in patch || 'gear' in patch)patch={...patch,activeHotspot:null};if('page' in patch || 'subpage' in patch || 'setup' in patch)stopEffects(true);Object.assign(state,patch);theme();persist();if(redraw)render();else{applyScene();updatePlayer();} }
const touchShift=bindTouchShift($('.gear-rail'),selectGear,{
 begin:()=>scene?.beginShiftPreview(),
 move:(gear,progress)=>scene?.previewShift(gear,progress),
 end:gear=>scene?.endShiftPreview(gear)
});
function selectGear(gear){
 if(!['P','R','N','D'].includes(gear))return;
 const patch={gear};
 if((gear==='D'||gear==='R')&&presentation(state).mode!=='car')Object.assign(patch,{page:'Home',setup:false,boostActive:false});
 change(patch);
 toast(({D:'D · 前进',R:'R · 倒车',N:'N · 空挡',P:'P · 驻车'})[gear]);
}
function navigate(page){change({page,setup:false,boostActive:false});}
function dynamicPage(){
 const presets=`<div class="presets">${spec.pages.Dynamics.presets.map(p=>`<button class="preset ${state.preset===p?'selected':''}" data-preset="${p}" aria-pressed="${state.preset===p}"><small>${state.preset===p?'ACTIVE':'SELECT'}</small><b>${p}</b></button>`).join('')}<button class="track-entry" data-page="Track"><span>${icon('flag')}</span>Track Mode</button></div>`;
 const settings=state.preset==='Custom'?`<div class="controls-list">${spec.pages.Dynamics.custom_controls.filter(c=>keys[c.label]).map(c=>`<div class="control-row"><label>${c.label}</label>${segment(keys[c.label],c.visible_options,state[keys[c.label]])}</div>`).join('')}<div class="control-row pair"><button data-toggle="hoodOpen" aria-pressed="${state.hoodOpen}">Hood Vent <span>${state.hoodOpen?'Close':'Open'}</span></button><button data-toggle="bargeDeploy" aria-pressed="${state.bargeDeploy}">Barge Boards <span>${state.bargeDeploy?'Retract':'Deploy'}</span></button></div></div>`:`<div class="summary-list">${[['Acceleration',state.acceleration],['Ride & Handling',state.handling],['Ride Height',state.suspension]].map(([a,b])=>`<div class="summary-row"><span>${a}</span><span>${b}</span></div>`).join('')}</div>`;
 return `<div class="dynamics-layout">${presets}${settings}</div>`;
}
function displayPage(){return `<div class="display-panel"><div class="setting"><label>Appearance</label>${segment('appearance',spec.pages.Display.appearance,state.appearance)}</div><div class="setting"><label>Display Brightness</label><div class="range-row" style="--brightness:${state.brightness}%"><input data-range="brightness" aria-label="Display Brightness" type="range" min="10" max="100" value="${state.brightness}"><output id="brightness-output">${state.brightness}%</output></div></div><div class="setting"><label>Distance</label>${segment('units',spec.pages.Display.distance_options,state.units)}</div></div>`;}
function chargingPage(){return `<div class="charging-panel" style="--charge:${(state.chargeLimit-50)*2}%"><label>Charge Limit <span id="charge-output">${state.chargeLimit}%</span></label><input data-range="chargeLimit" aria-label="Charge Limit" type="range" min="50" max="100" value="${state.chargeLimit}"></div>`;}
function lightsPage(){return `<div class="lights-panel"><div class="section-label">LIGHTING</div><div class="setting"><label>Headlights</label>${segment('lightMode',lightModes,state.lightMode)}</div><p class="small-note">Exterior Lights</p></div>`;}
function climatePage(){return `<div class="climate-tabs">${['Driver','Passenger'].map(v=>`<button data-set="climateView" data-value="${v}" class="${v===state.climateView?'selected':''}" aria-pressed="${v===state.climateView}">${v}</button>`).join('')}</div><button class="cabin-switch ${state.climateView==='Passenger'?'passenger':''}" data-set="climateView" data-value="${state.climateView==='Driver'?'Passenger':'Driver'}" aria-label="切换到${state.climateView==='Driver'?'乘客':'驾驶员'}视角">${icon(state.climateView==='Driver'?'right':'left')}</button><div class="climate-controls"><div class="climate-power"><button data-toggle="climatePower" class="${state.climatePower?'selected':''}" aria-label="空调电源" aria-pressed="${state.climatePower}">${icon('power')}</button><button data-toggle="climateAuto" class="${state.climateAuto?'selected':''}">AUTO</button></div><div class="climate-functions"><button data-toggle="seatHeat" class="${state.seatHeat?'selected':''}" aria-label="座椅图标演示">${icon('seat')}</button><button data-toggle="defrost" class="${state.defrost?'selected':''}" aria-label="前挡除霜演示">${icon('defrost')}</button><button data-toggle="rearDefrost" class="${state.rearDefrost?'selected':''}" aria-label="后窗除霜演示">${icon('rearDefrost')}</button><div class="fan-control"><button data-action="fan-down" aria-label="降低风量">${icon('left')}</button><span><small>${state.fanSpeed}</small>${icon('fan')}</span><button data-action="fan-up" aria-label="提高风量">${icon('right')}</button></div><button data-action="climate-screen" aria-label="空调界面说明">${icon('screen')}</button></div></div>`;}

function art(i){return `linear-gradient(145deg,${songs[i][2]}) center / cover no-repeat`;}
function listenPage(){return `<div class="listen-panel"><div class="album-hero"><div class="album-art" style="--art:${art(1)}"></div><div class="album-copy"><small>Last Listened</small><h2>To The Stars</h2><p>Horizon One</p><button class="play-album" data-song="1">Play Album <span class="album-play">${icon('play')}</span></button></div></div><h3>Recently Played</h3><div class="album-row">${[2,3,4,0,5,6].map(i=>`<button class="album-card" data-song="${i}"><div class="album-art" style="--art:${art(i)}"></div><small>${songs[i][0]}</small><span>${songs[i][1]}</span></button>`).join('')}</div><h3>Made For You</h3><div class="album-row made-for-you">${[4,1,6,3,0,5].map(i=>`<button class="album-card" data-song="${i}" aria-label="播放 ${songs[i][0]}"><div class="album-art" style="--art:${art(i)}"></div></button>`).join('')}</div></div>`;}
function mapPage(){let roads='';for(let i=-8;i<20;i++){const x=i*85;roads+=`<path d="M ${x} -100 L ${x+220} 700 M -150 ${i*65} L 1450 ${i*65+150}"/>`;}return `<div class="map-panel"><div class="map-caption">NAVIGATE <span>·</span> LOCAL DEMO MAP</div><svg id="map-svg" viewBox="0 0 1200 600"><g id="map-world" transform="translate(${state.mapX} ${state.mapY}) translate(600 300) scale(${state.mapScale}) translate(-600 -300)"><g stroke="currentColor" opacity=".2" stroke-width="1" fill="none">${roads}</g><path d="M-50 490 C200 80 300 520 610 190 S900 160 1300 20" stroke="currentColor" opacity=".6" stroke-width="4" fill="none"/><path d="M120 680 C270 420 350 470 520 310 S890 490 1250 390" stroke="currentColor" opacity=".3" stroke-width="2" fill="none"/>${state.mapDestination?`<path d="M590 310 L690 326 L740 205 L890 220" stroke="currentColor" stroke-width="5" fill="none"/><circle cx="890" cy="220" r="10" fill="currentColor"/><text x="905" y="208" fill="currentColor" font-size="16">${state.mapDestination}</text>`:''}<path d="M590 292 L579 323 590 317 601 323Z" fill="currentColor"/><circle cx="590" cy="310" r="35" stroke="currentColor" fill="none" opacity=".2"/></g></svg><div class="map-controls"><button data-destination="">Destinations</button><button data-destination="Home">${icon('home')} Home</button><button data-destination="Work">${icon('work')} Work</button></div><div class="map-zoom"><button data-action="map-in" aria-label="放大地图">＋</button><button data-action="map-out" aria-label="缩小地图">−</button></div></div>`;}
function bar(label,value,fill,id){return `<div class="tile"><div class="tile-title"><span>${label}</span><span ${id?`id="${id}"`:''}>${value}</span></div><div class="bar" style="--fill:${fill}%"><i></i></div></div>`;}
function readings(label,unit,values){return `<div class="tile"><div class="tile-title"><span>${label}</span><span>${unit}</span></div><div class="wheel-readings">${svgCar}${values.map(v=>`<span>${v}</span>`).join('')}</div></div>`;}
function trackBalance(kind,label){
 const v=balanceValue(kind,trackSettings[kind+'Trim']);
 return `<button class="tile dashboard-balance" data-toggle="setup" data-setup-focus="${kind}Trim" aria-label="Adjust ${label}"><span>${label}</span><div class="balance-numbers"><b>${v.front}%</b><span>${v.display}</span><b>${v.rear}%</b></div></button>`;
}
function trackPage(){
 const s=trackSettings;
 const dashboard=`<div class="track-layout">
  <div class="telemetry-col first">${bar('Brake','0%',0,'brake-reading')}${bar('Regen','',0)}${bar('Battery Temp','110°F',45,'battery-temp')}${bar('Motor Temp','216°F',53,'motor-temp')}${readings('Brake Temp','°C',['758°','758°','529°','529°'])}</div>
  <div class="telemetry-col second">${bar('Accel','0%',0,'accel-reading')}<div class="tile"><div>Meter</div><div class="g-meter"><small>3.5</small><span class="g-left">3.5</span><span class="g-right">3.5</span><span class="g-bottom">3.5</span><i id="g-dot"></i></div></div>${readings('Tire','PSI · °F',['28<br>176°','28<br>177°','28<br>174°','28<br>175°'])}</div>
  <div class="telemetry-col middle"><div class="tile track-map"><div class="tile-title"><span>Lap</span><span class="elevation">Elevation<br>${state.units==='Kilometers'?'14 m':'46 ft'}</span></div><div class="track-placeholder" id="track-placeholder"></div><div class="sectors"><span>S1 &nbsp; 0.0</span><span>S2 &nbsp; --</span><span>S3 &nbsp; --</span></div></div><div class="tile"><div>Session</div><div class="session-content"><div class="lap-best"><div><small>Last</small><b>${track.lastLap}</b></div><div><small>Best</small><b>${track.bestLap}</b></div></div><div class="lap-table">${Object.entries(spec.pages.Track.lap_history).sort((a,b)=>+b[0]-a[0]).map(([n,t])=>`<div><span>${n}</span><span>${t}</span></div>`).join('')}</div></div></div></div>
  <div class="telemetry-col last"><div class="tile"><div class="tile-title"><span>Dynamics</span><span>${s.preset}</span></div><div class="aero-status">${[['Front Wing',s.frontWing],['Rear Wing',s.rearWing],['Hood Vent',s.hoodOpen?'Open':'Closed'],['Barge Boards',s.bargeDeploy?'Deploy':'Stowed'],['Aero Load',s.aeroLoad]].map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('')}</div></div><button class="tile track-fan" data-track-fan aria-pressed="${s.fanMode!=='Off'}"><div class="tile-title"><span>Fan</span><span>${s.fanMode!=='Off'?'ON':'OFF'}</span></div><p>${s.fanMode}</p></button>${trackBalance('brake','Brake Balance')}${trackBalance('aero','Aero Balance')}<div class="tile switches">${['esc','tcs'].map(k=>`<button data-track-toggle="${k}" aria-pressed="${s[k]}">${k.toUpperCase()}<span>${s[k]?'ON':'OFF'}</span></button>`).join('')}</div></div>
 </div>`;
 return `${state.setup?trackSetupPage({...s,telemetry:state.telemetry}):dashboard}<div class="track-bottom"><button data-toggle="setup" aria-expanded="${state.setup}">${state.setup?'‹ &nbsp; Dashboard':'Setup'}</button><button id="boost" class="boost" aria-label="按住模拟Boost" aria-pressed="false"><span id="boost-pressure">Thruster · ${Math.round(5500*state.boost/100).toLocaleString('en-US')} PSI</span><small>HOLD TO BOOST</small><span id="boost-ready">${Math.round(state.boost)}% · ${state.boost>98?'Boost Ready':'Recharging'}</span></button><button data-page="Vehicle">⇥ &nbsp;Exit Track Mode</button></div><div class="track-label">SIMULATED TELEMETRY</div>`;
}
function applyScene(){scene?.apply(state.page==='Track'?{...state,...trackSettings}:state);}
function layout(){
 const slot=$('#scene-slot'),mobile=innerWidth<=650&&innerHeight>innerWidth;
 let rect=presentation(state).rect;
 if(mobile){rect=[10,14,90,50];if(state.page==='Vehicle')rect=[14,10,82,35];if(state.page==='Listen')rect=[61,15,37,20];if(state.page==='Climate')rect=[10,18,90,43];}
 slot.style.display=state.page==='Navigate'||(state.page==='Track'&&state.setup&&!state.boostPreview)?'none':'block';
 if(state.page==='Track'&&state.boostPreview){
  Object.assign(slot.style,{left:mobile?'5%':'10%',top:'11%',width:mobile?'90%':'80%',height:'67%'});
 }else if(state.page==='Track'){
  const target=$('#track-placeholder');if(target){const r=target.getBoundingClientRect(),p=$('#cockpit').getBoundingClientRect();Object.assign(slot.style,{left:(r.left-p.left)+'px',top:(r.top-p.top)+'px',width:r.width+'px',height:r.height+'px'});}
 }else Object.assign(slot.style,{left:rect[0]+'%',top:rect[1]+'%',width:rect[2]+'%',height:rect[3]+'%'});
 scene?.resize();
}
function render(){
 const setupScroll=$('.track-setup')?.scrollTop||0;
 const controlsScroll=$('.controls-list')?.scrollTop||0;
 const focused=document.activeElement;
 const focusSelector=focused?.tagName==='BUTTON'&&Object.keys(focused.dataset).length?'button'+Object.entries(focused.dataset).map(([k,v])=>`[data-${k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}="${CSS.escape(v)}"]`).join(''):null;
 touchShift.sync(state.gear);
 const nextKey=presentation(state).key;const pageChanged=lastPresentationKey!==nextKey;lastPresentationKey=nextKey;
 $('#cockpit').dataset.subpage=state.subpage;$('#cockpit').dataset.preset=state.preset;
 $('#cockpit').dataset.boostPreview=String(state.boostPreview);$('#cockpit').dataset.page=state.page;$('#cockpit').dataset.setup=String(state.setup);theme();$('#gears').innerHTML=['P','R','N','D'].map(g=>`<button data-gear="${g}" class="${state.gear===g?'active':''}">${g}</button>`).join('');
 $('#race-header').textContent=state.page==='Track'?'12 / 60 · 0:02.585 · POS 1':'';
 $('#main-nav').innerHTML=spec.shell.primary_tabs.map(p=>`<button data-page="${p}" class="${state.page===p?'selected':''}" aria-current="${state.page===p?'page':'false'}">${p}</button>`).join('');
 $('#subnav').innerHTML=state.page==='Vehicle'?spec.shell.vehicle_tabs.map(p=>`<button data-subpage="${p}" class="${state.subpage===p?'selected':''}">${p}</button>`).join(''):'';
 let content='';if(state.page==='Vehicle')content=({Dynamics:dynamicPage,Display:displayPage,Charging:chargingPage,Lights:lightsPage}[state.subpage]||dynamicPage)();
 else content=({Climate:climatePage,Listen:listenPage,Navigate:mapPage,Track:trackPage}[state.page]||(()=>''))();
 $('#content').innerHTML=content;if($('.track-setup'))$('.track-setup').scrollTop=setupScroll;if($('.controls-list')&&!pageChanged)$('.controls-list').scrollTop=controlsScroll;$('#temp-value').textContent=state.temperature>=30?'HI':state.temperature+'°';
 renderHomeParts();applyScene();layout();updatePlayer();if(pageChanged&&!reducedMotion()){$('#content').getAnimations().forEach(a=>a.cancel());$('#content').animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,easing:'cubic-bezier(.2,.7,.2,1)'});}
 if(state.page==='Navigate')bindMap();if(state.page==='Track')bindBoost();
 if(focusSelector)$(focusSelector)?.focus({preventScroll:true});
}
let customSettings={acceleration:'Sport',handling:'Comfort',suspension:'Standard',rearWing:'High Downforce',frontWing:'High Downforce',hoodOpen:false,bargeDeploy:false};
function selectPreset(p){
 if(state.preset==='Custom')customSettings=vehicleSnapshot(state);
 const patch=vehiclePresetPatch(p,customSettings);if(patch)change(patch);
}
function changeVehicle(key,value){
 const patch=manualVehiclePatch(state,key,value);if(!patch)return;
 customSettings=vehicleSnapshot(patch);change(patch);
}
function renderHomeParts(){
 const visible=state.page==='Home',active=visible?state.activeHotspot:null;
 $('#hotspots').hidden=!visible||!scene?.ready;
 $('#hotspots').innerHTML=visible?`<svg class="hotspot-leaders" aria-hidden="true">${Object.keys(homeParts).map(key=>`<line data-part-leader="${key}"/>`).join('')}</svg>`+Object.entries(homeParts).map(([key,p])=>`<button class="part-hotspot" data-hotspot="${key}" aria-label="调整 ${p.label}" aria-expanded="${active===key}" aria-controls="part-menu"><i></i><span>${p.label}</span></button>`).join(''):'';
 const menu=$('#part-menu');menu.hidden=!active;
 if(!active){menu.innerHTML='';return;}
 const part=homeParts[active];menu.setAttribute('aria-label',part.label+' settings');
 const options=vehicleOptions[active]||lightModes;
 const controls=typeof options[0]==='boolean'?`<button data-toggle="${active}" aria-pressed="${state[active]}">${active==='hoodOpen'?(state[active]?'Close':'Open'):(state[active]?'Retract':'Deploy')}</button>`:segment(active,options,state[active]);
 menu.innerHTML=`<div class="part-menu-heading"><b>${part.label}</b><button data-close-part aria-label="关闭部件菜单">×</button></div>${controls}`;
}
function closePart(){
 const key=state.activeHotspot;if(!key)return;change({activeHotspot:null});
 $(`[data-hotspot="${key}"]`)?.focus({preventScroll:true});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.activeHotspot){e.preventDefault();closePart();}});
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;const d=b.dataset;
 if(d.hotspot){if(state.activeHotspot===d.hotspot)closePart();else{change({activeHotspot:d.hotspot});$('#part-menu [data-set],#part-menu [data-toggle]')?.focus({preventScroll:true});}}
 else if(d.closePart!==undefined)closePart();
 else if(d.page)navigate(d.page);
 else if(d.subpage)change({subpage:d.subpage});
 else if(d.preset)selectPreset(d.preset);
 else if(d.set){if(vehicleOptions[d.set])changeVehicle(d.set,d.value);else if(d.set==='lightMode'&&lightModes.includes(d.value))change({lightMode:d.value,lights:d.value!=='Off'});else change({[d.set]:d.value});}
 else if(d.trackPreset)chooseTrackPreset(d.trackPreset);
 else if(d.trackSet)changeTrack({[d.trackSet]:d.value});
 else if(d.trackToggle)changeTrack({[d.trackToggle]:!trackSettings[d.trackToggle]});
 else if(d.trackFan!==undefined)changeTrack({fanMode:trackSettings.fanMode==='Off'?'Max Grip':'Off'});
 else if(d.trim){const value=d.trimValue===undefined?trackSettings[d.trim]+Number(d.step):Number(d.trimValue);changeTrack({[d.trim]:Math.max(-3,Math.min(3,value))});}
 else if(d.toggle){if(vehicleOptions[d.toggle])changeVehicle(d.toggle,!state[d.toggle]);else change({[d.toggle]:!state[d.toggle]});if(d.setupFocus)$(`[data-trim="${d.setupFocus}"][aria-pressed=true]`)?.focus();}
 else if(d.gear)selectGear(d.gear);
 else if(d.song){state.trackIndex=+d.song;state.playTime=0;state.playing=true;updatePlayer();}
 else if(d.destination!==undefined)change({mapDestination:d.destination});
 else if(d.action)action(d.action);
});
document.addEventListener('input',e=>{const key=e.target.dataset.range;if(!key)return;state[key]=+e.target.value;
 if(key==='chargeLimit'){$('#charge-output').textContent=state[key]+'%';$('.charging-panel').style.setProperty('--charge',(state[key]-50)*2+'%');}
 if(key==='brightness'){theme();$('#brightness-output').textContent=state[key]+'%';$('.range-row').style.setProperty('--brightness',state[key]+'%');}
 if(key==='brakeBalance'||key==='aeroBalance'){const prefix=key==='brakeBalance'?'brake':'aero';$('#'+prefix+'-left').textContent=state[key]+'%';$('#'+prefix+'-right').textContent=100-state[key]+'%';}
 persist();applyScene();
});
function action(name){
 if(name==='climate-screen')toast('空调显示示意 · 原片未确认此图标的完整操作');
 if(name==='temp-down'||name==='temp-up')change({temperature:Math.max(16,Math.min(30,state.temperature+(name==='temp-up'?1:-1)))});
 if(name==='fan-down'||name==='fan-up')change({fanSpeed:Math.max(1,Math.min(10,state.fanSpeed+(name==='fan-up'?1:-1))),climateAuto:false});
 if(name==='play'){state.playing=!state.playing;updatePlayer();}
 if(name==='previous'||name==='next'){state.trackIndex=(state.trackIndex+(name==='next'?1:-1)+songs.length)%songs.length;state.playTime=0;updatePlayer();}
 if(name==='map-in'||name==='map-out'){state.mapScale=Math.max(.5,Math.min(3,state.mapScale*(name==='map-in'?1.25:.8)));render();}
 if(name==='reset-track'){stopEffects(true);state.boost=100;state.boostActive=false;state.setup=false;render();toast('Session reset');}
}
$('#help').onclick=()=>$('#info').showModal();$('#close-info').onclick=()=>$('#info').close();$('#info').addEventListener('click',e=>{if(e.target===$('#info')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
const boostAudio=new BoostAudio({onError:()=>toast('喷气声音暂不可用，动效仍可使用')});
let boostReturnTimer;
function setBoostPreview(visible){state.boostPreview=visible;$('#cockpit').dataset.boostPreview=String(visible);applyScene();layout();}
function stopEffects(immediate=false){
 state.boostActive=false;boostAudio.stop(immediate);$('#boost')?.setAttribute('aria-pressed','false');clearTimeout(boostReturnTimer);
 if(immediate){if(state.boostPreview)setBoostPreview(false);}
 else if(state.boostPreview){applyScene();boostReturnTimer=setTimeout(()=>{if(!state.boostActive)setBoostPreview(false);},700);}
}
initFullscreen({beforeLeave:()=>{stopEffects(true);$('#info').close();}});
$('#seek').oninput=e=>{state.playTime=+e.target.value;updatePlayer();};
function updatePlayer(){const song=songs[state.trackIndex];$('#song-title').textContent=song[0];$('#song-artist').textContent=song[1];$('.album-mini').style.background=art(state.trackIndex);$('.play').innerHTML=icon(state.playing?'pause':'play');$('.play').setAttribute('aria-label',state.playing?'暂停':'播放');$('#play-time').innerHTML=`${Math.floor(state.playTime/60).toString().padStart(2,'0')}:${Math.floor(state.playTime%60).toString().padStart(2,'0')} <small>05:07</small>`;$('#seek').value=state.playTime;}
// The music page retains its visual playback simulation without sound.
function bindMap(){const map=$('#map-svg');let drag=null;map.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,ox:state.mapX,oy:state.mapY};map.setPointerCapture(e.pointerId);});map.addEventListener('pointermove',e=>{if(!drag)return;const k=1200/map.clientWidth;state.mapX=drag.ox+(e.clientX-drag.x)*k;state.mapY=drag.oy+(e.clientY-drag.y)*k;$('#map-world').setAttribute('transform',`translate(${state.mapX} ${state.mapY}) translate(600 300) scale(${state.mapScale}) translate(-600 -300)`);});map.addEventListener('pointerup',()=>drag=null);map.addEventListener('pointercancel',()=>drag=null);map.addEventListener('wheel',e=>{e.preventDefault();state.mapScale=Math.max(.5,Math.min(3,state.mapScale*Math.exp(-e.deltaY*.001)));$('#map-world').setAttribute('transform',`translate(${state.mapX} ${state.mapY}) translate(600 300) scale(${state.mapScale}) translate(-600 -300)`);},{passive:false});}
function bindBoost(){
 const b=$('#boost');
 const start=()=>{if(state.boostActive||state.boost<=0)return;clearTimeout(boostReturnTimer);state.boostActive=true;b.setAttribute('aria-pressed','true');setBoostPreview(true);boostAudio.start();};
 const stop=()=>{if(state.boostActive)stopEffects();};
 b.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();b.setPointerCapture(e.pointerId);start();};
 b.onpointerup=b.onpointercancel=b.onlostpointercapture=stop;
 b.onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!e.repeat)start();}};
 b.onkeyup=e=>{if(e.key===' '||e.key==='Enter')stop();};b.onblur=()=>stopEffects(true);
}
window.addEventListener('blur',()=>stopEffects(true));document.addEventListener('visibilitychange',()=>{if(document.hidden){stopEffects(true);state.playing=false;updatePlayer();}});
window.addEventListener('pagehide',()=>stopEffects(true));
let tick=0;setInterval(()=>{tick+=.1;if(state.playing){state.playTime+=.1;if(state.playTime>=307)action('next');updatePlayer();}if(state.page==='Track'){
 state.boost=Math.max(0,Math.min(100,state.boost+(state.boostActive?-1.6:.35)));if(state.boost<=0&&state.boostActive)stopEffects();const pressure=Math.round(5500*state.boost/100);$('#boost-pressure').textContent=`Thruster · ${pressure.toLocaleString('en-US')} PSI`;$('#boost-ready').textContent=`${Math.round(state.boost)}% · ${state.boostActive?'Boosting':state.boost>98?'Boost Ready':'Recharging'}`;
 if(state.telemetry&&!state.setup){const accel=state.boostActive?100:Math.round(12+12*Math.sin(tick*.7));$('#accel-reading').textContent=accel+'%';$('#accel-reading').closest('.tile').querySelector('.bar').style.setProperty('--fill',accel+'%');$('#battery-temp').textContent=Math.round(110+2*Math.sin(tick*.12))+'°F';$('#motor-temp').textContent=Math.round(216+7*Math.sin(tick*.17))+'°F';$('#g-dot').style.transform=`translate(${Math.sin(tick*.6)*18}px,${Math.cos(tick*.7)*13}px)`;}
 }},100);
window.addEventListener('resize',layout);theme();render();
