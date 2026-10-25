import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import type { Catalog } from '~/lib/types';
import { folderPath, postPath, tagPath } from '~/lib/site';
import { Icon } from './Icon';
import styles from './Shell.module.css';

function Brand() {
  return (
    <Link className={styles.brand} to="/" aria-label="Soohyuk 홈">
      <span className={styles.brandMark}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 7 5 5-5 5m8 0h5" />
        </svg>
      </span>
      <span>
        Soohyuk<span className={styles.brandDot}>.</span>
      </span>
    </Link>
  );
}

function FolderBranch({
  folder,
  catalog,
  activeFolder,
  currentSlug,
  depth = 0,
}: {
  folder: string;
  catalog: Catalog;
  activeFolder: string;
  currentSlug: string;
  depth?: number;
}) {
  const active = activeFolder === folder || activeFolder.startsWith(`${folder}/`);
  const [expanded, setExpanded] = useState(depth === 0 || active);
  useEffect(() => {
    if (active) setExpanded(true);
  }, [active]);
  const children = catalog.folders.filter(
    (candidate) =>
      candidate.startsWith(`${folder}/`) && !candidate.slice(folder.length + 1).includes('/'),
  );
  const posts = catalog.posts.filter((post) => post.folder === folder);
  const postCount = catalog.posts.filter(
    (post) => post.folder === folder || post.folder.startsWith(`${folder}/`),
  ).length;
  return (
    <div className={styles.folderBranch}>
      <Link
        to={folderPath(folder)}
        className={`${styles.folderDestination} ${active ? styles.currentFolder : ''}`}
      >
        <Icon name="folder" size={16} />
        <span>{folder.split('/').at(-1)}</span>
        <span className={styles.folderCount}>{postCount}</span>
      </Link>
      <details
        className={styles.branchDisclosure}
        open={expanded}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary
          className={styles.folderSummary}
          aria-label={`${folder} 폴더 ${expanded ? '접기' : '펼치기'}`}
        >
          <Icon name="chevron" size={12} className={styles.chevron} />
        </summary>
        <div className={styles.branchChildren}>
          {children.map((child) => (
            <FolderBranch
              key={child}
              folder={child}
              catalog={catalog}
              activeFolder={activeFolder}
              currentSlug={currentSlug}
              depth={depth + 1}
            />
          ))}
          {posts.map((post) => (
            <NavLink
              key={post.slug}
              to={postPath(post.slug)}
              className={({ isActive }) =>
                `${styles.articleLink} ${isActive ? styles.selectedArticle : ''}`
              }
              aria-current={currentSlug === post.slug ? 'page' : undefined}
            >
              <Icon name="file" size={14} />
              <span>{post.title}</span>
            </NavLink>
          ))}
        </div>
      </details>
    </div>
  );
}

function useThemePreference() {
  const [preference, setPreference] = useState<'system' | 'light' | 'dark'>('system');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') setPreference(saved);
    } catch {
      /* Storage is optional. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
      document.documentElement.style.colorScheme = document.documentElement.dataset.theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference, ready]);
  return {
    preference,
    change: (value: 'system' | 'light' | 'dark') => {
      setPreference(value);
      try {
        localStorage.setItem('theme', value);
      } catch {
        /* Storage is optional. */
      }
    },
  };
}

function ThemeToggle({ theme }: { theme: ReturnType<typeof useThemePreference> }) {
  const { preference, change } = theme;
  const labels = { system: '시스템', light: '라이트', dark: '다크' };
  const next = { system: 'light', light: 'dark', dark: 'system' } as const;
  return (
    <button
      className={styles.themeButton}
      onClick={() => change(next[preference])}
      aria-label={`현재 ${labels[preference]} 테마. ${labels[next[preference]]} 테마로 변경`}
    >
      <Icon
        name={preference === 'system' ? 'monitor' : preference === 'light' ? 'sun' : 'moon'}
        size={16}
      />
      <span>{labels[preference]}</span>
    </button>
  );
}

function Sidebar({
  catalog,
  theme,
}: {
  catalog: Catalog;
  theme: ReturnType<typeof useThemePreference>;
}) {
  const [shortcutHint, setShortcutHint] = useState('⌘ K');
  useEffect(() => {
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
        ?.platform ||
      navigator.platform ||
      navigator.userAgent;
    setShortcutHint(/Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘ K' : 'Ctrl K');
  }, []);
  const { pathname } = useLocation();
  let currentSlug = '';
  try {
    currentSlug = pathname.startsWith('/posts/') ? decodeURIComponent(pathname.slice(7)) : '';
  } catch {
    /* An invalid URL is handled by the 404 page. */
  }
  const activeFolder =
    catalog.posts.find((post) => post.slug === currentSlug)?.folder ||
    (pathname.startsWith('/folders/') ? decodeURIComponent(pathname.slice(9)) : '');
  return (
    <div className={styles.sidebarInner}>
      <div className={styles.identity}>
        <Brand />
      </div>
      <details className={styles.toolsDisclosure}>
        <summary className={styles.toolsSummary}>
          <span>Tools</span>
          <Icon name="chevron" size={12} className={styles.chevron} />
        </summary>
        <nav className={styles.toolLinks} aria-label="개발 도구">
          <a href="https://formatter.soohyuk.dev" target="_blank" rel="noopener noreferrer">
            Formatter
            <Icon name="external" size={12} />
            <span className="srOnly"> (새 탭)</span>
          </a>
          <a href="https://base64.soohyuk.dev" target="_blank" rel="noopener noreferrer">
            Base64
            <Icon name="external" size={12} />
            <span className="srOnly"> (새 탭)</span>
          </a>
        </nav>
      </details>
      <Link to="/search" className={styles.searchLink}>
        <Icon name="search" size={16} />
        <span>글 검색</span>
        <kbd>{shortcutHint}</kbd>
      </Link>
      <nav aria-label="블로그 탐색" className={styles.navigation}>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `${styles.topLink} ${isActive ? styles.activeTopLink : ''}`}
        >
          <Icon name="home" size={17} />
          최근 글
        </NavLink>
        <div className={styles.navHeading}>
          <Link to="/folders">폴더</Link>
          <span>{catalog.folders.length}</span>
        </div>
        <div className={styles.tree}>
          {catalog.folders
            .filter((folder) => !folder.includes('/'))
            .map((folder) => (
              <FolderBranch
                key={folder}
                folder={folder}
                catalog={catalog}
                activeFolder={activeFolder}
                currentSlug={currentSlug}
              />
            ))}
          {catalog.posts
            .filter((post) => !post.folder)
            .map((post) => (
              <NavLink
                key={post.slug}
                to={postPath(post.slug)}
                className={({ isActive }) =>
                  `${styles.articleLink} ${isActive ? styles.selectedArticle : ''}`
                }
              >
                <Icon name="file" size={14} />
                <span>{post.title}</span>
              </NavLink>
            ))}
          {catalog.posts.length === 0 && (
            <p className={styles.emptyTree}>아직 공개된 글이 없습니다.</p>
          )}
        </div>
        {catalog.tags.length > 0 && (
          <>
            <div className={styles.navHeading}>
              태그<span>{catalog.tags.length}</span>
            </div>
            <div className={styles.tags}>
              {catalog.tags.map((tag) => (
                <NavLink
                  key={tag}
                  to={tagPath(tag)}
                  className={({ isActive }) => (isActive ? styles.activeTag : undefined)}
                >
                  <span aria-hidden="true">#</span>
                  {tag}
                </NavLink>
              ))}
            </div>
          </>
        )}
      </nav>
      <div className={styles.sidebarFooter}>
        <a
          className={styles.profileLink}
          href="https://github.com/sh4316"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
          <Icon name="external" size={14} />
          <span className="srOnly"> (새 탭)</span>
        </a>
        <div className={styles.footerActions}>
          <a href="/rss.xml" className={styles.feedLink}>
            <Icon name="rss" size={16} />
            RSS
          </a>
          <ThemeToggle theme={theme} />
        </div>
      </div>
    </div>
  );
}

export function BlogShell({ catalog, children }: { catalog: Catalog; children: ReactNode }) {
  const theme = useThemePreference();
  const drawer = useRef<HTMLDialogElement>(null);
  const location = useLocation();
  // Render the final state on direct visits; only later navigation transitions it.
  const [collapsed, setCollapsed] = useState(() => location.pathname.startsWith('/posts/'));
  const toggle = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const closingAnimation = useRef<Animation | null>(null);
  const closeDrawer = useCallback(() => {
    const dialog = drawer.current;
    if (!dialog?.open || closingAnimation.current) return;
    const panel = dialog.firstElementChild;
    if (!panel || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dialog.close();
      return;
    }
    const animation = panel.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }],
      { duration: 180, easing: 'ease-in', fill: 'forwards' },
    );
    closingAnimation.current = animation;
    animation.onfinish = () => {
      dialog.close();
      animation.cancel();
      closingAnimation.current = null;
    };
  }, []);
  const navigate = useNavigate();
  useEffect(() => {
    closeDrawer();
    if (location.pathname.startsWith('/posts/')) {
      if (sidebar.current?.contains(document.activeElement)) toggle.current?.focus();
      setCollapsed(true);
    }
  }, [location.pathname, closeDrawer]);
  useEffect(() => () => closingAnimation.current?.cancel(), []);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        drawer.current?.close();
        navigate('/search');
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [navigate]);
  return (
    <>
      <a href="#main" className={styles.skipLink}>
        본문으로 건너뛰기
      </a>
      <button
        ref={toggle}
        className={`${styles.iconButton} ${styles.sidebarToggle} ${collapsed ? styles.toggleCollapsed : ''}`}
        onClick={() => setCollapsed((value) => !value)}
        aria-label={`사이드바 ${collapsed ? '펼치기' : '접기'}`}
        aria-expanded={!collapsed}
        aria-controls="desktop-sidebar"
        title={`사이드바 ${collapsed ? '펼치기' : '접기'}`}
      >
        <Icon name="panel" />
      </button>
      <aside ref={sidebar} id="desktop-sidebar" className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`} inert={collapsed}>
        <Sidebar catalog={catalog} theme={theme} />
      </aside>
      <header className={styles.mobileHeader}>
        <Brand />
        <div>
          <Link to="/search" className={styles.iconButton} aria-label="글 검색">
            <Icon name="search" />
          </Link>
          <button
            className={styles.iconButton}
            onClick={() => drawer.current?.showModal()}
            aria-label="폴더 탐색 메뉴 열기"
          >
            <Icon name="menu" />
          </button>
        </div>
      </header>
      <dialog
        ref={drawer}
        className={styles.drawer}
        aria-label="폴더 탐색 메뉴"
        onCancel={(event) => { event.preventDefault(); closeDrawer(); }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
      >
        <div className={styles.drawerContent}>
          <button
            className={`${styles.iconButton} ${styles.closeButton}`}
            onClick={closeDrawer}
            aria-label="폴더 탐색 메뉴 닫기"
          >
            <Icon name="close" />
          </button>
          <Sidebar catalog={catalog} theme={theme} />
        </div>
      </dialog>
      <div className={`${styles.readingLayout} ${collapsed ? styles.readingExpanded : ''}`}>
        <main id="main" className={styles.main} tabIndex={-1}>
          {catalog.sample && <div className={styles.sampleNotice}>샘플 콘텐츠</div>}
          {children}
          <footer className={styles.mainFooter}>
            <span>© {new Date().getUTCFullYear()} Soohyuk</span>
            <a href="/rss.xml">
              RSS로 구독하기 <Icon name="arrow" size={13} />
            </a>
          </footer>
        </main>
      </div>
    </>
  );
}
