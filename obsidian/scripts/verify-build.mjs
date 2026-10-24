import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { root, verifyLicenses } from './licenses.mjs';

const notices = await verifyLicenses();
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const packageInfo = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
assert.equal(manifest.version, packageInfo.version, 'Plugin and package versions must match');
const output = path.join(root, 'dist', manifest.id);
for (const relative of ['manifest.json', 'LICENSE', ...notices]) {
  assert.deepEqual(await readFile(path.join(output, relative)), await readFile(path.join(root, relative)), `Release file is missing or changed: ${relative}`);
}
const meta = JSON.parse(await readFile(path.join(root, 'dist/build-meta.json'), 'utf8'));
assert.ok(Object.keys(meta.inputs).every(file => file.startsWith('src/')), 'Third-party code unexpectedly bundled; review its notices');
const imports = Object.values(meta.outputs).flatMap(output => output.imports);
assert.deepEqual(imports.map(item => ({ path: item.path, external: item.external })), [{ path: 'obsidian', external: true }]);
assert.ok((await readFile(path.join(output, 'main.js'))).length > 0, 'Release main.js is empty');
console.log('Verified plugin bundle, external-only host API, and complete original license/notice files.');
