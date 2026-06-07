import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { supabase } from './supabase'
import AuthScreen from './AuthScreen'
import ChessAcademy from './chess-academy'
import './index.css'

function App() {
  const [authState, setAuthState] = useState('loading')
  const [user, setUser] = useState(null)
  const [isGuest, setIsGuest] = useState(false)
  const isGuestRef = useRef(false) // ref prevents stale closure in onAuthStateChange

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        setAuthState('app')
      } else {
        const savedGuest = sessionStorage.getItem('chess_guest')
        if (savedGuest === 'true') {
          setIsGuest(true)
          isGuestRef.current = true
          setAuthState('app')
        } else {
          setAuthState('auth')
        }
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user)
          setIsGuest(false)
          isGuestRef.current = false
          sessionStorage.removeItem('chess_guest')
          setAuthState('app')
        } else if (!isGuestRef.current) {
          // Only redirect to auth if not a guest — use ref to avoid stale closure
          setUser(null)
          setAuthState('auth')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  function handleAuth(loggedInUser) {
    if (loggedInUser) {
      setUser(loggedInUser)
      setIsGuest(false)
      isGuestRef.current = false
      sessionStorage.removeItem('chess_guest')
    } else {
      setUser(null)
      setIsGuest(true)
      isGuestRef.current = true
      sessionStorage.setItem('chess_guest', 'true')
    }
    setAuthState('app')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    setIsGuest(false)
    isGuestRef.current = false
    sessionStorage.removeItem('chess_guest')
    setAuthState('auth')
  }

  if (authState === 'loading') return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontFamily: 'var(--font-sans)',
      background: 'var(--color-background-secondary)',
    }}>
      <span style={{ fontSize: 48, opacity: 0.6 }}>♟</span>
    </div>
  )

  if (authState === 'auth') return <AuthScreen onAuth={handleAuth} />

  return (
    <div className="app-wrapper">
      <ChessAcademy user={user} onSignOut={handleSignOut} />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
