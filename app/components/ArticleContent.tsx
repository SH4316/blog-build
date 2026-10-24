import { useEffect, useRef } from 'react';
import { renderDiagram } from '~/lib/mermaid.client';
import styles from './Content.module.css';

export function ArticleContent({ html }: { html: string }) {
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = content.current;
    if (!root) return;
    let cancelled = false;
    const blocks = [...root.querySelectorAll<HTMLPreElement>('pre:not([data-mermaid])')].map(
      (pre) => {
        const source = pre.querySelector('code')?.textContent ?? pre.textContent ?? '';
        const wrapper = document.createElement('div');
        wrapper.className = styles.codeBlock;
        const header = document.createElement('div');
        header.className = styles.codeHeader;
        const label = document.createElement('span');
        label.textContent = pre.dataset.language || 'text';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = '복사';
        const status = document.createElement('span');
        status.className = 'srOnly';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        let timer: ReturnType<typeof setTimeout>;
        const copy = async () => {
          clearTimeout(timer);
          status.textContent = '';
          button.disabled = true;
          let message = '복사됨';
          try {
            await navigator.clipboard.writeText(source);
          } catch {
            message = '복사 실패';
          }
          if (cancelled) return;
          button.disabled = false;
          button.textContent = message;
          status.textContent = message;
          timer = setTimeout(() => {
            button.textContent = '복사';
            status.textContent = '';
          }, 2000);
        };
        button.addEventListener('click', copy);
        header.append(label, button, status);
        pre.replaceWith(wrapper);
        wrapper.append(header, pre);
        return {
          pre,
          wrapper,
          cleanup: () => {
            clearTimeout(timer);
            button.removeEventListener('click', copy);
          },
        };
      },
    );
    return () => {
      cancelled = true;
      for (const block of blocks) {
        block.cleanup();
        if (root.contains(block.wrapper)) block.wrapper.replaceWith(block.pre);
      }
    };
  }, [html]);
  useEffect(() => {
    const root = content.current;
    if (!root) return;
    const sources = [...root.querySelectorAll<HTMLPreElement>('pre[data-mermaid]')];
    if (!sources.length) return;
    let cancelled = false;
    let generation = 0;
    const blocks = sources.map((pre) => {
      const figure = document.createElement('figure');
      figure.className = styles.mermaidDiagram;
      figure.dataset.mermaidState = 'loading';
      const output = document.createElement('div');
      output.className = styles.mermaidOutput;
      output.tabIndex = 0;
      output.setAttribute('role', 'group');
      output.setAttribute('aria-label', 'Mermaid 다이어그램');
      const controls = document.createElement('div');
      controls.className = styles.mermaidControls;
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = '다이어그램 불러오는 중…';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '다시 시도';
      retry.hidden = true;
      controls.append(status, retry);
      const details = document.createElement('details');
      details.className = styles.mermaidSource;
      details.open = true;
      const summary = document.createElement('summary');
      summary.textContent = '다이어그램 소스';
      details.append(summary);
      pre.replaceWith(figure);
      details.append(pre);
      figure.append(output, controls, details);
      return { pre, figure, output, details, status, retry, source: pre.textContent || '' };
    });

    const render = async () => {
      const version = ++generation;
      await document.fonts.ready;
      if (cancelled || version !== generation) return;
      const computed = getComputedStyle(document.documentElement);
      const color = (name: string) => computed.getPropertyValue(name).trim();
      const theme = {
        dark: document.documentElement.dataset.theme === 'dark',
        background: color('--bg'),
        text: color('--text'),
        muted: color('--muted'),
        accent: color('--accent'),
        selected: color('--accent-soft'),
        surface: color('--surface'),
        fontFamily: computed.fontFamily,
      };
      for (const block of blocks) {
        if (cancelled || version !== generation) return;
        block.retry.hidden = true;
        try {
          const svg = await renderDiagram(block.source, theme);
          if (cancelled || version !== generation) return;
          block.output.innerHTML = svg;
          const diagram = block.output.querySelector('svg');
          if (diagram?.viewBox.baseVal.width)
            diagram.style.minWidth = `${Math.ceil(diagram.viewBox.baseVal.width)}px`;
          if (
            diagram &&
            !diagram.hasAttribute('aria-labelledby') &&
            !diagram.hasAttribute('aria-label')
          ) {
            diagram.setAttribute('aria-label', 'Mermaid 다이어그램');
          }
          block.figure.dataset.mermaidState = 'ready';
          block.figure.dataset.mermaidTheme = theme.dark ? 'dark' : 'light';
          block.status.hidden = true;
          // Preserve a reader's source disclosure when switching themes.
          if (!block.output.dataset.rendered) block.details.open = false;
          block.output.dataset.rendered = 'true';
        } catch {
          if (cancelled || version !== generation) return;
          block.figure.dataset.mermaidState = 'error';
          block.status.hidden = false;
          block.status.textContent = '다이어그램을 표시하지 못했습니다.';
          block.retry.hidden = false;
          block.details.open = true;
        }
      }
    };
    for (const block of blocks) block.retry.addEventListener('click', render);
    const observer = new MutationObserver(() => {
      void render();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    void render();
    return () => {
      cancelled = true;
      observer.disconnect();
      for (const block of blocks) {
        block.retry.removeEventListener('click', render);
        if (root.contains(block.figure)) block.figure.replaceWith(block.pre);
      }
    };
  }, [html]);
  return <div ref={content} className={styles.prose} dangerouslySetInnerHTML={{ __html: html }} />;
}
