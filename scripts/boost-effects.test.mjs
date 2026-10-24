import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createRearAssembly} from '../src/rear-assembly.js';
import {BoostJets} from '../src/boost-jets.js';
import {BoostAudio} from '../src/boost-audio.js';
import {presentation} from '../src/presentation.js';
import {rearWingPose} from '../src/rear-wing.js';

test('exported bonnet closes the missing forward deck with painted, front-facing surfaces',async()=>{
 const bytes=await readFile(new URL('../assets/roadster-body.glb',import.meta.url));
 // Ray coverage does not need the browser image decoder for embedded trim maps.
 const loader=new GLTFLoader().register(()=>({name:'geometry-only',loadTexture:()=>Promise.resolve(null)}));
 const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 scene.rotation.y=Math.PI/2;scene.updateMatrixWorld(true);
 for(const x of [-.3,0,.3])for(const z of [1.75,1.9,2.05]){
  const hits=new THREE.Raycaster(new THREE.Vector3(x,2,z),new THREE.Vector3(0,-1,0)).intersectObject(scene);
  assert.ok(hits.length,`bonnet hit at ${x},${z}`);
  assert.equal(hits[0].object.material.name,'Pearl silver');assert.ok(hits[0].point.y>.45);
 }
 scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});

test('four plumes follow the nozzles and fade smoothly through release and rapid re-press',()=>{
 const assembly=createRearAssembly(),jets=new BoostJets(assembly.mainNozzles);
 assert.equal(jets.plumes.length,4);
 jets.plumes.forEach((p,i)=>{assert.equal(p.parent,assembly.mainNozzles[i]);assert.equal(p.material.depthTest,true);assert.equal(p.material.depthWrite,false);});
 for(let i=0;i<30;i++)jets.update(1/60,{active:true});assert.ok(jets.strength>.99);
 const full=jets.strength;jets.update(1/60,{active:false});assert.ok(jets.strength>0&&jets.strength<full);
 const fading=jets.strength;jets.update(1/60,{active:true});assert.ok(jets.strength>fading);
 for(let i=0;i<60;i++)jets.update(1/60,{active:false});assert.equal(jets.strength,0);assert.ok(jets.plumes.every(p=>!p.visible));
 jets.update(.1,{active:true,reducedMotion:true});assert.equal(jets.uniforms.uTime.value,0);
 assembly.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});

test('Boost rear preview is confined to Track and preserves its settings page underneath',()=>{
 const s={page:'Track',setup:true,boostPreview:true};const p=presentation(s);
 assert.equal(p.mode,'car');assert.equal(p.layer,'exterior');assert.equal(p.channels.rear,1);assert.equal(p.airflow,false);assert.ok(p.camera[2]<0);
 assert.equal(presentation({...s,boostPreview:false}).mode,'hidden');
 assert.equal(presentation({...s,page:'Home'}).key,'Home');
 assert.equal(rearWingPose({...s,rearWing:'High Downforce'}).lift,.24);
 assert.equal(rearWingPose({...s,rearWing:'Low Drag'}).lift,.10);
 assert.equal(rearWingPose({...s,rearWing:'Stowed'}).lift,0);
});

test('released or hidden gestures cannot start delayed audio; active voices get a release envelope',async()=>{
 let resume,starts=0;const stops=[];
 const node=()=>({connect(){},disconnect(){}});
 class AudioMock {
  sampleRate=1000;currentTime=1;destination={};
  createBuffer(){return {getChannelData:()=>new Float32Array(2000)};}
  resume(){return new Promise(r=>resume=r);}
  createBufferSource(){return {...node(),start(){starts++;},stop(t){stops.push(t);}};}
  createBiquadFilter(){return {...node(),frequency:{value:0}};}
  createGain(){return {...node(),gain:{setValueAtTime(){},linearRampToValueAtTime(){},cancelAndHoldAtTime(){}}};}
 }
 globalThis.window={AudioContext:AudioMock};globalThis.document={hidden:false};
 try{
  const sound=new BoostAudio();const stale=sound.start();sound.stop();resume();await stale;assert.equal(starts,0);
  const hidden=sound.start();document.hidden=true;resume();await hidden;assert.equal(starts,0);document.hidden=false;
  const active=sound.start();resume();await active;assert.equal(starts,1);sound.stop();assert.equal(stops.at(-1),1.46);assert.equal(sound.voice,null);
  sound.stop(true);assert.equal(stops.at(-1),1.035);
 }finally{delete globalThis.window;delete globalThis.document;}
});
