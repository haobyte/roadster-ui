// Synthetic, filtered air noise. Only an explicit Boost hold starts audio.
export class BoostAudio {
 constructor({onError=()=>{}}={}){this.onError=onError;this.generation=0;this.voice=null;this.voices=new Set();}
 async start(){
  this.stop();const generation=this.generation;
  try{
   if(!this.ctx){
    const Audio=window.AudioContext||window.webkitAudioContext;
    this.ctx=new Audio();
    this.buffer=this.ctx.createBuffer(1,Math.floor(this.ctx.sampleRate*2),this.ctx.sampleRate);
    const data=this.buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
   }
   await this.ctx.resume();
   if(generation!==this.generation||document.hidden)return;
   const source=this.ctx.createBufferSource(),high=this.ctx.createBiquadFilter(),low=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();
   source.buffer=this.buffer;source.loop=true;high.type='highpass';high.frequency.value=430;low.type='lowpass';low.frequency.value=4300;
   source.connect(high);high.connect(low);low.connect(gain);gain.connect(this.ctx.destination);
   const now=this.ctx.currentTime;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.23,now+.08);
   const voice={source,gain,high,low};this.voice=voice;this.voices.add(voice);
   source.onended=()=>{source.disconnect();high.disconnect();low.disconnect();gain.disconnect();this.voices.delete(voice);if(this.voice===voice)this.voice=null;};
   source.start();
  }catch(error){if(generation===this.generation){this.stop();this.onError(error);}}
 }
 stop(immediate=false){
  this.generation++;
  for(const voice of this.voices){
   if(voice.stopping&&!immediate)continue;
   const now=this.ctx.currentTime,p=voice.gain.gain;p.cancelAndHoldAtTime(now);p.linearRampToValueAtTime(0,now+(immediate?.025:.45));
   voice.source.stop(now+(immediate?.035:.46));voice.stopping=true;
  }
  this.voice=null;
 }
}
