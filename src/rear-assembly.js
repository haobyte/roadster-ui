import * as THREE from 'three';

// Pilot 3.6–4.8s: four separate lower castings and four smaller upper ports.
// Mouth depth and concealed surfaces are visual approximations, not CAD.
export function createRearAssembly(){
 const group=new THREE.Group();group.name='Rear_4_plus_4_visual_assembly';group.mainNozzles=[];
 const gold=new THREE.MeshStandardMaterial({color:0xcaa45e,metalness:.78,roughness:.30,emissive:0x624719,emissiveIntensity:.12,transparent:true,opacity:1});
 const upperGold=gold.clone();upperGold.color.set(0xb79a61);upperGold.roughness=.36;
 const dark=new THREE.MeshStandardMaterial({color:0x281d0e,metalness:.35,roughness:.46,transparent:true,opacity:1});
 const frame=new THREE.MeshStandardMaterial({color:0x040609,metalness:.08,roughness:.78,envMapIntensity:.15,transparent:true,opacity:1});
 const mesh=(g,m,p,parent,name)=>{const o=new THREE.Mesh(g,m);o.position.set(...p);o.name=name;parent.add(o);return o;};
 const ring=(r,t,p,parent,m=gold)=>mesh(new THREE.TorusGeometry(r,t,10,48),m,p,parent,'machined_mouth_lip');
 const disk=(r,p,parent)=>{const o=mesh(new THREE.CircleGeometry(r,48),dark,p,parent,'shadowed_inner_throat');o.rotation.y=Math.PI;return o;};
 // A tapered U-shaped diffuser return joins the rear quarters. Its open top
 // avoids a separate rectangular frame around the two rows of hardware.
 const surround=new THREE.Shape();
 surround.moveTo(-.79,.65);surround.quadraticCurveTo(-.76,.43,-.71,.225);
 surround.quadraticCurveTo(-.70,.175,-.65,.175);surround.lineTo(.65,.175);
 surround.quadraticCurveTo(.70,.175,.71,.225);surround.quadraticCurveTo(.76,.43,.79,.65);
 surround.lineTo(.665,.61);surround.lineTo(.645,.247);
 surround.quadraticCurveTo(.64,.213,.61,.213);surround.lineTo(-.61,.213);
 surround.quadraticCurveTo(-.64,.213,-.645,.247);surround.lineTo(-.665,.61);surround.closePath();
 const surroundGeometry=new THREE.ExtrudeGeometry(surround,{depth:.15,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:3,curveSegments:16});
 const positions=surroundGeometry.attributes.position;
 for(let i=0;i<positions.count;i++){
  const rise=THREE.MathUtils.smoothstep(positions.getY(i),.25,.65);
  positions.setZ(i,positions.getZ(i)+.09*rise*Math.pow(Math.abs(positions.getX(i))/.79,2));
 }
 surroundGeometry.computeVertexNormals();
 mesh(surroundGeometry,frame,[0,0,-2.16],group,'continuous_rear_surround');
 for(const [index,x] of [-.48,-.16,.16,.48].entries()){
  const port=new THREE.Group();port.name='main_nozzle_'+(index+1);port.position.set(x,.34,-2.15);group.add(port);group.mainNozzles.push(port);
  const half=.115,r=.025,shape=new THREE.Shape();
  shape.moveTo(-half+r,-half);shape.lineTo(half-r,-half);shape.quadraticCurveTo(half,-half,half,-half+r);shape.lineTo(half,half-r);shape.quadraticCurveTo(half,half,half-r,half);shape.lineTo(-half+r,half);shape.quadraticCurveTo(-half,half,-half,half-r);shape.lineTo(-half,-half+r);shape.quadraticCurveTo(-half,-half,-half+r,-half);
  const hole=new THREE.Path();hole.absarc(0,0,.089,0,Math.PI*2,true);shape.holes.push(hole);
  mesh(new THREE.ExtrudeGeometry(shape,{depth:.028,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:3,curveSegments:18}),gold,[0,0,.075],port,'individual_square_casting');
  const profile=[[.095,.100],[.102,.073],[.092,.045],[.078,.018],[.078,-.020],[.074,-.035],[.061,-.035],[.057,-.020],[.052,.035],[.034,.095]].map(([r,z])=>new THREE.Vector2(r,z));
  const shell=mesh(new THREE.LatheGeometry(profile.reverse(),64),gold,[0,0,0],port,'protruding_annular_nozzle');shell.rotation.x=Math.PI/2;
  ring(.073,.004,[0,0,-.030],port);disk(.034,[0,0,.100],port);
  for(const [dx,dy] of [[-.092,-.087],[.092,-.087],[.092,.087],[-.092,.087]]){
   const screw=mesh(new THREE.CylinderGeometry(.006,.006,.004,12),dark,[dx,dy,.069],port,'recessed_mount_fastener');screw.rotation.x=Math.PI/2;
  }
  const upper=mesh(new THREE.CylinderGeometry(.047,.054,.11,48,1,true),upperGold,[x,.535,-2.115],group,'upper_round_port');upper.rotation.x=Math.PI/2;
  ring(.051,.006,[x,.535,-2.174],group,upperGold);ring(.058,.007,[x,.535,-2.061],group,upperGold);disk(.043,[x,.535,-2.052],group);
 }
 return group;
}
