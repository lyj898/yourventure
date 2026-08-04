-- Indonesia Campus Directory — initial schema
-- Pure reference directory: campuses + their student organizations. No outreach
-- status, no priority/tier ranking.

-- ── Enums ────────────────────────────────────────────────────────────────────
create type institution_type as enum ('Universitas','Institut','Politeknik','Sekolah Tinggi','Akademi');
create type ownership_type   as enum ('Negeri','Swasta');
create type fs_city          as enum ('Jakarta','Bandung','Yogyakarta','Surabaya','Makassar');
create type org_type         as enum ('BEM Universitas','BEM Fakultas','DPM','HIMA','UKM Olahraga/Lari','Other');
create type contact_type     as enum ('Instagram','Email','WhatsApp','LinkedIn','Website','Other');

-- ── Tables ───────────────────────────────────────────────────────────────────
create table campuses (
  id                 uuid primary key default gen_random_uuid(),
  slug               text unique not null,
  name               text not null,
  type               institution_type not null,
  ownership          ownership_type not null,
  city               text not null,
  province           text not null,
  future_series_city fs_city,       -- null if not in one of the 5 launch cities; purely a geographic tag
  website            text,
  created_at         timestamptz default now()
);

create table student_orgs (
  id             uuid primary key default gen_random_uuid(),
  campus_id      uuid references campuses(id) on delete cascade,
  name           text,
  org_type       org_type not null default 'Other',
  contact_type   contact_type,
  contact_value  text,             -- e.g. an Instagram handle or email address
  contact_person text,
  follower_count int,              -- nullable; rough reach indicator where known (e.g. IG followers)
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index student_orgs_campus_id_idx on student_orgs (campus_id);
create index campuses_future_series_city_idx on campuses (future_series_city);

-- Keep updated_at fresh on every student_orgs update.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger student_orgs_set_updated_at
  before update on student_orgs
  for each row
  execute function set_updated_at();

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Enable RLS on both tables; any authenticated user gets full read/write.
-- No anon access.
alter table campuses     enable row level security;
alter table student_orgs enable row level security;

create policy "campuses: full access for authenticated"
  on campuses
  for all
  to authenticated
  using (true)
  with check (true);

create policy "student_orgs: full access for authenticated"
  on student_orgs
  for all
  to authenticated
  using (true)
  with check (true);
