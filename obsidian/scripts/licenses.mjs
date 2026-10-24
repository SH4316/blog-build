import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
const allowed = new Set(['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD']);
const noticeName = /^(?:licen[sc]e(?:\..*)?|notice(?:\..*)?|thirdpartynoticetext\.txt)$/i;
const hash = data => createHash('sha256').update(data).digest('hex');

export async function verifyLicenses(write = false) {
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  const entries = [];
  const files = new Map();
  for (const [location, info] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    if (!location) continue;
    const name = location.split('node_modules/').at(-1);
    if (!allowed.has(info.license)) throw new Error(`License review required: ${name}@${info.version}: ${info.license}`);
    // esbuild's platform packages share its source/version/license and omit license files.
    const sourceLocation = name.startsWith('@esbuild/') ? 'node_modules/esbuild' : location;
    const sourceRoot = path.join(root, sourceLocation);
    const pkg = JSON.parse(await readFile(path.join(sourceRoot, 'package.json'), 'utf8'));
    if (pkg.version !== info.version || pkg.license !== info.license) throw new Error(`Installed package differs from lockfile: ${name}`);
    const names = (await readdir(sourceRoot)).filter(file => noticeName.test(file)).sort();
    if (!names.length) throw new Error(`Missing license text: ${name}`);
    const notices = [];
    for (const filename of names) {
      const destination = `licenses/${pkg.name.replaceAll('/', '__')}@${pkg.version}/${filename}`;
      const content = await readFile(path.join(sourceRoot, filename));
      files.set(destination, content);
      notices.push({ file: destination, sha256: hash(content) });
    }
    entries.push({ name, version: info.version, license: info.license, developmentOnly: true, optional: info.optional === true, notices });
  }
  const inventory = `${JSON.stringify({ runtime: 'Obsidian host API (external; not bundled)', packages: entries }, null, 2)}\n`;
  const rows = entries.map(entry => `| ${entry.name} | ${entry.version} | ${entry.license} | ${entry.optional ? 'optional build tool' : 'development / test'} |`).join('\n');
  const summary = `# Third-party notices\n\nThe release bundles only this project's code. Obsidian supplies the external host API. All packages below are pinned by package-lock.json and used for development, type checking, building, or tests. Original license and notice texts are preserved under licenses/. Exact file hashes are recorded in THIRD_PARTY_NOTICES.json.\n\nTypeScript's original ThirdPartyNoticeText.txt also preserves its bundled material notices (MIT, Unicode, W3C, CC BY 4.0 and Khronos terms), which permit commercial redistribution without requiring publication of this application's source. esbuild's optional platform binaries share the license of esbuild at the same version.\n\n| Package | Version | License | Use |\n| --- | --- | --- | --- |\n${rows}\n`;
  files.set('THIRD_PARTY_NOTICES.json', Buffer.from(inventory));
  files.set('THIRD_PARTY_NOTICES.md', Buffer.from(summary));
  if (write) await rm(path.join(root, 'licenses'), { recursive: true, force: true });
  for (const [relative, content] of files) {
    const destination = path.join(root, relative);
    if (write) {
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, content);
    } else {
      const actual = await readFile(destination);
      if (!actual.equals(content)) throw new Error(`License notice is stale or changed: ${relative}. Run npm run licenses after review.`);
    }
  }
  return [...files.keys()];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = await verifyLicenses(process.argv.includes('--write'));
  console.log(`Verified lockfile licenses and ${files.length} original notice files.`);
}
