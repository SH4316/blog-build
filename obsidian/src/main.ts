import {
  getFrontMatterInfo, normalizePath, Notice, parseYaml, Plugin, stringifyYaml, TFile, TFolder,
} from 'obsidian';
import {
  applyDefaults, applyShortDefaults, BlogSettings, createDefaults, createShortDefaults,
  filenameForShort, filenameForTitle, isPostPath, isShortPath, loadSettings,
  missingFields, missingShortFields, normalizePostFolder, normalizeShort,
  ShortInput, SHORTS_FOLDER, uniqueSlug,
} from './frontmatter';
import { BlogSettingsTab, NewPostModal, NewShortModal } from './ui';

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default class BlogFrontmatterPlugin extends Plugin {
  settings: BlogSettings = loadSettings(null);
  private pending: Promise<unknown> = Promise.resolve();
  private settingsPending: Promise<void> = Promise.resolve();
  private active = false;

  async onload(): Promise<void> {
    const saved: unknown = await this.loadData();
    this.settings = loadSettings(saved);
    this.active = true;
    if (saved && typeof saved === 'object' && 'targetFolder' in saved && typeof saved.targetFolder === 'string') {
      try { normalizePostFolder(saved.targetFolder); }
      catch (error) {
        new Notice(`${message(error)} 현재 글 폴더는 ${this.settings.targetFolder}입니다. 설정을 확인하세요.`, 10000);
      }
    }
    this.addSettingTab(new BlogSettingsTab(this.app, this));

    this.addCommand({
      id: 'add-current-frontmatter',
      name: '현재 글 frontmatter 추가',
      checkCallback: checking => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.isSupported(file)) return false;
        if (!checking) {
          void this.enqueue(() => this.addFrontmatter(file)).then(fields => {
            if (this.active) new Notice(fields.length ? `추가한 속성: ${fields.join(', ')}` : '이미 모든 기본 속성이 있습니다.');
          }).catch(error => this.showError(error));
        }
        return true;
      },
    });
    this.addCommand({
      id: 'new-blog-post',
      name: '새 블로그 글',
      callback: () => new NewPostModal(this.app, this).open(),
    });
    this.addCommand({
      id: 'new-blog-short',
      name: '새 짧은 글',
      callback: () => new NewShortModal(this.app, this).open(),
    });

    this.app.workspace.onLayoutReady(() => {
      if (!this.active) return;
      this.registerEvent(this.app.vault.on('create', file => {
        if (!this.active || !this.settings.autoAdd || !(file instanceof TFile) || !this.isSupported(file)) return;
        void this.enqueue(async () => {
          if (this.active && this.settings.autoAdd && this.isSupported(file)) await this.addFrontmatter(file);
        }).catch(error => this.showError(error));
      }));
    });
  }

  onunload(): void {
    this.active = false;
  }

  private isPost(file: TFile): boolean {
    return isPostPath(file.path, this.settings.targetFolder);
  }

  private isSupported(file: TFile): boolean {
    return isShortPath(file.path) || this.isPost(file);
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation);
    this.pending = result.catch(() => undefined);
    return result;
  }

  private showError(error: unknown): void {
    if (this.active) new Notice(`Frontmatter 추가 실패: ${message(error)}`, 8000);
  }

  private async readFrontmatter(file: TFile): Promise<Record<string, unknown>> {
    const content = await this.app.vault.read(file);
    const info = getFrontMatterInfo(content);
    if (!info.exists) {
      if (/^(?:\uFEFF)?---(?:\r?\n|$)/.test(content)) throw new Error(`${file.path}: YAML의 닫는 ---를 확인하세요.`);
      return {};
    }
    try {
      const data: unknown = parseYaml(info.frontmatter);
      if (data === null || data === undefined) return {};
      if (Object.prototype.toString.call(data) !== '[object Object]') throw new Error('속성은 YAML 객체여야 합니다.');
      return data as Record<string, unknown>;
    } catch (error) {
      throw new Error(`${file.path}: YAML을 확인하세요. ${message(error)}`);
    }
  }

  private async usedSlugs(except?: TFile): Promise<string[]> {
    const slugs: string[] = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (file === except || !this.isPost(file)) continue;
      const data = await this.readFrontmatter(file);
      if (typeof data.slug === 'string') slugs.push(data.slug);
    }
    return slugs;
  }

  private async addFrontmatter(file: TFile): Promise<string[]> {
    if (!this.active || !this.isSupported(file)) return [];
    const current = await this.readFrontmatter(file);
    if (isShortPath(file.path)) {
      if (!missingShortFields(current).length) return [];
      const defaults = createShortDefaults(this.settings);
      if (!this.active || !isShortPath(file.path)) return [];
      let added: string[] = [];
      await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        added = applyShortDefaults(frontmatter, defaults);
      });
      return added;
    }
    const missing = missingFields(current);
    if (!missing.length) return [];
    const slug = missing.includes('slug') ? uniqueSlug(file.basename, await this.usedSlugs(file)) : '';
    const defaults = createDefaults(file.basename, slug, this.settings);
    if (!this.active || !this.isPost(file)) return [];
    let added: string[] = [];
    await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
      added = applyDefaults(frontmatter, defaults);
    });
    return added;
  }

  updateSettings(changes: Partial<BlogSettings>): Promise<void> {
    const result = this.settingsPending.then(async () => {
      const previous = this.settings;
      const next = { ...previous, ...changes };
      next.targetFolder = normalizePostFolder(next.targetFolder);
      this.settings = next;
      try { await this.saveData(next); }
      catch (error) {
        this.settings = previous;
        throw error;
      }
    });
    this.settingsPending = result.catch(() => undefined);
    return result;
  }

  createPost(titleInput: string): Promise<void> {
    return this.enqueue(async () => {
      if (!this.active) return;
      const title = titleInput.trim().normalize('NFC');
      if (!title) throw new Error('제목을 입력하세요.');
      const folder = normalizePostFolder(this.settings.targetFolder);
      const path = normalizePath(`${folder}/${filenameForTitle(title)}`);
      if (this.app.vault.getAbstractFileByPath(path)) throw new Error(`같은 파일이 있습니다: ${path}`);
      const slug = uniqueSlug(title, await this.usedSlugs());
      const defaults = createDefaults(title, slug, this.settings);
      if (!this.active) return;
      await this.ensureFolder(folder);
      if (!this.active) return;
      const file = await this.app.vault.create(path, `---\n${stringifyYaml(defaults)}---\n\n`);
      await this.app.workspace.getLeaf(false).openFile(file);
    });
  }

  createShort(input: ShortInput): Promise<void> {
    return this.enqueue(async () => {
      if (!this.active) return;
      const value = normalizeShort(input);
      const date = new Date();
      const { date: timestamp, ...defaults } = createShortDefaults(this.settings, date);
      const frontmatter = { ...defaults, ...(value.link ? { link: value.link } : {}), ...(value.linkTitle ? { linkTitle: value.linkTitle } : {}) };
      const body = value.body;
      const content = `---\ndate: ${JSON.stringify(timestamp)}\n${stringifyYaml(frontmatter)}---\n\n${body}${body.endsWith('\n') ? '' : '\n'}`;
      await this.ensureFolder(SHORTS_FOLDER);
      for (let suffix = 1; this.active; suffix++) {
        const path = normalizePath(`${SHORTS_FOLDER}/${filenameForShort(date, suffix)}`);
        if (this.app.vault.getAbstractFileByPath(path)) continue;
        let file: TFile;
        try { file = await this.app.vault.create(path, content); }
        catch (error) {
          // A different vault writer may have claimed the same timestamp after the check.
          if (this.app.vault.getAbstractFileByPath(path)) continue;
          throw error;
        }
        if (this.active) await this.app.workspace.getLeaf(false).openFile(file);
        return;
      }
    });
  }

  private async ensureFolder(folder: string): Promise<void> {
    let parent = '';
    for (const part of folder.split('/')) {
      if (!this.active) return;
      parent = parent ? `${parent}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(parent);
      if (existing && !(existing instanceof TFolder)) throw new Error(`폴더 위치에 파일이 있습니다: ${parent}`);
      if (!existing) await this.app.vault.createFolder(parent);
    }
  }
}
