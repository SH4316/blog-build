import { Link, useLoaderData } from 'react-router';
import { PostSection } from '~/components/PostList';
import { ShortsPreview } from '~/components/ShortsFeed';
import { Icon } from '~/components/Icon';
import { getHomeContent } from '~/lib/content.server';
import { pageMeta, site } from '~/lib/site';
import styles from '~/components/Content.module.css';

export const meta = () => pageMeta(site.title, site.description, '/');
export const loader = () => getHomeContent();
export default function Home() {
  const { posts, shorts, totalShorts } = useLoaderData<typeof loader>();
  return (
    <div className={styles.indexPage}>
      <ShortsPreview entries={shorts} total={totalShorts} />
      <section aria-labelledby="recent-heading">
        <PostSection
          posts={posts}
          title="최근 글"
          headingLevel={shorts.length ? 2 : 1}
          headingId="recent-heading"
          groupByYear
          actions={
            <Link to="/folders">
              <Icon name="folder" size={14} />
              폴더
            </Link>
          }
        />
      </section>
    </div>
  );
}
