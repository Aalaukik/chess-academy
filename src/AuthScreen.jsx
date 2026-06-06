import { useState } from 'react'
import { supabase } from './supabase'

const GOLD = 'linear-gradient(135deg, #C8A84B, #E2C870)'
const C = {
  bg1: '#0E0D0A', bg2: '#161410', bg3: '#1F1C15',
  text1: '#EDE7D4', text2: '#8C8476', text3: '#504C45',
  gold: '#C8A84B', green: '#4CAF82', red: '#E05555',
  border: 'rgba(255,255,255,0.07)',
}

function Field({ label, type = 'text', value, onChange, placeholder, autoComplete }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </label>
      <input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          fontSize: 14, padding: '11px 14px',
          borderRadius: 10,
          border: `1px solid ${focused ? C.gold : 'rgba(255,255,255,0.07)'}`,
          background: 'rgba(255,255,255,0.04)',
          color: C.text1,
          outline: 'none',
          width: '100%', boxSizing: 'border-box',
          transition: 'border-color .15s',
          boxShadow: focused ? `0 0 0 3px rgba(200,168,75,0.10)` : 'none',
          fontFamily: 'var(--font-sans)',
        }}
      />
    </div>
  )
}

function PrimaryBtn({ children, onClick, loading }) {
  return (
    <button
      type="button" onClick={onClick} disabled={loading}
      style={{
        width: '100%', padding: '12px',
        background: loading ? 'rgba(255,255,255,0.06)' : GOLD,
        color: loading ? C.text2 : '#1A1510',
        border: 'none', borderRadius: 100,
        fontSize: 14, fontWeight: 700,
        cursor: loading ? 'default' : 'pointer',
        boxShadow: loading ? 'none' : '0 4px 20px rgba(200,168,75,0.35)',
        transition: 'opacity .15s, transform .12s',
        letterSpacing: '0.01em',
        fontFamily: 'var(--font-sans)',
      }}
      onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '.9' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
    >
      {loading ? '⏳ Please wait…' : children}
    </button>
  )
}

function GoogleBtn({ onClick, loading, label = 'Continue with Google' }) {
  return (
    <button
      type="button" onClick={onClick} disabled={loading}
      style={{
        width: '100%', padding: '11px',
        background: 'rgba(255,255,255,0.06)',
        color: C.text1,
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 100,
        fontSize: 14, fontWeight: 500,
        cursor: loading ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        transition: 'background .15s',
        fontFamily: 'var(--font-sans)',
      }}
      onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(255,255,255,0.09)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
    >
      <svg width="17" height="17" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
        <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
      </svg>
      {loading ? '⏳ …' : label}
    </button>
  )
}

function Divider({ text = 'or' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0' }}>
      <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
      <span style={{ fontSize: 12, color: C.text3 }}>{text}</span>
      <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

function Alert({ type, children }) {
  const map = {
    error:   { bg: 'rgba(224,85,85,0.08)',  border: 'rgba(224,85,85,0.3)',  color: '#E05555' },
    success: { bg: 'rgba(76,175,130,0.08)', border: 'rgba(76,175,130,0.3)', color: '#4CAF82' },
    info:    { bg: 'rgba(200,168,75,0.08)', border: 'rgba(200,168,75,0.3)', color: '#C8A84B' },
  }
  const s = map[type] || map.info
  return (
    <div style={{
      fontSize: 13, padding: '10px 14px', borderRadius: 10,
      background: s.bg, border: `1px solid ${s.border}`, color: s.color, lineHeight: 1.55,
    }}>
      {children}
    </div>
  )
}

function TextLink({ onClick, children }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontSize: 13, padding: 0, fontWeight: 600, fontFamily: 'var(--font-sans)' }}
    >
      {children}
    </button>
  )
}

export default function AuthScreen({ onAuth }) {
  const [view, setView] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const reset = () => { setError(''); setInfo('') }
  const switchTo = v => { reset(); setView(v) }

  async function handleLogin() {
    if (!email.trim() || !password) { setError('Enter your email and password.'); return }
    setLoading(true); reset()
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (err) {
      setError(err.message.includes('Invalid login') ? 'Wrong email or password.' : err.message.includes('Email not confirmed') ? 'Please confirm your email first.' : err.message)
      return
    }
    onAuth(data.user)
  }

  async function handleSignup() {
    if (!username.trim()) { setError('Choose a username.'); return }
    if (!email.trim()) { setError('Enter an email address.'); return }
    if (!password) { setError('Enter a password.'); return }
    if (username.trim().length < 3) { setError('Username must be at least 3 characters.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true); reset()
    const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { username: username.trim() } } })
    setLoading(false)
    if (err) { setError(err.message); return }
    if (data.user && !data.session) { setInfo(`✅ Check ${email} for a confirmation link, then sign in.`); switchTo('login'); return }
    if (data.user) onAuth(data.user)
  }

  async function handleForgot() {
    if (!email.trim()) { setError('Enter your account email.'); return }
    setLoading(true); reset()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}` })
    setLoading(false)
    if (err) { setError(err.message); return }
    setInfo(`📧 Reset link sent to ${email}. Check your inbox!`)
  }

  async function handleGoogle() {
    setLoading(true); reset()
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { access_type: 'offline', prompt: 'consent' } },
    })
    if (err) { setError(err.message); setLoading(false) }
  }

  function onKey(e) {
    if (e.key !== 'Enter' || loading) return
    if (view === 'login') handleLogin()
    if (view === 'signup') handleSignup()
    if (view === 'forgot') handleForgot()
  }

  const taglines = { login: 'Sign in to save your progress', signup: 'Create a free account in seconds', forgot: 'Reset your password' }

  return (
    <div
      onKeyDown={onKey}
      style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '2rem 1rem',
        fontFamily: 'var(--font-sans)',
        background: C.bg1,
        position: 'relative',
      }}
    >
      {/* Subtle radial glow behind logo */}
      <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 280, height: 280, background: 'radial-gradient(circle, rgba(200,168,75,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '2rem', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 58, lineHeight: 1, marginBottom: 14, display: 'inline-block', filter: 'drop-shadow(0 0 20px rgba(200,168,75,0.25))' }}>♟</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: C.text1, letterSpacing: '0.04em', marginBottom: 6, lineHeight: 1 }}>
          Chess Academy
        </h1>
        <p style={{ fontSize: 13, color: C.text2, fontWeight: 400 }}>{taglines[view]}</p>
      </div>

      {/* Card */}
      <div style={{
        background: C.bg2,
        borderRadius: 20,
        padding: '1.75rem',
        width: '100%', maxWidth: 400,
        display: 'flex', flexDirection: 'column', gap: 14,
        boxShadow: '0 1px 0 rgba(200,168,75,0.10) inset, 0 32px 80px rgba(0,0,0,0.60)',
        position: 'relative', zIndex: 1,
        borderTop: '1px solid rgba(200,168,75,0.12)',
      }}>
        {error && <Alert type="error">{error}</Alert>}
        {info  && <Alert type="success">{info}</Alert>}

        {view === 'login' && <>
          <GoogleBtn onClick={handleGoogle} loading={loading} />
          <Divider />
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" autoComplete="email" />
          <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />
          <PrimaryBtn onClick={handleLogin} loading={loading}>Sign In →</PrimaryBtn>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <TextLink onClick={() => switchTo('signup')}>Create account</TextLink>
            <button onClick={() => switchTo('forgot')} style={{ background: 'none', border: 'none', color: C.text2, cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'var(--font-sans)' }}>
              Forgot password?
            </button>
          </div>
        </>}

        {view === 'signup' && <>
          <GoogleBtn onClick={handleGoogle} loading={loading} label="Sign up with Google" />
          <Divider />
          <Field label="Username" value={username} onChange={setUsername} placeholder="chessmaster99" autoComplete="username" />
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" autoComplete="email" />
          <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="6+ characters" autoComplete="new-password" />
          <PrimaryBtn onClick={handleSignup} loading={loading}>Create Free Account →</PrimaryBtn>
          <div style={{ textAlign: 'center', fontSize: 13, color: C.text2 }}>
            Already have an account? <TextLink onClick={() => switchTo('login')}>Sign in</TextLink>
          </div>
        </>}

        {view === 'forgot' && <>
          <Alert type="info">Enter your email and we'll send a reset link.</Alert>
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" autoComplete="email" />
          <PrimaryBtn onClick={handleForgot} loading={loading}>Send Reset Email</PrimaryBtn>
          <div style={{ textAlign: 'center' }}>
            <TextLink onClick={() => switchTo('login')}>← Back to sign in</TextLink>
          </div>
        </>}

        <Divider text="or play without an account" />
        <button
          type="button" onClick={() => onAuth(null)}
          style={{
            width: '100%', padding: '11px',
            background: 'transparent',
            color: C.text2,
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 100,
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: 'background .15s, color .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = C.text1 }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text2 }}
        >
          Continue as Guest
        </button>
        <p style={{ fontSize: 11, color: C.text3, textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
          Guest progress saves locally on this device only.
        </p>
      </div>
    </div>
  )
}
