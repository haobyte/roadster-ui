// Visible options come from the Pilot clip. Defaults, poses and preset policy
// are prototype choices documented in docs/interaction-spec-20261024.md.
export const vehicleOptions={
 acceleration:['Chill','Standard','Sport'],handling:['Comfort','Balance','Sport'],
 frontWing:['Low Drag','High Downforce'],rearWing:['Stowed','Low Drag','High Downforce'],
 suspension:['Standard','Low'],hoodOpen:[false,true],bargeDeploy:[false,true]
};
export const customFields=Object.keys(vehicleOptions);
export const vehicleSnapshot=s=>Object.fromEntries(customFields.map(k=>[k,s[k]]));
export function manualVehiclePatch(s,key,value){
 if(!vehicleOptions[key]?.includes(value))return null;
 return {...vehicleSnapshot(s),[key]:value,preset:'Custom'};
}
export function vehiclePresetPatch(preset,custom){
 const presets={Comfort:{acceleration:'Chill',handling:'Comfort',suspension:'Standard'},Balance:{acceleration:'Standard',handling:'Balance',suspension:'Standard'},Sport:{acceleration:'Sport',handling:'Sport',suspension:'Low'},Custom:custom};
 return presets[preset]?{...presets[preset],preset}:null;
}
export const lightModes=['Off','Daytime Running Light','On','Auto'];
export function lightingState(mode,hour=new Date().getHours()){
 const effective=mode==='Auto'?(hour>=6&&hour<19?'Daytime Running Light':'On'):mode;
 return {lamps:effective==='Off'?0:effective==='Daytime Running Light'?.45:1,beams:effective==='On'?1:0};
}
export const homeParts={
 rearWing:{label:'Rear Wing',position:[.62,1,-1.9],camera:[3.3,2.2,-7.1]},
 frontWing:{label:'Front Wing',position:[.55,.2,2.13],camera:[4.6,1.9,6.5]},
 hoodOpen:{label:'Hood Vent',position:[0,.69,1.15],camera:[4,3.4,6.1]},
 bargeDeploy:{label:'Barge Boards',position:[.94,.35,.65],camera:[7.3,2,3.3]},
 lightMode:{label:'Exterior Lights',position:[.74,.53,1.9],camera:[4.6,2.1,6.5]}
};

// Keep 38px touch targets separate when parts project onto the same small area.
export function layoutPartAnchors(anchors,width,height){
 const placed=[],clamp=(v,max)=>Math.max(22,Math.min(max-22,v));
 for(const anchor of anchors){
  const candidates=[{x:clamp(anchor.x,width),y:clamp(anchor.y,height)}];
  for(let r=44;r<=220;r+=44)for(let i=0;i<8;i++)candidates.push({x:clamp(anchor.x+Math.cos(i*Math.PI/4)*r,width),y:clamp(anchor.y+Math.sin(i*Math.PI/4)*r,height)});
  const point=candidates.find(p=>placed.every(q=>Math.abs(p.x-q.x)>=43||Math.abs(p.y-q.y)>=43))||candidates[0];
  placed.push({...anchor,...point});
 }
 return placed;
}
