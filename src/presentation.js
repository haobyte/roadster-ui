// Camera framing follows the local source frames; positions and durations are visual approximations.
import {homeParts} from './vehicle-settings.js';
export const MOTION_MS = 820;
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function presentation(s) {
  const p={key:s.page,mode:'car',camera:[6.7,1.7,5],target:[0,.52,0],rect:[7,7,91,76],zoom:1.15,layer:'exterior',source:'pilot-6.6',channels:{battery:0,tank:0,plumbing:0,rear:1,mechanical:0,dashboard:0},shell:.20,grid:.052,exposure:1.05,revealDelay:0};
  if(s.page==='Vehicle'){
    p.key+=':'+s.subpage;p.layer='technical';
    if(s.subpage==='Dynamics'){
      p.key+=':'+s.preset;p.source=({Comfort:'t020',Balance:'t019',Sport:'t008',Custom:'t014'})[s.preset];
      p.rect=s.preset==='Custom'?[56,14,43,65]:[46,14,53,65];
      p.zoom=s.preset==='Custom'?1.1:1.15;
      if(s.preset==='Custom')p.target=[-.3,.5,-.14];
      p.camera=({Comfort:[3.5,2.3,7.1],Balance:[6.5,2.0,4.8],Sport:[3.3,1.9,-7.1],Custom:[3.3,1.9,-7.1]})[s.preset];
      // Visual emphasis observed in t008/t014/t018/t020, not actuator specifications.
      const rear=s.preset==='Sport'||s.preset==='Custom';
      p.channels={battery:0,tank:s.preset==='Custom'?1:rear?.5:.12,plumbing:s.preset==='Custom'?1:rear?.8:.2,rear:rear?1:.18,mechanical:rear?.7:1,dashboard:0};
      p.shell=.19;p.grid=.03;
    }else if(s.subpage==='Charging'){
      p.camera=[8,2.05,.12];p.rect=[12,10,84,63];p.layer='battery';p.source='t038';
      p.channels={battery:1,tank:0,plumbing:0,rear:0,mechanical:0,dashboard:0};p.shell=.10;p.grid=.018;p.revealDelay=.32;
    }else if(s.subpage==='Display'){
      p.camera=[2.65,5.65,-6.5];p.rect=[53,13,45,64];p.layer='display';p.source='t045';
      p.channels={battery:0,tank:0,plumbing:0,rear:.3,mechanical:0,dashboard:1};p.shell=.12;p.grid=.018;p.revealDelay=.18;
    }else{p.camera=[3.2,2.3,7];p.rect=[52,13,46,65];p.layer='exterior';p.source=null;}
  }else if(s.page==='Listen'){
    p.camera=[7.6,1.65,2.8];p.rect=[56,13,42,37];p.layer='silhouette';p.source='t081';
    p.channels={battery:0,tank:0,rear:0,mechanical:0,dashboard:0};p.shell=.94;p.grid=0;p.exposure=.22;
  }else if(s.page==='Climate'){
    p.key+=':'+s.climateView;p.mode='cabin';p.rect=[8,6,91,81];p.source=s.climateView==='Passenger'?'t094':'t086';
    p.camera=s.climateView==='Passenger'?[-.50,1.1,-.95]:[.40,1.1,-.95];
    p.target=s.climateView==='Passenger'?[-.50,.83,.5]:[.28,.83,.5];
  }else if(s.page==='Track'){
    p.key+=s.setup?':Setup':':Dashboard';p.mode=s.setup?'hidden':'track';p.camera=[4,4.8,6];p.target=[0,0,0];p.source='t024';
    if(s.boostPreview){p.key='Track:Boost';p.mode='car';p.camera=[2.1,2.4,-7.7];p.target=[0,.48,-.7];p.zoom=1.16;p.source=null;}
  }else if(s.page==='Navigate'){p.mode='hidden';p.source='t049';}
  if(s.page==='Home'){
    const part=homeParts[s.activeHotspot];
    if(part){p.key+=':'+s.activeHotspot;p.camera=part.camera;p.zoom=1.08;}
    else if(SHIFT_PRESENTATION.cameras[s.gear]){p.camera=SHIFT_PRESENTATION.cameras[s.gear];p.target=SHIFT_PRESENTATION.target;}
  }
  p.airflow=s.page==='Home'&&s.gear==='D'&&!s.activeHotspot;
  return p;
}

// User-selected D heading: nose toward the top of the screen, rear in view.
// Camera poses and transition durations are demonstration choices.
export const SHIFT_PRESENTATION={
 cameras:{D:[2.1,2.65,-6.8],R:[4.2,1.85,-6.8]},target:[0,.52,.12],
 followRate:14,maxPreview:.8,releaseBase:.65,releaseRemaining:.35,cancelDuration:.58,buttonDuration:1.65
};
