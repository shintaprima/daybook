import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';

// Wraps the app: shows a sign-in form until there's a real Supabase session,
// then renders children (the actual app) once logged in.
export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking, null = logged out
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  if (session === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, sans-serif', color: '#6B6F76' }}>
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, sans-serif', background: '#F5F4EF' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap');
        `}</style>
        <form onSubmit={handleLogin} style={{ background: '#fff', padding: 32, borderRadius: 10, width: 320,
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)', border: '1px solid #E3E1D9' }}>
          <h1 style={{ fontFamily: '"Newsreader", Georgia, serif', fontSize: 26, fontWeight: 500,
            letterSpacing: '-0.01em', marginBottom: 6, marginTop: 0 }}>
            daybook<span style={{ color: '#5F7C68' }}>.</span>
          </h1>
          <div style={{ fontSize: 14, color: '#6B6F76', marginBottom: 22 }}>
            Hi. Welcome to Daybook.
          </div>
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required autoFocus
            style={{ width: '100%', padding: 10, marginBottom: 10, borderRadius: 6,
              border: '1px solid #E3E1D9', boxSizing: 'border-box', fontSize: 14 }}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} required
            style={{ width: '100%', padding: 10, marginBottom: 14, borderRadius: 6,
              border: '1px solid #E3E1D9', boxSizing: 'border-box', fontSize: 14 }}
          />
          {error && <div style={{ color: '#8B2438', fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <button
            type="submit" disabled={loading}
            style={{ width: '100%', padding: 10, borderRadius: 6, border: 'none',
              background: '#5F7C68', color: '#fff', fontWeight: 500, fontSize: 14,
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  // Logged in — sign-out now lives in the profile menu (top right of the app),
  // so this wrapper just passes the app through.
  return children;
}
