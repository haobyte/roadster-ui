import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRearAssembly} from '../src/rear-assembly.js';

test('four separate circular main mouths have open throats and gaps between their castings',()=>{
 const assembly=createRearAssembly();assembly.updateMatrixWorld(true);
 assert.equal(assembly.mainNozzles.length,4);
 const boxes=[];
 for(const port of assembly.mainNozzles){
  const casting=port.getObjectByName('individual_square_casting'),shell=port.getObjectByName('protruding_annular_nozzle');
  const box=new THREE.Box3().setFromObject(casting);boxes.push(box);
  const lipBox=new THREE.Box3().setFromObject(port.getObjectByName('machined_mouth_lip')),size=lipBox.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x-size.y)<1e-6,'mouth circles must not be squashed vertically');
  const center=new THREE.Vector3(0,0,-.3);port.localToWorld(center);
  const ray=new THREE.Raycaster(center,new THREE.Vector3(0,0,1),0,.6);
  assert.equal(ray.intersectObject(assembly.getObjectByName('continuous_rear_surround')).length,0,'integrated surround leaves every main mouth open');
  assert.equal(ray.intersectObject(casting).length,0,'square base is pierced at the nozzle centre');
  assert.equal(ray.intersectObject(shell).length,0,'no cap closes the annular mouth');
  assert.ok(ray.intersectObject(port.getObjectByName('shadowed_inner_throat')).length>0,'dark throat closes the rear of the cavity');
  center.x+=.070;ray.set(center,new THREE.Vector3(0,0,1));
  assert.ok(ray.intersectObject(shell).length>0,'rear-facing mouth wall must not be culled by reversed normals');
 }
 for(let i=1;i<boxes.length;i++)assert.ok(boxes[i].min.x-boxes[i-1].max.x>.07,'four castings remain visually separate');
 assembly.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});
