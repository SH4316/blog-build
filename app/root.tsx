import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useLoaderData,
} from 'react-router';
import type { ReactNode } from 'react';
import { BlogShell } from './components/BlogShell';
import { getCatalog } from './lib/content.server';
import { pageMeta, site } from './lib/site';
import '@fontsource-variable/noto-sans-kr';
import 'katex/dist/katex.min.css';
import './styles/global.css';

export const loader = () => getCatalog();
export const shouldRevalidate = () => false;
export type RootData = ReturnType<typeof loader>;
export const meta = () => pageMeta(site.title, site.description, '/');

const initializeTheme = `
(function () {
  try {
    var preference = localStorage.getItem('theme');
    var theme = preference;
    if (preference !== 'light' && preference !== 'dark') {
      theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    // Storage is optional.
  }
})();
`;

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#02815e" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#101710" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate" type="application/rss+xml" title="Soohyuk RSS" href="/rss.xml" />
        <script dangerouslySetInnerHTML={{ __html: initializeTheme }} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  const catalog = useLoaderData<typeof loader>();
  return (
    <BlogShell catalog={catalog}>
      <Outlet />
    </BlogShell>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const missing = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="errorPage">
      <h1>{missing ? '글을 찾을 수 없습니다.' : '페이지를 불러오지 못했습니다.'}</h1>
      <p>
        {missing
          ? '주소가 올바른지 확인하거나 최근 글에서 다시 찾아주세요.'
          : '잠시 후 페이지를 새로고침해주세요.'}
      </p>
      <a href="/">최근 글로 돌아가기 →</a>
    </main>
  );
}
