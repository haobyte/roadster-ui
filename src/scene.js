import {presentation, MOTION_MS, reducedMotion, SHIFT_PRESENTATION} from './presentation.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {DriveAirflow} from './drive-airflow.js';
import {BoostJets} from './boost-jets.js';
import {RearWingMotion} from './rear-wing.js';
import {createRearAssembly} from './rear-assembly.js';
import {VehicleAssembly} from './vehicle-assembly.js';
import {StartupCheck} from './startup-check.js';
import {homeParts,lightingState,layoutPartAnchors} from './vehicle-settings.js';

const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const GOLD=0xc6a45d, WHITE=0xced6df;
export class CockpitScene{
 constructor(canvas,options={}){
  this.options=options;
  this.canvas=canvas;this.mode='car';this.state={};this.elapsed=0;this.fans=[];this.surfaces=[];this.internals=new THREE.Group();this.internals.name='Internal_components';this.bodyRoot=new THREE.Group();this.bodyRoot.name='Roadster';this.modelRoot=new THREE.Group();this.modelRoot.add(this.bodyRoot);this.bodyRoot.add(this.internals);
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:true});this.renderer.info.autoReset=false;this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor(0,0);this.renderer.toneMapping=THREE.ReinhardToneMapping;this.renderer.toneMappingExposure=1.2;
  this.scene=new THREE.Scene();this.scene.fog=new THREE.FogExp2(0x030303,.065);this.scene.add(this.modelRoot);
  this.camera=new THREE.PerspectiveCamera(31,1,.05,80);this.camera.position.set(5,1.9,6.1);
  this.controls=new OrbitControls(this.camera,canvas);this.controls.target.set(0,.5,0);this.controls.enableDamping=true;this.controls.dampingFactor=.065;this.controls.enablePan=false;this.controls.minDistance=3.4;this.controls.maxDistance=12;this.controls.minPolarAngle=.04;this.controls.maxPolarAngle=Math.PI*.51;this.controls.rotateSpeed=.65;this.controls.zoomSpeed=.7;
  this.controls.addEventListener('start',()=>{this.cancelStartup({restoreCamera:false});this.cameraTween=null;});
  this.scene.add(new THREE.HemisphereLight(0xffffff,0x33303b,1.2));this.light(0xffffff,3,[1,6,3]);this.light(0xdce8ff,2,[-4,3,-5]);this.light(0xffe5b7,.8,[3,1,-3]);
  const pmrem=new THREE.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(new RoomEnvironment(),.04);this.scene.environment=this.environment.texture;pmrem.dispose();
  this.ground=this.makeGround();this.scene.add(this.ground);
  this.composer=new EffectComposer(this.renderer,new THREE.WebGLRenderTarget(800,500,{type:THREE.HalfFloatType,samples:Math.min(4,this.renderer.capabilities.maxSamples)}));this.composer.addPass(new RenderPass(this.scene,this.camera));this.bloom=new UnrealBloomPass(new THREE.Vector2(800,500),.24,.32,.95);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
  this.gold=new THREE.MeshStandardMaterial({color:0xa88b4b,metalness:.65,roughness:.37,emissive:0x57411c,emissiveIntensity:.15,transparent:true,opacity:.22,depthWrite:false});
  this.castGold=this.gold.clone();this.castGold.opacity=.62;this.castGold.depthWrite=false;
  this.dark=new THREE.MeshStandardMaterial({color:0x101214,metalness:.6,roughness:.4});this.silver=new THREE.MeshStandardMaterial({color:0xa8b4c0,metalness:.7,roughness:.3});
  this.makeInternals();this.batchTree(this.internals);this.addInternalEdges();this.makeAero();this.makeCabin();this.makeTrack();
  this.bodyRoot.visible=false;
  this.airflow=new DriveAirflow();this.bodyRoot.add(this.airflow);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);this.resize();this.clock=new THREE.Clock();this.animate();
 }
 light(color,intensity,p){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...p);this.scene.add(l);}
 mesh(geo,mat,p=[0,0,0],parent=this.internals,name=''){const o=new THREE.Mesh(geo,mat);o.position.set(...p);o.name=name;parent.add(o);return o;}
 box(size,p,mat=this.gold,parent=this.internals,name=''){return this.mesh(new RoundedBoxGeometry(...size,2,.015),mat,p,parent,name);}
 pipe(a,b,r=.015,mat=this.gold,parent=this.internals){const av=V(...a),bv=V(...b),d=bv.clone().sub(av);const m=this.mesh(new THREE.CylinderGeometry(r,r,d.length(),10),mat,av.clone().add(bv).multiplyScalar(.5).toArray(),parent,'pipe');m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return m;}
 line(points,color=WHITE,opacity=.35,parent=this.internals){const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>Array.isArray(p)?V(...p):p));const m=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity}));parent.add(m);return m;}
 batchTree(root){
  for(const c of [...root.children])if(c.isGroup)this.batchTree(c);
  const groups=new Map();for(const o of root.children){if(!o.isMesh||Array.isArray(o.material))continue;const key=o.material.uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);}
  for(const meshes of groups.values()){if(meshes.length<2)continue;const geometries=meshes.map(o=>{o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));return g.applyMatrix4(o.matrix);});const geo=mergeGeometries(geometries);if(geo){const m=new THREE.Mesh(geo,meshes[0].material);m.name='Batched_'+root.name;meshes.forEach(o=>root.remove(o));root.add(m);}geometries.forEach(g=>g.dispose());}
 }
 addInternalEdges(){
  const material=new THREE.LineBasicMaterial({color:0xc9a552,transparent:true,opacity:.72,toneMapped:false});
  this.internals.traverse(o=>{if(o.isMesh&&(o.material===this.gold||o.material===this.castGold)){const edge=new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry,20),material);edge.name='Component_outline';o.add(edge);}});
 }
 technicalMaterial(glass=false){
  const m=new THREE.MeshPhysicalMaterial({color:0xbfc8cf,metalness:glass?.68:.78,roughness:glass?.20:.31,transparent:true,opacity:glass?.14:.10,side:THREE.FrontSide,depthWrite:false,clearcoat:.35,envMapIntensity:.32});
  m.userData={baseOpacity:glass?.14:.10,isGlass:glass,xray:{value:1},grid:{value:.035},gridScale:{value:new THREE.Vector2(14,14)}};
  m.onBeforeCompile=shader=>{
   shader.uniforms.uXray=m.userData.xray;shader.uniforms.uGrid=m.userData.grid;shader.uniforms.uGridScale=m.userData.gridScale;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vSurfaceGrid;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceGrid=uv;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vSurfaceGrid; uniform float uXray; uniform float uGrid; uniform vec2 uGridScale;').replace('#include <dithering_fragment>',`#include <dithering_fragment>
    vec2 q=vSurfaceGrid*uGridScale;
    vec2 g=abs(fract(q-.5)-.5)/max(fwidth(q),vec2(.0001));
    float grid=1.0-min(min(g.x,g.y)/.65,1.0);
    float grazing=pow(clamp(1.0-abs(dot(normalize(vNormal),normalize(vViewPosition))),0.0,1.0),4.0);
    float highlight=pow(max(0.0,normal.y),6.0)*.06;
    if(uXray>0.0){
     gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*.19+vec3(.54,.59,.62)*grazing+vec3(.35)*grid*(uGrid/.14),uXray);
     gl_FragColor.a=mix(gl_FragColor.a,clamp(opacity*.4+grazing*.50+grid*uGrid+highlight,.012,.85),uXray);
    }
    // The source uses a dark technical silhouette with silver edge response.
    // Compress room reflections so they do not turn the bonnet into a grey slab.
    gl_FragColor.rgb=mix(gl_FragColor.rgb*.16+vec3(.18,.21,.24)*pow(grazing,2.5),gl_FragColor.rgb,uXray);
    // Pilot 3.6s: the opaque shell also carries a faint curved quad grid.
    // Keep it in surface UVs, never triangle wireframe or a screen-space overlay.
    gl_FragColor.rgb+=(1.-uXray)*vec3(.62,.65,.69)*grid*uGrid;
   `);
  };
  this.surfaces.push(m);return m;
 }
 async load(){
  const gltf=await new GLTFLoader().loadAsync('assets/roadster-body.glb');const body=gltf.scene;body.name='Photo_traced_exterior';body.rotation.y=Math.PI/2;this.bodyRoot.add(body);this.exterior=body;
  const replacements={};
  const rearWingMeshes=new Set();body.getObjectByName('active_wing')?.traverse(o=>{if(o.isMesh)rearWingMeshes.add(o);});
  body.traverse(o=>{if(!o.isMesh)return;o.castShadow=false;o.receiveShadow=false;
   const original=o.material;const name=original.name||'';
   if(/Pearl silver|glass|Carbon satin/.test(name)){
    const isRearWing=rearWingMeshes.has(o),key=name+(isRearWing?':rear-wing':'');
    if(!replacements[key]){
     replacements[key]=this.technicalMaterial(/glass/.test(name));Object.assign(replacements[key].userData,{isCarbon:/Carbon/.test(name),isRearWing});
     // The blade is ~0.36m chord × 1.89m span: a square UV grid would appear
     // as tight stripes. Match its physical aspect with four by 22 cells.
     if(isRearWing&&!/Carbon/.test(name))replacements[key].userData.gridScale.value.set(4,22);
    }
    o.material=replacements[key];o.renderOrder=4;
    const edge=new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry,48),new THREE.LineBasicMaterial({color:WHITE,transparent:true,opacity:/glass/.test(name)?.16:.085,depthWrite:false}));edge.name='panel_edges';edge.renderOrder=5;o.add(edge);
   }else if(/tail|head|Rear L2 unlit smoked return/.test(name)){o.material=original.clone();o.material.emissiveIntensity=/smoked/.test(name)?2.2:4;if(/tail|smoked/.test(name))o.material.emissive.setRGB(1,.001,.001);this.lights??=[];this.lights.push(o);}
   else{o.material=original.clone();o.material.roughness=.4;if(/tire|well/.test(name))o.material.color.set(0x080a0c);if(/wheel silver|Machined titanium/.test(name)){o.material.color.set(0x707e8b);o.material.metalness=.85;}if(/Ivory|Amber/.test(name))o.material.color.set(0x20252a);}
  });
  this.importedWing=body.getObjectByName('active_wing');
  this.wingMotion=new RearWingMotion(this.importedWing,this.bodyRoot);
  this.wheels=['FL','FR','RL','RR'].map(k=>body.getObjectByName('wheel_'+k)).filter(Boolean);
  const signature=this.tube([[-.77,.58,1.98],[-.61,.49,2.12],[0,.475,2.145],[.61,.49,2.12],[.77,.58,1.98]],.004,new THREE.MeshBasicMaterial({color:new THREE.Color(3.2,3.5,3.8),transparent:true,depthWrite:false}),this.bodyRoot,'Front_UI_light_signature');
  signature.renderOrder=5;this.lights??=[];this.lights.push(signature);
  this.prepareLayers();
  this.rearAssembly.traverse(o=>{if(o.isMesh||o.isLineSegments)o.renderOrder=5;});
  this.boostJets=new BoostJets(this.mainNozzles);
  for(const o of this.lights||[]){const m=o.material;m.userData.lightOpacity=m.opacity;m.transparent=true;}
  this.makePartHighlights();
  this.ready=true;this.apply(this.state);
  if(this.options.assemblyIntro&&!reducedMotion()&&this.state.page==='Home'&&this.state.gear==='P'&&!this.state.activeHotspot){
   const initial=presentation(this.state);this.setCamera(initial.camera,initial.target,true);
   for(const wheel of this.wheels)wheel.position.y=-this.bodyRoot.position.y;
   this.assembly=new VehicleAssembly(this.bodyRoot,this.exterior,this.surfaces,{compact:matchMedia('(max-width: 650px)').matches});
   this.assembly.setViewport(this.canvas.clientHeight,this.renderer.getPixelRatio());
   this.startup=new StartupCheck(this.camera,this.controls,this.wheels);
  }
  this.bodyRoot.visible=true;
  const loading=document.getElementById('loading');if(loading)loading.hidden=true;return this;
 }
 makeGround(){
  const pts=[],colors=[];for(let x=-15;x<=15;x+=.23)for(let z=-15;z<=15;z+=.23){pts.push(x,-.04,z);const a=Math.max(0,1-Math.hypot(x,z)/16)*.34;colors.push(a,a,a);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return new THREE.Points(g,new THREE.PointsMaterial({size:.012,vertexColors:true,transparent:true,opacity:.75,sizeAttenuation:true}));
 }
 tube(points,r=.012,mat=this.gold,parent=this.internals,name='formed_pipe'){
  const c=new THREE.CatmullRomCurve3(points.map(p=>V(...p)));return this.mesh(new THREE.TubeGeometry(c,Math.max(12,points.length*8),r,6,false),mat,[0,0,0],parent,name);
 }
 cylinder(r,len,p,axis='x',parent=this.internals,mat=this.gold,name='housing'){
  const o=this.mesh(new THREE.CylinderGeometry(r,r,len,36,1,false),mat,p,parent,name);if(axis==='x')o.rotation.z=Math.PI/2;else if(axis==='z')o.rotation.x=Math.PI/2;return o;
 }
 ring(r,thick,p,axis='x',parent=this.internals,mat=this.gold){const o=this.mesh(new THREE.TorusGeometry(r,thick,6,48),mat,p,parent,'machined_ring');if(axis==='x')o.rotation.y=Math.PI/2;if(axis==='y')o.rotation.x=Math.PI/2;return o;}
 makeInternals(){
  this.plumbing=new THREE.Group();this.plumbing.name='Reservoir_valves_and_lines';this.internals.add(this.plumbing);
  this.battery=new THREE.Group();this.battery.name='Battery_envelope';this.internals.add(this.battery);
  this.batteryMat=this.gold.clone();this.batteryMat.opacity=.075;this.batteryMat.depthWrite=false;
  this.box([1.43,.10,2.66],[0,.20,.13],this.batteryMat,this.battery,'pack_envelope');
  for(let i=0;i<25;i++)this.box([1.4,.008,.014],[0,.255,-1.08+i*.1],this.batteryMat,this.battery,'pack_rib');
  this.box([.6,.17,.34],[0,.32,-1.12],this.batteryMat,this.battery,'rear_pack_step');
  this.tank=new THREE.Group();this.tank.name='Rear_reservoir_proxy';this.internals.add(this.tank);
  const tankMat=this.gold.clone();tankMat.opacity=.42;
  const vessel=this.mesh(new THREE.CapsuleGeometry(.25,.68,12,48),tankMat,[0,.77,-.88],this.tank,'rear_reservoir');vessel.rotation.z=Math.PI/2;
  for(let i=0;i<17;i++){const x=-.57+i*.07125;const r=Math.abs(x)>.34?Math.sqrt(Math.max(.0025,.25**2-(Math.abs(x)-.34)**2)):.25;this.ring(r,.0018,[x,.77,-.88],'x',this.tank);}
  for(let k=0;k<16;k++){
   const a=k*Math.PI/8;const pts=[];for(let i=0;i<25;i++){const x=-.585+i*.04875;const r=Math.abs(x)>.34?Math.sqrt(Math.max(0,.25**2-(Math.abs(x)-.34)**2)):.25;pts.push([x,.77+Math.cos(a)*r,-.88+Math.sin(a)*r]);}this.line(pts,0xc5a66b,.35,this.tank);
  }
  for(const x of [-.34,.34]){this.ring(.256,.009,[x,.77,-.88],'x',this.tank,this.silver);this.box([.025,.07,.35],[x,.5,-.88],this.gold,this.tank,'reservoir_saddle');}
  for(const x of [-.6,.6]){this.cylinder(.045,.1,[x,.77,-.88],'x',this.tank);this.tube([[x,.77,-.88],[x,.68,-1.02],[x*.9,.54,-1.32]],.023,this.gold,this.plumbing);this.box([.12,.12,.13],[x*.9,.53,-1.32],this.gold,this.plumbing,'valve_block');}
  this.rearAssembly=createRearAssembly();this.internals.add(this.rearAssembly);
  this.mainNozzles=this.rearAssembly.mainNozzles;
  for(const x of [-.48,-.16,.16,.48]){
   this.tube([[x,.535,-2.05],[x,.57,-1.80],[x*.9,.57,-1.48],[x<0?-.54:.54,.53,-1.32]],.014,this.gold,this.plumbing);
   this.cylinder(.028,.1,[x,.57,-1.61],'z',this.plumbing,this.gold,'valve_actuator');
  }
  this.drivetrain=new THREE.Group();this.drivetrain.name='Motors_suspension_cooling_proxies';this.internals.add(this.drivetrain);
  const dp=this.drivetrain;
  for(const z of [-1.4125,1.4125]){
   this.cylinder(.12,.37,[0,.39,z],'x',dp,this.gold,'drive_housing');
   for(const x of [-.18,-.12,.12,.18])this.ring(.125,.009,[x,.39,z],'x',dp);
   this.box([.32,.07,.21],[0,.53,z],this.gold,dp,'inverter_cover');
   for(let i=0;i<8;i++)this.box([.26,.014,.006],[0,.576,z-.08+i*.023],this.gold,dp,'cooling_fin');
   this.pipe([-.79,.35,z],[.79,.35,z],.022,this.gold,dp);
   for(const side of [-1,1]){
    this.cylinder(.05,.10,[side*.59,.35,z],'x',dp,this.gold,'cv_joint');
    for(const y of [.26,.45])for(const dz of [-.18,.18])this.pipe([side*.78,.35,z],[side*.37,y,z+dz],.013,this.gold,dp);
    const start=V(side*.35,.58,z-.12),end=V(side*.74,.37,z),delta=end.clone().sub(start),axis=delta.clone().normalize(),u=V(0,1,0).cross(axis).normalize(),v=axis.clone().cross(u);
    this.pipe(start.toArray(),end.toArray(),.018,this.gold,dp);const coil=[];for(let i=0;i<=120;i++){const t=i/120,a=t*Math.PI*18;coil.push(start.clone().addScaledVector(delta,t).addScaledVector(u,Math.cos(a)*.035).addScaledVector(v,Math.sin(a)*.035).toArray());}this.tube(coil,.005,this.gold,dp,'coil_spring');
    this.tube([[side*.72,.27,z-.24],[side*.42,.25,z-.3],[side*.22,.3,z],[side*.42,.25,z+.3],[side*.72,.27,z+.24]],.018,this.gold,dp,'subframe');
   }
  }
  // A stacked front module replaces the featureless rectangular block from v1.
  for(const side of [-1,1]){
   this.box([.23,.18,.34],[side*.43,.4,1.59],this.gold,dp,'front_equipment_enclosure');
   this.cylinder(.072,.22,[side*.55,.44,1.13],'z',dp,this.gold,'front_pump_proxy');
   for(let j=0;j<5;j++)this.ring(.074,.004,[side*.55,.44,1.05+j*.035],'z',dp);
   this.tube([[side*.69,.23,1.58],[side*.73,.31,1.03],[side*.68,.27,.55],[side*.68,.27,-.8],[side*.55,.43,-1.2]],.014,this.gold,dp,'side_hardline');
   this.tube([[side*.5,.52,1.4],[side*.28,.57,1.68],[side*.2,.42,1.85],[side*.6,.35,1.9]],.016,this.gold,dp);
   this.tube([[side*.8,.25,-1.5],[side*.76,.5,-1.67],[side*.53,.64,-1.75]],.021,this.gold,dp);
   for(let j=0;j<4;j++)this.box([.11,.025,.02],[side*.7,.28,-.6+j*.4],this.gold,dp,'line_clamp');
  }
  this.box([.84,.21,.045],[0,.36,1.95],this.gold,dp,'front_heat_exchanger');
  for(let i=0;i<24;i++)this.pipe([-.39+i*.034,.27,1.98],[-.39+i*.034,.45,1.98],.003,this.gold,dp);
 }
 surface(points,nu,nv,mat,parent,name){
  const pos=[],uv=[],ix=[];for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){const p=points(i/nu,j/nv);pos.push(...p);uv.push(i/nu*1.9,j/nv*.42);}for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j,b=a+nv+1;ix.push(a,b,a+1,b,b+1,a+1);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return this.mesh(g,mat,[0,0,0],parent,name);
 }
 makeAero(){
  this.aero=new THREE.Group();this.aero.name='Active_aero';this.bodyRoot.add(this.aero);
  const mat=this.technicalMaterial();mat.side=THREE.DoubleSide;this.aeroMat=mat;
  this.frontWing=this.surface((u,v)=>[(u-.5)*1.6,.17+Math.sin(v*Math.PI)*.016,1.95+v*.26],32,6,mat,this.aero,'front_foil');this.frontWing.geometry.translate(0,-.17,-2.08);this.frontWing.position.set(0,.17,2.08);
  this.hoodVent=this.box([.7,.012,.20],[0,.67,1.06],this.dark,this.aero,'Hood_vent');this.hoodVent.geometry.translate(0,0,.1);
  this.boards=[];for(const side of [-1,1]){const o=this.box([.015,.11,.38],[side*.9,.25,.68],mat,this.aero,'Side_barge_board');o.geometry.translate(0,0,-.19);this.boards.push(o);}
  this.beams=new THREE.Group();this.beams.name='Headlight_beams';this.scene.add(this.beams);
  for(const side of [-1,1]){
   const geo=new THREE.BufferGeometry();const x=side*.73;geo.setAttribute('position',new THREE.Float32BufferAttribute([x-.035,.54,2.16,x-.8,.48,5.2,x+.8,.48,5.2,x-.035,.54,2.16,x+.8,.48,5.2,x+.035,.54,2.16],3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,0,1,1,0,1],2));
   const beam=new THREE.ShaderMaterial({uniforms:{uStrength:{value:1}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
    varying vec2 vUv; uniform float uStrength;
    void main(){
     // MSAA edge samples can extrapolate UVs beyond [0,1]. A negative
     // fractional-power base produces NaN, which spreads through bloom.
     vec2 uv=clamp(vUv,vec2(0.0),vec2(1.0));
     float a=pow(1.0-uv.x,1.5)*max(0.0,sin(uv.y*3.14159265))*.055*uStrength;
     gl_FragColor=vec4(.8,.86,.91,a);
    }
   `});this.mesh(geo,beam,[0,0,0],this.beams);
  }
 }
 makeCabin(){
  this.cabin=new THREE.Group();this.cabin.name='Climate_cabin';this.scene.add(this.cabin);const dash=new THREE.MeshStandardMaterial({color:0x292c30,metalness:.15,roughness:.62});
  this.box([1.85,.19,.55],[0,.73,.65],dash,this.cabin,'dashboard');this.box([1.9,.045,.65],[0,.63,.7],this.silver,this.cabin);
  this.box([.56,.38,.035],[-.35,.95,.45],this.dark,this.cabin,'driver_instrument_panel');this.box([.56,.37,.025],[.4,.94,.39],this.dark,this.cabin,'central_display');
  this.box([.055,.31,.06],[.4,.69,.45],this.silver,this.cabin,'display_mount');this.box([.24,.15,.83],[.2,.42,.12],dash,this.cabin,'console');
  for(const s of [-1,1]){this.box([.15,.44,1.3],[s*.94,.45,.1],dash,this.cabin,'door');this.pipe([s*.89,.66,.7],[s*.64,1.48,1.1],.037,this.silver,this.cabin);this.box([.26,.045,.13],[s*.68,.83,.43],this.dark,this.cabin,'vent');}
  const yoke=new THREE.Group();yoke.position.set(-.36,.83,.13);yoke.name='yoke';this.cabin.add(yoke);
  const shape=[[-.25,.15,0],[-.31,.08,0],[-.28,-.15,0],[-.2,-.2,0],[.2,-.2,0],[.28,-.15,0],[.31,.08,0],[.25,.15,0]];
  for(let i=0;i<shape.length-1;i++)this.pipe(shape[i],shape[i+1],.034,this.dark,yoke);this.box([.23,.22,.07],[0,0,0],this.dark,yoke);this.pipe([-.25,-.1,0],[0,-.02,0],.028,this.silver,yoke);this.pipe([.25,-.1,0],[0,-.02,0],.028,this.silver,yoke);
  this.cabinFlow=new THREE.Group();this.cabin.add(this.cabinFlow);
  for(const side of [-1,1])for(let i=0;i<14;i++){const x=side*.63+(i-7)*.013;const c=new THREE.CatmullRomCurve3([V(x,.82,.42),V(x*.9,.72,.1),V(x*.8,.55,-.45),V(x*.8,.39,-1.1)]);this.line(c.getPoints(30),WHITE,.34,this.cabinFlow);}
  // Reference t086/t094: close cabin view, wide floating screen and sculpted dashboard.
  const screen=this.cabin.getObjectByName('central_display');screen.scale.set(1.4,1.65,1);screen.position.set(.40,1.05,.34);
  const instrument=this.cabin.getObjectByName('driver_instrument_panel');instrument.visible=false;
  this.cabin.scale.x=-1;this.cabin.visible=false;
 }
 makeTrack(){
  this.track=new THREE.Group();this.track.name='Demo_track';this.scene.add(this.track);this.track.visible=false;
  const pts=[[-2,0,-1.5],[-.3,.1,-1.1],[1.8,.65,-1.7],[2.1,.7,-.9],[1.2,.45,-.1],[1.8,.3,1.1],[.9,.1,1.5],[.4,0,.1],[-.3,0,-.2],[-1.2,.1,.9],[-1.9,.15,.6],[-1.4,0,-.4],[-2,0,-1.5]].map(p=>V(...p));
  this.trackCurve=new THREE.CatmullRomCurve3(pts,true,'catmullrom',.28);
  this.trackMat=new THREE.MeshBasicMaterial({color:0xffb72e});this.mesh(new THREE.TubeGeometry(this.trackCurve,220,.023,5,true),this.trackMat,[0,0,0],this.track);
  for(let i=0;i<100;i++){const p=this.trackCurve.getPoint(i/100);this.pipe([p.x,-.15,p.z],p.toArray(),.006,this.trackMat,this.track);}
  this.trackDot=this.mesh(new THREE.ConeGeometry(.09,.26,3),new THREE.MeshBasicMaterial({color:0xffffff}),[0,0,0],this.track);this.trackDot.rotation.x=Math.PI/2;
 }
 prepareLayers(){
  this.layerChannels=[];
  const add=(name,roots)=>{
   const materials=new Map();
   for(const root of roots)root.traverse(o=>{if(!o.material||Array.isArray(o.material))return;const original=o.material;
    if(!materials.has(original)){const m=original.clone();m.transparent=true;m.depthWrite=false;materials.set(original,{material:m,opacity:original.opacity});}
    o.material=materials.get(original).material;
   });
   this.layerChannels.push({name,roots,materials:[...materials.values()],value:name==='battery'?.075:1,target:name==='battery'?.075:1});
  };
  add('battery',[this.battery]);add('tank',[this.tank]);add('plumbing',[this.plumbing]);add('rear',[this.rearAssembly]);
  add('mechanical',this.internals.children.filter(c=>![this.battery,this.tank,this.plumbing,this.rearAssembly].includes(c)));
  // t045 shows the front dashboard-area assembly highlighted; dimensions are a visual proxy.
  this.dashboardHighlight=new THREE.Group();this.dashboardHighlight.name='Display_dashboard_proxy';this.internals.add(this.dashboardHighlight);
  const mat=this.gold.clone();mat.opacity=.55;
  this.box([1.18,.16,.28],[0,.72,.54],mat,this.dashboardHighlight,'dashboard_module');
  this.box([.25,.13,.07],[0,.64,.37],mat,this.dashboardHighlight,'display_module');
  for(const x of [-.45,0,.45])this.box([.018,.16,.29],[x,.72,.54],this.gold,this.dashboardHighlight,'module_seam');
  add('dashboard',[this.dashboardHighlight]);
  // Battery channel uses full material opacity as its highlighted endpoint.
  this.layerChannels.find(c=>c.name==='battery').materials.forEach(m=>m.opacity=.85);
 }
 makePartHighlights(){
  this.partHighlights={};
  const targets={rearWing:[this.importedWing],frontWing:[this.frontWing],hoodOpen:[this.hoodVent],bargeDeploy:this.boards,lightMode:this.lights};
  for(const [key,roots] of Object.entries(targets)){
   const lines=[];
   for(const root of roots){const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
    for(const mesh of meshes){const line=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,24),new THREE.LineBasicMaterial({color:0xff263e,transparent:true,opacity:.9,depthWrite:false,toneMapped:false}));line.visible=false;line.renderOrder=7;mesh.add(line);lines.push(line);}
   }
   this.partHighlights[key]=lines;
  }
 }
 positionHotspots(){
  if(!this.ready||this.state.page!=='Home'||this.mode!=='car')return;
  const hotspots=document.getElementById('hotspots');if(!hotspots)return;
  hotspots.hidden=Boolean(this.startup&&!this.startup.complete);if(hotspots.hidden)return;
  const rect=this.canvas.getBoundingClientRect();if(!rect.width)return;
  this.bodyRoot.updateWorldMatrix(true,false);
  const anchors=[];
  for(const button of document.querySelectorAll('[data-hotspot]')){
   const key=button.dataset.hotspot,part=homeParts[key],p=V(...part.position);
   if(key==='rearWing')p.y+=this.wingMotion?.pose.lift??0;
   this.bodyRoot.localToWorld(p);p.project(this.camera);
   const x=(p.x+1)*rect.width/2,y=(1-p.y)*rect.height/2;
   button.style.visibility=p.z>1||p.z< -1?'hidden':'visible';
   anchors.push({key,button,x,y,sourceX:x,sourceY:y});
   if(this.state.activeHotspot===key){
    const menu=document.getElementById('part-menu'),host=this.canvas.closest('main').getBoundingClientRect();
    // Keep the controls beside the car, so the selected wing and nozzles remain visible.
    const projected=[];
    for(const bx of [-1.1,1.1])for(const by of [0,1.45])for(const bz of [-2.3,2.3]){
     const corner=V(bx,by,bz);this.bodyRoot.localToWorld(corner);corner.project(this.camera);
     projected.push({x:rect.left-host.left+(corner.x+1)*rect.width/2,y:rect.top-host.top+(1-corner.y)*rect.height/2});
    }
    if(innerWidth<=650&&innerHeight>innerWidth){
     // A fixed percentage could cover the protruding lower nozzles. Follow
     // the projected car instead, while keeping the music controls clear.
     const carBottom=Math.max(...projected.map(p=>p.y))+12;
     const playerTop=document.getElementById('player').getBoundingClientRect().top-host.top;
     menu.style.top=Math.max(host.height*.40,Math.min(carBottom,playerTop-menu.offsetHeight-16))+'px';
    }else{
     const right=Math.max(...projected.map(p=>p.x))+16,left=Math.min(...projected.map(p=>p.x))-menu.offsetWidth-16;
     const menuX=right+menu.offsetWidth<host.width-16?right:left>host.width*.08?left:host.width-menu.offsetWidth-16;
     menu.style.left=menuX+'px';
     menu.style.top=Math.max(host.height*.13,Math.min(host.height*.72-menu.offsetHeight,rect.top-host.top+y-20))+'px';
    }
   }
  }
  for(const p of layoutPartAnchors(anchors,rect.width,rect.height)){
   p.button.style.left=p.x+'px';p.button.style.top=p.y+'px';
   const line=document.querySelector(`[data-part-leader="${p.key}"]`);
   if(line){for(const [key,value] of Object.entries({x1:p.sourceX,y1:p.sourceY,x2:p.x,y2:p.y}))line.setAttribute(key,value);line.style.visibility=p.button.style.visibility;line.style.display=Math.hypot(p.x-p.sourceX,p.y-p.sourceY)>10?'':'none';}
  }
 }
 resize(){
  const r=this.canvas.parentElement.getBoundingClientRect();if(r.width<1||r.height<1)return;
  this.renderer.setSize(r.width,r.height,false);this.composer?.setSize(r.width,r.height);this.camera.aspect=r.width/r.height;
  this.airflow?.setViewport(r.width,r.height,this.renderer.getPixelRatio());
  this.assembly?.setViewport(r.height,this.renderer.getPixelRatio());
  // Keep the closer Custom framing, but fit wider car views into portrait canvases.
  const custom=this.state.page==='Vehicle'&&this.state.subpage==='Dynamics'&&this.state.preset==='Custom';
  this.camera.zoom=this.mode==='car'?(this.presentationStyle?.zoom??1.15)*Math.min(1,this.camera.aspect/(this.state.boostPreview?1.15:custom?1:1.5)):1;
  this.camera.fov=this.mode==='cabin'?54:31;this.camera.updateProjectionMatrix();
 }
 beginShiftPreview(){
  if(!this.ready||this.state.page!=='Home'||this.mode!=='car'||this.canvas.getAnimations().length)return false;
  this.cancelStartup({restoreCamera:false});
  const position=this.camera.position.clone(),target=this.controls.target.clone();
  // Flush OrbitControls' old inertia, then preserve the exact hand-rotated pose.
  const damping=this.controls.enableDamping;this.controls.enableDamping=false;this.controls.update();this.controls.enableDamping=damping;
  this.camera.position.copy(position);this.controls.target.copy(target);this.camera.lookAt(target);
  this.cameraTween=null;this.controls.enabled=false;

  const start=new THREE.Spherical().setFromVector3(position.clone().sub(target));
  this.shiftPreview={position,target,start,desired:start.clone(),desiredTarget:target.clone(),progress:0,key:this.presentationKey};
  return true;
 }
 previewShift(gear,progress){
  const g=this.shiftPreview;if(!g)return;
  const p=SHIFT_PRESENTATION.cameras[gear]||g.position.toArray();
  const target=gear?V(...SHIFT_PRESENTATION.target):g.target;
  const end=new THREE.Spherical().setFromVector3(V(...p).sub(target));
  end.theta=g.start.theta+THREE.MathUtils.euclideanModulo(end.theta-g.start.theta+Math.PI,Math.PI*2)-Math.PI;
  // Ease in with finger travel and reserve 20% for the gentle release.
  const u=Math.min(1,Math.max(0,progress)),a=(u*u*(3-2*u))*SHIFT_PRESENTATION.maxPreview;g.progress=a;
  g.desired.set(THREE.MathUtils.lerp(g.start.radius,end.radius,a),THREE.MathUtils.lerp(g.start.phi,end.phi,a),THREE.MathUtils.lerp(g.start.theta,end.theta,a));
  g.desiredTarget.copy(g.target).lerp(target,a);
 }
 endShiftPreview(gear){
  const g=this.shiftPreview;if(!g)return;this.shiftPreview=null;this.controls.enabled=this.mode==='car';
  if(g.key!==this.presentationKey)return;
  const position=SHIFT_PRESENTATION.cameras[gear]||g.position.toArray();
  const target=gear?SHIFT_PRESENTATION.target:g.target.toArray();
  this.setCamera(position,target);
  if(this.cameraTween){this.cameraTween.duration=gear ? SHIFT_PRESENTATION.releaseBase+SHIFT_PRESENTATION.releaseRemaining*(1-g.progress) : SHIFT_PRESENTATION.cancelDuration;this.cameraTween.sineOut=true;this.cameraTween.clearance=gear?.12:0;}
 }
 setCamera(p,t,immediate=false){
  // Clear residual manual-orbit velocity before a scripted transition.
  const position=this.camera.position.clone(),target=this.controls.target.clone(),damping=this.controls.enableDamping;
  this.controls.enableDamping=false;this.controls.update();this.controls.enableDamping=damping;
  this.camera.position.copy(position);this.controls.target.copy(target);
  if(immediate||reducedMotion()){this.camera.position.set(...p);this.controls.target.set(...t);this.camera.lookAt(...t);this.cameraTween=null;return;}
  const start=new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
  const end=new THREE.Spherical().setFromVector3(V(...p).sub(V(...t)));
  // Shortest orbit keeps the lens outside the body, unlike a Cartesian straight line.
  end.theta=start.theta+THREE.MathUtils.euclideanModulo(end.theta-start.theta+Math.PI,Math.PI*2)-Math.PI;
  this.cameraTween={start,end,from:this.controls.target.clone(),target:V(...t),time:0,duration:MOTION_MS/1000};
 }
 applyMode(p,immediate=false){
  this.mode=p.mode;this.modelRoot.visible=p.mode==='car';this.cabin.visible=p.mode==='cabin';this.track.visible=p.mode==='track';
  this.ground.visible=p.mode==='car'||p.mode==='track';this.controls.enabled=p.mode==='car';
  this.controls.minDistance=p.mode==='cabin'?.6:3.4;this.controls.maxDistance=p.mode==='cabin'?6:12;
  this.setCamera(p.camera,p.target,immediate);this.resize();
 }
 apply(s){
  const prev=this.state;this.state={...s};const p=presentation(s);const old=presentation(prev);
  if(s.page!==prev.page||s.gear!==prev.gear||s.activeHotspot!==prev.activeHotspot)this.cancelStartup({restoreCamera:false});
  const changed=old.key!==p.key,gearChanged=prev.gear!==s.gear;
  // Gear gestures reuse the collision-safe orbit transition; N keeps the current view.
  if(gearChanged&&s.page==='Home'&&!s.activeHotspot){

   if(SHIFT_PRESENTATION.cameras[s.gear]){p.camera=SHIFT_PRESENTATION.cameras[s.gear];p.target=SHIFT_PRESENTATION.target;}
   if(!changed&&s.gear!=='N'){this.setCamera(p.camera,p.target);if(this.cameraTween){this.cameraTween.duration=SHIFT_PRESENTATION.buttonDuration;this.cameraTween.clearance=.32;}}
  }
  this.presentationKey=p.key;this.layerMode=p.layer;this.exposureTarget=p.mode==='cabin'?.65:p.exposure;this.presentationStyle=p;
  if(changed){this.layerElapsed=0;if(this.shiftPreview){this.shiftPreview=null;this.controls.enabled=p.mode==='car';}}
  if(changed){

   clearTimeout(this.modeTimer);this.canvas.getAnimations().forEach(a=>a.cancel());
   if(this.mode!==p.mode&&!reducedMotion()&&!s.boostPreview&&!prev.boostPreview){
    this.cameraTween=null;
    this.canvas.animate([{opacity:1},{opacity:0,offset:.36},{opacity:0,offset:.42},{opacity:1}],{duration:620,easing:'ease-in-out'});
    this.modeTimer=setTimeout(()=>{if(this.presentationKey===p.key)this.applyMode(this.presentationStyle,true);},235);
   }else this.applyMode(p,Boolean(s.boostPreview||prev.boostPreview));
  }
  const silhouette=p.layer==='silhouette';
  const exterior=p.layer==='exterior',xray=!exterior&&!silhouette;
  // Keep the parent visible while its channels fade; hiding it here caused popping.
  this.internals.visible=true;
  this.exteriorAppearance=exterior;
  for(const c of this.layerChannels||[]){c.target=c.name==='rear'&&exterior?1:xray?(p.channels[c.name]??0):0;c.delay=c.target>c.value?p.revealDelay:0;}
  this.surfaces.forEach(m=>{
   const transparent=xray;
   m.userData.targetOpacity=silhouette?p.shell:transparent?p.shell*(m.userData.isGlass?.65:1):1;
   m.depthWrite=false;m.userData.targetGrid=silhouette?0:p.grid*(m.userData.isGlass?.65:1);m.userData.targetXray=transparent?1:0;
   m.userData.targetColor=new THREE.Color(silhouette?0x080a0c:exterior?(m.userData.isGlass?0x020406:m.userData.isCarbon?0x05070a:0x14191e):0xbfc8cf);
  });
  this.frontWing.visible=!silhouette;this.hoodVent.visible=!silhouette;this.boards.forEach(o=>o.visible=!silhouette);
  for(const [key,lines] of Object.entries(this.partHighlights||{}))for(const line of lines)line.visible=s.page==='Home'&&s.activeHotspot===key;
  this.cabinFlow.visible=s.climatePower!==false;
  this.cabinFlow.children.forEach(o=>o.material.opacity=.12+.028*(s.fanSpeed??5));
  const lighting=lightingState(s.lightMode||(s.lights===false?'Off':'On'));
  this.lightTarget=p.mode==='car'&&!silhouette?lighting.lamps:0;this.beamTarget=p.mode==='car'&&!silhouette?lighting.beams:0;
  this.trackMat.color.set(s.theme==='Light'?0xe9e9e6:0xff261e);this.trackMat.toneMapped=false;
  this.ground.material.color.set(p.mode==='track'?(s.theme==='Light'?0xaaaaaa:0x8e1712):0xffffff);
 }
 cancelStartup({restoreCamera=true,immediate=false}={}){
  if(!this.startup||this.startup.complete)return false;
  this.startup.finish({restoreCamera:false});this.assembly?.finish();this.cameraTween=null;
  if(restoreCamera){const p=presentation(this.state);this.setCamera(p.camera,p.target,immediate);}
  return true;
 }
 animate(){this.raf=requestAnimationFrame(()=>this.animate());const dt=Math.min(this.clock.getDelta(),.25);this.elapsed+=dt;
  const startupDt=document.hidden?0:dt;
  if(this.startup&&!this.startup.complete){
   if(reducedMotion()||this.mode!=='car')this.cancelStartup({immediate:true});
   else this.startup.update(startupDt);
  }
  const startupActive=Boolean(this.startup&&!this.startup.complete);
  if(!startupActive&&this.shiftPreview){
   const g=this.shiftPreview,a=1-Math.exp(-SHIFT_PRESENTATION.followRate*dt);
   const current=new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
   current.theta=g.desired.theta+THREE.MathUtils.euclideanModulo(current.theta-g.desired.theta+Math.PI,Math.PI*2)-Math.PI;
   current.set(THREE.MathUtils.lerp(current.radius,g.desired.radius,a),THREE.MathUtils.lerp(current.phi,g.desired.phi,a),THREE.MathUtils.lerp(current.theta,g.desired.theta,a));
   this.controls.target.lerp(g.desiredTarget,a);this.camera.position.setFromSpherical(current).add(this.controls.target);this.camera.lookAt(this.controls.target);
  }else if(!startupActive&&this.cameraTween){const t=this.cameraTween;t.time+=dt;const a=Math.min(t.time/t.duration,1),e=t.sineOut?Math.sin(a*Math.PI/2):a*a*a*(a*(a*6-15)+10);this.controls.target.lerpVectors(t.from,t.target,e);const sphere=new THREE.Spherical(THREE.MathUtils.lerp(t.start.radius,t.end.radius,e)+Math.sin(Math.PI*e)*(t.clearance||0),THREE.MathUtils.lerp(t.start.phi,t.end.phi,e),THREE.MathUtils.lerp(t.start.theta,t.end.theta,e));this.camera.position.setFromSpherical(sphere).add(this.controls.target);this.camera.lookAt(this.controls.target);if(a===1)this.cameraTween=null;}
  if(!startupActive&&!this.cameraTween&&!this.shiftPreview)this.controls.update();
  this.layerElapsed=(this.layerElapsed||0)+dt;
  for(const c of this.layerChannels||[]){if(reducedMotion()||this.layerElapsed>=(c.delay||0))c.value=reducedMotion()?c.target:THREE.MathUtils.damp(c.value,c.target,8,dt);for(const {material,opacity} of c.materials){material.opacity=opacity*c.value;material.depthWrite=c.name==='rear'&&this.exteriorAppearance&&material.opacity>.9;}for(const root of c.roots)root.visible=c.value>.004;}
  this.surfaces.forEach(m=>{if(m.userData.targetOpacity!==undefined){const a=reducedMotion()?1:1-Math.exp(-8*dt);m.opacity=THREE.MathUtils.lerp(m.opacity,m.userData.targetOpacity,a);m.userData.xray.value=THREE.MathUtils.lerp(m.userData.xray.value,m.userData.targetXray,a);m.color.lerp(m.userData.targetColor,a);m.userData.grid.value=THREE.MathUtils.lerp(m.userData.grid.value,m.userData.targetGrid,a);m.depthWrite=m.userData.targetXray===0&&m.userData.xray.value<.01&&m.opacity>.9;}});
  this.renderer.toneMappingExposure=THREE.MathUtils.damp(this.renderer.toneMappingExposure,this.exposureTarget??1.2,6,dt);
  this.lightGain=reducedMotion()?this.lightTarget:THREE.MathUtils.damp(this.lightGain??1,this.lightTarget??1,7,dt);
  this.beamGain=reducedMotion()?this.beamTarget:THREE.MathUtils.damp(this.beamGain??1,this.beamTarget??1,7,dt);
  this.beams.visible=Boolean(this.ready&&this.mode==='car'&&this.beamGain>.001&&(!this.assembly||this.assembly.complete));this.beams.children.forEach(o=>o.material.uniforms.uStrength.value=this.beamGain);
  for(const o of this.lights||[]){o.visible=this.lightGain>.001;o.material.opacity=(o.material.userData.lightOpacity??1)*this.lightGain;}
  const s=this.state;
  const check=startupActive?this.startup.frame:null,motionDt=startupActive?startupDt:dt;
  this.wingMotion?.update(check?{...s,gear:check.wing?'D':'P'}:s,motionDt,reducedMotion());
  this.airflow.update(motionDt,{active:this.ready&&this.mode==='car'&&(check?check.airflow:this.presentationStyle?.airflow===true),reducedMotion:reducedMotion(),lightTheme:s.theme==='Light',wingLift:this.wingMotion?.pose.lift??0});
  if(s.page==='Track'&&s.boostPreview)this.boostJets?.update(dt,{active:this.ready&&s.boostActive,reducedMotion:reducedMotion()});else this.boostJets?.reset();
  const approach=(value,target,rate=7)=>reducedMotion()?target:THREE.MathUtils.damp(value,target,rate,dt);
  this.frontWing.rotation.x=approach(this.frontWing.rotation.x,s.frontWing==='High Downforce'?-.15:0);
  this.bodyRoot.position.y=approach(this.bodyRoot.position.y,s.suspension==='Low'?-.045:0,6);
  for(const wheel of this.wheels||[])wheel.position.y=-this.bodyRoot.position.y;
  this.beams.position.y=this.bodyRoot.position.y;
  this.hoodVent.rotation.x=approach(this.hoodVent.rotation.x,s.hoodOpen?-.25:0);
  this.hoodVent.position.y=approach(this.hoodVent.position.y,s.hoodOpen?.72:.67);
  this.boards.forEach((o,i)=>{const side=i===0?-1:1;o.rotation.y=approach(o.rotation.y,s.bargeDeploy?side*.4:0);o.position.x=approach(o.position.x,side*(s.bargeDeploy?.99:.9));});
  for(const f of this.fans)f.rotation.z+=dt*(s.fanOn?9:.4);
  if(!document.hidden)this.assembly?.update(dt,{reducedMotion:reducedMotion(),visible:this.mode==='car'});
  if(this.mode==='track'){if(s.telemetry!==false&&!reducedMotion())this.trackElapsed=(this.trackElapsed||0)+dt;const a=((this.trackElapsed||0)/91.5)%1,p=this.trackCurve.getPoint(a),d=this.trackCurve.getTangent(a);this.trackDot.position.copy(p);this.trackDot.position.y+=.08;this.trackDot.rotation.z=-Math.atan2(d.x,d.z);}
  if(this.mode==='hidden')return;
  if(this.airflow.visible){this.airflow.protectNozzles(this.rearAssembly,this.camera);this.airflow.protectWing(this.importedWing,this.camera);}
  this.renderer.info.reset();this.composer.render();this.positionHotspots();
 }
}
