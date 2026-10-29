import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildShorts, parseShort } from '../scripts/shorts.mjs';
import { buildCatalog, projectDir, writeContent } from '../scripts/content.mjs';
import { formatShortDate } from '../app/lib/site.ts';

const note = (body = '짧게 남기는 생각입니다.', extra = '', date = '2026-10-28') => `---\ndate: "${date}"\n${extra}\n---\n${body}\n`;

async function fixture(t, files = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'soohyuk-shorts-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'posts'), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, 'shorts', name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return root;
}

async function attachment(root, relative, content = 'local image bytes') {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

test('short frontmatter requires only a date and a nonempty body or link', () => {
  const short = parseShort(note('본문의 **강조**'), '메모.md');
  assert.equal(short.date, '2026-10-28');
  assert.equal(short.link, null);
  assert.equal(short.linkTitle, null);
  assert.equal(short.linkHost, null);
  assert.equal(short.draft, false);
  assert.match(short.id, /^short-[a-f0-9]+$/);
  assert.equal(short.id, parseShort(note('수정된 내용', '', '2026-10-29'), '메모.md').id);
  assert.notEqual(short.id, parseShort(note(), '다른/메모.md').id);
  assert.throws(() => parseShort('본문', 'bad.md'), /shorts\/bad.md: YAML frontmatter/);
  assert.throws(() => parseShort('---\n[]\n---\n본문', 'bad.md'), /frontmatter must be an object/);
  assert.throws(() => parseShort('---\ndate: [\n---\n본문', 'bad.md'), /invalid YAML/);
  assert.throws(() => parseShort(note(''), 'bad.md'), /nonempty body or link/);
  assert.throws(() => parseShort(note('본문', 'draft: "true"'), 'bad.md'), /draft must/);
  assert.throws(() => parseShort(note('본문', 'linkTitle: 123'), 'bad.md'), /linkTitle must/);
  assert.throws(() => parseShort(note('본문', 'linkTitle: "링크"'), 'bad.md'), /linkTitle requires a link/);
  assert.equal(parseShort('\uFEFF' + note().replaceAll('\n', '\r\n'), 'windows.md').date, '2026-10-28');
});

test('calendar dates and timezone-qualified ISO timestamps are validated strictly', () => {
  for (const date of ['2024-02-29', '2026-10-28T15:04+09:00', '2026-10-28T06:04:05Z', '2026-10-28T06:04:05.123-04:30']) {
    assert.equal(parseShort(note('본문', '', date), 'valid.md').date, date);
  }
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-10-28T12:00', '2026-10-28T24:00:00Z', '2026-10-28T12:60:00Z', '2026-10-28T12:00:60Z', '2026-10-28T12:00:00+24:00', '2026-10-28T12:00:00+09:60', 'yesterday']) {
    assert.throws(() => parseShort(note('본문', '', date), 'invalid.md'), /date must be a valid quoted/);
  }
  assert.throws(() => parseShort('---\nlink: "https://example.com"\n---\n', 'missing.md'), /date must/);
});

test('short date labels use Korean time while date-only entries keep their calendar day', () => {
  const dated = formatShortDate('2026-10-28');
  assert.equal(dated.label, '2026. 10. 28.');
  assert.doesNotMatch(dated.title, /KST|오전|오후/);
  assert.equal(dated.dateTime, '2026-10-28');
  const instant = formatShortDate('2026-10-28T18:30:00Z');
  assert.equal(instant.label, '2026. 10. 29. 03:30');
  assert.match(instant.title, /오전 3:30 \(KST\)$/);
  assert.equal(instant.dateTime, '2026-10-28T18:30:00Z');
  assert.deepEqual(formatShortDate('2026-10-29T03:30:00+09:00').label, instant.label);
});

test('frontmatter links allow absolute HTTP(S) URLs and reject unsafe protocols and credentials', () => {
  const linked = parseShort(note('', 'link: "https://www.example.com/한글?q=one&two=2"\nlinkTitle: "  읽어둘 문서  "'), 'link.md');
  assert.equal(linked.link, 'https://www.example.com/%ED%95%9C%EA%B8%80?q=one&two=2');
  assert.equal(linked.linkHost, 'example.com');
  assert.equal(linked.linkTitle, '읽어둘 문서');
  assert.equal(parseShort(note('', 'link: "http://localhost:8080/path"'), 'link.md').linkHost, 'localhost:8080');
  for (const link of ['javascript:alert(1)', 'data:text/html,hello', 'file:///etc/passwd', '//example.com/path', '/posts/hello', 'https:example.com', 'https://user:secret@example.com', 'https://example.com/with space', 'https://', 'ftp://example.com']) {
    assert.throws(() => parseShort(note('', `link: ${JSON.stringify(link)}`), 'bad.md'), /link must be an absolute HTTP\(S\) URL/);
  }
});

test('short Markdown renders safe prose and links without fetching previews or images', async t => {
  const root = await fixture(t, {
    'safe.md': note('**강조**, `inline code`, [외부](https://example.com/path?one=1&two=2), [글](/posts/hello), [앵커](#one)\n\n- 목록\n\n<script>alert(1)</script>\n\n[위험](javascript:alert%281%29) ![원격 이미지](https://example.com/tracker.png)\n\n[로컬](relative.md) [우회](//evil.example) [역슬래시](/\\evil.example)'),
  });
  const [entry] = await buildShorts(root);
  assert.match(entry.html, /<strong>강조<\/strong>/);
  assert.match(entry.html, /<code>inline code<\/code>/);
  assert.match(entry.html, /href="https:\/\/example.com\/path\?one=1&#x26;two=2"/);
  assert.match(entry.html, /href="\/posts\/hello"/);
  assert.match(entry.html, /href="#one"/);
  assert.match(entry.html, /<ul>/);
  assert.doesNotMatch(entry.html, /<script|<img|href="(?:javascript:|\/\/|relative.md|\/\\)/i);
  assert.deepEqual(Object.keys(entry).sort(), ['id', 'date', 'html', 'link', 'linkTitle', 'linkHost', 'preview'].sort());
  assert.equal(entry.preview, null);
});

test('entries sort by instant descending with stable filename ties and exclude drafts', async t => {
  const root = await fixture(t, {
    'z.md': note('같은 시각 Z', '', '2026-10-28T08:00:00Z'),
    'a.md': note('같은 시각 A', '', '2026-10-28T17:00:00+09:00'),
    'later.md': note('가장 최근', '', '2026-10-28T09:00:00Z'),
    'older.md': note('이전 날짜', '', '2026-10-27'),
    'draft.md': note('draft-short-secret', 'draft: true', '2026-10-29'),
    '.hidden.md': 'ignored',
    'README.txt': 'ignored',
  });
  const entries = await buildShorts(root);
  assert.deepEqual(entries.map(entry => entry.html.trim()), ['<p>가장 최근</p>', '<p>같은 시각 A</p>', '<p>같은 시각 Z</p>', '<p>이전 날짜</p>']);
  assert.doesNotMatch(JSON.stringify(entries), /draft-short-secret/);
  assert.deepEqual(await buildShorts(root), entries);
  await writeFile(path.join(root, 'shorts/a.md'), note('본문을 고쳤습니다', '', '2026-10-28T17:00:00+09:00'));
  assert.equal((await buildShorts(root))[1].id, entries[1].id);
});

test('date-only entries sort at the beginning of their Korean calendar day', async t => {
  const root = await fixture(t, {
    'day.md': note('날짜만 있는 기록', '', '2026-10-28'),
    'morning.md': note('오전 기록', '', '2026-10-28T08:30:00+09:00'),
    'night.md': note('전날 저녁', '', '2026-10-27T23:59:00+09:00'),
  });
  assert.deepEqual((await buildShorts(root)).map(entry => entry.html.trim()), ['<p>오전 기록</p>', '<p>날짜만 있는 기록</p>', '<p>전날 저녁</p>']);
});

test('a missing shorts folder is compatible with existing content; symlinks fail clearly', async t => {
  const root = await fixture(t);
  assert.deepEqual(await buildShorts(root), []);
  const outside = await fixture(t, { 'outside.md': note() });
  await symlink(path.join(outside, 'shorts'), path.join(root, 'shorts'));
  await assert.rejects(buildShorts(root), /symbolic links are not supported/);
  await rm(path.join(root, 'shorts'));
  await mkdir(path.join(root, 'shorts'));
  await symlink(path.join(outside, 'shorts/outside.md'), path.join(root, 'shorts/linked.md'));
  await assert.rejects(buildShorts(root), /symbolic links are not supported/);
});

test('sanitized empty prose needs a link, while link-only entries are supported', async t => {
  const empty = await fixture(t, { 'empty.md': note('<script>alert(1)</script>') });
  await assert.rejects(buildShorts(empty), /nonempty text body, local image, or link/);
  const linkOnly = await fixture(t, { 'link.md': note('', 'link: "https://example.com"') });
  const [entry] = await buildShorts(linkOnly);
  assert.equal(entry.html, '');
  assert.equal(entry.link, 'https://example.com/');
});

test('unfinished blank Obsidian drafts stay unpublished without triggering metadata fetches', async t => {
  const root = await fixture(t, { 'blank-draft.md': note('', 'draft: true') });
  let requests = 0;
  const entries = await buildShorts(root, { previewResolver: { resolve() { requests++; throw new Error('Draft must not fetch previews'); } } });
  assert.deepEqual(entries, []);
  assert.equal(requests, 0);
  await writeFile(path.join(root, 'shorts/blank-draft.md'), note('', 'draft: false'));
  await assert.rejects(buildShorts(root), /nonempty body or link/);
});

test('short entries generate separately from articles, folders, search, and per-post routes', async t => {
  const result = await buildCatalog(path.join(projectDir, 'tests/fixtures/content-repo'), { sample: true });
  assert.equal(result.shorts.length, 5);
  assert.equal(result.catalog.posts.length, 5);
  assert.equal(result.searchIndex.length, 5);
  assert.doesNotMatch(JSON.stringify(result.shorts), /draft-short-secret/);
  for (const short of result.shorts) {
    assert.ok(!Object.hasOwn(result.articles, short.id));
    assert.ok(!JSON.stringify(result.searchIndex).includes(short.id));
  }
  const output = await mkdtemp(path.join(tmpdir(), 'soohyuk-short-output-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  await writeContent(result, output);
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'app/generated/shorts.json'), 'utf8')), result.shorts);
  const existing = await buildCatalog(await fixture(t));
  await writeContent(existing, output);
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'app/generated/shorts.json'), 'utf8')), []);
});

test('short wiki images resolve all three roots with aliases, dimensions, and encoded filenames', async t => {
  const filename = '한글 # 그림.png';
  const encoded = encodeURIComponent(filename);
  const root = await fixture(t, {
    'notes/start.md': note(`![[images/${encoded}?version=1#crop|그림 설명]]\n\n![[posts/images/shared.webp|300x200]]\n\n![[shorts/notes/local.svg|120]]`),
    'notes/local.svg': '<svg/>',
  });
  await attachment(root, `images/${filename}`, 'root image');
  await attachment(root, 'posts/images/shared.webp', 'posts image');
  const files = new Set([`images/${filename}`, 'posts/images/shared.webp', 'shorts/notes/local.svg']);
  const usedAssets = new Set();
  const [entry] = await buildShorts(root, { files, usedAssets });
  assert.ok(entry.html.includes(`src="/content-images/${encoded}?version=1#crop" alt="그림 설명"`));
  assert.match(entry.html, /src="\/content-assets\/images\/shared.webp" alt="shared.webp" width="300" height="200"/);
  assert.match(entry.html, /src="\/short-assets\/notes\/local.svg" alt="local.svg" width="120"/);
  assert.equal((entry.html.match(/loading="lazy" decoding="async"/g) || []).length, 3);
  assert.deepEqual([...usedAssets].sort(), [...files].sort());
  assert.doesNotMatch(entry.html, /!\[\[/);
});

test('standalone short inventory prefers a sibling and requires a unique global image match', async t => {
  const root = await fixture(t, { 'notes/start.md': note('![[shared.png]]'), 'notes/shared.png': 'near' });
  await attachment(root, 'images/shared.png', 'root image');
  await attachment(root, 'posts/shared.png', 'posts image');
  assert.match((await buildShorts(root))[0].html, /src="\/short-assets\/notes\/shared.png"/);
  await rm(path.join(root, 'shorts/notes/shared.png'));
  await assert.rejects(buildShorts(root), /shorts\/notes\/start.md:.*ambiguous.*image/i);
  await rm(path.join(root, 'posts/shared.png'));
  assert.match((await buildShorts(root))[0].html, /src="\/content-images\/shared.png"/);
  await writeFile(path.join(root, 'shorts/notes/start.md'), note('![[missing.PNG]]'));
  await assert.rejects(buildShorts(root), /shorts\/notes\/start.md:.*image.*(?:exist|missing)/i);
});

test('Markdown images use source-relative paths and explicit roots while preserving surrounding links', async t => {
  const rootName = '한글 그림.png';
  const root = await fixture(t, {
    'notes/start.md': note(`[![로컬 그림](local.png)](https://example.com/reference)\n\n![상대 루트](../../images/${encodeURIComponent(rootName)}?v=1#crop)\n\n![명시 루트](/images/${encodeURIComponent(rootName)})\n\n![하위 폴더](images/near.png)\n\n[위키 예시 ![[missing.png]]](https://example.com/example)`),
    'notes/local.png': 'local image',
    'notes/images/near.png': 'relative nested image',
  });
  await attachment(root, `images/${rootName}`, 'root image');
  const usedAssets = new Set();
  const [entry] = await buildShorts(root, { usedAssets });
  assert.match(entry.html, /href="https:\/\/example.com\/reference"><img src="\/short-assets\/notes\/local.png" alt="로컬 그림"/);
  assert.ok(entry.html.includes(`src="/content-images/${encodeURIComponent(rootName)}?v=1#crop"`));
  assert.ok(entry.html.includes(`src="/content-images/${encodeURIComponent(rootName)}" alt="명시 루트"`));
  assert.match(entry.html, /src="\/short-assets\/notes\/images\/near.png"/);
  assert.match(entry.html, /href="https:\/\/example.com\/example">위키 예시 !\[\[missing.png\]\]/);
  assert.equal((entry.html.match(/<img /g) || []).length, 4);
  assert.deepEqual([...usedAssets].sort(), [`images/${rootName}`, 'shorts/notes/images/near.png', 'shorts/notes/local.png'].sort());
});

test('escaped and code wiki examples retain their positions beside identical real short images', async t => {
  const root = await fixture(t, {
    'start.md': note('\\!\\[\\[picture.png\\]\\] ![[picture.png]] &#33;[[picture.png]] ![[picture.png]]\n\n`![[missing.png]]`\n\n```markdown\n![[missing.png]]\n```\n\n![[document]]'),
    'picture.png': 'image bytes',
  });
  const usedAssets = new Set();
  const [entry] = await buildShorts(root, { usedAssets });
  assert.equal((entry.html.match(/<img /g) || []).length, 2);
  assert.equal((entry.html.match(/!\[\[picture.png\]\]/g) || []).length, 2);
  assert.match(entry.html, /<p>!\[\[picture.png\]\] <img/);
  assert.match(entry.html, /<code>!\[\[missing.png\]\]<\/code>/);
  assert.match(entry.html, /<pre><code[^>]*>!\[\[missing.png\]\]/);
  assert.match(entry.html, /!\[\[document\]\]/);
  assert.deepEqual([...usedAssets], ['shorts/picture.png']);
});

test('first-line indented wiki and Markdown image code stays literal without resolving assets', async t => {
  const root = await fixture(t, {
    'indented.md': note('    ![[missing.png]]\n\n    ![missing](missing.png)'),
  });
  const usedAssets = new Set();
  const [entry] = await buildShorts(root, { usedAssets });
  assert.match(entry.html, /<pre><code>!\[\[missing.png\]\]/);
  assert.match(entry.html, /!\[missing\]\(missing.png\)/);
  assert.doesNotMatch(entry.html, /<img/);
  assert.deepEqual([...usedAssets], []);
});

test('short images reject missing, hidden, malformed, and escaping local paths with source context', async t => {
  const root = await fixture(t, { 'unsafe.md': note('본문') });
  for (const body of [
    '![[missing.png]]', '![없음](missing.png)', '![[../../outside.png]]', '![[shorts/../../outside.png]]',
    '![[images/.private.png]]', '![[images/%2Eprivate.png]]', '![[bad%5Cname.png]]', '![[bad%00name.png]]', '![[bad%ZZ.png]]',
    '![밖](../../outside.png)', '![인코딩 밖](%2E%2E/%2E%2E/outside.png)', '![숨김](../images/%2Eprivate.png)',
    '![역슬래시](bad%5Cname.png)', '![널](bad%00name.png)', '![잘못된 인코딩](bad%ZZ.png)',
    '![허위 생성 경로](/short-assets/missing.png)', '![숨김 생성 경로](/content-images/%2Eprivate.png)',
    '![생성 경로 탈출](/short-assets/%2E%2E/%2E%2E/outside.png)',
  ]) {
    await writeFile(path.join(root, 'shorts/unsafe.md'), note(body));
    await assert.rejects(buildShorts(root), /shorts\/unsafe.md:/, body);
  }
});

test('standalone short inventory rejects symlinked image roots and attachments', async t => {
  const root = await fixture(t, { 'start.md': note('![[images/picture.png]]') });
  const outside = await fixture(t, { 'picture.png': 'outside image' });
  await symlink(path.join(outside, 'shorts'), path.join(root, 'images'));
  await assert.rejects(buildShorts(root), /symbolic links are not supported/i);
  await rm(path.join(root, 'images'));
  await mkdir(path.join(root, 'images'));
  await symlink(path.join(outside, 'shorts/picture.png'), path.join(root, 'images/picture.png'));
  await assert.rejects(buildShorts(root), /symbolic links are not supported/i);
});

test('image-only shorts require a validated local image, and drafts skip missing image resolution', async t => {
  const root = await fixture(t, {
    'image.md': note('![[picture.png]]'),
    'picture.png': 'local image',
    'draft.md': note('![[missing.png]]', 'draft: true'),
  });
  const usedAssets = new Set();
  const entries = await buildShorts(root, { usedAssets });
  assert.equal(entries.length, 1);
  assert.match(entries[0].html, /<img src="\/short-assets\/picture.png"/);
  assert.deepEqual([...usedAssets], ['shorts/picture.png']);
  await writeFile(path.join(root, 'shorts/image.md'), note('![원격](https://example.com/tracker.png)'));
  await assert.rejects(buildShorts(root), /nonempty.*(?:body|image).*link/i);
  await writeFile(path.join(root, 'shorts/image.md'), note('본문 ![원격](https://example.com/tracker.png) ![데이터](data:image/png;base64,AAAA) ![상대 프로토콜](//example.com/tracker.png)'));
  const nextAssets = new Set();
  const [entry] = await buildShorts(root, { usedAssets: nextAssets });
  assert.doesNotMatch(entry.html, /<img/);
  assert.deepEqual([...nextAssets], []);
});

test('only published short image references copy to distinct roots and deleted assets are cleaned', async t => {
  const root = await fixture(t, {
    'public.md': note('![[images/same.png]]\n\n![[posts/images/same.png]]\n\n![[shorts/images/same.png]]'),
    'images/same.png': 'short image',
    'unused.png': 'unused short image',
    'private.png': 'draft short image',
    'draft.md': note('![[images/private.png]] ![[shorts/private.png]] ![[missing.png]]', 'draft: true'),
  });
  await attachment(root, 'images/same.png', 'root image');
  await attachment(root, 'images/private.png', 'draft root image');
  await attachment(root, 'posts/images/same.png', 'posts image');
  const output = await mkdtemp(path.join(tmpdir(), 'soohyuk-short-image-output-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  await attachment(output, '.cache/public/short-assets/old.png', 'stale image');
  const result = await buildCatalog(root);
  assert.equal(result.shorts.length, 1);
  assert.deepEqual(result.usedAssets.sort(), ['images/same.png', 'posts/images/same.png', 'shorts/images/same.png'].sort());
  await writeContent(result, output);
  for (const [file, expected] of [['content-images/same.png', 'root image'], ['content-assets/images/same.png', 'posts image'], ['short-assets/images/same.png', 'short image']]) {
    assert.equal(await readFile(path.join(output, '.cache/public', file), 'utf8'), expected);
  }
  for (const file of ['short-assets/old.png', 'short-assets/unused.png', 'short-assets/private.png', 'content-images/private.png']) {
    await assert.rejects(readFile(path.join(output, '.cache/public', file)), { code: 'ENOENT' });
  }
  await rm(path.join(root, 'shorts/public.md'));
  await writeContent(await buildCatalog(root), output);
  for (const file of ['content-images/same.png', 'content-assets/images/same.png', 'short-assets/images/same.png']) {
    await assert.rejects(readFile(path.join(output, '.cache/public', file)), { code: 'ENOENT' });
  }
});

test('new short attachments do not change ordinary article image lookup scope', async t => {
  const root = await fixture(t, { 'shared.png': 'short image' });
  await attachment(root, 'posts/article.md', '---\ntitle: "일반 글"\nslug: "article"\ndate: "2026-10-28"\n---\n![[shared.png]]');
  await attachment(root, 'images/shared.png', 'root image');
  const result = await buildCatalog(root);
  assert.match(result.articles.article.html, /src="\/content-images\/shared.png"/);
  assert.deepEqual(result.usedAssets, ['images/shared.png']);
  await rm(path.join(root, 'images/shared.png'));
  await assert.rejects(buildCatalog(root), /article.md:.*local image does not exist/);
});
