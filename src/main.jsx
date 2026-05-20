import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { supabase } from './supabase'
import AuthScreen from './AuthScreen'
import ChessAcademy from './chess-academy'
import './index.css'

function App() {
  // null = not checked yet, false = logged out, object = logged in, 'guest' = guest
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Check for existing session on load (handles OAuth redirect too)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? false)
      setChecking(false)
    })

    // Listen for auth changes (login, logout, OAuth callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(false)
  }

  // Still checking session
  if (checking) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
      <span style={{ fontSize: 48 }}>♟</span>
    </div>
  )

  // Not logged in — show auth screen
  if (user === false) return (
    <AuthScreen onAuth={u => setUser(u ?? 'guest')} />
  )

  // Logged in or guest — show app
  // Pass user + signOut down via props (or use a context for larger apps)
  return (
    <div className="app-wrapper">
      <ChessAcademy
        user={user === 'guest' ? null : user}
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
