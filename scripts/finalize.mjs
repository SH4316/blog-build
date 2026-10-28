import { readFile, writeFile, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { projectDir } from './content.mjs';

const output = path.join(projectDir, 'build/client');
const catalog = JSON.parse(await readFile(path.join(projectDir, 'app/generated/catalog.json'), 'utf8'));

// React Router writes URL-encoded filenames; Pages resolves decoded asset names.
async function decodeRouteFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const decoded = decodeURIComponent(entry.name);
    if (decoded.includes('/') || decoded.includes('\\') || decoded === '.' || decoded === '..') throw new Error(`Invalid static route segment: ${entry.name}`);
    const original = path.join(directory, entry.name);
    const target = path.join(directory, decoded);
    if (original !== target) await rename(original, target);
    if (entry.isDirectory()) await decodeRouteFiles(target);
  }
}
for (const directory of ['posts', 'folders', 'tags']) {
  try { await decodeRouteFiles(path.join(output, directory)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

// Flat .html output gives Pages clean canonical URLs without a trailing slash.
async function flatten(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = path.join(directory, entry.name);
    await flatten(child);
    try { await rename(path.join(child, 'index.html'), `${child}.html`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!(await readdir(child)).length) await rm(child, { recursive: true });
  }
}
await flatten(output);
await rm(path.join(output, '__spa-fallback.html'), { force: true });
const preview = Boolean(process.env.CF_PAGES && process.env.CF_PAGES_BRANCH !== 'main');
await writeFile(path.join(output, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n${preview ? '  X-Robots-Tag: noindex, nofollow\n' : ''}`);
console.log(`Static output: ${3 + catalog.posts.length + catalog.folders.length + catalog.tags.length} indexable pages, 404.html, sitemap, search, and OG image.`);
