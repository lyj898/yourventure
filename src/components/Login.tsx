import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { CompassIcon } from './icons';

// Sign-in gate. No public signup — emails are allow-listed in the Supabase dashboard.
// Primary method is email + password; magic link is offered as a fallback, and there's a
// self-service "set / forgot password" flow (emails a link, then SetPassword takes over).
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | 'password' | 'magic' | 'reset'>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const err = (e: unknown) =>
    setNotice({ kind: 'err', text: e instanceof Error ? e.message : String(e) });

  async function handlePasswordSignIn(e: React.FormEvent) {
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
            ? "Wrong email or password. If you haven't set a password yet, use “Set / forgot password” below."
            : error.message,
      });
    }
    // On success, onAuthStateChange in Dashboard swaps this out for the directory.
  }

  async function handleMagicLink() {
    if (!supabase || !email.trim()) {
      setNotice({ kind: 'err', text: 'Enter your email first.' });
      return;
    }
    setBusy('magic');
    setNotice(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(null);
    if (error) err(error);
    else setNotice({ kind: 'ok', text: `Check ${email.trim()} for a one-time sign-in link.` });
  }

  async function handleReset() {
    if (!supabase || !email.trim()) {
      setNotice({ kind: 'err', text: 'Enter your email first, then click this again.' });
      return;
    }
    setBusy('reset');
    setNotice(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setBusy(null);
    if (error) err(error);
    else
      setNotice({
        kind: 'ok',
        text: `Sent a link to ${email.trim()} to set your password. Open it, choose a password, and you're in.`,
      });
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handlePasswordSignIn}>
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

        <div className="login-alt">
          <button
            type="button"
            className="linkbtn"
            onClick={handleReset}
            disabled={busy !== null}
          >
            {busy === 'reset' ? 'Sending…' : 'Set / forgot password'}
          </button>
          <span className="login-alt-sep">·</span>
          <button
            type="button"
            className="linkbtn"
            onClick={handleMagicLink}
            disabled={busy !== null}
          >
            {busy === 'magic' ? 'Sending…' : 'Email me a magic link instead'}
          </button>
        </div>
      </form>
    </div>
  );
}
