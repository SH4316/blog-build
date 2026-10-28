import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { root, verifyLicenses } from './licenses.mjs';

const notices = await verifyLicenses();
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const packageInfo = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const versions = JSON.parse(await readFile(path.join(root, 'versions.json'), 'utf8'));
assert.equal(manifest.version, packageInfo.version, 'Plugin and package versions must match');
assert.equal(versions[manifest.version], manifest.minAppVersion, 'Release compatibility must be recorded in versions.json');
const output = path.join(root, 'dist', manifest.id);
for (const relative of ['manifest.json', 'styles.css', 'LICENSE', ...notices]) {
  assert.deepEqual(await readFile(path.join(output, relative)), await readFile(path.join(root, relative)), `Release file is missing or changed: ${relative}`);
}
const meta = JSON.parse(await readFile(path.join(root, 'dist/build-meta.json'), 'utf8'));
assert.ok(Object.keys(meta.inputs).every(file => file.startsWith('src/')), 'Third-party code unexpectedly bundled; review its notices');
const imports = Object.values(meta.outputs).flatMap(output => output.imports);
assert.ok(imports.length > 0, 'The plugin must use the external Obsidian host API');
assert.ok(imports.every(item => item.path === 'obsidian' && item.external), 'Only the Obsidian host API may be imported at runtime');
assert.ok((await readFile(path.join(output, 'main.js'))).length > 0, 'Release main.js is empty');
console.log('Verified plugin bundle, external-only host API, and complete original license/notice files.');
