import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RearWingMotion} from '../src/rear-wing.js';

function fixture(){
 const root=new THREE.Group(),body=new THREE.Group(),blade=new THREE.Group();
 body.rotation.y=Math.PI/2;blade.position.set(1.844,.87,0);root.add(body);body.add(blade);
 return {root,blade,motion:new RearWingMotion(blade,root)};
}
const drive={page:'Home',gear:'D',rearWing:'High Downforce'};
test('D deploys continuously, reversing mid-travel retracts without a jump',()=>{
 const {motion}=fixture();motion.update({...drive,gear:'P'},1/60);
 motion.update(drive,.3);
 assert.ok(motion.pose.lift>0&&motion.pose.lift<.24);
 assert.equal(motion.pose.pitch,0,'incidence waits for initial lift');
 const before={...motion.pose};motion.update({...drive,gear:'P'},0);
 assert.deepEqual(motion.pose,before,'retarget from current pose');
 for(let i=0;i<100;i++)motion.update({...drive,gear:'P'},1/60);
 assert.deepEqual(motion.pose,{lift:0,pitch:0});
});
test('all four linkages stay attached to the deck and moving wing',()=>{
 const {motion,root}=fixture();
 for(let i=0;i<90;i++){
  motion.update(drive,1/60);root.updateMatrixWorld(true);
  for(const {arm,sleeve,joints,start,tip} of motion.supports){
   const lower=root.worldToLocal(arm.localToWorld(new THREE.Vector3(0,-.5,0)));
   const upper=root.worldToLocal(arm.localToWorld(new THREE.Vector3(0,.5,0)));
   const expected=root.worldToLocal(motion.blade.localToWorld(tip.clone()));
   assert.ok(lower.distanceTo(start)<1e-6&&upper.distanceTo(expected)<1e-6);
   const sleeveBase=root.worldToLocal(sleeve.localToWorld(new THREE.Vector3(0,-.5,0)));
   assert.ok(sleeveBase.distanceTo(start)<1e-6,'telescoping sleeve stays seated on the fixed deck pivot');
   assert.ok(joints[0].position.distanceTo(start)<1e-6&&joints[1].position.distanceTo(expected)<1e-6);
   assert.ok(sleeve.scale.y<arm.scale.y&&Number.isFinite(sleeve.position.z));
  }
 }
 assert.deepEqual(motion.pose,{lift:.24,pitch:-.24});
});
test('reduced motion and explicit Stowed setting do not leave a delayed deployment',()=>{
 const {motion}=fixture();motion.update(drive,.4);
 motion.update({...drive,rearWing:'Stowed'},0,true);
 assert.deepEqual(motion.pose,{lift:0,pitch:0});assert.equal(motion.transition,null);
 motion.update({...drive,page:'Vehicle',subpage:'Dynamics',gear:'P',rearWing:'Low Drag'},0,true);
 assert.deepEqual(motion.pose,{lift:.1,pitch:-.035});
});
