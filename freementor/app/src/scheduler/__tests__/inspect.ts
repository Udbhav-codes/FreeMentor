import { buildPlan } from '../plan.ts';
import { everyDay, loadGoal, progress, settings } from './fixtures.ts';

const id = process.argv[2] ?? 'python';
const mins = Number(process.argv[3] ?? 120);
const goal = loadGoal(id);
const p = buildPlan({
  goal,
  settings: settings({ minutesByWeekday: everyDay(mins) }),
  progress: progress(),
  today: '2026-10-08',
});

console.log(`content ${Math.round(p.totals.contentMinutes/60)} h + reserve ${Math.round(p.totals.reservedMinutes/60)} h · syllabus done ${p.contentFinish} (${p.totals.contentDays} d) -> exam ready ${p.projectedFinish} (+${p.totals.reserveDays} d) · reserve ${(p.totals.reserveDays/(p.totals.contentDays+p.totals.reserveDays)*100).toFixed(1)}% of timeline`);
console.log(`${goal.goal.name} — ${mins} min/day · library says ${goal.goal.estimated_hours.total} h`);

const show = process.argv[4] === 'tail' ? p.days.slice(-6) : p.days.slice(0, 8);
for (const d of show) {
  console.log(`${d.date} ${d.kind.padEnd(15)} ${String(d.plannedMinutes).padStart(3)}/${d.availableMinutes} min`);
  for (const i of d.items) {
    const part = i.part ? ` [part ${i.part.index}/${i.part.of}]` : '';
    console.log(`   ${String(i.minutes).padStart(3)}m ${i.source.padEnd(13)} ${i.title.slice(0, 62)}${part}`);
  }
}
const idle = p.days.filter((d) => !d.isRestDay && d.plannedMinutes < d.availableMinutes * 0.5).length;
console.log(`\ndays under half-full: ${idle}/${p.days.length}`);
