import {build} from 'esbuild';
import {readFile, writeFile, mkdir, rm, cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
await rm(out, {recursive:true, force:true});
await mkdir(path.join(out, 'src'), {recursive:true});
const result = await build({absWorkingDir:root, entryPoints:['src/app.js'], bundle:true, format:'esm', target:['chrome99'], minify:true, outfile:'dist/src/app.js', legalComments:'eof', metafile:true});
if (Object.keys(result.metafile.inputs).some(name=>name.includes('GLTFExporter'))) {
  throw new Error('Public build must not include the model exporter');
}
let html = await readFile(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, '');
await writeFile(path.join(out, 'index.html'), html);
// A top-level 404 disables Pages' fallback of unknown paths to the cockpit.
await cp(path.join(root, '404.html'), path.join(out, '404.html'));
await cp(path.join(root, '_headers'), path.join(out, '_headers'));
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
console.log('Static package ready: dist/ (no node_modules, QA, source videos or credentials)');
