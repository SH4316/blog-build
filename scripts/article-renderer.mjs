import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import { SKIP, visit } from 'unist-util-visit';
import { createHighlighter } from 'shiki';
import { assetUrl, imageExtension, localPath, wikiImage } from './local-images.mjs';
import { markdownWiki } from './markdown-wiki.mjs';

let highlighterPromise;
const mathSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code || []).filter(attribute => !Array.isArray(attribute) || attribute[0] !== 'className'),
      ['className', /^language-./, 'math-inline', 'math-display'],
    ],
  },
};

function highlighter() {
  highlighterPromise ??= createHighlighter({
    themes: ['github-light-default', 'github-dark-default'],
    langs: ['typescript', 'javascript', 'tsx', 'jsx', 'json', 'bash', 'html', 'css', 'python', 'rust', 'go', 'sql', 'yaml', 'markdown', 'diff', 'http'],
  });
  return highlighterPromise;
}

function textOf(node) {
  if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code' || node.type === 'inlineMath' || node.type === 'math') return node.value || '';
  // Image alt text remains in the body, but filenames are not prose excerpts.
  if (node.type === 'image') return '';
  return (node.children || []).map(textOf).join(node.type === 'root' ? '\n' : ' ');
}

function doubleDollarDisplay() {
  return (tree, file) => visit(tree, 'inlineMath', node => {
    const original = String(file.value).slice(node.position.start.offset, node.position.end.offset);
    if (original.startsWith('$$')) node.data.hProperties.className = ['language-math', 'math-display'];
  });
}

function allowedAssetPath(relative, value, sourcePath) {
  if (!relative.startsWith('posts/') && !relative.startsWith('images/')) throw new Error(`${sourcePath}: link leaves the posts and images directories: ${value}`);
  return relative;
}

function referencePath(value, sourcePath) {
  const { decoded, suffix } = localPath(value, sourcePath);
  const relative = allowedAssetPath(path.posix.normalize(path.posix.join('posts', path.posix.dirname(sourcePath), decoded)), value, sourcePath);
  return { relative, suffix };
}

function wikiLinks({ post, allPosts, files, usedAssets, warnMissingArticle }) {
  const image = (value, alias) => wikiImage(value, alias, { sourcePath: post.sourcePath, folder: post.folder, scope: 'posts', files, usedAssets });
  function resolve(value) {
    const [destination, ...headingParts] = value.split('#');
    const name = destination.trim().replace(/\.md$/i, '');
    if (headingParts.join('#').trim().startsWith('^')) throw new Error(`${post.sourcePath}: wiki block links are not supported: ${value}`);
    let target = post;
    if (name) {
      // Missing links may fall back to text, but invalid local paths must still fail.
      const { decoded } = localPath(destination.trim(), post.sourcePath);
      if (/^[a-z][a-z\d+.-]*:/i.test(decoded) || decoded.startsWith('//')) throw new Error(`${post.sourcePath}: wiki article links must use a local path: ${value}`);
      const explicit = /^\/?posts\//.test(decoded) || decoded.startsWith('/');
      const scoped = path.posix.normalize(path.posix.join('posts', explicit ? '' : post.folder, decoded.replace(/^\/?posts\//, '').replace(/^\//, '')));
      if (!scoped.startsWith('posts/')) throw new Error(`${post.sourcePath}: article link leaves the posts directory: ${value}`);
      const source = `${name}.md`;
      const relative = path.posix.normalize(path.posix.join(post.folder, source));
      const root = source.replace(/^\/?posts\//, '').replace(/^\//, '');
      target = allPosts.find(item => item.sourcePath === relative)
        || allPosts.find(item => item.sourcePath === root);
      if (!target && !name.startsWith('.')) {
        const matches = allPosts.filter(item => item.sourcePath === source || item.sourcePath.endsWith(`/${source}`));
        if (matches.length > 1) throw new Error(`${post.sourcePath}: ambiguous wiki link: ${value}; use a folder path`);
        target = matches[0];
      }
      // Explicit paths and existing filenames keep their original resolution policy.
      if (!target && !name.includes('/') && !decoded.includes('/')) {
        const title = name.normalize('NFC').trim();
        const matches = allPosts.filter(item => item.title.normalize('NFC') === title);
        if (matches.length === 1) target = matches[0];
      }
      if (!target || target.draft) {
        warnMissingArticle(post.sourcePath, value);
        return null;
      }
    }
    let fragment = '';
    if (headingParts.length) {
      const heading = headingParts.join('#').trim();
      // Use the same heading ID generator as the rendered article.
      const tree = { type: 'root', children: [{ type: 'element', tagName: 'h2', properties: {}, children: [{ type: 'text', value: heading }] }] };
      unified().use(rehypeSlug).runSync(tree);
      fragment = `#${encodeURIComponent(tree.children[0].properties.id)}`;
    }
    return `/posts/${encodeURIComponent(target.slug)}${fragment}`;
  }
  return markdownWiki(post.body, ({ destination, alias, hasAlias, embed }) => {
    if (embed) return imageExtension.test(destination.trim().split(/[?#]/)[0]) ? image(destination.trim(), alias) : null;
    const url = resolve(destination.trim());
    const label = { type: 'text', value: hasAlias ? alias : destination };
    return url ? { type: 'link', url, children: [label] } : label;
  });
}

function rewriteReferences({ post, bySource, files, usedAssets, warnMissingArticle }) {
  return () => tree => visit(tree, 'element', (node, index, parent) => {
    const key = node.tagName === 'img' ? 'src' : node.tagName === 'a' ? 'href' : null;
    const value = key && node.properties?.[key];
    if (!key || typeof value !== 'string' || !value || /^(?:[a-z][a-z\d+.-]*:|\/|#|\?)/i.test(value)) return;
    const { relative, suffix } = referencePath(value, post.sourcePath);
    if (/\.md$/i.test(relative)) {
      const target = relative.startsWith('posts/') ? bySource.get(relative.slice(6)) : undefined;
      if (!target) {
        if (node.tagName !== 'a') throw new Error(`${post.sourcePath}: linked article is missing or unpublished: ${value}`);
        warnMissingArticle(post.sourcePath, value);
        parent.children.splice(index, 1, ...node.children);
        // Revisit the inserted children, including images and following links.
        return [SKIP, index];
      }
      node.properties[key] = `/posts/${encodeURIComponent(target.slug)}${suffix}`;
    } else {
      if (!files.has(relative)) throw new Error(`${post.sourcePath}: local asset does not exist: ${value}`);
      usedAssets.add(relative);
      node.properties[key] = `${assetUrl(relative)}${suffix}`;
    }
    if (node.tagName === 'img') { node.properties.loading = 'lazy'; node.properties.decoding = 'async'; }
  });
}

function enhanceContent(toc, shiki) {
  return () => tree => {
    visit(tree, 'element', node => {
      if (/^h[1-6]$/.test(node.tagName)) node.properties.className = [...(node.properties.className || []), 'proseHeading'];
      if (/^h[2-4]$/.test(node.tagName)) {
        const text = textOf(node).trim();
        toc.push({ id: node.properties.id, text, level: Number(node.tagName[1]) });
        node.children.push({ type: 'element', tagName: 'a', properties: { href: `#${node.properties.id}`, className: ['headingAnchor'], ariaLabel: `${text} 섹션 링크` }, children: [{ type: 'text', value: '#' }] });
      }
      if (node.tagName === 'img') { node.properties.loading = 'lazy'; node.properties.decoding = 'async'; }
      if (node.tagName !== 'pre' || node.children?.[0]?.tagName !== 'code') return;
      const code = node.children[0];
      const classes = code.properties.className || [];
      if (classes.some(value => value === 'language-math')) return;
      const requested = classes.find(value => value.startsWith('language-'))?.slice(9) || 'text';
      if (requested.toLowerCase() === 'mermaid') {
        node.properties = { 'data-language': 'mermaid', 'data-mermaid': '', tabIndex: 0 };
        code.properties = { className: ['language-mermaid'] };
        return;
      }
      const language = shiki.getLoadedLanguages().includes(requested) ? requested : 'text';
      const highlighted = shiki.codeToHast(textOf(code).replace(/\n$/, ''), { lang: language, themes: { light: 'github-light-default', dark: 'github-dark-default' }, defaultColor: false });
      const pre = highlighted.children.find(child => child.type === 'element' && child.tagName === 'pre');
      node.properties = { ...pre.properties, 'data-language': requested };
      node.children = pre.children;
    });
  };
}

export async function renderArticle(post, context) {
  const toc = [];
  let plainText;
  const shiki = await highlighter();
  const result = await unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(doubleDollarDisplay)
    .use(wikiLinks({ post, ...context }))
    .use(() => tree => { plainText = textOf(tree).replace(/\s+/g, ' ').trim(); })
    .use(remarkRehype).use(rewriteReferences({ post, ...context }))
    .use(rehypeSanitize, mathSchema).use(rehypeSlug)
    .use(enhanceContent(toc, shiki)).use(rehypeKatex, { trust: false, strict: 'error', output: 'htmlAndMathml' })
    .use(rehypeStringify).process(post.body);
  if (result.messages.length) throw new Error(`${post.sourcePath}: ${result.messages.map(message => message.reason).join('; ')}`);
  return { html: String(result), toc, plainText };
}
