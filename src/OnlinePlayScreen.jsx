import { useState, useEffect, useRef, useCallback } from 'react'
import { useOnlineGame, commitMoveToDb, finalizeGame } from './useOnlineGame'
import { supabase } from './supabase'

// ── Piece unicode map (same as chess-academy.jsx) ────────────────
const UNI = { wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟' }
const SQ  = 46  // square size in px

// ── Board themes (same as chess-academy.jsx) ─────────────────────
const THEMES = {
  walnut:  {l:'#F0D9B5',d:'#B58863',sel:'rgba(246,246,60,.82)',hint:'rgba(20,85,30,.52)',last:'rgba(246,246,60,.40)',bdr:'#8B6B40'},
  slate:   {l:'#DEE3E6',d:'#8CA2AD',sel:'rgba(60,180,255,.82)',hint:'rgba(0,100,220,.45)',last:'rgba(60,180,255,.35)',bdr:'#6A8A9A'},
  jade:    {l:'#FFFFDD',d:'#86A666',sel:'rgba(200,245,60,.85)',hint:'rgba(50,130,20,.50)',last:'rgba(200,245,60,.40)',bdr:'#627A45'},
  midnight:{l:'#4A4A6A',d:'#1E1A3A',sel:'rgba(155,205,255,.85)',hint:'rgba(100,170,255,.42)',last:'rgba(155,205,255,.32)',bdr:'#2A2460'},
  rose:    {l:'#F4DDE0',d:'#C47A85',sel:'rgba(255,230,60,.82)',hint:'rgba(180,50,60,.40)',last:'rgba(255,230,60,.38)',bdr:'#A05065'},
  ocean:   {l:'#D6EEF8',d:'#2E7EA8',sel:'rgba(255,236,60,.85)',hint:'rgba(0,160,200,.50)',last:'rgba(255,236,60,.40)',bdr:'#1A5F82'},
  forest:  {l:'#E8F0D8',d:'#4A7C3F',sel:'rgba(255,240,60,.85)',hint:'rgba(30,100,20,.52)',last:'rgba(255,240,60,.38)',bdr:'#2D5A24'},
  glass:   {l:'rgba(220,230,245,.75)',d:'rgba(80,100,140,.70)',sel:'rgba(255,220,60,.88)',hint:'rgba(60,100,200,.45)',last:'rgba(255,220,60,.40)',bdr:'rgba(100,130,180,.60)'},
}

// ── Sound (same lightweight engine as chess-academy) ────────────
function mkSound() {
  let ctx=null
  const gc=()=>{if(!ctx)ctx=new(window.AudioContext||window.webkitAudioContext)();return ctx}
  function tone(freq,dur,type='sine',vol=0.16){
    try{const c=gc(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);g.gain.setValueAtTime(vol,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);o.start(c.currentTime);o.stop(c.currentTime+dur)}catch{}
  }
  return{
    move:   ()=>tone(440,0.08,'square',0.10),
    capture:()=>{tone(280,0.14,'sawtooth',0.14);setTimeout(()=>tone(200,0.12,'square',0.08),60)},
    check:  ()=>{tone(600,0.10,'square',0.20);setTimeout(()=>tone(500,0.12,'square',0.14),90)},
    castle: ()=>{tone(380,0.10,'sine',0.12);setTimeout(()=>tone(480,0.10,'sine',0.12),100)},
    over:   ()=>[440,392,349,330].forEach((f,i)=>setTimeout(()=>tone(f,0.22,'sine',0.18),i*160)),
    win:    ()=>[523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.22,'sine',0.18),i*140)),
  }
}
const SND = mkSound()

// ════════════════════════════════════════════════════════════════
//  BOARD COMPONENT  (self-contained, accepts all config via props)
// ════════════════════════════════════════════════════════════════
function Board({ brd, onSq, selSq, legalSqs=[], lastMove=null, chkSq=null, flipped=false, theme='walnut', showCoords=true, isMyTurn=false, gameOver=false }) {
  const t   = THEMES[theme] ?? THEMES.walnut
  const fl  = flipped
  const rows = fl ? [...brd].reverse() : brd

  return (
    <div style={{
      display:'inline-flex', flexDirection:'column', borderRadius:6, overflow:'hidden',
      boxShadow:'0 20px 60px rgba(0,0,0,.55),0 3px 10px rgba(0,0,0,.4)',
      border:`2px solid ${t.bdr}`,
      outline: !gameOver ? (isMyTurn ? '3px solid #534AB7' : '3px solid rgba(83,74,183,0.18)') : '3px solid transparent',
      outlineOffset:'2px', transition:'outline-color .4s ease',
      userSelect:'none', WebkitUserSelect:'none',
    }}>
      {rows.map((rowData, ri) => {
        const bRow = fl ? 7-ri : ri
        const rank = 8-bRow
        const dispRow = fl ? [...rowData].reverse() : rowData
        return (
          <div key={ri} style={{ display:'flex' }}>
            {showCoords && (
              <div style={{ width:18, height:SQ, display:'flex', alignItems:'center', justifyContent:'center', background:'#12100E', fontSize:9, color:'#666', fontFamily:'monospace', fontWeight:700, flexShrink:0 }}>
                {rank}
              </div>
            )}
            {dispRow.map((piece, ci) => {
              const bCol = fl ? 7-ci : ci
              const sq   = `${String.fromCharCode(97+bCol)}${rank}`
              const isLight  = (bRow+bCol)%2 !== 0
              const isSel    = selSq === sq
              const isLeg    = legalSqs.includes(sq)
              const isLF     = lastMove?.from === sq
              const isLT     = lastMove?.to   === sq
              const isChk    = chkSq === sq
              const pk       = piece ? `${piece.color}${piece.type.toUpperCase()}` : null
              const isW      = piece?.color === 'w'
              let bg = isLight ? t.l : t.d
              if (isSel)         bg = t.sel
              else if (isLF||isLT) bg = t.last
              if (isChk) bg = 'rgba(220,60,40,.72)'
              return (
                <div key={ci} onClick={() => onSq(sq)}
                  className="board-sq"
                  style={{
                    width:SQ, height:SQ, background:bg,
                    cursor: piece ? 'pointer' : 'default',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    position:'relative', transition:'background .08s',
                    outline: isSel ? '2.5px solid rgba(255,255,0,.95)' : 'none',
                    outlineOffset:'-2.5px', boxSizing:'border-box',
                    animation: isLT ? 'sqFlash .45s ease-out' : 'none',
                  }}>
                  {isLeg && !piece && (
                    <div style={{ width:Math.round(SQ*.34), height:Math.round(SQ*.34), borderRadius:'50%', background:t.hint, pointerEvents:'none', animation:'hintAppear .18s ease-out' }}/>
                  )}
                  {isLeg && piece && (
                    <div style={{ position:'absolute', inset:0, boxShadow:`inset 0 0 0 4px ${t.hint}`, pointerEvents:'none', borderRadius:2 }}/>
                  )}
                  {piece && (
                    <span className="chess-piece" style={{
                      fontSize:Math.round(SQ*.82), lineHeight:1, userSelect:'none',
                      color: isW ? '#fff' : '#0A0808',
                      textShadow: isW
                        ? '0 0 6px #000,0 2px 8px rgba(0,0,0,.95),0 0 2px #222'
                        : '0 0 3px rgba(255,255,255,.25),0 1px 5px rgba(0,0,0,.5)',
                      position:'relative', zIndex:1,
                      WebkitUserSelect:'none',
                    }}>
                      {UNI[pk]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
      {showCoords && (
        <div style={{ display:'flex', background:'#12100E' }}>
          <div style={{ width:18 }}/>
          {Array.from({ length:8 }, (_,i) => (
            <div key={i} style={{ width:SQ, textAlign:'center', fontSize:9, color:'#666', padding:'3px 0', fontFamily:'monospace', fontWeight:700 }}>
              {String.fromCharCode(97+(fl?7-i:i))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ════════════════════════════════════════════════════════════════
/**
 * @param {object}   gameData  – { game: row, myColor: 'w'|'b' }
 * @param {object}   user      – Supabase auth user
 * @param {Function} onBack    – navigate back to OnlineScreen
 * @param {object}   ChessLib  – ref containing Chess class
 * @param {boolean}  loaded    – chess.js loaded flag
 * @param {string}   theme     – board theme key
 * @param {boolean}  showCoords
 * @param {boolean}  soundOn
 */
export default function OnlinePlayScreen({ gameData, user, onBack, ChessLib, loaded, theme='walnut', showCoords=true, soundOn=true }) {
  const { game: initGame, myColor } = gameData
  const myName  = myColor === 'w' ? initGame.white_name : initGame.black_name
  const oppName = myColor === 'w' ? (initGame.black_name ?? 'Waiting…') : initGame.white_name
  const isFlipped = myColor === 'b'

  // ── Chess engine ─────────────────────────────────────────────
  const chessRef  = useRef(null)
  const [board,   setBoard]   = useState([])
  const [hist,    setHist]    = useState([])   // verbose move history
  const [sel,     setSel]     = useState(null)
  const [legal,   setLegal]   = useState([])
  const [lastMv,  setLastMv]  = useState(null)
  const [inChk,   setInChk]   = useState(false)
  const [gStatus, setGStatus] = useState('playing') // playing | complete
  const [winner,  setWinner]  = useState(null)      // 'white'|'black'|'draw'
  const [resultReason, setResultReason] = useState('')
  const moveListRef = useRef(null)

  // ── Promo dialog ─────────────────────────────────────────────
  const [promoFrom, setPromoFrom] = useState(null)
  const [promoTo,   setPromoTo]   = useState(null)

  // ── Timers (ms, ticking locally) ────────────────────────────
  const [myTimeMs,  setMyTimeMs]  = useState(initGame.use_timer ? (myColor === 'w' ? initGame.white_time_ms : initGame.black_time_ms) : null)
  const [oppTimeMs, setOppTimeMs] = useState(initGame.use_timer ? (myColor === 'w' ? initGame.black_time_ms : initGame.white_time_ms) : null)
  const timerRef = useRef(null)

  // ── Draw offer state ─────────────────────────────────────────
  const [drawOfferedByMe,  setDrawOfferedByMe]  = useState(false)
  const [drawOfferedByOpp, setDrawOfferedByOpp] = useState(false)

  // ── Opponent presence ─────────────────────────────────────────
  const [oppOnline, setOppOnline] = useState(false)

  // ── Move list panel ──────────────────────────────────────────
  const [panelTab, setPanelTab] = useState('moves')

  function play(k) { if (soundOn) SND[k]?.() }

  // ════════════════════════════════════════════════════════════════
  //  INIT — load FEN, replay moves already in the game row
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!loaded || !ChessLib.current) return
    const g = new ChessLib.current()
    // Replay stored moves so our chess.js is at the current position
    const moves = initGame.move_history ?? []
    for (const san of moves) {
      try { g.move(san) } catch {}
    }
    chessRef.current = g
    syncBoard(g)
    // If game is already over (rejoining a finished game) show result
    if (initGame.status === 'complete') {
      setGStatus('complete')
      setWinner(initGame.result)
      setResultReason(initGame.result_reason)
    }
  }, [loaded])

  function syncBoard(g = chessRef.current) {
    if (!g) return
    setBoard([...g.board()])
    setHist([...g.history({ verbose: true })])
    setInChk(g.inCheck())
    if (g.isCheckmate()) {
      const w = g.turn() === 'w' ? 'black' : 'white'  // loser is whoever is in check
      endGame(w, 'checkmate', g)
    } else if (g.isStalemate() || g.isDraw()) {
      endGame('draw', g.isStalemate() ? 'stalemate' : 'insufficient', g)
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  TIMER
  // ════════════════════════════════════════════════════════════════
  const isMyTurn = useCallback(() => {
    return chessRef.current?.turn() === myColor
  }, [myColor])

  useEffect(() => {
    if (!initGame.use_timer || gStatus !== 'playing') return
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      if (!chessRef.current) return
      if (isMyTurn()) {
        setMyTimeMs(t => {
          if (t === null) return null
          if (t <= 1000) {
            clearInterval(timerRef.current)
            handleTimeout('mine')
            return 0
          }
          return t - 200
        })
      } else {
        setOppTimeMs(t => {
          if (t === null) return null
          if (t <= 1000) {
            clearInterval(timerRef.current)
            handleTimeout('opp')
            return 0
          }
          return t - 200
        })
      }
    }, 200)
    return () => clearInterval(timerRef.current)
  }, [gStatus, initGame.use_timer])

  function handleTimeout(who) {
    if (gStatus !== 'playing') return
    if (who === 'mine') {
      // I ran out of time — I lose
      endGame(myColor === 'w' ? 'black' : 'white', 'timeout', chessRef.current, true)
    } else {
      // Opponent ran out, detected locally — will be confirmed by DB sync
      endGame(myColor, 'timeout', chessRef.current, true)
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  REALTIME HOOK
  // ════════════════════════════════════════════════════════════════
  const { broadcastMove, broadcastEvent } = useOnlineGame({
    gameId: initGame.id,
    userId: user?.id,

    // Opponent played a move
    onOpponentMove: useCallback((payload) => {
      const g = chessRef.current
      if (!g || gStatus !== 'playing') return
      // Guard: only apply if it's their turn
      if (g.turn() === myColor) return
      const r = g.move({ from: payload.from, to: payload.to, promotion: payload.promotion })
      if (!r) return
      setLastMv({ from: r.from, to: r.to })
      if (r.captured) play('capture')
      else if (r.flags.includes('k') || r.flags.includes('q')) play('castle')
      else play('move')
      if (g.inCheck()) play('check')
      // Sync times from payload
      if (payload.whiteTimeMs !== undefined) {
        if (myColor === 'w') setOppTimeMs(payload.whiteTimeMs)
        else setMyTimeMs(payload.whiteTimeMs)  // shouldn't happen but safe
      }
      if (payload.blackTimeMs !== undefined) {
        if (myColor === 'b') setOppTimeMs(payload.blackTimeMs)
        else setMyTimeMs(payload.blackTimeMs)
      }
      syncBoard(g)
    }, [myColor, gStatus]),

    // Resign / draw offer / DB sync
    onGameEvent: useCallback((payload) => {
      if (payload.type === 'resign') {
        endGame(myColor, 'resign', chessRef.current, false)
      } else if (payload.type === 'draw_offer') {
        setDrawOfferedByOpp(true)
      } else if (payload.type === 'draw_accept') {
        endGame('draw', 'draw_agreement', chessRef.current, true)
      } else if (payload.type === 'draw_decline') {
        setDrawOfferedByMe(false)
      } else if (payload.type === 'abort') {
        setGStatus('complete'); setWinner('aborted'); setResultReason('abandoned')
      } else if (payload.type === 'db_sync') {
        // Reconnect: apply any moves we missed
        handleDbSync(payload.game)
      }
    }, [myColor]),

    // Presence
    onPresenceChange: useCallback((online) => {
      const oppId = myColor === 'w' ? initGame.black_id : initGame.white_id
      setOppOnline(oppId ? online.has(oppId) : false)
    }, [myColor, initGame.black_id, initGame.white_id]),
  })

  // ── DB sync: catch up if we missed broadcasts ─────────────────
  function handleDbSync(dbGame) {
    if (!dbGame || !chessRef.current) return
    const dbMoves   = dbGame.move_history ?? []
    const localMoves = chessRef.current.history()
    if (dbMoves.length <= localMoves.length) return  // already up to date
    // Replay missing moves
    const g = chessRef.current
    for (let i = localMoves.length; i < dbMoves.length; i++) {
      try { g.move(dbMoves[i]) } catch {}
    }
    setLastMv({ from: dbGame.last_move_from, to: dbGame.last_move_to })
    if (initGame.use_timer) {
      setMyTimeMs(myColor === 'w' ? dbGame.white_time_ms : dbGame.black_time_ms)
      setOppTimeMs(myColor === 'w' ? dbGame.black_time_ms : dbGame.white_time_ms)
    }
    syncBoard(g)
    // If complete in DB
    if (dbGame.status === 'complete') {
      setGStatus('complete'); setWinner(dbGame.result); setResultReason(dbGame.result_reason)
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  CLICK HANDLER — only active on our turn
  // ════════════════════════════════════════════════════════════════
  function handleSqClick(sq) {
    const g = chessRef.current
    if (!g || gStatus !== 'playing') return
    if (g.turn() !== myColor) return  // not our turn

    if (sel && legal.includes(sq)) {
      const piece = g.get(sel)
      const isPromo = piece?.type === 'p' && ((myColor === 'w' && sq[1] === '8') || (myColor === 'b' && sq[1] === '1'))
      if (isPromo) { setPromoFrom(sel); setPromoTo(sq); return }
      applyMyMove(sel, sq, 'q')
      return
    }
    const piece = g.get(sq)
    if (piece && piece.color === myColor) {
      setSel(sq)
      setLegal(g.moves({ square: sq, verbose: true }).map(m => m.to))
    } else {
      setSel(null); setLegal([])
    }
  }

  function handlePromotion(pt) {
    if (!promoFrom || !promoTo) return
    applyMyMove(promoFrom, promoTo, pt)
    setPromoFrom(null); setPromoTo(null)
  }

  async function applyMyMove(from, to, promotion) {
    const g = chessRef.current
    const r = g.move({ from, to, promotion })
    if (!r) return

    setLastMv({ from: r.from, to: r.to })
    setSel(null); setLegal([])
    if (r.captured) play('capture')
    else if (r.flags.includes('k') || r.flags.includes('q')) play('castle')
    else play('move')
    if (g.inCheck()) play('check')
    syncBoard(g)

    // Capture current times before state updates
    const wTime = myColor === 'w' ? myTimeMs : oppTimeMs
    const bTime = myColor === 'b' ? myTimeMs : oppTimeMs

    // 1. Broadcast instantly for low latency
    await broadcastMove({
      from: r.from, to: r.to, promotion: r.promotion ?? undefined,
      san: r.san,
      fen: g.fen(),
      movesCount: g.history().length,
      whiteTimeMs: wTime,
      blackTimeMs:  bTime,
    })

    // 2. Write to DB as source of truth
    const isOver  = g.isCheckmate() || g.isStalemate() || g.isDraw()
    let   dbResult      = undefined
    let   dbResultReason = undefined
    if (g.isCheckmate()) { dbResult = myColor === 'w' ? 'white' : 'black'; dbResultReason = 'checkmate' }
    else if (g.isStalemate())  { dbResult = 'draw'; dbResultReason = 'stalemate' }
    else if (g.isDraw())       { dbResult = 'draw'; dbResultReason = 'insufficient' }

    await commitMoveToDb(initGame.id, {
      fen:         g.fen(),
      moveHistory: g.history(),
      lastFrom:    r.from,
      lastTo:      r.to,
      whiteTimeMs: wTime ?? initGame.white_time_ms,
      blackTimeMs: bTime ?? initGame.black_time_ms,
      status:      isOver ? 'complete' : 'active',
      result:      dbResult,
      resultReason: dbResultReason,
    })
  }

  // ════════════════════════════════════════════════════════════════
  //  GAME-OVER helper
  // ════════════════════════════════════════════════════════════════
  async function endGame(result, reason, g, writeToDb = false) {
    if (gStatus === 'complete') return  // idempotent
    clearInterval(timerRef.current)
    setGStatus('complete')
    setWinner(result)
    setResultReason(reason)
    const iWon = result === myColor || result === (myColor === 'w' ? 'white' : 'black') || (myColor === 'w' && result === 'white') || (myColor === 'b' && result === 'black')
    if (result === 'draw') play('over')
    else if (iWon) play('win')
    else play('over')

    if (writeToDb) {
      await finalizeGame(initGame.id, {
        result,
        resultReason: reason,
        whiteTimeMs: myColor === 'w' ? myTimeMs : oppTimeMs,
        blackTimeMs: myColor === 'b' ? myTimeMs : oppTimeMs,
      })
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  ACTIONS
  // ════════════════════════════════════════════════════════════════
  async function handleResign() {
    if (gStatus !== 'playing') return
    await broadcastEvent({ type: 'resign' })
    await finalizeGame(initGame.id, {
      result:       myColor === 'w' ? 'black' : 'white',
      resultReason: 'resign',
      whiteTimeMs:  myColor === 'w' ? myTimeMs : oppTimeMs,
      blackTimeMs:  myColor === 'b' ? myTimeMs : oppTimeMs,
    })
    endGame(myColor === 'w' ? 'black' : 'white', 'resign', chessRef.current, false)
  }

  async function offerDraw() {
    if (gStatus !== 'playing' || drawOfferedByMe) return
    setDrawOfferedByMe(true)
    await broadcastEvent({ type: 'draw_offer' })
  }

  async function acceptDraw() {
    setDrawOfferedByOpp(false)
    await broadcastEvent({ type: 'draw_accept' })
    endGame('draw', 'draw_agreement', chessRef.current, true)
  }

  async function declineDraw() {
    setDrawOfferedByOpp(false)
    await broadcastEvent({ type: 'draw_decline' })
  }

  // ════════════════════════════════════════════════════════════════
  //  UI HELPERS
  // ════════════════════════════════════════════════════════════════
  function fmtMs(ms) {
    if (ms === null || ms === undefined || ms >= 999999999) return '∞'
    const total = Math.max(0, Math.floor(ms / 1000))
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function resultLabel() {
    if (winner === 'draw' || winner === 'aborted') return winner === 'draw' ? '🤝 Draw' : '❌ Aborted'
    const iWon = (winner === 'white' && myColor === 'w') || (winner === 'black' && myColor === 'b')
    return iWon ? '🏆 You Won!' : '💀 You Lost'
  }

  function reasonLabel() {
    const map = {
      checkmate: 'by checkmate',
      stalemate: '— stalemate',
      resign:    'by resignation',
      timeout:   'on time',
      draw_agreement: '— agreed draw',
      insufficient:   '— insufficient material',
      repetition:     '— threefold repetition',
      abandoned:      '— game abandoned',
    }
    return map[resultReason] ?? ''
  }

  const chkSq = inChk && chessRef.current
    ? (() => {
        let k = null
        chessRef.current.board().forEach((row, r) =>
          row.forEach((p, c) => { if (p?.type === 'k' && p.color === chessRef.current.turn()) k = `${String.fromCharCode(97+c)}${8-r}` })
        )
        return k
      })()
    : null

  const myTurnNow  = chessRef.current?.turn() === myColor
  const movePairs  = []
  for (let i = 0; i < hist.length; i += 2)
    movePairs.push({ n: Math.floor(i/2)+1, w: hist[i]?.san, b: hist[i+1]?.san })

  // Scroll move list
  useEffect(() => {
    moveListRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth' })
  }, [hist])

  if (!loaded || board.length === 0) {
    return (
      <div style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
        <span style={{ fontSize: 48, opacity: .6 }}>♟</span>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '0.5rem 0 1rem', fontFamily: 'var(--font-sans)' }}>
      <style>{`@keyframes drawPop{0%{transform:scale(.8);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}`}</style>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ fontSize: 12, padding: '5px 10px', background: 'none', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
          ← Lobby
        </button>
        <span style={{ fontSize: 12, padding: '3px 8px', background: 'rgba(74,67,160,.1)', color: '#4A43A0', borderRadius: 20, fontWeight: 600 }}>
          🌐 Online
        </span>
        <div style={{ flex: 1 }}/>
        {/* Invite code for sharing */}
        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'monospace' }}>
          #{initGame.invite_code}
        </span>
        {gStatus === 'playing' && myTurnNow && (
          <span style={{ fontSize: 12, color: '#5CB88A', fontWeight: 600 }}>● Your turn</span>
        )}
        {gStatus === 'playing' && !myTurnNow && (
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
            {oppOnline ? 'Opponent thinking…' : '⚠ Opponent offline'}
          </span>
        )}
        {inChk && gStatus === 'playing' && (
          <span style={{ fontSize: 12, color: '#E85555', fontWeight: 700 }}>⚠ Check!</span>
        )}
      </div>

      {/* ── Game over banner ── */}
      {gStatus === 'complete' && (
        <div style={{
          marginBottom: 14, padding: '12px 16px', borderRadius: 'var(--border-radius-md)',
          background: winner === 'draw' || winner === 'aborted' ? 'var(--color-background-secondary)'
            : (winner === 'white' && myColor === 'w') || (winner === 'black' && myColor === 'b')
              ? 'rgba(92,184,138,.12)' : 'rgba(232,85,85,.10)',
          border: `0.5px solid ${
            winner === 'draw' || winner === 'aborted' ? 'var(--color-border-tertiary)'
            : (winner === 'white' && myColor === 'w') || (winner === 'black' && myColor === 'b')
              ? '#5CB88A' : '#E85555'
          }`,
          display: 'flex', alignItems: 'center', gap: 12, animation: 'drawPop .3s ease',
        }}>
          <span style={{ fontSize: 26 }}>
            {winner === 'draw' ? '🤝' : winner === 'aborted' ? '❌' :
              ((winner === 'white' && myColor === 'w') || (winner === 'black' && myColor === 'b')) ? '🏆' : '💀'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>{resultLabel()}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {reasonLabel()} · {hist.length} moves
            </div>
          </div>
          <button onClick={onBack} style={{ padding: '7px 16px', background: '#4A43A0', color: '#fff', border: 'none', borderRadius: 'var(--border-radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            Back to Lobby
          </button>
        </div>
      )}

      {/* ── Draw offer notification ── */}
      {drawOfferedByOpp && gStatus === 'playing' && (
        <div style={{
          marginBottom: 12, padding: '10px 16px', borderRadius: 'var(--border-radius-md)',
          background: 'rgba(245,200,66,.08)', border: '0.5px solid #F5C842',
          display: 'flex', alignItems: 'center', gap: 10, animation: 'drawPop .25s ease',
        }}>
          <span style={{ fontSize: 18 }}>🤝</span>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>
            {oppName} offers a draw
          </span>
          <button onClick={acceptDraw} style={{ padding: '6px 14px', background: '#5CB88A', color: '#fff', border: 'none', borderRadius: 'var(--border-radius-md)', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginRight: 6 }}>
            Accept
          </button>
          <button onClick={declineDraw} style={{ padding: '6px 14px', background: 'none', border: '0.5px solid #E85555', color: '#E85555', borderRadius: 'var(--border-radius-md)', fontSize: 12, cursor: 'pointer' }}>
            Decline
          </button>
        </div>
      )}

      {/* ── Promotion dialog ── */}
      {promoFrom && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-background-primary)', borderRadius: 'var(--border-radius-lg)', padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,.6)', border: '0.5px solid var(--color-border-secondary)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 16, textAlign: 'center' }}>Promote Pawn</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[['q','Queen'],['r','Rook'],['b','Bishop'],['n','Knight']].map(([pt, label]) => (
                <div key={pt} onClick={() => handlePromotion(pt)}
                  style={{ width: 68, height: 68, border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 4, transition: 'background .15s,transform .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-background-secondary)'; e.currentTarget.style.transform = 'scale(1.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.transform = '' }}>
                  <span style={{ fontSize: 34, color: myColor === 'w' ? '#fff' : '#111', textShadow: myColor === 'w' ? '0 0 4px #000,0 1px 5px rgba(0,0,0,.9)' : 'none' }}>{UNI[`${myColor}${pt.toUpperCase()}`]}</span>
                  <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main layout: board + panel ── */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

        {/* ── Board column ── */}
        <div style={{ flexShrink: 0 }}>

          {/* Opponent label + timer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5, minHeight: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>{myColor === 'w' ? '♟' : '♙'}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>{oppName}</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: oppOnline ? '#5CB88A' : '#9E9B92', display: 'inline-block', flexShrink: 0, boxShadow: oppOnline ? '0 0 0 2px rgba(92,184,138,.25)' : 'none', transition: 'background .4s' }}/>
            </div>
            {initGame.use_timer && (
              <div style={{
                fontSize: 15, fontFamily: 'monospace', fontWeight: 700,
                color: !myTurnNow ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                background: !myTurnNow && gStatus === 'playing' ? 'rgba(74,67,160,.12)' : 'transparent',
                padding: '3px 8px', borderRadius: 'var(--border-radius-md)', transition: 'background .3s',
              }}>
                {fmtMs(oppTimeMs)}
              </div>
            )}
          </div>

          {/* Board */}
          <Board
            brd={board}
            onSq={handleSqClick}
            selSq={sel}
            legalSqs={legal}
            lastMove={lastMv}
            chkSq={chkSq}
            flipped={isFlipped}
            theme={theme}
            showCoords={showCoords}
            isMyTurn={myTurnNow && gStatus === 'playing'}
            gameOver={gStatus === 'complete'}
          />

          {/* My label + timer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, minHeight: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>{myColor === 'w' ? '♙' : '♟'}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{myName ?? 'You'}</span>
              {initGame.status === 'waiting' && myColor === 'w' && (
                <span style={{ fontSize: 11, color: '#F5C842', fontStyle: 'italic' }}>Waiting for opponent…</span>
              )}
            </div>
            {initGame.use_timer && (
              <div style={{
                fontSize: 15, fontFamily: 'monospace', fontWeight: 700,
                color: myTurnNow ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                background: myTurnNow && gStatus === 'playing' ? 'rgba(74,67,160,.12)' : 'transparent',
                padding: '3px 8px', borderRadius: 'var(--border-radius-md)', transition: 'background .3s',
              }}>
                {fmtMs(myTimeMs)}
              </div>
            )}
          </div>
        </div>

        {/* ── Panel ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: SQ*8+60 }}>

          {/* Tab strip */}
          <div style={{ display: 'flex', borderBottom: '0.5px solid var(--color-border-tertiary)', marginBottom: 10 }}>
            {[['moves', 'Moves'], ['info', '📶 Status']].map(([id, label]) => (
              <button key={id} onClick={() => setPanelTab(id)}
                style={{ flex: 1, padding: '8px 0', fontSize: 13, background: 'none', border: 'none', borderBottom: panelTab === id ? '2px solid #4A43A0' : '2px solid transparent', color: panelTab === id ? '#4A43A0' : 'var(--color-text-secondary)', cursor: 'pointer', fontWeight: panelTab === id ? 600 : 400, fontFamily: 'var(--font-sans)' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Move list */}
          {panelTab === 'moves' && (
            <div ref={moveListRef} style={{ flex: 1, overflowY: 'auto', maxHeight: 290 }}>
              {movePairs.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: 0 }}>
                  {myTurnNow ? 'Your turn — make the first move!' : 'Waiting for White to move…'}
                </p>
              )}
              {movePairs.map((p) => (
                <div key={p.n} className="move-row" style={{ display: 'flex', alignItems: 'center', borderBottom: '0.5px solid var(--color-border-tertiary)', padding: '3px 0', borderRadius: 3 }}>
                  <span style={{ width: 28, fontSize: 11, color: 'var(--color-text-tertiary)', flexShrink: 0, fontFamily: 'monospace' }}>{p.n}.</span>
                  <span style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text-primary)', padding: '2px 4px' }}>{p.w}</span>
                  <span style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', color: 'var(--color-text-secondary)', padding: '2px 4px' }}>{p.b ?? ''}</span>
                </div>
              ))}
            </div>
          )}

          {/* Status / connection info */}
          {panelTab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <InfoRow label="Opponent" value={oppName} />
              <InfoRow label="You" value={`${myName} (${myColor === 'w' ? 'White ♙' : 'Black ♟'})`} />
              <InfoRow label="Connection" value={oppOnline ? '🟢 Opponent online' : '🔴 Opponent offline'} />
              <InfoRow label="Time control" value={initGame.use_timer ? `${Math.floor(initGame.time_control_ms / 60000)} min` : 'Unlimited'} />
              <InfoRow label="Game ID" value={<span style={{ fontFamily: 'monospace', fontSize: 11 }}>{initGame.invite_code}</span>} />
              <InfoRow label="Moves played" value={hist.length} />
            </div>
          )}

          {/* Action buttons */}
          {gStatus === 'playing' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 12 }}>
              <button onClick={offerDraw} disabled={drawOfferedByMe}
                style={{ padding: '8px 0', fontSize: 12, background: 'none', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', cursor: drawOfferedByMe ? 'default' : 'pointer', color: drawOfferedByMe ? '#F5C842' : 'var(--color-text-secondary)', opacity: drawOfferedByMe ? 0.7 : 1, fontFamily: 'var(--font-sans)' }}>
                {drawOfferedByMe ? '🤝 Offered…' : '🤝 Offer Draw'}
              </button>
              <button onClick={handleResign} disabled={hist.length < 1}
                style={{ padding: '8px 0', fontSize: 12, background: 'none', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', cursor: 'pointer', color: 'var(--color-text-secondary)', opacity: hist.length < 1 ? 0.35 : 1, fontFamily: 'var(--font-sans)' }}>
                🏳 Resign
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
