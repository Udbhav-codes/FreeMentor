# freementor

Monorepo for the FreeMentor app. Read `../CLAUDE.md` first, then `../docs/APP_BUILD_SPEC.md`.

```
shared/   TS types generated from the library JSON Schema + the library validator
app/      the React Native (Expo) app — currently only the scheduler
admin/    React admin panel (not started)
```

The library itself is **not** in here. It stays at `../library/FreeMentor_Library/` and is
referenced by path, so there is one copy of the 2.7 MB of goal files.

`app/src/catalog/catalog.json` is **generated** from the library by `app/scripts/sync-catalog.mjs`
and is git-ignored. It is written by `npm install` (the `prepare` hook) and again before
`npm start`, so the library stays the single source of truth and nothing is hand-edited
in the app — see CLAUDE.md.

## Commands

```bash
npm install                  # once, from this directory — also generates app/src/catalog/catalog.json
npm run validate:library     # schema + product rules over all 12 goal files (CI gate)
npm run types                # regenerate shared/src/generated/goal.ts from the schema
npm test -w app              # the scheduler suite
```

Inspect a real generated plan by eye:

```bash
npx tsx app/src/scheduler/__tests__/inspect.ts neet-ug 180
```

## The scheduler

`app/src/scheduler/` is a **pure** module: `(goal file, settings, progress, today) -> plan`.
No clock, no network, no database — which is the only reason the 13 rules in
APP_BUILD_SPEC §4 can be tested at all.

| File | What it owns |
|---|---|
| `dates.ts` | ISO calendar-day arithmetic via UTC noon (IST must never shift a day) |
| `time.ts` | rule 3 — video time = duration x 1.15 rounded up to 5 min |
| `order.ts` | rules 1, 7, 13 — phase order, subject interleaving, CUET track gates |
| `expand.ts` | rule 2 — a topic becomes learn -> read -> practice -> recall -> test |
| `plan.ts` | rules 4, 5, 6, 8, 10, 11, 12 — day packing and the whole plan |

**Rule 9 (reserve the final 15% for mocks and revision) is not implemented yet.**
`totals.reservedMinutes` reports the figure but no days are held back for it.
