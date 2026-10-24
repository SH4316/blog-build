import { Link, useRouteLoaderData } from 'react-router';
import type { RootData } from '~/root';
import { PostSection } from '~/components/PostList';
import { Icon } from '~/components/Icon';
import { pageMeta, site } from '~/lib/site';
import styles from '~/components/Content.module.css';

export const meta = () => pageMeta(site.title, site.description, '/');
export default function Home() {
  const catalog = useRouteLoaderData<RootData>('root')!;
  return (
    <div className={styles.indexPage}>
      <section aria-labelledby="recent-heading">
        <PostSection
          posts={catalog.posts}
          title="최근 글"
          headingLevel={1}
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
