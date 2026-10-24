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

export function isPostPath(path: string, folder: string): boolean {
  return path.startsWith(`${folder}/`) && /\.md$/i.test(path);
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
    try { settings.targetFolder = normalizeFolder(data.targetFolder); } catch { /* Retain the safe default. */ }
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
