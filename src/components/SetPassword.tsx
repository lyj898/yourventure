import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { CompassIcon } from './icons';

// Shown when the user arrives via a "set / forgot password" email (Supabase fires a
// PASSWORD_RECOVERY auth event, which gives a temporary session). They pick a password
// here; afterwards they're signed in and use that password going forward.
export default function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updErr) setError(updErr.message);
    else onDone(); // now signed in with a full session
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-mark">
          <CompassIcon />
        </div>
        <h1>Set your password</h1>
        <p>Choose a password for the Campus Directory — you'll use it to sign in from now on.</p>

        {error && <div className="notice notice-err">{error}</div>}

        <div className="field">
          <label htmlFor="np">New password</label>
          <input
            id="np"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="cp">Confirm password</label>
          <input
            id="cp"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        <button className="btn btn-gold" type="submit" disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" /> Saving…
            </>
          ) : (
            'Save password & continue'
          )}
        </button>
      </form>
    </div>
  );
}
