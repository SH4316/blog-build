import { Link, useLoaderData } from 'react-router';
import type { Route } from './+types/folder';
import { getFolder } from '~/lib/content.server';
import { folderPath, pageMeta } from '~/lib/site';
import { Breadcrumb, PostSection } from '~/components/PostList';
import { Icon } from '~/components/Icon';
import styles from '~/components/Content.module.css';

export const loader = ({ params }: Route.LoaderArgs) => getFolder(params['*'] || '');
export const meta = ({ loaderData: data }: Route.MetaArgs) =>
  data
    ? pageMeta(
        data.folder.split('/').at(-1) || '모든 폴더',
        '폴더별로 개발 기록을 둘러보세요.',
        folderPath(data.folder),
      )
    : pageMeta('폴더를 찾을 수 없습니다', '', '/404', { noindex: true });
export default function Folder() {
  const { folder, posts, children } = useLoaderData<typeof loader>();
  const name = folder.split('/').at(-1) || '모든 폴더';
  const parent = folder.includes('/') ? folder.slice(0, folder.lastIndexOf('/')) : undefined;
  return (
    <div className={styles.indexPage}>
      <Breadcrumb folder={parent} title={name} />
      <header className={styles.pageHeading}>
        <div className={styles.folderTitle}>
          <Icon name="folder" size={30} />
          <h1>{name}</h1>
        </div>
      </header>
      {children.length > 0 && (
        <nav className={styles.folderList} aria-label="하위 폴더">
          {children.map((child) => (
            <Link key={child} to={folderPath(child)}>
              <Icon name="folder" size={18} />
              <span>{child.split('/').at(-1)}</span>
              <Icon name="chevron" size={14} />
            </Link>
          ))}
        </nav>
      )}
      <PostSection posts={posts} />
    </div>
  );
}
