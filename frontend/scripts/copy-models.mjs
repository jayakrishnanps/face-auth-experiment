import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { mkdir, copyFile, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const source = resolve(dirname(require.resolve('@vladmandic/human')), '../models');
const destination = resolve(import.meta.dirname, '../public/models');
await mkdir(destination, { recursive: true });
// Pin the three required models to the installed Human package, without a runtime CDN.
for (const name of ['blazeface', 'facemesh', 'faceres']) {
  const file = `${name}.json`;
  const manifest = JSON.parse(await readFile(resolve(source, file), 'utf8'));
  await copyFile(resolve(source, file), resolve(destination, file));
  for (const group of manifest.weightsManifest) {
    for (const shard of group.paths)
      await copyFile(resolve(source, shard), resolve(destination, shard));
  }
}
console.log('Human face models copied to frontend/public/models.');
