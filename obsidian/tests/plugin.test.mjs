import test from 'node:test';
import assert from 'node:assert/strict';
import { frontmatterInfo, harness, metadata, note } from './harness.mjs';

test('startup leaves existing files alone; only new posts after layout readiness receive defaults', async () => {
  const h = await harness(undefined, { 'posts/existing.md': '기존 본문\n' });
  await h.vault.create('posts/loading.md', '시작 중 읽은 파일\n');
  await h.drain();
  assert.equal(h.writes.length, 0);
  h.ready();
  const body = '\n# 본문\n\n```yaml\ntags: [코드]\n---\n```\n';
  await h.vault.create('posts/nested/한글 글.md', body);
  for (const path of ['posts-archive/a.md', 'other/a.md', 'posts/a.png']) await h.vault.create(path, '그대로');
  await h.vault.createFolder('posts/new-folder');
  await h.drain();
  assert.deepEqual(h.writes, ['posts/nested/한글 글.md']);
  const raw = h.contents.get('posts/nested/한글 글.md');
  assert.equal(raw.slice(frontmatterInfo(raw).contentStart), body);
  const data = metadata(raw);
  assert.equal(data.title, '한글 글');
  assert.equal(data.slug, '한글-글');
  assert.equal(data.draft, true);
  assert.deepEqual(data.tags, []);
  assert.equal(h.contents.get('posts/existing.md'), '기존 본문\n');
  assert.equal(h.contents.get('posts/loading.md'), '시작 중 읽은 파일\n');
});

test('template metadata is preserved, concurrent creations get unique slugs, rename keeps them', async () => {
  const h = await harness({ defaultTags: ['default'] });
  h.ready();
  const body = '\n본문과 \`---\`를 그대로 유지합니다.\n';
  const existing = { title: '정확한 제목', slug: 'permanent-address', tags: ['custom'], date: '2020-01-01', draft: false, custom: 42 };
  const template = await h.vault.create('posts/template.md', note(existing, body));
  await Promise.all([
    h.vault.create('posts/first/한글 글.md', ''),
    h.vault.create('posts/second/한글 글.md', ''),
  ]);
  await h.drain();
  assert.deepEqual(metadata(h.contents.get(template.path)), { ...existing, description: '' });
  assert.equal(h.contents.get(template.path).slice(frontmatterInfo(h.contents.get(template.path)).contentStart), body);
  assert.equal(metadata(h.contents.get('posts/first/한글 글.md')).slug, '한글-글');
  assert.equal(metadata(h.contents.get('posts/second/한글 글.md')).slug, '한글-글-2');
  h.vault.rename(template, 'posts/moved.md');
  await h.drain();
  assert.equal(metadata(h.contents.get(template.path)).slug, 'permanent-address');
});

test('current-post command works with automatic mode off and is idempotent', async () => {
  const h = await harness({ autoAdd: false, defaultTags: ['C++', 'C#'], draft: false });
  h.ready();
  const file = await h.vault.create('posts/manual.md', '본문');
  await h.drain();
  assert.equal(h.writes.length, 0);
  const command = h.plugin.commands.find(command => command.id === 'add-current-frontmatter');
  assert.equal(command.checkCallback(true), false);
  h.app.workspace.active = await h.vault.create('posts-archive/a.md', '그대로');
  assert.equal(command.checkCallback(true), false);
  h.app.workspace.active = file;
  assert.equal(command.checkCallback(true), true);
  assert.equal(h.writes.length, 0);
  command.checkCallback(false);
  await h.drain();
  assert.deepEqual(metadata(h.contents.get(file.path)).tags, ['C++', 'C#']);
  assert.equal(metadata(h.contents.get(file.path)).draft, false);
  command.checkCallback(false);
  await h.drain();
  assert.equal(h.writes.length, 1);
});

test('bad YAML stays byte-for-byte intact and errors do not poison the write queue', async () => {
  const h = await harness();
  h.ready();
  const bad = '---\ntags: [unfinished\n---\n\n본문\n';
  const broken = await h.vault.create('posts/broken.md', bad);
  await h.drain();
  assert.equal(h.contents.get(broken.path), bad);
  assert.match(h.notices[0], /posts\/broken\.md.*YAML/);
  // Repair the bad document so the global collision scan can succeed.
  h.contents.set(broken.path, '고친 본문');
  await h.vault.create('posts/valid.md', '정상 본문');
  await h.drain();
  assert.equal(metadata(h.contents.get('posts/valid.md')).slug, 'valid');
  const unclosed = '---\ntitle: unfinished\n본문';
  await h.vault.create('posts/unclosed.md', unclosed);
  await h.drain();
  assert.equal(h.contents.get('posts/unclosed.md'), unclosed);
  assert.match(h.notices.at(-1), /닫는 ---/);
});

test('new-post command preserves the exact title, creates folders, and refuses filename collisions', async () => {
  const h = await harness({ targetFolder: 'blog/posts', defaultTags: ['web'] }, {
    'blog/posts/old.md': note({ slug: 'http-캐시' }),
  });
  h.ready();
  await h.plugin.createPost('HTTP: 캐시');
  await h.drain();
  const path = 'blog/posts/HTTP- 캐시.md';
  const data = metadata(h.contents.get(path));
  assert.equal(data.title, 'HTTP: 캐시');
  assert.equal(data.slug, 'http-캐시-2');
  assert.deepEqual(data.tags, ['web']);
  assert.equal(h.opened[0].path, path);
  assert.ok(h.files.has('blog'));
  assert.ok(h.files.has('blog/posts'));
  assert.equal(h.writes.length, 0, 'The automatic handler must leave the completed new post alone');
  await assert.rejects(h.plugin.createPost('HTTP: 캐시'), /같은 파일/);
  assert.equal(h.vault.getMarkdownFiles().length, 2);
  await Promise.all([h.plugin.createPost('C++'), h.plugin.createPost('C#')]);
  await h.drain();
  assert.equal(metadata(h.contents.get('blog/posts/C++.md')).slug, 'c');
  assert.equal(metadata(h.contents.get('blog/posts/C#.md')).slug, 'c-2');
});

test('settings reject invalid folder/tags while retaining the previous valid values', async () => {
  const h = await harness({ targetFolder: 'posts', defaultTags: ['React'] });
  h.plugin.tabs[0].display();
  const folder = h.controls.find(control => control.name === '글 폴더');
  const tags = h.controls.find(control => control.name === '기본 태그');
  await folder.text.change('../secret');
  assert.equal(h.plugin.settings.targetFolder, 'posts');
  assert.equal(folder.text.inputEl.attrs.get('aria-invalid'), 'true');
  await tags.text.change('bad/tag');
  assert.deepEqual(Array.from(h.plugin.settings.defaultTags), ['React']);
  assert.equal(tags.text.inputEl.attrs.get('aria-invalid'), 'true');
  await folder.text.change('blog/posts');
  await tags.text.change('C++, C#');
  assert.equal(h.plugin.settings.targetFolder, 'blog/posts');
  assert.deepEqual(Array.from(h.plugin.settings.defaultTags), ['C++', 'C#']);
  assert.equal(tags.text.inputEl.attrs.has('aria-invalid'), false);
});

test('unloading before layout readiness prevents event registration', async () => {
  const h = await harness();
  h.plugin.onunload();
  h.ready();
  await h.vault.create('posts/after-unload.md', '그대로');
  await h.drain();
  assert.equal(h.plugin.events.length, 0);
  assert.equal(h.writes.length, 0);
});
