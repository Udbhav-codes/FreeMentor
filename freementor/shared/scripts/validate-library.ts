/**
 * Validates every goal file against goal.schema.json, then enforces the
 * product rules from CLAUDE.md that the schema cannot express.
 *
 * This runs in CI. A failure here means the library would break the app.
 */
import { readFile, readdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { CATALOG_FILE, GOALS_DIR, SCHEMA_FILE } from './library-paths.ts';

type Problem = { file: string; rule: string; detail: string };
const problems: Problem[] = [];
const warnings: Problem[] = [];

const fail = (file: string, rule: string, detail: string) =>
  problems.push({ file, rule, detail });
const warn = (file: string, rule: string, detail: string) =>
  warnings.push({ file, rule, detail });

const schema = JSON.parse(await readFile(SCHEMA_FILE, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const catalog = JSON.parse(await readFile(CATALOG_FILE, 'utf8'));
const catalogById = new Map<string, any>(catalog.goals.map((g: any) => [g.id, g]));

const goalFiles = (await readdir(GOALS_DIR)).filter((f) => f.endsWith('.json')).sort();

// Block ids are the primary key of task_progress, so they must be unique
// across the whole goal file — a collision would silently merge two tasks.
for (const file of goalFiles) {
  const id = basename(file, '.json');
  const doc = JSON.parse(await readFile(resolve(GOALS_DIR, file), 'utf8'));

  if (!validate(doc)) {
    for (const err of validate.errors ?? []) {
      fail(file, 'schema', `${err.instancePath || '/'} ${err.message}`);
    }
  }

  // --- catalog agreement -------------------------------------------------
  const entry = catalogById.get(doc.goal?.id);
  if (!entry) fail(file, 'catalog', `goal.id "${doc.goal?.id}" is not in catalog.json`);
  else {
    if (entry.status !== 'full')
      fail(file, 'catalog', `catalog marks "${entry.id}" as "${entry.status}" but a roadmap file exists`);
    if (id !== doc.goal.id)
      fail(file, 'catalog', `filename "${id}" does not match goal.id "${doc.goal.id}"`);
  }

  // --- referential integrity --------------------------------------------
  const topicsById = new Map<string, any>(doc.topics.map((t: any) => [t.id, t]));
  if (topicsById.size !== doc.topics.length)
    fail(file, 'ids', 'duplicate topic id');

  const blockIds = new Set<string>();
  const phaseOrders = new Set<number>();

  for (const phase of doc.phases) {
    if (phaseOrders.has(phase.order)) fail(file, 'phases', `duplicate phase order ${phase.order}`);
    phaseOrders.add(phase.order);
    for (const tid of phase.topic_ids) {
      const t = topicsById.get(tid);
      if (!t) fail(file, 'phases', `phase "${phase.id}" lists unknown topic "${tid}"`);
      else if (t.phase !== phase.order)
        fail(file, 'phases', `topic "${tid}" has phase ${t.phase} but is listed under phase order ${phase.order}`);
    }
  }

  const orphanTopics = doc.topics.filter(
    (t: any) => !doc.phases.some((p: any) => p.topic_ids.includes(t.id)),
  );
  if (orphanTopics.length)
    fail(file, 'phases', `${orphanTopics.length} topic(s) belong to no phase, e.g. "${orphanTopics[0].id}"`);

  for (const topic of doc.topics) {
    // Scheduler sorts by (phase, order); a tie is non-deterministic.
    for (const block of topic.blocks) {
      if (blockIds.has(block.id)) fail(file, 'ids', `duplicate block id "${block.id}"`);
      blockIds.add(block.id);

      if (!Number.isInteger(block.est_minutes) || block.est_minutes <= 0)
        fail(file, 'time', `block "${block.id}" has est_minutes ${block.est_minutes}`);

      for (const r of block.resources ?? []) {
        // --- the non-negotiable YouTube rule (CLAUDE.md) -----------------
        if (r.type === 'video') {
          if (r.ad_gate_allowed !== false)
            fail(file, 'youtube-policy', `video "${r.url}" has ad_gate_allowed=${r.ad_gate_allowed}`);
          if (r.access !== 'all')
            fail(file, 'youtube-policy', `video "${r.url}" has access="${r.access}" (must be "all")`);
        }
        if (typeof r.url !== 'string' || !r.url.startsWith('https://'))
          fail(file, 'links', `non-https resource url: ${r.url}`);
        if (r.status === 'broken')
          fail(file, 'links', `resource marked broken: ${r.url}`);
      }
    }

    // Duplicate (phase, order) makes the schedule order undefined.
    if (doc.goal.type !== 'exam' && topic.recall?.length !== 3)
      warn(file, 'recall', `topic "${topic.id}" has ${topic.recall?.length ?? 0} recall questions (spec says 3)`);
  }

  const seen = new Set<string>();
  for (const t of doc.topics) {
    const key = `${t.phase}/${t.order}`;
    if (seen.has(key)) fail(file, 'order', `two topics share phase/order ${key} — schedule order is ambiguous`);
    seen.add(key);
  }

  for (const m of doc.milestones ?? []) {
    if (!phaseOrders.has(m.after_phase))
      fail(file, 'milestones', `milestone "${m.id}" is after_phase ${m.after_phase}, which does not exist`);
  }

  // --- data readiness (warn only; check_links.py fills these) ------------
  const resources = doc.topics.flatMap((t: any) => t.blocks.flatMap((b: any) => b.resources ?? []));
  const videos = resources.filter((r: any) => r.type === 'video');
  const unverified = resources.filter((r: any) => r.status === 'unverified').length;
  const noDuration = videos.filter((r: any) => r.duration_seconds == null).length;
  if (unverified) warn(file, 'readiness', `${unverified}/${resources.length} resources still "unverified"`);
  if (noDuration) warn(file, 'readiness', `${noDuration}/${videos.length} videos have no real duration yet`);
}

// --- catalog side: every "full" goal must have a file ---------------------
for (const g of catalog.goals) {
  if (g.status === 'full' && !goalFiles.includes(`${g.id}.json`))
    fail('catalog.json', 'catalog', `goal "${g.id}" is marked full but goals/${g.id}.json is missing`);
}

// --- report ---------------------------------------------------------------
const byRule = (list: Problem[]) => {
  const m = new Map<string, number>();
  for (const p of list) m.set(p.rule, (m.get(p.rule) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};

console.log(`Validated ${goalFiles.length} goal files against goal.schema.json\n`);

if (warnings.length) {
  console.log(`warnings (${warnings.length}):`);
  for (const [rule, n] of byRule(warnings)) console.log(`  ${rule.padEnd(16)} ${n}`);
  for (const w of warnings.slice(0, 5)) console.log(`    e.g. ${w.file}: ${w.detail}`);
  console.log('');
}

if (problems.length) {
  console.error(`FAILED — ${problems.length} problem(s):`);
  for (const [rule, n] of byRule(problems)) console.error(`  ${rule.padEnd(16)} ${n}`);
  console.error('');
  for (const p of problems.slice(0, 40)) console.error(`  ${p.file} [${p.rule}] ${p.detail}`);
  if (problems.length > 40) console.error(`  ... and ${problems.length - 40} more`);
  process.exit(1);
}

console.log('All goal files pass schema + product rules.');
