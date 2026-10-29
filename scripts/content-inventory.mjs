import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { imageExtension } from './local-images.mjs';

export async function walk(directory, prefix = '', { optional = false } = {}) {
  let stat;
  try { stat = await lstat(directory); }
  catch (error) { if (optional && error.code === 'ENOENT') return null; throw error; }
  if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not supported: ${prefix || path.basename(directory)}`);
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

export async function collectContentFiles(rootDirectory, { requirePosts = true, shortFiles = null } = {}) {
  const postFiles = await walk(path.join(rootDirectory, 'posts'), '', { optional: !requirePosts }) || [];
  const imageFiles = await walk(path.join(rootDirectory, 'images'), '', { optional: true }) || [];
  shortFiles ??= await walk(path.join(rootDirectory, 'shorts'), '', { optional: true }) || [];
  // Articles may link arbitrary attachments; shared roots expose supported images only.
  const files = new Set([
    ...postFiles.map(file => `posts/${file}`),
    ...imageFiles.filter(file => imageExtension.test(file)).map(file => `images/${file}`),
    ...shortFiles.filter(file => imageExtension.test(file)).map(file => `shorts/${file}`),
  ]);
  return { postFiles, shortFiles, files };
}
