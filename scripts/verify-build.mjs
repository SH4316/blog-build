import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { projectDir, siteUrl } from './content.mjs';
import { licenseNotices } from './licenses.mjs';

const output = path.join(projectDir, 'build/client');
const read = file => readFile(path.join(output, file), 'utf8');
const catalog = JSON.parse(await readFile(path.join(projectDir, 'app/generated/catalog.json'), 'utf8'));
const articles = JSON.parse(await readFile(path.join(projectDir, 'app/generated/articles.json'), 'utf8'));
const sitemap = await read('sitemap.xml');
const rss = await read('rss.xml');
const search = JSON.parse(await read('search-index.json'));
const index = await read('index.html');
assert.match(index, /<html lang="ko"/);
assert.equal((index.match(/rel="canonical"/g) || []).length, 1);
assert.ok(index.includes(`href="${siteUrl}"`));
assert.equal(search.length, catalog.posts.length);
for (const post of catalog.posts) {
  const html = await read(`posts/${post.slug}.html`);
  assert.ok(html.includes(articles[post.slug].html), `${post.slug}: article HTML is present without JavaScript`);
  assert.ok(html.includes(`${siteUrl}/posts/${encodeURIComponent(post.slug)}`), `${post.slug}: canonical URL`);
  assert.match(html, /application\/ld\+json/);
  assert.ok(sitemap.includes(`/posts/${encodeURIComponent(post.slug)}`));
  assert.ok(rss.includes(`/posts/${encodeURIComponent(post.slug)}`));
  for (const item of articles[post.slug].toc) assert.ok(html.includes(`id="${item.id}"`));
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
  assert.ok(!rss.includes('next-post-draft'));
  assert.ok(!JSON.stringify(search).includes('draft-only-tag'));
}
console.log(`Verified initial HTML, canonical URLs, structured data, headings, ${catalog.posts.length} articles, ${catalog.folders.length} folders, ${catalog.tags.length} tags, RSS, sitemap, and 404.`);
