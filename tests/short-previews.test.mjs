import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { createShortPreviewResolver, isPublicAddress, parsePreviewMetadata } from '../scripts/short-previews.mjs';
import { buildCatalog, projectDir, writeContent } from '../scripts/content.mjs';

const origin = 'https://example.com';
const htmlResponse = body => ({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: Buffer.from(body) });
const publicDns = async () => [{ address: '93.184.216.34', family: 4 }];
const image = () => sharp({ create: { width: 1440, height: 760, channels: 3, background: '#b9cfe5' } }).png().toBuffer();
function resolver(routes, options = {}) {
  const calls = [];
  const instance = createShortPreviewResolver({
    resolveHost: publicDns,
    request: async (url, connection) => {
      calls.push({ url: url.href, ...connection });
      const response = routes[url.href];
      if (response instanceof Error || !response) throw response || new Error('No fake response');
      return typeof response === 'function' ? response(url, connection) : response;
    },
    ...options,
  });
  return { ...instance, calls };
}

test('HTML metadata parser handles entities, malformed HTML, scripts, and metadata precedence', () => {
  const parsed = parsePreviewMetadata(`<!doctype html><head>
    <script>const fake = '<meta property="og:title" content="wrong">';</script>
    <title>Fallback &amp; title</title>
    <META CONTENT='Open &amp; "quoted" title > text' PROPERTY=og:title>
    <meta property="og:title" content="duplicate ignored">
    <meta name="twitter:title" content="Twitter title">
    <meta name="description" content="ordinary description">
    <meta name="twitter:description" content="Twitter description">
    <meta property="og:description" content="  Korean 한글\n description  ">
    <meta property="og:image" content="../cover.png?one=1&amp;two=2">
    </head><body><meta property="og:title" content="body ignored">`, `${origin}/articles/one`);
  assert.deepEqual(parsed, {
    title: 'Open & "quoted" title > text', description: 'Korean 한글 description', image: `${origin}/cover.png?one=1&two=2`,
  });
  assert.deepEqual(parsePreviewMetadata('<title>Page &amp; title</title><meta name=description content="A plain description">', origin), {
    title: 'Page & title', description: 'A plain description', image: null,
  });
  assert.deepEqual(parsePreviewMetadata('<meta name=twitter:title content="Twitter"><meta name=twitter:image content="/twitter.png">', origin), {
    title: 'Twitter', description: null, image: `${origin}/twitter.png`,
  });
  const based = parsePreviewMetadata('<base href="https://cdn.example.com/assets/"><base href="https://wrong.example.com/"><meta property="og:image" content="cover.png">', origin);
  assert.equal(based.image, 'https://cdn.example.com/assets/cover.png');
  assert.equal(parsePreviewMetadata(`<meta property="og:title" content="${'a'.repeat(500)}">`, origin).title.length, 200);
});

test('public destination policy denies local, reserved, mapped, multicast, and documentation addresses', () => {
  for (const address of ['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111', '2001:4860:4860::8888']) assert.equal(isPublicAddress(address), true, address);
  for (const address of ['0.0.0.0', '10.0.0.1', '100.64.1.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.0.1', '192.0.0.9', '192.0.2.1', '192.88.99.1', '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255', '::', '::1', '::ffff:127.0.0.1', '::ffff:8.8.8.8', '64:ff9b::a00:1', 'fc00::1', 'fe80::1', 'ff02::1', '2001::1', '2001:db8::1', '2002:0808:0808::1', '3fff::1', 'not-an-ip']) assert.equal(isPublicAddress(address), false, address);
});

test('metadata requests reject unsafe URLs and mixed DNS answers before sending any request', async () => {
  const denied = resolver({});
  for (const url of ['file:///etc/passwd', 'http://localhost/', 'http://service.internal/', 'http://127.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://[::1]/', 'https://user:secret@example.com/', 'https://example.com:8080/', 'https://test.invalid/']) assert.equal(await denied.resolve(url), null);
  assert.equal(denied.calls.length, 0);
  const mixed = resolver({ [origin + '/']: htmlResponse('<title>Must not fetch</title>') }, {
    resolveHost: async () => [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }],
  });
  assert.equal(await mixed.resolve(origin), null);
  assert.equal(mixed.calls.length, 0);
});

test('redirect destinations and image destinations receive their own DNS validation', async () => {
  const redirects = resolver({ [origin + '/']: { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' }, body: Buffer.alloc(0) } });
  assert.equal(await redirects.resolve(origin), null);
  assert.equal(redirects.calls.length, 1);
  const images = resolver({ [origin + '/']: htmlResponse('<meta property="og:title" content="Keep this title"><meta property="og:image" content="https://private.example.com/image.png">') }, {
    resolveHost: async hostname => [{ address: hostname.startsWith('private.') ? '192.168.1.1' : '93.184.216.34', family: 4 }],
  });
  assert.deepEqual(await images.resolve(origin), { title: 'Keep this title', description: null, image: null });
  assert.equal(images.calls.length, 1);
});

test('safe redirects use the final base URL and pin one validated address without a second DNS lookup', async () => {
  const lookups = [];
  const instance = resolver({
    [origin + '/start']: { status: 301, headers: { location: '/docs/final' }, body: Buffer.alloc(0) },
    [origin + '/docs/final']: htmlResponse('<title>Final page</title><meta property="og:image" content="cover.png">'),
    [origin + '/docs/cover.png']: new Error('image unavailable'),
  }, { resolveHost: async hostname => { lookups.push(hostname); return [{ address: '93.184.216.34', family: 4 }]; } });
  assert.deepEqual(await instance.resolve(origin + '/start'), { title: 'Final page', description: null, image: null });
  assert.equal(lookups.length, 3);
  assert.ok(instance.calls.every(call => call.address === '93.184.216.34' && call.family === 4));
});

test('document/image caches deduplicate URLs, strip fragments, resize raster images, and produce local hash assets', async () => {
  const bytes = await image();
  const html = '<meta property="og:title" content="Preview"><meta property="og:description" content="Description"><meta property="og:image" content="https://cdn.example.com/cover.png">';
  const instance = resolver({
    [origin + '/one']: htmlResponse(html), [origin + '/two']: htmlResponse(html),
    'https://cdn.example.com/cover.png': { status: 200, headers: { 'content-type': 'image/png' }, body: bytes },
  });
  const results = await Promise.all([instance.resolve(origin + '/one#one'), instance.resolve(origin + '/one#two'), instance.resolve(origin + '/two')]);
  assert.deepEqual(results[0], results[1]);
  assert.equal(results[0].image, results[2].image);
  assert.match(results[0].image, /^\/short-previews\/[a-f0-9]{64}\.webp$/);
  assert.equal(instance.calls.length, 3);
  assert.equal(instance.assets.size, 1);
  const output = await sharp([...instance.assets.values()][0]).metadata();
  assert.equal(output.format, 'webp');
  assert.equal(output.width, 1200);
  assert.ok(output.height <= 800);
});

test('unavailable, oversized, non-HTML, compressed, endlessly redirected, and timed-out pages degrade to ordinary links', async () => {
  const cases = [
    new Error('network failed'),
    { status: 503, headers: {}, body: Buffer.alloc(0) },
    { status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.alloc(2 * 1024 * 1024 + 1) },
    { status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from('{}') },
    { status: 200, headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' }, body: Buffer.from('compressed') },
    { status: 302, headers: { location: '/' }, body: Buffer.alloc(0) },
  ];
  for (const response of cases) {
    const instance = resolver({ [origin + '/']: response });
    assert.equal(await instance.resolve(origin), null);
    assert.ok(instance.calls.length <= 5);
  }
  const timed = resolver({ [origin + '/']: async () => { await new Promise(resolve => setTimeout(resolve, 30)); return htmlResponse('<title>Too late</title>'); } }, { timeoutMs: 5 });
  assert.equal(await timed.resolve(origin), null);
  const failedDns = resolver({}, { resolveHost: async () => { throw new Error('DNS error'); } });
  assert.equal(await failedDns.resolve(origin), null);
});

test('a shared image request never extends an earlier document deadline', async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).png().toBuffer();
  const html = '<title>Title survives</title><meta property="og:image" content="https://cdn.example.com/shared.png">';
  const instance = resolver({
    [origin + '/early']: async () => { await new Promise(resolve => setTimeout(resolve, 350)); return htmlResponse(html); },
    [origin + '/later']: htmlResponse(html),
    'https://cdn.example.com/shared.png': async () => { await new Promise(resolve => setTimeout(resolve, 300)); return { status: 200, headers: { 'content-type': 'image/png' }, body: png }; },
  }, { timeoutMs: 500 });
  const early = instance.resolve(origin + '/early');
  await new Promise(resolve => setTimeout(resolve, 250));
  const later = instance.resolve(origin + '/later');
  assert.deepEqual(await early, { title: 'Title survives', description: null, image: null });
  assert.match((await later).image, /^\/short-previews\//);
});

test('missing images, SVG, false MIME/signatures, oversized images, and huge dimensions preserve text metadata', async () => {
  const oversizedDimensions = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: 'white' } }).png().toBuffer();
  for (const response of [
    new Error('missing image'),
    { status: 404, headers: {}, body: Buffer.alloc(0) },
    { status: 200, headers: { 'content-type': 'image/svg+xml' }, body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') },
    { status: 200, headers: { 'content-type': 'image/png' }, body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') },
    { status: 200, headers: { 'content-type': 'image/png' }, body: Buffer.alloc(4 * 1024 * 1024 + 1) },
    { status: 200, headers: { 'content-type': 'image/png' }, body: oversizedDimensions },
  ]) {
    const instance = resolver({ [origin + '/']: htmlResponse('<title>Text survives</title><meta property="og:image" content="/image.png">'), [origin + '/image.png']: response });
    assert.deepEqual(await instance.resolve(origin), { title: 'Text survives', description: null, image: null });
    assert.equal(instance.assets.size, 0);
  }
});

test('generated previews stay separate from article data and only referenced image assets are written and refreshed', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'blog-preview-content-'));
  const output = await mkdtemp(path.join(tmpdir(), 'blog-preview-output-'));
  t.after(() => Promise.all([rm(root, { recursive: true, force: true }), rm(output, { recursive: true, force: true })]));
  await mkdir(path.join(root, 'posts'));
  await mkdir(path.join(root, 'shorts'));
  await writeFile(path.join(root, 'shorts/link.md'), '---\ndate: "2026-10-28"\nlink: "https://example.com"\nlinkTitle: "Author title wins"\n---\n본문');
  const previewResolver = resolver({ [origin + '/']: htmlResponse('<title>Remote title</title><meta property="og:image" content="/cover.png">'), [origin + '/cover.png']: { status: 200, headers: { 'content-type': 'image/png' }, body: await image() } });
  previewResolver.assets.set(`${'0'.repeat(64)}.webp`, Buffer.from('unused cached image'));
  const result = await buildCatalog(root, { previewResolver });
  assert.equal(result.shorts[0].linkTitle, 'Author title wins');
  assert.equal(result.shorts[0].preview.title, 'Remote title');
  assert.equal(result.shortPreviewAssets.size, 1);
  assert.deepEqual(result.catalog.posts, []);
  assert.deepEqual(result.searchIndex, []);
  await writeContent(result, output);
  const asset = path.join(output, '.cache/public', result.shorts[0].preview.image);
  await access(asset);
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'app/generated/shorts.json'), 'utf8')), result.shorts);
  await rm(path.join(root, 'shorts/link.md'));
  await writeContent(await buildCatalog(root), output);
  await assert.rejects(access(asset), { code: 'ENOENT' });
});
