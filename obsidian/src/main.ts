import {
  App, getFrontMatterInfo, Modal, normalizePath, Notice, parseYaml, Plugin,
  PluginSettingTab, Setting, stringifyYaml, TFile, TFolder,
} from 'obsidian';
import {
  applyDefaults, BlogSettings, createDefaults, filenameForTitle, isPostPath,
  loadSettings, missingFields, normalizeFolder, parseTags, uniqueSlug,
} from './frontmatter';

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default class BlogFrontmatterPlugin extends Plugin {
  settings: BlogSettings = loadSettings(null);
  private pending: Promise<unknown> = Promise.resolve();
  private active = false;

  async onload(): Promise<void> {
    this.settings = loadSettings(await this.loadData());
    this.active = true;
    this.addSettingTab(new BlogSettingsTab(this.app, this));

    this.addCommand({
      id: 'add-current-frontmatter',
      name: '현재 글 frontmatter 추가',
      checkCallback: checking => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.isPost(file)) return false;
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

    this.app.workspace.onLayoutReady(() => {
      if (!this.active) return;
      this.registerEvent(this.app.vault.on('create', file => {
        if (!this.active || !this.settings.autoAdd || !(file instanceof TFile) || !this.isPost(file)) return;
        void this.enqueue(async () => {
          if (this.active && this.settings.autoAdd && this.isPost(file)) await this.addFrontmatter(file);
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
    if (!this.active || !this.isPost(file)) return [];
    const current = await this.readFrontmatter(file);
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

  async updateSettings(changes: Partial<BlogSettings>): Promise<void> {
    const previous = this.settings;
    this.settings = { ...previous, ...changes };
    try { await this.saveData(this.settings); }
    catch (error) {
      this.settings = previous;
      throw error;
    }
  }

  createPost(titleInput: string): Promise<void> {
    return this.enqueue(async () => {
      if (!this.active) return;
      const title = titleInput.trim().normalize('NFC');
      if (!title) throw new Error('제목을 입력하세요.');
      const folder = this.settings.targetFolder;
      const path = normalizePath(`${folder}/${filenameForTitle(title)}`);
      if (this.app.vault.getAbstractFileByPath(path)) throw new Error(`같은 파일이 있습니다: ${path}`);
      const slug = uniqueSlug(title, await this.usedSlugs());
      const defaults = createDefaults(title, slug, this.settings);
      if (!this.active) return;
      let parent = '';
      for (const part of folder.split('/')) {
        parent = parent ? `${parent}/${part}` : part;
        const existing = this.app.vault.getAbstractFileByPath(parent);
        if (existing && !(existing instanceof TFolder)) throw new Error(`폴더 위치에 파일이 있습니다: ${parent}`);
        if (!existing) await this.app.vault.createFolder(parent);
      }
      const file = await this.app.vault.create(path, `---\n${stringifyYaml(defaults)}---\n\n`);
      await this.app.workspace.getLeaf(false).openFile(file);
    });
  }
}

class BlogSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly blog: BlogFrontmatterPlugin) {
    super(app, blog);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const folder = new Setting(containerEl).setName('글 폴더').setDesc('보관함 기준 경로. 하위 폴더도 포함합니다.');
    folder.addText(text => text.setValue(this.blog.settings.targetFolder).onChange(async value => {
      try {
        const targetFolder = normalizeFolder(value);
        const existing = this.app.vault.getAbstractFileByPath(targetFolder);
        if (existing && !(existing instanceof TFolder)) throw new Error('같은 경로에 파일이 있습니다.');
        await this.blog.updateSettings({ targetFolder: normalizePath(targetFolder) });
        text.inputEl.removeAttribute('aria-invalid');
        folder.setDesc('보관함 기준 경로. 하위 폴더도 포함합니다.');
      } catch (error) {
        text.inputEl.setAttribute('aria-invalid', 'true');
        folder.setDesc(`${message(error)} 기존 설정을 유지합니다.`);
      }
    }));

    const tags = new Setting(containerEl).setName('기본 태그').setDesc('쉼표로 구분합니다. 비워 두면 빈 목록을 추가합니다.');
    tags.addText(text => text.setValue(this.blog.settings.defaultTags.join(', ')).onChange(async value => {
      try {
        await this.blog.updateSettings({ defaultTags: parseTags(value) });
        text.inputEl.removeAttribute('aria-invalid');
        tags.setDesc('쉼표로 구분합니다. 비워 두면 빈 목록을 추가합니다.');
      } catch (error) {
        text.inputEl.setAttribute('aria-invalid', 'true');
        tags.setDesc(`${message(error)} 기존 설정을 유지합니다.`);
      }
    }));

    new Setting(containerEl).setName('새 글에 자동 추가').addToggle(toggle => toggle
      .setValue(this.blog.settings.autoAdd).onChange(async autoAdd => {
        try { await this.blog.updateSettings({ autoAdd }); }
        catch { toggle.setValue(this.blog.settings.autoAdd); new Notice('설정을 저장하지 못했습니다.'); }
      }));
    new Setting(containerEl).setName('기본 초안 상태').setDesc('켜면 새 글에 draft: true를 추가합니다.').addToggle(toggle => toggle
      .setValue(this.blog.settings.draft).onChange(async draft => {
        try { await this.blog.updateSettings({ draft }); }
        catch { toggle.setValue(this.blog.settings.draft); new Notice('설정을 저장하지 못했습니다.'); }
      }));
  }
}

class NewPostModal extends Modal {
  constructor(app: App, private readonly blog: BlogFrontmatterPlugin) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.createEl('h2', { text: '새 블로그 글' });
    let title = '';
    let submitting = false;
    const errorEl = this.contentEl.createEl('p', { attr: { role: 'alert' } });
    const input = new Setting(this.contentEl).setName('제목');
    const submit = async (): Promise<void> => {
      if (submitting) return;
      submitting = true;
      try { await this.blog.createPost(title); this.close(); }
      catch (error) { errorEl.setText(message(error)); }
      finally { submitting = false; }
    };
    input.addText(text => {
      text.setPlaceholder('글 제목').onChange(value => { title = value; });
      text.inputEl.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); void submit(); }
      });
      text.inputEl.focus();
    });
    new Setting(this.contentEl).addButton(button => button.setButtonText('만들기').setCta().onClick(submit));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
