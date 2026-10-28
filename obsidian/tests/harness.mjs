import { buildSync } from 'esbuild';
import vm from 'node:vm';
import { parse, stringify } from 'yaml';

const source = buildSync({ entryPoints: ['src/main.ts'], bundle: true, format: 'cjs', platform: 'browser', external: ['obsidian'], write: false }).outputFiles[0].text;

export function frontmatterInfo(content) {
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  return match ? { exists: true, frontmatter: match[1], contentStart: match[0].length } : { exists: false, frontmatter: '', contentStart: 0 };
}

export function metadata(raw) {
  return parse(frontmatterInfo(raw).frontmatter) || {};
}

export function note(fields, body = '\n본문입니다.\n') {
  return `---\n${stringify(fields)}---\n${body}`;
}

export async function harness(settings, initial = {}, options = {}) {
  const files = new Map();
  const contents = new Map();
  const listeners = new Map();
  const ready = [];
  const notices = [];
  const writes = [];
  const controls = [];
  const opened = [];
  const modals = [];

  class TFile {
    constructor(path) { this.path = path; }
    get extension() { return this.path.split('.').at(-1); }
    get basename() { return this.path.split('/').at(-1).replace(/\.[^.]+$/, ''); }
  }
  class TFolder { constructor(path) { this.path = path; } }
  class Element {
    attrs = new Map();
    children = [];
    classes = new Set();
    listeners = new Map();
    empty() { this.children = []; }
    createEl(tag, options = {}) {
      const element = new Element();
      element.tag = tag;
      element.text = options.text || '';
      if (options.cls) element.addClass(options.cls);
      for (const [name, value] of Object.entries(options.attr || {})) element.setAttribute(name, value);
      this.children.push(element);
      return element;
    }
    addClass(name) { this.classes.add(name); }
    setText(text) { this.text = text; }
    setAttribute(name, value) { this.attrs.set(name, value); }
    removeAttribute(name) { this.attrs.delete(name); }
    addEventListener(event, callback) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event).push(callback);
    }
    dispatch(event, details = {}) {
      const input = { preventDefault() { this.defaultPrevented = true; }, ...details };
      for (const callback of this.listeners.get(event) || []) callback(input);
      return input;
    }
    focus() { this.focused = true; }
  }
  class Control {
    inputEl = new Element();
    setValue(value) { this.value = value; return this; }
    setPlaceholder() { return this; }
    onChange(callback) { this.change = callback; return this; }
    setButtonText(text) { this.buttonText = text; return this; }
    setDisabled(disabled) { this.disabled = disabled; return this; }
    setCta() { return this; }
    onClick(callback) { this.click = callback; return this; }
  }
  class Setting {
    constructor(container) { this.container = container; controls.push(this); }
    setClass(name) { this.className = name; return this; }
    setName(name) { this.name = name; return this; }
    setDesc(description) { this.description = description; return this; }
    addText(callback) { this.text = new Control(); callback(this.text); return this; }
    addTextArea(callback) { this.textArea = new Control(); callback(this.textArea); return this; }
    addToggle(callback) { this.toggle = new Control(); callback(this.toggle); return this; }
    addButton(callback) {
      this.button = new Control();
      this.buttons ||= [];
      this.buttons.push(this.button);
      callback(this.button);
      return this;
    }
  }
  class Plugin {
    constructor(app) { this.app = app; this.commands = []; this.tabs = []; this.events = []; }
    async loadData() { return settings; }
    async saveData(data) { this.saved = data; }
    addCommand(command) { this.commands.push(command); }
    addSettingTab(tab) { this.tabs.push(tab); }
    registerEvent(event) { this.events.push(event); }
  }
  class PluginSettingTab {
    constructor(app) { this.app = app; this.containerEl = new Element(); }
  }
  class Modal {
    constructor(app) { this.app = app; this.contentEl = new Element(); modals.push(this); }
    open() { this.isOpen = true; this.onOpen(); }
    close() { this.isOpen = false; this.onClose(); }
  }
  class Notice { constructor(text) { notices.push(text); } }
  const vault = {
    on(event, callback) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(callback);
      return { event, callback };
    },
    emit(event, ...args) { for (const callback of listeners.get(event) || []) callback(...args); },
    async read(file) {
      if (!contents.has(file.path)) throw new Error(`File not found: ${file.path}`);
      return contents.get(file.path);
    },
    getMarkdownFiles() { return [...files.values()].filter(file => file instanceof TFile && file.extension.toLowerCase() === 'md'); },
    getAbstractFileByPath(path) { return files.get(path) || null; },
    async createFolder(path) {
      const folder = new TFolder(path);
      files.set(path, folder);
      vault.emit('create', folder);
      return folder;
    },
    async create(path, content) {
      if (files.has(path)) throw new Error(`File exists: ${path}`);
      const file = new TFile(path);
      files.set(path, file);
      contents.set(path, content);
      vault.emit('create', file);
      return file;
    },
    rename(file, path) {
      const previous = file.path;
      files.delete(previous);
      files.set(path, file);
      contents.set(path, contents.get(previous));
      contents.delete(previous);
      file.path = path;
      vault.emit('rename', file, previous);
    },
  };
  for (const [path, raw] of Object.entries(initial)) {
    files.set(path, new TFile(path));
    contents.set(path, raw);
  }
  const app = {
    vault,
    workspace: {
      active: null,
      onLayoutReady(callback) { ready.push(callback); },
      getActiveFile() { return this.active; },
      getLeaf() { return { async openFile(file) { opened.push(file); } }; },
    },
    fileManager: {
      async processFrontMatter(file, callback) {
        const raw = await vault.read(file);
        const info = frontmatterInfo(raw);
        const data = info.exists ? parse(info.frontmatter) || {} : {};
        callback(data);
        contents.set(file.path, note(data, raw.slice(info.contentStart)));
        writes.push(file.path);
      },
    },
  };
  const module = { exports: {} };
  const obsidian = {
    Plugin, PluginSettingTab, Setting, Modal, Notice, TFile, TFolder,
    getFrontMatterInfo: frontmatterInfo,
    parseYaml: parse,
    stringifyYaml: stringify,
    normalizePath: path => path.replace(/\\/g, '/').replace(/\/{2,}/g, '/'),
  };
  const ClockDate = options.now ? class extends Date {
    constructor(...args) { super(...(args.length ? args : [options.now])); }
    static now() { return new Date(options.now).getTime(); }
  } : Date;
  vm.runInNewContext(source, { module, exports: module.exports, URL, Date: ClockDate, require: name => {
    if (name !== 'obsidian') throw new Error(`Unexpected runtime dependency: ${name}`);
    return obsidian;
  } });
  const plugin = new module.exports.default(app);
  await plugin.onload();
  return {
    plugin, app, vault, contents, files, notices, writes, controls, opened, modals,
    ready() { for (const callback of ready) callback(); },
    async drain() {
      for (let attempt = 0; attempt < 20; attempt++) {
        const pending = plugin.pending;
        await pending;
        if (plugin.pending === pending) return;
      }
      throw new Error('Plugin queue did not settle');
    },
  };
}
