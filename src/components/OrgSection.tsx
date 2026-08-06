import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  ORG_TYPES,
  CONTACT_TYPES,
  type StudentOrg,
  type OrgFormValues,
} from '../lib/types';
import { PlusIcon, EditIcon, TrashIcon } from './icons';

const EMPTY_FORM: OrgFormValues = {
  name: '',
  org_type: 'Other',
  contact_type: '',
  contact_value: '',
  contact_person: '',
  email: '',
  whatsapp: '',
  follower_count: '',
  notes: '',
};

// Build a clickable URL for a contact based on its type (e.g. an Instagram handle
// -> instagram.com/handle). Returns null for values we can't sensibly link.
function contactHref(type: StudentOrg['contact_type'], value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  switch (type) {
    case 'Instagram':
      return `https://instagram.com/${v.replace(/^@/, '')}`;
    case 'Email':
      return `mailto:${v}`;
    case 'WhatsApp':
      return /^https?:\/\//.test(v) ? v : `https://wa.me/${v.replace(/[^0-9]/g, '')}`;
    case 'LinkedIn':
    case 'Website':
      return /^https?:\/\//.test(v) ? v : `https://${v}`;
    default:
      return null;
  }
}

function toForm(org: StudentOrg): OrgFormValues {
  return {
    name: org.name ?? '',
    org_type: org.org_type,
    contact_type: org.contact_type ?? '',
    contact_value: org.contact_value ?? '',
    contact_person: org.contact_person ?? '',
    email: org.email ?? '',
    whatsapp: org.whatsapp ?? '',
    follower_count: org.follower_count != null ? String(org.follower_count) : '',
    notes: org.notes ?? '',
  };
}

// ── Inline add/edit form ───────────────────────────────────────────────────
function OrgForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: OrgFormValues;
  onSave: (v: OrgFormValues) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [values, setValues] = useState<OrgFormValues>(initial);

  function set<K extends keyof OrgFormValues>(key: K, value: OrgFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <form
      className="org-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(values);
      }}
    >
      <div className="form-grid">
        <div className="field full">
          <label>Org name</label>
          <input
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="BEM Fasilkom UI"
          />
        </div>

        <div className="field">
          <label>Org type</label>
          <select
            value={values.org_type}
            onChange={(e) => set('org_type', e.target.value as OrgFormValues['org_type'])}
          >
            {ORG_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Follower count</label>
          <input
            type="number"
            min="0"
            value={values.follower_count}
            onChange={(e) => set('follower_count', e.target.value)}
            placeholder="e.g. 11000"
          />
        </div>

        <div className="field">
          <label>Contact type</label>
          <select
            value={values.contact_type}
            onChange={(e) =>
              set('contact_type', e.target.value as OrgFormValues['contact_type'])
            }
          >
            <option value="">— None —</option>
            {CONTACT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Contact value</label>
          <input
            value={values.contact_value}
            onChange={(e) => set('contact_value', e.target.value)}
            placeholder="@bemfasilkomui"
          />
        </div>

        <div className="field">
          <label>Contact person</label>
          <input
            value={values.contact_person}
            onChange={(e) => set('contact_person', e.target.value)}
            placeholder="optional"
          />
        </div>

        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="bem@example.ac.id"
          />
        </div>

        <div className="field">
          <label>WhatsApp</label>
          <input
            value={values.whatsapp}
            onChange={(e) => set('whatsapp', e.target.value)}
            placeholder="+62…"
          />
        </div>

        <div className="field full">
          <label>Notes</label>
          <textarea
            value={values.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Faculty of Computer Science"
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-gold" disabled={saving}>
          {saving ? 'Saving…' : 'Save org'}
        </button>
      </div>
    </form>
  );
}

// ── Section: list + CRUD for one campus's student orgs ─────────────────────
export default function OrgSection({
  campusId,
  orgFilter = 'All',
  runningType = 'UKM Olahraga/Lari',
  careerType = 'Career Center',
  businessType = 'Business/Entrepreneurship',
  onCountChange,
}: {
  campusId: string;
  orgFilter?: 'All' | 'Running' | 'Career' | 'Business' | 'Student';
  runningType?: string;
  careerType?: string;
  businessType?: string;
  onCountChange: (count: number) => void;
}) {
  const [orgs, setOrgs] = useState<StudentOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('student_orgs')
      .select('*')
      .eq('campus_id', campusId)
      .order('created_at', { ascending: true });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    const list = (data ?? []) as StudentOrg[];
    setOrgs(list);
    onCountChange(list.length);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId]);

  function formToRow(v: OrgFormValues) {
    const followers = v.follower_count.trim();
    return {
      campus_id: campusId,
      name: v.name.trim() || null,
      org_type: v.org_type,
      contact_type: v.contact_type || null,
      contact_value: v.contact_value.trim() || null,
      contact_person: v.contact_person.trim() || null,
      email: v.email.trim() || null,
      whatsapp: v.whatsapp.trim() || null,
      follower_count: followers === '' ? null : Number.parseInt(followers, 10),
      notes: v.notes.trim() || null,
    };
  }

  async function handleAdd(v: OrgFormValues) {
    if (!supabase) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('student_orgs').insert(formToRow(v));
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setAdding(false);
    await load();
  }

  async function handleUpdate(id: string, v: OrgFormValues) {
    if (!supabase) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase
      .from('student_orgs')
      .update(formToRow(v))
      .eq('id', id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEditingId(null);
    await load();
  }

  async function handleDelete(id: string) {
    if (!supabase) return;
    if (!window.confirm('Delete this student org? This cannot be undone.')) return;
    const { error: err } = await supabase.from('student_orgs').delete().eq('id', id);
    if (err) {
      setError(err.message);
      return;
    }
    await load();
  }

  // Apply the Orgs filter to what's displayed (counts stay on the full set).
  const shown = orgs.filter((o) => {
    switch (orgFilter) {
      case 'Running':
        return o.org_type === runningType;
      case 'Career':
        return o.org_type === careerType;
      case 'Business':
        return o.org_type === businessType;
      case 'Student':
        return o.org_type !== runningType && o.org_type !== careerType && o.org_type !== businessType;
      default:
        return true;
    }
  });

  return (
    <div>
      <div className="detail-head">
        <h3>Student organizations</h3>
        {!adding && (
          <button
            className="btn btn-sm btn-ocean"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
          >
            <PlusIcon size={13} /> Add org
          </button>
        )}
      </div>

      {error && <div className="notice notice-err">{error}</div>}

      {adding && (
        <OrgForm
          initial={EMPTY_FORM}
          saving={saving}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
        />
      )}

      {loading ? (
        <div className="empty-note">
          <span className="spinner" /> Loading orgs…
        </div>
      ) : shown.length === 0 && !adding ? (
        <div className="empty-note">
          {orgs.length === 0
            ? 'No student organizations recorded yet.'
            : orgFilter === 'Running'
              ? 'No running-related orgs at this campus.'
              : orgFilter === 'Career'
                ? 'No career centre recorded at this campus.'
                : 'No orgs match this filter.'}
        </div>
      ) : (
        <div className="org-list">
          {shown.map((org) =>
            editingId === org.id ? (
              <OrgForm
                key={org.id}
                initial={toForm(org)}
                saving={saving}
                onSave={(v) => handleUpdate(org.id, v)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="org-item" key={org.id}>
                <div className="org-main">
                  <span className="org-name">{org.name || 'Unnamed org'}</span>
                  <span className="org-meta">
                    <span className="org-type-tag">{org.org_type}</span>
                    {org.contact_type && org.contact_value && (
                      <span>
                        {org.contact_type}:{' '}
                        {contactHref(org.contact_type, org.contact_value) ? (
                          <a
                            className="org-contact"
                            href={contactHref(org.contact_type, org.contact_value)!}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {org.contact_value}
                          </a>
                        ) : (
                          <span className="org-contact">{org.contact_value}</span>
                        )}
                      </span>
                    )}
                    {org.contact_person && <span>· {org.contact_person}</span>}
                    {org.email && (
                      <span>
                        Email:{' '}
                        <a className="org-contact" href={`mailto:${org.email}`}>
                          {org.email}
                        </a>
                      </span>
                    )}
                    {org.whatsapp && (
                      <span>
                        WA:{' '}
                        <a
                          className="org-contact"
                          href={
                            /^https?:\/\//.test(org.whatsapp)
                              ? org.whatsapp
                              : `https://wa.me/${org.whatsapp.replace(/[^0-9]/g, '')}`
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          {/^https?:\/\//.test(org.whatsapp) ? 'chat' : org.whatsapp}
                        </a>
                      </span>
                    )}
                    {org.follower_count != null && (
                      <span className="org-followers">
                        {org.follower_count.toLocaleString('en-US')} followers
                      </span>
                    )}
                  </span>
                  {org.notes && <span className="org-notes">{org.notes}</span>}
                </div>
                <div className="org-actions">
                  <button
                    className="btn btn-sm btn-ghost"
                    title="Edit"
                    onClick={() => {
                      setEditingId(org.id);
                      setAdding(false);
                    }}
                  >
                    <EditIcon />
                  </button>
                  <button
                    className="btn btn-sm btn-ghost btn-danger"
                    title="Delete"
                    onClick={() => handleDelete(org.id)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
