import catalog from '../generated/catalog.json';
import articles from '../generated/articles.json';
import shorts from '../generated/shorts.json';
import type { Article, Catalog, ShortEntry } from './types';

export const getCatalog = () => catalog as Catalog;
export const getShorts = () => shorts as ShortEntry[];
export function getHomeContent() {
  const entries = getShorts();
  return { posts: getCatalog().posts, shorts: entries.slice(0, 3), totalShorts: entries.length };
}
export function getArticle(slug: string) {
  const article = Object.hasOwn(articles, slug)
    ? (articles as Record<string, Article>)[slug]
    : undefined;
  if (!article) throw new Response('Article not found', { status: 404 });
  return article;
}

export function getFolder(folder: string) {
  const catalog = getCatalog();
  if (folder && !catalog.folders.includes(folder))
    throw new Response('Folder not found', { status: 404 });
  const posts = catalog.posts.filter(
    (post) => !folder || post.folder === folder || post.folder.startsWith(`${folder}/`),
  );
  const children = catalog.folders.filter((candidate) =>
    folder
      ? candidate.startsWith(`${folder}/`) && !candidate.slice(folder.length + 1).includes('/')
      : !candidate.includes('/'),
  );
  return { folder, posts, children };
}

export function getTag(tag: string) {
  const catalog = getCatalog();
  if (!catalog.tags.includes(tag)) throw new Response('Tag not found', { status: 404 });
  return { tag, posts: catalog.posts.filter((post) => post.tags.includes(tag)) };
}
