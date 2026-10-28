import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeSiteAssets } from '../scripts/site-assets.mjs';

test('site assets retain sitemap and remove a stale RSS file', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'blog-site-assets-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'rss.xml'), 'stale');
  await writeSiteAssets(directory, {
    posts: [{ slug: 'hello', date: '2026-01-01', updated: '2026-02-01' }],
    folders: ['notes'], tags: ['web'],
  }, 'https://example.com');
  const sitemap = await readFile(path.join(directory, 'sitemap.xml'), 'utf8');
  for (const route of ['/shorts', '/posts/hello', '/folders/notes', '/tags/web']) assert.ok(sitemap.includes(`https://example.com${route}`));
  assert.equal((sitemap.match(/<loc>https:\/\/example.com\/shorts<\/loc>/g) || []).length, 1);
  assert.ok(!sitemap.includes('/shorts/'));
  assert.ok(sitemap.includes('<lastmod>2026-02-01</lastmod>'));
  assert.match(await readFile(path.join(directory, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/example\.com\/sitemap\.xml/);
  await assert.rejects(access(path.join(directory, 'rss.xml')), { code: 'ENOENT' });
});
