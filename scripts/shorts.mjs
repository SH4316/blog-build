import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';

const shortSchema = {
  ...defaultSchema,
  tagNames: defaultSchema.tagNames.filter(tag => tag !== 'img'),
  protocols: { ...defaultSchema.protocols, href: ['http', 'https'] },
};

function validDate(value, source) {
  const match = typeof value === 'string' && /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  const calendar = match && new Date(`${match[1]}T00:00:00Z`);
  const offset = match && match[5] !== 'Z' && match[5]?.slice(1).split(':').map(Number);
  if (!match || Number.isNaN(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== match[1]
    || (match[2] !== undefined && (Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4] || 0) > 59))
    || (offset && (offset[0] > 23 || offset[1] > 59)) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${source}: date must be a valid quoted YYYY-MM-DD date or ISO timestamp with a timezone`);
  }
  return value;
}

function externalLink(value, source) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value) || /[\s\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`${source}: link must be an absolute HTTP(S) URL`);
  }
  let url;
  try { url = new URL(value); }
  catch { throw new Error(`${source}: link must be an absolute HTTP(S) URL`); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error(`${source}: link must be an absolute HTTP(S) URL without credentials`);
  }
  return { link: url.href, linkHost: url.host.replace(/^www\./i, '') };
}

export function parseShort(raw, sourcePath) {
  const source = `shorts/${sourcePath}`;
  const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);
  if (!match) throw new Error(`${source}: YAML frontmatter is required`);
  let metadata;
  try { metadata = parseYaml(match[1]); }
  catch (error) { throw new Error(`${source}: invalid YAML: ${error.message}`); }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error(`${source}: frontmatter must be an object`);
  if (metadata.draft !== undefined && typeof metadata.draft !== 'boolean') throw new Error(`${source}: draft must be true or false`);
  if (metadata.linkTitle !== undefined && typeof metadata.linkTitle !== 'string') throw new Error(`${source}: linkTitle must be a string`);
  const link = metadata.link === undefined ? { link: null, linkHost: null } : externalLink(metadata.link, source);
  if (metadata.linkTitle !== undefined && !link.link) throw new Error(`${source}: linkTitle requires a link`);
  const body = normalized.slice(match[0].length).trim();
  if (!body && !link.link && metadata.draft !== true) throw new Error(`${source}: a nonempty body or link is required`);
  return {
    id: `short-${Buffer.from(sourcePath, 'utf8').toString('hex')}`,
    date: validDate(metadata.date, source),
    ...link,
    linkTitle: metadata.linkTitle?.trim() || null,
    draft: metadata.draft === true,
    body,
    sourcePath,
  };
}

async function shortFiles(directory, prefix = '') {
  if ((await lstat(directory)).isSymbolicLink()) throw new Error(`shorts/${prefix}: symbolic links are not supported`);
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const relative = `${prefix}${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`shorts/${relative}: symbolic links are not supported`);
    if (entry.isDirectory()) files.push(...await shortFiles(path.join(directory, entry.name), `${relative}/`));
    else if (entry.isFile() && /\.md$/i.test(entry.name)) files.push(relative);
  }
  return files.sort();
}

function safeShortLinks() {
  return tree => visit(tree, 'element', node => {
    if (node.tagName !== 'a' || typeof node.properties.href !== 'string') return;
    const href = node.properties.href;
    // Root-relative blog links and fragments are useful; repository-relative files
    // and protocol-relative destinations would otherwise create broken or unsafe links.
    if (/^\/(?!\/)/.test(href) && !/[\\\u0000-\u001f\u007f]/.test(href) || href.startsWith('#')) return;
    try { node.properties.href = externalLink(href, 'short Markdown').link; }
    catch { delete node.properties.href; }
  });
}

export async function buildShorts(rootDirectory, { previewResolver = null } = {}) {
  const directory = path.join(rootDirectory, 'shorts');
  let files;
  try { files = await shortFiles(directory); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const parsed = await Promise.all(files.map(async file => parseShort(await readFile(path.join(directory, file), 'utf8'), file)));
  const timestamp = date => Date.parse(date.includes('T') ? date : `${date}T00:00:00+09:00`);
  parsed.sort((a, b) => timestamp(b.date) - timestamp(a.date) || (a.sourcePath < b.sourcePath ? -1 : a.sourcePath > b.sourcePath ? 1 : 0));
  const entries = [];
  for (const short of parsed.filter(entry => !entry.draft)) {
    const result = await unified().use(remarkParse).use(remarkGfm).use(remarkRehype)
      .use(rehypeSanitize, shortSchema).use(safeShortLinks).use(rehypeStringify).process(short.body);
    const html = String(result);
    if (!short.link && !html.replace(/<[^>]*>/g, '').trim()) throw new Error(`shorts/${short.sourcePath}: a nonempty text body or link is required`);
    const { draft, body, sourcePath, ...entry } = short;
    entries.push({ ...entry, html, preview: null });
  }
  if (previewResolver) await Promise.all(entries.map(async entry => {
    if (entry.link) entry.preview = await previewResolver.resolve(entry.link);
  }));
  return entries;
}
