import {build} from 'esbuild';
import {readFile, writeFile, mkdir, rm, cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {parseGlobalHeaders} from './static-server.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const githubPages = process.argv.includes('--github-pages');
const repositoryName=(process.env.GITHUB_REPOSITORY||'haobyte/roadster-ui').split('/').at(-1);
const githubSitePath=repositoryName.endsWith('.github.io')?'/':`/${repositoryName}/`;
const headersText = await readFile(path.join(root, '_headers'), 'utf8');
const headers = parseGlobalHeaders(headersText);
function pagePolicy(html) {
  if (!githubPages) return html;
  // GitHub Pages cannot apply _headers. Only directives supported in HTML
  // belong in this fallback; framing and Permissions-Policy remain host limits.
  const csp = headers['content-security-policy'].split(';').map(s=>s.trim())
    .filter(s=>s && !s.startsWith('frame-ancestors ')).join('; ');
  const escape = s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;');
  return html.replace('href="/"',`href="${githubSitePath}"`).replace(/(<meta charset="utf-8">)/i, `$1<meta http-equiv="Content-Security-Policy" content="${escape(csp)}"><meta name="referrer" content="no-referrer">`);
}
await rm(out, {recursive:true, force:true});
await mkdir(path.join(out, 'src'), {recursive:true});
const result = await build({absWorkingDir:root, entryPoints:['src/app.js'], bundle:true, format:'esm', target:['chrome99'], minify:true, outfile:'dist/src/app.js', legalComments:'eof', metafile:true});
if (Object.keys(result.metafile.inputs).some(name=>name.includes('GLTFExporter'))) {
  throw new Error('Public build must not include the model exporter');
}
let html = await readFile(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, '');
await writeFile(path.join(out, 'index.html'), pagePolicy(html));
// A top-level 404 disables Pages' fallback of unknown paths to the cockpit.
await writeFile(path.join(out, '404.html'), pagePolicy(await readFile(path.join(root, '404.html'), 'utf8')));
if (!githubPages) await cp(path.join(root, '_headers'), path.join(out, '_headers'));
for (const name of ['style.css','interface.css','tesla.css']) await cp(path.join(root,'src',name),path.join(out,'src',name));
await mkdir(path.join(out,'data'));
// Project only values consumed by the current UI into the static package.
const spec = JSON.parse(await readFile(path.join(root,'data/ui-spec.json'),'utf8'));
const runtimeSpec = {
  shell: {primary_tabs:spec.shell.primary_tabs, vehicle_tabs:spec.shell.vehicle_tabs},
  pages: {
    Dynamics: {
      presets:spec.pages.Dynamics.presets,
      custom_controls:spec.pages.Dynamics.custom_controls
        .filter(c=>['Acceleration','Ride & Handling','Front Wing','Rear Wing','Suspension'].includes(c.label))
        .map(({label,visible_options})=>({label,visible_options}))
    },
    Display: {appearance:spec.pages.Display.appearance,distance_options:spec.pages.Display.distance_options},
    Track: {
      fields:spec.pages.Track.fields.filter(f=>['lastLap','bestLap'].includes(f.id)).map(({id,value})=>({id,value})),
      lap_history:spec.pages.Track.lap_history
    }
  }
};
await writeFile(path.join(out,'data/ui-spec.json'), JSON.stringify(runtimeSpec));
await mkdir(path.join(out,'assets'));
await cp(path.join(root,'assets/roadster-body.glb'),path.join(out,'assets/roadster-body.glb'));
await cp(path.join(root,'node_modules/three/LICENSE'),path.join(out,'THREE-LICENSE.txt'));
console.log(`Static package ready: dist/ (${githubPages?'GitHub Pages':'Cloudflare Pages'}; runtime files only)`);
