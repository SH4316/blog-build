import { rm, mkdir, cp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { buildCatalog, writeContent, projectDir, siteUrl } from '../scripts/content.mjs';
import { writeSiteAssets } from '../scripts/site-assets.mjs';
import { fixturePreviewResolver } from './fixtures/short-preview-responses.mjs';

const publicDirectory = path.join(projectDir, '.cache/public');
await rm(publicDirectory, { recursive: true, force: true });
await mkdir(publicDirectory, { recursive: true });
const result = await buildCatalog(path.join(projectDir, 'tests/fixtures/content-repo'), {
  sample: true, previewResolver: await fixturePreviewResolver(),
});
await writeContent(result);
await cp(path.join(projectDir, 'public'), publicDirectory, { recursive: true });
await writeSiteAssets(publicDirectory, result.catalog, siteUrl);
execFileSync(process.execPath, [path.join(projectDir, 'scripts/licenses.mjs')], { cwd: projectDir, stdio: 'inherit' });
console.log(`Deterministic preview fixtures: ${result.shorts.length} entries, ${result.shortPreviewAssets.size} local image.`);
