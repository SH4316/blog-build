import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseShort, buildShorts } from '../../../scripts/shorts.mjs';
import { harness } from '../harness.mjs';

const now = '2026-10-28T03:04:05.006Z';

test('plugin-created body/link shorts match the blog parser without article-only properties', async () => {
  const h = await harness({ draft: false, defaultTags: ['article-only'] }, {}, { now });
  const inputs = [
    { body: '짧은 **메모**' },
    { body: '', link: ' https://example.com/article ', linkTitle: ' 직접 제목 ' },
    { body: '링크와 메모', link: 'https://example.com/second' },
  ];
  for (const input of inputs) await h.plugin.createShort(input);
  for (const file of h.opened) {
    const entry = parseShort(h.contents.get(file.path), file.path.slice('shorts/'.length));
    assert.equal(entry.date, now);
    assert.equal(entry.draft, false);
    assert.ok(entry.body || entry.link);
    assert.equal('title' in entry, false);
    assert.equal('slug' in entry, false);
    assert.equal('tags' in entry, false);
  }
  const linked = parseShort(h.contents.get(h.opened[1].path), 'link-only.md');
  assert.equal(linked.link, 'https://example.com/article');
  assert.equal(linked.linkTitle, '직접 제목');
});

test('blank automatic drafts parse and remain excluded from the blog build and preview resolution', async () => {
  const h = await harness(undefined, {}, { now });
  h.ready();
  await h.vault.create('shorts/unfinished.md', '');
  await h.plugin.createShort({ body: '', link: 'https://example.com/draft' });
  await h.drain();
  const blank = parseShort(h.contents.get('shorts/unfinished.md'), 'unfinished.md');
  assert.equal(blank.draft, true);
  assert.equal(blank.body, '');
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'obsidian-short-compat-'));
  try {
    await mkdir(path.join(temporary, 'shorts'));
    for (const [file, content] of h.contents) await writeFile(path.join(temporary, file), content);
    let previewCalls = 0;
    const entries = await buildShorts(temporary, { previewResolver: async () => { previewCalls++; throw new Error('Draft metadata must not be fetched'); } });
    assert.deepEqual(entries, []);
    assert.equal(previewCalls, 0);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
