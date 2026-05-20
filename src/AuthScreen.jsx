import { useState } from 'react'
import { supabase } from './supabase'

// ── Input field ───────────────────────────────────────────────────
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
          fontSize: 14, padding: '10px 12px',
          borderRadius: 'var(--border-radius-md)',
          border: '0.5px solid var(--color-border-secondary)',
          background: 'var(--color-background-primary)',
          color: 'var(--color-text-primary)',
          outline: 'none', width: '100%', boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}
        onFocus={e  => e.target.style.borderColor = '#4A43A0'}
        onBlur={e   => e.target.style.borderColor = ''}
      />
    </div>
  )
}

// ── Button ────────────────────────────────────────────────────────
function Btn({ children, onClick, loading, variant = 'primary' }) {
  const styles = {
    primary: { background: '#4A43A0', color: '#fff', border: 'none' },
    ghost:   { background: 'transparent', color: 'var(--color-text-secondary)', border: '0.5px solid var(--color-border-secondary)' },
    google:  { background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', border: '0.5px solid var(--color-border-secondary)' },
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        width: '100%', padding: '11px', fontSize: 14, fontWeight: 600,
        borderRadius: 'var(--border-radius-md)', cursor: loading ? 'default' : 'pointer',
        opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s, background 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        ...styles[variant],
      }}
      onMouseEnter={e => { if (!loading && variant !== 'primary') e.currentTarget.style.background = 'var(--color-background-secondary)' }}
      onMouseLeave={e => { if (variant !== 'primary') e.currentTarget.style.background = styles[variant].background }}
    >
      {loading ? '⏳ Please wait…' : children}
    </button>
  )
}

// ── Divider ───────────────────────────────────────────────────────
function Divider({ text = 'or' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border-tertiary)' }} />
      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{text}</span>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border-tertiary)' }} />
    </div>
  )
}

// ── Alert ─────────────────────────────────────────────────────────
function Alert({ type, children }) {
  const colors = {
    error:   { bg: 'rgba(232,85,85,0.1)',   border: '#E85555', text: '#E85555' },
    success: { bg: 'rgba(92,184,138,0.1)',  border: '#5CB88A', text: '#5CB88A' },
    info:    { bg: 'rgba(74,67,160,0.08)',  border: '#4A43A0', text: '#4A43A0' },
  }
  const c = colors[type]
  return (
    <div style={{
      fontSize: 13, padding: '10px 12px', borderRadius: 'var(--border-radius-md)',
      background: c.bg, border: `0.5px solid ${c.border}`, color: c.text,
      lineHeight: 1.5,
    }}>
      {children}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  MAIN AUTH COMPONENT
// ════════════════════════════════════════════════════════════════
export default function AuthScreen({ onAuth }) {
  const [view, setView]         = useState('login')  // login | signup | forgot
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [info, setInfo]         = useState('')

  const reset = () => { setError(''); setInfo('') }
  const switchTo = (v) => { reset(); setView(v) }

  // ── Email login ───────────────────────────────────────────────
  async function handleLogin() {
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return }
    setLoading(true); reset()
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (err) {
      // Make Supabase error messages friendlier
      if (err.message.includes('Invalid login')) setError('Wrong email or password. Please try again.')
      else if (err.message.includes('Email not confirmed')) setError('Please confirm your email first — check your inbox for a verification link.')
      else setError(err.message)
      return
    }
    onAuth(data.user)
  }

  // ── Sign up ───────────────────────────────────────────────────
  async function handleSignup() {
    if (!username.trim()) { setError('Please choose a username.'); return }
    if (!email.trim())    { setError('Please enter an email address.'); return }
    if (!password)        { setError('Please enter a password.'); return }
    if (username.trim().length < 3) { setError('Username must be at least 3 characters.'); return }
    if (password.length < 6)        { setError('Password must be at least 6 characters.'); return }

    setLoading(true); reset()
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: username.trim() },
      },
    })
    setLoading(false)
    if (err) { setError(err.message); return }

    // If email confirmation is required (Supabase default)
    if (data.user && !data.session) {
      setInfo(`✅ Account created! Check ${email} for a confirmation link, then sign in.`)
      switchTo('login')
      return
    }
    // If email confirmation is disabled in Supabase — log straight in
    if (data.user) onAuth(data.user)
  }

  // ── Forgot password ───────────────────────────────────────────
  async function handleForgot() {
    if (!email.trim()) { setError('Enter the email address for your account.'); return }
    setLoading(true); reset()
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}` }
    )
    setLoading(false)
    if (err) { setError(err.message); return }
    setInfo(`📧 Reset email sent to ${email}. Check your inbox!`)
  }

  // ── Google OAuth ──────────────────────────────────────────────
  async function handleGoogle() {
    setLoading(true); reset()
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    // Browser will redirect — if we get here it failed
    if (err) { setError(err.message); setLoading(false) }
  }

  // ── Guest ─────────────────────────────────────────────────────
  function handleGuest() { onAuth(null) }

  // ── Enter key support ─────────────────────────────────────────
  function onKey(e) {
    if (e.key !== 'Enter' || loading) return
    if (view === 'login')  handleLogin()
    if (view === 'signup') handleSignup()
    if (view === 'forgot') handleForgot()
  }

  return (
    <div
      onKeyDown={onKey}
      style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem 1rem', fontFamily: 'var(--font-sans)',
        background: 'var(--color-background-secondary)',
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <div style={{ fontSize: 54, lineHeight: 1, marginBottom: 10 }}>♟</div>
        <div style={{ fontSize: 23, fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: -0.5 }}>
          Chess Academy
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
          {view === 'login'  && 'Sign in to save your progress across devices'}
          {view === 'signup' && 'Create a free account — takes 30 seconds'}
          {view === 'forgot' && 'Reset your password'}
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '1.75rem',
        width: '100%', maxWidth: 400,
        display: 'flex', flexDirection: 'column', gap: 14,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>

        {/* Alerts */}
        {error && <Alert type="error">{error}</Alert>}
        {info  && <Alert type="success">{info}</Alert>}

        {/* ── LOGIN ── */}
        {view === 'login' && <>
          <Btn variant="google" loading={loading} onClick={handleGoogle}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            Continue with Google
          </Btn>
          <Divider />
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" autoComplete="email" />
          <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />
          <Btn loading={loading} onClick={handleLogin}>Sign In →</Btn>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <button onClick={() => switchTo('signup')} style={{ background: 'none', border: 'none', color: '#4A43A0', cursor: 'pointer', fontSize: 13, padding: 0, fontWeight: 500 }}>
              Create account
            </button>
            <button onClick={() => switchTo('forgot')} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 13, padding: 0 }}>
              Forgot password?
            </button>
          </div>
        </>}

        {/* ── SIGN UP ── */}
        {view === 'signup' && <>
          <Btn variant="google" loading={loading} onClick={handleGoogle}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            Sign up with Google
          </Btn>
          <Divider />
          <Field label="Username" value={username} onChange={setUsername} placeholder="chessmaster99" autoComplete="username" />
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" autoComplete="email" />
          <Field label="Password (min 6 characters)" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="new-password" />
          <Btn loading={loading} onClick={handleSignup}>Create Free Account →</Btn>
          <div style={{ textAlign: 'center', fontSize: 13 }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Already have an account? </span>
            <button onClick={() => switchTo('login')} style={{ background: 'none', border: 'none', color: '#4A43A0', cursor: 'pointer', fontSize: 13, padding: 0, fontWeight: 500 }}>
              Sign in
            </button>
          </div>
        </>}

        {/* ── FORGOT PASSWORD ── */}
        {view === 'forgot' && <>
          <Alert type="info">Enter your email and we'll send a password reset link.</Alert>
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" autoComplete="email" />
          <Btn loading={loading} onClick={handleForgot}>Send Reset Email</Btn>
          <div style={{ textAlign: 'center' }}>
            <button onClick={() => switchTo('login')} style={{ background: 'none', border: 'none', color: '#4A43A0', cursor: 'pointer', fontSize: 13, padding: 0, fontWeight: 500 }}>
              ← Back to sign in
            </button>
          </div>
        </>}

        {/* ── Guest divider ── */}
        <Divider text="or play without an account" />
        <Btn variant="ghost" onClick={handleGuest}>Continue as Guest</Btn>
        <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
          Guest progress saves locally on this device only.
          Sign in to sync across devices.
        </p>
      </div>
    </div>
  )
}
