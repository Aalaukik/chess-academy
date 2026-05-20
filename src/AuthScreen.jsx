import { useState } from 'react'
import { supabase } from './supabase'

// ── small reusable field ──────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, autoComplete }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{
          fontSize: 14,
          padding: '10px 12px',
          borderRadius: 'var(--border-radius-md)',
          border: '0.5px solid var(--color-border-secondary)',
          background: 'var(--color-background-primary)',
          color: 'var(--color-text-primary)',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => e.target.style.borderColor = '#4A43A0'}
        onBlur={e => e.target.style.borderColor = ''}
      />
    </div>
  )
}

// ── primary button ────────────────────────────────────────────────
function Btn({ children, onClick, loading, variant = 'primary', type = 'button' }) {
  const isPrimary = variant === 'primary'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading}
      style={{
        width: '100%',
        padding: '11px',
        fontSize: 14,
        fontWeight: 600,
        background: isPrimary ? '#4A43A0' : 'transparent',
        color: isPrimary ? '#fff' : 'var(--color-text-secondary)',
        border: isPrimary ? 'none' : '0.5px solid var(--color-border-secondary)',
        borderRadius: 'var(--border-radius-md)',
        cursor: loading ? 'default' : 'pointer',
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}

// ── divider ───────────────────────────────────────────────────────
function Divider({ text = 'or' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border-tertiary)' }} />
      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{text}</span>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border-tertiary)' }} />
    </div>
  )
}

// ── Google button ─────────────────────────────────────────────────
function GoogleBtn({ loading, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        width: '100%',
        padding: '10px',
        fontSize: 14,
        fontWeight: 500,
        background: 'var(--color-background-primary)',
        color: 'var(--color-text-primary)',
        border: '0.5px solid var(--color-border-secondary)',
        borderRadius: 'var(--border-radius-md)',
        cursor: loading ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        opacity: loading ? 0.6 : 1,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-background-secondary)'}
      onMouseLeave={e => e.currentTarget.style.background = ''}
    >
      {/* Google SVG icon */}
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
        <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
      </svg>
      Continue with Google
    </button>
  )
}

// ════════════════════════════════════════════════════════════════
//  MAIN AUTH COMPONENT
// ════════════════════════════════════════════════════════════════
export default function AuthScreen({ onAuth }) {
  const [view, setView] = useState('login') // login | signup | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const reset = () => { setError(''); setMessage(''); }

  // ── Login ─────────────────────────────────────────────────────
  async function handleLogin(e) {
    e?.preventDefault()
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true); reset()
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) { setError(err.message); return; }
    onAuth(data.user)
  }

  // ── Sign up ───────────────────────────────────────────────────
  async function handleSignup(e) {
    e?.preventDefault()
    if (!email || !password || !username) { setError('Please fill in all fields.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (username.length < 3) { setError('Username must be at least 3 characters.'); return; }
    setLoading(true); reset()
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
    })
    setLoading(false)
    if (err) { setError(err.message); return; }
    if (data.user && !data.session) {
      setMessage('Check your email to confirm your account, then log in.')
      setView('login')
    } else if (data.user) {
      onAuth(data.user)
    }
  }

  // ── Forgot password ───────────────────────────────────────────
  async function handleForgot(e) {
    e?.preventDefault()
    if (!email) { setError('Enter your email address.'); return; }
    setLoading(true); reset()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (err) { setError(err.message); return; }
    setMessage('Password reset email sent — check your inbox.')
  }

  // ── Google OAuth ──────────────────────────────────────────────
  async function handleGoogle() {
    setLoading(true); reset()
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (err) { setError(err.message); setLoading(false); }
    // Browser redirects — no further action needed
  }

  // ── Guest / skip ──────────────────────────────────────────────
  function handleGuest() {
    onAuth(null) // null = guest, app handles gracefully
  }

  // ── Layout ────────────────────────────────────────────────────
  const cardStyle = {
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    padding: '2rem',
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      fontFamily: 'var(--font-sans)',
      background: 'var(--color-background-secondary)',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 10 }}>♟</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: -0.5 }}>
          Chess Academy
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
          {view === 'login'  && 'Sign in to save your progress'}
          {view === 'signup' && 'Create a free account'}
          {view === 'forgot' && 'Reset your password'}
        </div>
      </div>

      <div style={cardStyle}>
        {/* Error / success message */}
        {error && (
          <div style={{ fontSize: 13, padding: '9px 12px', borderRadius: 'var(--border-radius-md)', background: 'rgba(232,85,85,0.1)', border: '0.5px solid #E85555', color: '#E85555' }}>
            {error}
          </div>
        )}
        {message && (
          <div style={{ fontSize: 13, padding: '9px 12px', borderRadius: 'var(--border-radius-md)', background: 'rgba(92,184,138,0.1)', border: '0.5px solid #5CB88A', color: '#5CB88A' }}>
            {message}
          </div>
        )}

        {/* ── LOGIN ── */}
        {view === 'login' && (
          <>
            <GoogleBtn loading={loading} onClick={handleGoogle} />
            <Divider />
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" autoComplete="email" />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />
            <Btn loading={loading} onClick={handleLogin}>Sign In</Btn>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <button onClick={() => { setView('signup'); reset(); }} style={{ background: 'none', border: 'none', color: '#4A43A0', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                Create account
              </button>
              <button onClick={() => { setView('forgot'); reset(); }} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                Forgot password?
              </button>
            </div>
          </>
        )}

        {/* ── SIGN UP ── */}
        {view === 'signup' && (
          <>
            <GoogleBtn loading={loading} onClick={handleGoogle} />
            <Divider />
            <Field label="Username" value={username} onChange={setUsername} placeholder="chessmaster99" autoComplete="username" />
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" autoComplete="email" />
            <Field label="Password (min 6 chars)" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="new-password" />
            <Btn loading={loading} onClick={handleSignup}>Create Account</Btn>
            <div style={{ textAlign: 'center', fontSize: 13 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Already have an account? </span>
              <button onClick={() => { setView('login'); reset(); }} style={{ background: 'none', border: 'none', color: '#4A43A0', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                Sign in
              </button>
            </div>
          </>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {view === 'forgot' && (
          <>
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" autoComplete="email" />
            <Btn loading={loading} onClick={handleForgot}>Send Reset Email</Btn>
            <div style={{ textAlign: 'center' }}>
              <button onClick={() => { setView('login'); reset(); }} style={{ background: 'none', border: 'none', color: '#4A43A0', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                ← Back to sign in
              </button>
            </div>
          </>
        )}

        {/* ── GUEST ── */}
        <Divider text="or play without an account" />
        <Btn variant="ghost" onClick={handleGuest}>Continue as Guest</Btn>
        <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center', margin: 0 }}>
          Guest progress is saved locally — sign in to sync across devices.
        </p>
      </div>
    </div>
  )
}
