import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

/**
 * useSupabaseProgress
 * ───────────────────
 * Loads progress from Supabase on mount (when user is logged in),
 * and saves it back after every change with a 1.5s debounce.
 *
 * Returns { saveGame } — call this after every completed game.
 */
export function useSupabaseProgress({
  user,
  // state setters
  setDoneLessons,
  setSolvedPz,
  setStreak,
  setStats,
  setElo,
  // current state (for saves)
  doneLessons,
  solvedPz,
  streak,
  stats,
  elo,
}) {
  const saveTimerRef = useRef(null)

  // ── Load progress from Supabase on login ──────────────────────
  useEffect(() => {
    if (!user) return

    async function loadProgress() {
      const { data, error } = await supabase
        .from('progress')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error || !data) return

      if (data.completed_lessons?.length) setDoneLessons(new Set(data.completed_lessons))
      if (data.solved_puzzles?.length)    setSolvedPz(new Set(data.solved_puzzles))
      if (data.puzzle_streak != null)     setStreak(data.puzzle_streak)
      if (data.wins != null)              setStats({ w: data.wins, l: data.losses, d: data.draws })
      if (data.elo != null)               setElo(data.elo)
    }

    loadProgress()
  }, [user?.id])

  // ── Debounced save whenever progress changes ──────────────────
  useEffect(() => {
    if (!user) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      supabase.from('progress').upsert({
        user_id:           user.id,
        completed_lessons: [...doneLessons],
        solved_puzzles:    [...solvedPz],
        puzzle_streak:     streak,
        wins:              stats.w,
        losses:            stats.l,
        draws:             stats.d,
        elo,
        updated_at:        new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.error('[progress save]', error.message)
      })
    }, 1500)

    return () => clearTimeout(saveTimerRef.current)
  }, [doneLessons, solvedPz, streak, stats, elo, user?.id])

  // ── Save a completed game session ─────────────────────────────
  async function saveGame({ result, playerColor, difficulty, moves, opening, durationS }) {
    if (!user) return // guests don't save to DB

    const { error } = await supabase.from('game_sessions').insert({
      user_id:      user.id,
      result,
      player_color: playerColor,
      difficulty,
      moves,
      opening,
      total_moves:  moves.length,
      duration_s:   durationS,
    })

    if (error) console.error('[game save]', error.message)
  }

  return { saveGame }
}
