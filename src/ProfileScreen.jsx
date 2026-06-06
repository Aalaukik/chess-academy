import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const C = {
  bg2: '#161410', bg3: '#1F1C15', bg4: '#2A271E',
  text1: '#EDE7D4', text2: '#8C8476', text3: '#504C45',
  gold: '#C8A84B', green: '#4CAF82', red: '#E05555', amber: '#E08C30',
}

const DIFF_LABELS = ['Beginner', 'Casual', 'Intermediate', 'Advanced', 'Master']
const DIFF_COLORS = [C.green, '#6BB5F0', C.gold, C.amber, C.red]

function StatPill({ icon, label, value, color }) {
  return (
    <div style={{
      background: C.bg2,
      borderRadius: 14,
      padding: '14px 10px',
      textAlign: 'center',
      boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 16px rgba(0,0,0,0.35)',
    }}>
      <div style={{ fontSize: 10, color: C.text3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{value}</div>
    </div>
  )
}

export default function ProfileScreen({ user, stats, doneLessons, solvedPz, streak, onBack, onSignOut }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('history')
  const [leaderboard, setLeaderboard] = useState([])
  const isGuest = !user

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase.from('game_sessions').select('*').eq('user_id', user.id)
      .order('played_at', { ascending: false }).limit(20)
      .then(({ data }) => { setGames(data ?? []); setLoading(false) })
  }, [user?.id])

  useEffect(() => {
    if (activeTab !== 'leaderboard') return
    supabase.from('leaderboard').select('*').limit(20)
      .then(({ data }) => setLeaderboard(data ?? []))
  }, [activeTab])

  const totalGames = stats.w + stats.l + stats.d
  const winRate = totalGames > 0 ? Math.round((stats.w / totalGames) * 100) : 0

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  function fmtDuration(s) {
    if (!s) return '—'
    const m = Math.floor(s / 60)
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
  }

  const resultColor = { win: C.green, loss: C.red, draw: C.gold, resign: C.red, timeout: C.amber }
  const resultEmoji = { win: '🏆', loss: '💀', draw: '🤝', resign: '🏳', timeout: '⏰' }

  const displayName = user ? (user.user_metadata?.username ?? user.email?.split('@')[0]) : 'Guest'

  return (
    <div style={{ padding: '0.5rem 0 2rem', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
        <button onClick={onBack} style={{ fontSize: 12, padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 100, cursor: 'pointer', color: C.text2, fontFamily: 'var(--font-sans)' }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text1 }}>{isGuest ? '👤 Guest' : `👤 ${displayName}`}</div>
          {!isGuest && <div style={{ fontSize: 12, color: C.text3 }}>{user.email}</div>}
        </div>
        {!isGuest && (
          <button onClick={onSignOut} style={{ fontSize: 12, padding: '6px 12px', background: 'rgba(224,85,85,0.08)', border: '1px solid rgba(224,85,85,0.25)', borderRadius: 100, cursor: 'pointer', color: C.red, fontFamily: 'var(--font-sans)' }}>
            Sign out
          </button>
        )}
      </div>

      {/* Guest prompt */}
      {isGuest && (
        <div style={{ marginBottom: 18, padding: '14px 16px', borderRadius: 14, background: 'rgba(200,168,75,0.07)', borderTop: '1px solid rgba(200,168,75,0.2)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text1, marginBottom: 4 }}>Create a free account to sync progress</div>
          <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.5 }}>Your games, lessons, and puzzle streak will be saved across all your devices.</div>
        </div>
      )}

      {/* Main stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
        <StatPill icon="🏆" label="Wins"    value={stats.w}        color={C.green} />
        <StatPill icon="💀" label="Losses"  value={stats.l}        color={C.red}   />
        <StatPill icon="🤝" label="Draws"   value={stats.d}        color={C.gold}  />
        <StatPill icon="📊" label="Win %"   value={`${winRate}%`}  color={C.text1} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 22 }}>
        <StatPill icon="🎓" label="Lessons" value={doneLessons.size} color="#4AA8D4" />
        <StatPill icon="🧩" label="Puzzles" value={solvedPz.size}    color="#C04A90" />
        <StatPill icon="🔥" label="Streak"  value={streak}           color={C.amber} />
      </div>

      {/* Tabs */}
      {!isGuest && (
        <>
          <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: C.bg3, borderRadius: 12, padding: 4 }}>
            {[['history', '📋 History'], ['leaderboard', '🏅 Leaderboard']].map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)}
                style={{
                  flex: 1, padding: '8px 0', fontSize: 13,
                  background: activeTab === id ? C.bg2 : 'transparent',
                  color: activeTab === id ? C.text1 : C.text2,
                  border: 'none', borderRadius: 9, cursor: 'pointer',
                  fontWeight: activeTab === id ? 600 : 400,
                  boxShadow: activeTab === id ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                  transition: 'all .15s',
                  fontFamily: 'var(--font-sans)',
                }}>
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {loading && <p style={{ fontSize: 13, color: C.text2, fontStyle: 'italic' }}>Loading games…</p>}
              {!loading && games.length === 0 && <p style={{ fontSize: 13, color: C.text2, fontStyle: 'italic' }}>No games yet — start playing!</p>}
              {games.map(g => (
                <div key={g.id} style={{
                  background: C.bg2, borderRadius: 12, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 2px 8px rgba(0,0,0,0.3)',
                }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{resultEmoji[g.result] ?? '♟'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: resultColor[g.result] ?? C.text1, textTransform: 'capitalize' }}>{g.result}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: C.text2 }}>
                        {g.player_color === 'w' ? '♙ White' : '♟ Black'}
                      </span>
                      {g.difficulty != null && (
                        <span style={{ fontSize: 11, color: DIFF_COLORS[g.difficulty], fontWeight: 600 }}>
                          {DIFF_LABELS[g.difficulty]}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: C.text3 }}>
                      {g.opening || 'Custom Opening'} · {g.total_moves} moves · {fmtDuration(g.duration_s)}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: C.text3, flexShrink: 0, textAlign: 'right' }}>{fmtDate(g.played_at)}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div style={{ background: C.bg2, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.4)' }}>
              {leaderboard.length === 0 && <p style={{ fontSize: 13, color: C.text2, fontStyle: 'italic', padding: '1rem' }}>Loading…</p>}
              {leaderboard.map((row, i) => {
                const isMe = row.username === displayName
                return (
                  <div key={row.username} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderBottom: i < leaderboard.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: isMe ? 'rgba(200,168,75,0.06)' : 'transparent',
                  }}>
                    <span style={{ fontSize: 15, width: 28, textAlign: 'center', flexShrink: 0, color: i < 3 ? [C.gold, C.text2, C.amber][i] : C.text3, fontWeight: 700 }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                    </span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: isMe ? 700 : 500, color: isMe ? C.gold : C.text1 }}>{row.username}</span>
                    <span style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>{row.wins}W</span>
                    <span style={{ fontSize: 12, color: C.text2 }}>{row.win_rate}%</span>
                    <span style={{ fontSize: 11, color: '#C04A90' }}>🧩 {row.puzzles_solved ?? 0}</span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
