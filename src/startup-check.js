import * as THREE from 'three';
import {SHIFT_PRESENTATION} from './presentation.js';

// A visual startup demonstration. It never writes the user's gear or settings.
export const STARTUP_TIMING = Object.freeze({
  orbitStart: .65, driveView: 6.1, returnStart: 7.8, parkView: 10.8,
  airflowStart: 4, airflowEnd: 8, wingStart: 5.35, wingEnd: 7.8,
  wheelStart: 3, wheelEnd: 9.4,
});
const ease = t => {t = THREE.MathUtils.clamp(t, 0, 1);return t * t * t * (t * (t * 6 - 15) + 10);};
export function startupFrame(time) {
  const t = STARTUP_TIMING;
  return {
    orbit: ease((time - t.orbitStart) / (t.driveView - t.orbitStart))
      * (1 - ease((time - t.returnStart) / (t.parkView - t.returnStart))),
    airflow: time >= t.airflowStart && time < t.airflowEnd,
    wing: time >= t.wingStart && time < t.wingEnd,
    wheelAngle: -Math.PI * 4 * ease((time - t.wheelStart) / (t.wheelEnd - t.wheelStart)),
  };
}

export class StartupCheck {
  constructor(camera, controls, wheels) {
    this.camera = camera;this.controls = controls;
    this.elapsed = 0;this.complete = false;this.duration = STARTUP_TIMING.parkView;
    this.frame = startupFrame(0);
    this.parkPosition = camera.position.clone();this.parkTarget = controls.target.clone();
    this.driveTarget = new THREE.Vector3(...SHIFT_PRESENTATION.target);
    this.park = new THREE.Spherical().setFromVector3(this.parkPosition.clone().sub(this.parkTarget));
    this.drive = new THREE.Spherical().setFromVector3(new THREE.Vector3(...SHIFT_PRESENTATION.cameras.D).sub(this.driveTarget));
    this.drive.theta = this.park.theta + THREE.MathUtils.euclideanModulo(this.drive.theta - this.park.theta + Math.PI, Math.PI * 2) - Math.PI;
    this.sphere = new THREE.Spherical();this.rotors = [];
    for (const wheel of wheels) {
      // The GLB wheel vertices use body coordinates, not a hub-centred origin.
      // Reparent only the tyre and rim around their real centre. Brakes stay put.
      const meshes = wheel.children.filter(o => o.isMesh && /tire|wheel (black|silver)|rim/i.test(o.material.name));
      if (!meshes.length) continue;
      wheel.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3();for (const mesh of meshes) bounds.expandByObject(mesh);
      const centre = wheel.worldToLocal(bounds.getCenter(new THREE.Vector3()));
      const rotor = new THREE.Group();rotor.name = 'Startup_wheel_rotor';rotor.position.copy(centre);wheel.add(rotor);
      const originals = meshes.map(mesh => ({mesh, position: mesh.position.clone(), quaternion: mesh.quaternion.clone(), scale: mesh.scale.clone()}));
      for (const mesh of meshes) rotor.attach(mesh);
      this.rotors.push({wheel, rotor, originals});
    }
  }

  update(dt) {
    if (this.complete) return;
    this.elapsed = Math.min(this.duration, this.elapsed + dt);
    this.frame = startupFrame(this.elapsed);
    const a = this.frame.orbit;
    this.controls.target.lerpVectors(this.parkTarget, this.driveTarget, a);
    this.sphere.set(THREE.MathUtils.lerp(this.park.radius, this.drive.radius, a) + Math.sin(Math.PI * a) * .2,
      THREE.MathUtils.lerp(this.park.phi, this.drive.phi, a), THREE.MathUtils.lerp(this.park.theta, this.drive.theta, a));
    this.camera.position.setFromSpherical(this.sphere).add(this.controls.target);
    this.camera.lookAt(this.controls.target);
    for (const {rotor} of this.rotors) rotor.rotation.z = this.frame.wheelAngle;
    if (this.elapsed >= this.duration) this.finish();
  }

  finish({restoreCamera = true} = {}) {
    if (this.complete) return;
    this.complete = true;
    if (restoreCamera) {
      this.camera.position.copy(this.parkPosition);this.controls.target.copy(this.parkTarget);
      this.camera.lookAt(this.controls.target);
    }
    for (const {wheel, rotor, originals} of this.rotors) {
      for (const {mesh, position, quaternion, scale} of originals) {
        wheel.add(mesh);mesh.position.copy(position);mesh.quaternion.copy(quaternion);mesh.scale.copy(scale);
      }
      rotor.removeFromParent();
    }
    this.rotors.length = 0;
  }
}
