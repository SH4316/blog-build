import { App, Modal, normalizePath, Notice, PluginSettingTab, Setting, TFolder } from 'obsidian';
import type { ButtonComponent } from 'obsidian';
import { normalizeFolder, parseTags } from './frontmatter';
import type BlogFrontmatterPlugin from './main';

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class BlogSettingsTab extends PluginSettingTab {
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

    new Setting(containerEl).setName('짧은 글 폴더').setDesc('shorts/에 저장합니다. 새 짧은 글 명령으로 본문과 링크를 추가하세요.');

    const tags = new Setting(containerEl).setName('기본 태그').setDesc('블로그 글에만 적용합니다. 쉼표로 구분하며 비워 두면 빈 목록을 추가합니다.');
    tags.addText(text => text.setValue(this.blog.settings.defaultTags.join(', ')).onChange(async value => {
      try {
        await this.blog.updateSettings({ defaultTags: parseTags(value) });
        text.inputEl.removeAttribute('aria-invalid');
        tags.setDesc('블로그 글에만 적용합니다. 쉼표로 구분하며 비워 두면 빈 목록을 추가합니다.');
      } catch (error) {
        text.inputEl.setAttribute('aria-invalid', 'true');
        tags.setDesc(`${message(error)} 기존 설정을 유지합니다.`);
      }
    }));

    new Setting(containerEl).setName('새 글에 자동 추가').setDesc('블로그 글과 짧은 글에 각 형식의 기본 속성을 추가합니다.').addToggle(toggle => toggle
      .setValue(this.blog.settings.autoAdd).onChange(async autoAdd => {
        try { await this.blog.updateSettings({ autoAdd }); }
        catch { toggle.setValue(this.blog.settings.autoAdd); new Notice('설정을 저장하지 못했습니다.'); }
      }));
    new Setting(containerEl).setName('기본 초안 상태').setDesc('켜면 블로그 글과 짧은 글을 draft: true로 만듭니다.').addToggle(toggle => toggle
      .setValue(this.blog.settings.draft).onChange(async draft => {
        try { await this.blog.updateSettings({ draft }); }
        catch { toggle.setValue(this.blog.settings.draft); new Notice('설정을 저장하지 못했습니다.'); }
      }));
  }
}

export class NewPostModal extends Modal {
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

export class NewShortModal extends Modal {
  constructor(app: App, private readonly blog: BlogFrontmatterPlugin) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.addClass('soohyuk-short-modal');
    this.contentEl.createEl('h2', { text: '새 짧은 글' });
    this.contentEl.createEl('p', {
      text: '짧게 남길 생각이나 다시 읽어볼 링크를 적어보세요.',
      cls: 'soohyuk-short-intro',
    });
    let body = '';
    let link = '';
    let linkTitle = '';
    let submitting = false;
    let submitButton: ButtonComponent;
    const errorEl = this.contentEl.createEl('p', {
      cls: 'soohyuk-short-error', attr: { role: 'alert' },
    });
    const submit = async (): Promise<void> => {
      if (submitting) return;
      submitting = true;
      errorEl.setText('');
      submitButton.setDisabled(true).setButtonText('저장 중…');
      try {
        await this.blog.createShort({ body, link, linkTitle });
        this.close();
      } catch (error) {
        errorEl.setText(message(error));
      } finally {
        submitting = false;
        submitButton.setDisabled(false).setButtonText('만들기');
      }
    };
    const shortcut = (event: KeyboardEvent): void => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.isComposing) {
        event.preventDefault();
        void submit();
      }
    };
    new Setting(this.contentEl).setName('본문').setDesc('링크만 저장해도 됩니다.')
      .setClass('soohyuk-short-field').addTextArea(text => {
        text.setPlaceholder('어떤 생각을 남기고 싶나요?').onChange(value => { body = value; });
        text.inputEl.rows = 5;
        text.inputEl.setAttribute('aria-label', '본문');
        text.inputEl.addEventListener('keydown', shortcut);
        text.inputEl.focus();
      });
    new Setting(this.contentEl).setName('링크 (선택)').setDesc('블로그에서 링크 미리보기를 표시합니다.')
      .setClass('soohyuk-short-field').addText(text => {
        text.setPlaceholder('https://').onChange(value => { link = value; });
        text.inputEl.type = 'url';
        text.inputEl.setAttribute('aria-label', '링크 (선택)');
        text.inputEl.addEventListener('keydown', shortcut);
      });
    new Setting(this.contentEl).setName('링크 제목 (선택)').setDesc('비워 두면 링크의 제목을 사용합니다.')
      .setClass('soohyuk-short-field').addText(text => {
        text.setPlaceholder('직접 표시할 제목').onChange(value => { linkTitle = value; });
        text.inputEl.setAttribute('aria-label', '링크 제목 (선택)');
        text.inputEl.addEventListener('keydown', shortcut);
      });
    this.contentEl.createEl('p', {
      text: this.blog.settings.draft
        ? 'shorts/에 초안으로 저장합니다. 공개하려면 draft를 false로 바꾸세요.'
        : 'shorts/에 저장합니다. 다음 블로그 배포에 포함됩니다.',
      cls: 'soohyuk-short-hint',
    });
    new Setting(this.contentEl).setClass('soohyuk-short-actions')
      .addButton(button => button.setButtonText('취소').onClick(() => this.close()))
      .addButton(button => {
        submitButton = button;
        button.setButtonText('만들기').setCta().onClick(submit);
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
