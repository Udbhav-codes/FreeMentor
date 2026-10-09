/**
 * Copies catalog.json out of the library and into the app bundle.
 * The library stays the single source of truth; this is a build step, so the
 * catalog is never hand-edited inside the app (CLAUDE.md).
 */
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../../library/FreeMentor_Library/catalog.json');
const dest = resolve(here, '../src/catalog/catalog.json');

await mkdir(dirname(dest), { recursive: true });
await copyFile(src, dest);
const { size } = await stat(dest);
console.log(`catalog.json -> app/src/catalog/ (${(size / 1024).toFixed(0)} KB)`);
