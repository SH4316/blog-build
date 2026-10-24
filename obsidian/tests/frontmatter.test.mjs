import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const source = await readFile(new URL('../src/frontmatter.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm', target: 'es2020' });
const { applyDefaults, createDefaults, filenameForTitle, isPostPath, loadSettings, localDate, normalizeFolder, parseTags, slugify, uniqueSlug } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('defaults fill missing fields once and preserve every existing value', () => {
  const defaults = createDefaults('새 글', '새-글', loadSettings({ defaultTags: ['React'] }), new Date(2026, 9, 16));
  const fields = { title: '기존 제목', slug: 'permanent', tags: [], description: null, draft: false, custom: { keep: true } };
  assert.deepEqual(applyDefaults(fields, defaults), ['date']);
  assert.deepEqual(fields, { title: '기존 제목', slug: 'permanent', tags: [], description: null, draft: false, custom: { keep: true }, date: '2026-10-16' });
  assert.deepEqual(applyDefaults(fields, defaults), []);
  const blank = {};
  assert.equal(applyDefaults(blank, defaults).length, 6);
  assert.equal(blank.draft, true);
  blank.tags.push('local');
  assert.deepEqual(defaults.tags, ['React']);
});

test('Unicode slugs match the blog grammar and collisions use stable suffixes', () => {
  const titles = ['C++ / C#', '한글 제목', 'CAFE\u0301', '!!!', 'İstanbul', '日本語 123'];
  for (const title of titles) {
    const slug = slugify(title);
    assert.match(slug, /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u);
    assert.equal(slug, slug.normalize('NFC').toLowerCase());
  }
  assert.equal(uniqueSlug('CAFE\u0301', ['cafe\u0301', 'café-2']), 'café-3');
  assert.equal(uniqueSlug('한글 제목', ['한글-제목', '한글-제목-2']), '한글-제목-3');
  assert.equal(uniqueSlug('!!!', ['post']), 'post-2');
});

test('folder validation preserves vault-relative boundaries', () => {
  assert.equal(normalizeFolder(' blog\\posts/ '), 'blog/posts');
  assert.equal(isPostPath('posts/react/글.md', 'posts'), true);
  for (const path of ['posts-archive/a.md', 'other/posts/a.md', 'posts/a.png', 'posts.md']) assert.equal(isPostPath(path, 'posts'), false);
  for (const path of ['', '/', '/posts', '../posts', 'posts/../secret', 'a//b', 'C:\\notes', 'post%20s', 'a\0b']) assert.throws(() => normalizeFolder(path));
});

test('tags support blog tags, normalize duplicates, and reject invalid segments', () => {
  assert.deepEqual(parseTags(' C++, C#, React, React, 한글, cafe\u0301, café '), ['C++', 'C#', 'React', '한글', 'café']);
  assert.deepEqual(parseTags(' '), []);
  for (const tags of ['a/b', 'a\\b', 'a%b', 'a,,b', '.', '..', 'a\0b', 'a\nb']) assert.throws(() => parseTags(tags));
  const restored = loadSettings({ targetFolder: '../bad', defaultTags: ['bad/tag'], autoAdd: false, draft: false });
  assert.equal(restored.targetFolder, 'posts');
  assert.deepEqual(restored.defaultTags, []);
  assert.equal(restored.autoAdd, false);
  assert.equal(restored.draft, false);
});

test('date uses the local calendar and filenames keep titles portable', () => {
  // This instant is the previous UTC day in Asia/Seoul, used by test invocation.
  const date = new Date(2026, 0, 1, 0, 15);
  assert.equal(localDate(date), '2026-01-01');
  assert.equal(filenameForTitle('HTTP: 캐시 / 조건?'), 'HTTP- 캐시 - 조건-.md');
  assert.equal(filenameForTitle('CON'), '_CON.md');
  assert.throws(() => filenameForTitle('...'));
});
