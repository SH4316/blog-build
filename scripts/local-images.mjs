import path from 'node:path';

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

// Generated URLs still pass the same local-path and inventory validation as authored URLs.
export function assetSourcePath(value) {
  for (const [root, prefix] of Object.entries(assetPrefixes)) {
    if (value.startsWith(prefix)) return `/${root}/${value.slice(prefix.length)}`;
  }
  return value;
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
