import {execFileSync} from 'node:child_process';
import {readFile, lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, {cwd:root, encoding:'utf8'});
const files = git('ls-files', '-z').split('\0').filter(Boolean);
const allowed = new Set([
  '.gitignore', 'README.md', 'ASSETS.md', 'THIRD_PARTY_NOTICES.md', 'LICENSE',
  'index.html', '404.html', '_headers', 'package.json', 'package-lock.json', 'server.mjs',
  'data/ui-spec.json', 'licenses/three.txt', 'assets/roadster-body.glb',
  'docs/screenshots/roadster-cockpit.png',
  ...['app.js','boost-audio.js','boost-jets.js','drive-airflow.js','icons.js','interface.css',
    'presentation.js','rear-assembly.js','rear-wing.js','scene.js','style.css','tesla-fullscreen.js',
    'tesla.css','touch-shift.js','track-setup.js','vehicle-settings.js'].map(name => `src/${name}`),
  ...['build-static.mjs','static-server.mjs','check-public.mjs','public-release-test.cjs',
    'tesla-features.test.mjs','vehicle-logic.test.mjs','drive-airflow.test.mjs',
    'rear-wing.test.mjs','rear-assembly.test.mjs','boost-effects.test.mjs'].map(name => `scripts/${name}`)
]);
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{35,})\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['API key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{35,}\b/],
  ['personal absolute path', /(?:\/Users\/|\/home\/)[^/\s"']+\//],
  ['literal credential', /(?:api[_-]?key|api[_-]?token|access[_-]?token|password|client[_-]?secret)\s*[=:]\s*["'][^"'\r\n]{8,}["']/i]
];
const errors = [];
if (!files.length) errors.push('No tracked files: stage the intended public files first');
for (const name of files) {
  if (!allowed.has(name)) errors.push(`File is outside the public allowlist: ${name}`);
  const file = path.join(root, name), info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink()) { errors.push(`Not a regular file: ${name}`); continue; }
  if (info.size > 20 * 1024 * 1024) errors.push(`Unexpectedly large file: ${name}`);
  if (/\.(glb|webp|png)$/.test(name)) continue;
  const text = await readFile(file, 'utf8');
  for (const [label, pattern] of patterns) if (pattern.test(text)) errors.push(`${label} candidate in ${name}`);
}
const spec = JSON.parse(await readFile(path.join(root, 'data/ui-spec.json'), 'utf8'));
if (Object.keys(spec).some(key => !['shell','pages'].includes(key))) errors.push('UI data contains non-runtime metadata');
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${files.length} tracked files match the public allowlist; no common secret/path patterns found.`);
  console.log('Scope: tracked working files only. Review commit history, asset rights and binary metadata separately before publishing.');
}
