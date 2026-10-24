import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { PostSummary } from '~/lib/types';
import { folderPath, formatDate, postPath, tagPath } from '~/lib/site';
import { Icon } from './Icon';
import styles from './Content.module.css';

export function PostList<T extends PostSummary>({
  posts,
  emptyText = '아직 공개된 글이 없습니다.',
  renderExcerpt,
  groupByYear = false,
  titleLevel = 2,
}: {
  posts: T[];
  emptyText?: string;
  renderExcerpt?: (post: T) => ReactNode;
  groupByYear?: boolean;
  titleLevel?: 2 | 3;
}) {
  if (!posts.length)
    return (
      <div className={styles.empty}>
        <Icon name="book" size={28} />
        <p>{emptyText}</p>
        <Link to="/folders">
          폴더 둘러보기 <Icon name="arrow" size={15} />
        </Link>
      </div>
    );
  if (groupByYear) {
    const groups: { year: string; posts: T[] }[] = [];
    for (const post of posts) {
      const year = post.date.slice(0, 4);
      if (groups.at(-1)?.year !== year) groups.push({ year, posts: [] });
      groups.at(-1)!.posts.push(post);
    }
    return (
      <>
        {groups.map((group) => (
          <section
            key={group.year}
            className={styles.yearGroup}
            aria-labelledby={`year-${group.year}`}
          >
            <h2 id={`year-${group.year}`} className={styles.yearHeading}>
              {group.year}
            </h2>
            <PostList posts={group.posts} renderExcerpt={renderExcerpt} titleLevel={3} />
          </section>
        ))}
      </>
    );
  }
  const Title = titleLevel === 3 ? 'h3' : 'h2';
  return (
    <ol className={styles.postList}>
      {posts.map((post) => (
        <li key={post.slug} className={styles.postRow}>
          <div className={styles.rowContent}>
            <Title>
              <Link to={postPath(post.slug)}>
                {post.title}
                <Icon name="arrow" size={19} />
              </Link>
            </Title>
            <p>{renderExcerpt ? renderExcerpt(post) : post.description}</p>
            <div className={styles.rowMetadata}>
              <Link className={styles.postCategory} to={folderPath(post.folder)}>
                {post.folder || '전체 글'}
              </Link>
              {post.tags.map((tag) => (
                <Link key={tag} to={tagPath(tag)}>
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
          <div className={styles.rowDate}>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span>{post.readingMinutes}분 읽기</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Breadcrumb({
  folder,
  title,
  showTitle = true,
}: {
  folder?: string;
  title: string;
  showTitle?: boolean;
}) {
  const segments = folder?.split('/').filter(Boolean) || [];
  return (
    <nav className={styles.breadcrumb} aria-label="현재 위치">
      <Link to="/">홈</Link>
      {segments.map((segment, index) => (
        <span key={index}>
          <Icon name="chevron" size={11} />
          <Link to={folderPath(segments.slice(0, index + 1).join('/'))}>{segment}</Link>
        </span>
      ))}
      {showTitle && (
        <span>
          <Icon name="chevron" size={11} />
          <span aria-current="page">{title}</span>
        </span>
      )}
    </nav>
  );
}

export function PostSection({
  posts,
  title = '글 목록',
  headingLevel = 2,
  headingId,
  actions,
  groupByYear = false,
}: {
  posts: PostSummary[];
  title?: string;
  headingLevel?: 1 | 2;
  headingId?: string;
  actions?: ReactNode;
  groupByYear?: boolean;
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <>
      <div className={styles.sectionHeading}>
        <Heading id={headingId}>
          {title} <span>{posts.length}</span>
        </Heading>
        {actions && <div className={styles.listActions}>{actions}</div>}
      </div>
      <PostList posts={posts} groupByYear={groupByYear} />
    </>
  );
}
