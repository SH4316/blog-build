import { writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export async function writeSiteAssets(directory, catalog, siteUrl) {
  const xml = value => String(value).replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);
  const paths = ['/', '/folders', ...catalog.posts.map(post => `/posts/${encodeURIComponent(post.slug)}`), ...catalog.folders.map(folder => `/folders/${folder.split('/').map(encodeURIComponent).join('/')}`), ...catalog.tags.map(tag => `/tags/${encodeURIComponent(tag)}`)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(route => {
    const post = catalog.posts.find(post => route === `/posts/${encodeURIComponent(post.slug)}`);
    return `<url><loc>${xml(siteUrl + (route === '/' ? '' : route))}</loc>${post ? `<lastmod>${xml(post.updated || post.date)}</lastmod>` : ''}</url>`;
  }).join('')}</urlset>\n`;
  await Promise.all([
    writeFile(path.join(directory, 'sitemap.xml'), sitemap),
    rm(path.join(directory, 'rss.xml'), { force: true }),
    writeFile(path.join(directory, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`),
  ]);
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#f5f8ff"/><rect x="0" width="18" height="630" fill="#1d4ed8"/><path d="M84 102h44v44H84z" fill="#1d4ed8"/><path d="m95 115 10 9-10 9m14 0h10" fill="none" stroke="#ffffff" stroke-width="3"/><text x="84" y="300" font-family="sans-serif" font-size="100" font-weight="600" fill="#182741">Soohyuk</text><path d="M88 480h1024" stroke="#dbe4f2"/><text x="88" y="535" font-family="sans-serif" font-size="24" fill="#1d4ed8">blog.soohyuk.dev</text></svg>`;
  await sharp(Buffer.from(og)).png().toFile(path.join(directory, 'og.png'));
}
