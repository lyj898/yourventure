-- Add three new Future Series city groups: Medan, Palembang, Malang.
-- (Banten campuses fold into the existing 'Jakarta' group, so no new value needed.)
alter type fs_city add value if not exists 'Medan';
alter type fs_city add value if not exists 'Palembang';
alter type fs_city add value if not exists 'Malang';
