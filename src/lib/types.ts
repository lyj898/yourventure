// Shared types + the enum option lists that drive the form dropdowns and pill filters.
// Keep these in sync with the Postgres enums in supabase/migrations/20260804000001_init.sql.

export const INSTITUTION_TYPES = [
  'Universitas',
  'Institut',
  'Politeknik',
  'Sekolah Tinggi',
  'Akademi',
] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

export const OWNERSHIP_TYPES = ['Negeri', 'Swasta'] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

export const FS_CITIES = [
  'Jakarta',
  'Bandung',
  'Yogyakarta',
  'Surabaya',
  'Makassar',
  'Medan',
  'Palembang',
  'Malang',
] as const;
export type FsCity = (typeof FS_CITIES)[number];

export const ORG_TYPES = [
  'BEM Universitas',
  'BEM Fakultas',
  'DPM',
  'HIMA',
  'UKM Olahraga/Lari',
  'Career Center',
  'Business/Entrepreneurship',
  'Other',
] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export const CONTACT_TYPES = [
  'Instagram',
  'Email',
  'WhatsApp',
  'LinkedIn',
  'Website',
  'Other',
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export interface Campus {
  id: string;
  slug: string;
  name: string;
  type: InstitutionType;
  ownership: OwnershipType;
  city: string;
  province: string;
  future_series_city: FsCity | null;
  website: string | null;
  created_at: string;
}

export interface StudentOrg {
  id: string;
  campus_id: string;
  name: string | null;
  org_type: OrgType;
  contact_type: ContactType | null;
  contact_value: string | null;
  contact_person: string | null;
  email: string | null;
  whatsapp: string | null;
  follower_count: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// A campus row plus the count of its student orgs, as rendered in the table.
export interface CampusWithCount extends Campus {
  org_count: number;
}

// Fields the user edits when creating a campus (id/slug/created_at handled elsewhere).
export type CampusFormValues = {
  name: string;
  type: InstitutionType;
  ownership: OwnershipType;
  city: string;
  province: string;
  future_series_city: FsCity | '';
  website: string;
};

// Fields the user edits when adding/editing a student org.
export type OrgFormValues = {
  name: string;
  org_type: OrgType;
  contact_type: ContactType | '';
  contact_value: string;
  contact_person: string;
  email: string;
  whatsapp: string;
  follower_count: string; // kept as string in the form; parsed to int | null on save
  notes: string;
};
