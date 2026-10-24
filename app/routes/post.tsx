import { Link, useLoaderData, useRouteLoaderData } from 'react-router';
import type { Route } from './+types/post';
import type { RootData } from '~/root';
import { getArticle } from '~/lib/content.server';
import { folderPath, formatDate, pageMeta, postPath, site, tagPath } from '~/lib/site';
import { Breadcrumb } from '~/components/PostList';
import { TableOfContents } from '~/components/TableOfContents';
import { Icon } from '~/components/Icon';
import { ArticleContent } from '~/components/ArticleContent';
import styles from '~/components/Content.module.css';

export const loader = ({ params }: Route.LoaderArgs) => getArticle(params.slug!);
export const meta = ({ loaderData: data }: Route.MetaArgs) =>
  data
    ? [
        ...pageMeta(data.title, data.description, postPath(data.slug), { article: true }),
        { property: 'article:published_time', content: `${data.date}T00:00:00Z` },
        { property: 'article:modified_time', content: `${data.updated || data.date}T00:00:00Z` },
      ]
    : pageMeta('글을 찾을 수 없습니다', '', '/404', { noindex: true });

export default function Post() {
  const post = useLoaderData<typeof loader>();
  const catalog = useRouteLoaderData<RootData>('root')!;
  const index = catalog.posts.findIndex((article) => article.slug === post.slug);
  const previous = catalog.posts[index + 1];
  const next = catalog.posts[index - 1];
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated || post.date,
    author: { '@type': 'Person', name: 'Soohyuk' },
    mainEntityOfPage: `${site.url}${postPath(post.slug)}`,
    image: `${site.url}/og.png`,
    inLanguage: 'ko',
  };
  return (
    <div className={styles.articlePage}>
      <Breadcrumb folder={post.folder} title={post.title} showTitle={false} />
      <div className={styles.readingLayout}>
        <article className={styles.article}>
          <header className={styles.articleHeader}>
            <h1>{post.title}</h1>
            <p className={styles.articleDescription}>{post.description}</p>
            <div className={styles.articleMeta}>
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span className={styles.metaDot}>·</span>
              <span>
                <Icon name="clock" size={14} />
                {post.readingMinutes}분 읽기
              </span>
              {post.updated && (
                <span className={styles.updated}>{formatDate(post.updated)} 수정</span>
              )}
            </div>
            <div className={styles.tagList}>
              {post.tags.map((tag) => (
                <Link key={tag} to={tagPath(tag)}>
                  #{tag}
                </Link>
              ))}
            </div>
          </header>
          {post.toc.length > 0 && (
            <details className={styles.mobileToc}>
              <summary>이 글의 목차</summary>
              <TableOfContents entries={post.toc} />
            </details>
          )}
          <ArticleContent html={post.html} />
          <footer className={styles.articleFooter}>
            <Link to={folderPath(post.folder)}>
              <Icon name="folder" size={16} />
              {post.folder || '전체 글'}
            </Link>
            <Link to="/">
              최근 글 보기 <Icon name="arrow" size={15} />
            </Link>
          </footer>
          {(previous || next) && (
            <nav className={styles.adjacentPosts} aria-label="다른 글">
              {previous ? (
                <Link to={postPath(previous.slug)}>
                  <span>이전 글</span>
                  <strong>{previous.title}</strong>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link to={postPath(next.slug)}>
                  <span>다음 글</span>
                  <strong>{next.title}</strong>
                </Link>
              )}
            </nav>
          )}
        </article>
        <aside className={styles.toc}>
          {post.toc.length > 0 && (
            <>
              <h2>이 글의 목차</h2>
              <TableOfContents entries={post.toc} />
            </>
          )}
        </aside>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
    </div>
  );
}
