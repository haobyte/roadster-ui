// Gesture distances and gear camera poses are prototype interaction choices.
export function bindTouchShift(rail, selectGear, camera={}) {
  let drag=null,suppressUntil=0;
  const feedback=rail.querySelector('.shift-feedback');
  const reset=()=>{rail.classList.remove('dragging','armed');delete rail.dataset.preview;rail.style.setProperty('--shift-y','0px');feedback.textContent='';};
  function move(e){
    if(!drag||e.pointerId!==drag.id)return;
    drag.dx=e.clientX-drag.x;drag.dy=e.clientY-drag.y;
    const dy=Math.max(-drag.travel,Math.min(drag.travel,drag.dy));
    drag.moved ||= Math.hypot(drag.dx,drag.dy)>8;
    const valid=Math.abs(drag.dx)<Math.max(60,drag.width*1.5)&&Math.abs(drag.dy)>Math.abs(drag.dx)*1.25;
    camera.move?.(valid?(drag.dy<0?'D':'R'):null,valid?Math.min(Math.abs(drag.dy)/drag.threshold,1):0);
    drag.gear=valid&&Math.abs(drag.dy)>=drag.threshold?(drag.dy<0?'D':'R'):null;
    rail.style.setProperty('--shift-y',`${dy}px`);rail.dataset.preview=drag.gear||'';rail.classList.toggle('armed',!!drag.gear);
    feedback.textContent=drag.gear?`${drag.gear} · 松开换挡`:'上下滑动';
  }
  function finish(e,cancel=false){
    if(!drag||(e&&e.pointerId!==drag.id))return;
    if(e&&!cancel)move(e);
    const ended=drag;drag=null;
    if(ended.moved||ended.tapGear||cancel)suppressUntil=performance.now()+450;
    if(rail.hasPointerCapture(ended.id))rail.releasePointerCapture(ended.id);
    reset();const gear=cancel?null:(ended.gear||(!ended.moved&&ended.tapGear)||null);
    if(gear)selectGear(gear);camera.end?.(gear);
  }
  rail.addEventListener('pointerdown',e=>{
    if(drag||!e.isPrimary||e.button!==0)return;
    const rect=rail.getBoundingClientRect();suppressUntil=0;
    drag={tapGear:e.target.closest('[data-gear]')?.dataset.gear,id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0,moved:false,gear:null,width:rect.width,threshold:Math.max(32,Math.min(64,rect.height*.16)),travel:rect.height*.29};
    camera.begin?.();
    rail.dataset.pointerFocus='';rail.setPointerCapture(e.pointerId);rail.focus({preventScroll:true});rail.classList.add('dragging');feedback.textContent='上下滑动';
  });
  rail.addEventListener('pointermove',move);
  rail.addEventListener('pointerup',e=>finish(e));
  rail.addEventListener('pointercancel',e=>finish(e,true));
  rail.addEventListener('lostpointercapture',e=>finish(e,true));
  rail.addEventListener('click',e=>{if(e.detail>0&&performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
  rail.addEventListener('keydown',e=>{delete rail.dataset.pointerFocus;if(e.target!==rail)return;const gear={ArrowUp:'D',ArrowDown:'R',p:'P',P:'P',n:'N',N:'N'}[e.key];if(gear){e.preventDefault();finish(null,true);selectGear(gear);}else if(e.key==='Escape')finish(null,true);});
  window.addEventListener('blur',()=>finish(null,true));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(null,true);});
  window.addEventListener('resize',()=>finish(null,true));
  return {sync(gear){rail.dataset.gear=gear;rail.setAttribute('aria-label',`触摸换挡，当前${gear}挡；上滑D，下滑R`);rail.querySelector('.shift-gear').textContent=gear;rail.querySelectorAll('[data-gear]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gear===gear)));}};
}
