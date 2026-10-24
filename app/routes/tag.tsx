import { useLoaderData } from 'react-router';
import type { Route } from './+types/tag';
import { getTag } from '~/lib/content.server';
import { pageMeta, tagPath } from '~/lib/site';
import { Breadcrumb, PostSection } from '~/components/PostList';
import styles from '~/components/Content.module.css';

export const loader = ({ params }: Route.LoaderArgs) => getTag(params.tag!);
export const meta = ({ loaderData: data }: Route.MetaArgs) =>
  data
    ? pageMeta(`#${data.tag}`, `${data.tag} 주제로 작성한 개발 기록입니다.`, tagPath(data.tag))
    : pageMeta('태그를 찾을 수 없습니다', '', '/404', { noindex: true });
export default function Tag() {
  const { tag, posts } = useLoaderData<typeof loader>();
  return (
    <div className={styles.indexPage}>
      <Breadcrumb title={`#${tag}`} />
      <header className={styles.pageHeading}>
        <h1>
          <span className={styles.titlePeriod}>#</span>
          {tag}
        </h1>
      </header>
      <PostSection posts={posts} />
    </div>
  );
}
