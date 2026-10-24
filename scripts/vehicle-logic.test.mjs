import test from 'node:test';
import assert from 'node:assert/strict';
import {presentation} from '../src/presentation.js';
import {rearWingPose} from '../src/rear-wing.js';
import {manualVehiclePatch,vehicleSnapshot,vehiclePresetPatch,lightingState,layoutPartAnchors} from '../src/vehicle-settings.js';
const car={page:'Vehicle',subpage:'Dynamics',preset:'Custom',gear:'D',acceleration:'Sport',handling:'Comfort',suspension:'Standard',frontWing:'High Downforce',rearWing:'Stowed',hoodOpen:true,bargeDeploy:true};
test('Home stays opaque with a surface grid in every gear, ignoring the retired transparency preference',()=>{
 for(const gear of ['P','R','N','D'])for(const activeHotspot of [null,'rearWing']){
  const state={...car,page:'Home',gear,activeHotspot},opaque=presentation(state),transparent=presentation({...state,homeTransparent:true});
  assert.deepEqual(transparent,opaque,'a stale stored value must not enable Home transparency');
  assert.equal(opaque.layer,'exterior');assert.ok(opaque.grid>0);
  for(const key of ['tank','plumbing'])assert.equal(opaque.channels[key],0);
  assert.equal(opaque.channels.rear,1);assert.equal(opaque.airflow,gear==='D'&&!activeHotspot);
  assert.deepEqual(rearWingPose({...state,homeTransparent:true}),rearWingPose(state));
 }
});
test('the retired transparency preference cannot override other pages',()=>{
 for(const [page,subpage] of [['Vehicle','Dynamics'],['Vehicle','Charging'],['Vehicle','Display'],['Vehicle','Lights'],['Listen'],['Climate'],['Track'],['Navigate']]){
  const state={...car,page,subpage};
  assert.deepEqual(presentation({...state,homeTransparent:true}),presentation(state));
 }
});
test('D + Stowed in Custom keeps the technical view and internal channels',()=>{
 const p=presentation(car);assert.equal(p.layer,'technical');assert.equal(p.airflow,false);
 for(const k of ['tank','plumbing','rear'])assert.equal(p.channels[k],1);
 assert.deepEqual(rearWingPose(car),{lift:0,pitch:0});
});
test('manual changes survive preset round trips without changing unrelated fields',()=>{
 const manual={...car,...manualVehiclePatch({...car,preset:'Sport'},'rearWing','Low Drag')};
 const saved=vehicleSnapshot(manual),sport={...manual,...vehiclePresetPatch('Sport',saved)};
 assert.equal(manual.preset,'Custom');assert.equal(sport.rearWing,'Low Drag');
 const restored={...sport,...vehiclePresetPatch('Custom',saved)};
 assert.deepEqual(vehicleSnapshot(restored),saved);assert.equal(restored.hoodOpen,true);
 assert.equal(manualVehiclePatch(car,'rearWing','invalid'),null);
});
test('parked hotspot preview and Home D obey a selected Stowed override',()=>{
 const state={...car,page:'Home',gear:'P',rearWing:'Low Drag'};
 assert.equal(rearWingPose(state).lift,0);
 assert.equal(rearWingPose({...state,activeHotspot:'rearWing'}).lift,.1);
 assert.equal(presentation({...state,gear:'D',activeHotspot:'rearWing'}).airflow,false);
 assert.equal(rearWingPose({...state,gear:'D',rearWing:'Stowed'}).lift,0);
 assert.equal(presentation({...state,gear:'D'}).airflow,true);
 for(const subpage of ['Charging','Display'])assert.notEqual(presentation({...car,subpage}).layer,'exterior');
});
test('DRL has no projected beams and Auto has a deterministic day/night rule',()=>{
 assert.deepEqual(lightingState('Off'),{lamps:0,beams:0});
 assert.deepEqual(lightingState('Daytime Running Light'),{lamps:.45,beams:0});
 assert.deepEqual(lightingState('Auto',12),lightingState('Daytime Running Light'));
 assert.deepEqual(lightingState('Auto',23),lightingState('On'));
});
test('five coincident mobile hotspots remain separate, including at canvas edges',()=>{
 for(const [x,y] of [[160,200],[0,0],[350,420]]){
  const placed=layoutPartAnchors(Array.from({length:5},(_,key)=>({key,x,y})),351,422);
  for(const [i,p] of placed.entries()){
   assert.ok(p.x>=22&&p.x<=329&&p.y>=22&&p.y<=400);
   for(const q of placed.slice(i+1))assert.ok(Math.abs(p.x-q.x)>=43||Math.abs(p.y-q.y)>=43);
  }
 }
});
