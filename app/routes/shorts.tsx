import { useLoaderData } from 'react-router';
import { ShortsFeed } from '~/components/ShortsFeed';
import { getShorts } from '~/lib/content.server';
import { pageMeta } from '~/lib/site';

export const loader = () => getShorts();
export const meta = () =>
  pageMeta('짧은 글', '개발하며 떠오른 생각과 기억해둘 링크를 짧게 남깁니다.', '/shorts');

export default function Shorts() {
  const entries = useLoaderData<typeof loader>();
  return <ShortsFeed entries={entries} />;
}
