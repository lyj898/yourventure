import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { CompassIcon } from './icons';

// Sign-in gate. No public signup — emails are allow-listed in the Supabase dashboard.
// A normal email + password login. "Forgot password?" emails a link that both first-time
// users and password-resetters use to choose a password (SetPassword takes over there).
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | 'password' | 'reset'>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !email.trim() || !password) return;
    setBusy('password');
    setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(null);
    if (error) {
      setNotice({
        kind: 'err',
        text:
          error.message === 'Invalid login credentials'
            ? 'Wrong email or password. First time here? Use “Forgot password?” to set one.'
            : error.message,
      });
    }
    // On success, onAuthStateChange in Dashboard swaps this out for the directory.
  }

  async function handleReset() {
    if (!supabase || !email.trim()) {
      setNotice({ kind: 'err', text: 'Enter your email above first, then click “Forgot password?” again.' });
      return;
    }
    setBusy('reset');
    setNotice(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setBusy(null);
    if (error) {
      setNotice({ kind: 'err', text: error.message });
    } else {
      setNotice({
        kind: 'ok',
        text: `We emailed ${email.trim()} a link. Open it, choose a password, and you're in.`,
      });
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSignIn}>
        <div className="login-mark">
          <CompassIcon />
        </div>
        <h1>Campus Directory</h1>
        <p>
          Indonesia student-body directory for YOUR Venture outreach. Internal team only —
          sign in with your allow-listed email.
        </p>

        {notice && <div className={`notice notice-${notice.kind}`}>{notice.text}</div>}

        <div className="field">
          <label htmlFor="login-email">Work email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@yventures.com.sg"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button className="btn btn-gold" type="submit" disabled={busy !== null}>
          {busy === 'password' ? (
            <>
              <span className="spinner" /> Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>

        <div className="login-forgot">
          <button
            type="button"
            className="linkbtn"
            onClick={handleReset}
            disabled={busy !== null}
          >
            {busy === 'reset' ? 'Sending…' : 'Forgot password?'}
          </button>
        </div>
      </form>
    </div>
  );
}
