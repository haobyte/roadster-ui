import * as THREE from 'three';

// Demonstration travel, not factory actuator measurements or control logic.
export function rearWingPose(state){
 const preview=(state.page==='Vehicle'&&state.subpage==='Dynamics')||(state.page==='Track'&&state.boostPreview);
 const home=state.page==='Home'&&(state.gear==='D'||state.activeHotspot==='rearWing');
 if((!home&&!preview)||state.rearWing==='Stowed')return {lift:0,pitch:0};
 return state.rearWing==='Low Drag'?{lift:.10,pitch:-.035}:{lift:.24,pitch:-.24};
}
const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};

export class RearWingMotion{
 constructor(blade,root){
  this.blade=blade;this.root=root;this.base=blade.position.clone();
  this.pose={lift:0,pitch:0};this.target={lift:0,pitch:0};this.transition=null;
  this.supports=[];
  const material=new THREE.MeshStandardMaterial({color:0x59636e,metalness:.82,roughness:.30});
  const piston=new THREE.MeshStandardMaterial({color:0xadb7bf,metalness:.92,roughness:.22});
  const geometry=new THREE.CylinderGeometry(.010,.010,1,12),sleeveGeometry=new THREE.CylinderGeometry(.017,.019,1,12);
  for(const side of [-1,1])for(const dz of [-.055,.055]){
   const arm=new THREE.Mesh(geometry,piston);arm.name='Moving_wing_linkage';root.add(arm);
   const sleeve=new THREE.Mesh(sleeveGeometry,material);sleeve.name='Wing_actuator_sleeve';root.add(sleeve);
   const start=new THREE.Vector3(side*.58,.806,-(this.base.x-.15+dz)),tip=new THREE.Vector3(.12+dz,-.032,side*.58);
   const joints=[start,tip].map(()=>{const joint=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.042,16),material);joint.rotation.z=Math.PI/2;root.add(joint);return joint;});
   this.supports.push({arm,sleeve,joints,start,tip});
  }
 }
 update(state,dt,reducedMotion=false){
  const target=rearWingPose(state);
  if(target.lift!==this.target.lift||target.pitch!==this.target.pitch){
   this.target=target;
   const travel=Math.max(Math.abs(target.lift-this.pose.lift)/.24,Math.abs(target.pitch-this.pose.pitch)/.24);
   this.transition={from:{...this.pose},to:target,time:0,duration:.72+.73*Math.min(1,travel),rising:target.lift>this.pose.lift};
  }
  if(reducedMotion){this.pose={...target};this.transition=null;}
  else if(this.transition){
   const t=this.transition;t.time+=dt;const u=t.time/t.duration;
   // Lift first, then set incidence; retract by levelling before lowering.
   const lift=ease(t.rising?u/.8:(u-.18)/.82),pitch=ease(t.rising?(u-.24)/.76:u/.65);
   this.pose={lift:THREE.MathUtils.lerp(t.from.lift,t.to.lift,lift),pitch:THREE.MathUtils.lerp(t.from.pitch,t.to.pitch,pitch)};
   if(u>=1){this.pose={...t.to};this.transition=null;}
  }
  this.blade.position.y=this.base.y+this.pose.lift;this.blade.rotation.z=this.pose.pitch;
  this.blade.updateWorldMatrix(true,false);
  for(const {arm,sleeve,joints,start,tip} of this.supports){
   const end=this.root.worldToLocal(this.blade.localToWorld(tip.clone()));
   const direction=end.clone().sub(start);
   arm.position.copy(start).add(end).multiplyScalar(.5);
   arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
   arm.scale.y=Math.max(.001,direction.length());
   const length=direction.length(),sleeveLength=Math.min(.17,length*.72);
   sleeve.quaternion.copy(arm.quaternion);sleeve.scale.y=sleeveLength;
   sleeve.position.copy(start).addScaledVector(direction,sleeveLength/(2*length));
   joints[0].position.copy(start);joints[1].position.copy(end);
  }
 }
}
