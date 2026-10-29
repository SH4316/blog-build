import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { projectDir, siteUrl } from './content.mjs';
import { licenseNotices } from './licenses.mjs';

const output = path.join(projectDir, 'build/client');
const read = file => readFile(path.join(output, file), 'utf8');
const catalog = JSON.parse(await readFile(path.join(projectDir, 'app/generated/catalog.json'), 'utf8'));
const articles = JSON.parse(await readFile(path.join(projectDir, 'app/generated/articles.json'), 'utf8'));
const shorts = JSON.parse(await readFile(path.join(projectDir, 'app/generated/shorts.json'), 'utf8'));
const sitemap = await read('sitemap.xml');
const search = JSON.parse(await read('search-index.json'));
const index = await read('index.html');
assert.match(index, /<html lang="ko"/);
assert.doesNotMatch(index, /rss\.xml|application\/rss\+xml/i);
await assert.rejects(access(path.join(output, 'rss.xml')), { code: 'ENOENT' });
assert.equal((index.match(/rel="canonical"/g) || []).length, 1);
assert.ok(index.includes(`href="${siteUrl}"`));
assert.equal(search.length, catalog.posts.length);
const shortsHtml = await read('shorts.html');
const shortImagePaths = new Set();
assert.ok(shortsHtml.includes(`href="${siteUrl}/shorts"`), 'Short feed canonical URL');
assert.equal((shortsHtml.match(/rel="canonical"/g) || []).length, 1);
assert.ok(sitemap.includes(`<loc>${siteUrl}/shorts</loc>`));
assert.ok(!sitemap.includes('/shorts/'), 'Short entries have no individual sitemap routes');
assert.doesNotMatch(shortsHtml, /<meta name="robots" content="noindex/);
for (const short of shorts) {
  assert.ok(shortsHtml.includes(`id="${short.id}"`), `${short.id}: fragment anchor is present`);
  assert.ok(shortsHtml.includes(short.html), `${short.id}: full content is present without JavaScript`);
  await assert.rejects(access(path.join(output, 'shorts', `${short.id}.html`)), { code: 'ENOENT' });
  assert.ok(!JSON.stringify(search).includes(short.id), 'Short entries stay outside article search');
  for (const [, source] of short.html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) {
    const url = new URL(source, siteUrl);
    assert.equal(url.origin, siteUrl, `${short.id}: body images must be local`);
    assert.match(url.pathname, /^\/(?:content-images|content-assets|short-assets)\//);
    const imagePath = decodeURIComponent(url.pathname).replace(/^\//, '');
    assert.ok(!imagePath.split('/').includes('..') && !imagePath.includes('\\'), `${short.id}: invalid local image URL: ${source}`);
    await access(path.join(output, imagePath)).catch(error => { throw new Error(`${short.id}: built image is missing: ${source}`, { cause: error }); });
    if (imagePath.startsWith('short-assets/')) shortImagePaths.add(imagePath.slice('short-assets/'.length));
  }
  if (short.preview?.image) {
    assert.match(short.preview.image, /^\/short-previews\/[a-f0-9]{64}\.webp$/);
    assert.ok(shortsHtml.includes(short.preview.image), `${short.id}: preview image is in initial HTML`);
    await access(path.join(output, short.preview.image.slice(1)));
  }
}
let previewFiles = [];
try { previewFiles = await readdir(path.join(output, 'short-previews')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
assert.deepEqual(previewFiles.sort(), [...new Set(shorts.map(short => short.preview?.image?.split('/').at(-1)).filter(Boolean))].sort(), 'Preview assets must exactly match published references');
async function assetFiles(directory, prefix = '') {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) files.push(...await assetFiles(path.join(directory, entry.name), `${prefix}${entry.name}/`));
    else files.push(`${prefix}${entry.name}`);
  }
  return files;
}
assert.deepEqual((await assetFiles(path.join(output, 'short-assets'))).sort(), [...shortImagePaths].sort(), 'Short image assets must exactly match published references');
for (const post of catalog.posts) {
  const html = await read(`posts/${post.slug}.html`);
  assert.ok(html.includes(articles[post.slug].html), `${post.slug}: article HTML is present without JavaScript`);
  assert.ok(html.includes(`${siteUrl}/posts/${encodeURIComponent(post.slug)}`), `${post.slug}: canonical URL`);
  assert.match(html, /application\/ld\+json/);
  assert.ok(sitemap.includes(`/posts/${encodeURIComponent(post.slug)}`));
  for (const item of articles[post.slug].toc) assert.ok(html.includes(`id="${item.id}"`));
  for (const [, source] of articles[post.slug].html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) {
    const url = new URL(source, siteUrl);
    if (url.origin !== siteUrl) continue;
    const imagePath = decodeURIComponent(url.pathname).replace(/^\//, '');
    assert.ok(!imagePath.split('/').includes('..') && !imagePath.includes('\\'), `${post.sourcePath}: invalid local image URL: ${source}`);
    await access(path.join(output, imagePath)).catch(error => { throw new Error(`${post.sourcePath}: built image is missing: ${source}`, { cause: error }); });
  }
}
for (const folder of catalog.folders) await access(path.join(output, 'folders', `${folder}.html`));
for (const tag of catalog.tags) await access(path.join(output, 'tags', `${tag}.html`));
assert.match(await read('404.html'), /noindex/);
assert.match(await read('search.html'), /noindex/);
assert.ok(!sitemap.includes('/search'));
await assert.rejects(access(path.join(output, '__spa-fallback.html')));
await access(path.join(output, 'og.png'));
assert.equal(await read('third-party-notices.txt'), (await licenseNotices()).text, 'Production license notices must be complete and match installed dependencies');
if (catalog.sample) {
  assert.ok(!sitemap.includes('next-post-draft'));
  assert.ok(!JSON.stringify(search).includes('draft-only-tag'));
  assert.ok(!shortsHtml.includes('draft-short-secret'));
}
console.log(`Verified initial HTML, local images, canonical URLs, structured data, headings, ${catalog.posts.length} articles, ${shorts.length} short entries, ${catalog.folders.length} folders, ${catalog.tags.length} tags, sitemap, and 404.`);
