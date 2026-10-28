import 'dotenv/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, readdir, rm, mkdtemp, rename, copyFile, cp, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { createHighlighter } from 'shiki';
import { writeSiteAssets } from './site-assets.mjs';
import { buildShorts } from './shorts.mjs';
import { createShortPreviewResolver } from './short-previews.mjs';

const exec = promisify(execFile);
export const projectDir = fileURLToPath(new URL('../', import.meta.url));
export const siteUrl = 'https://blog.soohyuk.dev';
let highlighterPromise;
const imageExtension = /\.(?:apng|avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i;
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

export async function walk(directory, prefix = '') {
  if ((await lstat(directory)).isSymbolicLink()) throw new Error(`Symbolic links are not supported: ${prefix || path.basename(directory)}`);
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not supported: ${prefix}${entry.name}`);
    const relative = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), `${relative}/`));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

function validDate(value, field, source) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error(`${source}: ${field} must be a valid quoted YYYY-MM-DD date`);
  }
  return value;
}

export function parsePost(raw, sourcePath) {
  const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);
  if (!match) throw new Error(`${sourcePath}: YAML frontmatter is required`);
  let metadata;
  try { metadata = parseYaml(match[1]); }
  catch (error) { throw new Error(`${sourcePath}: invalid YAML: ${error.message}`); }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error(`${sourcePath}: frontmatter must be an object`);
  for (const field of ['title', 'slug']) {
    if (typeof metadata[field] !== 'string' || !metadata[field].trim()) throw new Error(`${sourcePath}: ${field} is required`);
  }
  const slug = metadata.slug.normalize('NFC');
  if (!/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(slug) || slug !== slug.toLowerCase()) throw new Error(`${sourcePath}: slug must use lowercase letters, numbers, and single hyphens`);
  if (metadata.tags !== undefined && (!Array.isArray(metadata.tags) || metadata.tags.some(tag => typeof tag !== 'string' || !tag.trim() || /[/\\%\0]/.test(tag) || ['.', '..'].includes(tag.trim())))) throw new Error(`${sourcePath}: tags must be non-empty URL segments without slash, backslash, or percent characters`);
  if (metadata.description !== undefined && typeof metadata.description !== 'string') throw new Error(`${sourcePath}: description must be a string`);
  if (metadata.draft !== undefined && typeof metadata.draft !== 'boolean') throw new Error(`${sourcePath}: draft must be true or false`);
  const body = normalized.slice(match[0].length);
  const folder = path.posix.dirname(sourcePath) === '.' ? '' : path.posix.dirname(sourcePath);
  if (folder.includes('%')) throw new Error(`${sourcePath}: folder names cannot contain percent characters`);
  return {
    title: metadata.title.trim(), slug, date: validDate(metadata.date, 'date', sourcePath),
    updated: metadata.updated === undefined ? null : validDate(metadata.updated, 'updated', sourcePath),
    description: metadata.description?.trim() || '',
    tags: [...new Set((metadata.tags || []).map(tag => tag.trim().normalize('NFC')))],
    draft: metadata.draft === true, folder, sourcePath, body,
  };
}

function textOf(node) {
  if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code' || node.type === 'inlineMath' || node.type === 'math') return node.value || '';
  if (node.type === 'image') return node.alt || '';
  return (node.children || []).map(textOf).join(node.type === 'root' ? '\n' : ' ');
}

function doubleDollarDisplay() {
  return (tree, file) => visit(tree, 'inlineMath', node => {
    const original = String(file.value).slice(node.position.start.offset, node.position.end.offset);
    if (original.startsWith('$$')) node.data.hProperties.className = ['language-math', 'math-display'];
  });
}

function localPath(value, sourcePath) {
  const [, pathname, suffix = ''] = /^([^?#]*)([?#].*)?$/.exec(value);
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { throw new Error(`${sourcePath}: invalid encoded path ${value}`); }
  if (decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').some(segment => segment.startsWith('.') && segment !== '.' && segment !== '..')) {
    throw new Error(`${sourcePath}: local paths cannot contain hidden files, backslashes, or null characters: ${value}`);
  }
  return { decoded, suffix };
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

function assetUrl(relative) {
  const rootImage = relative.startsWith('images/');
  return `${rootImage ? '/content-images/' : '/content-assets/'}${relative.slice(rootImage ? 7 : 6).split('/').map(encodeURIComponent).join('/')}`;
}

function textSourceOffsets(original) {
  const offsets = [];
  for (let index = 0; index < original.length;) {
    let raw = original[index];
    let decoded = raw;
    if (raw === '\\' && /[\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e]/.test(original[index + 1] || '')) {
      raw = original.slice(index, index + 2);
      decoded = raw[1];
    } else if (raw === '&') {
      const entity = /^&(?:#(?:[xX][\da-fA-F]+|\d+)|[A-Za-z][A-Za-z\d]+);/.exec(original.slice(index));
      if (entity) {
        raw = entity[0];
        decoded = textOf(unified().use(remarkParse).parse(raw));
      }
    }
    offsets.push(...Array(decoded.length).fill(index));
    index += raw.length;
  }
  offsets.push(original.length);
  return offsets;
}

function wikiLinks({ post, allPosts, files, usedAssets }) {
  function image(value, alias) {
    const { decoded, suffix } = localPath(value, post.sourcePath);
    const explicit = /^\/?(?:posts|images)\//.test(decoded);
    const relative = allowedAssetPath(path.posix.normalize(explicit ? decoded.replace(/^\//, '') : path.posix.join('posts', post.folder, decoded)), value, post.sourcePath);
    let target = files.has(relative) ? relative : undefined;
    if (!target && !explicit && !decoded.startsWith('.')) {
      const matches = [...files].filter(file => imageExtension.test(file) && (file === `posts/${decoded}` || file.endsWith(`/${decoded}`)));
      if (matches.length > 1) throw new Error(`${post.sourcePath}: ambiguous wiki image: ${value}; use a folder path`);
      target = matches[0];
    }
    if (!target) throw new Error(`${post.sourcePath}: local image does not exist: ${value}`);
    usedAssets.add(target);
    const size = /^(\d{1,5})(?:x(\d{1,5}))?$/.exec(alias);
    const dimensions = size && size.slice(1).filter(Boolean).every(value => Number(value) > 0)
      ? { width: Number(size[1]), ...(size[2] ? { height: Number(size[2]) } : {}) } : {};
    return {
      type: 'image', url: `${assetUrl(target)}${suffix}`,
      alt: alias && !Object.keys(dimensions).length ? alias : path.posix.basename(decoded),
      ...(Object.keys(dimensions).length ? { data: { hProperties: dimensions } } : {}),
    };
  }
  function resolve(value) {
    const [destination, ...headingParts] = value.split('#');
    const name = destination.trim().replace(/\.md$/i, '');
    let target = post;
    if (name) {
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
      if (!target || target.draft) throw new Error(`${post.sourcePath}: linked article is missing or unpublished: ${value}`);
    }
    let fragment = '';
    if (headingParts.length) {
      const heading = headingParts.join('#').trim();
      if (heading.startsWith('^')) throw new Error(`${post.sourcePath}: wiki block links are not supported: ${value}`);
      // Use the same heading ID generator as the rendered article.
      const tree = { type: 'root', children: [{ type: 'element', tagName: 'h2', properties: {}, children: [{ type: 'text', value: heading }] }] };
      unified().use(rehypeSlug).runSync(tree);
      fragment = `#${encodeURIComponent(tree.children[0].properties.id)}`;
    }
    return `/posts/${encodeURIComponent(target.slug)}${fragment}`;
  }
  return () => tree => {
    function transform(parent) {
      if (!parent.children || ['link', 'linkReference'].includes(parent.type)) return;
      parent.children = parent.children.flatMap(node => {
        if (node.type !== 'text') { transform(node); return [node]; }
        const parts = [];
        let cursor = 0;
        const original = post.body.slice(node.position.start.offset, node.position.end.offset);
        const offsets = textSourceOffsets(original);
        for (const match of node.value.matchAll(/(!?)\[\[([^\[\]\n]+)\]\]/g)) {
          // Markdown text nodes have already unescaped backslashes and entities.
          // Check the source so escaped examples remain literal.
          if (original.slice(offsets[match.index], offsets[match.index + match[0].length]) !== match[0]) continue;
          const [destination, ...aliases] = match[2].split('|');
          const embed = match[1] === '!';
          if (embed && !imageExtension.test(destination.trim().split(/[?#]/)[0])) continue;
          const alias = aliases.join('|');
          parts.push({ type: 'text', value: node.value.slice(cursor, match.index) });
          parts.push(embed ? image(destination.trim(), alias) : { type: 'link', url: resolve(destination.trim()), children: [{ type: 'text', value: aliases.length ? alias : destination }] });
          cursor = match.index + match[0].length;
        }
        if (!cursor) return [node];
        parts.push({ type: 'text', value: node.value.slice(cursor) });
        return parts;
      });
    }
    transform(tree);
  };
}

function rewriteReferences({ post, bySource, files, usedAssets }) {
  return () => tree => visit(tree, 'element', node => {
    const key = node.tagName === 'img' ? 'src' : node.tagName === 'a' ? 'href' : null;
    const value = key && node.properties?.[key];
    if (!key || typeof value !== 'string' || !value || /^(?:[a-z][a-z\d+.-]*:|\/|#|\?)/i.test(value)) return;
    const { relative, suffix } = referencePath(value, post.sourcePath);
    if (/\.md$/i.test(relative)) {
      const target = relative.startsWith('posts/') ? bySource.get(relative.slice(6)) : undefined;
      if (!target) throw new Error(`${post.sourcePath}: linked article is missing or unpublished: ${value}`);
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

export async function buildCatalog(rootDirectory, { sample = false, revision = null, previewResolver = null } = {}) {
  const postsDirectory = path.join(rootDirectory, 'posts');
  const fileList = await walk(postsDirectory);
  const imagesDirectory = path.join(rootDirectory, 'images');
  let imageFiles = [];
  try { await lstat(imagesDirectory); imageFiles = await walk(imagesDirectory); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const files = new Set([...fileList.map(file => `posts/${file}`), ...imageFiles.filter(file => imageExtension.test(file)).map(file => `images/${file}`)]);
  const allPosts = await Promise.all(fileList.filter(file => file.toLowerCase().endsWith('.md')).map(async source => parsePost(await readFile(path.join(postsDirectory, source), 'utf8'), source)));
  const slugs = new Set();
  for (const post of allPosts) {
    if (slugs.has(post.slug)) throw new Error(`Duplicate slug: ${post.slug}`);
    slugs.add(post.slug);
  }
  const published = allPosts.filter(post => !post.draft).sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug, 'en'));
  const bySource = new Map(published.map(post => [post.sourcePath, post]));
  const usedAssets = new Set();
  const articles = {};
  const searchIndex = [];
  const shiki = await highlighter();
  for (const post of published) {
    const markdownTree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(post.body);
    wikiLinks({ post, allPosts, files, usedAssets })()(markdownTree);
    const plainText = textOf(markdownTree).replace(/\s+/g, ' ').trim();
    const toc = [];
    const result = await unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(doubleDollarDisplay)
      .use(wikiLinks({ post, allPosts, files, usedAssets }))
      .use(remarkRehype).use(rewriteReferences({ post, bySource, files, usedAssets }))
      .use(rehypeSanitize, mathSchema).use(rehypeSlug)
      .use(enhanceContent(toc, shiki)).use(rehypeKatex, { trust: false, strict: 'error', output: 'htmlAndMathml' })
      .use(rehypeStringify).process(post.body);
    if (result.messages.length) throw new Error(`${post.sourcePath}: ${result.messages.map(message => message.reason).join('; ')}`);
    const { body, draft, ...summary } = post;
    summary.description ||= [...plainText].slice(0, 155).join('');
    summary.readingMinutes = Math.max(1, Math.ceil(plainText.length / 700));
    articles[post.slug] = { ...summary, html: String(result), toc };
    searchIndex.push({ ...summary, text: plainText });
  }
  const folders = new Set();
  for (const post of published) {
    let folder = post.folder;
    while (folder) { folders.add(folder); folder = path.posix.dirname(folder); if (folder === '.') break; }
  }
  const summaries = published.map(post => { const { html, toc, ...summary } = articles[post.slug]; return summary; });
  const shorts = await buildShorts(rootDirectory, { previewResolver });
  const usedPreviews = new Set(shorts.map(short => short.preview?.image?.slice('/short-previews/'.length)).filter(Boolean));
  return {
    catalog: { posts: summaries, folders: [...folders].sort((a, b) => a.localeCompare(b, 'ko')), tags: [...new Set(summaries.flatMap(post => post.tags))].sort((a, b) => a.localeCompare(b, 'ko')), sample, revision },
    articles, searchIndex, shorts,
    shortPreviewAssets: new Map([...(previewResolver?.assets || [])].filter(([filename]) => usedPreviews.has(filename))),
    usedAssets: [...usedAssets], rootDirectory,
  };
}

export function repositoryUrl(value) {
  const repository = value.replace(/^https:\/\/github\.com\//, '').replace(/\.git\/?$/, '').replace(/\/$/, '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || repository.split('/').some(part => part === '.' || part === '..')) throw new Error('CONTENT_REPOSITORY must be owner/repository or a public GitHub repository URL');
  return `https://github.com/${repository}.git`;
}

export async function resolveSource(environment = process.env) {
  if (environment.CF_PAGES && !environment.CONTENT_REPOSITORY) throw new Error('CONTENT_REPOSITORY is required on Cloudflare Pages. Sample content cannot be published by accident.');
  if (environment.CONTENT_LOCAL_DIR && !environment.CF_PAGES) return { rootDirectory: path.resolve(environment.CONTENT_LOCAL_DIR), sample: false, revision: null };
  if (!environment.CONTENT_REPOSITORY) return { rootDirectory: path.join(projectDir, 'tests/fixtures/content-repo'), sample: true, revision: null };
  const url = repositoryUrl(environment.CONTENT_REPOSITORY);
  const branch = environment.CONTENT_BRANCH || 'main';
  if (branch.startsWith('-') || /[\s\0]/.test(branch)) throw new Error('CONTENT_BRANCH is invalid');
  const cache = path.join(projectDir, '.cache');
  await mkdir(cache, { recursive: true });
  const temporary = await mkdtemp(path.join(cache, 'fetch-'));
  try {
    await exec('git', ['-c', 'credential.helper=', 'clone', '--depth', '1', '--single-branch', '--branch', branch, '--', url, temporary], { env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, timeout: 120_000 });
    const { stdout } = await exec('git', ['-C', temporary, 'rev-parse', 'HEAD']);
    const destination = path.join(cache, 'content');
    await rm(destination, { recursive: true, force: true });
    await rename(temporary, destination);
    return { rootDirectory: destination, sample: false, revision: stdout.trim() };
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw new Error(`Cannot fetch content: ${error.message}`);
  }
}

export async function writeContent(result, directory = projectDir) {
  const generated = path.join(directory, 'app/generated');
  const publicDirectory = path.join(directory, '.cache/public');
  const assets = path.join(publicDirectory, 'content-assets');
  const images = path.join(publicDirectory, 'content-images');
  const previews = path.join(publicDirectory, 'short-previews');
  await mkdir(generated, { recursive: true });
  await rm(assets, { recursive: true, force: true });
  await rm(images, { recursive: true, force: true });
  await rm(previews, { recursive: true, force: true });
  await mkdir(assets, { recursive: true });
  await Promise.all([
    writeFile(path.join(generated, 'catalog.json'), JSON.stringify(result.catalog)),
    writeFile(path.join(generated, 'articles.json'), JSON.stringify(result.articles)),
    writeFile(path.join(generated, 'shorts.json'), JSON.stringify(result.shorts)),
    writeFile(path.join(publicDirectory, 'search-index.json'), JSON.stringify(result.searchIndex)),
  ]);
  if (result.shortPreviewAssets?.size) {
    await mkdir(previews, { recursive: true });
    for (const [filename, bytes] of result.shortPreviewAssets) {
      if (!/^[a-f0-9]{64}\.webp$/.test(filename)) throw new Error('Invalid short preview asset filename');
      await writeFile(path.join(previews, filename), bytes);
    }
  }
  for (const asset of result.usedAssets) {
    const destination = path.join(publicDirectory, decodeURIComponent(assetUrl(asset)));
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(result.rootDirectory, asset), destination);
  }
}

async function main() {
  const source = await resolveSource();
  const result = await buildCatalog(source.rootDirectory, { ...source, previewResolver: createShortPreviewResolver() });
  await writeContent(result);
  const publicDirectory = path.join(projectDir, '.cache/public');
  await cp(path.join(projectDir, 'public'), publicDirectory, { recursive: true });
  await writeSiteAssets(publicDirectory, result.catalog, siteUrl);
  console.log(`Content: ${result.catalog.posts.length} articles, ${result.shorts.length} short entries, ${result.catalog.folders.length} folders (${source.sample ? 'local test fixtures' : source.revision || 'local repository'})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
