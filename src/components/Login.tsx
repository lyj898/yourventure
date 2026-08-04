import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { CompassIcon } from './icons';

// Magic-link sign-in gate. No public signup — emails are allow-listed in the Supabase
// dashboard. signInWithOtp with an allow-list-only project emails a login link.
export default function Login() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !email.trim()) return;
    setStatus('sending');
    setMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Return to this app after the user clicks the link. Add this exact origin to
        // the Supabase project's allowed redirect URLs.
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setStatus('error');
      setMessage(error.message);
    } else {
      setStatus('sent');
      setMessage(`Check ${email.trim()} for a sign-in link.`);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-mark">
          <CompassIcon />
        </div>
        <h1>Campus Directory</h1>
        <p>
          Indonesia student-body directory for YOUR Venture outreach. Internal team only —
          sign in with your allow-listed email.
        </p>

        {status === 'sent' && <div className="notice notice-ok">{message}</div>}
        {status === 'error' && <div className="notice notice-err">{message}</div>}

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

        <button className="btn btn-gold" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? (
            <>
              <span className="spinner" /> Sending…
            </>
          ) : (
            'Email me a magic link'
          )}
        </button>
      </form>
    </div>
  );
}
