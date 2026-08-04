-- Seed: exactly ONE campus end-to-end — Universitas Indonesia — with two real,
-- verified student orgs. Idempotent (on conflict) so it's safe to re-apply.
--
-- Note on city: 'Depok' is UI's operating campus city, not the PDDikti-registered
-- downtown Jakarta Pusat address. Same convention (operating city) applies when the
-- remaining institutions are added later.
--
-- UI's university-wide BEM is intentionally omitted: its handle rotates yearly with
-- each new cabinet and should be reconfirmed at outreach time rather than seeded.

insert into campuses (slug, name, type, ownership, city, province, future_series_city, website)
values (
  'universitas-indonesia',
  'Universitas Indonesia',
  'Universitas',
  'Negeri',
  'Depok',
  'Jawa Barat',
  'Jakarta',
  'https://www.ui.ac.id'
)
on conflict (slug) do nothing;

insert into student_orgs (campus_id, name, org_type, contact_type, contact_value, follower_count, notes)
select c.id, v.name, v.org_type::org_type, v.contact_type::contact_type, v.contact_value, v.follower_count, v.notes
from campuses c
cross join (values
  ('BEM Fasilkom UI', 'BEM Fakultas', 'Instagram', '@bemfasilkomui', 11000, 'Faculty of Computer Science'),
  ('BEM FISIP UI',    'BEM Fakultas', 'Instagram', '@bemfisipui',    22000, 'Faculty of Social and Political Sciences')
) as v(name, org_type, contact_type, contact_value, follower_count, notes)
where c.slug = 'universitas-indonesia'
  and not exists (
    select 1 from student_orgs s
    where s.campus_id = c.id and s.name = v.name
  );
