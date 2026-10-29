import 'dotenv/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, rm, mkdtemp, rename, copyFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { writeSiteAssets } from './site-assets.mjs';
import { buildShorts } from './shorts.mjs';
import { createShortPreviewResolver } from './short-previews.mjs';
import { assetUrl } from './local-images.mjs';
import { collectContentFiles } from './content-inventory.mjs';
import { renderArticle } from './article-renderer.mjs';

export { walk } from './content-inventory.mjs';

const exec = promisify(execFile);
export const projectDir = fileURLToPath(new URL('../', import.meta.url));
export const siteUrl = 'https://blog.soohyuk.dev';
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

export async function buildCatalog(rootDirectory, { sample = false, revision = null, previewResolver = null, onWarning = message => console.warn(message) } = {}) {
  const postsDirectory = path.join(rootDirectory, 'posts');
  const { postFiles: fileList, shortFiles, files } = await collectContentFiles(rootDirectory);
  const allPosts = await Promise.all(fileList.filter(file => file.toLowerCase().endsWith('.md')).map(async source => parsePost(await readFile(path.join(postsDirectory, source), 'utf8'), source)));
  const slugs = new Set();
  for (const post of allPosts) {
    if (slugs.has(post.slug)) throw new Error(`Duplicate slug: ${post.slug}`);
    slugs.add(post.slug);
  }
  const published = allPosts.filter(post => !post.draft).sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug, 'en'));
  const bySource = new Map(published.map(post => [post.sourcePath, post]));
  const usedAssets = new Set();
  const warnedArticles = new Set();
  const warnMissingArticle = (sourcePath, target) => {
    const key = JSON.stringify([sourcePath, target]);
    if (warnedArticles.has(key)) return;
    warnedArticles.add(key);
    onWarning(`[content warning] ${sourcePath}: linked article is missing or unpublished: ${JSON.stringify(target)}; rendered as plain text.`);
  };
  const articles = {};
  const searchIndex = [];
  for (const post of published) {
    const { html, toc, plainText } = await renderArticle(post, { allPosts, bySource, files, usedAssets, warnMissingArticle });
    const { body, draft, ...summary } = post;
    summary.description ||= [...plainText].slice(0, 155).join('');
    summary.readingMinutes = Math.max(1, Math.ceil(plainText.length / 700));
    articles[post.slug] = { ...summary, html, toc };
    searchIndex.push({ ...summary, text: plainText });
  }
  const folders = new Set();
  for (const post of published) {
    let folder = post.folder;
    while (folder) { folders.add(folder); folder = path.posix.dirname(folder); if (folder === '.') break; }
  }
  const summaries = published.map(post => { const { html, toc, ...summary } = articles[post.slug]; return summary; });
  const shorts = await buildShorts(rootDirectory, { previewResolver, files, usedAssets, sourceFiles: shortFiles });
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
  const shortAssets = path.join(publicDirectory, 'short-assets');
  await mkdir(generated, { recursive: true });
  await rm(assets, { recursive: true, force: true });
  await rm(images, { recursive: true, force: true });
  await rm(previews, { recursive: true, force: true });
  await rm(shortAssets, { recursive: true, force: true });
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
