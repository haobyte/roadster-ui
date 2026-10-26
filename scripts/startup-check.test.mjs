import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {StartupCheck} from '../src/startup-check.js';
import {RearWingMotion} from '../src/rear-wing.js';
import {DriveAirflow} from '../src/drive-airflow.js';
import {SHIFT_PRESENTATION} from '../src/presentation.js';

async function fixture() {
  const bytes = await readFile(new URL('../assets/roadster-body.glb', import.meta.url));
  const loader = new GLTFLoader().register(() => ({name:'geometry-only', loadTexture: () => Promise.resolve(null)}));
  const {scene: body} = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const root = new THREE.Group();root.add(body);body.rotation.y = Math.PI / 2;
  const camera = new THREE.PerspectiveCamera();camera.position.set(6.7, 1.7, 5);
  const controls = {target: new THREE.Vector3(0, .52, 0)};
  const wheels = ['FL','FR','RL','RR'].map(k => body.getObjectByName('wheel_' + k));
  const wing = new RearWingMotion(body.getObjectByName('active_wing'), root);
  const flow = new DriveAirflow();root.add(flow);
  return {root, camera, controls, wheels, wing, flow};
}
function dispose(root) {
  const geometries = new Set(), materials = new Set();
  root.traverse(o => {if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [o.material].flat())materials.add(m);});
  geometries.forEach(g => g.dispose());materials.forEach(m => m.dispose());
}
test('real GLB wheel rims rotate about stationary axles; calipers and original transforms survive cleanup', async () => {
  const f = await fixture(), before = new Map();
  for (const wheel of f.wheels) for (const mesh of wheel.children) before.set(mesh, {parent: mesh.parent, position: mesh.position.clone(), quaternion: mesh.quaternion.clone()});
  const check = new StartupCheck(f.camera, f.controls, f.wheels);
  assert.equal(check.rotors.length, 4);
  const centres = check.rotors.map(({rotor}) => rotor.getWorldPosition(new THREE.Vector3()));
  check.update(5.2);f.root.updateMatrixWorld(true);
  for (const [i, {rotor, wheel}] of check.rotors.entries()) {
    assert.ok(rotor.getWorldPosition(new THREE.Vector3()).distanceTo(centres[i]) < 1e-6, 'hub does not orbit the car origin');
    assert.ok(Math.abs(rotor.rotation.z) > .5, 'visible rim rotation');
    assert.ok(wheel.children.some(m => m.material?.name === 'Machined titanium'), 'brake assembly stays outside rotor');
  }
  check.finish();
  assert.equal(check.rotors.length, 0);
  for (const [mesh, original] of before) {
    assert.equal(mesh.parent, original.parent);assert.ok(mesh.position.distanceTo(original.position) < 1e-9);
    assert.ok(mesh.quaternion.angleTo(original.quaternion) < 1e-9);
  }
  dispose(f.root);
});
test('self-check reaches the existing D camera with airflow and raised wing, then returns precisely to stationary P', async () => {
  const f = await fixture(), park = f.camera.position.clone(), target = f.controls.target.clone();
  const check = new StartupCheck(f.camera, f.controls, f.wheels), state = {page:'Home', gear:'P', rearWing:'High Downforce'};
  let sawDrive = false, sawReturn = false, previous = f.camera.position.clone();
  for (let frame = 0; frame < 660; frame++) {
    check.update(1 / 60);
    f.wing.update({...state, gear: !check.complete && check.frame.wing ? 'D' : 'P'}, 1 / 60);
    f.flow.update(1 / 60, {active: !check.complete && check.frame.airflow, wingLift: f.wing.pose.lift});
    assert.ok(f.camera.position.distanceTo(f.controls.target) > 6, 'camera remains outside vehicle');
    assert.ok(f.camera.position.distanceTo(previous) < .22, 'camera has no discontinuous frame jumps');previous.copy(f.camera.position);
    if (check.elapsed > 7 && check.elapsed < 7.5) {
      assert.ok(f.camera.position.distanceTo(new THREE.Vector3(...SHIFT_PRESENTATION.cameras.D)) < 1e-6);
      assert.ok(f.wing.pose.lift > .23 && f.flow.strength > .95);sawDrive = true;
    }
    if (check.elapsed > 9.5 && check.elapsed < 10) {
      assert.equal(f.wing.pose.lift, 0);assert.ok(f.flow.strength < .001);sawReturn = true;
    }
  }
  assert.ok(sawDrive && sawReturn && check.complete);
  assert.ok(f.camera.position.distanceTo(park) < 1e-9 && f.controls.target.distanceTo(target) < 1e-9);
  assert.equal(state.gear, 'P');assert.equal(f.flow.visible, false);assert.equal(f.wing.pose.lift, 0);
  dispose(f.root);
});
test('manual camera takeover releases the choreography without snapping back', async () => {
  const f = await fixture(), check = new StartupCheck(f.camera, f.controls, f.wheels);
  check.update(4);const position = f.camera.position.clone();
  check.finish({restoreCamera:false});check.update(20);
  assert.ok(f.camera.position.distanceTo(position) < 1e-9);assert.equal(check.rotors.length, 0);
  dispose(f.root);
});
