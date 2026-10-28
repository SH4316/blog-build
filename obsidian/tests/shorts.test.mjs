import test from 'node:test';
import assert from 'node:assert/strict';
import { frontmatterInfo, harness, metadata, note } from './harness.mjs';

const now = '2026-10-28T03:04:05.006Z';
const timestampPath = 'shorts/2026-10-28T03-04-05-006Z.md';

function shortModal(h) {
  h.plugin.commands.find(command => command.id === 'new-blog-short').callback();
  const modal = h.modals.at(-1);
  const controls = h.controls.filter(control => control.container === modal.contentEl);
  return {
    modal,
    body: controls.find(control => control.name === '본문').textArea,
    link: controls.find(control => control.name === '링크 (선택)').text,
    title: controls.find(control => control.name === '링크 제목 (선택)').text,
    submit: controls.find(control => control.buttons?.length === 2).buttons[1],
    cancel: controls.find(control => control.buttons?.length === 2).buttons[0],
    error: modal.contentEl.children.find(element => element.attrs.get('role') === 'alert'),
  };
}

test('startup leaves shorts alone; autoAdd uses only date/draft and preserves body and properties', async () => {
  const h = await harness({ defaultTags: ['article-only'], draft: false }, { 'shorts/existing.md': '기존 메모' }, { now });
  await h.vault.create('shorts/loading.md', '시작 중 메모');
  h.ready();
  const body = '\n그대로 유지할 본문\n\n```yaml\n---\n```\n';
  await h.vault.create('shorts/nested/new.md', note({ custom: 'keep', link: 'https://example.com/' }, body));
  for (const path of ['shorts-archive/a.md', 'other/shorts/a.md', 'shorts/a.png']) await h.vault.create(path, '그대로');
  await h.drain();
  assert.deepEqual(h.writes, ['shorts/nested/new.md']);
  const raw = h.contents.get('shorts/nested/new.md');
  assert.deepEqual(metadata(raw), { custom: 'keep', link: 'https://example.com/', date: now, draft: false });
  assert.equal(raw.slice(frontmatterInfo(raw).contentStart), body);
  assert.equal(h.contents.get('shorts/existing.md'), '기존 메모');
  assert.equal(h.contents.get('shorts/loading.md'), '시작 중 메모');
});

test('current frontmatter command detects shorts with autoAdd disabled and is idempotent', async () => {
  const body = '\n본문은 그대로\n';
  const h = await harness({ autoAdd: false }, { 'shorts/manual.md': note({ date: '2025-01-02', draft: false, linkTitle: '유지', custom: null }, body) }, { now });
  h.ready();
  const file = h.files.get('shorts/manual.md');
  h.app.workspace.active = file;
  const command = h.plugin.commands.find(command => command.id === 'add-current-frontmatter');
  assert.equal(command.checkCallback(true), true);
  command.checkCallback(false);
  await h.drain();
  assert.equal(h.writes.length, 0);
  h.contents.set(file.path, note({ draft: false, custom: null }, body));
  command.checkCallback(false);
  await h.drain();
  command.checkCallback(false);
  await h.drain();
  const raw = h.contents.get(file.path);
  assert.deepEqual(metadata(raw), { draft: false, custom: null, date: now });
  assert.equal(raw.slice(frontmatterInfo(raw).contentStart), body);
  assert.deepEqual(h.writes, [file.path]);
});

test('short creation ignores article metadata, creates fixed root folder and handles same-timestamp collisions', async () => {
  const h = await harness({ autoAdd: false, targetFolder: 'blog/posts', defaultTags: ['article-only'], draft: false }, {
    'blog/posts/broken.md': '---\ntags: [unfinished\n---\n',
    [timestampPath]: '기존 파일',
  }, { now });
  h.ready();
  await Promise.all([
    h.plugin.createShort({ body: '첫 번째' }),
    h.plugin.createShort({ body: '두 번째', link: ' https://example.com/ ', linkTitle: ' 제목 ' }),
  ]);
  await h.drain();
  const first = 'shorts/2026-10-28T03-04-05-006Z-2.md';
  const second = 'shorts/2026-10-28T03-04-05-006Z-3.md';
  assert.deepEqual(metadata(h.contents.get(first)), { date: now, draft: false });
  assert.deepEqual(metadata(h.contents.get(second)), { date: now, draft: false, link: 'https://example.com/', linkTitle: '제목' });
  assert.match(h.contents.get(first), /^---\ndate: "2026-10-28T03:04:05.006Z"\n/);
  assert.deepEqual(h.opened.map(file => file.path), [first, second]);
  assert.ok(h.files.has('shorts'));
  assert.equal(h.contents.get(timestampPath), '기존 파일');
  assert.equal(h.writes.length, 0);
});

test('short creation rejects empty content, unsafe links and folder blockers without poisoning the queue', async () => {
  const h = await harness(undefined, {}, { now });
  h.ready();
  for (const input of [{ body: '' }, { body: 'ok', link: 'javascript:alert(1)' }, { body: '', link: 'https://user:pass@example.com/' }, { body: 'ok', linkTitle: '제목' }]) {
    await assert.rejects(h.plugin.createShort(input));
  }
  assert.equal(h.contents.size, 0);
  await h.plugin.createShort({ body: '', link: 'https://example.com/', linkTitle: ' ' });
  await h.drain();
  assert.deepEqual(metadata(h.contents.get(timestampPath)), { date: now, draft: true, link: 'https://example.com/' });
  const blocked = await harness(undefined, { shorts: '폴더 자리에 파일' }, { now });
  await assert.rejects(blocked.plugin.createShort({ body: '메모' }), /폴더 위치에 파일/);
});

test('an external writer claiming a timestamp is retained and the next filename is used', async () => {
  const h = await harness(undefined, {}, { now });
  const original = h.vault.create;
  let raced = false;
  h.vault.create = async (path, content) => {
    if (!raced) {
      raced = true;
      await original(path, '외부에서 만든 파일');
      throw new Error('File already exists');
    }
    return original(path, content);
  };
  await h.plugin.createShort({ body: '내 메모' });
  assert.equal(h.contents.get(timestampPath), '외부에서 만든 파일');
  assert.deepEqual(metadata(h.contents.get('shorts/2026-10-28T03-04-05-006Z-2.md')), { date: now, draft: true });
});

test('short YAML errors remain intact, article slug scans ignore them, and unload stops queued creation', async () => {
  const h = await harness(undefined, {}, { now });
  h.ready();
  const broken = '---\ndate: [unfinished\n---\n메모';
  await h.vault.create('shorts/broken.md', broken);
  await h.drain();
  assert.equal(h.contents.get('shorts/broken.md'), broken);
  assert.match(h.notices.at(-1), /shorts\/broken.md.*YAML/);
  await h.plugin.createPost('정상 글');
  await h.plugin.createShort({ body: '정상 메모' });
  await h.drain();
  assert.ok(h.contents.has('posts/정상 글.md'));
  assert.ok(h.contents.has(timestampPath));
  h.plugin.onunload();
  await h.plugin.createShort({ body: '종료 뒤 메모' });
  assert.equal(h.contents.has('shorts/2026-10-28T03-04-05-006Z-2.md'), false);
});

test('article-folder overlap is rejected in settings and old invalid data falls back without saving', async () => {
  const h = await harness({ targetFolder: 'shorts/nested', autoAdd: false, defaultTags: ['kept'], draft: false });
  assert.equal(h.plugin.settings.targetFolder, 'posts');
  assert.equal(h.plugin.saved, undefined);
  assert.equal(h.plugin.settings.autoAdd, false);
  assert.equal(h.plugin.settings.draft, false);
  assert.deepEqual(Array.from(h.plugin.settings.defaultTags), ['kept']);
  assert.match(h.notices[0], /shorts.*겹칠 수 없습니다/);
  for (const targetFolder of ['shorts', 'shorts/nested', 'SHORTS']) await assert.rejects(h.plugin.updateSettings({ targetFolder }), /shorts/);
  assert.equal(h.plugin.settings.targetFolder, 'posts');
  h.plugin.tabs[0].display();
  const folder = h.controls.find(control => control.name === '글 폴더');
  await folder.text.change('shorts');
  assert.equal(folder.text.inputEl.attrs.get('aria-invalid'), 'true');
  assert.match(folder.description, /shorts/);
  await h.plugin.updateSettings({ targetFolder: 'blog/posts' });
  assert.equal(h.plugin.settings.targetFolder, 'blog/posts');
});

test('new-short modal validates errors, keeps input, and creates link-only shorts successfully', async () => {
  const h = await harness(undefined, {}, { now });
  h.ready();
  const ui = shortModal(h);
  assert.equal(ui.modal.isOpen, true);
  assert.equal(ui.body.inputEl.focused, true);
  await ui.submit.click();
  assert.match(ui.error.text, /본문 또는 링크/);
  assert.equal(ui.modal.isOpen, true);
  assert.equal(ui.submit.disabled, false);
  await ui.link.change('https://user:pass@example.com');
  await ui.submit.click();
  assert.match(ui.error.text, /사용자 이름과 비밀번호/);
  await ui.link.change(' https://example.com/article ');
  await ui.title.change(' 직접 제목 ');
  await ui.submit.click();
  await h.drain();
  assert.equal(ui.modal.isOpen, false);
  assert.deepEqual(metadata(h.contents.get(timestampPath)), { date: now, draft: true, link: 'https://example.com/article', linkTitle: '직접 제목' });
});

test('new-short modal shortcut is IME-safe and guards duplicate submission while saving', async () => {
  const h = await harness();
  const ui = shortModal(h);
  let complete;
  let calls = 0;
  h.plugin.createShort = () => { calls++; return new Promise(resolve => { complete = resolve; }); };
  ui.body.inputEl.dispatch('keydown', { key: 'Enter', ctrlKey: true, isComposing: true });
  ui.body.inputEl.dispatch('keydown', { key: 'Enter' });
  assert.equal(calls, 0);
  const event = ui.body.inputEl.dispatch('keydown', { key: 'Enter', metaKey: true, isComposing: false });
  assert.equal(event.defaultPrevented, true);
  assert.equal(ui.submit.disabled, true);
  ui.link.inputEl.dispatch('keydown', { key: 'Enter', ctrlKey: true });
  await ui.submit.click();
  assert.equal(calls, 1);
  complete();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.modal.isOpen, false);
  assert.equal(ui.submit.disabled, false);
  const cancelled = shortModal(h);
  cancelled.cancel.click();
  assert.equal(cancelled.modal.isOpen, false);
  assert.equal(calls, 1);
});
