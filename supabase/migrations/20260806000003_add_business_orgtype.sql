-- Add a 'Business/Entrepreneurship' org_type for entrepreneurship / business
-- clubs and student-run consulting clubs, tagged and filtered separately.
alter type org_type add value if not exists 'Business/Entrepreneurship';
