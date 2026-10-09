/**
 * Regenerates shared/src/generated/goal.ts from the library's JSON Schema.
 * The schema is the source of truth; never hand-edit the generated file.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { compile } from 'json-schema-to-typescript';
import { GENERATED_TYPES_FILE, SCHEMA_FILE } from './library-paths.ts';

const schema = JSON.parse(await readFile(SCHEMA_FILE, 'utf8'));

const ts = await compile(schema, 'GoalFile', {
  bannerComment: [
    '/* eslint-disable */',
    '/**',
    ' * AUTO-GENERATED from library/FreeMentor_Library/schema/goal.schema.json.',
    ' * Run `npm run types -w shared` to regenerate. Do not edit by hand.',
    ' *',
    ' * The schema leaves `scheduler_hints` and a few other objects untyped;',
    ' * narrower, hand-written types live in ../hints.ts and ../library.ts.',
    ' */',
  ].join('\n'),
  additionalProperties: false,
  style: { singleQuote: true },
});

await mkdir(dirname(GENERATED_TYPES_FILE), { recursive: true });
await writeFile(GENERATED_TYPES_FILE, ts, 'utf8');
console.log(`Wrote ${GENERATED_TYPES_FILE} (${ts.length} bytes)`);
