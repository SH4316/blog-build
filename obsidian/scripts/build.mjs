import { build, context } from 'esbuild';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root, verifyLicenses } from './licenses.mjs';

const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const output = path.join(root, 'dist', manifest.id);
const notices = await verifyLicenses();
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const relative of ['manifest.json', 'styles.css', 'LICENSE', ...notices]) {
  const destination = path.join(output, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(path.join(root, relative), destination);
}
const watch = process.argv.includes('--watch');
const options = {
  absWorkingDir: root,
  entryPoints: ['src/main.ts'],
  outfile: path.join(output, 'main.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  external: ['obsidian'],
  minify: !watch,
  metafile: true,
  plugins: [{ name: 'bundle-manifest', setup(builder) {
    builder.onEnd(async result => {
      if (result.metafile) await writeFile(path.join(root, 'dist/build-meta.json'), JSON.stringify(result.metafile, null, 2));
    });
  } }],
};
if (watch) {
  const builder = await context(options);
  await builder.watch();
  console.log(`Watching src/. Output: ${output}`);
} else {
  await build(options);
  console.log(`Built ${output}`);
}
