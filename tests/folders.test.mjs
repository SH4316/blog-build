import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { matchRoutes } from 'react-router';
import { createServer } from 'vite';

const posts = [
  { slug: 'ai-post', folder: 'AI' },
  { slug: 'code-quality', folder: 'Dev/Methodology' },
  { slug: 'notes', folder: '한글 폴더' },
];
const fixtures = {
  '../generated/catalog.json': {
    posts, folders: ['AI', 'Dev', 'Dev/Methodology', '한글 폴더'], tags: [],
  },
  '../generated/articles.json': {},
  '../generated/shorts.json': [],
};
const contentModule = fileURLToPath(new URL('../app/lib/content.server.ts', import.meta.url));
// Load the server module through Vite with isolated content, without generated files or a sync.
const fixturePrefix = '\0folder-test:';
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false, watch: null },
  plugins: [{
    name: 'folder-test-content',
    enforce: 'pre',
    resolveId(source, importer) {
      if (importer === contentModule && Object.hasOwn(fixtures, source)) return fixturePrefix + source;
    },
    load(id) {
      if (id.startsWith(fixturePrefix)) return JSON.stringify(fixtures[id.slice(fixturePrefix.length)]);
    },
  }],
});
after(() => server.close());
const { getFolder } = await server.ssrLoadModule(contentModule);
const loadFolder = pathname => {
  const [{ params }] = matchRoutes([{ path: 'folders/*' }], pathname);
  return getFolder(params['*'] || '');
};

for (const { folder, slugs, children } of [
  { folder: '', slugs: ['ai-post', 'code-quality', 'notes'], children: ['AI', 'Dev', '한글 폴더'] },
  { folder: 'AI', slugs: ['ai-post'], children: [] },
  { folder: 'Dev', slugs: ['code-quality'], children: ['Dev/Methodology'] },
  { folder: 'Dev/Methodology', slugs: ['code-quality'], children: [] },
  { folder: '한글 폴더', slugs: ['notes'], children: [] },
]) {
  test(`folder ${folder || '(root)'} resolves with and without a trailing slash`, () => {
    const pathname = `/folders${folder ? '/' + folder.split('/').map(encodeURIComponent).join('/') : ''}`;
    for (const suffix of ['', '/']) {
      const result = loadFolder(pathname + suffix);
      assert.equal(result.folder, folder);
      assert.deepEqual(result.posts.map(post => post.slug), slugs);
      assert.deepEqual(result.children, children);
    }
  });
}

test('unknown folders still return 404, including paths with trailing slashes', () => {
  for (const pathname of ['/folders/missing', '/folders/missing/', '/folders/AI/missing/', '/folders/ai/', '/folders/Dev//Methodology/']) {
    assert.throws(() => loadFolder(pathname), error => error instanceof Response && error.status === 404);
  }
});
