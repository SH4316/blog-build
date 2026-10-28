import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rename, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildCatalog, parsePost, projectDir, repositoryUrl, resolveSource, writeContent } from '../scripts/content.mjs';

const article = (slug = 'example', body = '공개 본문입니다.', extra = '') => `---\ntitle: "예제 제목"\nslug: "${slug}"\ndate: "2026-10-16"\n${extra}\n---\n${body}\n`;
async function fixture(t, files) {
  const root = await mkdtemp(path.join(tmpdir(), 'soohyuk-content-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'posts'), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, 'posts', name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return root;
}

test('samples render code, math, nested folders, links, images, and Unicode while excluding drafts', async () => {
  const result = await buildCatalog(path.join(projectDir, 'tests/fixtures/content-repo'), { sample: true });
  assert.equal(result.catalog.posts.length, 5);
  assert.ok(result.catalog.folders.includes('react/typescript'));
  assert.ok(!result.catalog.folders.includes('drafts'));
  assert.ok(!result.catalog.tags.includes('draft-only-tag'));
  assert.ok(!JSON.stringify(result).includes('next-post-draft'));
  assert.match(result.articles['gradient-descent'].html, /class="katex"/);
  assert.match(result.articles['gradient-descent'].html, /<math /);
  assert.match(result.articles['gradient-descent'].html, /katex-display/);
  assert.match(result.articles['http-cache'].html, /class="shiki/);
  assert.match(result.articles['http-cache'].html, /href="\/posts\/typescript-discriminated-unions"/);
  assert.match(result.articles['git-worktree'].html, /href="\/posts\/%EA%B8%B0/);
  assert.match(result.articles['http-cache'].html, /src="\/content-assets\/web\/images\/cache-flow.svg"/);
  assert.match(result.articles['http-cache'].html, /loading="lazy"/);
  assert.deepEqual(result.usedAssets, ['posts/web/images/cache-flow.svg']);
  assert.ok(result.articles['http-cache'].toc.some(item => item.level === 3));
  assert.equal(result.catalog.sample, true);
});

test('frontmatter validates required fields, slug, calendar dates, tags, and booleans', () => {
  assert.throws(() => parsePost('본문', 'bad.md'), /frontmatter/);
  assert.throws(() => parsePost(article().replace('slug: "example"', 'slug: ""'), 'bad.md'), /slug is required/);
  assert.throws(() => parsePost(article('bad/path'), 'bad.md'), /slug must/);
  assert.throws(() => parsePost(article('Uppercase'), 'bad.md'), /slug must/);
  assert.throws(() => parsePost(article().replace('2026-10-16', '2026-02-30'), 'bad.md'), /valid quoted/);
  assert.throws(() => parsePost(article('example', '본문', 'tags: hello'), 'bad.md'), /tags must/);
  assert.throws(() => parsePost(article('example', '본문', 'draft: "false"'), 'bad.md'), /draft must/);
  assert.equal(parsePost(article('한글-주소'), '분류/예제.md').slug, '한글-주소');
});

test('moving a file changes the folder while preserving the article slug', async t => {
  const root = await fixture(t, { 'before/example.md': article() });
  const before = await buildCatalog(root);
  await mkdir(path.join(root, 'posts/after/nested'), { recursive: true });
  await rename(path.join(root, 'posts/before/example.md'), path.join(root, 'posts/after/nested/moved.md'));
  const after = await buildCatalog(root);
  assert.equal(before.catalog.posts[0].slug, after.catalog.posts[0].slug);
  assert.equal(after.catalog.posts[0].folder, 'after/nested');
  assert.deepEqual(after.catalog.folders, ['after', 'after/nested']);
});

test('duplicate slugs across folders fail the build', async t => {
  const root = await fixture(t, { 'one/a.md': article(), 'two/b.md': article() });
  await assert.rejects(buildCatalog(root), /Duplicate slug: example/);
});

test('additions, edits, and deletions are reflected without stale records', async t => {
  const root = await fixture(t, { 'example.md': article() });
  const first = await buildCatalog(root);
  assert.equal(first.catalog.posts.length, 1);
  await writeFile(path.join(root, 'posts/example.md'), article('example', '변경된 검색 문장'));
  const updated = await buildCatalog(root);
  assert.match(updated.searchIndex[0].text, /변경된 검색 문장/);
  await rm(path.join(root, 'posts/example.md'));
  const deleted = await buildCatalog(root);
  assert.equal(deleted.catalog.posts.length, 0);
  assert.deepEqual(deleted.searchIndex, []);
  assert.deepEqual(deleted.catalog.folders, []);
});

test('relative links retain query strings and heading fragments', async t => {
  const root = await fixture(t, { 'one/a.md': article('one', '[글](../two/b.md?mode=read#heading)'), 'two/b.md': article('two', '## Heading\n본문') });
  const result = await buildCatalog(root);
  assert.match(result.articles.one.html, /href="\/posts\/two\?mode=read#heading"/);
});

test('wiki links resolve filenames, aliases, paths, and Korean heading fragments to stable URLs', async t => {
  const root = await fixture(t, {
    'notes/start.md': article('start', '[[문서]] [[문서|표시 이름]] [[../reference/문서.md]] [[reference/문서]] [[posts/reference/문서]] [[문서#한글 제목]] [[#현재 제목|여기]]\n\n## 현재 제목'),
    'reference/문서.md': article('stable-url', '## 한글 제목'),
  });
  const result = await buildCatalog(root);
  const html = result.articles.start.html;
  assert.equal((html.match(/href="\/posts\/stable-url"/g) || []).length, 5);
  assert.match(html, /href="\/posts\/stable-url">표시 이름<\/a>/);
  assert.ok(html.includes(`href="/posts/stable-url#${encodeURIComponent('한글-제목')}"`));
  assert.ok(html.includes(`href="/posts/start#${encodeURIComponent('현재-제목')}"`));
  assert.ok(!result.searchIndex.find(item => item.slug === 'start').text.includes('[['));
});

test('wiki links prefer a sibling and reject ambiguous, missing, and unpublished targets', async t => {
  const files = {
    'one/start.md': article('start', '[[target]]'),
    'one/target.md': article('near'),
    'two/target.md': article('far'),
  };
  const root = await fixture(t, files);
  assert.match((await buildCatalog(root)).articles.start.html, /href="\/posts\/near"/);
  for (const [body, expected] of [
    ['[[target]]', /ambiguous wiki link/],
    ['[[missing]]', /missing or unpublished/],
    ['[[draft]]', /missing or unpublished/],
    ['[[one/target#^block]]', /block links are not supported/],
  ]) {
    const invalid = await fixture(t, { ...files, 'start.md': article('root-start', body), 'draft.md': article('draft', '', 'draft: true') });
    await assert.rejects(buildCatalog(invalid), expected);
  }
});

test('wiki syntax in code, math, embeds, and existing links stays literal', async t => {
  const root = await fixture(t, { 'start.md': article('start', '`[[missing]]`\n\n```text\n[[missing]]\n```\n\n$[[x]]$\n\n![[missing]]\n\n[See [[missing]]](https://example.com)') });
  const { html } = (await buildCatalog(root)).articles.start;
  assert.match(html, /<code>\[\[missing\]\]<\/code>/);
  assert.match(html, /!\[\[missing\]\]/);
  assert.match(html, /href="https:\/\/example.com">See \[\[missing\]\]<\/a>/);
});

test('missing articles, draft targets, missing assets, and escaping paths fail with a source filename', async t => {
  for (const body of ['[깨진 링크](missing.md)', '![이미지](missing.png)', '[밖의 파일](../../outside.png)']) {
    const root = await fixture(t, { 'a.md': article('one', body) });
    await assert.rejects(buildCatalog(root), /a.md:/);
  }
  const root = await fixture(t, { 'a.md': article('one', '[초안](draft.md)'), 'draft.md': article('draft', '작성 중', 'draft: true') });
  await assert.rejects(buildCatalog(root), /missing or unpublished/);
});

test('raw HTML and unsafe link protocols are not executable in rendered articles', async t => {
  const root = await fixture(t, { 'a.md': article('one', '<script>alert(1)</script>\n\n[link](javascript:alert%281%29)\n\n일반 본문') });
  const result = await buildCatalog(root);
  assert.doesNotMatch(result.articles.one.html, /<script|href="javascript:/);
  assert.match(result.articles.one.html, /일반 본문/);
});

test('inline and display math are rendered while escaped dollars and code stay literal', async t => {
  const root = await fixture(t, { 'a.md': article('one', '인라인 $x^2$. 금액 \\$10. 코드 `$y$`.\n\n$$z^2$$\n\n```text\n$$not_math$$\n```') });
  const result = await buildCatalog(root);
  const html = result.articles.one.html;
  assert.match(html, /katex-display/);
  assert.match(html, /금액 \$10/);
  assert.match(html, /<code>\$y\$<\/code>/);
  assert.match(html, /\$\$not_math\$\$/);
});

test('invalid KaTeX commands fail the build instead of shipping red error markup', async t => {
  const root = await fixture(t, { 'a.md': article('one', '$\\notARealMathCommand{x}$') });
  await assert.rejects(buildCatalog(root), /a.md:.*KaTeX|a.md:.*render math|a.md:.*Undefined control/i);
});

test('Mermaid fences preserve escaped source in initial HTML and bypass syntax highlighting', async t => {
  const root = await fixture(t, { 'a.md': article('diagram', '```mermaid\nflowchart LR\nA["<script>alert(1)</script>"] --> B[끝]\n```\n\n```typescript\nconst diagram = true;\n```') });
  const result = await buildCatalog(root);
  const html = result.articles.diagram.html;
  assert.match(html, /<pre[^>]*data-mermaid=""[^>]*tabindex="0"/);
  assert.match(html, /<code class="language-mermaid">/);
  assert.match(html, /flowchart LR/);
  assert.match(html, /&#x3C;script>|&lt;script>/);
  assert.doesNotMatch(html, /<script>|<svg/);
  assert.match(html, /class="shiki/);
  assert.match(result.searchIndex[0].text, /flowchart LR/);
});

test('only referenced assets are copied and obsolete assets are removed', async t => {
  const root = await fixture(t, { 'a.md': article('one', '![test](images/used.svg)'), 'images/used.svg': '<svg/>', 'images/unused.svg': '<svg/>' });
  const output = await mkdtemp(path.join(tmpdir(), 'soohyuk-output-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  await mkdir(path.join(output, '.cache/public/content-assets'), { recursive: true });
  await writeFile(path.join(output, '.cache/public/content-assets/old.png'), 'old');
  const result = await buildCatalog(root);
  await writeContent(result, output);
  assert.equal(await readFile(path.join(output, '.cache/public/content-assets/images/used.svg'), 'utf8'), '<svg/>');
  await assert.rejects(readFile(path.join(output, '.cache/public/content-assets/images/unused.svg')), /ENOENT/);
  await assert.rejects(readFile(path.join(output, '.cache/public/content-assets/old.png')), /ENOENT/);
});

test('Obsidian images resolve root attachments with spaces and Unicode, sizes, aliases, and explicit paths', async t => {
  const filename = 'Pasted image 20261028132609.png';
  const root = await fixture(t, {
    'AI/Artificial Analysis Inteligence Index v5 발표.md': article('announcement', `![[${filename}]]\n\n![[images/한글 그림.svg|그림 설명]]\n\n![[posts/AI/local.webp|300x200]]\n\n![[local.webp|120]]\n\n![일반 이미지](<../../images/${filename}?version=1#image>)`),
    'AI/local.webp': 'local image',
  });
  await mkdir(path.join(root, 'images'), { recursive: true });
  await writeFile(path.join(root, 'images', filename), Buffer.from([137, 80, 78, 71, 0, 1, 2]));
  await writeFile(path.join(root, 'images/한글 그림.svg'), '<svg/>');
  const result = await buildCatalog(root);
  const { html } = result.articles.announcement;
  assert.equal((html.match(/src="\/content-images\/Pasted%20image%2020261028132609.png/g) || []).length, 2);
  assert.ok(html.includes(`src="/content-images/${encodeURIComponent('한글 그림.svg')}" alt="그림 설명"`));
  assert.match(html, /src="\/content-assets\/AI\/local.webp" alt="local.webp" width="300" height="200"/);
  assert.match(html, /src="\/content-assets\/AI\/local.webp" alt="local.webp" width="120"/);
  assert.match(html, /version=1#image/);
  assert.equal((html.match(/loading="lazy" decoding="async"/g) || []).length, 5);
  assert.doesNotMatch(html, /!\[\[/);
  const output = await mkdtemp(path.join(tmpdir(), 'soohyuk-output-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  await writeContent(result, output);
  assert.deepEqual(await readFile(path.join(output, '.cache/public/content-images', filename)), await readFile(path.join(root, 'images', filename)));
});

test('wiki image lookup prefers siblings and fails on missing or ambiguous supported images with source context', async t => {
  const root = await fixture(t, {
    'one/start.md': article('start', '![[shared.png]]'),
    'one/shared.png': 'near',
    'two/shared.png': 'far',
  });
  assert.match((await buildCatalog(root)).articles.start.html, /src="\/content-assets\/one\/shared.png"/);
  await writeFile(path.join(root, 'posts/start.md'), article('root-start', '![[shared.png]]'));
  await assert.rejects(buildCatalog(root), /start.md: ambiguous wiki image: shared.png/);
  await writeFile(path.join(root, 'posts/start.md'), article('root-start', '![[missing.JPEG]]'));
  await assert.rejects(buildCatalog(root), /start.md: local image does not exist: missing.JPEG/);
  await mkdir(path.join(root, 'images'), { recursive: true });
  await writeFile(path.join(root, 'images/shared.png'), 'root image');
  await rm(path.join(root, 'posts/two/shared.png'));
  await writeFile(path.join(root, 'posts/start.md'), article('root-start', '![[shared.png]]'));
  await assert.rejects(buildCatalog(root), /start.md: ambiguous wiki image: shared.png/);
});

test('root images and posts attachments use distinct URLs and only published references are copied', async t => {
  const root = await fixture(t, {
    'start.md': article('start', '![[posts/same.png]]\n\n![[images/same.png]]'),
    'same.png': 'posts image',
    'draft.md': article('draft', '![[images/private.png]]', 'draft: true'),
  });
  await mkdir(path.join(root, 'images'), { recursive: true });
  for (const name of ['same.png', 'private.png', 'unused.png', 'config.json']) await writeFile(path.join(root, 'images', name), name);
  await writeFile(path.join(root, 'secret.png'), 'outside allowed roots');
  const result = await buildCatalog(root);
  assert.match(result.articles.start.html, /src="\/content-assets\/same.png"/);
  assert.match(result.articles.start.html, /src="\/content-images\/same.png"/);
  assert.deepEqual(result.usedAssets, ['posts/same.png', 'images/same.png']);
  const output = await mkdtemp(path.join(tmpdir(), 'soohyuk-output-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  await mkdir(path.join(output, '.cache/public/content-images'), { recursive: true });
  await writeFile(path.join(output, '.cache/public/content-images/old.png'), 'old');
  await writeContent(result, output);
  assert.equal(await readFile(path.join(output, '.cache/public/content-assets/same.png'), 'utf8'), 'posts image');
  assert.equal(await readFile(path.join(output, '.cache/public/content-images/same.png'), 'utf8'), 'same.png');
  for (const name of ['private.png', 'unused.png', 'config.json', 'secret.png', 'old.png']) {
    await assert.rejects(readFile(path.join(output, '.cache/public/content-images', name)), { code: 'ENOENT' });
  }
});

test('image examples in code, math, escaped syntax, note embeds, and existing links remain literal', async t => {
  const root = await fixture(t, {
    'start.md': article('start', '`![[missing.png]]`\n\n```text\n![[missing.png]]\n```\n\n$![[x.png]]$\n\n\\![[missing.png]]\n\n!\\[[missing.png]]\n\n\\[[missing]]\n\n![[missing]]\n\n[See ![[missing.png]]](https://example.com)\n\n[See ![[missing.png]]][external]\n\n[external]: https://example.com'),
  });
  const result = await buildCatalog(root);
  assert.doesNotMatch(result.articles.start.html, /<img/);
  assert.match(result.articles.start.html, /<code>!\[\[missing.png\]\]<\/code>/);
  assert.match(result.articles.start.html, /!\[\[missing\]\]/);
  assert.equal((result.articles.start.html.match(/href="https:\/\/example.com">See !\[\[missing.png\]\]/g) || []).length, 2);
  assert.deepEqual(result.usedAssets, []);
});

test('escaped wiki examples retain their positions beside identical real images and article links', async t => {
  const root = await fixture(t, {
    'start.md': article('start', '\\!\\[\\[picture.png\\]\\] ![[picture.png]] &#33;[[picture.png]] ![[picture.png]]\n\n\\[\\[target\\]\\] [[target]] &#91;&#91;target]] [[target]]'),
    'target.md': article('target'),
    'picture.png': 'image',
  });
  const { html } = (await buildCatalog(root)).articles.start;
  assert.equal((html.match(/<img /g) || []).length, 2);
  assert.equal((html.match(/!\[\[picture.png\]\]/g) || []).length, 2);
  assert.match(html, /<p>!\[\[picture.png\]\] <img/);
  assert.equal((html.match(/href="\/posts\/target"/g) || []).length, 2);
  assert.match(html, /<p>\[\[target\]\] <a href="\/posts\/target"/);
});

test('wiki and Markdown images cannot traverse outside allowed roots or access hidden files', async t => {
  for (const body of ['![[../../secret.png]]', '![[images/../../secret.png]]', '![[..%2F..%2Fsecret.png]]', '![[images/.private.png]]', '![[.private/secret.png]]', '![[images/back%5Cslash.png]]', '![x](../../secret.png)', '![x](../images/.private.png)', '![[secret.png]]', '![x](../images/config.json)']) {
    const root = await fixture(t, { 'start.md': article('start', body), '.private/secret.png': 'hidden' });
    await mkdir(path.join(root, 'images'), { recursive: true });
    await writeFile(path.join(root, 'images/.private.png'), 'hidden');
    await writeFile(path.join(root, 'images/config.json'), '{}');
    await writeFile(path.join(root, 'secret.png'), 'repository root secret');
    await assert.rejects(buildCatalog(root), /start.md:/, body);
  }
});

test('symlinked attachment directories and files fail without following their targets', async t => {
  for (const kind of ['images-root', 'posts-root', 'images-file', 'posts-file', 'images-directory']) {
    const root = await fixture(t, { 'start.md': article('start') });
    const outside = await mkdtemp(path.join(tmpdir(), 'soohyuk-outside-'));
    t.after(() => rm(outside, { recursive: true, force: true }));
    await writeFile(path.join(outside, 'target.png'), 'outside');
    if (kind === 'images-root') await symlink(outside, path.join(root, 'images'));
    if (kind === 'posts-root') {
      await rm(path.join(root, 'posts'), { recursive: true });
      await symlink(outside, path.join(root, 'posts'));
    }
    if (kind === 'posts-file') await symlink(path.join(outside, 'target.png'), path.join(root, 'posts/link.png'));
    if (kind.startsWith('images-') && kind !== 'images-root') {
      await mkdir(path.join(root, 'images'));
      await symlink(kind === 'images-file' ? path.join(outside, 'target.png') : outside, path.join(root, 'images/link.png'));
    }
    await assert.rejects(buildCatalog(root), /Symbolic links are not supported/);
  }
});

test('production cannot fall back to examples and GitHub sources are restricted to public repository identifiers', async () => {
  await assert.rejects(resolveSource({ CF_PAGES: '1', CONTENT_LOCAL_DIR: '/tmp/content' }), /CONTENT_REPOSITORY is required/);
  assert.equal(repositoryUrl('someone/blog-content'), 'https://github.com/someone/blog-content.git');
  assert.equal(repositoryUrl('https://github.com/someone/blog-content.git'), 'https://github.com/someone/blog-content.git');
  assert.throws(() => repositoryUrl('https://user:token@github.com/someone/repository'), /CONTENT_REPOSITORY/);
  assert.throws(() => repositoryUrl('../outside'), /CONTENT_REPOSITORY/);
});

test('heading anchors are static, accessible, unique, and excluded from TOC labels', async t => {
  const root = await fixture(t, { 'example.md': article('example', '## 한글 제목\n\n### 코드 `value`\n\n#### 한글 제목\n\n## 한글 제목') });
  const { articles } = await buildCatalog(root);
  const { html, toc } = articles.example;
  assert.deepEqual(toc.map(entry => entry.text), ['한글 제목', '코드  value', '한글 제목', '한글 제목']);
  assert.equal(new Set(toc.map(entry => entry.id)).size, 4);
  for (const entry of toc) {
    assert.ok(html.includes(`href="#${entry.id}" class="headingAnchor" aria-label="${entry.text} 섹션 링크">#</a>`));
  }
});


test('default local content uses isolated fixtures and explicit local content takes precedence', async () => {
  const source = await resolveSource({});
  assert.equal(source.rootDirectory, path.join(projectDir, 'tests/fixtures/content-repo'));
  assert.equal(source.sample, true);
  const local = await resolveSource({ CONTENT_LOCAL_DIR: './custom-content', CONTENT_REPOSITORY: 'unused/repository' });
  assert.equal(local.rootDirectory, path.resolve('./custom-content'));
  assert.equal(local.sample, false);
});

test('copyable content template renders independently from development fixtures', async () => {
  const result = await buildCatalog(path.join(projectDir, 'examples/content-repo'));
  assert.deepEqual(result.catalog.posts.map(post => post.slug), ['hello']);
});
