import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

// ── Time-control options ──────────────────────────────────────────
const TIME_OPTS = [
  { label: '1 min',  ms: 60000,  icon: '⚡' },
  { label: '3 min',  ms: 180000, icon: '🔥' },
  { label: '5 min',  ms: 300000, icon: '⏱' },
  { label: '10 min', ms: 600000, icon: '🕐' },
  { label: '∞',      ms: 0,      icon: '♾' },
]

// ── Small UI helpers ─────────────────────────────────────────────
function Card({ children, style }) {
  return (
    <div style={{
      background:   'var(--color-background-primary)',
      border:       '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      padding:      '1rem 1.25rem',
      ...style,
    }}>
      {children}
    </div>
  )
}

function Btn({ children, onClick, disabled, color = '#4A43A0', ghost = false, small = false, loading = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        padding:      small ? '6px 14px' : '10px 20px',
        fontSize:     small ? 12 : 14,
        fontWeight:   600,
        borderRadius: 'var(--border-radius-md)',
        border:       ghost ? `0.5px solid ${color}` : 'none',
        background:   ghost ? 'transparent' : color,
        color:        ghost ? color : '#fff',
        cursor:       (disabled || loading) ? 'default' : 'pointer',
        opacity:      (disabled || loading) ? 0.5 : 1,
        transition:   'opacity .15s, transform .1s',
        whiteSpace:   'nowrap',
        fontFamily:   'var(--font-sans)',
      }}
      onMouseEnter={e => { if (!disabled && !loading) e.currentTarget.style.opacity = '.85' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
    >
      {loading ? '⏳ …' : children}
    </button>
  )
}

function StatusBadge({ status }) {
  const map = {
    waiting:  { label: 'Waiting', color: '#F5C842' },
    active:   { label: 'Live',    color: '#5CB88A' },
    complete: { label: 'Done',    color: '#9E9B92' },
    aborted:  { label: 'Aborted', color: '#E85555' },
  }
  const s = map[status] ?? map.aborted
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px',
      borderRadius: 20, background: `${s.color}22`, color: s.color,
      letterSpacing: 0.4, textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export default function OnlineScreen({ user, onJoinGame, onBack }) {
  const [tab, setTab]             = useState('create')

  // Create-game form
  const [timeMsIdx, setTimeMsIdx] = useState(3)
  const [creating, setCreating]   = useState(false)
  const [waitingGame, setWaitingGame] = useState(null)
  const lobbyChannelRef           = useRef(null)

  // Join form
  const [joinCode, setJoinCode]   = useState('')
  const [joining, setJoining]     = useState(false)

  // Quick match
  const [searching, setSearching] = useState(false)

  // Recent games
  const [recentGames, setRecentGames]     = useState([])
  const [loadingRecent, setLoadingRecent] = useState(false)

  // Shared error / info
  const [error, setError] = useState('')
  const [info,  setInfo]  = useState('')

  const displayName = user
    ? (user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'Player')
    : null

  useEffect(() => {
    if (!user || tab !== 'recent') return
    loadRecentGames()
  }, [user, tab])

  useEffect(() => {
    return () => {
      if (lobbyChannelRef.current) {
        supabase.removeChannel(lobbyChannelRef.current)
        lobbyChannelRef.current = null
      }
    }
  }, [])

  async function loadRecentGames() {
    if (!user) return
    setLoadingRecent(true)
    const { data, error: err } = await supabase
      .from('multiplayer_games')
      .select('*')
      .or(`white_id.eq.${user.id},black_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(12)
    if (err) console.error('[loadRecentGames]', err.message)
    setRecentGames(data ?? [])
    setLoadingRecent(false)
  }

  // ════════════════════════════════════════════════════════════════
  //  CREATE GAME
  // ════════════════════════════════════════════════════════════════
  async function createGame() {
    if (!user) { setError('Sign in to create an online game.'); return }
    setCreating(true); setError(''); setInfo('')

    const timeSel = TIME_OPTS[timeMsIdx]
    const { data, error: err } = await supabase
      .from('multiplayer_games')
      .insert({
        white_id:        user.id,
        white_name:      displayName,
        time_control_ms: timeSel.ms,
        white_time_ms:   timeSel.ms || 999999999,
        black_time_ms:   timeSel.ms || 999999999,
        use_timer:       timeSel.ms > 0,
      })
      .select()
      .single()   // INSERT always returns exactly 1 row — .single() is correct here

    setCreating(false)
    if (err || !data) {
      setError(err?.message ?? 'Failed to create game. Make sure you are signed in and try again.')
      return
    }
    setWaitingGame(data)
    subscribeToLobby(data.id, 'w')
  }

  function cancelWaiting() {
    if (!waitingGame) return
    supabase.from('multiplayer_games')
      .update({ status: 'aborted', result: 'aborted', result_reason: 'abandoned' })
      .eq('id', waitingGame.id)
      .then(() => {})
    if (lobbyChannelRef.current) {
      supabase.removeChannel(lobbyChannelRef.current)
      lobbyChannelRef.current = null
    }
    setWaitingGame(null)
  }

  // ════════════════════════════════════════════════════════════════
  //  JOIN GAME BY CODE
  //  KEY FIX: use .maybeSingle() not .single()
  //  .single() throws HTTP 406 when 0 rows found.
  //  .maybeSingle() returns { data: null, error: null } instead.
  // ════════════════════════════════════════════════════════════════
  async function joinByCode() {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 4) { setError('Enter a valid invite code (6 characters).'); return }
    if (!user) { setError('Sign in to join an online game.'); return }
    setJoining(true); setError(''); setInfo('')

    // ── Step 1: find game by invite code (any status) ─────────────
    // We look up without status filter first so we can give a better error.
    const { data: game, error: findErr } = await supabase
      .from('multiplayer_games')
      .select('*')
      .eq('invite_code', code)
      .maybeSingle()    // ← returns null (not 406) when no row found

    if (findErr) {
      setJoining(false)
      setError(`Database error: ${findErr.message}`)
      return
    }

    if (!game) {
      setJoining(false)
      setError(`No game found with code "${code}". Double-check and try again.`)
      return
    }

    if (game.white_id === user.id) {
      setJoining(false)
      // It's their own game — show the invite code so they can share it
      setInfo(`That's your own game! Share code "${game.invite_code}" with a friend.`)
      setWaitingGame(game)
      subscribeToLobby(game.id, 'w')
      return
    }

    if (game.status === 'complete' || game.status === 'aborted') {
      setJoining(false)
      setError('This game has already ended. Ask for a new invite code.')
      return
    }

    if (game.status === 'active') {
      // Game is active — maybe we're the black player rejoining
      if (game.black_id === user.id) {
        setJoining(false)
        onJoinGame({ game, myColor: 'b' })
        return
      }
      setJoining(false)
      setError('This game already has two players.')
      return
    }

    // status === 'waiting' — join as black
    await joinGameRow(game)
    setJoining(false)
  }

  // ════════════════════════════════════════════════════════════════
  //  QUICK MATCH
  // ════════════════════════════════════════════════════════════════
  async function quickMatch() {
    if (!user) { setError('Sign in to play online.'); return }
    if (searching) return   // prevent double-click
    setSearching(true); setError(''); setInfo('')

    const { data: games, error: listErr } = await supabase
      .from('multiplayer_games')
      .select('*')
      .eq('status', 'waiting')
      .neq('white_id', user.id)
      .order('created_at', { ascending: true })
      .limit(5)

    if (listErr) {
      setError(`Database error: ${listErr.message}`)
      setSearching(false)
      return
    }

    if (games && games.length > 0) {
      const joined = await joinGameRow(games[0])
      if (!joined) {
        // Race condition — first game was snatched, try the next ones
        for (let i = 1; i < games.length; i++) {
          const ok = await joinGameRow(games[i])
          if (ok) { setSearching(false); return }
        }
        // All gone — create a new one to wait in
        setSearching(false)
        await createGame()
      }
    } else {
      // No open games — create one and wait
      setSearching(false)
      await createGame()
    }
    setSearching(false)
  }

  // ── Common: join a game row as black ─────────────────────────
  // Returns true if successful, false on any failure.
  async function joinGameRow(game) {
    const { data: updated, error: joinErr } = await supabase
      .from('multiplayer_games')
      .update({
        black_id:   user.id,
        black_name: displayName,
        status:     'active',
      })
      .eq('id', game.id)
      .eq('status', 'waiting')    // race-condition guard — only joins truly open games
      .select()
      .maybeSingle()    // returns null (not 406) if 0 rows matched

    if (joinErr) {
      // Surface the real Supabase/PostgREST error — most likely an RLS policy issue.
      // If you see "0 rows" here it means the UPDATE policy needs fixing in Supabase.
      console.error('[joinGameRow]', joinErr)
      setError(`Join failed: ${joinErr.message}`)
      return false
    }

    if (!updated) {
      // UPDATE matched 0 rows — two possible reasons:
      //  1. Race condition: someone else joined between our SELECT and UPDATE
      //  2. RLS blocked the UPDATE silently (black_id was NULL so policy failed)
      // Either way, re-fetch the current state so we can give the right message.
      const { data: current } = await supabase
        .from('multiplayer_games')
        .select('*')
        .eq('id', game.id)
        .maybeSingle()

      if (current?.status === 'active' && current?.black_id === user.id) {
        // We ARE already black — a previous click succeeded, just navigate
        onJoinGame({ game: current, myColor: 'b' })
        return true
      }
      if (current?.status === 'active') {
        setError('Someone else joined this game a moment ago. Try Quick Match or ask for a new code.')
      } else {
        setError('Could not join — the game may not be open. If this keeps happening, ask the creator to check their Supabase RLS policy.')
      }
      return false
    }

    onJoinGame({ game: updated, myColor: 'b' })
    return true
  }

  // ── Subscribe to lobby channel (creator waits for black) ──────
  function subscribeToLobby(gameId, myColor) {
    if (lobbyChannelRef.current) supabase.removeChannel(lobbyChannelRef.current)

    const ch = supabase
      .channel(`lobby:${gameId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'multiplayer_games', filter: `id=eq.${gameId}` },
        ({ new: g }) => {
          if (g.status === 'active') {
            supabase.removeChannel(ch)
            lobbyChannelRef.current = null
            onJoinGame({ game: g, myColor })
          }
        }
      )
      .subscribe()

    lobbyChannelRef.current = ch
  }

  // ── Rejoin an in-progress game ────────────────────────────────
  function rejoinGame(game) {
    const myColor = game.white_id === user?.id ? 'w' : 'b'
    onJoinGame({ game, myColor })
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function fmtTime(ms) {
    if (!ms || ms >= 999999999) return '∞'
    const m = Math.floor(ms / 60000)
    return m >= 60 ? `${Math.floor(m / 60)}h` : `${m}m`
  }

  // ════════════════════════════════════════════════════════════════
  //  WAITING LOBBY (after creating a game)
  // ════════════════════════════════════════════════════════════════
  if (waitingGame) {
    return (
      <div style={{ padding: '1.5rem 0 5rem', fontFamily: 'var(--font-sans)' }}>
        <style>{`@keyframes pulse2{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.06)}}`}</style>
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ fontSize: 56, animation: 'pulse2 1.8s ease-in-out infinite', display: 'inline-block', marginBottom: 16 }}>♟</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>Waiting for opponent…</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 28 }}>
            Share this code with your friend:
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: 'var(--color-background-primary)',
            border: '1.5px solid #4A43A0',
            borderRadius: 'var(--border-radius-lg)',
            padding: '14px 24px', marginBottom: 24,
          }}>
            <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: 8, color: '#4A43A0', fontFamily: 'monospace' }}>
              {waitingGame.invite_code}
            </span>
            <CopyBtn text={waitingGame.invite_code} />
          </div>

          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 32 }}>
            {fmtTime(waitingGame.time_control_ms)} time control · You are White ♙
          </div>

          <Btn onClick={cancelWaiting} ghost color="#E85555">Cancel</Btn>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  //  MAIN LOBBY UI
  // ════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '0.5rem 0 5.5rem', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        {onBack && (
          <button onClick={onBack} style={{ fontSize: 12, padding: '5px 10px', background: 'none', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            ← Back
          </button>
        )}
        <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>🌐 Play Online</span>
        {user && (
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', padding: '4px 10px', background: 'var(--color-background-secondary)', borderRadius: 20 }}>
            👤 {displayName}
          </span>
        )}
      </div>

      {/* Guest warning */}
      {!user && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--border-radius-md)', background: 'rgba(245,200,66,.08)', border: '0.5px solid #F5C842' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 3 }}>Sign in to play online</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>You need an account to create or join online games.</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 'var(--border-radius-md)', background: 'rgba(232,85,85,.1)', border: '0.5px solid #E85555', fontSize: 13, color: '#E85555' }}>
          {error}
        </div>
      )}

      {/* Info */}
      {info && !error && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 'var(--border-radius-md)', background: 'rgba(92,184,138,.1)', border: '0.5px solid #5CB88A', fontSize: 13, color: '#5CB88A' }}>
          {info}
        </div>
      )}

      {/* Quick match CTA */}
      <div
        onClick={!user || searching ? undefined : quickMatch}
        style={{
          background: user ? 'linear-gradient(135deg, #4A43A0 0%, #6C5CE7 100%)' : 'var(--color-background-secondary)',
          borderRadius: 'var(--border-radius-lg)',
          padding: '1.25rem 1.5rem', marginBottom: 12,
          cursor: user && !searching ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: user ? '0 4px 20px rgba(74,67,160,.35)' : 'none',
          transition: 'transform .2s, box-shadow .2s',
          opacity: !user ? 0.5 : 1,
        }}
        onMouseEnter={e => { if (user && !searching) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(74,67,160,.45)' } }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = user ? '0 4px 20px rgba(74,67,160,.35)' : 'none' }}
      >
        <span style={{ fontSize: 38 }}>{searching ? '⏳' : '⚡'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 3 }}>
            {searching ? 'Searching…' : 'Quick Match'}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>
            Join the next available game or create one and wait
          </div>
        </div>
        <span style={{ fontSize: 20, color: '#fff' }}>→</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--color-border-tertiary)', marginBottom: 14 }}>
        {[['create', '+ Create Game'], ['join', '🔑 Join by Code'], ['recent', '📋 Recent']].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setError(''); setInfo('') }}
            style={{
              flex: 1, padding: '9px 0', fontSize: 13, background: 'none', border: 'none',
              borderBottom: tab === id ? '2px solid #4A43A0' : '2px solid transparent',
              color: tab === id ? '#4A43A0' : 'var(--color-text-secondary)',
              cursor: 'pointer', fontWeight: tab === id ? 600 : 400, fontFamily: 'var(--font-sans)',
            }}
          >{label}</button>
        ))}
      </div>

      {/* ── CREATE TAB ── */}
      {tab === 'create' && (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 12 }}>Time Control</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 20 }}>
            {TIME_OPTS.map((opt, i) => (
              <button key={i} onClick={() => setTimeMsIdx(i)}
                style={{
                  flex: 1, minWidth: 54, padding: '10px 6px',
                  borderRadius: 'var(--border-radius-md)',
                  border: timeMsIdx === i ? '2px solid #4A43A0' : '0.5px solid var(--color-border-tertiary)',
                  background: timeMsIdx === i ? 'rgba(74,67,160,.08)' : 'transparent',
                  cursor: 'pointer', textAlign: 'center', fontFamily: 'var(--font-sans)',
                  transition: 'all .15s',
                }}>
                <div style={{ fontSize: 18, marginBottom: 3 }}>{opt.icon}</div>
                <div style={{ fontSize: 12, fontWeight: timeMsIdx === i ? 700 : 400, color: timeMsIdx === i ? '#4A43A0' : 'var(--color-text-secondary)' }}>{opt.label}</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16, padding: '8px 12px', background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)' }}>
            You will play as <strong>White ♙</strong> — your opponent joins as Black.
          </div>
          <Btn onClick={createGame} disabled={!user} loading={creating}>
            Create Game →
          </Btn>
        </Card>
      )}

      {/* ── JOIN TAB ── */}
      {tab === 'join' && (
        <Card>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
            Ask your opponent for their 6-character invite code.
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={joinCode}
              onChange={e => {
                setError('')
                setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
              }}
              onKeyDown={e => e.key === 'Enter' && !joining && joinByCode()}
              placeholder="A3K9XZ"
              maxLength={6}
              style={{
                flex: 1, fontSize: 22, fontWeight: 700, letterSpacing: 6,
                padding: '10px 14px', textAlign: 'center',
                borderRadius: 'var(--border-radius-md)',
                border: '1.5px solid var(--color-border-secondary)',
                background: 'var(--color-background-secondary)',
                color: 'var(--color-text-primary)',
                outline: 'none', fontFamily: 'monospace',
              }}
              onFocus={e => e.target.style.borderColor = '#4A43A0'}
              onBlur={e => e.target.style.borderColor = ''}
            />
            <Btn onClick={joinByCode} disabled={!user || joinCode.length < 4} loading={joining}>
              Join →
            </Btn>
          </div>
          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: 0 }}>
            Codes are case-insensitive · letters and numbers only.
          </p>
        </Card>
      )}

      {/* ── RECENT TAB ── */}
      {tab === 'recent' && (
        <div>
          {!user && <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Sign in to see your games.</p>}
          {user && loadingRecent && <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Loading…</p>}
          {user && !loadingRecent && recentGames.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No online games yet — create one above!</p>
          )}
          {recentGames.map(game => {
            const isWhite   = game.white_id === user?.id
            const oppName   = isWhite ? (game.black_name ?? '—') : (game.white_name ?? '—')
            const canRejoin = (game.status === 'waiting' || game.status === 'active')
                           && (game.white_id === user?.id || game.black_id === user?.id)
            const myResult  = game.result === 'draw' || game.result === 'aborted' ? game.result
                            : (isWhite && game.result === 'white') || (!isWhite && game.result === 'black') ? 'win' : 'loss'
            return (
              <div key={game.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px', marginBottom: 6,
                background: 'var(--color-background-primary)',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 'var(--border-radius-md)',
              }}>
                <span style={{ fontSize: 20 }}>{isWhite ? '♙' : '♟'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>
                    vs {oppName || 'Waiting for opponent…'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    {fmtDate(game.created_at)} · {fmtTime(game.time_control_ms)}
                    {game.result ? ` · ${myResult === 'win' ? '🏆 Win' : myResult === 'draw' ? '🤝 Draw' : myResult === 'aborted' ? '❌ Aborted' : '💀 Loss'}` : ''}
                  </div>
                </div>
                <StatusBadge status={game.status} />
                {canRejoin && (
                  <Btn onClick={() => rejoinGame(game)} small color={game.status === 'active' ? '#5CB88A' : '#4A43A0'}>
                    {game.status === 'active' ? 'Rejoin' : 'Share'}
                  </Btn>
                )}
                {game.status === 'waiting' && game.white_id === user?.id && (
                  <CopyBtn text={game.invite_code} label={game.invite_code} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tiny copy-to-clipboard button ────────────────────────────────
function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false)
  async function copy(e) {
    e.stopPropagation()
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} style={{
      padding: '5px 10px', fontSize: 12, fontWeight: 600,
      borderRadius: 'var(--border-radius-md)',
      border: `0.5px solid ${copied ? '#5CB88A' : 'var(--color-border-secondary)'}`,
      background: copied ? 'rgba(92,184,138,.1)' : 'var(--color-background-secondary)',
      color: copied ? '#5CB88A' : 'var(--color-text-secondary)',
      cursor: 'pointer', transition: 'all .2s', fontFamily: 'var(--font-sans)',
      whiteSpace: 'nowrap',
    }}>
      {copied ? '✓ Copied' : label ? `📋 ${label}` : '📋 Copy'}
    </button>
  )
}
