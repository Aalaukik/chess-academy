import { useState, useEffect, useRef, useCallback } from 'react'
import { useOnlineGame, commitMoveToDb, finalizeGame } from './useOnlineGame'
import { supabase } from './supabase'

const UNI = { wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟' }
const SQ  = 46

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

const C = {
  bg2: '#161410', bg3: '#1F1C15', bg4: '#2A271E',
  text1: '#EDE7D4', text2: '#8C8476', text3: '#504C45',
  gold: '#C8A84B', green: '#4CAF82', red: '#E05555', amber: '#E08C30',
}

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

function Board({ brd, onSq, selSq, legalSqs=[], lastMove=null, chkSq=null, flipped=false, theme='walnut', showCoords=true, isMyTurn=false, gameOver=false, onPieceDragStart=null }) {
  const t = THEMES[theme] ?? THEMES.walnut
  const fl = flipped
  const rows = fl ? [...brd].reverse() : brd
  return (
    <div data-chess-board="1"
      style={{
        display:'inline-flex', flexDirection:'column', borderRadius:6, overflow:'hidden',
        boxShadow:'0 24px 72px rgba(0,0,0,.7), 0 4px 12px rgba(0,0,0,.5)',
        border:`2px solid ${t.bdr}`,
        outline: !gameOver ? (isMyTurn ? '2px solid rgba(200,168,75,0.65)' : '2px solid rgba(200,168,75,0.12)') : '2px solid transparent',
        outlineOffset:'3px', transition:'outline-color .4s ease',
        userSelect:'none', WebkitUserSelect:'none',
      }}>
      {rows.map((rowData, ri) => {
        const bRow = fl ? 7-ri : ri
        const rank = 8-bRow
        const dispRow = fl ? [...rowData].reverse() : rowData
        return (
          <div key={ri} style={{ display:'flex' }}>
            {showCoords && (
              <div style={{ width:18, height:SQ, display:'flex', alignItems:'center', justifyContent:'center', background:'#0A0908', fontSize:9, color:'#555', fontFamily:'monospace', fontWeight:700, flexShrink:0 }}>
                {rank}
              </div>
            )}
            {dispRow.map((piece, ci) => {
              const bCol = fl ? 7-ci : ci
              const sq = `${String.fromCharCode(97+bCol)}${rank}`
              const isLight = (bRow+bCol)%2 !== 0
              const isSel = selSq===sq, isLeg=legalSqs.includes(sq)
              const isLF = lastMove?.from===sq, isLT = lastMove?.to===sq
              const isChk = chkSq===sq
              const pk = piece ? `${piece.color}${piece.type.toUpperCase()}` : null
              const isW = piece?.color==='w'
              let bg = isLight ? t.l : t.d
              if (isSel) bg = t.sel
              else if (isLF||isLT) bg = t.last
              if (isChk) bg = 'rgba(220,60,40,.72)'
              return (
                <div key={ci} onClick={() => onSq(sq)} className="board-sq"
                  style={{
                    width:SQ, height:SQ, background:bg,
                    cursor: onPieceDragStart && piece ? 'grab' : 'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    position:'relative', transition:'background .08s',
                    outline: isSel ? '2.5px solid rgba(255,255,0,.95)' : 'none',
                    outlineOffset:'-2.5px', boxSizing:'border-box',
                    animation: isLT ? 'sqFlash .45s ease-out' : 'none',
                  }}>
                  {isLeg && !piece && <div style={{ width:Math.round(SQ*.34), height:Math.round(SQ*.34), borderRadius:'50%', background:t.hint, pointerEvents:'none' }}/>}
                  {isLeg && piece && <div style={{ position:'absolute', inset:0, boxShadow:`inset 0 0 0 4px ${t.hint}`, pointerEvents:'none', borderRadius:2 }}/>}
                  {piece && (
                    <span className="chess-piece"
                      onMouseDown={onPieceDragStart ? e=>{e.stopPropagation();onPieceDragStart(e,sq)} : undefined}
                      onTouchStart={onPieceDragStart ? e=>{e.stopPropagation();onPieceDragStart(e,sq)} : undefined}
                      style={{
                        fontSize:Math.round(SQ*.82), lineHeight:1, userSelect:'none',
                        color: isW ? '#fff' : '#0A0808',
                        textShadow: isW ? '0 0 6px #000,0 2px 8px rgba(0,0,0,.95)' : '0 0 3px rgba(255,255,255,.25)',
                        position:'relative', zIndex:1, WebkitUserSelect:'none', touchAction:'none',
                        cursor: onPieceDragStart ? 'grab' : 'default',
                        opacity: onPieceDragStart?.__draggingFrom===sq ? 0 : 1,
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
        <div style={{ display:'flex', background:'#0A0908' }}>
          <div style={{ width:18 }}/>
          {Array.from({ length:8 }, (_,i) => (
            <div key={i} style={{ width:SQ, textAlign:'center', fontSize:9, color:'#555', padding:'3px 0', fontFamily:'monospace', fontWeight:700 }}>
              {String.fromCharCode(97+(fl?7-i:i))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OnlinePlayScreen({ gameData, user, onBack, ChessLib, loaded, theme='walnut', showCoords=true, soundOn=true, onStatsChange, onEloChange }) {
  const { game: initGame, myColor } = gameData
  const myName  = myColor === 'w' ? initGame.white_name : initGame.black_name
  const oppName = myColor === 'w' ? (initGame.black_name ?? 'Waiting…') : initGame.white_name
  const isFlipped = myColor === 'b'

  const chessRef  = useRef(null)
  const [board,   setBoard]   = useState([])
  const [hist,    setHist]    = useState([])
  const [sel,     setSel]     = useState(null)
  const [legal,   setLegal]   = useState([])
  const [lastMv,  setLastMv]  = useState(null)
  const [inChk,   setInChk]   = useState(false)
  const [gStatus, setGStatus] = useState('playing')
  const [winner,  setWinner]  = useState(null)
  const [resultReason, setResultReason] = useState('')
  const moveListRef   = useRef(null)
  const gameStartTime = useRef(Date.now())
  const savedRef      = useRef(false)
  const endGameCalledRef = useRef(false)

  const [promoFrom, setPromoFrom] = useState(null)
  const [promoTo,   setPromoTo]   = useState(null)
  const [myTimeMs,  setMyTimeMs]  = useState(initGame.use_timer ? (myColor === 'w' ? initGame.white_time_ms : initGame.black_time_ms) : null)
  const [oppTimeMs, setOppTimeMs] = useState(initGame.use_timer ? (myColor === 'w' ? initGame.black_time_ms : initGame.white_time_ms) : null)
  const timerRef = useRef(null)
  const [drawOfferedByMe,  setDrawOfferedByMe]  = useState(false)
  const [drawOfferedByOpp, setDrawOfferedByOpp] = useState(false)
  const [oppOnline, setOppOnline] = useState(false)
  const [panelTab, setPanelTab] = useState('moves')

  function play(k) { if (soundOn) SND[k]?.() }

  const ONLINE_OPP_ELO = 1200
  function calcElo(playerElo, opponentElo, result) {
    const K = 32
    const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400))
    return Math.round(playerElo + K * (result - expected))
  }

  async function saveSessionToDb(result, reason, chess) {
    if (!user || savedRef.current) return
    savedRef.current = true
    const durationS = Math.round((Date.now() - gameStartTime.current) / 1000)
    const moves = chess?.history() ?? []
    const iWon = (result === 'white' && myColor === 'w') || (result === 'black' && myColor === 'b')
    const sessionResult = result === 'draw' || result === 'aborted' ? 'draw'
      : reason === 'resign' ? (iWon ? 'win' : 'resign')
      : reason === 'timeout' ? (iWon ? 'win' : 'timeout')
      : iWon ? 'win' : 'loss'
    await supabase.from('game_sessions').insert({
      user_id: user.id, result: sessionResult, player_color: myColor,
      difficulty: null, moves, opening: detectOpeningFromMoves(moves),
      total_moves: moves.length, duration_s: durationS,
    })
    const statsDelta = sessionResult === 'win' ? { wins: 1 }
      : sessionResult === 'loss' || sessionResult === 'resign' || sessionResult === 'timeout' ? { losses: 1 }
      : { draws: 1 }
    onStatsChange?.(statsDelta)
    const numResult = sessionResult === 'win' ? 1 : sessionResult === 'draw' ? 0.5 : 0
    onEloChange?.(numResult, ONLINE_OPP_ELO)
  }

  const OPENINGS = { 'e4 e5':'Open Game','e4 e5 Nf3 Nc6 Bc4':'Italian Game','e4 e5 Nf3 Nc6 Bb5':'Ruy López','e4 e6':'French Defense','e4 c5':'Sicilian Defense','d4 d5':"Queen's Gambit",'d4 Nf6':'Indian Defense','Nf3':'Réti Opening','c4':'English Opening' }
  function detectOpeningFromMoves(sanArr) {
    const mv = sanArr.slice(0,8).join(' '); let match = ''
    for (const [k,n] of Object.entries(OPENINGS)) if (mv.startsWith(k) && k.length > match.length) match = k
    return match ? OPENINGS[match] : (sanArr.length > 0 ? 'Online Game' : '')
  }

  useEffect(() => {
    if (!loaded || !ChessLib.current) return
    const g = new ChessLib.current()
    const moves = initGame.move_history ?? []
    for (const san of moves) { try { g.move(san) } catch {} }
    chessRef.current = g
    syncBoard(g)
    if (initGame.status === 'complete') { setGStatus('complete'); setWinner(initGame.result); setResultReason(initGame.result_reason) }
  }, [loaded])

  function syncBoard(g = chessRef.current) {
    if (!g) return
    setBoard([...g.board()]); setHist([...g.history({ verbose: true })]); setInChk(g.inCheck())
    if (g.isCheckmate()) { const w = g.turn()==='w' ? 'black' : 'white'; endGame(w,'checkmate',g) }
    else if (g.isStalemate() || g.isDraw()) { endGame('draw', g.isStalemate() ? 'stalemate' : 'insufficient', g) }
  }

  const isMyTurn = useCallback(() => chessRef.current?.turn() === myColor, [myColor])

  useEffect(() => {
    if (!initGame.use_timer || gStatus !== 'playing') return
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      if (!chessRef.current) return
      if (isMyTurn()) {
        setMyTimeMs(t => { if (t === null) return null; if (t <= 1000) { clearInterval(timerRef.current); handleTimeout('mine'); return 0 } return t - 200 })
      } else {
        setOppTimeMs(t => { if (t === null) return null; if (t <= 1000) { clearInterval(timerRef.current); handleTimeout('opp'); return 0 } return t - 200 })
      }
    }, 200)
    return () => clearInterval(timerRef.current)
  }, [gStatus, initGame.use_timer])

  function handleTimeout(who) {
    if (gStatus !== 'playing') return
    if (who === 'mine') endGame(myColor === 'w' ? 'black' : 'white', 'timeout', chessRef.current, true)
    else endGame(myColor, 'timeout', chessRef.current, true)
  }

  const { broadcastMove, broadcastEvent } = useOnlineGame({
    gameId: initGame.id, userId: user?.id,
    onOpponentMove: useCallback((payload) => {
      const g = chessRef.current
      if (!g || gStatus !== 'playing') return
      if (g.turn() === myColor) return
      const r = g.move({ from: payload.from, to: payload.to, promotion: payload.promotion })
      if (!r) return
      setLastMv({ from: r.from, to: r.to })
      if (r.captured) play('capture'); else if (r.flags.includes('k')||r.flags.includes('q')) play('castle'); else play('move')
      if (g.inCheck()) play('check')
      if (payload.whiteTimeMs !== undefined) { if (myColor==='w') setOppTimeMs(payload.whiteTimeMs); else setMyTimeMs(payload.whiteTimeMs) }
      if (payload.blackTimeMs !== undefined) { if (myColor==='b') setOppTimeMs(payload.blackTimeMs); else setMyTimeMs(payload.blackTimeMs) }
      syncBoard(g)
    }, [myColor, gStatus]),
    onGameEvent: useCallback((payload) => {
      if (payload.type === 'resign') endGame(myColor, 'resign', chessRef.current, false)
      else if (payload.type === 'draw_offer') setDrawOfferedByOpp(true)
      else if (payload.type === 'draw_accept') endGame('draw', 'draw_agreement', chessRef.current, true)
      else if (payload.type === 'draw_decline') setDrawOfferedByMe(false)
      else if (payload.type === 'abort') { setGStatus('complete'); setWinner('aborted'); setResultReason('abandoned') }
      else if (payload.type === 'db_sync') handleDbSync(payload.game)
    }, [myColor]),
    onPresenceChange: useCallback((online) => {
      const oppId = myColor === 'w' ? initGame.black_id : initGame.white_id
      setOppOnline(oppId ? online.has(oppId) : false)
    }, [myColor, initGame.black_id, initGame.white_id]),
  })

  function handleDbSync(dbGame) {
    if (!dbGame || !chessRef.current) return
    const dbMoves = dbGame.move_history ?? []
    const localMoves = chessRef.current.history()
    if (dbMoves.length <= localMoves.length) return
    const g = chessRef.current
    for (let i = localMoves.length; i < dbMoves.length; i++) { try { g.move(dbMoves[i]) } catch {} }
    setLastMv({ from: dbGame.last_move_from, to: dbGame.last_move_to })
    if (initGame.use_timer) {
      setMyTimeMs(myColor === 'w' ? dbGame.white_time_ms : dbGame.black_time_ms)
      setOppTimeMs(myColor === 'w' ? dbGame.black_time_ms : dbGame.white_time_ms)
    }
    syncBoard(g)
    if (dbGame.status === 'complete') { setGStatus('complete'); setWinner(dbGame.result); setResultReason(dbGame.result_reason) }
  }

  // ── Drag & Drop ──
  const dragRef = useRef(null); const dragJustMoved = useRef(false)
  const dragHandlersRef = useRef({}); const [ghostState, setGhostState] = useState(null)

  function getSqFromPos(clientX, clientY, rect, fl) {
    const coordOff = 18, borderOff = 2
    const relX = clientX - rect.left - borderOff - coordOff
    const relY = clientY - rect.top  - borderOff
    const ci = Math.floor(relX / SQ), ri = Math.floor(relY / SQ)
    if (ci<0||ci>7||ri<0||ri>7) return null
    const bCol = fl?7-ci:ci, bRow = fl?7-ri:ri
    return `${String.fromCharCode(97+bCol)}${8-bRow}`
  }

  function startDrag(e, sq) {
    const g = chessRef.current
    if (!g || gStatus !== 'playing') return
    if (g.turn() !== myColor) return
    const piece = g.get(sq)
    if (!piece || piece.color !== myColor) return
    if (e.touches) e.preventDefault()
    const clientX = e.touches?e.touches[0].clientX:e.clientX
    const clientY = e.touches?e.touches[0].clientY:e.clientY
    setSel(sq); setLegal(g.moves({ square: sq, verbose: true }).map(m => m.to))
    dragRef.current = {
      from: sq, startX: clientX, startY: clientY, moved: false, isFlipped,
      dropHandler: (from, to) => {
        const g2 = chessRef.current
        if (!g2 || gStatus !== 'playing') { setSel(null); setLegal([]); return }
        if (g2.turn() !== myColor) { setSel(null); setLegal([]); return }
        const lm = g2.moves({ square: from, verbose: true }).map(m => m.to)
        if (!lm.includes(to)) { setSel(null); setLegal([]); return }
        const p = g2.get(from)
        const isPromo = p?.type==='p' && ((myColor==='w'&&to[1]==='8')||(myColor==='b'&&to[1]==='1'))
        if (isPromo) { setPromoFrom(from); setPromoTo(to); setSel(null); setLegal([]); return }
        applyMyMove(from, to, 'q')
      },
    }
    const pk = `${piece.color}${piece.type.toUpperCase()}`
    setGhostState({ x: clientX, y: clientY, pk, isW: piece.color === 'w' })
  }

  function onDragMove(e) {
    if (!dragRef.current) return
    if (e.cancelable) e.preventDefault()
    const clientX = e.touches?e.touches[0].clientX:e.clientX
    const clientY = e.touches?e.touches[0].clientY:e.clientY
    if (!dragRef.current.moved) { const dx=clientX-dragRef.current.startX,dy=clientY-dragRef.current.startY; if(Math.abs(dx)>5||Math.abs(dy)>5) dragRef.current.moved=true }
    setGhostState(s => s ? {...s,x:clientX,y:clientY} : null)
  }

  function onDragEnd(e) {
    if (!dragRef.current) return
    const {from,moved,dropHandler,isFlipped:fl} = dragRef.current
    dragRef.current = null; setGhostState(null)
    if (!moved) return
    dragJustMoved.current = true; setTimeout(() => { dragJustMoved.current = false }, 150)
    const clientX = e.changedTouches?e.changedTouches[0].clientX:e.clientX
    const clientY = e.changedTouches?e.changedTouches[0].clientY:e.clientY
    const boardEl = document.querySelector('[data-chess-board="1"]')
    if (!boardEl) { setSel(null); setLegal([]); return }
    const to = getSqFromPos(clientX, clientY, boardEl.getBoundingClientRect(), fl)
    if (!to || to === from) { setSel(null); setLegal([]); return }
    dropHandler?.(from, to)
  }

  dragHandlersRef.current = { onDragMove, onDragEnd }

  useEffect(() => {
    const mm = e => dragHandlersRef.current.onDragMove(e)
    const mu = e => dragHandlersRef.current.onDragEnd(e)
    window.addEventListener('mousemove',mm); window.addEventListener('mouseup',mu)
    window.addEventListener('touchmove',mm,{passive:false}); window.addEventListener('touchend',mu)
    return () => { window.removeEventListener('mousemove',mm); window.removeEventListener('mouseup',mu); window.removeEventListener('touchmove',mm); window.removeEventListener('touchend',mu) }
  }, [])

  function handleSqClick(sq) {
    if (dragJustMoved.current) { dragJustMoved.current = false; return }
    const g = chessRef.current
    if (!g || gStatus !== 'playing') return
    if (g.turn() !== myColor) return
    if (sel && legal.includes(sq)) {
      const piece = g.get(sel)
      const isPromo = piece?.type==='p'&&((myColor==='w'&&sq[1]==='8')||(myColor==='b'&&sq[1]==='1'))
      if (isPromo) { setPromoFrom(sel); setPromoTo(sq); return }
      applyMyMove(sel, sq, 'q'); return
    }
    const piece = g.get(sq)
    if (piece && piece.color === myColor) { setSel(sq); setLegal(g.moves({ square: sq, verbose: true }).map(m => m.to)) }
    else { setSel(null); setLegal([]) }
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
    setLastMv({ from: r.from, to: r.to }); setSel(null); setLegal([])
    if (r.captured) play('capture'); else if (r.flags.includes('k')||r.flags.includes('q')) play('castle'); else play('move')
    if (g.inCheck()) play('check')
    syncBoard(g)
    const wTime = myColor==='w' ? myTimeMs : oppTimeMs
    const bTime = myColor==='b' ? myTimeMs : oppTimeMs
    await broadcastMove({ from:r.from, to:r.to, promotion:r.promotion??undefined, san:r.san, fen:g.fen(), movesCount:g.history().length, whiteTimeMs:wTime, blackTimeMs:bTime })
    const isOver = g.isCheckmate() || g.isStalemate() || g.isDraw()
    let dbResult, dbResultReason
    if (g.isCheckmate()) { dbResult = myColor==='w'?'white':'black'; dbResultReason = 'checkmate' }
    else if (g.isStalemate()) { dbResult='draw'; dbResultReason='stalemate' }
    else if (g.isDraw()) { dbResult='draw'; dbResultReason='insufficient' }
    await commitMoveToDb(initGame.id, { fen:g.fen(), moveHistory:g.history(), lastFrom:r.from, lastTo:r.to, whiteTimeMs:wTime??initGame.white_time_ms, blackTimeMs:bTime??initGame.black_time_ms, status:isOver?'complete':'active', result:dbResult, resultReason:dbResultReason })
  }

  async function endGame(result, reason, g, writeToDb = false) {
    if (endGameCalledRef.current) return
    endGameCalledRef.current = true
    clearInterval(timerRef.current)
    setGStatus('complete'); setWinner(result); setResultReason(reason)
    const iWon = (result==='white'&&myColor==='w') || (result==='black'&&myColor==='b')
    if (result === 'draw') play('over'); else if (iWon) play('win'); else play('over')
    if (writeToDb) await finalizeGame(initGame.id, { result, resultReason:reason, whiteTimeMs:myColor==='w'?myTimeMs:oppTimeMs, blackTimeMs:myColor==='b'?myTimeMs:oppTimeMs })
    await saveSessionToDb(result, reason, g)
  }

  async function handleResign() {
    if (gStatus !== 'playing') return
    await broadcastEvent({ type: 'resign' })
    await finalizeGame(initGame.id, { result:myColor==='w'?'black':'white', resultReason:'resign', whiteTimeMs:myColor==='w'?myTimeMs:oppTimeMs, blackTimeMs:myColor==='b'?myTimeMs:oppTimeMs })
    endGame(myColor==='w'?'black':'white','resign',chessRef.current,false)
  }

  async function offerDraw() {
    if (gStatus !== 'playing' || drawOfferedByMe) return
    setDrawOfferedByMe(true); await broadcastEvent({ type: 'draw_offer' })
  }

  async function acceptDraw() { setDrawOfferedByOpp(false); await broadcastEvent({ type: 'draw_accept' }); endGame('draw','draw_agreement',chessRef.current,true) }
  async function declineDraw() { setDrawOfferedByOpp(false); await broadcastEvent({ type: 'draw_decline' }) }

  function fmtMs(ms) {
    if (ms === null || ms === undefined || ms >= 999999999) return '∞'
    const total = Math.max(0, Math.floor(ms / 1000))
    const m = Math.floor(total / 60)
    return `${m}:${(total % 60).toString().padStart(2,'0')}`
  }

  function resultLabel() {
    if (winner === 'draw' || winner === 'aborted') return winner === 'draw' ? '🤝 Draw' : '❌ Aborted'
    const iWon = (winner==='white'&&myColor==='w') || (winner==='black'&&myColor==='b')
    return iWon ? '🏆 You Won!' : '💀 You Lost'
  }

  function reasonLabel() {
    return ({ checkmate:'by checkmate', stalemate:'— stalemate', resign:'by resignation', timeout:'on time', draw_agreement:'— agreed draw', insufficient:'— insufficient material', abandoned:'— game abandoned' })[resultReason] ?? ''
  }

  const chkSq = inChk && chessRef.current ? (() => {
    let k = null
    chessRef.current.board().forEach((row,r) => row.forEach((p,c) => { if (p?.type==='k'&&p.color===chessRef.current.turn()) k=`${String.fromCharCode(97+c)}${8-r}` }))
    return k
  })() : null

  const myTurnNow = chessRef.current?.turn() === myColor
  const movePairs = []
  for (let i = 0; i < hist.length; i += 2) movePairs.push({ n: Math.floor(i/2)+1, w: hist[i]?.san, b: hist[i+1]?.san })

  useEffect(() => { moveListRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth' }) }, [hist])

  if (!loaded || board.length === 0) {
    return <div style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 48, opacity: .5 }}>♟</span></div>
  }

  return (
    <div style={{ padding: '0.5rem 0 1rem', fontFamily: 'var(--font-sans)' }}>
      <style>{`@keyframes popIn{0%{transform:scale(.85);opacity:0}70%{transform:scale(1.03)}100%{transform:scale(1);opacity:1}}`}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ fontSize: 12, padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 100, cursor: 'pointer', color: C.text2, fontFamily: 'var(--font-sans)' }}>← Lobby</button>
        <span style={{ fontSize: 12, padding: '3px 10px', background: 'rgba(200,168,75,0.1)', color: C.gold, borderRadius: 20, fontWeight: 600 }}>🌐 Online</span>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 11, color: C.text3, fontFamily: 'monospace' }}>#{initGame.invite_code}</span>
        {gStatus === 'playing' && myTurnNow && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>● Your turn</span>}
        {gStatus === 'playing' && !myTurnNow && <span style={{ fontSize: 12, color: C.text3, fontStyle: 'italic' }}>{oppOnline ? 'Opponent thinking…' : '⚠ Opponent offline'}</span>}
        {inChk && gStatus === 'playing' && <span style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>⚠ Check!</span>}
      </div>

      {/* Game over */}
      {gStatus === 'complete' && (() => {
        const iWon = (winner==='white'&&myColor==='w') || (winner==='black'&&myColor==='b')
        const isDraw = winner === 'draw' || winner === 'aborted'
        return (
          <div style={{
            marginBottom: 14, padding: '14px 18px', borderRadius: 14,
            background: isDraw ? C.bg3 : iWon ? 'rgba(76,175,130,0.1)' : 'rgba(224,85,85,0.08)',
            borderTop: `1px solid ${isDraw ? 'rgba(255,255,255,0.08)' : iWon ? 'rgba(76,175,130,0.3)' : 'rgba(224,85,85,0.25)'}`,
            display: 'flex', alignItems: 'center', gap: 14, animation: 'popIn .3s ease',
          }}>
            <span style={{ fontSize: 28 }}>{isDraw ? '🤝' : iWon ? '🏆' : '💀'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text1, fontFamily: 'var(--font-display)' }}>{resultLabel()}</div>
              <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>{reasonLabel()} · {hist.length} moves</div>
            </div>
            <button onClick={onBack} style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #C8A84B, #E2C870)', color: '#1A1510', border: 'none', borderRadius: 100, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Back to Lobby
            </button>
          </div>
        )
      })()}

      {/* Draw offer */}
      {drawOfferedByOpp && gStatus === 'playing' && (
        <div style={{ marginBottom: 12, padding: '12px 16px', borderRadius: 12, background: 'rgba(200,168,75,0.07)', borderTop: '1px solid rgba(200,168,75,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🤝</span>
          <span style={{ flex: 1, fontSize: 13, color: C.text1, fontWeight: 500 }}>{oppName} offers a draw</span>
          <button onClick={acceptDraw} style={{ padding: '6px 14px', background: C.green, color: '#fff', border: 'none', borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 6 }}>Accept</button>
          <button onClick={declineDraw} style={{ padding: '6px 14px', background: 'transparent', border: `1px solid rgba(224,85,85,0.3)`, color: C.red, borderRadius: 100, fontSize: 12, cursor: 'pointer' }}>Decline</button>
        </div>
      )}

      {/* Promotion dialog */}
      {promoFrom && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.80)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: C.bg2, borderRadius: 18, padding: '1.75rem', boxShadow: '0 32px 80px rgba(0,0,0,.7)', borderTop: '1px solid rgba(200,168,75,0.15)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text1, marginBottom: 18, textAlign: 'center', fontFamily: 'var(--font-display)' }}>Promote Pawn</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[['q','Queen'],['r','Rook'],['b','Bishop'],['n','Knight']].map(([pt,label]) => (
                <div key={pt} onClick={() => handlePromotion(pt)}
                  style={{ width: 72, height: 72, borderRadius: 14, background: 'rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 4, transition: 'background .15s,transform .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,168,75,0.12)'; e.currentTarget.style.transform = 'scale(1.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = '' }}>
                  <span style={{ fontSize: 34, color: myColor==='w'?'#fff':'#111', textShadow: myColor==='w'?'0 0 4px #000':undefined }}>{UNI[`${myColor}${pt.toUpperCase()}`]}</span>
                  <span style={{ fontSize: 10, color: C.text2 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Board + panel */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0 }}>
          {/* Opponent row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, minHeight: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>{myColor==='w'?'♟':'♙'}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.text2 }}>{oppName}</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: oppOnline ? C.green : C.text3, display: 'inline-block', flexShrink: 0, boxShadow: oppOnline ? `0 0 0 2px rgba(76,175,130,0.2)` : 'none', transition: 'background .4s' }}/>
            </div>
            {initGame.use_timer && (
              <div style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 700, color: !myTurnNow ? C.text1 : C.text3, background: !myTurnNow && gStatus==='playing' ? 'rgba(200,168,75,0.1)' : 'transparent', padding: '3px 10px', borderRadius: 8, transition: 'background .3s' }}>
                {fmtMs(oppTimeMs)}
              </div>
            )}
          </div>

          <Board brd={board} onSq={handleSqClick} selSq={sel} legalSqs={legal} lastMove={lastMv} chkSq={chkSq} flipped={isFlipped} theme={theme} showCoords={showCoords} isMyTurn={myTurnNow && gStatus==='playing'} gameOver={gStatus==='complete'} onPieceDragStart={gStatus==='playing' ? startDrag : null} />

          {/* My row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, minHeight: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>{myColor==='w'?'♙':'♟'}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>{myName ?? 'You'}</span>
              {initGame.status==='waiting' && myColor==='w' && <span style={{ fontSize: 11, color: C.gold, fontStyle: 'italic' }}>Waiting for opponent…</span>}
            </div>
            {initGame.use_timer && (
              <div style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 700, color: myTurnNow ? C.text1 : C.text3, background: myTurnNow && gStatus==='playing' ? 'rgba(200,168,75,0.1)' : 'transparent', padding: '3px 10px', borderRadius: 8, transition: 'background .3s' }}>
                {fmtMs(myTimeMs)}
              </div>
            )}
          </div>
        </div>

        {/* Panel */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: SQ*8+60 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 12, background: C.bg3, borderRadius: 10, padding: 3 }}>
            {[['moves','Moves'],['info','📶 Status']].map(([id,label]) => (
              <button key={id} onClick={() => setPanelTab(id)}
                style={{ flex: 1, padding: '7px 0', fontSize: 12, background: panelTab===id ? C.bg2 : 'transparent', color: panelTab===id ? C.text1 : C.text2, border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: panelTab===id ? 600 : 400, boxShadow: panelTab===id ? '0 2px 6px rgba(0,0,0,0.3)' : 'none', transition: 'all .15s', fontFamily: 'var(--font-sans)' }}>
                {label}
              </button>
            ))}
          </div>

          {panelTab === 'moves' && (
            <div ref={moveListRef} style={{ flex: 1, overflowY: 'auto', maxHeight: 290 }}>
              {movePairs.length === 0 && <p style={{ fontSize: 13, color: C.text3, fontStyle: 'italic', margin: 0 }}>{myTurnNow ? 'Your turn — make the first move!' : 'Waiting for White…'}</p>}
              {movePairs.map(p => (
                <div key={p.n} className="move-row" style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '4px 0' }}>
                  <span style={{ width: 28, fontSize: 11, color: C.text3, flexShrink: 0, fontFamily: 'monospace' }}>{p.n}.</span>
                  <span style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: C.text1, padding: '2px 4px' }}>{p.w}</span>
                  <span style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', color: C.text2, padding: '2px 4px' }}>{p.b ?? ''}</span>
                </div>
              ))}
            </div>
          )}

          {panelTab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[['Opponent',oppName],['You',`${myName} (${myColor==='w'?'White ♙':'Black ♟'})`],['Connection',oppOnline?'🟢 Opponent online':'🔴 Opponent offline'],['Time control',initGame.use_timer?`${Math.floor(initGame.time_control_ms/60000)} min`:'Unlimited'],['Invite code',initGame.invite_code],['Moves played',hist.length]].map(([k,v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 12, color: C.text2 }}>{k}</span>
                  <span style={{ fontSize: 13, color: C.text1, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {gStatus === 'playing' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <button onClick={offerDraw} disabled={drawOfferedByMe}
                style={{ padding: '9px 0', fontSize: 12, background: drawOfferedByMe ? 'rgba(200,168,75,0.08)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 100, cursor: drawOfferedByMe ? 'default' : 'pointer', color: drawOfferedByMe ? C.gold : C.text2, fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                {drawOfferedByMe ? '🤝 Offered…' : '🤝 Offer Draw'}
              </button>
              <button onClick={handleResign} disabled={hist.length < 1}
                style={{ padding: '9px 0', fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 100, cursor: 'pointer', color: C.text2, opacity: hist.length < 1 ? 0.35 : 1, fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                🏳 Resign
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ghost piece */}
      {ghostState && (
        <div style={{ position: 'fixed', left: ghostState.x, top: ghostState.y, fontSize: Math.round(SQ*1.15), lineHeight: 1, pointerEvents: 'none', zIndex: 9999, opacity: 0.92, color: ghostState.isW ? '#fff' : '#0A0808', textShadow: ghostState.isW ? '0 0 8px #000,0 2px 10px rgba(0,0,0,.95)' : '0 0 3px rgba(255,255,255,.3)', transform: 'translate(-50%,-50%)', userSelect: 'none', filter: 'drop-shadow(0 6px 18px rgba(0,0,0,.6))' }}>
          {UNI[ghostState.pk]}
        </div>
      )}
    </div>
  )
}
