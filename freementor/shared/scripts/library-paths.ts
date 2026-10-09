import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/** The authoring library that ships in the dev kit. Never edited by the app. */
export const LIBRARY_DIR = resolve(here, '../../../library/FreeMentor_Library');
export const SCHEMA_FILE = resolve(LIBRARY_DIR, 'schema/goal.schema.json');
export const CATALOG_FILE = resolve(LIBRARY_DIR, 'catalog.json');
export const GOALS_DIR = resolve(LIBRARY_DIR, 'goals');

/** Generated output inside shared/. */
export const GENERATED_TYPES_FILE = resolve(here, '../src/generated/goal.ts');
