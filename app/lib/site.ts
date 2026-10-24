export const site = {
  title: 'Soohyuk',
  url: 'https://blog.soohyuk.dev',
  description: 'Soohyuk의 개발 블로그.',
};
export const postPath = (slug: string) => `/posts/${encodeURIComponent(slug)}`;
export const folderPath = (folder: string) =>
  `/folders${folder ? `/${folder.split('/').map(encodeURIComponent).join('/')}` : ''}`;
export const tagPath = (tag: string) => `/tags/${encodeURIComponent(tag)}`;
export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
export function pageMeta(
  title: string,
  description: string,
  pathname: string,
  options: { article?: boolean; noindex?: boolean } = {},
) {
  return [
    { title: title === site.title ? `${site.title} — 개발 기록` : `${title} · ${site.title}` },
    { name: 'description', content: description },
    { tagName: 'link', rel: 'canonical', href: site.url + (pathname === '/' ? '' : pathname) },
    { property: 'og:site_name', content: site.title },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: options.article ? 'article' : 'website' },
    { property: 'og:locale', content: 'ko_KR' },
    { property: 'og:url', content: site.url + (pathname === '/' ? '' : pathname) },
    { property: 'og:image', content: `${site.url}/og.png` },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { name: 'twitter:card', content: 'summary_large_image' },
    ...(options.noindex ? [{ name: 'robots', content: 'noindex, follow' }] : []),
  ];
}
