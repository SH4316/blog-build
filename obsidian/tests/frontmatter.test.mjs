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

const { applyShortDefaults, createShortDefaults, filenameForShort, isShortPath, normalizePostFolder, normalizeShort } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('shorts routing uses only the fixed root folder and article settings cannot overlap it', () => {
  for (const path of ['shorts/new.md', 'shorts/nested/new.MD']) assert.equal(isShortPath(path), true);
  for (const path of ['shorts-archive/new.md', 'posts/shorts/new.md', 'other/shorts/new.md', 'shorts/new.png']) assert.equal(isShortPath(path), false);
  for (const folder of ['shorts', 'shorts/nested', 'SHORTS', 'Shorts/nested']) {
    assert.throws(() => normalizePostFolder(folder), /shorts/);
    assert.equal(loadSettings({ targetFolder: folder }).targetFolder, 'posts');
  }
  assert.equal(normalizePostFolder('shorts-archive'), 'shorts-archive');
  assert.equal(normalizePostFolder('blog/shorts'), 'blog/shorts');
  assert.equal(isPostPath('shorts/new.md', 'shorts'), false);
});

test('short defaults add only missing date and draft and retain all existing values', () => {
  const date = new Date('2026-10-28T03:04:05.006+09:00');
  const defaults = createShortDefaults(loadSettings({ draft: false, defaultTags: ['article-only'] }), date);
  assert.deepEqual(defaults, { date: '2026-10-27T18:04:05.006Z', draft: false });
  const existing = { date: '2020-01-01', draft: null, custom: 'keep', link: 'https://example.com/' };
  assert.deepEqual(applyShortDefaults(existing, defaults), []);
  const blank = { custom: 3 };
  assert.deepEqual(applyShortDefaults(blank, defaults), ['date', 'draft']);
  assert.deepEqual(blank, { custom: 3, ...defaults });
  assert.equal(filenameForShort(date), '2026-10-27T18-04-05-006Z.md');
  assert.equal(filenameForShort(date, 2), '2026-10-27T18-04-05-006Z-2.md');
});

test('short input requires text or a safe absolute HTTP(S) link and trims optional metadata', () => {
  const body = '\n원래 본문\n\n';
  assert.deepEqual(normalizeShort({ body, link: ' ', linkTitle: ' ' }), { body });
  assert.deepEqual(normalizeShort({ body: '', link: ' HTTPS://Example.COM/article?q=1 ', linkTitle: ' 제목 ' }), {
    body: '', link: 'https://example.com/article?q=1', linkTitle: '제목',
  });
  for (const link of ['/relative', '//example.com', 'javascript:alert(1)', 'ftp://example.com', 'https://user:pass@example.com', 'https://example.com/a b', 'https://example.com/\u0000bad', 'https://']) {
    assert.throws(() => normalizeShort({ body: '메모', link }));
  }
  assert.throws(() => normalizeShort({ body: ' \n ' }), /본문 또는 링크/);
  assert.throws(() => normalizeShort({ body: '메모', linkTitle: '제목만' }), /링크도/);
});
