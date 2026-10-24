import { readFile, readdir, writeFile, access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const permissive = new Set(['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'Unlicense', 'CC0-1.0', 'CC-BY-4.0', 'OFL-1.1', 'MIT OR Apache-2.0', '(MPL-2.0 OR Apache-2.0)']);
const upstream = {
  'rehype-katex@7.0.1': { file: 'rehype-katex-7.0.1.txt', url: 'https://github.com/remarkjs/remark-math/blob/88a9497e1ede93b958237c85edbf5651faeca7af/license' },
  'remark-math@6.0.0': { file: 'remark-math-6.0.0.txt', url: 'https://github.com/remarkjs/remark-math/blob/d5d0660b150810a535bbb07eac6cc96a4510aa24/license' },
};
const licenseName = /^(?:licen[sc]e|notice|copying|ofl|thirdpartynoticetext)(?:[.-]|$)/i;

export async function licenseNotices() {
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  const inventory = [];
  const notices = ['Soohyuk blog — third-party licenses\n\nOriginal notices for production dependencies, including fonts and transitive packages. DOMPurify is used under its Apache-2.0 license option. Font files retain their original names and licenses.\n'];
  for (const [location, entry] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    if (!location) continue;
    const directory = path.join(root, location);
    try { await access(path.join(directory, 'package.json')); }
    catch (error) {
      if (entry.optional && error.code === 'ENOENT') continue;
      throw error;
    }
    const installed = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
    if (entry.version !== installed.version) throw new Error(`Installed version differs from lockfile: ${location}`);
    const id = `${installed.name}@${installed.version}`;
    // khroma's published package omits package.json's license field, but ships its MIT license.
    const license = installed.license || entry.license || (id === 'khroma@2.1.0' ? 'MIT' : undefined);
    const buildOnlyCopyleft = entry.dev && ['MPL-2.0', 'LGPL-3.0-or-later'].includes(license);
    if (!permissive.has(license) && !buildOnlyCopyleft) throw new Error(`License review required: ${id}: ${license}`);
    inventory.push(`| ${id} | ${license} | ${entry.dev ? 'build / test only' : 'production'} |`);
    if (entry.dev) continue;
    const names = (await readdir(directory, { withFileTypes: true })).filter(file => file.isFile() && licenseName.test(file.name)).map(file => file.name).sort();
    const texts = await Promise.all(names.map(async name => `[${name}]\n${await readFile(path.join(directory, name), 'utf8')}`));
    if (upstream[id]) {
      const source = upstream[id];
      texts.push(`[Upstream license at exact published commit: ${source.url}]\n${await readFile(path.join(root, 'licenses/upstream', source.file), 'utf8')}`);
    }
    if (!texts.length) throw new Error(`Missing original license notice: ${id}`);
    if (id === 'khroma@2.1.0' && !texts.some(text => text.includes('The MIT License (MIT)'))) throw new Error('khroma license changed; review required');
    notices.push(`\n${'='.repeat(72)}\n${id} — ${license}\n${'='.repeat(72)}\n${texts.join('\n\n')}`);
  }
  return {
    text: notices.join('\n'),
    inventory: `# Third-party dependencies\n\nExact installed versions from package-lock.json, including indirect dependencies. Production license originals are shipped at /third-party-notices.txt. Build/test tools are not included in the deployed website; their source distributions retain their own notices. DOMPurify's Apache-2.0 option is selected.\n\n| Package | License | Use |\n| --- | --- | --- |\n${inventory.join('\n')}\n`,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const notices = await licenseNotices();
  await mkdir(path.join(root, '.cache/public'), { recursive: true });
  await writeFile(path.join(root, '.cache/public/third-party-notices.txt'), notices.text);
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeFile(path.join(root, 'docs/THIRD_PARTY_NOTICES.md'), notices.inventory);
  console.log('Verified dependency versions/licenses and preserved production license originals.');
}
