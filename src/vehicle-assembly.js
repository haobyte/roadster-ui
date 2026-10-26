import * as THREE from 'three';
import {MeshSurfaceSampler} from 'three/addons/math/MeshSurfaceSampler.js';

// All distances are in bodyRoot space: +Z is the nose, -Z is the tail.
// The effect samples the existing model and uses its actual curved UV grid.
export const ASSEMBLY_TIMING = Object.freeze({lead: .65, sweep: 5, cool: .8});

const randomSequence = () => {
  let seed = 7139;
  return () => ((seed = Math.imul(1664525, seed) + 1013904223 | 0) >>> 0) / 4294967296;
};

function surfaceSamples(root, exterior, count, random) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(), entries = [];
  let total = 0;
  exterior.traverse(mesh => {
    if (!mesh.isMesh || !mesh.geometry.attributes.position) return;
    const sampler = new MeshSurfaceSampler(mesh).setRandomGenerator(random).build();
    const area = sampler.distribution.at(-1);
    if (!(area > 0)) return;
    const matrix = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
    // The source GLB has uniform object scales. Include that scale in its area.
    const scale = new THREE.Vector3().setFromMatrixScale(matrix);
    total += area * Math.pow(Math.abs(scale.x * scale.y * scale.z), 2 / 3);
    entries.push({sampler, matrix, normal: new THREE.Matrix3().getNormalMatrix(matrix),
      grid: mesh.material.userData.gridScale?.value, end: total});
  });
  const samples = [], p = new THREE.Vector3(), n = new THREE.Vector3(), uv = new THREE.Vector2();
  if (!entries.length) return samples;
  for (let i = 0; i < count; i++) {
    const pick = random() * total;
    const entry = entries.find(item => item.end > pick) || entries.at(-1);
    entry.sampler.sample(p, n, undefined, uv);
    p.applyMatrix4(entry.matrix);n.applyMatrix3(entry.normal).normalize();
    const distance = value => Math.abs(value - Math.round(value));
    const seam = entry.grid && Math.min(distance(uv.x * entry.grid.x), distance(uv.y * entry.grid.y)) < .065;
    samples.push({p: p.clone(), n: n.clone(), seam});
  }
  return samples;
}

// Share the path between the bright particle head and its short incoming trail.
const gatherPath = `
  vec3 gatherPosition(float age) {
    float remaining = pow(clamp(-age / 1.8, 0., 1.), 1.45);
    float side = position.x < 0. ? -1. : 1.;
    vec3 spread = aNormal * (.35 + aSeed.x * .8);
    spread += vec3(side * (.55 + aSeed.y * .9), .4 + aSeed.z * 1.05, -.4 - aSeed.x * 1.1);
    vec3 p = position + aNormal * .009 + spread * remaining;
    p.x += sin(remaining * 6. + aSeed.w * 6.283) * remaining * .28;
    p.y += cos(remaining * 5. + aSeed.y * 6.283) * remaining * .2;
    return p;
  }
  float gatherAlpha(float age) {
    return smoothstep(-1.8, -1.25, age) * (1. - smoothstep(.09, .28, age));
  }
`;
const particleVertex = `
  uniform float uTime, uFront, uSpeed, uPixelScale;
  attribute vec3 aNormal;
  attribute vec4 aSeed;
  varying float vAlpha, vHeat;
  ${gatherPath}
  void main() {
    float arrival = ${ASSEMBLY_TIMING.lead} + (uFront - position.z) / uSpeed;
    float age = uTime - arrival;
    vec3 p = gatherPosition(age);
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uPixelScale * (.018 + aSeed.z * .024) / max(-mv.z, .5), 1.5, 9.);
    vAlpha = gatherAlpha(age) * (.58 + .42 * aSeed.y);
    vHeat = exp(-abs(age) * 13.);
  }
`;
const particleFragment = `
  varying float vAlpha, vHeat;
  void main() {
    float r = length(gl_PointCoord - .5) * 2.;
    if (r > 1. || vAlpha < .005) discard;
    vec3 color = mix(vec3(.65, 1.25, 1.9), vec3(3.4, 1.8, .65), vHeat);
    float core = exp(-r * r * 13.);
    gl_FragColor = vec4(color * (1. + core), (core + .24 * pow(1. - r, 2.)) * vAlpha);
  }
`;
const trailVertex = `
  uniform float uTime, uFront, uSpeed;
  attribute vec3 aNormal;
  attribute vec4 aSeed;
  attribute float aEnd;
  varying float vAlpha, vHeat;
  ${gatherPath}
  void main() {
    float age = uTime - ${ASSEMBLY_TIMING.lead} - (uFront - position.z) / uSpeed;
    vec3 p = gatherPosition(age - aEnd * (.04 + aSeed.z * .055));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    vAlpha = gatherAlpha(age) * (1. - smoothstep(-.12, .02, age)) * mix(.55, .025, aEnd);
    vHeat = exp(-abs(age) * 9.);
  }
`;
const trailFragment = `
  varying float vAlpha, vHeat;
  void main() {
    if (vAlpha < .003) discard;
    gl_FragColor = vec4(mix(vec3(.35, .9, 1.65), vec3(2.8, 1.5, .5), vHeat), vAlpha);
  }
`;
const sparkVertex = `
  uniform float uTime, uFront, uSpeed;
  attribute vec3 aNormal;
  attribute vec4 aSeed;
  attribute float aEnd;
  varying float vAlpha, vHeat;
  void main() {
    float arrival = ${ASSEMBLY_TIMING.lead} + (uFront - position.z) / uSpeed;
    float age = uTime - arrival - aSeed.w * .065;
    float life = .22 + aSeed.z * .36;
    float t = max(0., age - aEnd * (.018 + aSeed.x * .025));
    vec3 velocity = aNormal * (.38 + aSeed.x * .8);
    velocity += vec3((aSeed.y - .5) * 1.4, .5 + aSeed.z * 1.2, (aSeed.w - .5) * .9);
    vec3 p = position + aNormal * .012 + velocity * t;
    p.y -= 2.4 * t * t;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    vAlpha = step(0., age) * (1. - smoothstep(life * .25, life, age));
    vAlpha *= mix(1., .18, aEnd);
    vHeat = 1. - clamp(age / life, 0., 1.);
  }
`;
const sparkFragment = `
  varying float vAlpha, vHeat;
  void main() {
    if (vAlpha < .005) discard;
    vec3 color = mix(vec3(1.5, .12, .008), vec3(3.8, 2.1, .65), vHeat * vHeat);
    gl_FragColor = vec4(color, vAlpha);
  }
`;

export class VehicleAssembly {
  constructor(root, exterior, surfaces, {compact = false} = {}) {
    this.root = root;
    this.elapsed = 0;
    this.complete = false;
    this.duration = ASSEMBLY_TIMING.lead + ASSEMBLY_TIMING.sweep + ASSEMBLY_TIMING.cool;
    this.group = new THREE.Group();this.group.name = 'First_load_particle_assembly';
    this.patches = [];
    const random = randomSequence();
    const samples = surfaceSamples(root, exterior, compact ? 15000 : 26000, random);
    const z = samples.map(sample => sample.p.z);
    this.front = Math.max(...z) + .08;
    this.rear = Math.min(...z) - .08;
    this.speed = (this.front - this.rear) / ASSEMBLY_TIMING.sweep;
    this.uniforms = {
      uTime: {value: 0}, uFront: {value: this.front}, uSpeed: {value: this.speed},
      uScan: {value: this.front + this.speed * ASSEMBLY_TIMING.lead},
      uAssemblyInverse: {value: root.matrixWorld.clone().invert()},
      uPixelScale: {value: 720},
    };
    const materials = new Set();
    root.traverse(object => {
      if (object.material) for (const material of [object.material].flat()) {
        if (!material.isShaderMaterial) materials.add(material);
      }
    });
    for (const material of materials) this.patchMaterial(material, surfaces.includes(material));
    this.createParticles(samples, random);
    this.createSparks(samples.filter(sample => sample.seam && sample.n.y > -.35), random, compact ? 700 : 1200);
    root.add(this.group);
  }

  patchMaterial(material, gridSurface) {
    const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey;
    const key = previousKey.call(material);
    this.patches.push({material, previous, previousKey});
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
        uniform mat4 uAssemblyInverse; varying vec3 vAssemblyPosition;`)
        .replace('#include <project_vertex>', `#include <project_vertex>
        vAssemblyPosition = (uAssemblyInverse * modelMatrix * vec4(transformed, 1.)).xyz;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uScan; varying vec3 vAssemblyPosition;`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float assemblyDistance = vAssemblyPosition.z - uScan;
        float assemblyGrain = fract(sin(dot(floor(vAssemblyPosition * 155.), vec3(12.9898,78.233,45.164))) * 43758.5453);
        if (assemblyDistance < assemblyGrain * .045) discard;`);
      // Run after the existing technical material's grid/color treatment.
      const glow = gridSurface ? `
        float weldCore = exp(-pow(assemblyDistance / .047, 2.));
        float weldHeat = exp(-max(assemblyDistance, 0.) * 5.8);
        vec3 weldColor = mix(vec3(1.7, .12, .012), vec3(4.4, 2.35, .85), weldCore);
        gl_FragColor.rgb += grid * weldColor * weldHeat * 2.1;
        gl_FragColor.rgb += vec3(1.6, .58, .08) * weldCore * .28;
        gl_FragColor.a = max(gl_FragColor.a, grid * weldHeat);
      ` : `
        gl_FragColor.rgb += vec3(1.5, .55, .09) * exp(-pow(assemblyDistance / .055, 2.)) * .55;
      `;
      shader.fragmentShader = shader.fragmentShader.replace(/}\s*$/, `${glow}\n}`);
    };
    material.customProgramCacheKey = () => key + ':assembly-v1:' + gridSurface;
    material.needsUpdate = true;
  }

  createParticles(samples, random) {
    const positions = [], normals = [], seeds = [], trailPositions = [], trailNormals = [], trailSeeds = [], ends = [];
    for (const [i, {p, n}] of samples.entries()) {
      const seed = [random(), random(), random(), random()];
      positions.push(...p);normals.push(...n);seeds.push(...seed);
      // One trail per four heads keeps aggregation readable without a solid veil.
      if (i % 4 === 0) for (const end of [0, 1]) {
        trailPositions.push(...p);trailNormals.push(...n);trailSeeds.push(...seed);ends.push(end);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aNormal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 4));
    const material = new THREE.ShaderMaterial({uniforms: this.uniforms, vertexShader: particleVertex,
      fragmentShader: particleFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false});
    this.particles = new THREE.Points(geometry, material);this.particles.name = 'Surface_gathering_particles';
    this.particles.frustumCulled = false;this.particles.renderOrder = 6;this.group.add(this.particles);
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(trailPositions, 3));
    trailGeometry.setAttribute('aNormal', new THREE.Float32BufferAttribute(trailNormals, 3));
    trailGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(trailSeeds, 4));
    trailGeometry.setAttribute('aEnd', new THREE.Float32BufferAttribute(ends, 1));
    const trailMaterial = new THREE.ShaderMaterial({uniforms: this.uniforms, vertexShader: trailVertex,
      fragmentShader: trailFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false});
    this.trails = new THREE.LineSegments(trailGeometry, trailMaterial);this.trails.name = 'Incoming_particle_trails';
    this.trails.frustumCulled = false;this.trails.renderOrder = 6;this.group.add(this.trails);
  }

  createSparks(samples, random, limit) {
    const positions = [], normals = [], seeds = [], ends = [];
    for (let i = 0; i < Math.min(samples.length, limit); i++) {
      const {p, n} = samples[Math.floor(i * samples.length / Math.min(samples.length, limit))];
      const seed = [random(), random(), random(), random()];
      for (const end of [0, 1]) {positions.push(...p);normals.push(...n);seeds.push(...seed);ends.push(end);}
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aNormal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 4));
    geometry.setAttribute('aEnd', new THREE.Float32BufferAttribute(ends, 1));
    const material = new THREE.ShaderMaterial({uniforms: this.uniforms, vertexShader: sparkVertex,
      fragmentShader: sparkFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false});
    this.sparks = new THREE.LineSegments(geometry, material);this.sparks.name = 'Grid_welding_sparks';
    this.sparks.frustumCulled = false;this.sparks.renderOrder = 7;this.group.add(this.sparks);
  }

  setViewport(height, pixelRatio) {this.uniforms.uPixelScale.value = height * pixelRatio;}

  update(dt, {reducedMotion = false, visible = true} = {}) {
    if (this.complete) return;
    if (reducedMotion || !visible) {this.finish();return;}
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {this.finish();return;}
    this.uniforms.uTime.value = this.elapsed;
    this.uniforms.uScan.value = this.front - (this.elapsed - ASSEMBLY_TIMING.lead) * this.speed;
    this.root.updateWorldMatrix(true, false);
    this.uniforms.uAssemblyInverse.value.copy(this.root.matrixWorld).invert();
  }

  finish() {
    if (this.complete) return;
    this.complete = true;
    for (const {material, previous, previousKey} of this.patches) {
      material.onBeforeCompile = previous;material.customProgramCacheKey = previousKey;material.needsUpdate = true;
    }
    this.patches.length = 0;
    this.group.removeFromParent();
    for (const object of this.group.children) {object.geometry.dispose();object.material.dispose();}
    this.group.clear();
    this.particles = null;this.sparks = null;this.trails = null;
  }
}
