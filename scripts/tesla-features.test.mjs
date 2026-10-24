import test from 'node:test';
import assert from 'node:assert/strict';
import {cinemaLinks} from '../src/tesla-fullscreen.js';

test('domestic return keeps the literal origin and excludes current query and hash',()=>{
  const links=cinemaLinks('https://example.com:8443/roadster/index.html?secret=do-not-send#menu');
  const bridge=new URL(new URL(links.tencent).searchParams.get('url'));
  assert.equal(bridge.hostname,'www.1905.com');
  assert.equal(bridge.searchParams.get('redirect_url'),'https://example.com:8443?www.1905.com');
  assert.equal(links.tencent,'https://v.qq.com/search_redirect.html?url=https://www.1905.com/api/redirec.html?redirect_url=https://example.com:8443?www.1905.com');
  assert.deepEqual(Object.keys(links),['tencent']);
});
