export interface BlogSettings {
  targetFolder: string;
  defaultTags: string[];
  autoAdd: boolean;
  draft: boolean;
}

export const DEFAULT_SETTINGS: BlogSettings = {
  targetFolder: 'posts',
  defaultTags: [],
  autoAdd: true,
  draft: true,
};

export const SHORTS_FOLDER = 'shorts';
export const SHORT_FIELDS = ['date', 'draft'] as const;

export interface ShortInput {
  body: string;
  link?: string;
  linkTitle?: string;
}

export interface ShortFrontmatterDefaults {
  date: string;
  draft: boolean;
}

export const DEFAULT_FIELDS = ['title', 'slug', 'date', 'description', 'tags', 'draft'] as const;
export interface FrontmatterDefaults {
  title: string;
  slug: string;
  date: string;
  description: string;
  tags: string[];
  draft: boolean;
}

export function normalizeFolder(input: string): string {
  const folder = input.trim().replace(/\\/g, '/').replace(/\/+$/, '');
  if (!folder || /^[\/]/.test(folder) || /^[A-Za-z]:/.test(folder)
      || /[%\0\r\n]/.test(folder) || folder.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('글 폴더는 posts 또는 blog/posts처럼 보관함 안의 경로로 입력하세요. %, . 및 .. 경로는 사용할 수 없습니다.');
  }
  return folder;
}

export function normalizePostFolder(input: string): string {
  const folder = normalizeFolder(input);
  if (folder.toLowerCase() === SHORTS_FOLDER || folder.toLowerCase().startsWith(`${SHORTS_FOLDER}/`)) {
    throw new Error('글 폴더는 짧은 글 전용 폴더 shorts 또는 그 하위 폴더와 겹칠 수 없습니다. posts 등 다른 경로를 입력하세요.');
  }
  return folder;
}

export function isShortPath(path: string): boolean {
  return path.startsWith(`${SHORTS_FOLDER}/`) && /\.md$/i.test(path);
}

export function isPostPath(path: string, folder: string): boolean {
  return !isShortPath(path) && path.startsWith(`${folder}/`) && /\.md$/i.test(path);
}

export function validateTags(tags: unknown): string[] {
  if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string'
      || !tag.trim() || /[/\\%\0\r\n]/.test(tag) || ['.', '..'].includes(tag.trim()))) {
    throw new Error('태그에는 빈 값, /, \\, %, 줄바꿈, . 및 ..을 사용할 수 없습니다.');
  }
  return [...new Set((tags as string[]).map(tag => tag.trim().normalize('NFC')))];
}

export function parseTags(input: string): string[] {
  if (!input.trim()) return [];
  return validateTags(input.split(','));
}

export function loadSettings(input: unknown): BlogSettings {
  const settings = { ...DEFAULT_SETTINGS, defaultTags: [...DEFAULT_SETTINGS.defaultTags] };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return settings;
  const data = input as Record<string, unknown>;
  if (typeof data.targetFolder === 'string') {
    try { settings.targetFolder = normalizePostFolder(data.targetFolder); } catch { /* Retain the safe default. */ }
  }
  if (data.defaultTags !== undefined) {
    try { settings.defaultTags = validateTags(data.defaultTags); } catch { /* Retain the safe default. */ }
  }
  if (typeof data.autoAdd === 'boolean') settings.autoAdd = data.autoAdd;
  if (typeof data.draft === 'boolean') settings.draft = data.draft;
  return settings;
}

export function localDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function slugify(title: string): string {
  return title.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'post';
}

export function uniqueSlug(title: string, existing: Iterable<string>): string {
  const used = new Set([...existing].map(slug => slug.normalize('NFC')));
  const base = slugify(title);
  let slug = base;
  for (let suffix = 2; used.has(slug); suffix++) slug = `${base}-${suffix}`;
  return slug;
}

export function createDefaults(title: string, slug: string, settings: BlogSettings, date: Date = new Date()): FrontmatterDefaults {
  return {
    title,
    slug,
    date: localDate(date),
    description: '',
    tags: [...settings.defaultTags],
    draft: settings.draft,
  };
}

export function missingFields(frontmatter: Record<string, unknown>): (keyof FrontmatterDefaults)[] {
  return DEFAULT_FIELDS.filter(field => !Object.prototype.hasOwnProperty.call(frontmatter, field));
}

export function applyDefaults(frontmatter: Record<string, unknown>, defaults: FrontmatterDefaults): string[] {
  const fields = missingFields(frontmatter);
  for (const field of fields) {
    const value = defaults[field];
    frontmatter[field] = Array.isArray(value) ? [...value] : value;
  }
  return fields;
}

export function filenameForTitle(title: string): string {
  const stem = title.normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').trim();
  if (!stem || ['.', '..'].includes(stem)) throw new Error('파일명으로 사용할 수 있는 제목을 입력하세요.');
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem) ? `_${stem}.md` : `${stem}.md`;
}

export function createShortDefaults(settings: BlogSettings, date: Date = new Date()): ShortFrontmatterDefaults {
  return { date: date.toISOString(), draft: settings.draft };
}

export function missingShortFields(frontmatter: Record<string, unknown>): (keyof ShortFrontmatterDefaults)[] {
  return SHORT_FIELDS.filter(field => !Object.prototype.hasOwnProperty.call(frontmatter, field));
}

export function applyShortDefaults(frontmatter: Record<string, unknown>, defaults: ShortFrontmatterDefaults): string[] {
  const fields = missingShortFields(frontmatter);
  for (const field of fields) frontmatter[field] = defaults[field];
  return fields;
}

export function normalizeShort(input: ShortInput): ShortInput {
  if (typeof input.body !== 'string') throw new Error('짧은 글 본문은 텍스트여야 합니다.');
  const body = input.body;
  const link = input.link?.trim() || '';
  const linkTitle = input.linkTitle?.trim() || '';
  if (!body.trim() && !link) throw new Error('본문 또는 링크를 입력하세요.');
  if (linkTitle && !link) throw new Error('링크 제목을 입력하려면 링크도 입력하세요.');
  if (!link) return { body };
  if (!/^https?:\/\//i.test(link) || /[\s\u0000-\u001f\u007f]/.test(link)) {
    throw new Error('링크는 공백이 없는 http:// 또는 https:// 전체 주소로 입력하세요.');
  }
  let url: URL;
  try { url = new URL(link); }
  catch { throw new Error('올바른 HTTP(S) 링크 주소를 입력하세요.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error('링크는 사용자 이름과 비밀번호가 없는 HTTP(S) 전체 주소여야 합니다.');
  }
  return { body, link: url.href, ...(linkTitle ? { linkTitle } : {}) };
}

export function filenameForShort(date: Date, suffix = 1): string {
  const stem = date.toISOString().replace(/[:.]/g, '-');
  return `${stem}${suffix > 1 ? `-${suffix}` : ''}.md`;
}
