import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { supabase } from './supabase'
import AuthScreen from './AuthScreen'
import ChessAcademy from './chess-academy'
import './index.css'

function App() {
  // authState: 'loading' | 'auth' | 'app'
  const [authState, setAuthState] = useState('loading')
  const [user, setUser] = useState(null)       // null = guest, object = logged-in
  const [isGuest, setIsGuest] = useState(false) // separate flag so auth events don't wipe guest

  useEffect(() => {
    // 1. Check for an existing Supabase session on first load
    //    (also handles returning from Google OAuth redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        setAuthState('app')
      } else {
        // No session — check if user chose guest in this browser tab
        const savedGuest = sessionStorage.getItem('chess_guest')
        if (savedGuest === 'true') {
          setIsGuest(true)
          setAuthState('app')
        } else {
          setAuthState('auth')
        }
      }
    })

    // 2. Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user)
          setIsGuest(false)
          sessionStorage.removeItem('chess_guest')
          setAuthState('app')
        } else if (!isGuest) {
          // Only drop to auth screen if not a guest
          setUser(null)
          setAuthState('auth')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  function handleAuth(loggedInUser) {
    if (loggedInUser) {
      // Logged in via email or Google
      setUser(loggedInUser)
      setIsGuest(false)
      sessionStorage.removeItem('chess_guest')
    } else {
      // Chose "Continue as Guest"
      setUser(null)
      setIsGuest(true)
      sessionStorage.setItem('chess_guest', 'true')
    }
    setAuthState('app')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    setIsGuest(false)
    sessionStorage.removeItem('chess_guest')
    setAuthState('auth')
  }

  // ── Loading spinner ───────────────────────────────────────────
  if (authState === 'loading') return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      background: 'var(--color-background-secondary)',
    }}>
      <span style={{ fontSize: 48, opacity: 0.6 }}>♟</span>
    </div>
  )

  // ── Auth screen ───────────────────────────────────────────────
  if (authState === 'auth') return (
    <AuthScreen onAuth={handleAuth} />
  )

  // ── Main app ──────────────────────────────────────────────────
  return (
    <div className="app-wrapper">
      <ChessAcademy
        user={user}           // null for guests, user object for logged-in
        onSignOut={handleSignOut}
      />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
