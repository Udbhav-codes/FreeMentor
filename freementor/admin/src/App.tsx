/**
 * FreeMentor admin — coupons, learners, the published library (§10.3, §16).
 *
 * Local only. It is never hosted: Vite binds to 127.0.0.1 and the page is
 * noindex. This screen mints discount codes and lists learners, so it has no
 * business being reachable.
 *
 * There is no router. Four tabs in component state is the whole navigation,
 * and a dependency for that would be more code than it saves.
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, getToken, setToken } from './api.ts';
import type { Coupon, LibraryEntry, Learner, Stats, WhoAmI } from './api.ts';
import { TIERS } from './api.ts';

type Tab = 'dashboard' | 'coupons' | 'learners' | 'library';

export default function App() {
  const [who, setWho] = useState<WhoAmI | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');

  const check = useCallback(async () => {
    setChecking(true);
    setGateError(null);
    try {
      setWho(await api.whoami());
    } catch (error) {
      setWho(null);
      setGateError(
        error instanceof ApiError
          ? error.message
          : 'Could not reach the server. Is it running on port 8000?',
      );
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (getToken()) void check();
    else setChecking(false);
  }, [check]);

  if (checking) {
    return (
      <div className="shell">
        <p className="note">Checking…</p>
      </div>
    );
  }

  if (!who) return <Gate error={gateError} onSaved={check} />;

  return (
    <div className="shell">
      <header className="top">
        <h1>
          Free<span className="mentor">Mentor</span> admin
        </h1>
        <span className="local-only">LOCAL ONLY</span>
        <span className="who">
          {who.email}{' '}
          <button
            className="btn ghost"
            onClick={() => {
              setToken('');
              setWho(null);
            }}
          >
            sign out
          </button>
        </span>
      </header>

      <nav className="tabs">
        {(['dashboard', 'coupons', 'learners', 'library'] as Tab[]).map((name) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            aria-current={tab === name ? 'page' : undefined}
          >
            {name[0]!.toUpperCase() + name.slice(1)}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' ? <Dashboard /> : null}
      {tab === 'coupons' ? <Coupons /> : null}
      {tab === 'learners' ? <Learners /> : null}
      {tab === 'library' ? <Library /> : null}
    </div>
  );
}

/** Paste a token. See admin/README.md for the one-liner that mints one. */
function Gate({ error, onSaved }: { error: string | null; onSaved: () => void }) {
  const [value, setValue] = useState('');

  return (
    <div className="shell gate">
      <h1>
        Free<span className="mentor">Mentor</span> admin
      </h1>
      <div className="card">
        <h2>Admin token</h2>
        <label htmlFor="token">Paste a Supabase JWT for an allowlisted admin</label>
        <input
          id="token"
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="eyJ…"
          autoComplete="off"
        />
        <p className="note">
          Mint one with <code className="mono">python -m app.scripts.admin_token</code> in{' '}
          <code className="mono">server/</code>. The address has to be in{' '}
          <code className="mono">ADMIN_EMAILS</code> — an empty setting means nobody is an
          admin. The token is kept for this tab only and is dropped when you close it.
        </p>
        {error ? <p className="error">{error}</p> : null}
        <button
          className="btn"
          style={{ marginTop: 12 }}
          disabled={!value.trim()}
          onClick={() => {
            setToken(value.trim());
            onSaved();
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setData(await load());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void run();
  }, [run]);

  return { data, error, busy, reload: run };
}

function Dashboard() {
  const { data, error, busy } = useLoad<Stats>(() => api.stats());

  if (busy) return <p className="note">Loading…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data) return null;

  const cells: [string, number][] = [
    ['Learners', data.users],
    ['Enrollments', data.enrollments],
    ['Paid purchases', data.purchases],
    ['Active coupons', data.active_coupons],
    ['Goals published', data.goals_published],
  ];

  return (
    <>
      <div className="stats">
        {cells.map(([k, n]) => (
          <div className="stat" key={k}>
            <div className="n">{n}</div>
            <div className="k">{k}</div>
          </div>
        ))}
      </div>
      <p className="note">
        Live from the database this server is pointed at. &ldquo;Paid
        purchases&rdquo; counts confirmed ones only — a pending payment grants nothing.
      </p>
    </>
  );
}

function Coupons() {
  const [filter, setFilter] = useState('');
  const { data, error, busy, reload } = useLoad<Coupon[]>(
    () => api.coupons(filter || undefined),
    [filter],
  );

  const [tier, setTier] = useState<number>(50);
  const [code, setCode] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [validTo, setValidTo] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Coupon | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const create = async () => {
    setCreating(true);
    setFormError(null);
    setCreated(null);
    try {
      const made = await api.createCoupon({
        discount_tier: tier,
        code: code.trim() ? code.trim() : undefined,
        max_uses: maxUses.trim() ? Number(maxUses) : null,
        // A date input gives a plain date; the API wants a timestamp. End of
        // that day, so "valid to the 20th" includes the 20th.
        valid_to: validTo ? new Date(`${validTo}T23:59:59Z`).toISOString() : null,
      });
      setCreated(made);
      setCode('');
      setMaxUses('');
      setValidTo('');
      await reload();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="card">
        <h2>New coupon</h2>
        <div className="row">
          <div>
            <label htmlFor="tier">Discount</label>
            <select id="tier" value={tier} onChange={(e) => setTier(Number(e.target.value))}>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}% off
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="code">Code (blank = generated)</label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="TOPPER426"
              maxLength={9}
            />
          </div>
          <div>
            <label htmlFor="max">Max uses (blank = unlimited)</label>
            <input
              id="max"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ''))}
              placeholder="100"
              inputMode="numeric"
            />
          </div>
          <div>
            <label htmlFor="to">Valid until (optional)</label>
            <input id="to" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
          </div>
          <div className="narrow">
            <button className="btn" onClick={() => void create()} disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
        <p className="note">
          Only these six tiers exist, because each maps to a Play product that has to be
          created in the Play Console first. A coupon for any other percentage would dead-end
          at the payment sheet.
        </p>
        {created ? (
          <p className="ok">
            Created <code className="mono">{created.code}</code> — launches{' '}
            <code className="mono">{created.basic_product_id}</code> or{' '}
            <code className="mono">{created.premium_product_id}</code>.
          </p>
        ) : null}
        {formError ? <p className="error">{formError}</p> : null}
      </div>

      <div className="card">
        <h2>
          Coupons{' '}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: 'auto', minHeight: 30, marginLeft: 8 }}
          >
            <option value="">all</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
            <option value="expired">expired</option>
          </select>
        </h2>
        {busy ? <p className="note">Loading…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {data && data.length === 0 ? (
          <div className="empty">No coupons yet.</div>
        ) : null}
        {data && data.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Off</th>
                <th>Used</th>
                <th>Until</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <code className="mono">{c.code}</code>
                  </td>
                  <td>{c.discount_tier}%</td>
                  <td>
                    {c.used_count}
                    {c.max_uses != null ? ` / ${c.max_uses}` : ''}
                  </td>
                  <td>{c.valid_to ? c.valid_to.slice(0, 10) : '—'}</td>
                  <td>
                    <span className={`pill ${c.status}`}>{c.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn ghost"
                      onClick={() => {
                        void api
                          .setCouponStatus(c.id, c.status === 'active' ? 'archived' : 'active')
                          .then(reload);
                      }}
                    >
                      {c.status === 'active' ? 'Archive' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <p className="note">
          Archiving keeps the row and its usage history — purchases reference it — and stops
          the code working for learners immediately.
        </p>
      </div>
    </>
  );
}

function Learners() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data, error, busy } = useLoad<Learner[]>(
    () => api.learners(query || undefined),
    [query],
  );

  return (
    <div className="card">
      <h2>Learners</h2>
      <div className="row">
        <div>
          <label htmlFor="q">Search by email</label>
          <input
            id="q"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQuery(search);
            }}
            placeholder="name@example.com"
          />
        </div>
        <div className="narrow">
          <button className="btn secondary" onClick={() => setQuery(search)}>
            Search
          </button>
        </div>
      </div>

      {busy ? <p className="note">Loading…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {data && data.length === 0 ? <div className="empty">No learners found.</div> : null}
      {data && data.length > 0 ? (
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Lang</th>
              <th>Goals</th>
              <th>Paid</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.email}{' '}
                  {u.is_minor ? <span className="pill minor">16–17</span> : null}
                  {u.deleted_at ? <span className="pill deleted">deleting</span> : null}
                </td>
                <td>{u.name ?? '—'}</td>
                <td>{u.language}</td>
                <td>{u.enrollments}</td>
                <td>{u.purchases}</td>
                <td>{u.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <p className="note">
        Read only, and deliberately the minimum support needs (§15): no birth year, photo,
        qualification or progress. A learner marked 16–17 only ever sees non-personalised,
        G-rated ads.
      </p>
    </div>
  );
}

function Library() {
  const { data, error, busy } = useLoad<LibraryEntry[]>(() => api.library());

  return (
    <div className="card">
      <h2>Published library</h2>
      {busy ? <p className="note">Loading…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {data && data.length === 0 ? (
        <div className="empty">
          Nothing published yet. Run <code className="mono">python -m app.jobs.publish_library</code>.
        </div>
      ) : null}
      {data && data.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Goal</th>
              <th>Version</th>
              <th>Published</th>
              <th>Checksum</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={`${row.goal_id}-${row.version}`}>
                <td>
                  {row.goal_name ?? row.goal_id}
                  <br />
                  <code className="mono" style={{ color: 'var(--muted)' }}>
                    {row.goal_id}
                  </code>
                </td>
                <td>
                  <code className="mono">{row.version}</code>
                </td>
                <td>{row.published_at ? row.published_at.slice(0, 10) : '—'}</td>
                <td>
                  <code className="mono" style={{ color: 'var(--muted)' }}>
                    {row.checksum ? `${row.checksum.slice(0, 12)}…` : '—'}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <p className="note">
        What the CDN is actually serving, which is not necessarily what is on a laptop —
        publishing is a separate step. Devices notice a new version through{' '}
        <code className="mono">versions.json</code> and re-download only what changed.
      </p>
    </div>
  );
}
