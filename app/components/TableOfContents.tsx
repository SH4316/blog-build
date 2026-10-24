import { useEffect, useState } from 'react';
import type { TocEntry } from '~/lib/types';
import styles from './Content.module.css';

export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  const [active, setActive] = useState('');
  useEffect(() => {
    setActive('');
    const headings = entries
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => element !== null);
    let frame = 0;
    const update = () => {
      frame = 0;
      const offset =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--heading-offset'),
        ) || 24;
      let current = '';
      for (const heading of headings)
        if (heading.getBoundingClientRect().top <= offset) current = heading.id;
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [entries]);
  if (!entries.length) return null;
  return (
    <nav aria-label="이 글의 목차" className={styles.tocLinks}>
      {entries.map((entry) => (
        <a
          key={entry.id}
          href={`#${entry.id}`}
          className={active === entry.id ? styles.activeToc : undefined}
          aria-current={active === entry.id ? 'location' : undefined}
          style={{ paddingInlineStart: `${(entry.level - 2) * 12}px` }}
        >
          {entry.text}
        </a>
      ))}
    </nav>
  );
}
