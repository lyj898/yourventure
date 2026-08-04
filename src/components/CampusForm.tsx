import { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  INSTITUTION_TYPES,
  OWNERSHIP_TYPES,
  FS_CITIES,
  type CampusFormValues,
} from '../lib/types';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const EMPTY: CampusFormValues = {
  name: '',
  type: 'Universitas',
  ownership: 'Negeri',
  city: '',
  province: '',
  future_series_city: '',
  website: '',
};

// Modal form for the campus-level fields. Writes straight to Supabase.
export default function CampusForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [values, setValues] = useState<CampusFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set<K extends keyof CampusFormValues>(key: K, value: CampusFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError('');

    const { error: insertError } = await supabase.from('campuses').insert({
      slug: slugify(values.name),
      name: values.name.trim(),
      type: values.type,
      ownership: values.ownership,
      city: values.city.trim(),
      province: values.province.trim(),
      future_series_city: values.future_series_city || null,
      website: values.website.trim() || null,
    });

    setSaving(false);
    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'A campus with this name (slug) already exists.'
          : insertError.message,
      );
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add campus</h2>
        <div className="modal-sub">
          Campus-level details. Add student orgs afterward from the campus row.
        </div>

        {error && <div className="notice notice-err">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="c-name">Name</label>
              <input
                id="c-name"
                value={values.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Universitas Indonesia"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="c-type">Type</label>
              <select
                id="c-type"
                className="select-native"
                value={values.type}
                onChange={(e) => set('type', e.target.value as CampusFormValues['type'])}
              >
                {INSTITUTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="c-own">Ownership</label>
              <select
                id="c-own"
                value={values.ownership}
                onChange={(e) =>
                  set('ownership', e.target.value as CampusFormValues['ownership'])
                }
              >
                {OWNERSHIP_TYPES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="c-city">City (operating campus)</label>
              <input
                id="c-city"
                value={values.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder="Depok"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="c-prov">Province</label>
              <input
                id="c-prov"
                value={values.province}
                onChange={(e) => set('province', e.target.value)}
                placeholder="Jawa Barat"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="c-fs">Future Series city</label>
              <select
                id="c-fs"
                value={values.future_series_city}
                onChange={(e) =>
                  set(
                    'future_series_city',
                    e.target.value as CampusFormValues['future_series_city'],
                  )
                }
              >
                <option value="">— None (geographic tag only) —</option>
                {FS_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="c-web">Website</label>
              <input
                id="c-web"
                type="url"
                value={values.website}
                onChange={(e) => set('website', e.target.value)}
                placeholder="https://www.ui.ac.id"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-gold" disabled={saving}>
              {saving ? 'Saving…' : 'Add campus'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
