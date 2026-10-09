import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Catalog } from '@freementor/shared';
import { welcomeCopy } from '../welcome.ts';

const here = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(resolve(here, '../../../../../library/FreeMentor_Library/catalog.json'), 'utf8'),
) as Catalog;

for (const id of process.argv.slice(2)) {
  const goal = catalog.goals.find((g) => g.id === id);
  if (!goal) { console.log(`?? ${id}`); continue; }
  const c = welcomeCopy(goal);
  console.log(`\n${'='.repeat(74)}\n${goal.name}  (${goal.type} · ${goal.group})\n${'='.repeat(74)}`);
  console.log(`${c.brandLead}[${c.brandAccent}]\n`);
  for (const k of ['promise','facts','value','nudge','trust','disclosure'] as const) {
    console.log(`${k.toUpperCase()}\n  ${c[k].replace(/(.{72}\s)/g, '$1\n  ')}\n`);
  }
}
