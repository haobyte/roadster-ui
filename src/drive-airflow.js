import * as THREE from 'three';

// Image-guided streamlines: nose +Z → tail −Z. These illustrate the UI effect,
// not simulated air velocity, pressure, lift or drag.
export class DriveAirflow extends THREE.Group {
 constructor(){
  super();this.name='Drive_airflow';this.strength=0;this.time=0;this.visible=false;this.activationTime=0;this.reveal=0;this.revealStart=0;this.wasActive=false;
  const positions=[],tangents=[],sides=[],indices=[],progress=[],phases=[],weights=[],overRoof=[];
  const add=(points,seed,weight=1,roof=0)=>{
   const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');
   const samples=curve.getSpacedPoints(128);
   const start=positions.length/3;
   for(let j=0;j<=128;j++){
    const tangent=samples[Math.min(128,j+1)].clone().sub(samples[Math.max(0,j-1)]).normalize();
    for(const side of [-1,1]){
     positions.push(...samples[j].toArray());tangents.push(...tangent.toArray());sides.push(side);
     progress.push(j/128);phases.push(seed);weights.push(weight);overRoof.push(roof);
    }
    if(j<128){const n=start+j*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
   }
  };
  // The upper streams keep their lateral lanes from nose to wake. Lift over
  // the canopy and wing changes height only; the tail never fans sideways.
  const stations=[[3.3,.43],[2.35,.49],[1.9,.66],[1.25,.80],[.65,1.04],[0,1.19],[-.65,1.21],[-1.3,1.14],[-2.2,1.03],[-3.3,.92],[-4.8,.81]];
  for(let i=0;i<10;i++){
   const x=(i-4.5)*.135,offset=(.5+.5*Math.sin(i*2.3))*.014;
   add(stations.map(([z,y],j)=>[x,y+offset+(j>7?Math.sin(i*1.7)*(j-7)*.018:0),z]),i*.173,.56,1);
  }
  // Two quiet flank traces per side support the roof-dominant presentation.
  for(const side of [-1,1])for(let i=0;i<2;i++){
   const y=.36+i*.28;
   add([[side*.68,y,3.3],[side*.88,y+.02,2.25],[side*1.08,y+.05,1.55],[side*1.12,y+.05,.7],[side*1.10,y+.04,-.2],[side*1.12,y+.06,-1.45],[side*1.12,y+.07,-2.25],[side*1.12,y+.10,-3.4],[side*1.12,y+.08,-4.8]],i*.237+(side+1)*.19,.06);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('aTangent',new THREE.Float32BufferAttribute(tangents,3));
  geometry.setAttribute('aSide',new THREE.Float32BufferAttribute(sides,1));
  geometry.setIndex(indices);
  geometry.setAttribute('aProgress',new THREE.Float32BufferAttribute(progress,1));
  geometry.setAttribute('aPhase',new THREE.Float32BufferAttribute(phases,1));
  geometry.setAttribute('aWeight',new THREE.Float32BufferAttribute(weights,1));
  geometry.setAttribute('aOverRoof',new THREE.Float32BufferAttribute(overRoof,1));
  this.material=new THREE.ShaderMaterial({
   transparent:true,depthWrite:false,depthTest:true,toneMapped:false,side:THREE.DoubleSide,
   uniforms:{uTime:{value:0},uStrength:{value:0},uReveal:{value:0},uWingLift:{value:0},uViewport:{value:new THREE.Vector2(1280,720)},uResolution:{value:new THREE.Vector2(1280,720)},uNozzleRect:{value:new THREE.Vector4(2,2,2,2)},uWingRect:{value:new THREE.Vector4(2,2,2,2)},uWidth:{value:1.35},uMist:{value:0},uColor:{value:new THREE.Color('#d7e7f4')}},
   vertexShader:`attribute float aProgress;attribute float aPhase;attribute float aWeight;attribute float aOverRoof;attribute vec3 aTangent;attribute float aSide;
    uniform float uWingLift;uniform float uTime;uniform vec2 uViewport;uniform float uWidth;uniform float uMist;
    varying float vProgress;varying float vPhase;varying float vWeight;varying float vSide;varying float vMistZone;
    vec3 displaced(vec3 p){
     float aft=smoothstep(.6,1.55,-p.z)*(1.-smoothstep(2.6,4.8,-p.z));p.y+=aOverRoof*uWingLift*aft;
     float wake=smoothstep(2.6,4.8,-p.z);p.y+=sin(uTime*1.1+aPhase*6.28+p.z*.8)*wake*.012;
     return p;
    }
    void main(){vProgress=aProgress;vPhase=aPhase;vSide=aSide;
     float overCar=smoothstep(-2.8,-2.,position.z)*(1.-smoothstep(2.,2.8,position.z));
     vWeight=aWeight*(1.-.58*aOverRoof*overCar);
     // Keep the silhouette and all wing poses clear, including flank wisps
     // that used to accumulate over the shoulders and rear wheels.
     float mistOverCar=smoothstep(-3.2,-2.45,position.z)*(1.-smoothstep(2.,2.8,position.z));
     vMistZone=(1.-.75*mistOverCar)*(1.-.60*aOverRoof*mistOverCar);
     vec4 clip=projectionMatrix*modelViewMatrix*vec4(displaced(position),1.);
     vec4 ahead=projectionMatrix*modelViewMatrix*vec4(displaced(position+aTangent*.03),1.);
     vec2 direction=(ahead.xy/ahead.w-clip.xy/clip.w)*uViewport;
     direction/=max(length(direction),.00001);
     float mistWidth=clamp(.14*projectionMatrix[1][1]*uViewport.y/max(clip.w,.1),6.,38.);
     float width=mix(uWidth,mistWidth,uMist);
     clip.xy+=vec2(-direction.y,direction.x)*aSide*width/uViewport*clip.w;
     gl_Position=clip;}`,
   fragmentShader:`uniform float uTime;uniform float uStrength;uniform float uReveal;uniform vec3 uColor;uniform vec2 uResolution;uniform vec4 uNozzleRect;uniform vec4 uWingRect;uniform float uMist;
    varying float vProgress;varying float vPhase;varying float vWeight;varying float vSide;varying float vMistZone;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){
     vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
     return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
    }
    float clearance(vec4 rect){
     vec2 uv=gl_FragCoord.xy/uResolution;
     vec2 outside=max(rect.xy-uv,uv-rect.zw);
     return smoothstep(0.,.018,max(outside.x,outside.y));
    }
    void main(){
     // The carrier never switches off: only a broad highlight moves along it.
     float wave=pow(.5+.5*cos(6.283185*(vProgress*2.1-uTime*.88+vPhase)),3.);
     float envelope=smoothstep(0.,.10,vProgress)*(1.-smoothstep(.68,1.,vProgress));
     float reveal=1.-smoothstep(uReveal-.10,uReveal+.08,vProgress);
     float edge=1.-smoothstep(.45,1.,abs(vSide));
     float hardwareClearance=min(clearance(uNozzleRect),clearance(uWingRect));
     // Keep the continuous carrier intact; soften only its travelling highlight
     // when a longitudinal roof stream projects over the wing or gold hardware.
     float alpha=(.24+.14*wave*mix(.35,1.,hardwareClearance))*edge;
     if(uMist>.5){
      // Advected multi-scale density gives soft wisps without textures, sprite
      // popping or a smoke wall. The speed matches the travelling highlights.
      vec2 q=vec2(vProgress*18.-uTime*7.54+vPhase*11.,vSide*1.8);
      q.y+=sin(q.x*.65+vPhase*7.)*.35;
      float density=.55*noise(q)+.30*noise(q*2.07+5.3)+.15*noise(q*4.13-7.1);
      density=smoothstep(.23,.78,density);
      float softEdge=exp(-vSide*vSide*5.)*(1.-smoothstep(.75,1.,abs(vSide)));
      alpha=.075*density*softEdge*vMistZone*hardwareClearance;
     }
     alpha*=envelope*vWeight*uStrength*reveal;
     gl_FragColor=vec4(uColor,alpha);
    }`
  });
  const streams=new THREE.Mesh(geometry,this.material);streams.name='Continuous_streamlines';streams.renderOrder=7;this.add(streams);
  // Share lifecycle, projection, colour and time uniforms with the fine lines.
  this.mistMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,toneMapped:false,side:THREE.DoubleSide,
   uniforms:{...this.material.uniforms,uMist:{value:1}},vertexShader:this.material.vertexShader,fragmentShader:this.material.fragmentShader});
  this.mist=new THREE.Mesh(geometry,this.mistMaterial);this.mist.name='Advected_air_mist';this.mist.renderOrder=6;this.add(this.mist);
  this.nozzleCorners=[];
  for(const x of [-.65,.65])for(const y of [.205,.61])for(const z of [-2.21,-2.0])this.nozzleCorners.push(new THREE.Vector3(x,y,z));
  this.projectedCorner=new THREE.Vector3();
  this.wingBounds=new THREE.Box3();
 }
 setViewport(width,height,pixelRatio=1){
  this.material.uniforms.uViewport.value.set(Math.max(1,width),Math.max(1,height));
  this.material.uniforms.uResolution.value.set(Math.floor(Math.max(1,width)*pixelRatio),Math.floor(Math.max(1,height)*pixelRatio));
 }
 protectNozzles(assembly,camera){
  // Keep broad mist off the hardware during a camera turn. Fine lines remain
  // continuous and use their normal depth test, with a longitudinal upper wake.
  const rect=this.material.uniforms.uNozzleRect.value;
  rect.set(Infinity,Infinity,-Infinity,-Infinity);
  assembly.updateWorldMatrix(true,false);camera.updateMatrixWorld();
  for(const corner of this.nozzleCorners){
   const p=this.projectedCorner.copy(corner).applyMatrix4(assembly.matrixWorld).project(camera);
   if(p.z<=-1||p.z>=1){rect.set(2,2,2,2);return;}
   const x=p.x*.5+.5,y=p.y*.5+.5;
   rect.x=Math.min(rect.x,x);rect.y=Math.min(rect.y,y);rect.z=Math.max(rect.z,x);rect.w=Math.max(rect.w,y);
  }
 }
 protectWing(wing,camera){
  // The projected clearance follows the real blade through lift and pitch;
  // only mist and highlight amplitude fade, never the continuous carrier.
  const rect=this.material.uniforms.uWingRect.value,box=this.wingBounds;
  if(!wing){rect.set(2,2,2,2);return;}
  wing.updateWorldMatrix(true,true);camera.updateMatrixWorld();box.setFromObject(wing);
  rect.set(Infinity,Infinity,-Infinity,-Infinity);
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
   const p=this.projectedCorner.set(x,y,z).project(camera);
   if(p.z<=-1||p.z>=1){rect.set(2,2,2,2);return;}
   const u=p.x*.5+.5,v=p.y*.5+.5;
   rect.x=Math.min(rect.x,u);rect.y=Math.min(rect.y,v);rect.z=Math.max(rect.z,u);rect.w=Math.max(rect.w,v);
  }
 }
 update(dt,{active,reducedMotion=false,lightTheme=false,wingLift=0}){
  active=Boolean(active); // Loading frames can have an undefined ready flag.
  if(active&&!this.wasActive){this.activationTime=0;this.revealStart=this.strength>.03?this.reveal:0;}
  if(active){this.activationTime+=dt;this.reveal=reducedMotion?1.12:Math.max(this.revealStart,Math.min(1.12,Math.max(0,(this.activationTime-.12)/.90)*1.12));}
  const target=active?(reducedMotion||this.activationTime>.12?1:this.strength):0;
  this.strength=reducedMotion?target:THREE.MathUtils.damp(this.strength,target,active?3.6:7,dt);
  // Freeze the streaks for reduced motion; no moving particles or flashing.
  if((active||this.strength>.003)&&!reducedMotion)this.time+=dt;
  this.wasActive=active;
  this.material.uniforms.uTime.value=reducedMotion?0:this.time;
  this.material.uniforms.uStrength.value=this.strength;
  this.material.uniforms.uReveal.value=this.reveal;
  this.material.uniforms.uWingLift.value=wingLift;
  // Both UI themes retain a black scene; keep moving highlights legible in both.
  this.material.uniforms.uColor.value.set(lightTheme?'#c7d8e6':'#d7e7f4');
  this.visible=this.strength>.003;
 }
}
