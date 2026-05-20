import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const DIFF_LABELS = ['Beginner', 'Casual', 'Intermediate', 'Advanced', 'Master']
const DIFF_COLORS = ['#5CB88A', '#6BB5F0', '#F5C842', '#F08C4A', '#E85555']

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-md)',
      padding: '12px 10px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color }}>{value}</div>
    </div>
  )
}

export default function ProfileScreen({ user, stats, doneLessons, solvedPz, streak, onBack, onSignOut }) {
  const [games, setGames] = useState([])
  const [loadingGames, setLoadingGames] = useState(true)
  const [activeTab, setActiveTab] = useState('history') // history | leaderboard
  const [leaderboard, setLeaderboard] = useState([])

  const isGuest = !user

  // ── Load game history ─────────────────────────────────────────
  useEffect(() => {
    if (!user) { setLoadingGames(false); return }
    supabase
      .from('game_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('played_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { setGames(data ?? []); setLoadingGames(false) })
  }, [user?.id])

  // ── Load leaderboard ──────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'leaderboard') return
    supabase
      .from('leaderboard')
      .select('*')
      .limit(20)
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

  const resultColor = { win: '#5CB88A', loss: '#E85555', draw: '#F5C842', resign: '#E85555', timeout: '#F08C4A' }
  const resultEmoji = { win: '🏆', loss: '💀', draw: '🤝', resign: '🏳', timeout: '⏰' }

  return (
    <div style={{ padding: '0.5rem 0 2rem', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <button onClick={onBack} style={{ fontSize: 12, padding: '5px 10px', background: 'none', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
          ← Back
        </button>
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>
          {isGuest ? '👤 Guest' : `👤 ${user.user_metadata?.username ?? user.email?.split('@')[0]}`}
        </span>
        {!isGuest && (
          <button onClick={onSignOut} style={{ fontSize: 12, padding: '5px 12px', background: 'none', border: '0.5px solid #E85555', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', color: '#E85555' }}>
            Sign out
          </button>
        )}
      </div>

      {/* Guest prompt */}
      {isGuest && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--border-radius-md)', background: 'rgba(74,67,160,0.08)', border: '0.5px solid #4A43A0' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>
            Create a free account to sync progress
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Your games, lessons, and puzzle streak will be saved across all your devices.
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
        <StatCard icon="🏆" label="Wins"    value={stats.w}     color="#5CB88A" />
        <StatCard icon="💀" label="Losses"  value={stats.l}     color="#E85555" />
        <StatCard icon="🤝" label="Draws"   value={stats.d}     color="#F5C842" />
        <StatCard icon="📊" label="Win rate" value={`${winRate}%`} color="#4A43A0" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 20 }}>
        <StatCard icon="🎓" label="Lessons" value={doneLessons.size} color="#0F6E56" />
        <StatCard icon="🧩" label="Puzzles" value={solvedPz.size}    color="#C04A90" />
        <StatCard icon="🔥" label="Streak"  value={streak}           color="#F08C4A" />
      </div>

      {/* Tabs */}
      {!isGuest && (
        <>
          <div style={{ display: 'flex', borderBottom: '0.5px solid var(--color-border-tertiary)', marginBottom: 14 }}>
            {[['history', '📋 Game History'], ['leaderboard', '🏅 Leaderboard']].map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{ flex: 1, padding: '8px 0', fontSize: 13, background: 'none', border: 'none', borderBottom: activeTab === id ? '2px solid #4A43A0' : '2px solid transparent', color: activeTab === id ? '#4A43A0' : 'var(--color-text-secondary)', cursor: 'pointer', fontWeight: activeTab === id ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>

          {/* Game history */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loadingGames && <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Loading games…</p>}
              {!loadingGames && games.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No games played yet — start a game to see it here!</p>
              )}
              {games.map(g => (
                <div key={g.id} style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22 }}>{resultEmoji[g.result] ?? '♟'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: resultColor[g.result] ?? 'var(--color-text-primary)', textTransform: 'capitalize' }}>{g.result}</span>
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' }}>
                        {g.player_color === 'w' ? '♙ White' : '♟ Black'}
                      </span>
                      <span style={{ fontSize: 11, color: DIFF_COLORS[g.difficulty], fontWeight: 600 }}>
                        {DIFF_LABELS[g.difficulty]}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {g.opening || 'Custom Opening'} · {g.total_moves} moves · {fmtDuration(g.duration_s)}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', flexShrink: 0, textAlign: 'right' }}>
                    {fmtDate(g.played_at)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Leaderboard */}
          {activeTab === 'leaderboard' && (
            <div>
              {leaderboard.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Loading leaderboard…</p>}
              {leaderboard.map((row, i) => (
                <div key={row.username} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', background: row.username === (user.user_metadata?.username ?? user.email?.split('@')[0]) ? 'rgba(74,67,160,0.06)' : 'transparent', borderRadius: i === 0 ? 'var(--border-radius-md) var(--border-radius-md) 0 0' : undefined }}>
                  <span style={{ fontSize: 16, width: 28, textAlign: 'center', flexShrink: 0 }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>{row.username}</span>
                  <span style={{ fontSize: 13, color: '#5CB88A', fontWeight: 600 }}>{row.wins}W</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{row.win_rate}%</span>
                  <span style={{ fontSize: 11, color: '#C04A90' }}>🧩 {row.puzzles_solved ?? 0}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
