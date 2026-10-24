import test from 'node:test';
import assert from 'node:assert/strict';
import {cinemaLinks,initFullscreen} from '../src/tesla-fullscreen.js';

test('domestic return keeps the literal origin and excludes current query and hash',()=>{
  const links=cinemaLinks('https://example.com:8443/roadster/index.html?secret=do-not-send#menu');
  const bridge=new URL(new URL(links.tencent).searchParams.get('url'));
  assert.equal(bridge.hostname,'www.1905.com');
  assert.equal(bridge.searchParams.get('redirect_url'),'https://example.com:8443?www.1905.com');
  assert.equal(links.tencent,'https://v.qq.com/search_redirect.html?url=https://www.1905.com/api/redirec.html?redirect_url=https://example.com:8443?www.1905.com');
  assert.deepEqual(Object.keys(links),['tencent']);
});

test('project-site native fullscreen stays in the app and handles browser rejection',async()=>{
  const previous=globalThis.document;
  const buttons={fullscreen:{},'cinema-open':{}};
  let entered=0,exited=0,left=0;
  const root={async requestFullscreen(){entered++;globalThis.document.fullscreenElement=root;}};
  globalThis.document={documentElement:root,fullscreenElement:null,getElementById:id=>buttons[id],async exitFullscreen(){exited++;this.fullscreenElement=null;}};
  try{
    initFullscreen({native:true,beforeLeave:()=>left++});
    await buttons.fullscreen.onclick();
    await buttons['cinema-open'].onclick();
    assert.deepEqual({entered,exited,left},{entered:1,exited:1,left:0});
    assert.equal(buttons['cinema-open'].textContent,'Browser fullscreen');
    root.requestFullscreen=async()=>{throw new Error('Not allowed')};
    await buttons.fullscreen.onclick();
    assert.match(buttons.fullscreen.title,/blocked/);
    delete root.requestFullscreen;
    initFullscreen({native:true,beforeLeave:()=>left++});
    assert.equal(buttons.fullscreen.disabled,true);
  }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
