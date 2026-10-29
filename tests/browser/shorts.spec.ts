import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('short feed renders full entries in chronological order with fragment and external links', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('/shorts');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('짧은 글 5');
  const entries = page.getByRole('list', { name: '짧은 글 목록' }).locator('article');
  await expect(entries).toHaveCount(5);
  await expect(entries.first()).toContainText('API를 작게 유지하는 가장 좋은 기준');
  await expect(entries.last()).toContainText('Learn Accessibility');
  await page.evaluate(() => document.fonts.ready);
  const paragraph = entries.first().locator('p').filter({ hasText: '함께 읽기:' });
  const cache = paragraph.getByRole('link', { name: '캐시', exact: true });
  const math = paragraph.getByRole('link', { name: '수식', exact: true });
  await expect(cache).toHaveAttribute('href', '/posts/http-cache');
  await expect(math).toHaveAttribute('href', '/posts/gradient-descent');
  const [first, second] = await Promise.all([cache.boundingBox(), math.boundingBox()]);
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(second!.x - first!.x - first!.width).toBeGreaterThanOrEqual(3);
  expect(second!.y).toBe(first!.y);
  expect(await entries.locator('time').evaluateAll(times => times.map(time => time.getAttribute('datetime')))).toEqual([
    '2026-10-28T17:30:00+09:00', '2026-10-27T12:10:00+09:00', '2026-10-26', '2026-10-25T09:20:00+09:00', '2026-10-24',
  ]);
  const id = await entries.first().getAttribute('id');
  await entries.first().getByRole('link', { name: /글 링크$/ }).click();
  await expect(page).toHaveURL(new RegExp(`/shorts#${id}$`));
  const external = entries.nth(1).getByRole('link', { name: /View Transition API/ });
  await expect(external).toHaveAttribute('href', 'https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API');
  await expect(external).toHaveAttribute('target', '_blank');
  await expect(external).toHaveAttribute('rel', 'noopener noreferrer');
  const staticHtml = await (await request.get('/shorts')).text();
  expect(staticHtml).toContain('API를 작게 유지하는 가장 좋은 기준');
  expect(staticHtml).toContain('브라우저가 제공하는 기능만으로');
  expect(staticHtml).not.toContain('draft-short-secret');
  expect(staticHtml).toContain('https://blog.soohyuk.dev/shorts');
  expect((await request.get(`/shorts/${id}`)).status()).toBe(404);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('short feed is reachable through desktop and mobile navigation', async ({ page }, testInfo) => {
  await page.goto('/');
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: '폴더 탐색 메뉴 열기' }).click();
  await page.getByRole('link', { name: '짧은 글', exact: true }).click();
  await expect(page).toHaveURL(/\/shorts$/);
  await expect(page.getByRole('list', { name: '짧은 글 목록' })).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('짧은 글 5');
});

test('home shows the latest three shorts and opens the full feed with normal or reduced motion', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/');
    const section = page.locator('section[aria-labelledby="home-shorts-heading"]');
    const disclosure = section.locator('details');
    if (testInfo.project.name === 'mobile') {
      await expect(disclosure).not.toHaveAttribute('open');
      await section.locator('summary').click();
    }
    await expect(disclosure).toHaveAttribute('open', '');
    const entries = section.getByRole('list', { name: '최근 짧은 글 목록', exact: true }).locator('article');
    await expect(entries).toHaveCount(3);
    await expect(section.getByRole('heading', { level: 1 })).toHaveText('짧은 글 5');
    await expect(page.getByRole('heading', { level: 2, name: /최근 글/ })).toBeVisible();
    expect(await entries.locator('time').evaluateAll(times => times.map(time => time.getAttribute('datetime')))).toEqual([
      '2026-10-28T17:30:00+09:00', '2026-10-27T12:10:00+09:00', '2026-10-26',
    ]);
    const dateLink = entries.first().getByRole('link', { name: /글 링크$/ });
    const destination = await dateLink.getAttribute('href');
    expect(destination).toMatch(/^\/shorts#short-/);
    const more = section.getByRole('link', { name: '더 읽기', exact: true });
    await expect(more).toHaveAttribute('href', '/shorts');
    await more.click();
    await expect(page).toHaveURL(/\/shorts$/);
    await expect(page.getByRole('list', { name: '짧은 글 목록', exact: true }).locator('article')).toHaveCount(5);
    await page.goBack();
    if (testInfo.project.name === 'mobile') {
      await expect(disclosure).not.toHaveAttribute('open');
      await section.locator('summary').click();
    }
    await expect(disclosure).toHaveAttribute('open', '');
    await expect(entries).toHaveCount(3);
    await entries.first().getByRole('link', { name: /글 링크$/ }).click();
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
    await expect(page.getByRole('list', { name: '짧은 글 목록', exact: true }).locator('article')).toHaveCount(5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('home shorts start collapsed on mobile and share the desktop viewport without pushing more links away', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const section = page.locator('section[aria-labelledby="home-shorts-heading"]');
  const disclosure = section.locator('details');
  const summary = section.locator('summary');
  const recent = page.getByRole('heading', { name: /최근 글/, level: 2 });
  const region = section.getByRole('region', { name: '최근 짧은 글', exact: true });
  const more = section.getByRole('link', { name: '더 읽기', exact: true });
  await expect(recent).toBeVisible();
  if (testInfo.project.name === 'mobile') {
    await expect(disclosure).not.toHaveAttribute('open');
    await expect(region).not.toBeVisible();
    const initial = await recent.boundingBox();
    expect(initial!.y).toBeLessThan(page.viewportSize()!.height / 2);
    await summary.click();
  } else {
    await expect(disclosure).toHaveAttribute('open', '');
    const initial = await recent.boundingBox();
    expect(Math.abs(initial!.y - page.viewportSize()!.height / 2)).toBeLessThanOrEqual(40);
    const before = await more.boundingBox();
    expect(before!.y + before!.height).toBeLessThanOrEqual(initial!.y);
    expect(before!.y + before!.height).toBeLessThan(page.viewportSize()!.height);
    await region.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect.poll(() => region.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await more.boundingBox()).toEqual(before);
  }
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(region).toBeVisible();
  const expanded = await recent.boundingBox();
  await summary.click();
  await expect(disclosure).not.toHaveAttribute('open');
  const collapsed = await recent.boundingBox();
  expect(collapsed!.y).toBeLessThan(expanded!.y);
  await summary.press('Enter');
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(region).toBeVisible();
  await summary.press('Space');
  await expect(disclosure).not.toHaveAttribute('open');
  await summary.press('Enter');
  await expect(disclosure).toHaveAttribute('open', '');
});

test('short body images load from local static assets and remain in prerendered HTML', async ({ page, request }) => {
  await page.goto('/shorts');
  const image = page.getByRole('list', { name: '짧은 글 목록', exact: true }).getByRole('img', { name: 'HTTP 캐시 흐름도', exact: true });
  await expect(image).toBeVisible();
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(image).toHaveAttribute('src', '/content-assets/web/images/cache-flow.svg');
  await expect(image).toHaveAttribute('loading', 'lazy');
  await expect(image).toHaveAttribute('decoding', 'async');
  const asset = await request.get('/content-assets/web/images/cache-flow.svg');
  expect(asset.status()).toBe(200);
  expect(asset.headers()['content-type']).toContain('image/svg+xml');
  expect(await asset.text()).toContain('<svg');
  const staticFeed = await (await request.get('/shorts')).text();
  expect(staticFeed).toContain('src="/content-assets/web/images/cache-flow.svg" alt="HTTP 캐시 흐름도"');
  const staticHome = await (await request.get('/')).text();
  expect(staticHome).toContain('src="/content-assets/web/images/cache-flow.svg" alt="HTTP 캐시 흐름도"');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('build-time previews show local images, metadata fallbacks, and recover from a failed image', async ({ page, request }) => {
  const externalRequests: string[] = [];
  page.on('request', event => { if (new URL(event.url()).hostname !== '127.0.0.1') externalRequests.push(event.url()); });
  await page.goto('/shorts');
  const imageCard = page.getByRole('link', { name: /View Transition API · MDN/ });
  const image = imageCard.locator('img');
  await expect(image).toBeVisible();
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(image).toHaveAttribute('src', /^\/short-previews\/[a-f0-9]{64}\.webp$/);
  await expect(imageCard).toContainText('브라우저의 화면 전환을 자연스럽게 연결하는 API');
  const withoutImage = page.getByRole('link', { name: /Learn Accessibility · web.dev/ });
  await expect(withoutImage).toContainText('접근성의 기본 원칙부터');
  await expect(withoutImage.locator('img')).toHaveCount(0);
  const plainLink = page.locator('main a[href*="consistent-date-formatting-across-time-zones"]');
  await expect(plainLink).toContainText('https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat');
  await expect(plainLink.locator('img')).toHaveCount(0);
  const staticHtml = await (await request.get('/shorts')).text();
  expect(staticHtml).toContain('브라우저의 화면 전환을 자연스럽게 연결하는 API');
  expect(staticHtml).toContain('/short-previews/');
  expect(externalRequests).toEqual([]);
  await page.route('**/short-previews/*.webp', route => route.fulfill({ status: 404, body: '' }));
  await page.reload();
  await page.getByRole('link', { name: /View Transition API · MDN/ }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('link', { name: /View Transition API · MDN/ }).locator('img')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /View Transition API · MDN/ })).toContainText('브라우저의 화면 전환을 자연스럽게 연결하는 API');
});

test('short feed is readable without JavaScript and remains accessible in both themes', async ({ browser, page }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: testInfo.project.use.viewport });
  const staticPage = await context.newPage();
  await staticPage.goto('http://127.0.0.1:4173/shorts');
  await expect(staticPage.getByRole('list', { name: '짧은 글 목록' }).locator('article')).toHaveCount(5);
  await expect(staticPage.getByRole('link', { name: /View Transition API/ })).toHaveAttribute('href', /developer.mozilla.org/);
  await expect(staticPage.getByRole('link', { name: '타입에 남겨둔 기록' })).toHaveAttribute('href', '/posts/typescript-discriminated-unions');
  expect(await staticPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await staticPage.goto('http://127.0.0.1:4173/');
  const section = staticPage.locator('section[aria-labelledby="home-shorts-heading"]');
  await expect(section.locator('details')).not.toHaveAttribute('open');
  await expect(section.getByRole('list', { name: '최근 짧은 글 목록', exact: true })).not.toBeVisible();
  await section.locator('summary').click();
  await expect(section.locator('details')).toHaveAttribute('open', '');
  await expect(section.getByRole('list', { name: '최근 짧은 글 목록', exact: true }).locator('article')).toHaveCount(3);
  await context.close();
  for (const theme of ['light', 'dark']) {
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    await page.goto('/shorts');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const accessibility = await new AxeBuilder({ page }).include('main').analyze();
    expect(accessibility.violations).toEqual([]);
  }
});
