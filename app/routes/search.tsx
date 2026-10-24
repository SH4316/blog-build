import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams, useRouteLoaderData } from 'react-router';
import type { RootData } from '~/root';
import type { SearchEntry } from '~/lib/types';
import { pageMeta, tagPath } from '~/lib/site';
import { searchExcerpt, searchPosts } from '~/lib/search';
import { Breadcrumb, PostList } from '~/components/PostList';
import { Icon } from '~/components/Icon';
import styles from '~/components/Content.module.css';

export const meta = () =>
  pageMeta('글 검색', '제목, 본문, 태그에서 개발 기록을 찾아보세요.', '/search', { noindex: true });
export default function Search() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') || '').slice(0, 200);
  const catalog = useRouteLoaderData<RootData>('root')!;
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch('/search-index.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Search index unavailable');
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('Invalid search index');
        setEntries(data);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setError(true);
      });
    return () => controller.abort();
  }, [attempt]);
  const results = entries ? searchPosts(entries, query) : [];

  function clearQuery() {
    setParams({}, { replace: true });
    input.current?.focus();
  }

  function renderExcerpt(post: SearchEntry) {
    const parts = searchExcerpt(post.text, query);
    if (!parts) return post.description;

    return parts.map((part, index) =>
      part.matched ? <mark key={index}>{part.text}</mark> : part.text,
    );
  }

  return (
    <div className={styles.indexPage}>
      <Breadcrumb title="글 검색" />
      <header className={styles.pageHeading}>
        <h1>글 검색</h1>
      </header>
      <form
        role="search"
        className={styles.searchForm}
        onSubmit={(event) => event.preventDefault()}
      >
        <Icon name="search" size={22} />
        <label className="srOnly" htmlFor="search-query">
          검색어
        </label>
        <input
          ref={input}
          id="search-query"
          name="q"
          type="search"
          autoComplete="off"
          value={query}
          maxLength={200}
          placeholder="키워드를 입력하세요"
          onChange={(event) =>
            setParams(event.target.value ? { q: event.target.value } : {}, { replace: true })
          }
        />
        {query && (
          <button type="button" aria-label="검색어 지우기" onClick={clearQuery}>
            <Icon name="close" size={18} />
          </button>
        )}
      </form>
      <noscript>
        <p>
          검색 기능에는 JavaScript가 필요합니다. <a href="/folders">폴더에서 글을 찾아보세요.</a>
        </p>
      </noscript>
      {error ? (
        <div className={styles.searchState} role="alert">
          <p>검색 데이터를 불러오지 못했습니다.</p>
          <button onClick={() => setAttempt((value) => value + 1)}>다시 시도</button>
        </div>
      ) : query.trim() ? (
        <>
          <div className={styles.sectionHeading}>
            <h2 aria-live="polite">
              {entries ? (
                <>
                  검색 결과 <span>{results.length}</span>
                </>
              ) : (
                '검색 준비 중…'
              )}
            </h2>
          </div>
          {entries ? (
            <PostList
              posts={results}
              renderExcerpt={renderExcerpt}
              emptyText={`‘${query}’에 맞는 글이 없습니다. 다른 키워드로 검색해보세요.`}
            />
          ) : (
            <p className={styles.searchState} role="status">
              검색 데이터를 불러오는 중입니다.
            </p>
          )}
        </>
      ) : (
        <div className={styles.searchSuggestions}>
          <h2>태그로 둘러보기</h2>
          <div className={styles.tagList}>
            {catalog.tags.map((tag) => (
              <Link key={tag} to={tagPath(tag)}>
                #{tag}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
