import { execFileSync } from 'node:child_process';
import { rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = new URL('../.cache/public/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const script of ['content.mjs', 'licenses.mjs']) {
  execFileSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], { cwd: root, stdio: 'inherit' });
}
