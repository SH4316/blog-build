import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { createShortPreviewResolver } from '../../scripts/short-previews.mjs';

// These public URLs are resolved entirely by an injected transport. No local
// address exception or production URL-policy bypass is needed for browser tests.
export async function fixturePreviewResolver() {
  const png = await sharp(await readFile(new URL('./content-repo/posts/web/images/cache-flow.svg', import.meta.url))).png().toBuffer();
  const imageUrl = 'https://developer.mozilla.org/preview-fixture.png';
  const responses = new Map([
    ['https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API', {
      status: 200, headers: { 'content-type': 'text/html; charset=utf-8' },
      body: Buffer.from(`<title>Remote fallback title</title><meta property="og:title" content="View Transition API"><meta property="og:description" content="브라우저의 화면 전환을 자연스럽게 연결하는 API를 살펴봅니다. 전환 상태와 접근성, 점진적 개선을 함께 다루는 문서입니다."><meta property="og:image" content="${imageUrl}">`),
    }],
    [imageUrl, { status: 200, headers: { 'content-type': 'image/png' }, body: png }],
    ['https://web.dev/learn/accessibility/', {
      status: 200, headers: { 'content-type': 'text/html' },
      body: Buffer.from('<meta name="twitter:title" content="Learn Accessibility · web.dev"><meta name="description" content="접근성의 기본 원칙부터 키보드와 보조 기술을 위한 인터페이스까지 차근차근 읽어볼 자료입니다."><meta name="twitter:image" content="/missing-preview-image.png">'),
    }],
    ['https://web.dev/missing-preview-image.png', { status: 404, headers: {}, body: Buffer.alloc(0) }],
  ]);
  return createShortPreviewResolver({
    resolveHost: async () => [{ address: '93.184.216.34', family: 4 }],
    request: async url => {
      const response = responses.get(url.href);
      if (!response) throw new Error('Fixture metadata request unavailable');
      return response;
    },
  });
}
