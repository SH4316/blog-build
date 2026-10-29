import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';

export const imageExtension = /\.(?:apng|avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i;
const assetPrefixes = { posts: '/content-assets/', images: '/content-images/', shorts: '/short-assets/' };

export function localPath(value, sourcePath) {
  const [, pathname, suffix = ''] = /^([^?#]*)([?#].*)?$/.exec(value);
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { throw new Error(`${sourcePath}: invalid encoded path ${value}`); }
  if (decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').some(segment => segment.startsWith('.') && segment !== '.' && segment !== '..')) {
    throw new Error(`${sourcePath}: local paths cannot contain hidden files, backslashes, or null characters: ${value}`);
  }
  return { decoded, suffix };
}

export function assetUrl(relative) {
  const [root, ...segments] = relative.split('/');
  if (!assetPrefixes[root] || !segments.length || segments.some(segment => !segment || segment === '.' || segment === '..')) throw new Error(`Invalid local asset path: ${relative}`);
  return `${assetPrefixes[root]}${segments.map(encodeURIComponent).join('/')}`;
}

function allowedImagePath(relative, value, sourcePath, scope) {
  const roots = scope === 'shorts' ? ['shorts', 'posts', 'images'] : ['posts', 'images'];
  if (!roots.some(root => relative.startsWith(`${root}/`))) throw new Error(`${sourcePath}: link leaves the ${roots.join(' and ')} directories: ${value}`);
  return relative;
}

export function wikiImage(value, alias, { sourcePath, folder, scope, files, usedAssets }) {
  const { decoded, suffix } = localPath(value, sourcePath);
  const roots = scope === 'shorts' ? ['shorts', 'posts', 'images'] : ['posts', 'images'];
  const explicit = new RegExp(`^\\/?(?:${roots.join('|')})/`).test(decoded);
  const relative = allowedImagePath(path.posix.normalize(explicit ? decoded.replace(/^\//, '') : path.posix.join(scope, folder, decoded)), value, sourcePath, scope);
  let target = files.has(relative) ? relative : undefined;
  if (!target && !explicit && !decoded.startsWith('.')) {
    const matches = [...files].filter(file => roots.some(root => file.startsWith(`${root}/`)) && imageExtension.test(file) && (file === `${scope}/${decoded}` || file.endsWith(`/${decoded}`)));
    if (matches.length > 1) throw new Error(`${sourcePath}: ambiguous wiki image: ${value}; use a folder path`);
    target = matches[0];
  }
  if (!target) throw new Error(`${sourcePath}: local image does not exist: ${value}`);
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

export function shortImagePath(value, { sourcePath, folder, files, usedAssets }) {
  const { decoded, suffix } = localPath(value, sourcePath);
  const relative = allowedImagePath(path.posix.normalize(decoded.startsWith('/') ? decoded.slice(1) : path.posix.join('shorts', folder, decoded)), value, sourcePath, 'shorts');
  if (!imageExtension.test(relative)) throw new Error(`${sourcePath}: unsupported local image: ${value}`);
  if (!files.has(relative)) throw new Error(`${sourcePath}: local image does not exist: ${value}`);
  usedAssets.add(relative);
  return `${assetUrl(relative)}${suffix}`;
}

export async function localImageFiles(rootDirectory, roots = ['posts', 'images']) {
  const files = [];
  async function walk(directory, prefix) {
    if ((await lstat(directory)).isSymbolicLink()) throw new Error(`${prefix}: symbolic links are not supported`);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const relative = `${prefix}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`${relative}: symbolic links are not supported`);
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative);
      else if (entry.isFile() && imageExtension.test(entry.name)) files.push(relative);
    }
  }
  for (const root of roots) {
    try { await lstat(path.join(rootDirectory, root)); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    await walk(path.join(rootDirectory, root), root);
  }
  return files;
}

function textOf(node) {
  return typeof node.value === 'string' ? node.value : (node.children || []).map(textOf).join('');
}

export function textSourceOffsets(original) {
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
