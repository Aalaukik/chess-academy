import { useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'

/**
 * useOnlineGame
 * ─────────────
 * Manages a Supabase Realtime channel for one live chess game.
 *
 * Architecture:
 *   • Broadcast  → instant move delivery   (<100 ms, fire-and-forget)
 *   • Postgres Changes → source-of-truth sync on reconnect / missed broadcast
 *   • Presence   → detect when opponent joins / leaves
 *
 * @param {string}   gameId          – UUID of the multiplayer_games row
 * @param {string}   userId          – auth.uid() of the local player
 * @param {Function} onOpponentMove  – called with move payload when opponent plays
 * @param {Function} onGameEvent     – called for resign / draw-offer / db-sync events
 * @param {Function} onPresenceChange– called with online user list on every change
 */
export function useOnlineGame({ gameId, userId, onOpponentMove, onGameEvent, onPresenceChange }) {
  const channelRef    = useRef(null)
  const gameIdRef     = useRef(gameId)
  const userIdRef     = useRef(userId)
  const callbacksRef  = useRef({})   // keep callbacks stable without re-subscribing

  // Keep refs fresh without triggering the main effect
  useEffect(() => { gameIdRef.current   = gameId;  }, [gameId])
  useEffect(() => { userIdRef.current   = userId;  }, [userId])
  useEffect(() => {
    callbacksRef.current = { onOpponentMove, onGameEvent, onPresenceChange }
  })

  // ── Subscribe / unsubscribe ──────────────────────────────────────
  useEffect(() => {
    if (!gameId || !userId) return

    // Channel name is scoped to this game so broadcasts don't leak
    const channel = supabase.channel(`online_game:${gameId}`, {
      config: {
        broadcast: { self: false, ack: false }, // don't echo our own broadcasts
        presence:  { key: userId },
      },
    })

    // ── Presence: opponent online / offline ──────────────────────
    channel.on('presence', { event: 'sync' }, () => {
      const raw   = channel.presenceState()
      // Build a simple Set of user IDs currently online
      const online = new Set(Object.keys(raw))
      callbacksRef.current.onPresenceChange?.(online)
    })

    // ── Broadcast: opponent's move (arrives in ~50–150 ms) ───────
    channel.on('broadcast', { event: 'move' }, ({ payload }) => {
      callbacksRef.current.onOpponentMove?.(payload)
    })

    // ── Broadcast: resign / draw-offer / draw-accept / abort ────
    channel.on('broadcast', { event: 'game_event' }, ({ payload }) => {
      callbacksRef.current.onGameEvent?.(payload)
    })

    // ── Postgres Changes: reliable fallback + reconnect sync ─────
    //    Fires when the DB row is updated (move committed to DB).
    //    We use this to resync after a network gap.
    channel.on(
      'postgres_changes',
      {
        event:  'UPDATE',
        schema: 'public',
        table:  'multiplayer_games',
        filter: `id=eq.${gameId}`,
      },
      ({ new: game }) => {
        callbacksRef.current.onGameEvent?.({ type: 'db_sync', game })
      }
    )

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Announce presence so the opponent can see us online
        await channel.track({
          user_id:   userId,
          online_at: new Date().toISOString(),
        })
      }
    })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [gameId, userId]) // only re-run if game or user changes

  // ── Send a move to the opponent ──────────────────────────────────
  // payload: { from, to, promotion, san, fen, movesCount, whiteTimeMs, blackTimeMs }
  const broadcastMove = useCallback(async (payload) => {
    if (!channelRef.current) return
    await channelRef.current.send({
      type:    'broadcast',
      event:   'move',
      payload,
    })
  }, [])

  // ── Send a game event to the opponent ───────────────────────────
  // payload: { type: 'resign' | 'draw_offer' | 'draw_accept' | 'draw_decline' | 'abort' }
  const broadcastEvent = useCallback(async (payload) => {
    if (!channelRef.current) return
    await channelRef.current.send({
      type:    'broadcast',
      event:   'game_event',
      payload,
    })
  }, [])

  return { broadcastMove, broadcastEvent }
}

// ── Supabase DB helpers ───────────────────────────────────────────

/** Commit a move to the DB (source of truth). Call after broadcastMove. */
export async function commitMoveToDb(gameId, { fen, moveHistory, lastFrom, lastTo, whiteTimeMs, blackTimeMs, status, result, resultReason }) {
  const update = {
    fen,
    move_history:  moveHistory,
    last_move_from: lastFrom,
    last_move_to:   lastTo,
    white_time_ms:  whiteTimeMs,
    black_time_ms:  blackTimeMs,
    last_move_at:   new Date().toISOString(),
  }
  if (status)       update.status        = status
  if (result)       update.result        = result
  if (resultReason) update.result_reason = resultReason

  const { error } = await supabase
    .from('multiplayer_games')
    .update(update)
    .eq('id', gameId)

  if (error) console.error('[commitMove]', error.message)
}

/** Mark a game as complete (resign / timeout / game-over by rules). */
export async function finalizeGame(gameId, { result, resultReason, whiteTimeMs, blackTimeMs }) {
  const { error } = await supabase
    .from('multiplayer_games')
    .update({
      status:        'complete',
      result,
      result_reason: resultReason,
      white_time_ms: whiteTimeMs ?? undefined,
      black_time_ms: blackTimeMs ?? undefined,
    })
    .eq('id', gameId)

  if (error) console.error('[finalizeGame]', error.message)
}
