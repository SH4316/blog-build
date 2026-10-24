import { Link } from 'react-router';
import { pageMeta } from '~/lib/site';
import { Icon } from '~/components/Icon';
import styles from '~/components/Content.module.css';

export const meta = () =>
  pageMeta('페이지를 찾을 수 없습니다', '주소를 확인하거나 최근 글에서 다시 찾아주세요.', '/404', {
    noindex: true,
  });
export default function NotFound() {
  return (
    <div className={styles.notFound}>
      <Icon name="file" size={36} />
      <h1>페이지를 찾을 수 없습니다.</h1>
      <p>
        주소가 올바른지 확인하거나
        <br />
        최근 글에서 다시 찾아주세요.
      </p>
      <Link to="/" className={styles.textLink}>
        최근 글로 돌아가기 <Icon name="arrow" size={17} />
      </Link>
    </div>
  );
}
