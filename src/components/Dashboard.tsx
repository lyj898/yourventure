import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  INSTITUTION_TYPES,
  OWNERSHIP_TYPES,
  FS_CITIES,
  type CampusWithCount,
  type FsCity,
  type InstitutionType,
  type OwnershipType,
} from '../lib/types';
import { exportToExcel, type OrgExportRow } from '../lib/exportExcel';
import Login from './Login';
import CampusForm from './CampusForm';
import OrgSection from './OrgSection';
import { SearchIcon, ChevronRight, PlusIcon, DownloadIcon } from './icons';

// City groups in display order, then a trailing bucket for campuses tagged to no city.
const NO_FS_LABEL = 'Other';
const GROUP_ORDER: (FsCity | typeof NO_FS_LABEL)[] = [...FS_CITIES, NO_FS_LABEL];

// After the sports cleanup, this org_type marks running-related orgs; everything
// else counts as a "student org" for the Running / Student filter.
const RUNNING_TYPE = 'UKM Olahraga/Lari';
type OrgFilter = 'All' | 'Running' | 'Student';

export default function Dashboard() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>Setup needed</h1>
          <div className="notice notice-warn">
            Supabase isn’t configured. Copy <code>.env.example</code> to{' '}
            <code>.env.local</code>, add your project URL and anon key, then restart{' '}
            <code>npm run dev</code>.
          </div>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="center-state">
        <span className="spinner" /> Loading…
      </div>
    );
  }

  if (!session) return <Login />;

  return <Directory session={session} />;
}

// ── Directory (authenticated) ────────────────────────────────────────────────
function Directory({ session }: { session: Session }) {
  const [campuses, setCampuses] = useState<CampusWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [fsFilter, setFsFilter] = useState<FsCity | 'All'>('All');
  const [typeFilter, setTypeFilter] = useState<InstitutionType | 'All'>('All');
  const [ownFilter, setOwnFilter] = useState<OwnershipType | 'All'>('All');
  const [orgFilter, setOrgFilter] = useState<OrgFilter>('All');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Lightweight per-org rows (type + contact + reach) driving the org filter and stats.
  const [orgMeta, setOrgMeta] = useState<
    { campus_id: string; org_type: string; follower_count: number | null; email: string | null; whatsapp: string | null }[]
  >([]);

  async function loadCampuses() {
    if (!supabase) return;
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase
      .from('campuses')
      .select('*, student_orgs(count)')
      .order('name', { ascending: true });
    setLoading(false);
    if (error) {
      setLoadError(error.message);
      return;
    }
    const rows: CampusWithCount[] = (data ?? []).map((row: any) => {
      const { student_orgs, ...campus } = row;
      const org_count = Array.isArray(student_orgs) ? student_orgs[0]?.count ?? 0 : 0;
      return { ...campus, org_count };
    });
    setCampuses(rows);
  }

  async function loadOrgMeta() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('student_orgs')
      .select('campus_id, org_type, follower_count, email, whatsapp');
    if (!error && data) setOrgMeta(data as typeof orgMeta);
  }

  // Does an org's type match the current Running / Student filter?
  const orgMatches = (orgType: string) =>
    orgFilter === 'All'
      ? true
      : orgFilter === 'Running'
        ? orgType === RUNNING_TYPE
        : orgType !== RUNNING_TYPE;

  useEffect(() => {
    loadCampuses();
    loadOrgMeta();
  }, []);

  // Keep the table's org count in sync when a detail panel adds/removes orgs.
  function updateCount(campusId: string, count: number) {
    setCampuses((prev) =>
      prev.map((c) => (c.id === campusId ? { ...c, org_count: count } : c)),
    );
  }

  // Count of orgs matching the current org filter, per campus.
  const matchCountByCampus = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orgMeta) {
      if (orgMatches(o.org_type)) m.set(o.campus_id, (m.get(o.campus_id) ?? 0) + 1);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgMeta, orgFilter]);

  // ── Derived: filtered + searched list ─────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campuses.filter((c) => {
      if (fsFilter !== 'All' && c.future_series_city !== fsFilter) return false;
      if (typeFilter !== 'All' && c.type !== typeFilter) return false;
      if (ownFilter !== 'All' && c.ownership !== ownFilter) return false;
      // When filtering by org kind, only show campuses that have a matching org.
      if (orgFilter !== 'All' && !(matchCountByCampus.get(c.id) ?? 0)) return false;
      if (q) {
        const hay = `${c.name} ${c.city} ${c.province}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [campuses, search, fsFilter, typeFilter, ownFilter, orgFilter, matchCountByCampus]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const citiesShown = useMemo(
    () => new Set(filtered.map((c) => c.city)).size,
    [filtered],
  );

  // Org-level rollups for the currently-visible campuses, respecting the org filter.
  const orgStats = useMemo(() => {
    const ids = new Set(filtered.map((c) => c.id));
    const rows = orgMeta.filter((o) => ids.has(o.campus_id) && orgMatches(o.org_type));
    return {
      total: rows.length,
      withEmail: rows.filter((o) => o.email).length,
      withWhatsapp: rows.filter((o) => o.whatsapp).length,
      followers: rows.reduce((sum, o) => sum + (o.follower_count ?? 0), 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, orgMeta, orgFilter]);

  // ── Grouping by city ──────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, CampusWithCount[]>();
    for (const c of filtered) {
      const key = c.future_series_city ?? NO_FS_LABEL;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      label: g,
      rows: map.get(g)!,
    }));
  }, [filtered]);

  async function handleSignOut() {
    localStorage.removeItem('cd_email');
    await supabase?.auth.signOut();
  }

  // Anonymous sessions carry no email, so show the address the user typed at the gate.
  const displayEmail =
    (typeof window !== 'undefined' && localStorage.getItem('cd_email')) ||
    session.user.email ||
    'team';

  // Export the visible campuses + all their student orgs (two sheets). Orgs are fetched
  // live for the filtered campuses so the export reflects the current search/filters.
  async function handleExport() {
    if (!supabase || filtered.length === 0) return;
    setExporting(true);
    try {
      const ids = filtered.map((c) => c.id);
      const nameById = new Map(filtered.map((c) => [c.id, c]));
      const { data, error } = await supabase
        .from('student_orgs')
        .select('*')
        .in('campus_id', ids);
      if (error) throw error;
      const orgs: OrgExportRow[] = (data ?? []).map((o: any) => {
        const campus = nameById.get(o.campus_id);
        return {
          ...o,
          campus_name: campus?.name ?? '',
          campus_city: campus?.city ?? '',
          campus_future_series_city: campus?.future_series_city ?? null,
        };
      });
      exportToExcel(filtered, orgs);
    } catch (e) {
      console.error('Excel export failed', e);
      alert('Export failed — see console for details.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="app-shell">
      {/* Top bar */}
      <header className="topbar">
        <div className="brand">
          <h1>Indonesia Campus Directory</h1>
          <div className="sub">Student-body reference for YOUR Venture outreach</div>
        </div>
        <div className="topbar-actions">
          <div className="search">
            <span className="icon">
              <SearchIcon />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, city, province…"
              aria-label="Search campuses"
            />
          </div>
          <button
            className="btn"
            onClick={handleExport}
            disabled={filtered.length === 0 || exporting}
            title="Export the visible campuses and all their student orgs"
          >
            <DownloadIcon /> {exporting ? 'Exporting…' : 'Download Excel'}
          </button>
          <button className="btn btn-gold" onClick={() => setShowAdd(true)}>
            <PlusIcon /> Add campus
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="filters">
        <div className="filter-cluster">
          <span className="filter-label">Cities</span>
          <div className="pill-group">
            <button
              className={`pill ${fsFilter === 'All' ? 'active' : ''}`}
              onClick={() => setFsFilter('All')}
            >
              All
            </button>
            {FS_CITIES.map((city) => (
              <button
                key={city}
                className={`pill ${fsFilter === city ? 'active' : ''}`}
                onClick={() => setFsFilter(city)}
              >
                {city}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-cluster">
          <span className="filter-label">Type</span>
          <select
            className="select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as InstitutionType | 'All')}
          >
            <option value="All">All</option>
            {INSTITUTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-cluster">
          <span className="filter-label">Ownership</span>
          <select
            className="select"
            value={ownFilter}
            onChange={(e) => setOwnFilter(e.target.value as OwnershipType | 'All')}
          >
            <option value="All">All</option>
            {OWNERSHIP_TYPES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-cluster">
          <span className="filter-label">Orgs</span>
          <select
            className="select"
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value as OrgFilter)}
          >
            <option value="All">All</option>
            <option value="Running">Running</option>
            <option value="Student">Student orgs</option>
          </select>
        </div>

        <button className="btn btn-ghost btn-sm" onClick={handleSignOut} title="Sign out">
          Sign out ({displayEmail})
        </button>
      </div>

      {/* Stats */}
      <div className="stats">
        <span>
          Showing <b>{filtered.length}</b> of <b>{campuses.length}</b> campuses
        </span>
        <span>
          <b>{citiesShown}</b> {citiesShown === 1 ? 'city' : 'cities'} represented
        </span>
        <span>
          <b>{orgStats.total.toLocaleString('en-US')}</b> orgs
        </span>
        <span>
          <b>{orgStats.withEmail.toLocaleString('en-US')}</b> with email
        </span>
        <span>
          <b>{orgStats.withWhatsapp.toLocaleString('en-US')}</b> with WhatsApp
        </span>
        <span>
          <b>{orgStats.followers.toLocaleString('en-US')}</b> IG followers
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="center-state">
          <span className="spinner" /> Loading campuses…
        </div>
      ) : loadError ? (
        <div className="notice notice-err">{loadError}</div>
      ) : filtered.length === 0 ? (
        <div className="center-state">
          No campuses match the current search and filters.
        </div>
      ) : (
        grouped.map((group) => (
          <section key={group.label}>
            <div className="group-label">{group.label}</div>
            <div className="table">
              <div className="thead">
                <div>Campus</div>
                <div>City</div>
                <div>Type</div>
                <div>Ownership</div>
                <div>Orgs</div>
              </div>
              {group.rows.map((c) => {
                const open = expandedId === c.id;
                return (
                  <div key={c.id}>
                    <div
                      className={`trow ${open ? 'open' : ''}`}
                      onClick={() => setExpandedId(open ? null : c.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setExpandedId(open ? null : c.id);
                        }
                      }}
                    >
                      <div className="cell-name">
                        <ChevronRight className={`chev ${open ? 'open' : ''}`} />
                        {c.name}
                      </div>
                      <div className="cell-city tag">
                        {c.city}
                        <span style={{ color: 'var(--line-strong)' }}>
                          {' '}
                          · {c.province}
                        </span>
                      </div>
                      <div className="cell-type tag">{c.type}</div>
                      <div className="cell-own tag">{c.ownership}</div>
                      <div className="cell-count">
                        <span className="count-badge">
                          {orgFilter === 'All'
                            ? c.org_count
                            : matchCountByCampus.get(c.id) ?? 0}
                        </span>
                      </div>
                    </div>
                    {open && (
                      <div className="detail">
                        <OrgSection
                          campusId={c.id}
                          orgFilter={orgFilter}
                          runningType={RUNNING_TYPE}
                          onCountChange={(n) => updateCount(c.id, n)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {showAdd && (
        <CampusForm onClose={() => setShowAdd(false)} onCreated={loadCampuses} />
      )}
    </div>
  );
}
