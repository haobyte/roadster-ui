const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
const githubPages=process.argv.includes('--github-pages');
const limitations=githubPages?['GitHub Pages does not apply custom Permissions-Policy or anti-framing headers; HTML CSP cannot replace these.']:[];
const qa=process.env.QA_OUTPUT_DIR?path.resolve(process.env.QA_OUTPUT_DIR):path.join(root,'test-results/public-release');
const ua='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Tesla/2026.32';
const checks=[],errors=[];
function check(name,ok,detail){assert.ok(ok,`${name}: ${JSON.stringify(detail)}`);checks.push({name,passed:true,detail});console.log('PASS',name);}
async function listFiles(directory,prefix=''){
 const files=[];
 for(const entry of await fs.readdir(directory,{withFileTypes:true})){
  const relative=prefix+entry.name;
  assert.ok(!entry.isSymbolicLink(),`Public package must not contain symlinks: ${relative}`);
  if(entry.isDirectory())files.push(...await listFiles(path.join(directory,entry.name),relative+'/'));
  else files.push(relative);
 }
 return files.sort();
}
(async()=>{
 const {createStaticServer,parseGlobalHeaders}=await import('./static-server.mjs');
 await fs.mkdir(qa,{recursive:true});
 const expectedFiles=['index.html','404.html',...(githubPages?[]:['_headers']),'THREE-LICENSE.txt','src/app.js','src/style.css','src/interface.css','src/tesla.css','data/ui-spec.json','assets/roadster-body.glb'].sort();
 const actualFiles=await listFiles(dist);
 check('Public package contains only approved runtime files and Pages configuration',JSON.stringify(actualFiles)===JSON.stringify(expectedFiles),actualFiles);
 const headersText=await fs.readFile(path.join(root,'_headers'),'utf8');
 if(!githubPages)check('Build preserves the Pages security configuration',headersText===await fs.readFile(path.join(dist,'_headers'),'utf8'));
 const securityHeaders=parseGlobalHeaders(headersText);
 const requiredHeaders=['content-security-policy','permissions-policy','referrer-policy','x-content-type-options','x-frame-options'];
 check('Cloudflare source policy declares the expected security headers',requiredHeaders.every(name=>securityHeaders[name]));
 const html=await fs.readFile(path.join(dist,'index.html'),'utf8'),js=await fs.readFile(path.join(dist,'src/app.js'),'utf8');
 const spec=JSON.parse(await fs.readFile(path.join(dist,'data/ui-spec.json'),'utf8'));
 check('Production package has no export UI, exporter, debug API, source paths or time controls',
   !/export-model|\bdownload\b|GLTFExporter|window\.roadster|\/Users\/|timeFormat|cinema-dialog|tools-toggle/.test(html+'\n'+js));
 check('Only gesture-driven Boost sound remains; no preview, music oscillator or volume UI',!/createOscillator|reveal-flight|reveal-thruster|jet-preview|id="volume"/.test(html+'\n'+js));
 check('Runtime data excludes research metadata',!spec.source_local&&!spec.source_url&&!spec.evidence_legend&&!spec.pages.Display.time_options);
 const basePath=githubPages?'/roadster-ui/':'/';
 const server=await createStaticServer(dist,{githubPages,basePath});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=process.env.BASE_URL||`http://127.0.0.1:${server.address().port}${basePath}`;
 const label=process.env.BASE_URL?'public':'local';
 const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({userAgent:ua,viewport:{width:1600,height:1000}});
 await page.addInitScript(()=>{
  window.__releaseSecurity={violations:[],audioStarts:0};
  document.addEventListener('securitypolicyviolation',e=>window.__releaseSecurity.violations.push({directive:e.effectiveDirective,blockedURI:e.blockedURI}));
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){const result=start.apply(this,args);window.__releaseSecurity.audioStarts++;return result;};
 });
 const assetResponses=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|shader error|Error compiling/i.test(m.text()))errors.push(m.text());});
 page.on('response',r=>{if(r.url().startsWith(new URL(base).origin)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);if(r.url().endsWith('.glb'))assetResponses.push({url:r.url(),status:r.status()});});
 const ready=async()=>{await page.locator('#main-nav button[data-page=Home]').waitFor();await page.locator('#loading').waitFor({state:'hidden',timeout:45000});};
 const shot=async(name)=>{await page.waitForTimeout(1000);await page.screenshot({path:path.join(qa,`${label}-${name}.png`)});};
 try{
  // Probe independently from the page so expected 404s are not asset errors.
  const privatePaths=['qa/','qa/v3/','qa/v4/index.html','qa/rotation-fix/probe.html','qa/tesla-fullscreen-debug/roadster-0.html','scripts/build_model.py','scripts/public-release-test.cjs','assets/roadster-complete.glb','assets/model-provenance.json','assets/audio/provenance.json','data/model-reconstruction-spec.json','data/menu-presentation-evidence.json','delivery-manifest.json','README.md','package.json','server.mjs','deploy/Caddyfile','.git/config','.env','node_modules/three/package.json','src/scene.js','src/app.js.map','_headers','unpublished-page'];
  const blocked=[];
  for(const resource of privatePaths){
   const response=await page.request.get(new URL(resource,base).href);
   blocked.push({path:resource,status:response.status()});
  }
  check('Development pages, source archives and unpublished paths return 404',blocked.every(r=>r.status===404),blocked);
  const missing=await page.request.get(new URL('unpublished-page',base).href);
  const missingHTML=await missing.text();
  check('Unknown paths serve the 404 page without loading the cockpit',missing.status()===404&&/<h1>404<\/h1>/.test(missingHTML)&&!/<script\b|id="cockpit"/.test(missingHTML));
  if(githubPages)check('GitHub Pages 404 links back to the project root',missingHTML.includes(`href="${new URL(base).pathname}"`));
  const headerResults=[];
  if(!githubPages){
  for(const resource of ['', 'src/app.js', 'src/style.css', 'data/ui-spec.json', 'assets/roadster-body.glb', 'unpublished-page']){
   const response=await page.request.get(new URL(resource,base).href);
   headerResults.push({path:resource||'/',matches:requiredHeaders.every(name=>response.headers()[name]===securityHeaders[name])});
  }
  check('HTML, assets and 404 responses carry the configured security headers',headerResults.every(r=>r.matches),headerResults);
  }else{
   const expectedCSP=securityHeaders['content-security-policy'].split(';').map(s=>s.trim()).filter(s=>s&&!s.startsWith('frame-ancestors ')).join('; ');
   for(const resource of ['', '404.html','unpublished-page']){
    const response=await page.request.get(new URL(resource,base).href),text=await response.text();
    headerResults.push({path:resource||'/',metaCSP:text.includes(`http-equiv="Content-Security-Policy" content="${expectedCSP}"`),referrer:text.includes('name="referrer" content="no-referrer"'),unsupportedFraming:!!/frame-ancestors/.test(text)});
   }
   check('GitHub Pages index and 404 carry supported CSP and referrer meta policies',headerResults.every(r=>r.metaCSP&&r.referrer&&!r.unsupportedFraming),headerResults);
  }
  // Isolated negative probes: intercept the test domain so a failed policy
  // never sends a real external request, and keep expected violations out of QA.
  const probe=await browser.newPage(),unexpectedRequests=[];
  try{
   await probe.route('https://security-probe.invalid/**',route=>{unexpectedRequests.push(route.request().url());return route.fulfill({contentType:'text/javascript',body:'window.__externalProbe=true;'});});
   await probe.goto(new URL('404.html',base).href);
   await probe.evaluate(async()=>{
    window.__policyProbe={violations:[],fetchBlocked:false};
    document.addEventListener('securitypolicyviolation',e=>window.__policyProbe.violations.push(e.effectiveDirective));
    const inline=document.createElement('script');inline.textContent='window.__inlineProbe=true';document.head.append(inline);
    const external=document.createElement('script');external.src='https://security-probe.invalid/script.js';document.head.append(external);
    try{await fetch('https://security-probe.invalid/data');}catch{window.__policyProbe.fetchBlocked=true;}
   });
   await probe.waitForFunction(()=>window.__policyProbe.violations.length>=3);
   const policy=await probe.evaluate(()=>({inlineExecuted:!!window.__inlineProbe,externalExecuted:!!window.__externalProbe,...window.__policyProbe,permissions:Object.fromEntries(['camera','microphone','geolocation'].map(name=>[name,document.featurePolicy.allowsFeature(name)]))}));
   check('CSP blocks inline scripts, external scripts and external connections',!policy.inlineExecuted&&!policy.externalExecuted&&policy.fetchBlocked&&policy.violations.includes('script-src-elem')&&policy.violations.includes('connect-src')&&unexpectedRequests.length===0,policy);
   if(!githubPages)check('Camera, microphone and geolocation are disabled',Object.values(policy.permissions).every(value=>value===false),policy.permissions);
  }finally{await probe.close();}
  await page.goto(base,{waitUntil:'domcontentloaded'});await ready();
  check('Real 3D asset loads',assetResponses.some(r=>r.status===200),assetResponses);
  const modelViolations=await page.evaluate(()=>window.__releaseSecurity.violations);
  check('Model and embedded textures load without CSP violations',modelViolations.length===0&&await page.locator('#scene-error').isHidden(),modelViolations);
  check('No legacy debug markers, export, time or model tools in the DOM',await page.locator('.hotspot,[download],#export-model,#clock,#tools-toggle,#scene-tools,#cinema-dialog,[data-set=timeFormat]').count()===0);
  check('No production debug global',await page.evaluate(()=>typeof window.roadster==='undefined'));
  await page.waitForFunction(()=>document.querySelector('#hotspots').hidden,{},{timeout:15000});
  check('Startup hides part controls while preserving the selected P gear',await page.locator('.gear-rail').getAttribute('data-gear')==='P');
  await page.waitForFunction(()=>!document.querySelector('#hotspots').hidden,{},{timeout:120000});
  check('Natural startup finishes and restores parked controls',await page.locator('.gear-rail').getAttribute('data-gear')==='P'&&await page.locator('#scene-error').isHidden());
  await shot('home');
  // The scene renders continuously. Capture its viewport rectangle directly:
  // locator.screenshot waits for layout stability on animation frames, which
  // can exhaust its timeout with the CI runner's software WebGL renderer.
  const rect=await page.locator('#scene').boundingBox();
  assert.ok(rect&&rect.width>0&&rect.height>0,'3D scene has a visible viewport');
  const before=await page.screenshot({clip:rect});
  await page.mouse.move(rect.x+rect.width*.55,rect.y+rect.height*.60);await page.mouse.down();
  await page.mouse.move(rect.x+rect.width*.76,rect.y+rect.height*.44,{steps:16});await page.mouse.up();await page.waitForTimeout(1000);
  check('Dragging changes the rendered 3D view',!before.equals(await page.screenshot({clip:rect})));
  const rail=await page.locator('.gear-rail').boundingBox(),x=rail.x+rail.width/2,y=rail.y+rail.height*.55;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y-90,{steps:12});await page.mouse.up();
  check('Touch shift commits D',await page.locator('.gear-rail').getAttribute('data-gear')==='D');
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+16,{steps:4});await page.mouse.up();
  check('Short gesture keeps the prior gear',await page.locator('.gear-rail').getAttribute('data-gear')==='D');
  await page.locator('#gears [data-gear=P]').click();
  await page.locator('#help').click();check('Help contains no download or exporter',!/下载|导出|GLB/.test(await page.locator('#info').innerText()));await shot('help');await page.locator('#close-info').click();
  await page.locator('#main-nav [data-page=Vehicle]').click();await page.locator('button[data-preset=Custom]').click();
  for(const key of ['hoodOpen','bargeDeploy'])await page.locator(`[data-toggle=${key}]`).click();
  await page.locator('[data-set=rearWing][data-value=Stowed]').click();await shot('custom');
  check('Custom aero controls still respond',/Close/.test(await page.locator('[data-toggle=hoodOpen]').innerText())&&/Retract/.test(await page.locator('[data-toggle=bargeDeploy]').innerText()));
  await page.locator('button[data-subpage=Lights]').click();await page.locator('[data-set=lightMode][data-value=Off]').click();
  check('Headlights toggle',await page.locator('[data-set=lightMode][data-value=Off]').getAttribute('aria-pressed')==='true');
  await page.locator('[data-set=lightMode][data-value=On]').click();
  await page.locator('button[data-subpage=Display]').click();
  await page.locator('[data-set=appearance][data-value=Light]').click();
  check('Light appearance works after clock removal',await page.locator('#cockpit').getAttribute('data-theme')==='Light');
  await page.locator('[data-set=appearance][data-value=Dark]').click();
  check('Dark appearance works',await page.locator('#cockpit').getAttribute('data-theme')==='Dark');
  await page.locator('button[data-subpage=Charging]').click();check('Charging controls render',await page.locator('[data-range=chargeLimit]').isVisible());
  for(const name of ['Listen','Climate','Navigate']){
   await page.locator(`#main-nav [data-page=${name}]`).click();
   check(`${name} menu renders`,await page.locator('#cockpit').getAttribute('data-page')===name&&await page.locator('#content').innerText()!=='');
  }
  await page.locator('#main-nav [data-page=Vehicle]').click();await page.locator('button[data-subpage=Dynamics]').click();await page.locator('[data-page=Track]').click();
  const b=await page.locator('#boost').boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
  check('Boost visual feedback starts on hold',await page.locator('#boost').getAttribute('aria-pressed')==='true');
  await page.waitForFunction(()=>window.__releaseSecurity.audioStarts>0);
  check('Gesture-driven Boost audio starts with security headers enabled',await page.evaluate(()=>window.__releaseSecurity.audioStarts>0));
  await page.mouse.up();
  check('Boost visual feedback stops on release',await page.locator('#boost').getAttribute('aria-pressed')==='false');
  await shot('track');
  await page.locator('.track-bottom [data-page=Vehicle]').click();await page.locator('#main-nav [data-page=Home]').click();
  check('Sound controls are removed',await page.locator('#jet-preview,#volume,[data-action=mute]').count()===0);
  await page.locator('#player [data-action=play]').click();
  check('Silent player retains visual playback state',await page.locator('#player .play').getAttribute('aria-label')==='暂停');
  await page.locator('#player [data-action=play]').click();
  await page.setViewportSize({width:1280,height:720});await shot('car-size');
  check('Car viewport does not overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.setViewportSize({width:390,height:844});await shot('mobile');
  check('Mobile viewport does not overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.reload({waitUntil:'domcontentloaded'});await ready();
  await page.waitForFunction(()=>document.querySelector('#hotspots').hidden,{},{timeout:15000});
  await page.locator('#gears [data-gear=D]').click();
  await page.waitForFunction(()=>!document.querySelector('#hotspots').hidden);
  check('Mobile gear input interrupts startup and restores part controls',await page.locator('.gear-rail').getAttribute('data-gear')==='D');
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'domcontentloaded'});await ready();
  await page.waitForFunction(()=>!document.querySelector('#hotspots').hidden);
  check('Reduced motion shows parked controls without a startup delay',await page.locator('.gear-rail').getAttribute('data-gear')==='P');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1600,height:1000});
  // Capture the outbound URL locally; this does not validate the real provider chain.
  const violations=await page.evaluate(()=>window.__releaseSecurity.violations);
  check('Core interactions have no CSP violations',violations.length===0,violations);
  if(new URL(base).hostname.endsWith('.github.io')){
   await page.locator('#fullscreen').click();
   await page.waitForFunction(()=>!!document.fullscreenElement);
   check('GitHub Pages uses native fullscreen without leaving the project path',page.url()===base);
   await page.evaluate(()=>document.exitFullscreen());
  }else{
  let destination,fullscreenReferrer;
  await page.route('https://v.qq.com/**',route=>{destination=route.request().url();fullscreenReferrer=route.request().headers().referer;return route.fulfill({contentType:'text/html',body:'<title>Captured cinema navigation</title>'});});
  await page.locator('#fullscreen').click();await page.waitForURL('https://v.qq.com/**');
  const expected='https://v.qq.com/search_redirect.html?url=https://www.1905.com/api/redirec.html?redirect_url='+new URL(base).origin+'?www.1905.com';
  check('One fullscreen click navigates directly to Tencent',destination===expected,destination);
  check('Fullscreen navigation does not send a Referer header',!fullscreenReferrer);
  }
  check('No runtime or asset errors',errors.length===0,errors);
  await fs.writeFile(path.join(qa,`${label}-results.json`),JSON.stringify({passed:true,base,githubPages,limitations,checks,errors},null,2));
 }catch(e){await page.screenshot({path:path.join(qa,`${label}-failure.png`)}).catch(()=>{});await fs.writeFile(path.join(qa,`${label}-results.json`),JSON.stringify({passed:false,base,checks,errors,error:e.stack},null,2));throw e;}
 finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
