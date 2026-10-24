import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DriveAirflow} from '../src/drive-airflow.js';

test('upper airflow continues longitudinally past the wing without lateral spread',()=>{
 const flow=new DriveAirflow(),a=flow.children[0].geometry.attributes,lanes=new Map();
 for(let i=0;i<a.position.count;i++){
  if(a.aOverRoof.getX(i)!==1)continue;
  const key=a.aPhase.getX(i),point=new THREE.Vector3().fromBufferAttribute(a.position,i);
  if(!lanes.has(key))lanes.set(key,[]);lanes.get(key).push(point);
  assert.ok(Math.abs(a.aTangent.getX(i))<1e-6,'the rendered path tangent has no sideways component');
 }
 assert.ok(lanes.size>0);
 for(const points of lanes.values()){
  const x=points[0].x;
  assert.ok(points.every(p=>Math.abs(p.x-x)<1e-6),'each roof stream stays in its lateral lane');
  assert.ok(points.at(-1).z< -4,'the upper wake extends behind the rear of the car');
  for(let i=1;i<points.length;i++)assert.ok(points[i].z<=points[i-1].z,'flow continues towards the tail');
 }
 flow.children[0].geometry.dispose();flow.material.dispose();flow.mistMaterial.dispose();
});

test('initial loading frames cannot poison a later D transition',()=>{
 const flow=new DriveAirflow();
 // The renderer starts before the asynchronous GLB load marks the car ready.
 for(let i=0;i<10;i++)flow.update(1/60,{active:undefined});
 assert.equal(flow.strength,0);
 for(let i=0;i<180;i++)flow.update(1/60,{active:true});
 assert.ok(flow.visible&&flow.strength>.99&&Number.isFinite(flow.time));
 for(let i=0;i<120;i++)flow.update(1/60,{active:false});
 assert.equal(flow.visible,false);
 flow.children[0].geometry.dispose();flow.material.dispose();flow.mistMaterial.dispose();
});

test('nozzle clearance follows the rear assembly through camera and suspension changes at high DPI',()=>{
 const flow=new DriveAirflow(),assembly=new THREE.Group(),camera=new THREE.PerspectiveCamera(35,390/844,.1,50);
 flow.setViewport(390,844,2);
 assert.deepEqual(flow.material.uniforms.uResolution.value.toArray(),[780,1688]);
 for(const height of [0,-.045])for(const viewpoint of [[2.1,2.65,-6.8],[0,1.7,-6],[3,3,-5]]){
  assembly.position.y=height;camera.position.set(...viewpoint);camera.lookAt(0,.52,.12);flow.protectNozzles(assembly,camera);
  const r=flow.material.uniforms.uNozzleRect.value;
  for(const x of [-.48,-.16,.16,.48]){
   const p=assembly.localToWorld(new THREE.Vector3(x,.34,-2.185)).project(camera);
   const u=p.x*.5+.5,v=p.y*.5+.5;
   assert.ok(u>r.x&&u<r.z&&v>r.y&&v<r.w,'all four projected mouth centres stay within the cleared region');
  }
 }
 flow.children[0].geometry.dispose();flow.material.dispose();flow.mistMaterial.dispose();
});

test('a fresh D activation waits briefly then reveals nose to tail; a reversal fades without restarting the wake',()=>{
 const flow=new DriveAirflow();
 flow.update(.10,{active:true});assert.equal(flow.strength,0);assert.equal(flow.reveal,0);
 flow.update(.25,{active:true});assert.ok(flow.strength>0&&flow.reveal>0&&flow.reveal<.5);
 const partial=flow.reveal,time=flow.time,strength=flow.strength;
 flow.update(.05,{active:false});assert.equal(flow.reveal,partial);assert.ok(flow.strength<strength&&flow.time>time);
 flow.update(.01,{active:true});assert.equal(flow.reveal,partial,'quick reactivation must not erase the visible tail');
 for(let i=0;i<120;i++)flow.update(1/60,{active:true});assert.equal(flow.reveal,1.12);
 flow.update(0,{active:true,reducedMotion:true});const frozen=flow.time;
 flow.update(.5,{active:true,reducedMotion:true});assert.equal(flow.time,frozen);assert.equal(flow.strength,1);assert.equal(flow.material.uniforms.uTime.value,0);
 flow.children[0].geometry.dispose();flow.material.dispose();flow.mistMaterial.dispose();
});
