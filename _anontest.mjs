import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession:false } });
const { data, error } = await s.auth.signInAnonymously();
if (error) { console.log('ANON_SIGNIN error:', error.message, '| status:', error.status); }
else {
  console.log('ANON_SIGNIN OK  is_anonymous=', data.user?.is_anonymous);
  const { data: rows, error: rerr } = await s.from('campuses').select('name').limit(3);
  console.log(rerr ? ('READ blocked: '+rerr.message) : ('READ OK: '+rows.map(r=>r.name).join(', ')));
}
process.exit(0);
