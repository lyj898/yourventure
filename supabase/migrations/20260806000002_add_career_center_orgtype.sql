-- Add a 'Career Center' org_type so each university's career development centre
-- can be tagged and filtered separately from student orgs and running clubs.
alter type org_type add value if not exists 'Career Center';
