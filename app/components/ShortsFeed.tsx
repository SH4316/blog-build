import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { ShortEntry } from '~/lib/types';
import { formatShortDate } from '~/lib/site';
import { Icon } from './Icon';
import styles from './ShortsFeed.module.css';

export function ShortsFeed({ entries }: { entries: ShortEntry[] }) {
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <h1>
          짧은 글 <span>{entries.length}</span>
        </h1>
        {entries.length > 0 && <span className={styles.order}>최신순</span>}
      </header>
      {entries.length > 0 ? (
        <ol className={styles.feed} aria-label="짧은 글 목록">
          {entries.map((entry) => {
            const published = formatShortDate(entry.date);
            return (
              <li key={entry.id}>
                <article
                  id={entry.id}
                  className={styles.entry}
                  aria-label={`${published.title} 짧은 글`}
                >
                  <img
                    className={styles.avatar}
                    src="/github-avatar.png"
                    alt=""
                    width={34}
                    height={34}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className={styles.content}>
                    <header className={styles.byline}>
                      <span className={styles.author}>Soohyuk</span>
                      <a
                        className={styles.date}
                        href={`#${entry.id}`}
                        aria-label={`${published.label} 글 링크`}
                        title={published.title}
                      >
                        <time dateTime={published.dateTime}>{published.label}</time>
                      </a>
                    </header>
                    {entry.html && (
                      <div className={styles.body} dangerouslySetInnerHTML={{ __html: entry.html }} />
                    )}
                    {entry.link && (
                      <a
                        className={styles.link}
                        href={entry.link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {entry.preview?.image && (
                          <PreviewImage key={entry.preview.image} source={entry.preview.image} />
                        )}
                        <span className={styles.linkDetails}>
                          <span className={styles.linkHost}>
                            {entry.linkHost}
                            <Icon name="external" size={14} />
                          </span>
                          <span className={styles.linkTitle}>
                            {entry.linkTitle || entry.preview?.title || entry.link}
                          </span>
                          {entry.preview?.description && (
                            <span className={styles.linkDescription}>{entry.preview.description}</span>
                          )}
                        </span>
                        <span className="srOnly"> (새 탭)</span>
                      </a>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      ) : (
        <section className={styles.empty} aria-label="짧은 글 없음">
          <Icon name="note" size={28} />
          <h2>아직 짧은 글이 없습니다.</h2>
          <Link to="/">
            최근 글 읽기 <Icon name="arrow" size={15} />
          </Link>
        </section>
      )}
    </div>
  );
}

function PreviewImage({ source }: { source: string }) {
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0) setFailed(true);
  }, [source]);
  if (failed) return null;
  return (
    <img
      ref={imageRef}
      className={styles.linkImage}
      src={source}
      alt=""
      width={1200}
      height={630}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
