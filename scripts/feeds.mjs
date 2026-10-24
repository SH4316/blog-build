import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export async function writeFeeds(directory, catalog, siteUrl) {
  const xml = value => String(value).replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);
  const postUrl = post => `${siteUrl}/posts/${encodeURIComponent(post.slug)}`;
  const paths = ['/', '/folders', ...catalog.posts.map(post => `/posts/${encodeURIComponent(post.slug)}`), ...catalog.folders.map(folder => `/folders/${folder.split('/').map(encodeURIComponent).join('/')}`), ...catalog.tags.map(tag => `/tags/${encodeURIComponent(tag)}`)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(route => {
    const post = catalog.posts.find(post => route === `/posts/${encodeURIComponent(post.slug)}`);
    return `<url><loc>${xml(siteUrl + (route === '/' ? '' : route))}</loc>${post ? `<lastmod>${xml(post.updated || post.date)}</lastmod>` : ''}</url>`;
  }).join('')}</urlset>\n`;
  const latest = catalog.posts[0];
  const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Soohyuk — 개발 기록</title><link>${siteUrl}</link><description>Soohyuk의 개발 블로그.</description><language>ko</language><atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>${latest ? `<lastBuildDate>${new Date(`${latest.updated || latest.date}T00:00:00Z`).toUTCString()}</lastBuildDate>` : ''}${catalog.posts.map(post => `<item><title>${xml(post.title)}</title><link>${xml(postUrl(post))}</link><guid isPermaLink="true">${xml(postUrl(post))}</guid><description>${xml(post.description)}</description><pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate>${post.tags.map(tag => `<category>${xml(tag)}</category>`).join('')}</item>`).join('')}</channel></rss>\n`;
  await Promise.all([
    writeFile(path.join(directory, 'sitemap.xml'), sitemap),
    writeFile(path.join(directory, 'rss.xml'), rss),
    writeFile(path.join(directory, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`),
  ]);
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#fbfdf4"/><rect x="0" width="18" height="630" fill="#02815e"/><path d="M84 102h44v44H84z" fill="#abc900"/><path d="m95 115 10 9-10 9m14 0h10" fill="none" stroke="#14261c" stroke-width="3"/><text x="84" y="300" font-family="sans-serif" font-size="100" font-weight="600" fill="#14261c">Soohyuk</text><path d="M88 480h1024" stroke="#e7ecc7"/><text x="88" y="535" font-family="sans-serif" font-size="24" fill="#02815e">blog.soohyuk.dev</text></svg>`;
  await sharp(Buffer.from(og)).png().toFile(path.join(directory, 'og.png'));
}
