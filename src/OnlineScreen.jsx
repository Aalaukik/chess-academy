import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const C = {
  bg1: '#0E0D0A', bg2: '#161410', bg3: '#1F1C15', bg4: '#2A271E',
  text1: '#EDE7D4', text2: '#8C8476', text3: '#504C45',
  gold: '#C8A84B', green: '#4CAF82', red: '#E05555', amber: '#E08C30',
  border: 'rgba(255,255,255,0.06)',
}

const TIME_OPTS = [
  { label: '1 min',  ms: 60000,  icon: '⚡' },
  { label: '3 min',  ms: 180000, icon: '🔥' },
  { label: '5 min',  ms: 300000, icon: '⏱' },
  { label: '10 min', ms: 600000, icon: '🕐' },
  { label: '∞',      ms: 0,      icon: '♾' },
]

function Card({ children, style }) {
  return (
    <div style={{
      background: C.bg2, borderRadius: 16,
      padding: '1.25rem 1.5rem',
      boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.4)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function Btn({ children, onClick, disabled, color = C.gold, ghost = false, small = false, loading = false }) {
  const isPrimary = !ghost
  return (
    <button onClick={onClick} disabled={disabled || loading}
      style={{
        padding: small ? '6px 14px' : '11px 22px',
        fontSize: small ? 12 : 14, fontWeight: 700,
        borderRadius: 100,
        border: ghost ? `1px solid ${color}33` : 'none',
        background: ghost ? `${color}10` : `linear-gradient(135deg, #C8A84B, #E2C870)`,
        color: ghost ? color : '#1A1510',
        cursor: (disabled || loading) ? 'default' : 'pointer',
        opacity: (disabled || loading) ? 0.45 : 1,
        transition: 'opacity .15s, transform .12s',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font-sans)',
        boxShadow: (!ghost && !disabled && !loading) ? '0 3px 16px rgba(200,168,75,0.3)' : 'none',
      }}
      onMouseEnter={e => { if (!disabled && !loading) e.currentTarget.style.opacity = '.88' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
    >
      {loading ? '⏳ …' : children}
    </button>
  )
}

function StatusBadge({ status }) {
  const map = {
    waiting:  { label: 'Waiting', color: C.gold   },
    active:   { label: 'Live',    color: C.green  },
    complete: { label: 'Done',    color: C.text3  },
    aborted:  { label: 'Aborted', color: C.red    },
  }
  const s = map[status] ?? map.aborted
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 8px',
      borderRadius: 20, background: `${s.color}18`, color: s.color,
      letterSpacing: 0.5, textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  )
}

export default function OnlineScreen({ user, onJoinGame, onBack }) {
  const [tab, setTab]               = useState('create')
  const [timeMsIdx, setTimeMsIdx]   = useState(3)
  const [creating, setCreating]     = useState(false)
  const [waitingGame, setWaitingGame] = useState(null)
  const lobbyChannelRef             = useRef(null)
  const [joinCode, setJoinCode]     = useState('')
  const [joining, setJoining]       = useState(false)
  const [searching, setSearching]   = useState(false)
  const [recentGames, setRecentGames]   = useState([])
  const [loadingRecent, setLoadingRecent] = useState(false)
  const [error, setError] = useState('')
  const [info,  setInfo]  = useState('')

  const displayName = user ? (user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'Player') : null

  useEffect(() => {
    if (!user || tab !== 'recent') return
    loadRecentGames()
  }, [user, tab])

  useEffect(() => () => {
    if (lobbyChannelRef.current) { supabase.removeChannel(lobbyChannelRef.current); lobbyChannelRef.current = null }
  }, [])

  async function loadRecentGames() {
    setLoadingRecent(true)
    const { data } = await supabase.from('multiplayer_games').select('*')
      .or(`white_id.eq.${user.id},black_id.eq.${user.id}`)
      .order('created_at', { ascending: false }).limit(12)
    setRecentGames(data ?? [])
    setLoadingRecent(false)
  }

  async function createGame() {
    if (!user) { setError('Sign in to create an online game.'); return }
    setCreating(true); setError(''); setInfo('')
    const timeSel = TIME_OPTS[timeMsIdx]
    // Generate a random 6-char alphanumeric invite code client-side as a fallback
    // (a DB trigger should also set this; see multiplayer-games-schema.sql)
    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase()
    const { data, error: err } = await supabase.from('multiplayer_games').insert({
      white_id: user.id, white_name: displayName,
      time_control_ms: timeSel.ms,
      white_time_ms: timeSel.ms || 999999999,
      black_time_ms: timeSel.ms || 999999999,
      use_timer: timeSel.ms > 0,
      invite_code: inviteCode,
    }).select().single()
    setCreating(false)
    if (err || !data) { setError(err?.message ?? 'Failed to create game.'); return }
    setWaitingGame(data)
    subscribeToLobby(data.id, 'w')
  }

  function cancelWaiting() {
    if (!waitingGame) return
    supabase.from('multiplayer_games').update({ status: 'aborted', result: 'aborted', result_reason: 'abandoned' }).eq('id', waitingGame.id).then(() => {})
    if (lobbyChannelRef.current) { supabase.removeChannel(lobbyChannelRef.current); lobbyChannelRef.current = null }
    setWaitingGame(null)
  }

  async function joinByCode() {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 4) { setError('Enter a valid invite code.'); return }
    if (!user) { setError('Sign in to join a game.'); return }
    setJoining(true); setError(''); setInfo('')
    const { data: game, error: findErr } = await supabase.from('multiplayer_games').select('*').eq('invite_code', code).maybeSingle()
    if (findErr) { setJoining(false); setError(`Database error: ${findErr.message}`); return }
    if (!game) { setJoining(false); setError(`No game found with code "${code}".`); return }
    if (game.white_id === user.id) {
      setJoining(false); setInfo(`That's your game! Share code "${game.invite_code}" with a friend.`)
      setWaitingGame(game); subscribeToLobby(game.id, 'w'); return
    }
    if (game.status === 'complete' || game.status === 'aborted') { setJoining(false); setError('This game has already ended.'); return }
    if (game.status === 'active') {
      if (game.black_id === user.id) { setJoining(false); onJoinGame({ game, myColor: 'b' }); return }
      setJoining(false); setError('This game already has two players.'); return
    }
    await joinGameRow(game)
    setJoining(false)
  }

  async function quickMatch() {
    if (!user) { setError('Sign in to play online.'); return }
    if (searching) return
    setSearching(true); setError(''); setInfo('')
    const { data: games } = await supabase.from('multiplayer_games').select('*').eq('status', 'waiting').neq('white_id', user.id).order('created_at', { ascending: true }).limit(5)
    if (games && games.length > 0) {
      const joined = await joinGameRow(games[0])
      if (!joined) {
        for (let i = 1; i < games.length; i++) { const ok = await joinGameRow(games[i]); if (ok) { setSearching(false); return } }
        setSearching(false); await createGame()
      }
    } else { setSearching(false); await createGame() }
    setSearching(false)
  }

  async function joinGameRow(game) {
    const { data: updated, error: joinErr } = await supabase.from('multiplayer_games')
      .update({ black_id: user.id, black_name: displayName, status: 'active' })
      .eq('id', game.id).eq('status', 'waiting').select().maybeSingle()
    if (joinErr) { setError(`Join failed: ${joinErr.message}`); return false }
    if (!updated) {
      const { data: current } = await supabase.from('multiplayer_games').select('*').eq('id', game.id).maybeSingle()
      if (current?.status === 'active' && current?.black_id === user.id) { onJoinGame({ game: current, myColor: 'b' }); return true }
      setError(current?.status === 'active' ? 'Someone else joined first. Try Quick Match.' : 'Could not join this game.')
      return false
    }
    onJoinGame({ game: updated, myColor: 'b' })
    return true
  }

  function subscribeToLobby(gameId, myColor) {
    if (lobbyChannelRef.current) supabase.removeChannel(lobbyChannelRef.current)
    const ch = supabase.channel(`lobby:${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'multiplayer_games', filter: `id=eq.${gameId}` }, ({ new: g }) => {
        if (g.status === 'active') { supabase.removeChannel(ch); lobbyChannelRef.current = null; onJoinGame({ game: g, myColor }) }
      }).subscribe()
    lobbyChannelRef.current = ch
  }

  function rejoinGame(game) { onJoinGame({ game, myColor: game.white_id === user?.id ? 'w' : 'b' }) }
  function fmtDate(iso) { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  function fmtTime(ms) { if (!ms || ms >= 999999999) return '∞'; const m = Math.floor(ms / 60000); return m >= 60 ? `${Math.floor(m/60)}h` : `${m}m` }

  /* ── WAITING LOBBY ── */
  if (waitingGame) {
    return (
      <div style={{ padding: '1.5rem 0 5rem', fontFamily: 'var(--font-sans)' }}>
        <style>{`@keyframes bob{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}`}</style>
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
          <div style={{ fontSize: 64, animation: 'bob 1.8s ease-in-out infinite', display: 'inline-block', marginBottom: 20, filter: 'drop-shadow(0 0 20px rgba(200,168,75,0.3))' }}>♟</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: C.text1, marginBottom: 8 }}>Waiting for opponent…</h2>
          <p style={{ fontSize: 14, color: C.text2, marginBottom: 32 }}>Share this code with your friend</p>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 16,
            background: C.bg2, borderRadius: 16,
            padding: '18px 28px', marginBottom: 16,
            boxShadow: '0 1px 0 rgba(200,168,75,0.15) inset, 0 8px 32px rgba(0,0,0,0.5)',
            borderTop: '1px solid rgba(200,168,75,0.2)',
          }}>
            <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: 10, color: C.gold, fontFamily: 'monospace' }}>
              {waitingGame.invite_code}
            </span>
            <CopyBtn text={waitingGame.invite_code} />
          </div>

          <p style={{ fontSize: 12, color: C.text3, marginBottom: 32 }}>
            {fmtTime(waitingGame.time_control_ms)} time control · You are White ♙
          </p>
          <Btn onClick={cancelWaiting} ghost color={C.red}>Cancel</Btn>
        </div>
      </div>
    )
  }

  /* ── MAIN LOBBY ── */
  return (
    <div style={{ padding: '0.5rem 0 5.5rem', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        {onBack && (
          <button onClick={onBack} style={{ fontSize: 12, padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 100, cursor: 'pointer', color: C.text2, fontFamily: 'var(--font-sans)' }}>← Back</button>
        )}
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: C.text1, flex: 1 }}>🌐 Play Online</h1>
        {user && (
          <span style={{ fontSize: 12, color: C.text2, padding: '4px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 20 }}>
            👤 {displayName}
          </span>
        )}
      </div>

      {/* Guest warning */}
      {!user && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(200,168,75,0.07)', borderTop: '1px solid rgba(200,168,75,0.2)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text1, marginBottom: 3 }}>Sign in to play online</div>
          <div style={{ fontSize: 12, color: C.text2 }}>You need an account to create or join online games.</div>
        </div>
      )}

      {/* Alerts */}
      {error && <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(224,85,85,0.08)', border: '1px solid rgba(224,85,85,0.2)', fontSize: 13, color: C.red }}>{error}</div>}
      {info && !error && <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(76,175,130,0.08)', border: '1px solid rgba(76,175,130,0.2)', fontSize: 13, color: C.green }}>{info}</div>}

      {/* Quick match hero */}
      <div
        onClick={!user || searching ? undefined : quickMatch}
        style={{
          background: user ? 'linear-gradient(135deg, #1A1830 0%, #251E0A 100%)' : C.bg3,
          borderRadius: 20, padding: '1.5rem 1.75rem', marginBottom: 14,
          cursor: user && !searching ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', gap: 18,
          boxShadow: user ? '0 1px 0 rgba(200,168,75,0.1) inset, 0 8px 32px rgba(0,0,0,0.5)' : 'none',
          borderTop: user ? '1px solid rgba(200,168,75,0.15)' : 'none',
          opacity: !user ? 0.5 : 1,
          transition: 'transform .2s, box-shadow .2s',
        }}
        onMouseEnter={e => { if (user && !searching) e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = '' }}
      >
        <span style={{ fontSize: 40 }}>{searching ? '⏳' : '⚡'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text1, marginBottom: 3, fontFamily: 'var(--font-display)' }}>
            {searching ? 'Finding a match…' : 'Quick Match'}
          </div>
          <div style={{ fontSize: 12, color: C.text2 }}>Join an open game or create one and wait</div>
        </div>
        <div style={{ fontSize: 22, color: C.gold, opacity: 0.7 }}>→</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: C.bg3, borderRadius: 12, padding: 4 }}>
        {[['create', '+ Create'], ['join', '🔑 Join'], ['recent', '📋 Recent']].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setError(''); setInfo('') }}
            style={{
              flex: 1, padding: '8px 0', fontSize: 13,
              background: tab === id ? C.bg2 : 'transparent',
              color: tab === id ? C.text1 : C.text2,
              border: 'none', borderRadius: 9, cursor: 'pointer',
              fontWeight: tab === id ? 600 : 400,
              boxShadow: tab === id ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
              transition: 'all .15s', fontFamily: 'var(--font-sans)',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── CREATE ── */}
      {tab === 'create' && (
        <Card>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text3, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Time Control</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22 }}>
            {TIME_OPTS.map((opt, i) => (
              <button key={i} onClick={() => setTimeMsIdx(i)}
                style={{
                  flex: 1, minWidth: 52, padding: '11px 6px',
                  borderRadius: 12,
                  border: 'none',
                  background: timeMsIdx === i ? 'rgba(200,168,75,0.12)' : 'rgba(255,255,255,0.04)',
                  outline: timeMsIdx === i ? `2px solid rgba(200,168,75,0.5)` : '2px solid transparent',
                  cursor: 'pointer', textAlign: 'center',
                  transition: 'all .15s', fontFamily: 'var(--font-sans)',
                }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.icon}</div>
                <div style={{ fontSize: 12, fontWeight: timeMsIdx === i ? 700 : 400, color: timeMsIdx === i ? C.gold : C.text2 }}>{opt.label}</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.text2, marginBottom: 18, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
            You will play as <strong style={{ color: C.text1 }}>White ♙</strong> — your opponent joins as Black.
          </div>
          <Btn onClick={createGame} disabled={!user} loading={creating}>Create Game →</Btn>
        </Card>
      )}

      {/* ── JOIN ── */}
      {tab === 'join' && (
        <Card>
          <p style={{ fontSize: 13, color: C.text2, marginBottom: 16, lineHeight: 1.5 }}>
            Ask your opponent for their 6-character invite code.
          </p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input
              value={joinCode}
              onChange={e => { setError(''); setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)) }}
              onKeyDown={e => e.key === 'Enter' && !joining && joinByCode()}
              placeholder="A3K9XZ" maxLength={6}
              style={{
                flex: 1, fontSize: 24, fontWeight: 700, letterSpacing: 8,
                padding: '12px 16px', textAlign: 'center',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                color: C.text1, outline: 'none', fontFamily: 'monospace',
                transition: 'border-color .15s',
              }}
              onFocus={e => e.target.style.borderColor = C.gold}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
            <Btn onClick={joinByCode} disabled={!user || joinCode.length < 4} loading={joining}>Join →</Btn>
          </div>
          <p style={{ fontSize: 11, color: C.text3, margin: 0 }}>Codes are case-insensitive · letters and numbers only.</p>
        </Card>
      )}

      {/* ── RECENT ── */}
      {tab === 'recent' && (
        <div>
          {!user && <p style={{ fontSize: 13, color: C.text2, fontStyle: 'italic' }}>Sign in to see your games.</p>}
          {user && loadingRecent && <p style={{ fontSize: 13, color: C.text2, fontStyle: 'italic' }}>Loading…</p>}
          {user && !loadingRecent && recentGames.length === 0 && (
            <p style={{ fontSize: 13, color: C.text2, fontStyle: 'italic' }}>No online games yet!</p>
          )}
          {recentGames.map(game => {
            const isWhite = game.white_id === user?.id
            const oppName = isWhite ? (game.black_name ?? '—') : (game.white_name ?? '—')
            const canRejoin = (game.status === 'waiting' || game.status === 'active') && (game.white_id === user?.id || game.black_id === user?.id)
            const myResult = game.result === 'draw' || game.result === 'aborted' ? game.result
              : (isWhite && game.result === 'white') || (!isWhite && game.result === 'black') ? 'win' : 'loss'
            return (
              <div key={game.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', marginBottom: 6,
                background: C.bg2, borderRadius: 12,
                boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 2px 8px rgba(0,0,0,0.3)',
              }}>
                <span style={{ fontSize: 20 }}>{isWhite ? '♙' : '♟'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text1, marginBottom: 2 }}>
                    vs {oppName || 'Waiting for opponent…'}
                  </div>
                  <div style={{ fontSize: 11, color: C.text3 }}>
                    {fmtDate(game.created_at)} · {fmtTime(game.time_control_ms)}
                    {game.result ? ` · ${myResult === 'win' ? '🏆 Win' : myResult === 'draw' ? '🤝 Draw' : myResult === 'aborted' ? '❌ Aborted' : '💀 Loss'}` : ''}
                  </div>
                </div>
                <StatusBadge status={game.status} />
                {canRejoin && (
                  <Btn onClick={() => rejoinGame(game)} small color={game.status === 'active' ? C.green : C.gold}>
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

function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false)
  async function copy(e) {
    e.stopPropagation()
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} style={{
      padding: '5px 10px', fontSize: 12, fontWeight: 600, borderRadius: 20,
      border: `1px solid ${copied ? 'rgba(76,175,130,0.3)' : 'rgba(255,255,255,0.08)'}`,
      background: copied ? 'rgba(76,175,130,0.08)' : 'rgba(255,255,255,0.04)',
      color: copied ? C.green : C.text2,
      cursor: 'pointer', transition: 'all .2s', fontFamily: 'var(--font-sans)',
      whiteSpace: 'nowrap',
    }}>
      {copied ? '✓ Copied' : label ? `📋 ${label}` : '📋 Copy'}
    </button>
  )
}
