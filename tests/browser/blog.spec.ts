import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('static articles load directly, survive refresh, and keep code and math in HTML', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('/posts/gradient-descent');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('경사하강법을 수식과 코드로 따라가기');
  await expect(page.locator('article .katex-display').first()).toBeVisible();
  await expect(page.locator('article pre code')).toContainText('gradient_descent');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const staticResponse = await request.get('/posts/gradient-descent');
  expect(await staticResponse.text()).toContain('application/ld+json');
  expect(await staticResponse.text()).toContain('katex-display');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('folders, article links, Unicode slugs, and tags navigate correctly', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/folders/react/typescript');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('typescript');
  await page.locator('main').getByRole('link', { name: '불가능한 상태를 줄이는 TypeScript 타입' }).click();
  await expect(page).toHaveURL(/\/posts\/typescript-discriminated-unions$/);
  await page.locator('article header').getByRole('link', { name: '#TypeScript' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('#TypeScript');
  await page.goto('/posts/git-worktree');
  await page.locator('article').getByRole('link', { name: '연결된 기록' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('작은 기록들을 연결하는 방법');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test('full-text search supports Korean, query URLs, clearing, and empty results', async ({ page }) => {
  await page.goto('/search?q=Cache-Control');
  await expect(page.locator('main').getByRole('link', { name: 'HTTP 캐시를 이해하는 두 가지 질문' })).toBeVisible();
  await page.getByRole('searchbox').fill('불가능한 상태');
  await expect(page.locator('main').getByRole('link', { name: '불가능한 상태를 줄이는 TypeScript 타입' })).toBeVisible();
  await page.getByRole('searchbox').fill('존재하지않는검색어');
  await expect(page.getByText('다른 키워드로 검색해보세요.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '검색어 지우기' }).click();
  await expect(page.getByRole('heading', { name: '태그로 둘러보기' })).toBeVisible();
});

test('search recovers from an index download error', async ({ page }) => {
  await page.route('**/search-index.json', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto('/search?q=HTTP');
  await expect(page.getByRole('alert')).toContainText('검색 데이터를 불러오지 못했습니다.');
  await page.unroute('**/search-index.json');
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.locator('main').getByRole('link', { name: 'HTTP 캐시를 이해하는 두 가지 질문' })).toBeVisible();
});

test('navigation menu and theme are keyboard accessible and theme persists', async ({ page }, testInfo) => {
  await page.goto('/');
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '폴더 탐색 메뉴 열기' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  }
  await page.getByRole('button', { name: /현재 시스템 테마/ }).click();
  await page.getByRole('button', { name: /현재 라이트 테마/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '폴더 탐색 메뉴 열기' }).click();
    await page.getByRole('button', { name: '폴더 탐색 메뉴 닫기' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
  await page.keyboard.press('Control+k');
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole('searchbox')).toBeFocused();
});

test('missing URLs return actual 404s and drafts are absent from public artifacts', async ({ page, request }) => {
  const response = await page.goto('/posts/no-such-article');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('페이지를 찾을 수 없습니다.');
  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveAttribute('content', /noindex/);
  for (const url of ['/sitemap.xml', '/search-index.json']) {
    const response = await request.get(url);
    expect(response.status()).toBe(200);
    expect(await response.text()).not.toContain('next-post-draft');
    expect(await response.text()).not.toContain('draft-only-tag');
  }
  expect((await request.get('/rss.xml')).status()).toBe(404);
  expect((await request.get('/posts/next-post-draft')).status()).toBe(404);
});

test('reading and folder navigation work with JavaScript disabled', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: testInfo.project.use.viewport });
  const page = await context.newPage();
  const response = await page.goto('http://127.0.0.1:4173/posts/gradient-descent');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('article .katex').first()).toBeVisible();
  await page.locator('article footer').getByRole('link', { name: 'math' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('math');
  await context.close();
});

test('desktop and mobile reading surfaces pass accessibility checks', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-home.png`, fullPage: true });
  const home = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(home.violations).toEqual([]);
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '폴더 탐색 메뉴 열기' }).click();
    const menu = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(menu.violations).toEqual([]);
    await page.getByRole('button', { name: '폴더 탐색 메뉴 닫기' }).click();
  }
  await page.goto('/posts/gradient-descent');
  await page.screenshot({ path: `test-results/${testInfo.project.name}-article.png`, fullPage: true });
  const article = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(article.violations).toEqual([]);
  await page.evaluate(() => { localStorage.setItem('theme', 'dark'); document.documentElement.dataset.theme = 'dark'; });
  await page.screenshot({ path: `test-results/${testInfo.project.name}-dark.png`, fullPage: true });
  const dark = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(dark.violations).toEqual([]);
});

test('Mermaid renders flowcharts and sequences, follows theme, and survives navigation', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/posts/http-cache');
  const diagrams = page.locator('article figure[data-mermaid-state="ready"]');
  await expect(diagrams).toHaveCount(2);
  await expect(diagrams.nth(0).locator('svg')).toHaveCount(1);
  await expect(diagrams.nth(0).locator('svg')).toContainText('캐시 응답 결정');
  await expect(diagrams.nth(1).locator('svg')).toContainText('304 Not Modified');
  await diagrams.nth(0).getByText('다이어그램 소스', { exact: true }).click();
  await expect(diagrams.nth(0).locator('pre')).toBeVisible();
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: '폴더 탐색 메뉴 열기' }).click();
  else await page.getByRole('button', { name: '사이드바 펼치기' }).click();
  await page.getByRole('button', { name: /현재 시스템 테마/ }).click();
  await page.getByRole('button', { name: /현재 라이트 테마/ }).click();
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: '폴더 탐색 메뉴 닫기' }).click();
  await expect(page.locator('article figure[data-mermaid-theme="dark"]')).toHaveCount(2);
  await expect(diagrams.nth(0).locator('pre')).toBeVisible();
  const scan = await new AxeBuilder({ page }).include('article').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(scan.violations).toEqual([]);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-mermaid.png`, fullPage: true });
  await page.locator('article').getByRole('link', { name: 'TypeScript의 판별 유니온' }).click();
  await expect(page.locator('article figure[data-mermaid-state]')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('article figure[data-mermaid-state="ready"]')).toHaveCount(2);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a malformed Mermaid diagram preserves its source and leaves other diagrams working', async ({ page }) => {
  await page.route('**/posts/http-cache', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replaceAll('sequenceDiagram', 'invalidDiagramType') });
  });
  await page.goto('/posts/http-cache');
  await expect(page.locator('article figure[data-mermaid-state="ready"]')).toHaveCount(1);
  const failed = page.locator('article figure[data-mermaid-state="error"]');
  await expect(failed).toHaveCount(1);
  await expect(failed.locator('pre')).toBeVisible();
  await expect(failed.locator('pre')).toContainText('invalidDiagramType');
  await failed.getByRole('button', { name: '다시 시도' }).click();
  await expect(failed.getByRole('button', { name: '다시 시도' })).toBeVisible();
  await expect(page.locator('article figure[data-mermaid-state="ready"]')).toHaveCount(1);
});

test('Mermaid sources are readable with JavaScript disabled', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: testInfo.project.use.viewport });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/posts/http-cache');
    await expect(page.locator('pre[data-mermaid]')).toHaveCount(2);
    await expect(page.locator('pre[data-mermaid]').first()).toBeVisible();
    await expect(page.locator('pre[data-mermaid]').first()).toContainText('flowchart LR');
  } finally { await context.close(); }
});


test('sidebar collapses on article navigation and can be reopened', async ({ page }, testInfo) => {
  await page.goto('/');
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '폴더 탐색 메뉴 열기' }).click();
    await page.getByRole('dialog').getByRole('link', { name: '경사하강법을 수식과 코드로 따라가기' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: '폴더 탐색 메뉴 열기' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  } else {
    const sidebar = page.locator('#desktop-sidebar');
    await page.getByRole('button', { name: '사이드바 접기' }).click();
    await expect(sidebar).toHaveAttribute('inert', '');
    await page.getByRole('button', { name: '사이드바 펼치기' }).click();
    await expect(sidebar).not.toHaveAttribute('inert', '');
    await sidebar.getByRole('link', { name: '경사하강법을 수식과 코드로 따라가기' }).click();
    await expect(page.getByRole('button', { name: '사이드바 펼치기' })).toHaveAttribute('aria-expanded', 'false');
    await expect(sidebar).toHaveAttribute('inert', '');
    await page.getByRole('button', { name: '사이드바 펼치기' }).click();
    await expect(sidebar.getByRole('link', { name: 'Soohyuk 홈' })).toBeVisible();
    await page.reload();
    await expect(sidebar).toHaveAttribute('inert', '');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(sidebar).toHaveCSS('transition-duration', '0s');
    await page.getByRole('button', { name: '사이드바 펼치기' }).click();
    await expect(sidebar).not.toHaveAttribute('inert', '');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
