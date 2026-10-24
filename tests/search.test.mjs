import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPosts } from '../app/lib/search.ts';

const entries = [
  { slug: 'body', title: '기록', tags: ['기록'], description: '', text: 'HTTP cache와 한글 검색', date: '2026-10-16' },
  { slug: 'title', title: 'HTTP cache', tags: ['web'], description: '', text: '설명', date: '2026-10-10' },
  { slug: 'tag', title: '요청', tags: ['HTTP'], description: '', text: 'cache', date: '2026-10-12' },
];

test('all tokens must match and title matches outrank newer body-only matches', () => {
  assert.deepEqual(searchPosts(entries, 'http cache').map(post => post.slug), ['title', 'tag', 'body']);
  assert.equal(searchPosts(entries, 'http missing').length, 0);
});

test('search supports Korean, Unicode normalization, case folding, and empty input', () => {
  assert.equal(searchPosts(entries, '한글'.normalize('NFD'))[0].slug, 'body');
  assert.equal(searchPosts(entries, 'HTTP')[0].slug, 'title');
  assert.deepEqual(searchPosts(entries, '  '), []);
});

const { searchExcerpt } = await import('../app/lib/search.ts');
const excerptText = parts => parts.map(part => part.text).join('');
for (const position of ['start', 'middle', 'end']) {
  test(`body excerpt includes a match at the ${position}`, () => {
    const text = position === 'start' ? `MATCH ${'a'.repeat(200)}` : position === 'end' ? `${'a'.repeat(200)} MATCH` : `${'a'.repeat(200)} MATCH ${'b'.repeat(200)}`;
    const parts = searchExcerpt(text, 'match');
    assert.deepEqual(parts.filter(part => part.matched).map(part => part.text), ['MATCH']);
    const excerpt = excerptText(parts);
    assert.equal(excerpt.startsWith('…'), position !== 'start');
    assert.equal(excerpt.endsWith('…'), position !== 'end');
    assert.ok(excerpt.length <= 122);
  });
}
test('excerpt marks multiple literal tokens and preserves case', () => {
  const parts = searchExcerpt('HTTP cache uses C++ and http.', 'http cache C++');
  assert.deepEqual(parts.filter(part => part.matched).map(part => part.text), ['HTTP', 'cache', 'C++', 'http']);
});
test('excerpt supports normalized Korean text', () => {
  const parts = searchExcerpt('한글 본문 검색을 지원합니다.'.normalize('NFD'), '본문 검색'.normalize('NFD'));
  assert.equal(excerptText(parts), '한글 본문 검색을 지원합니다.');
  assert.deepEqual(parts.filter(part => part.matched).map(part => part.text), ['본문', '검색']);
});
test('excerpt returns null for no body match or empty query', () => {
  assert.equal(searchExcerpt('본문 내용', '제목'), null);
  assert.equal(searchExcerpt('본문 내용', '  '), null);
});
