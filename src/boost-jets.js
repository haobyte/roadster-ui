import * as THREE from 'three';

// Four narrow cold-gas plumes, attached to the actual main nozzle frames.
// The envelope and turbulence are visual approximations, not a flow simulation.
export class BoostJets {
 constructor(nozzles){
  this.strength=0;this.time=0;
  const positions=[],uvs=[],indices=[];
  for(let i=0;i<=48;i++)for(const side of [-1,1]){
   positions.push(side,0,-i/48*1.85);uvs.push((side+1)/2,i/48);
   if(i<48&&side===-1){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
  this.uniforms={uTime:{value:0},uStrength:{value:0}};
  this.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,toneMapped:false,
   uniforms:this.uniforms,
   vertexShader:`varying vec2 vUv;varying float vSeed;
    void main(){vUv=uv;vSeed=modelMatrix[3].x*7.;vec4 center=modelViewMatrix*vec4(0.,0.,position.z-.045,1.);
     vec3 axis=normalize((modelViewMatrix*vec4(0.,0.,-1.,0.)).xyz);
     vec3 lateral=cross(axis,normalize(-center.xyz));
     lateral=length(lateral)<.001?vec3(1.,0.,0.):normalize(lateral);
     center.xyz+=lateral*position.x*(.042+.085*uv.y);
     gl_Position=projectionMatrix*center;}`,
   fragmentShader:`varying vec2 vUv;varying float vSeed;uniform float uTime;uniform float uStrength;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
    void main(){float t=vUv.y,s=vUv.x*2.-1.;
     vec2 q=vec2(t*15.-uTime*13.+vSeed,s*3.);q.y+=sin(q.x*.7)*.28;
     float density=.65*noise(q)+.35*noise(q*2.13+8.);
     float mist=exp(-s*s*4.)*(.22+.55*density);
     float core=exp(-s*s*32.)*.32*(1.-t);
     float envelope=smoothstep(0.,.025,t)*(1.-smoothstep(.48,1.,t));
     float edge=1.-smoothstep(.8,1.,abs(s));
     gl_FragColor=vec4(mix(vec3(.96,.90,.73),vec3(.72,.86,.97),smoothstep(0.,.12,t)),(mist+core)*envelope*edge*uStrength);}`
  });
  this.plumes=nozzles.map((port,i)=>{const mesh=new THREE.Mesh(geometry,this.material);mesh.name=`Boost_plume_${i+1}`;
   // The narrow root fits inside the .073m mouth. Keep the plume below the
   // tail/wing and behind the car, with normal depth occlusion. Drawing it
   // before the body would detach its visible root from the nozzle mouth.
   mesh.renderOrder=6;mesh.frustumCulled=false;mesh.visible=false;port.add(mesh);return mesh;});
 }
 update(dt,{active=false,reducedMotion=false}={}){
  this.strength=THREE.MathUtils.damp(this.strength,active?1:0,active?18:9,dt);
  if(this.strength<.003&&!active)this.strength=0;
  if(!reducedMotion)this.time+=dt;
  this.uniforms.uTime.value=reducedMotion?0:this.time;this.uniforms.uStrength.value=this.strength;
  for(const mesh of this.plumes)mesh.visible=this.strength>0;
 }
 reset(){this.strength=0;this.uniforms.uStrength.value=0;for(const mesh of this.plumes)mesh.visible=false;}
}
