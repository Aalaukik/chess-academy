import { useState, useEffect, useRef } from "react";
import { useSupabaseProgress } from "./useSupabaseProgress";
import ProfileScreen from "./ProfileScreen";
import OnlineScreen from "./OnlineScreen";
import OnlinePlayScreen from "./OnlinePlayScreen";

// ── Chess AI (unchanged logic) ───────────────────────────────────
const PV={p:100,n:320,b:330,r:500,q:900,k:20000};
const PST={
  p:[[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
  n:[[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
  b:[[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
  r:[[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]],
  q:[[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
  k:[[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]],
};
function evalPos(chess){
  if(chess.isCheckmate())return chess.turn()==="w"?-99999:99999;
  if(chess.isDraw())return 0;
  let s=0;
  chess.board().forEach((row,r)=>row.forEach((p,c)=>{if(!p)return;const tr=p.color==="w"?7-r:r;s+=(PV[p.type]+(PST[p.type]?.[tr]?.[c]||0))*(p.color==="w"?1:-1);}));
  return s;
}
function mm(chess,d,a,b,max){
  if(d===0||chess.isGameOver())return evalPos(chess);
  let best=max?-Infinity:Infinity;
  for(const m of chess.moves()){chess.move(m);const v=mm(chess,d-1,a,b,!max);chess.undo();if(max){best=Math.max(best,v);a=Math.max(a,best);}else{best=Math.min(best,v);b=Math.min(b,best);}if(b<=a)break;}
  return best;
}
const DIFFS=[
  {depth:1,rand:0.90,label:"Beginner",    desc:"Mostly random",     color:"#18A558"},
  {depth:1,rand:0.42,label:"Casual",      desc:"Basic awareness",   color:"#3B82F6"},
  {depth:2,rand:0.14,label:"Intermediate",desc:"2–3 moves ahead",   color:"#F59E0B"},
  {depth:3,rand:0.04,label:"Advanced",    desc:"Strong tactics",    color:"#F97316"},
  {depth:4,rand:0,   label:"Master",      desc:"Full strength",     color:"#EF4444"},
];
const DIFF_ELO=[800,1000,1200,1600,2000];
function getAIMove(chess,di){
  const{depth,rand}=DIFFS[di];const moves=chess.moves();if(!moves.length)return null;
  if(Math.random()<rand)return moves[Math.floor(Math.random()*moves.length)];
  const isMax=chess.turn()==="w";let best=null,bv=isMax?-Infinity:Infinity;
  for(const m of moves){chess.move(m);const v=mm(chess,depth-1,-Infinity,Infinity,!isMax);chess.undo();if(isMax?v>bv:v<bv){bv=v;best=m;}}
  return best||moves[0];
}

// ── Sound ────────────────────────────────────────────────────────
function mkSound(){
  let ctx=null;const gc=()=>{if(!ctx)ctx=new(window.AudioContext||window.webkitAudioContext)();return ctx;};
  function tone(freq,dur,type="sine",vol=0.16){try{const c=gc(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);g.gain.setValueAtTime(vol,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);o.start(c.currentTime);o.stop(c.currentTime+dur);}catch{}}
  return{
    move:   ()=>tone(440,0.08,"square",0.10),
    capture:()=>{tone(280,0.14,"sawtooth",0.14);setTimeout(()=>tone(200,0.12,"square",0.08),60);},
    check:  ()=>{tone(600,0.10,"square",0.20);setTimeout(()=>tone(500,0.12,"square",0.14),90);},
    castle: ()=>{tone(380,0.10,"sine",0.12);setTimeout(()=>tone(480,0.10,"sine",0.12),100);},
    over:   ()=>[440,392,349,330].forEach((f,i)=>setTimeout(()=>tone(f,0.22,"sine",0.18),i*160)),
    win:    ()=>[523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.22,"sine",0.18),i*140)),
    pzOk:   ()=>[523,659,784].forEach((f,i)=>setTimeout(()=>tone(f,0.18,"sine",0.16),i*120)),
    pzFail: ()=>tone(200,0.28,"sawtooth",0.22),
  };
}
const SND=mkSound();

// ── Data ─────────────────────────────────────────────────────────
const UNI={wK:"♔",wQ:"♕",wR:"♖",wB:"♗",wN:"♘",wP:"♙",bK:"♚",bQ:"♛",bR:"♜",bB:"♝",bN:"♞",bP:"♟"};
const THEMES={
  walnut:  {l:"#F0D9B5",d:"#B58863",sel:"rgba(246,246,60,.82)",hint:"rgba(20,85,30,.52)",last:"rgba(246,246,60,.40)",bdr:"#8B6B40",name:"Walnut"},
  slate:   {l:"#DEE3E6",d:"#8CA2AD",sel:"rgba(60,180,255,.82)",hint:"rgba(0,100,220,.45)",last:"rgba(60,180,255,.35)",bdr:"#6A8A9A",name:"Slate"},
  jade:    {l:"#FFFFDD",d:"#86A666",sel:"rgba(200,245,60,.85)",hint:"rgba(50,130,20,.50)",last:"rgba(200,245,60,.40)",bdr:"#627A45",name:"Jade"},
  midnight:{l:"#4A4A6A",d:"#1E1A3A",sel:"rgba(155,205,255,.85)",hint:"rgba(100,170,255,.42)",last:"rgba(155,205,255,.32)",bdr:"#2A2460",name:"Midnight"},
  rose:    {l:"#F4DDE0",d:"#C47A85",sel:"rgba(255,230,60,.82)",hint:"rgba(180,50,60,.40)",last:"rgba(255,230,60,.38)",bdr:"#A05065",name:"Rose"},
  ocean:   {l:"#D6EEF8",d:"#2E7EA8",sel:"rgba(255,236,60,.85)",hint:"rgba(0,160,200,.50)",last:"rgba(255,236,60,.40)",bdr:"#1A5F82",name:"Ocean"},
  forest:  {l:"#E8F0D8",d:"#4A7C3F",sel:"rgba(255,240,60,.85)",hint:"rgba(30,100,20,.52)",last:"rgba(255,240,60,.38)",bdr:"#2D5A24",name:"Forest"},
  glass:   {l:"rgba(220,230,245,.75)",d:"rgba(80,100,140,.70)",sel:"rgba(255,220,60,.88)",hint:"rgba(60,100,200,.45)",last:"rgba(255,220,60,.40)",bdr:"rgba(100,130,180,.60)",name:"Glass"},
};
const OPENINGS={"e4 e5":"Open Game","e4 e5 Nf3 Nc6 Bc4":"Italian Game","e4 e5 Nf3 Nc6 Bb5":"Ruy López","e4 e6":"French Defense","e4 c5":"Sicilian Defense","e4 c6":"Caro-Kann","d4 d5":"Queen's Gambit","d4 d5 c4":"Queen's Gambit","d4 Nf6":"Indian Defense","d4 Nf6 c4 g6":"King's Indian","Nf3":"Réti Opening","c4":"English Opening"};
function detectOpening(hist){const mv=hist.map(m=>m.san).join(" ");let match="";for(const[k]of Object.entries(OPENINGS))if(mv.startsWith(k)&&k.length>match.length)match=k;return match?OPENINGS[match]:(hist.length>0?"Custom Opening":"");}

const LESSONS=[
  {id:0,track:"beginner",icon:"♟",title:"The Chessboard",fen:"4k3/8/8/8/8/8/8/4K3 w - - 0 1",body:"A chessboard has 64 squares in an 8×8 grid. Files (columns) are labeled a–h left to right. Ranks (rows) are numbered 1–8 from White's side upward. The golden rule: 'light on right' — the bottom-right corner must always be a light square.",tip:"Squares are named by file + rank, e.g. e4, d5, g7. Every square has a unique name."},
  {id:1,track:"beginner",icon:"♙",title:"Pawn Power",fen:"4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1",body:"Pawns march forward — one square at a time, or two squares from their starting rank. They capture diagonally forward. A pawn reaching the 8th rank promotes to any piece (almost always a queen!). Pawns cannot retreat.",tip:"En passant: if an enemy pawn moves two squares past yours on an adjacent file, you can capture it as if it moved only one square — but only immediately!"},
  {id:2,track:"beginner",icon:"♘",title:"The Knight's Dance",fen:"4k3/8/8/8/4N3/8/8/4K3 w - - 0 1",body:"Knights move in an L-shape — two squares in one direction, one perpendicular. They're the only pieces that jump over others. This makes knights especially deadly in closed positions where other pieces are blocked.",tip:"A knight in the center controls up to 8 squares. On the rim it controls only 2–4. 'A knight on the rim is dim!'"},
  {id:3,track:"beginner",icon:"♗",title:"Bishop Diagonals",fen:"4k3/8/8/8/4B3/8/8/4K3 w - - 0 1",body:"Bishops slide diagonally any number of squares and stay forever on their starting color. You have one light-squared and one dark-squared bishop. They shine in open positions with long diagonals.",tip:"The bishop pair — both bishops working together — is a major strategic advantage, controlling squares of both colors."},
  {id:4,track:"beginner",icon:"♖",title:"Rooks Rule Open Files",fen:"4k3/8/8/8/4R3/8/8/4K3 w - - 0 1",body:"Rooks slide horizontally or vertically any number of squares. They're most powerful on open files and the 7th rank, where they attack the opponent's unadvanced pawns. Two rooks doubled on a file are devastating.",tip:"Place rooks on open files early. Connecting your rooks is a key opening goal."},
  {id:5,track:"beginner",icon:"♕",title:"Queen Supremacy",fen:"4k3/8/8/8/4Q3/8/8/4K3 w - - 0 1",body:"The queen combines the rook and bishop — she moves any number of squares in any direction. Worth roughly 9 pawns, she's by far the most powerful piece.",tip:"Don't bring the queen out too early — she can be chased by enemy pieces and you'll lose precious tempo."},
  {id:6,track:"beginner",icon:"♔",title:"Check, Checkmate & Stalemate",fen:"4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1",body:"When the king is under attack it's 'check' — you must escape. If no escape exists: checkmate — game over! If the king isn't in check but has no legal move: stalemate — a draw.",tip:"Three ways to escape check: (1) move the king, (2) block the attacker, (3) capture the attacker."},
  {id:7,track:"beginner",icon:"♙",title:"Three Opening Rules",fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",body:"Three golden principles: (1) Control the center. (2) Develop all pieces quickly. (3) Castle early to protect your king.",tip:"Don't move the same piece twice in the opening unless absolutely necessary."},
  {id:8,track:"intermediate",icon:"♙",title:"Center Control",fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",body:"The four central squares — d4, e4, d5, e5 — are the most important battlefield. Pieces controlling the center dominate more of the board and restrict the opponent.",tip:"A pawn on e4 controls d5 and f5. A piece in the center has more scope than one on the edge."},
  {id:9,track:"intermediate",icon:"♞",title:"Tactics: The Fork",fen:"r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/5N2/PPPP1PPP/RNBQKBNR w KQkq - 2 3",body:"A fork attacks two or more enemy pieces simultaneously with one move. Knights are the best forking pieces because of their unpredictable L-shape.",tip:"Look for undefended pieces as fork targets. An undefended knight next to an undefended rook is a fork waiting to happen."},
  {id:10,track:"intermediate",icon:"♗",title:"Tactics: The Pin",fen:"rnb1kbnr/pp1ppppp/8/q1p5/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 1 3",body:"A pin prevents a piece from moving because doing so would expose a more valuable piece behind it. An absolute pin against the king means the piece literally cannot legally move.",tip:"A pinned piece cannot defend other pieces! Exploit this by attacking other targets."},
  {id:11,track:"intermediate",icon:"♔",title:"Castling: King Safety",fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5",body:"Castling moves the king two squares toward a rook — the rook jumps to the other side. Castle early to protect your king!",tip:"After castling, avoid pushing h3/g3 without good reason — those moves weaken your king's shelter."},
  {id:12,track:"intermediate",icon:"♙",title:"Discovered Attacks",fen:"rnbqk2r/ppp2ppp/3p1n2/4p3/1bB1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5",body:"A discovered attack happens when you move one piece to reveal an attack from a piece behind it. These are extremely powerful because the opponent cannot block both threats at once.",tip:"Scan your pieces for 'hidden attackers' — pieces that would attack a valuable target if another piece moved."},
  {id:13,track:"advanced",icon:"♙",title:"Pawn Structure",fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",body:"Pawns are permanent — they cannot retreat. Doubled pawns reduce rook mobility. Isolated pawns become permanent targets. A passed pawn is a powerful long-term asset.",tip:"Think carefully before every pawn move — that decision can never be undone!"},
  {id:14,track:"advanced",icon:"♖",title:"Tactics: The Skewer",fen:"6k1/6pp/8/1b6/8/8/6PP/R5K1 w - - 0 1",body:"A skewer is the reverse of a pin — you attack a valuable piece that must move, exposing a less valuable piece behind it, which you then capture.",tip:"After forcing the valuable piece to move, capture what was behind it."},
  {id:15,track:"advanced",icon:"♔",title:"King & Pawn Endgames",fen:"8/8/3k4/8/8/3K4/4P3/8 w - - 0 1",body:"In the endgame, the king becomes an active fighting piece. Key concepts: opposition, the rule of the square, and escorting pawns to promotion.",tip:"Getting your king in front of your own pawn (with the opposition) is usually the winning technique."},
  {id:16,track:"advanced",icon:"♗",title:"Opening Systems",fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",body:"Rather than memorizing every variation, master the principles: develop all pieces, fight for the center, castle early, then connect your rooks.",tip:"Always ask 'why?' for every opening move. Understanding beats memorizing."},
];

const PUZZLES=[
  {id:"p1",cat:"Mate in 1",diff:1,fen:"r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4",sol:["Qxf7#"],hint:"Your queen and bishop are perfectly lined up at f7."},
  {id:"p2",cat:"Mate in 1",diff:1,fen:"6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",sol:["Re8#"],hint:"The rook has a clear path to the back rank."},
  {id:"p3",cat:"Mate in 1",diff:1,fen:"r5k1/p4ppp/8/8/8/8/PP3PPP/4R1K1 w - - 0 1",sol:["Re8#"],hint:"Aim for the 8th rank — the king has nowhere to go!"},
  {id:"p4",cat:"Mate in 1",diff:1,fen:"5k2/8/5K2/8/8/8/8/7R w - - 0 1",sol:["Rh8#"],hint:"Use your rook — the king is trapped on the edge."},
  {id:"p5",cat:"Mate in 2",diff:2,fen:"r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 4",sol:["Bxf7+","Ke7","Nd5#"],hint:"The bishop capture on f7 gives check. What follows?"},
  {id:"p6",cat:"Mate in 2",diff:2,fen:"6k1/pp3ppp/8/8/2r5/4R1P1/PP3P1P/6K1 w - - 0 1",sol:["Re8+","Rxe8","Rxe8#"],hint:"Force the king to the back rank with a rook check."},
  {id:"p7",cat:"Fork",diff:2,fen:"r1bqkb1r/ppp2ppp/2np1n2/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5",sol:["Nd5"],hint:"Your knight on f3 can leap to a powerful central square."},
  {id:"p8",cat:"Fork",diff:2,fen:"4k3/8/8/3n4/3N4/8/8/4K3 w - - 0 1",sol:["Nc6+"],hint:"Fork the king and the enemy knight simultaneously."},
  {id:"p9",cat:"Fork",diff:3,fen:"r2qkb1r/pp2pppp/2np1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 7",sol:["Nxc6"],hint:"The knight capture wins material by attacking multiple pieces."},
  {id:"p10",cat:"Pin",diff:2,fen:"r2qkb1r/ppp2ppp/2np1n2/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 6",sol:["Bxf7+"],hint:"A capture on f7 creates a fork-pin between king and queen!"},
  {id:"p11",cat:"Pin",diff:3,fen:"rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/2N5/PPPP1PPP/R1BQK1NR w KQkq - 4 4",sol:["d3"],hint:"Solidify the center and set up a pin on the f6-knight."},
  {id:"p12",cat:"Skewer",diff:3,fen:"6k1/6pp/8/1b6/8/8/6PP/R5K1 w - - 0 1",sol:["Ra5"],hint:"Attack the bishop — when it moves, look at what's behind it!"},
  {id:"p13",cat:"Skewer",diff:3,fen:"8/8/1k6/8/1R6/8/8/6K1 w - - 0 1",sol:["Rb8+"],hint:"Give check — the king must move, revealing the piece behind."},
  {id:"p14",cat:"Back rank",diff:2,fen:"6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",sol:["Rd8#"],hint:"The black king has no flight squares!"},
  {id:"p15",cat:"Back rank",diff:2,fen:"r5k1/5ppp/8/1Q6/8/8/5PPP/6K1 w - - 0 1",sol:["Qb8+","Rxb8","?"],hint:"Force the rook onto the 8th rank with a queen sacrifice."},
  {id:"p16",cat:"Discovery",diff:3,fen:"r1bqk2r/ppp2ppp/3p1n2/4p3/1bB1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5",sol:["Nd5"],hint:"Move the knight to discover an attack from the bishop!"},
  {id:"p17",cat:"Discovery",diff:3,fen:"rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4",sol:["Qa4+"],hint:"The queen check discovers an attack — two threats at once."},
  {id:"p18",cat:"Endgame",diff:3,fen:"8/8/3k4/8/8/3K4/4P3/8 w - - 0 1",sol:["e4"],hint:"Advance the pawn toward promotion."},
  {id:"p19",cat:"Endgame",diff:3,fen:"8/8/8/3k4/8/3K4/3P4/8 w - - 0 1",sol:["Kc4"],hint:"Use the opposition — march your king in front of the pawn."},
  {id:"p20",cat:"Endgame",diff:2,fen:"7k/8/6K1/6P1/8/8/8/8 w - - 0 1",sol:["Kf7"],hint:"Position your king in front of the pawn to escort it."},
];

const SQ=46;

// ── CSS var helpers (works in both light and dark) ───────────────
const C = {
  bg1: "var(--bg-primary)",
  bg2: "var(--bg-secondary)",
  bg3: "var(--bg-tertiary)",
  bgh: "var(--bg-hover)",
  t1:  "var(--text-1)",
  t2:  "var(--text-2)",
  t3:  "var(--text-3)",
  bd:  "var(--border)",
  bds: "var(--border-soft)",
  acc: "var(--accent)",
  adm: "var(--accent-dim)",
  agl: "var(--accent-glow)",
  alt: "var(--accent-light)",
  grn: "var(--green)",
  gdm: "var(--green-dim)",
  red: "var(--red)",
  rdm: "var(--red-dim)",
  amb: "var(--amber)",
  adim:"var(--amber-dim)",
};

export default function ChessAcademy({user=null,onSignOut}){
  const ChessLib=useRef(null);
  const[loaded,setLoaded]=useState(false);
  const[loadErr,setLoadErr]=useState(false);

  const preMoveEval=useRef(0);
  const[moveQualities,setMoveQualities]=useState([]);
  const[lastBadge,setLastBadge]=useState(null);
  const[board,setBoard]=useState([]);
  const[sel,setSel]=useState(null);
  const[legal,setLegal]=useState([]);
  const[lastMv,setLastMv]=useState(null);
  const[gStatus,setGStatus]=useState("idle");
  const[winner,setWinner]=useState(null);
  const[hist,setHist]=useState([]);
  const[inChk,setInChk]=useState(false);
  const[evalBar,setEvalBar]=useState(50);
  const[opening,setOpening]=useState("");
  const[promoDialog,setPromoDialog]=useState(null);
  const[screen,setScreen]=useState("menu");
  const[diff,setDiff]=useState(1);
  const[pCol,setPCol]=useState("w");
  const[theme,setTheme]=useState("walnut");
  const[flipped,setFlipped]=useState(false);
  const[aiThink,setAiThink]=useState(false);
  const[hintSq,setHintSq]=useState(null);
  const[panelTab,setPanelTab]=useState("moves");
  const[timeW,setTimeW]=useState(600);
  const[timeB,setTimeB]=useState(600);
  const[timerOn,setTimerOn]=useState(false);
  const[useTimer,setUseTimer]=useState(false);
  const[timeCtrl,setTimeCtrl]=useState(600);
  const timerRef=useRef(null);
  const[soundOn,setSoundOn]=useState(true);
  const[showCoords,setShowCoords]=useState(true);
  const[animSpd,setAnimSpd]=useState("normal");
  const[doneLessons,setDoneLessons]=useState(new Set());
  const[solvedPz,setSolvedPz]=useState(new Set());
  const[streak,setStreak]=useState(0);
  const[stats,setStats]=useState({w:0,l:0,d:0});
  const[elo,setElo]=useState(1200);
  const[gameMode,setGameMode]=useState("ai");
  const[p2pNames,setP2pNames]=useState({w:"White",b:"Black"});
  const[p2pFlipOnTurn,setP2pFlipOnTurn]=useState(true);
  const[onlineGameData,setOnlineGameData]=useState(null);
  const[lTrack,setLTrack]=useState("beginner");
  const[lIdx,setLIdx]=useState(0);
  const lgRef=useRef(null);
  const[lBoard,setLBoard]=useState([]);
  const[lSel,setLSel]=useState(null);
  const[lLegal,setLLegal]=useState([]);
  const[pz,setPz]=useState(null);
  const pzRef=useRef(null);
  const[pzBoard,setPzBoard]=useState([]);
  const[pzSel,setPzSel]=useState(null);
  const[pzLegal,setPzLegal]=useState([]);
  const[pzLastMv,setPzLastMv]=useState(null);
  const[pzStatus,setPzStatus]=useState("idle");
  const[pzMvIdx,setPzMvIdx]=useState(0);
  const[pzHint,setPzHint]=useState(false);
  const[pzFilter,setPzFilter]=useState("All");
  const[msgs,setMsgs]=useState([]);
  const[tutIn,setTutIn]=useState("");
  const[tutBusy,setTutBusy]=useState(false);
  const tutEndRef=useRef(null);
  const moveListRef=useRef(null);
  const gRef=useRef(null);
  const dragRef=useRef(null);
  const dragJustMoved=useRef(false);
  const dragHandlersRef=useRef({});
  const[ghostState,setGhostState]=useState(null);
  const[shareModal,setShareModal]=useState(false);
  const gameStartTime=useRef(null);

  useEffect(()=>{import("https://esm.sh/chess.js@1.1.0").then(m=>{ChessLib.current=m.Chess;setLoaded(true);}).catch(()=>setLoadErr(true));},[]);
  useEffect(()=>{
    if(user)return;
    (async()=>{try{const r=await window.storage?.get("chess_v2");if(r?.value){const p=JSON.parse(r.value);if(p.done)setDoneLessons(new Set(p.done));if(p.solved)setSolvedPz(new Set(p.solved));if(p.streak)setStreak(p.streak);if(p.stats)setStats(p.stats);if(p.elo)setElo(p.elo);}}catch{}})();
  },[]);

  async function saveProgress(dl=doneLessons,sp=solvedPz,sk=streak,st=stats,el=elo){
    if(user)return;
    try{await window.storage?.set("chess_v2",JSON.stringify({done:[...dl],solved:[...sp],streak:sk,stats:st,elo:el}));}catch{}
  }
  const{saveGame}=useSupabaseProgress({user,setDoneLessons,setSolvedPz,setStreak,setStats,setElo,doneLessons,solvedPz,streak,stats,elo});
  function play(k){if(soundOn)SND[k]?.();}
  function calcNewElo(p,o,r){const K=32,e=1/(1+Math.pow(10,(o-p)/400));return Math.round(p+K*(r-e));}
  function classifyMove(eb,ea,col){
    const sign=col==="w"?1:-1,delta=(ea-eb)*sign;
    if(delta>=0)    return{label:"Best",      sym:"!",   color:"#18A558",bg:"rgba(24,165,88,.12)"};
    if(delta>=-15)  return{label:"Good",       sym:"✓",   color:"#18A558",bg:"rgba(24,165,88,.10)"};
    if(delta>=-50)  return{label:"Inaccuracy", sym:"?",   color:"#D97706",bg:"rgba(217,119,6,.12)"};
    if(delta>=-150) return{label:"Mistake",    sym:"??",  color:"#F97316",bg:"rgba(249,115,22,.12)"};
    return              {label:"Blunder",    sym:"???", color:"#EF4444",bg:"rgba(239,68,68,.12)"};
  }
  const flippedRef=useRef(flipped);
  useEffect(()=>{flippedRef.current=flipped;},[flipped]);

  function getSqFromPos(cx,cy,rect,fl){
    const co=showCoords?18:0,bo=2;
    const relX=cx-rect.left-bo-co,relY=cy-rect.top-bo;
    const ci=Math.floor(relX/SQ),ri=Math.floor(relY/SQ);
    if(ci<0||ci>7||ri<0||ri>7)return null;
    return`${String.fromCharCode(97+(fl?7-ci:ci))}${8-(fl?7-ri:ri)}`;
  }
  function startGenericDrag(e,sq,piece,dropHandler,isFlipped=false){
    if(e.touches)e.preventDefault();
    const cx=e.touches?e.touches[0].clientX:e.clientX,cy=e.touches?e.touches[0].clientY:e.clientY;
    let el=e.target;while(el&&el.getAttribute?.("data-chess-board")!=="1")el=el.parentElement;
    dragRef.current={from:sq,startX:cx,startY:cy,moved:false,boardEl:el,dropHandler,isFlipped};
    setGhostState({x:cx,y:cy,pk:`${piece.color}${piece.type.toUpperCase()}`,isW:piece.color==="w"});
  }
  function makePlayDrop(from){
    return(from2,to)=>{
      const g2=gRef.current;
      if(!g2||gStatus!=="playing"||aiThink){setSel(null);setLegal([]);return;}
      const turn=g2.turn();
      if(gameMode==="ai"&&turn!==pCol){setSel(null);setLegal([]);return;}
      if(!g2.moves({square:from2,verbose:true}).map(m=>m.to).includes(to)){setSel(null);setLegal([]);return;}
      const p=g2.get(from2);
      if(p?.type==="p"&&((turn==="w"&&to[1]==="8")||(turn==="b"&&to[1]==="1"))){preMoveEval.current=evalPos(g2);setPromoDialog({from:from2,to});setSel(null);setLegal([]);return;}
      const eb=evalPos(g2);const r=g2.move({from:from2,to,promotion:"q"});
      if(r){
        const badge=classifyMove(eb,evalPos(g2),turn);
        setMoveQualities(q=>[...q,badge]);setLastBadge(badge);setTimeout(()=>setLastBadge(null),2200);
        setLastMv({from:r.from,to:r.to});setSel(null);setLegal([]);setHintSq(null);
        if(r.captured)play("capture");else if(r.flags.includes("k")||r.flags.includes("q"))play("castle");else play("move");
        if(g2.inCheck())play("check");syncGame(g2);
        if(gameMode==="ai"){const aiC=pCol==="w"?"b":"w";if(!g2.isGameOver()&&g2.turn()===aiC)setTimeout(()=>runAI(g2),300);}
      }else{setSel(null);setLegal([]);}
    };
  }
  function playDragStart(e,sq){
    const g=gRef.current;if(!g||gStatus!=="playing"||aiThink||promoDialog)return;
    const piece=g.get(sq);const at=g.turn();
    if(!(gameMode==="p2p"?piece&&piece.color===at:piece&&piece.color===pCol))return;
    setSel(sq);setLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));
    startGenericDrag(e,sq,piece,makePlayDrop(sq),flippedRef.current);
  }
  function learnDragStart(e,sq){
    const g=lgRef.current;if(!g)return;const piece=g.get(sq);if(!piece)return;
    setLSel(sq);setLLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));
    startGenericDrag(e,sq,piece,(from,to)=>{
      const g2=lgRef.current;if(!g2)return;
      if(!g2.moves({square:from,verbose:true}).map(m=>m.to).includes(to)){setLSel(null);setLLegal([]);return;}
      const r=g2.move({from,to,promotion:"q"});if(r){setLBoard([...g2.board()]);setLSel(null);setLLegal([]);}else{setLSel(null);setLLegal([]);}
    },false);
  }
  function pzDragStart(e,sq){
    const g=pzRef.current;if(!g||!pz||pzStatus==="solved"||pzStatus==="wrong")return;
    const piece=g.get(sq);if(!piece||piece.color!==g.turn())return;
    setPzSel(sq);setPzLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));
    startGenericDrag(e,sq,piece,(from,to)=>{
      const g2=pzRef.current;if(!g2||!pz)return;
      if(!g2.moves({square:from,verbose:true}).map(m=>m.to).includes(to)){setPzSel(null);setPzLegal([]);return;}
      const r=g2.move({from,to,promotion:"q"});if(!r){setPzSel(null);setPzLegal([]);return;}
      setPzLastMv({from:r.from,to:r.to});setPzBoard([...g2.board()]);setPzSel(null);setPzLegal([]);
      const expected=pz.sol[pzMvIdx];
      if(r.san===expected||r.from+r.to===expected||r.from+r.to+(r.promotion||"")===expected){
        const next=pzMvIdx+1;
        if(next>=pz.sol.length){setPzStatus("solved");play("pzOk");const sk=streak+1;setStreak(sk);const ns=new Set(solvedPz);ns.add(pz.id);setSolvedPz(ns);saveProgress(undefined,ns,sk);}
        else{setPzMvIdx(next);setPzStatus("correct");play("move");if(pz.sol[next])setTimeout(()=>{const opp=g2.move(pz.sol[next]);if(opp){setPzLastMv({from:opp.from,to:opp.to});setPzBoard([...g2.board()]);setPzMvIdx(next+1);setPzStatus("idle");}},600);}
      }else{g2.undo();setPzBoard([...g2.board()]);setPzLastMv(null);setPzStatus("wrong");play("pzFail");const sk=0;setStreak(sk);saveProgress(undefined,undefined,sk);}
    },false);
  }
  function onDragMove(e){
    if(!dragRef.current)return;if(e.cancelable)e.preventDefault();
    const cx=e.touches?e.touches[0].clientX:e.clientX,cy=e.touches?e.touches[0].clientY:e.clientY;
    if(!dragRef.current.moved){const dx=cx-dragRef.current.startX,dy=cy-dragRef.current.startY;if(Math.abs(dx)>5||Math.abs(dy)>5)dragRef.current.moved=true;}
    setGhostState(s=>s?{...s,x:cx,y:cy}:null);
  }
  function onDragEnd(e){
    if(!dragRef.current)return;
    const{moved,boardEl,dropHandler,isFlipped}=dragRef.current;const from=dragRef.current.from;
    dragRef.current=null;setGhostState(null);
    if(!moved)return;
    dragJustMoved.current=true;setTimeout(()=>{dragJustMoved.current=false;},150);
    const cx=e.changedTouches?e.changedTouches[0].clientX:e.clientX,cy=e.changedTouches?e.changedTouches[0].clientY:e.clientY;
    if(!boardEl){setSel(null);setLegal([]);return;}
    const to=getSqFromPos(cx,cy,boardEl.getBoundingClientRect(),isFlipped);
    if(!to||to===from){setSel(null);setLegal([]);return;}
    dropHandler?.(from,to);
  }
  dragHandlersRef.current={onDragMove,onDragEnd};
  useEffect(()=>{
    const mm=e=>dragHandlersRef.current.onDragMove(e),mu=e=>dragHandlersRef.current.onDragEnd(e);
    window.addEventListener("mousemove",mm);window.addEventListener("mouseup",mu);
    window.addEventListener("touchmove",mm,{passive:false});window.addEventListener("touchend",mu);
    return()=>{window.removeEventListener("mousemove",mm);window.removeEventListener("mouseup",mu);window.removeEventListener("touchmove",mm);window.removeEventListener("touchend",mu);};
  },[]);

  function computeAccuracy(q){if(!q.length)return null;const W={Best:100,Good:90,Inaccuracy:70,Mistake:40,Blunder:0};return Math.round(q.reduce((s,x)=>s+(W[x.label]??50),0)/q.length);}
  function syncGame(g=gRef.current){
    if(!g)return;setBoard([...g.board()]);const h=g.history({verbose:true});setHist([...h]);setInChk(g.inCheck());setOpening(detectOpening(h));
    const raw=Math.max(-15,Math.min(15,evalPos(g)/100));setEvalBar(Math.round(((raw+15)/30)*100));
    if(gameMode==="p2p"&&p2pFlipOnTurn&&!g.isGameOver())setFlipped(g.turn()==="b");
    if(g.isCheckmate()){setGStatus("checkmate");setWinner(g.turn()==="w"?"Black":"White");setTimerOn(false);}
    else if(g.isStalemate()){setGStatus("stalemate");setTimerOn(false);}
    else if(g.isDraw()){setGStatus("draw");setTimerOn(false);}
    else setGStatus("playing");
  }
  function startGame(){
    if(!loaded)return;clearInterval(timerRef.current);
    const g=new ChessLib.current();gRef.current=g;gameStartTime.current=Date.now();
    setBoard(g.board());setGStatus("playing");setWinner(null);setHist([]);setSel(null);setLegal([]);
    setLastMv(null);setInChk(false);setEvalBar(50);setHintSq(null);setAiThink(false);setOpening("");
    setMoveQualities([]);setLastBadge(null);preMoveEval.current=0;setShareModal(false);
    setTimeW(timeCtrl);setTimeB(timeCtrl);
    if(gameMode==="p2p")setFlipped(false);else setFlipped(pCol==="b");
    setMsgs([{role:"assistant",content:gameMode==="p2p"?`Pass-and-play started! ${p2pNames.w} moves first. Good luck! ♟`:`Let's play! I'm set to ${DIFFS[diff].label} difficulty. Ask me anything about chess!`}]);
    setPanelTab("moves");setScreen("play");if(useTimer)setTimerOn(true);
    if(gameMode==="ai"&&pCol==="b")setTimeout(()=>runAI(g),600);
  }
  function runAI(g=gRef.current){
    if(!g||g.isGameOver())return;setAiThink(true);
    const delay=animSpd==="fast"?200:animSpd==="slow"?800:420;
    setTimeout(()=>{
      const mv=getAIMove(g,diff);
      if(mv){const r=g.move(mv);if(r){setLastMv({from:r.from,to:r.to});if(r.captured)play("capture");else if(r.flags.includes("k")||r.flags.includes("q"))play("castle");else play("move");if(g.inCheck())play("check");}}
      syncGame(g);setAiThink(false);
    },delay);
  }
  function handleSqClick(sq){
    const g=gRef.current;if(dragJustMoved.current){dragJustMoved.current=false;return;}
    if(!g||gStatus!=="playing"||aiThink||promoDialog)return;
    const at=g.turn();if(gameMode==="ai"&&at!==pCol)return;
    if(sel&&legal.includes(sq)){
      const piece=g.get(sel);
      if(piece?.type==="p"&&((at==="w"&&sq[1]==="8")||(at==="b"&&sq[1]==="1"))){preMoveEval.current=evalPos(g);setPromoDialog({from:sel,to:sq});return;}
      const eb=evalPos(g);const r=g.move({from:sel,to:sq,promotion:"q"});
      if(r){
        const badge=classifyMove(eb,evalPos(g),at);setMoveQualities(q=>[...q,badge]);setLastBadge(badge);setTimeout(()=>setLastBadge(null),2200);
        setLastMv({from:r.from,to:r.to});setSel(null);setLegal([]);setHintSq(null);
        if(r.captured)play("capture");else if(r.flags.includes("k")||r.flags.includes("q"))play("castle");else play("move");
        if(g.inCheck())play("check");syncGame(g);
        if(gameMode==="ai"){const aiC=pCol==="w"?"b":"w";if(!g.isGameOver()&&g.turn()===aiC)setTimeout(()=>runAI(g),300);}
      }
      return;
    }
    const piece=g.get(sq);const canSel=gameMode==="p2p"?piece&&piece.color===at:piece&&piece.color===pCol;
    if(canSel){setSel(sq);setLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));}else{setSel(null);setLegal([]);}
  }
  function doPromotion(pt){
    if(!promoDialog)return;const g=gRef.current;
    const eb=preMoveEval.current||evalPos(g);const r=g.move({from:promoDialog.from,to:promoDialog.to,promotion:pt});setPromoDialog(null);
    if(r){
      const badge=classifyMove(eb,evalPos(g),pCol);setMoveQualities(q=>[...q,badge]);setLastBadge(badge);setTimeout(()=>setLastBadge(null),2200);
      setLastMv({from:r.from,to:r.to});setSel(null);setLegal([]);play("move");if(g.inCheck())play("check");syncGame(g);
      const aiC=pCol==="w"?"b":"w";if(!g.isGameOver()&&g.turn()===aiC)setTimeout(()=>runAI(g),300);
    }
  }
  function undoMove(){const g=gRef.current;if(!g||hist.length<2)return;g.undo();g.undo();syncGame(g);setSel(null);setLegal([]);setLastMv(null);setHintSq(null);setGStatus("playing");setWinner(null);}
  function resign(){
    const g=gRef.current;const rc=gameMode==="p2p"?(g?.turn()||"w"):pCol;const w=rc==="w"?"Black":"White";
    setGStatus("resign");setWinner(w);setTimerOn(false);play("over");
    if(gameMode==="ai"){const ns={...stats,l:stats.l+1};setStats(ns);saveProgress(undefined,undefined,undefined,ns);}
  }
  function showHint(){
    const g=gRef.current;if(!g||gStatus!=="playing")return;
    const mv=getAIMove(g,Math.min(diff+1,4));if(mv){const m=g.moves({verbose:true}).find(m=>m.san===mv);if(m)setHintSq(m.from);else{const m2=g.moves({verbose:true})[0];if(m2)setHintSq(m2.from);}}
  }
  useEffect(()=>{
    if(["checkmate","stalemate","draw","resign"].includes(gStatus)){
      const iWon=winner===(pCol==="w"?"White":"Black");
      if(gameMode==="ai"){const result=gStatus==="checkmate"?(iWon?1:0):gStatus==="resign"?0:0.5;const ne=calcNewElo(elo,DIFF_ELO[diff],result);setElo(ne);saveProgress(undefined,undefined,undefined,undefined,ne);}
      const result=gStatus==="checkmate"?(iWon?"win":"loss"):gStatus==="resign"?"loss":"draw";
      const dS=gameStartTime.current?Math.round((Date.now()-gameStartTime.current)/1000):0;
      saveGame({result,playerColor:pCol,difficulty:diff,moves:hist.map(m=>m.san),opening,durationS:dS});
      if(gStatus==="checkmate"&&iWon){play("win");const ns={...stats,w:stats.w+1};setStats(ns);saveProgress(undefined,undefined,undefined,ns);}
      else if(gStatus==="checkmate"||gStatus==="resign"){play("over");if(gStatus!=="resign"){const ns={...stats,l:stats.l+1};setStats(ns);saveProgress(undefined,undefined,undefined,ns);}}
      else{play("over");const ns={...stats,d:stats.d+1};setStats(ns);saveProgress(undefined,undefined,undefined,ns);}
    }
  },[gStatus]);
  useEffect(()=>{
    if(!timerOn||!useTimer)return;
    timerRef.current=setInterval(()=>{
      if(gRef.current?.turn()==="w")setTimeW(t=>{if(t<=1){clearInterval(timerRef.current);setGStatus("timeout");setWinner("Black");return 0;}return t-1;});
      else setTimeB(t=>{if(t<=1){clearInterval(timerRef.current);setGStatus("timeout");setWinner("White");return 0;}return t-1;});
    },1000);
    return()=>clearInterval(timerRef.current);
  },[timerOn,useTimer]);
  useEffect(()=>{moveListRef.current?.lastElementChild?.scrollIntoView({behavior:"smooth"});},[hist]);
  useEffect(()=>{tutEndRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  function fmtTime(s){const m=Math.floor(s/60);return`${m}:${(s%60).toString().padStart(2,"0")}`;}

  const trackLessons=LESSONS.filter(l=>l.track===lTrack);
  const curLesson=trackLessons[lIdx]??LESSONS[0];
  function loadLesson(lesson){
    if(!loaded||!lesson)return;let g;try{g=new ChessLib.current(lesson.fen||"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");}catch{g=new ChessLib.current();}
    lgRef.current=g;setLBoard(g.board());setLSel(null);setLLegal([]);
  }
  useEffect(()=>{if(loaded&&screen==="learn")loadLesson(curLesson);},[loaded,lIdx,lTrack,screen]);
  function handleLClick(sq){
    const g=lgRef.current;if(!g)return;
    if(lSel&&lLegal.includes(sq)){const r=g.move({from:lSel,to:sq,promotion:"q"});if(r){setLBoard([...g.board()]);setLSel(null);setLLegal([]);return;}}
    const piece=g.get(sq);if(piece){setLSel(sq);setLLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));}else{setLSel(null);setLLegal([]);}
  }
  function markDone(){const u=new Set(doneLessons);u.add(curLesson.id);setDoneLessons(u);saveProgress(u);if(lIdx<trackLessons.length-1)setLIdx(lIdx+1);}
  function loadPuzzle(puzzle){
    if(!loaded||!puzzle)return;let g;try{g=new ChessLib.current(puzzle.fen);}catch{return;}
    pzRef.current=g;setPz(puzzle);setPzBoard(g.board());setPzSel(null);setPzLegal([]);setPzLastMv(null);setPzStatus("idle");setPzMvIdx(0);setPzHint(false);
  }
  function randomPuzzle(filter=pzFilter){
    const pool=PUZZLES.filter(p=>filter==="All"||p.cat===filter);const unsolved=pool.filter(p=>!solvedPz.has(p.id));const src=unsolved.length?unsolved:pool;
    loadPuzzle(src[Math.floor(Math.random()*src.length)]);
  }
  function handlePzClick(sq){
    const g=pzRef.current;if(!g||!pz||pzStatus==="solved"||pzStatus==="wrong")return;
    if(pzSel&&pzLegal.includes(sq)){
      const r=g.move({from:pzSel,to:sq,promotion:"q"});if(!r){setPzSel(null);setPzLegal([]);return;}
      setPzLastMv({from:r.from,to:r.to});setPzBoard([...g.board()]);setPzSel(null);setPzLegal([]);
      const exp=pz.sol[pzMvIdx];
      if(r.san===exp||r.from+r.to===exp||r.from+r.to+r.promotion===exp){
        const next=pzMvIdx+1;
        if(next>=pz.sol.length){setPzStatus("solved");play("pzOk");const sk=streak+1;setStreak(sk);const ns=new Set(solvedPz);ns.add(pz.id);setSolvedPz(ns);saveProgress(undefined,ns,sk);}
        else{setPzMvIdx(next);setPzStatus("correct");play("move");if(pz.sol[next])setTimeout(()=>{const opp=g.move(pz.sol[next]);if(opp){setPzLastMv({from:opp.from,to:opp.to});setPzBoard([...g.board()]);setPzMvIdx(next+1);setPzStatus("idle");}},600);}
      }else{g.undo();setPzBoard([...g.board()]);setPzLastMv(null);setPzStatus("wrong");play("pzFail");const sk=0;setStreak(sk);saveProgress(undefined,undefined,sk);}
      return;
    }
    const piece=g.get(sq);if(piece&&piece.color===g.turn()){setPzSel(sq);setPzLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));}else{setPzSel(null);setPzLegal([]);}
  }
  useEffect(()=>{
    function onKey(e){
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
      if(screen==="play"){if(e.key==="u"||e.key==="U")undoMove();if(e.key==="h"||e.key==="H")showHint();if(e.key==="f"||e.key==="F")setFlipped(f=>!f);if(e.key==="n"||e.key==="N")startGame();}
      if(screen==="learn"){if(e.key==="ArrowRight")setLIdx(i=>Math.min(trackLessons.length-1,i+1));if(e.key==="ArrowLeft")setLIdx(i=>Math.max(0,i-1));if(e.key==="r"||e.key==="R")loadLesson(curLesson);}
      if(screen==="puzzles"){if(e.key==="n"||e.key==="N")randomPuzzle();if(e.key==="h"||e.key==="H")setPzHint(true);}
      if(e.key==="Escape")setScreen("menu");
    }
    window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);
  },[screen,hist,lIdx,lTrack,pz]);

  // ── AI Tutor ─────────────────────────────────────────────────
  const lastMsgTime=useRef(0);const tutorCache=useRef({});
  async function sendMsg(){
    const q=tutIn.trim();if(!q)return;
    const now=Date.now();if(now-lastMsgTime.current<3000){setMsgs(p=>[...p,{role:"assistant",content:"⏳ Please wait a moment."}]);return;}
    lastMsgTime.current=now;
    const g=screen==="puzzles"?pzRef.current:screen==="learn"?lgRef.current:gRef.current;
    const fen=g?.fen()??"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const mvs=g?.history().slice(-8).join(" ")||"none";
    const ctx=screen==="learn"?`Lesson: "${curLesson?.title}". `:screen==="puzzles"&&pz?`Puzzle: "${pz.cat}". `:"";
    const sys=`You are an encouraging expert chess tutor. ${ctx}FEN: ${fen}. Recent moves: ${mvs}. Be concise (2-4 sentences), warm, helpful. Use chess emojis occasionally.`;
    const ck=`${q}|${fen.slice(0,20)}`;
    if(tutorCache.current[ck]){setMsgs(p=>[...p,{role:"user",content:q},{role:"assistant",content:tutorCache.current[ck]}]);setTutIn("");return;}
    const apiKey=import.meta.env.VITE_GROQ_KEY;
    if(!apiKey){setMsgs(p=>[...p,{role:"assistant",content:"⚠️ Add VITE_GROQ_KEY to your environment variables (free at console.groq.com)."}]);return;}
    const newMsgs=[...msgs,{role:"user",content:q}];setMsgs(newMsgs);setTutIn("");setTutBusy(true);
    const MODELS=["llama-3.1-8b-instant","llama3-8b-8192","gemma2-9b-it"];
    try{
      let reply=null;let lastErr="";
      for(const model of MODELS){
        let res;try{res=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${apiKey}`},body:JSON.stringify({model,messages:[{role:"system",content:sys},...newMsgs.map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.content}))],max_tokens:400,temperature:0.7})});}catch{lastErr="Network error";continue;}
        const d=await res.json();
        if(res.status===401)throw new Error("Invalid API key.");if(res.status===429)throw new Error("Rate limit — wait 30s.");
        if(!res.ok){lastErr=d?.error?.message||`HTTP ${res.status}`;continue;}
        reply=d?.choices?.[0]?.message?.content;if(reply)break;
      }
      if(!reply)throw new Error(lastErr||"All models unavailable.");
      tutorCache.current[ck]=reply;setMsgs(p=>[...p,{role:"assistant",content:reply}]);
    }catch(e){setMsgs(p=>[...p,{role:"assistant",content:`❌ ${e.message}`}]);}
    setTutBusy(false);
  }

  // ── Board ────────────────────────────────────────────────────
  function Board({brd,onSq,selSq,legalSqs=[],lastMove=null,noFlip=false,chkSq=null,hintSq2=null,sz=SQ,onPieceDragStart=null,isMyTurn=false}){
    const t=THEMES[theme]||THEMES.walnut;const fl=flipped&&!noFlip;
    const rows=fl?[...brd].reverse():brd;
    return(
      <div data-chess-board="1" style={{display:"inline-flex",flexDirection:"column",borderRadius:8,overflow:"hidden",
        boxShadow:"0 8px 32px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.12)",
        border:`2px solid ${t.bdr}`,
        outline:isMyTurn?"2px solid var(--accent)":"2px solid transparent",
        outlineOffset:"3px",transition:"outline-color .35s ease",
        userSelect:"none",WebkitUserSelect:"none",boxSizing:"border-box"}}>
        {rows.map((rowData,ri)=>{
          const bRow=fl?7-ri:ri;const rank=8-bRow;const dispRow=fl?[...rowData].reverse():rowData;
          return(
            <div key={ri} style={{display:"flex"}}>
              {showCoords&&<div style={{width:18,height:sz,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.35)",fontSize:9,color:"rgba(255,255,255,.5)",fontFamily:"var(--font-mono)",fontWeight:600,flexShrink:0}}>{rank}</div>}
              {dispRow.map((piece,ci)=>{
                const bCol=fl?7-ci:ci;const sq=`${String.fromCharCode(97+bCol)}${rank}`;
                const isLight=(bRow+bCol)%2!==0;const isSel=selSq===sq;const isLeg=legalSqs.includes(sq);
                const isLF=lastMove?.from===sq;const isLT=lastMove?.to===sq;
                const isChk=chkSq===sq;const isHint=hintSq2===sq;
                const pk=piece?`${piece.color}${piece.type.toUpperCase()}`:null;const isW=piece?.color==="w";
                const isBeingDragged=dragRef.current?.from===sq;
                let bg=isLight?t.l:t.d;
                if(isSel)bg=t.sel;else if(isLF||isLT)bg=t.last;
                if(isChk)bg="rgba(239,68,68,.72)";
                return(
                  <div key={ci} onClick={()=>onSq(sq)} className="board-sq"
                    style={{width:sz,height:sz,background:bg,cursor:onPieceDragStart&&piece?"grab":"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center",position:"relative",
                      outline:isSel?"2.5px solid rgba(255,240,60,.9)":isHint?"2.5px solid rgba(24,165,88,.9)":"none",
                      outlineOffset:"-2.5px",boxSizing:"border-box",
                      animation:isLT?"sqFlash .4s ease-out":"none"}}>
                    {isLeg&&!piece&&<div style={{width:Math.round(sz*.32),height:Math.round(sz*.32),borderRadius:"50%",background:t.hint,pointerEvents:"none",animation:"hintIn .16s ease-out"}}/>}
                    {isLeg&&piece&&<div style={{position:"absolute",inset:0,boxShadow:`inset 0 0 0 3px ${t.hint}`,pointerEvents:"none"}}/>}
                    {piece&&<span className="chess-piece"
                      onMouseDown={onPieceDragStart?(e)=>{e.stopPropagation();onPieceDragStart(e,sq);}:undefined}
                      onTouchStart={onPieceDragStart?(e)=>{e.stopPropagation();onPieceDragStart(e,sq);}:undefined}
                      style={{fontSize:Math.round(sz*.83),lineHeight:1,userSelect:"none",
                        color:isW?"#FFFFFF":"#1a1a1a",
                        textShadow:isW?"0 0 6px rgba(0,0,0,.9),0 1px 8px rgba(0,0,0,.8)":"0 0 3px rgba(255,255,255,.15),0 1px 4px rgba(0,0,0,.4)",
                        position:"relative",zIndex:1,opacity:isBeingDragged?0:1,
                        cursor:onPieceDragStart?"grab":"default",
                        transition:"opacity .05s",WebkitUserSelect:"none",touchAction:"none"}}>{UNI[pk]}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
        {showCoords&&(
          <div style={{display:"flex",background:"rgba(0,0,0,.35)"}}>
            <div style={{width:18}}/>
            {Array.from({length:8},(_,i)=>(
              <div key={i} style={{width:sz,textAlign:"center",fontSize:9,color:"rgba(255,255,255,.5)",padding:"3px 0",fontFamily:"var(--font-mono)",fontWeight:600}}>
                {String.fromCharCode(97+(fl?7-i:i))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Toggle ─────────────────────────────────────────────────
  function Toggle({val,onChange}){
    return(
      <div onClick={()=>onChange(!val)} className="toggle" style={{background:val?C.acc:"var(--bg-tertiary)",border:`1px solid ${val?C.acc:C.bd}`}}>
        <div className="toggle-knob" style={{left:val?20:2}}/>
      </div>
    );
  }

  // ── Captured ───────────────────────────────────────────────
  function Captured({history,forColor}){
    const map={};
    history.filter(m=>m.color!==forColor&&m.captured).forEach(m=>{const k=`${forColor}${m.captured.toUpperCase()}`;map[k]=(map[k]||0)+1;});
    const sorted=Object.entries(map).sort((a,b)=>PV[b[0][1].toLowerCase()]-PV[a[0][1].toLowerCase()]);
    const mat=sorted.reduce((s,[k,n])=>s+PV[k[1].toLowerCase()]*n,0);
    const opp=history.filter(m=>m.color===forColor&&m.captured).reduce((s,m)=>s+PV[m.captured],0);
    const adv=mat-opp;
    return(
      <div style={{display:"flex",alignItems:"center",gap:4,minHeight:18}}>
        <span style={{fontSize:12,letterSpacing:.5,color:C.t2}}>{sorted.map(([k,n])=>Array(n).fill(UNI[k]).join("")).join("")}</span>
        {adv>0&&<span style={{fontSize:11,color:C.acc,fontWeight:600,fontFamily:"var(--font-mono)"}}>+{adv}</span>}
      </div>
    );
  }

  // ── TutorChat ──────────────────────────────────────────────
  function TutorChat({height=260,placeholder="Ask your chess tutor…"}){
    const quickP=screen==="learn"?[`Explain "${curLesson?.title}"`,`Any tips?`,"What's the idea?"]
                :screen==="puzzles"?["Give a hint","What tactic is this?","Explain the solution"]
                :["Best move?","What's my plan?","Evaluate position"];
    return(
      <div style={{display:"flex",flexDirection:"column",height}}>
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,paddingRight:4,paddingBottom:4}}>
          {msgs.length===0&&<p style={{fontSize:13,color:C.t3,fontStyle:"italic",margin:0}}>Ask anything about the position or chess!</p>}
          {msgs.map((m,i)=>(
            <div key={i} className={m.role==="user"?"msg-in-right":"msg-in-left"} style={{maxWidth:"88%",alignSelf:m.role==="user"?"flex-end":"flex-start"}}>
              <div className={m.role==="user"?"tutor-msg-user":"tutor-msg-ai"} style={{fontSize:13,lineHeight:1.6,padding:"9px 13px"}}>{m.content}</div>
            </div>
          ))}
          {tutBusy&&<div style={{alignSelf:"flex-start",fontSize:13,color:C.t3,fontStyle:"italic",padding:"7px 12px",background:C.bg3,borderRadius:"16px 16px 16px 4px",border:`1px solid ${C.bd}`}}>
            <span style={{animation:"pulse 1.2s ease infinite",display:"inline-block"}}>●</span> Thinking…
          </div>}
          <div ref={tutEndRef}/>
        </div>
        <div style={{borderTop:`1px solid ${C.bd}`,paddingTop:10}}>
          <div style={{display:"flex",gap:6}}>
            <input value={tutIn} onChange={e=>setTutIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!tutBusy&&sendMsg()}
              placeholder={placeholder}
              style={{flex:1,fontSize:13,padding:"8px 12px",borderRadius:"var(--r-md)",border:`1px solid ${C.bd}`,background:C.bg2,color:C.t1,outline:"none",transition:"border-color .15s"}}
              onFocus={e=>e.target.style.borderColor="var(--accent)"}
              onBlur={e=>e.target.style.borderColor="var(--border)"}/>
            <button onClick={sendMsg} disabled={tutBusy||!tutIn.trim()} className="btn-primary" style={{padding:"8px 14px",fontSize:14,opacity:tutBusy||!tutIn.trim()?0.4:1}}>↑</button>
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:7}}>
            {quickP.map(q=><button key={q} onClick={()=>setTutIn(q)} className="btn-ghost" style={{fontSize:11,padding:"3px 9px",borderRadius:20}}>{q}</button>)}
          </div>
        </div>
      </div>
    );
  }

  // ── Promo Dialog ────────────────────────────────────────────
  function PromoDlg(){
    if(!promoDialog)return null;
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(4px)"}}>
        <div style={{background:C.bg1,borderRadius:"var(--r-xl)",padding:"1.5rem",boxShadow:"var(--shadow-lg)",border:`1px solid ${C.bds}`,animation:"fadeUp .18s ease"}}>
          <div style={{fontSize:14,fontWeight:600,color:C.t1,marginBottom:16,textAlign:"center"}}>Promote pawn to…</div>
          <div style={{display:"flex",gap:10}}>
            {[["q","Queen"],["r","Rook"],["b","Bishop"],["n","Knight"]].map(([pt,label])=>(
              <div key={pt} onClick={()=>doPromotion(pt)} style={{width:72,height:72,border:`1px solid ${C.bd}`,borderRadius:"var(--r-md)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:4,transition:"all .15s",background:C.bg2}}
                onMouseEnter={e=>{e.currentTarget.style.background=C.bg3;e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.transform="scale(1.06)";}}
                onMouseLeave={e=>{e.currentTarget.style.background=C.bg2;e.currentTarget.style.borderColor=C.bd;e.currentTarget.style.transform="";}}>
                <span style={{fontSize:34,color:pCol==="w"?"#fff":"#111",textShadow:pCol==="w"?"0 0 4px #000,0 1px 6px rgba(0,0,0,.9)":"none"}}>{UNI[`${pCol}${pt.toUpperCase()}`]}</span>
                <span style={{fontSize:10,color:C.t2}}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Share Modal ─────────────────────────────────────────────
  function ShareModal(){
    const[copied,setCopied]=useState(false);
    const iWon=winner===(pCol==="w"?"White":"Black");
    const acc=computeAccuracy(moveQualities);
    const accColor=acc==null?C.t2:acc>=85?C.grn:acc>=65?C.amb:C.red;
    const text=[`♟ Chess Academy`,``,gStatus==="checkmate"?(iWon?"🏆 Victory":"💀 Defeat"):gStatus==="resign"?"🏳 Resigned":"🤝 Draw",`vs ${DIFFS[diff].label}${acc!=null?" · Accuracy: "+acc+"/100":""}`,`${hist.length} moves${opening?" · "+opening:""}`,``,...moveQualities.length?[`✓ ${moveQualities.filter(m=>m.label==="Best"||m.label==="Good").length}  ? ${moveQualities.filter(m=>m.label==="Inaccuracy").length}  ?? ${moveQualities.filter(m=>m.label==="Mistake").length}  ??? ${moveQualities.filter(m=>m.label==="Blunder").length}`]:[],``,`https://chess-academy.vercel.app`].join("\n");
    async function copy(){try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{}}
    return(
      <div onClick={()=>setShareModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:"0 1rem",backdropFilter:"blur(4px)"}}>
        <div onClick={e=>e.stopPropagation()} style={{background:C.bg1,borderRadius:"var(--r-xl)",padding:"1.5rem",width:"100%",maxWidth:370,boxShadow:"var(--shadow-lg)",border:`1px solid ${C.bds}`,animation:"fadeUp .18s ease"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <span style={{fontSize:15,fontWeight:600,color:C.t1}}>Share Result</span>
            <button onClick={()=>setShareModal(false)} className="btn-ghost" style={{padding:"4px 8px",borderRadius:"var(--r-sm)",fontSize:16,lineHeight:1}}>×</button>
          </div>
          <div style={{padding:"12px 14px",borderRadius:"var(--r-md)",background:iWon?C.gdm:C.rdm,border:`1px solid ${iWon?C.grn:C.red}30`,display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <span style={{fontSize:28}}>{gStatus==="checkmate"?(iWon?"🏆":"💀"):gStatus==="resign"?"🏳":"🤝"}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:C.t1}}>{gStatus==="checkmate"?`${winner} wins!`:gStatus==="stalemate"?"Stalemate":gStatus==="resign"?"Resigned":"Draw"}</div>
              <div style={{fontSize:12,color:C.t2,marginTop:2}}>vs {DIFFS[diff].label} · {hist.length} moves</div>
            </div>
            {acc!=null&&<div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,color:accColor,fontFamily:"var(--font-mono)"}}>{acc}</div><div style={{fontSize:10,color:C.t3}}>accuracy</div></div>}
          </div>
          {moveQualities.length>0&&(
            <div style={{display:"flex",gap:6,marginBottom:14}}>
              {[{sym:"!",color:C.grn,count:moveQualities.filter(m=>m.label==="Best"||m.label==="Good").length},{sym:"?",color:C.amb,count:moveQualities.filter(m=>m.label==="Inaccuracy").length},{sym:"??",color:"#F97316",count:moveQualities.filter(m=>m.label==="Mistake").length},{sym:"???",color:C.red,count:moveQualities.filter(m=>m.label==="Blunder").length}].map(s=>(
                <div key={s.sym} style={{flex:1,textAlign:"center",padding:"8px 4px",borderRadius:"var(--r-md)",background:`${s.color}14`,border:`1px solid ${s.color}30`}}>
                  <div style={{fontSize:12,fontWeight:700,color:s.color,fontFamily:"var(--font-mono)"}}>{s.sym}</div>
                  <div style={{fontSize:15,fontWeight:700,color:s.color,marginTop:2}}>{s.count}</div>
                </div>
              ))}
            </div>
          )}
          <pre style={{background:C.bg2,borderRadius:"var(--r-md)",padding:"10px 12px",marginBottom:14,fontFamily:"var(--font-mono)",fontSize:11,lineHeight:1.8,whiteSpace:"pre-wrap",color:C.t2,border:`1px solid ${C.bd}`,overflowX:"hidden"}}>{text}</pre>
          <button onClick={copy} className="btn-primary" style={{width:"100%",padding:"11px",background:copied?C.grn:C.acc}}>
            {copied?"✓ Copied!":"📋 Copy to clipboard"}
          </button>
        </div>
      </div>
    );
  }

  // ── Ghost piece ─────────────────────────────────────────────
  function GhostPiece(){
    if(!ghostState)return null;const{x,y,pk,isW}=ghostState;
    return(
      <div style={{position:"fixed",left:x-SQ*.62,top:y-SQ*.62,width:SQ*1.24,height:SQ*1.24,fontSize:Math.round(SQ*1.04),display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",zIndex:9999,opacity:.9,
        color:isW?"#fff":"#1a1a1a",textShadow:isW?"0 0 8px rgba(0,0,0,.9),0 2px 10px rgba(0,0,0,.8)":"0 0 3px rgba(255,255,255,.2)",
        transform:"scale(1.12)",userSelect:"none",filter:"drop-shadow(0 6px 14px rgba(0,0,0,.4))"}}>
        {UNI[pk]}
      </div>
    );
  }

  // ── Bottom Nav ─────────────────────────────────────────────
  const NAV=[{id:"menu",icon:"⌂",label:"Home"},{id:"play_setup",icon:"⚔",label:"Play"},{id:"online",icon:"🌐",label:"Online"},{id:"learn",icon:"🎓",label:"Learn"},{id:"puzzles",icon:"🧩",label:"Puzzles"},{id:"profile",icon:"👤",label:"Profile"}];
  const NAV_MAP={menu:"menu",settings:"menu",play_setup:"play_setup",play:"play_setup",online:"online",online_play:"online",learn:"learn",puzzles:"puzzles",profile:"profile"};
  const NAV_SCREENS=new Set(["menu","play_setup","play","learn","puzzles","profile","settings","online","online_play"]);
  function BottomNav(){
    if(!NAV_SCREENS.has(screen)||screen==="play"||screen==="online_play")return null;
    const active=NAV_MAP[screen]??"menu";
    function go(id){
      if(id==="menu")setScreen("menu");
      else if(id==="play_setup"){setGameMode("ai");setScreen("play_setup");}
      else if(id==="online")setScreen("online");
      else if(id==="learn")setScreen("learn");
      else if(id==="puzzles"){if(!pz)randomPuzzle();setScreen("puzzles");}
      else if(id==="profile")setScreen("profile");
    }
    return(
      <nav className="bottom-nav">
        <div style={{maxWidth:860,margin:"0 auto",width:"100%",display:"flex",padding:"0 4px",height:"100%",alignItems:"center"}}>
          {NAV.map(item=>{
            const isActive=active===item.id;
            return(
              <button key={item.id} onClick={()=>go(item.id)}
                style={{flex:1,border:"none",background:"none",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,cursor:"pointer",padding:"6px 4px",
                  color:isActive?C.acc:C.t3,transition:"color .15s",position:"relative",outline:"none",height:"100%"}}>
                {isActive&&<span style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:28,height:2,borderRadius:"0 0 2px 2px",background:C.acc}}/>}
                <span style={{fontSize:20,lineHeight:1,transform:isActive?"scale(1.08)":"none",transition:"transform .15s"}}>{item.icon}</span>
                <span style={{fontSize:10,fontWeight:isActive?600:400,letterSpacing:.2}}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // ════════════════════════════════════════════════════════════
  //  LOADING
  // ════════════════════════════════════════════════════════════
  if(!loaded)return(
    <div style={{minHeight:500,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,fontFamily:"var(--font-sans)"}}>
      {loadErr
        ?<><span style={{fontSize:40}}>⚠️</span><p style={{color:C.t2,fontSize:14}}>Could not load chess engine. Check connection and reload.</p></>
        :<><span style={{fontSize:60,animation:"float 2.2s ease-in-out infinite",display:"inline-block"}}>♟</span><p style={{color:C.t3,fontSize:13}}>Loading Chess Academy…</p></>}
    </div>
  );

  // ════════════════════════════════════════════════════════════
  //  MENU
  // ════════════════════════════════════════════════════════════
  if(screen==="menu"){
    const pct=Math.round((doneLessons.size/LESSONS.length)*100);
    const totalG=stats.w+stats.l+stats.d;const wr=totalG>0?Math.round(stats.w/totalG*100):0;
    return(<>
      <div style={{padding:"1rem 0 5rem",fontFamily:"var(--font-sans)"}} className="screen-enter">

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.75rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:30,animation:"float 3.5s ease-in-out infinite",display:"inline-block"}}>♟</span>
            <div>
              <div style={{fontSize:19,fontWeight:700,color:C.t1,letterSpacing:"-.3px"}}>Chess Academy</div>
              <div style={{fontSize:11,color:C.t3,marginTop:1}}>Play · Learn · Master</div>
            </div>
          </div>
          <button onClick={()=>setScreen("profile")} className="btn-ghost" style={{display:"flex",alignItems:"center",gap:6,fontSize:12}}>
            <span>👤</span><span>{user?(user.user_metadata?.username??user.email?.split("@")[0]):"Guest"}</span>
          </button>
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
          {[{label:"Rating",val:elo,icon:"📈",color:C.acc},{label:"Wins",val:stats.w,icon:"🏆",color:C.grn},{label:"Win %",val:`${wr}%`,icon:"📊",color:C.amb},{label:"Streak",val:streak,icon:"🔥",color:"#F97316"}].map(s=>(
            <div key={s.label} className="stat-card" style={{padding:"12px 8px",textAlign:"center"}}>
              <div style={{fontSize:10,color:C.t3,marginBottom:4}}>{s.icon} {s.label}</div>
              <div style={{fontSize:20,fontWeight:700,color:s.color,fontFamily:"var(--font-mono)"}}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Primary grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div className="mode-card" onClick={()=>{setGameMode("ai");setScreen("play_setup");}} style={{padding:"1.2rem"}}>
            <div style={{fontSize:32,marginBottom:10}}>⚔️</div>
            <div style={{fontSize:15,fontWeight:600,color:C.t1,marginBottom:4}}>vs AI</div>
            <div style={{fontSize:12,color:C.t2,marginBottom:10,lineHeight:1.5}}>5 difficulty levels, move quality analysis</div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:11,padding:"2px 8px",background:C.adm,borderRadius:20,color:C.alt,fontWeight:600}}>{DIFFS[diff].label}</span>
              <span style={{fontSize:11,color:C.t3,fontFamily:"var(--font-mono)"}}>{elo} Elo</span>
            </div>
          </div>
          <div className="mode-card" onClick={()=>setScreen("learn")} style={{padding:"1.2rem"}}>
            <div style={{fontSize:32,marginBottom:10}}>🎓</div>
            <div style={{fontSize:15,fontWeight:600,color:C.t1,marginBottom:4}}>Learn</div>
            <div style={{fontSize:12,color:C.t2,marginBottom:10,lineHeight:1.5}}>{LESSONS.length} lessons across 3 tracks</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div className="progress-track" style={{flex:1}}><div className="progress-fill progress-fill-green" style={{width:`${pct}%`}}/></div>
              <span style={{fontSize:11,color:C.grn,fontFamily:"var(--font-mono)",fontWeight:600}}>{pct}%</span>
            </div>
          </div>
        </div>

        {/* Secondary list */}
        {[
          {id:"online",emoji:"🌐",title:"Play Online",desc:"Real-time games against friends · invite code or quick match",badge:"Live",bc:C.acc},
          {id:"p2p",   emoji:"👥",title:"Pass & Play",desc:"2 players on one device · board auto-flips each turn",badge:"Local",bc:"#F97316"},
          {id:"puzzles",emoji:"🧩",title:"Puzzle Trainer",desc:`${PUZZLES.length} tactical puzzles · ${solvedPz.size} solved`,badge:`${solvedPz.size}/${PUZZLES.length}`,bc:"#A855F7"},
        ].map(m=>(
          <div key={m.id} className="mode-card" onClick={()=>{
              if(m.id==="online")setScreen("online");
              else if(m.id==="p2p"){setGameMode("p2p");setScreen("play_setup");}
              else{randomPuzzle();setScreen("puzzles");}
            }}
            style={{padding:"1rem 1.2rem",display:"flex",alignItems:"center",gap:14,marginBottom:8}}>
            <span style={{fontSize:26,flexShrink:0}}>{m.emoji}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:600,color:C.t1,marginBottom:2}}>{m.title}</div>
              <div style={{fontSize:12,color:C.t2}}>{m.desc}</div>
            </div>
            <span style={{fontSize:11,padding:"3px 9px",background:`${m.bc}14`,borderRadius:20,color:m.bc,fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>{m.badge}</span>
          </div>
        ))}

        {/* Theme + Settings */}
        <div className="card" style={{padding:"1rem 1.2rem",marginTop:2}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:500,color:C.t1}}>Board Theme</span>
            <button onClick={()=>setScreen("settings")} className="btn-ghost" style={{fontSize:12,padding:"4px 10px"}}>⚙ Settings</button>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {Object.entries(THEMES).map(([k,t])=>(
              <div key={k} onClick={()=>setTheme(k)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",width:34,height:34,borderRadius:6,overflow:"hidden",
                  outline:theme===k?`2.5px solid ${C.acc}`:"2px solid transparent",outlineOffset:2,
                  transition:"outline .15s,transform .15s",transform:theme===k?"scale(1.1)":"scale(1)"}}>
                  {[t.l,t.d,t.d,t.l].map((c,i)=><div key={i} style={{background:c}}/>)}
                </div>
                <span style={{fontSize:10,fontWeight:theme===k?600:400,color:theme===k?C.acc:C.t3}}>{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav/>
    </>);
  }

  // ── Delegate online/profile screens ────────────────────────
  if(screen==="online")return(<><OnlineScreen user={user} onBack={()=>setScreen("menu")} onJoinGame={(gd)=>{setOnlineGameData(gd);setScreen("online_play");}}/><BottomNav/></>);
  if(screen==="online_play"&&onlineGameData)return(
    <OnlinePlayScreen gameData={onlineGameData} user={user} onBack={()=>setScreen("online")} ChessLib={ChessLib} loaded={loaded} theme={theme} showCoords={showCoords} soundOn={soundOn}
      onStatsChange={(d)=>{const ns={w:stats.w+(d.wins??0),l:stats.l+(d.losses??0),d:stats.d+(d.draws??0)};setStats(ns);saveProgress(undefined,undefined,undefined,ns);}}
      onEloChange={(result,oppElo)=>{const ne=calcNewElo(elo,oppElo,result);setElo(ne);saveProgress(undefined,undefined,undefined,undefined,ne);}}
    />
  );
  if(screen==="profile")return(<><ProfileScreen user={user} stats={stats} doneLessons={doneLessons} solvedPz={solvedPz} streak={streak} onBack={()=>setScreen("menu")} onSignOut={onSignOut}/><BottomNav/></>);

  // ════════════════════════════════════════════════════════════
  //  SETTINGS
  // ════════════════════════════════════════════════════════════
  if(screen==="settings")return(<>
    <div style={{padding:"1rem 0 5rem",fontFamily:"var(--font-sans)"}} className="screen-enter">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"1.5rem"}}>
        <button onClick={()=>setScreen("menu")} className="btn-ghost">← Back</button>
        <span style={{fontSize:18,fontWeight:600,color:C.t1}}>Settings</span>
      </div>
      {[{label:"Sound Effects",sub:"Move, capture, check sounds",val:soundOn,set:setSoundOn},{label:"Show Coordinates",sub:"File and rank labels on the board",val:showCoords,set:setShowCoords}].map(s=>(
        <div key={s.label} className="card" style={{padding:"13px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:C.t1}}>{s.label}</div><div style={{fontSize:12,color:C.t2,marginTop:2}}>{s.sub}</div></div>
          <Toggle val={s.val} onChange={s.set}/>
        </div>
      ))}
      <div className="card" style={{padding:"13px 16px",marginBottom:8}}>
        <div style={{fontSize:14,fontWeight:500,color:C.t1,marginBottom:10}}>Animation Speed</div>
        <div style={{display:"flex",gap:8}}>
          {["fast","normal","slow"].map(s=>(
            <button key={s} onClick={()=>setAnimSpd(s)} style={{flex:1,padding:"8px",fontSize:13,borderRadius:"var(--r-md)",border:`1px solid ${animSpd===s?C.acc:C.bd}`,background:animSpd===s?C.adm:C.bg2,color:animSpd===s?C.alt:C.t2,cursor:"pointer",fontFamily:"var(--font-sans)",transition:"all .15s",textTransform:"capitalize"}}>{s}</button>
          ))}
        </div>
      </div>
      <button onClick={async()=>{setDoneLessons(new Set());setStats({w:0,l:0,d:0});setSolvedPz(new Set());setStreak(0);try{await window.storage?.set("chess_v2","{}");}catch{}}}
        style={{width:"100%",padding:11,background:"transparent",color:C.red,border:`1px solid ${C.red}`,borderRadius:"var(--r-md)",fontSize:14,cursor:"pointer",marginTop:8,fontFamily:"var(--font-sans)",transition:"background .15s"}}
        onMouseEnter={e=>e.currentTarget.style.background=C.rdm} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        Reset All Progress
      </button>
    </div>
    <BottomNav/>
  </>);

  // ════════════════════════════════════════════════════════════
  //  PLAY SETUP
  // ════════════════════════════════════════════════════════════
  if(screen==="play_setup")return(<>
    <div style={{padding:"1rem 0 5rem",fontFamily:"var(--font-sans)"}} className="screen-enter">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"1.5rem"}}>
        <button onClick={()=>{setGameMode("ai");setScreen("menu");}} className="btn-ghost">← Back</button>
        <span style={{fontSize:18,fontWeight:600,color:C.t1}}>{gameMode==="p2p"?"👥 Pass & Play":"⚔️ New Game"}</span>
      </div>

      {/* Mode tabs */}
      <div style={{display:"flex",gap:0,marginBottom:16,background:C.bg3,padding:3,borderRadius:"var(--r-md)",border:`1px solid ${C.bd}`}}>
        {[["ai","⚔ vs AI"],["p2p","👥 Pass & Play"]].map(([m,label])=>(
          <button key={m} onClick={()=>setGameMode(m)} style={{flex:1,padding:"8px",fontSize:13,fontWeight:600,borderRadius:"var(--r-sm)",border:"none",background:gameMode===m?C.bg1:"transparent",color:gameMode===m?C.t1:C.t2,cursor:"pointer",transition:"all .15s",boxShadow:gameMode===m?"var(--shadow-sm)":"none",fontFamily:"var(--font-sans)"}}>{label}</button>
        ))}
      </div>

      {gameMode==="ai"&&<>
        <div className="card" style={{padding:"1rem",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:600,color:C.t3,marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>Difficulty</div>
          {DIFFS.map((d,i)=>(
            <div key={i} onClick={()=>setDiff(i)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:"var(--r-md)",background:diff===i?C.adm:"transparent",border:`1px solid ${diff===i?C.acc:"transparent"}`,cursor:"pointer",transition:"all .15s",marginBottom:i<4?4:0}}>
              <div style={{width:9,height:9,borderRadius:"50%",background:d.color,flexShrink:0}}/>
              <span style={{fontSize:13,fontWeight:diff===i?600:400,color:C.t1,flex:1}}>{d.label}</span>
              <span style={{fontSize:12,color:C.t2}}>{d.desc}</span>
              <span style={{fontSize:11,color:d.color,fontWeight:600,fontFamily:"var(--font-mono)",minWidth:32,textAlign:"right"}}>{DIFF_ELO[i]}</span>
              {diff===i&&<span style={{color:C.grn,fontSize:13}}>✓</span>}
            </div>
          ))}
        </div>
        <div className="card" style={{padding:"1rem",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:600,color:C.t3,marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>Play As</div>
          <div style={{display:"flex",gap:10}}>
            {[["w","♙","White","You move first"],["b","♟","Black","AI moves first"]].map(([col,ico,label,sub])=>(
              <div key={col} onClick={()=>setPCol(col)} style={{flex:1,padding:"14px 12px",border:`1px solid ${pCol===col?C.acc:C.bd}`,borderRadius:"var(--r-md)",cursor:"pointer",textAlign:"center",transition:"all .15s",background:pCol===col?C.adm:C.bg2}}>
                <div style={{fontSize:32,marginBottom:6}}>{ico}</div>
                <div style={{fontSize:13,fontWeight:600,color:C.t1,marginBottom:2}}>{label}</div>
                <div style={{fontSize:11,color:C.t2}}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </>}

      {gameMode==="p2p"&&<>
        <div className="card" style={{padding:"1rem",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:600,color:C.t3,marginBottom:12,textTransform:"uppercase",letterSpacing:".06em"}}>Player Names</div>
          {[["w","♙ White (moves first)"],["b","♟ Black"]].map(([col,label])=>(
            <div key={col} style={{marginBottom:10}}>
              <div style={{fontSize:12,color:C.t2,marginBottom:5}}>{label}</div>
              <input value={p2pNames[col]} onChange={e=>setP2pNames(n=>({...n,[col]:e.target.value}))} placeholder={col==="w"?"Player 1":"Player 2"}
                style={{width:"100%",fontSize:14,padding:"9px 12px",borderRadius:"var(--r-md)",border:`1px solid ${C.bd}`,background:C.bg2,color:C.t1,outline:"none",boxSizing:"border-box",fontFamily:"var(--font-sans)",transition:"border-color .15s"}}
                onFocus={e=>e.target.style.borderColor=C.acc} onBlur={e=>e.target.style.borderColor=C.bd}/>
            </div>
          ))}
        </div>
        <div className="card" style={{padding:"13px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:C.t1}}>Auto-flip board</div><div style={{fontSize:12,color:C.t2,marginTop:2}}>Each player always faces their own pieces</div></div>
          <Toggle val={p2pFlipOnTurn} onChange={setP2pFlipOnTurn}/>
        </div>
      </>}

      <div className="card" style={{padding:"1rem",marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:600,color:C.t3,textTransform:"uppercase",letterSpacing:".06em"}}>Time Control</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12,color:useTimer?C.acc:C.t3,fontWeight:useTimer?600:400}}>{useTimer?"On":"Off"}</span>
            <Toggle val={useTimer} onChange={setUseTimer}/>
          </div>
        </div>
        {useTimer&&(
          <div style={{display:"flex",gap:8}}>
            {[[180,"3 min"],[300,"5 min"],[600,"10 min"],[900,"15 min"]].map(([s,label])=>(
              <button key={s} onClick={()=>setTimeCtrl(s)} style={{flex:1,padding:"8px 4px",fontSize:13,borderRadius:"var(--r-md)",border:`1px solid ${timeCtrl===s?C.acc:C.bd}`,background:timeCtrl===s?C.adm:C.bg2,color:timeCtrl===s?C.alt:C.t2,cursor:"pointer",fontFamily:"var(--font-sans)",transition:"all .15s"}}>{label}</button>
            ))}
          </div>
        )}
      </div>

      <button onClick={startGame} className="btn-primary" style={{width:"100%",padding:13,fontSize:15,fontWeight:600}}>
        {gameMode==="p2p"?"Start Pass & Play →":"Start Game →"}
      </button>
    </div>
    <BottomNav/>
  </>);

  // ════════════════════════════════════════════════════════════
  //  PLAY SCREEN
  // ════════════════════════════════════════════════════════════
  if(screen==="play"){
    const g=gRef.current;
    const movePairs=[];for(let i=0;i<hist.length;i+=2)movePairs.push({n:Math.floor(i/2)+1,w:hist[i]?.san,b:hist[i+1]?.san});
    const isMyTurn=g?.turn()===pCol;const gameOver=gStatus!=="playing"&&gStatus!=="idle";
    const iWon=winner===(pCol==="w"?"White":"Black");
    const chkSq=inChk&&g?(()=>{let k=null;g.board().forEach((row,r)=>row.forEach((p,c)=>{if(p?.type==="k"&&p.color===g.turn())k=`${String.fromCharCode(97+c)}${8-r}`;}));return k;})():null;
    const oppLabel=gameMode==="p2p"?(flipped?p2pNames.w:p2pNames.b):`AI · ${DIFFS[diff].label}`;
    const myLabel=gameMode==="p2p"?(flipped?p2pNames.b:p2pNames.w):"You";

    return(
      <div style={{padding:"0.5rem 0 1.5rem",fontFamily:"var(--font-sans)"}} className="screen-enter">
        <style>{`@keyframes checkPulse{0%,100%{background:rgba(239,68,68,.65)}50%{background:rgba(239,68,68,.85)}}`}</style>
        <PromoDlg/>{shareModal&&<ShareModal/>}

        {/* Top bar */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          <button onClick={()=>{setScreen("menu");setGameMode("ai");}} className="btn-ghost" style={{fontSize:12,padding:"6px 11px"}}>← Menu</button>
          <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
            {gameMode==="p2p"?<span style={{fontSize:12,color:"#F97316",fontWeight:600}}>👥 Pass & Play</span>
              :<><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:DIFFS[diff].color,flexShrink:0}}/><span style={{fontSize:12,color:C.t2}}>{DIFFS[diff].label}</span></>}
            {opening&&<span style={{fontSize:11,color:C.t3,borderLeft:`1px solid ${C.bd}`,paddingLeft:7,fontStyle:"italic",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{opening}</span>}
          </div>
          {gameMode==="p2p"&&gStatus==="playing"&&<span style={{fontSize:12,fontWeight:600,padding:"3px 10px",background:C.bg3,border:`1px solid ${C.bd}`,borderRadius:20,color:C.t1}}>{g?.turn()==="w"?`♙ ${p2pNames.w}`:`♟ ${p2pNames.b}`}'s turn</span>}
          {gameMode==="ai"&&aiThink&&<span style={{fontSize:12,color:C.t3,fontStyle:"italic",animation:"pulse 1s ease infinite"}}>AI thinking…</span>}
          {inChk&&gStatus==="playing"&&<span style={{fontSize:12,color:C.red,fontWeight:700,padding:"3px 9px",background:C.rdm,borderRadius:20}}>⚠ Check!</span>}
          <button onClick={()=>setFlipped(f=>!f)} className="btn-ghost" style={{padding:"6px 10px",fontSize:13}}>⟳</button>
        </div>

        {/* Result banner */}
        {gameOver&&(()=>{
          const eloChange=gameMode==="ai"?(()=>{const r=gStatus==="checkmate"?(iWon?1:0):gStatus==="resign"?0:0.5;return calcNewElo(elo,DIFF_ELO[diff],r)-elo;})():null;
          const wn=gameMode==="p2p"?(winner==="White"?p2pNames.w:p2pNames.b):winner;
          const positive=(gStatus==="checkmate"||gStatus==="timeout")&&(iWon||gameMode==="p2p");
          return(
            <div style={{marginBottom:12,padding:"12px 16px",borderRadius:"var(--r-md)",background:positive?C.gdm:C.rdm,border:`1px solid ${positive?C.grn:C.red}44`,display:"flex",alignItems:"center",gap:12,animation:"fadeUp .25s ease"}}>
              <span style={{fontSize:26}}>{gStatus==="checkmate"?"🏆":gStatus==="resign"?"🏳":gStatus==="timeout"?"⏰":"🤝"}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:C.t1}}>{gStatus==="checkmate"?`${wn} wins by checkmate!`:gStatus==="stalemate"?"Stalemate — draw!":gStatus==="timeout"?`${wn} wins on time!`:gStatus==="resign"?`${wn} wins — opponent resigned`:"Draw!"}</div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginTop:2,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,color:C.t2,fontFamily:"var(--font-mono)"}}>{hist.length} moves</span>
                  {computeAccuracy(moveQualities)!=null&&(()=>{const acc=computeAccuracy(moveQualities);const col=acc>=85?C.grn:acc>=65?C.amb:C.red;return<span style={{fontSize:12,fontWeight:600,color:col,fontFamily:"var(--font-mono)"}}>Accuracy: {acc}/100</span>;})()}
                  {eloChange!=null&&<span style={{fontSize:12,fontWeight:600,color:eloChange>=0?C.grn:C.red,fontFamily:"var(--font-mono)"}}>{eloChange>=0?`+${eloChange}`:eloChange} Elo</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                {gameMode==="ai"&&<button onClick={()=>setShareModal(true)} className="btn-ghost" style={{padding:"6px 11px",fontSize:12}}>📤</button>}
                <button onClick={startGame} className="btn-primary" style={{padding:"7px 14px",fontSize:13}}>Rematch</button>
              </div>
            </div>
          );
        })()}

        {/* Quality summary */}
        {gameOver&&moveQualities.length>0&&(
          <div className="card" style={{marginBottom:12,padding:"10px 14px"}}>
            <div style={{fontSize:11,color:C.t3,marginBottom:8,textTransform:"uppercase",letterSpacing:".04em",fontWeight:600}}>Move Quality</div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {[{label:"Best/Good",sym:"✓",color:C.grn,count:moveQualities.filter(m=>m.label==="Best"||m.label==="Good").length},{label:"Inaccuracy",sym:"?",color:C.amb,count:moveQualities.filter(m=>m.label==="Inaccuracy").length},{label:"Mistake",sym:"??",color:"#F97316",count:moveQualities.filter(m=>m.label==="Mistake").length},{label:"Blunder",sym:"???",color:C.red,count:moveQualities.filter(m=>m.label==="Blunder").length}].map(s=>(
                <div key={s.label} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,background:`${s.color}14`,border:`1px solid ${s.color}30`}}>
                  <span style={{fontSize:12,fontWeight:700,color:s.color,fontFamily:"var(--font-mono)"}}>{s.sym}</span>
                  <span style={{fontSize:12,color:s.color,fontWeight:500}}>{s.count} {s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
          {/* Board column */}
          <div style={{flexShrink:0}}>
            {/* Opponent bar */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5,padding:"5px 10px",background:C.bg1,borderRadius:"var(--r-md)",border:`1px solid ${C.bd}`,minHeight:30}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14}}>{pCol==="w"?"♟":"♙"}</span>
                <span style={{fontSize:13,color:C.t2,fontWeight:500}}>{oppLabel}</span>
                <Captured history={hist} forColor={pCol==="w"?"b":"w"}/>
              </div>
              {useTimer&&<div style={{fontSize:13,fontFamily:"var(--font-mono)",fontWeight:700,color:!isMyTurn?C.t1:C.t3,padding:"2px 8px",borderRadius:"var(--r-sm)",background:!isMyTurn&&gStatus==="playing"?C.adm:"transparent",transition:"all .3s"}}>{fmtTime(pCol==="w"?timeB:timeW)}</div>}
            </div>

            {/* Eval bar + board */}
            <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
              <div style={{width:7,height:SQ*8+(showCoords?22:0),background:C.bg3,borderRadius:4,overflow:"hidden",flexShrink:0,display:"flex",flexDirection:"column-reverse",border:`1px solid ${C.bd}`}}>
                <div style={{height:`${evalBar}%`,background:C.t1,transition:"height .7s ease",borderRadius:4}}/>
              </div>
              <div style={{position:"relative"}}>
                <Board brd={board} onSq={handleSqClick} selSq={sel} legalSqs={legal} lastMove={lastMv} chkSq={chkSq} hintSq2={hintSq} isMyTurn={isMyTurn&&gStatus==="playing"} onPieceDragStart={playDragStart}/>
                {lastBadge&&(
                  <div style={{position:"absolute",top:-14,right:-10,zIndex:10,background:C.bg1,border:`1.5px solid ${lastBadge.color}`,borderRadius:20,padding:"4px 11px",display:"flex",alignItems:"center",gap:5,animation:"badgePop .32s cubic-bezier(.34,1.56,.64,1) forwards",boxShadow:`var(--shadow-sm), 0 0 12px ${lastBadge.color}30`}}>
                    <span style={{fontSize:12,fontWeight:700,color:lastBadge.color,fontFamily:"var(--font-mono)"}}>{lastBadge.sym}</span>
                    <span style={{fontSize:11,fontWeight:600,color:lastBadge.color}}>{lastBadge.label}</span>
                  </div>
                )}
              </div>
            </div>

            {/* My bar */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:5,padding:"5px 10px",background:C.bg1,borderRadius:"var(--r-md)",border:`1px solid ${isMyTurn&&gStatus==="playing"?C.acc:C.bd}`,minHeight:30,transition:"border-color .3s"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14}}>{pCol==="w"?"♙":"♟"}</span>
                <span style={{fontSize:13,color:C.t1,fontWeight:600}}>{myLabel}</span>
                <Captured history={hist} forColor={pCol}/>
                {gameMode==="ai"&&gStatus==="playing"&&isMyTurn&&!aiThink&&<span style={{fontSize:11,color:C.grn,fontWeight:600,animation:"pulse 2s ease infinite"}}>● Your turn</span>}
              </div>
              {useTimer&&<div style={{fontSize:13,fontFamily:"var(--font-mono)",fontWeight:700,color:isMyTurn?C.t1:C.t3,padding:"2px 8px",borderRadius:"var(--r-sm)",background:isMyTurn&&gStatus==="playing"?C.adm:"transparent",transition:"all .3s"}}>{fmtTime(pCol==="w"?timeW:timeB)}</div>}
            </div>
          </div>

          {/* Right panel */}
          <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:0}}>
            {/* Tabs */}
            <div style={{display:"flex",background:C.bg3,borderRadius:"var(--r-md)",padding:3,marginBottom:10,border:`1px solid ${C.bd}`}}>
              {[["moves","Moves"],["tutor","✨ Tutor"]].map(([id,label])=>(
                <button key={id} onClick={()=>setPanelTab(id)} style={{flex:1,padding:"7px 0",fontSize:13,background:panelTab===id?C.bg1:"transparent",border:"none",borderRadius:"var(--r-sm)",color:panelTab===id?C.t1:C.t2,cursor:"pointer",fontWeight:panelTab===id?600:400,transition:"all .15s",boxShadow:panelTab===id?"var(--shadow-sm)":"none",fontFamily:"var(--font-sans)"}}>{label}</button>
              ))}
            </div>

            {panelTab==="moves"&&(
              <div ref={moveListRef} style={{flex:1,overflowY:"auto",maxHeight:280,minHeight:80}}>
                {movePairs.length===0&&<p style={{fontSize:13,color:C.t3,fontStyle:"italic",margin:0,padding:"6px 4px"}}>Waiting for your first move…</p>}
                {movePairs.map((p,i)=>{
                  const wB=moveQualities[i*2]??null,bB=moveQualities[i*2+1]??null,isWP=pCol==="w";
                  return(
                    <div key={p.n} className="move-row" style={{display:"flex",alignItems:"center",padding:"3px 4px",borderBottom:`1px solid ${C.bd}`}}>
                      <span style={{width:24,fontSize:11,color:C.t3,flexShrink:0,fontFamily:"var(--font-mono)",textAlign:"right",paddingRight:4}}>{p.n}.</span>
                      <span style={{flex:1,fontSize:13,fontFamily:"var(--font-mono)",fontWeight:600,color:C.t1,padding:"2px 5px"}}>{p.w}</span>
                      {isWP&&wB&&<span title={wB.label} style={{fontSize:11,fontWeight:700,color:wB.color,marginRight:2,fontFamily:"var(--font-mono)"}}>{wB.sym}</span>}
                      {!(isWP&&wB)&&<span style={{width:14,flexShrink:0}}/>}
                      <span style={{flex:1,fontSize:13,fontFamily:"var(--font-mono)",color:C.t2,padding:"2px 5px"}}>{p.b??""}</span>
                      {!isWP&&bB&&<span title={bB.label} style={{fontSize:11,fontWeight:700,color:bB.color,marginRight:2,fontFamily:"var(--font-mono)"}}>{bB.sym}</span>}
                    </div>
                  );
                })}
              </div>
            )}
            {panelTab==="tutor"&&<TutorChat height={280} placeholder="Ask about this position…"/>}

            {/* Buttons */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:10}}>
              {[{label:"↩ Undo",fn:undoMove,off:hist.length<2||gameOver},{label:hintSq?"💡 Shown":"💡 Hint",fn:showHint,off:gameOver||aiThink||gameMode==="p2p",on:!!hintSq},{label:"🏳 Resign",fn:resign,off:gameOver||hist.length<2}].map(b=>(
                <button key={b.label} onClick={b.fn} disabled={b.off} className="btn-secondary" style={{padding:"8px 0",fontSize:12,background:b.on?C.adm:undefined,borderColor:b.on?C.acc:undefined,color:b.on?C.alt:b.off?C.t3:undefined,opacity:b.off?.35:1}}>{b.label}</button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6}}>
              <button onClick={startGame} className="btn-secondary" style={{padding:"8px 0",fontSize:12}}>↺ New Game</button>
              <button onClick={()=>setScreen("play_setup")} className="btn-secondary" style={{padding:"8px 0",fontSize:12}}>⚙ Setup</button>
            </div>
            <div style={{marginTop:10,padding:"8px 10px",background:C.bg3,borderRadius:"var(--r-md)",border:`1px solid ${C.bd}`,display:"flex",flexWrap:"wrap",gap:"5px 10px"}}>
              {[["U","Undo"],["H","Hint"],["F","Flip"],["N","New"],["Esc","Menu"]].map(([k,label])=>(
                <div key={k} style={{display:"flex",alignItems:"center",gap:4}}>
                  <span className="kbd">{k}</span><span style={{fontSize:11,color:C.t3}}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <GhostPiece/>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  //  PUZZLES
  // ════════════════════════════════════════════════════════════
  if(screen==="puzzles"){
    const cats=["All",...new Set(PUZZLES.map(p=>p.cat))];
    const stMap={
      idle:   {icon:"🧩",text:`Find the best move for ${pzRef.current?.turn()==="w"?"White":"Black"}!`,bg:C.bg1,border:C.bd,color:C.t1},
      correct:{icon:"✓", text:"Good move — keep going!",bg:C.gdm,border:`${C.grn}44`,color:C.grn},
      solved: {icon:"🎉",text:`Solved! Streak: ${streak}`,bg:C.gdm,border:`${C.grn}55`,color:C.grn},
      wrong:  {icon:"✗", text:"Not quite — try again!",bg:C.rdm,border:`${C.red}44`,color:C.red},
    };
    const st=stMap[pzStatus]??stMap.idle;
    return(<>
      <div style={{padding:"0.5rem 0 5rem",fontFamily:"var(--font-sans)"}} className="screen-enter">
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <button onClick={()=>setScreen("menu")} className="btn-ghost" style={{fontSize:12,padding:"6px 11px"}}>← Menu</button>
          <span style={{fontSize:17,fontWeight:700,color:C.t1,flex:1}}>🧩 Puzzle Trainer</span>
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",background:streak>0?C.adim:C.bg3,borderRadius:20,border:`1px solid ${streak>0?C.amb:C.bd}`,fontSize:13,fontWeight:600,color:streak>0?C.amb:C.t2}}>
            {streak>0&&<span style={{animation:"fire .8s ease-in-out infinite",display:"inline-block"}}>🔥</span>}
            {streak>0?`${streak} streak`:"No streak"}
          </div>
        </div>

        {/* Filter pills */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          {cats.map(c=>(
            <button key={c} onClick={()=>{setPzFilter(c);if(!pz)randomPuzzle(c);}} style={{fontSize:12,padding:"5px 12px",borderRadius:20,border:`1px solid ${pzFilter===c?"#A855F7":"var(--border)"}`,background:pzFilter===c?"rgba(168,85,247,.12)":"transparent",color:pzFilter===c?"#A855F7":C.t2,cursor:"pointer",fontWeight:pzFilter===c?600:400,fontFamily:"var(--font-sans)",transition:"all .15s"}}>{c}</button>
          ))}
        </div>

        {!pz?(
          <div style={{textAlign:"center",padding:"4rem 1rem"}}>
            <div style={{fontSize:52,marginBottom:16}}>🧩</div>
            <div style={{fontSize:17,fontWeight:700,color:C.t1,marginBottom:8}}>Ready for a challenge?</div>
            <div style={{fontSize:13,color:C.t2,marginBottom:24}}>{PUZZLES.length} tactical puzzles · forks, pins, mates & more</div>
            <button onClick={()=>randomPuzzle()} className="btn-primary" style={{padding:"11px 28px",fontSize:15}}>Start Puzzle →</button>
          </div>
        ):(
          <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
            {/* Board */}
            <div style={{flexShrink:0}}>
              <Board brd={pzBoard} onSq={handlePzClick} selSq={pzSel} legalSqs={pzLegal} lastMove={pzLastMv} noFlip={true} onPieceDragStart={pzDragStart}/>
              <div style={{marginTop:8,display:"flex",gap:7}}>
                <button onClick={()=>randomPuzzle()} className="btn-secondary" style={{flex:1,padding:"7px",fontSize:12}}>↺ Next</button>
                <button onClick={()=>setPzHint(true)} disabled={pzHint} className="btn-secondary" style={{flex:1,padding:"7px",fontSize:12,borderColor:pzHint?C.acc:undefined,color:pzHint?C.alt:undefined,opacity:pzHint?.55:1}}>💡 Hint</button>
              </div>
            </div>

            {/* Info panel */}
            <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:10}}>
              {/* Status card */}
              <div style={{padding:"12px 14px",borderRadius:"var(--r-md)",background:st.bg,border:`1px solid ${st.border}`,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:20,flexShrink:0}}>{st.icon}</span>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:st.color}}>{st.text}</div>
                  <div style={{fontSize:11,color:C.t3,marginTop:2,fontFamily:"var(--font-mono)"}}>{pz?.cat} · {"★".repeat(pz?.diff||1)}{"☆".repeat(3-(pz?.diff||1))}</div>
                </div>
              </div>

              {/* Hint / info */}
              <div className="card" style={{padding:"1rem"}}>
                <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
                  <span style={{fontSize:11,padding:"3px 9px",background:"rgba(168,85,247,.12)",color:"#A855F7",borderRadius:20,fontWeight:600}}>{pz?.cat}</span>
                  <span style={{fontSize:11,color:C.t3,fontFamily:"var(--font-mono)"}}>{Array(pz?.diff||1).fill("★").join("")}{Array(3-(pz?.diff||1)).fill("☆").join("")}</span>
                </div>
                {pzHint
                  ?<p style={{fontSize:13,color:C.t2,lineHeight:1.6,margin:0,paddingLeft:10,borderLeft:`3px solid ${C.amb}`}}>💡 {pz?.hint}</p>
                  :<p style={{fontSize:13,color:C.t3,fontStyle:"italic",margin:0}}>Click Hint when you're stuck!</p>}
                {pzStatus==="wrong"&&<button onClick={()=>loadPuzzle(pz)} className="btn-secondary" style={{marginTop:12,width:"100%",padding:"8px",fontSize:13,borderColor:C.red,color:C.red}}>↺ Reset puzzle</button>}
                {pzStatus==="solved"&&<button onClick={()=>randomPuzzle()} className="btn-primary" style={{marginTop:12,width:"100%",padding:"9px",fontSize:13,background:C.grn}}>Next Puzzle →</button>}
              </div>

              {/* Progress */}
              <div className="card" style={{padding:"10px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.t2,marginBottom:7}}>
                  <span>Puzzles solved</span>
                  <span style={{fontFamily:"var(--font-mono)",color:C.t1,fontWeight:600}}>{solvedPz.size} / {PUZZLES.length}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{width:`${(solvedPz.size/PUZZLES.length)*100}%`,background:"#A855F7"}}/>
                </div>
              </div>

              {/* Tutor */}
              <div className="card" style={{padding:"0.75rem"}}>
                <div style={{fontSize:13,fontWeight:600,color:C.t1,marginBottom:10}}>✨ Ask the Tutor</div>
                <TutorChat height={160} placeholder="Ask about this tactic…"/>
              </div>
            </div>
          </div>
        )}
      </div>
      <BottomNav/>
    </>);
  }

  // ════════════════════════════════════════════════════════════
  //  LEARN
  // ════════════════════════════════════════════════════════════
  const pct=Math.round((doneLessons.size/LESSONS.length)*100);
  const trackAccent={beginner:C.grn,intermediate:C.amb,advanced:C.red}[lTrack]??C.grn;

  return(<>
    <div style={{padding:"0.5rem 0 5rem",fontFamily:"var(--font-sans)"}} className="screen-enter">
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <button onClick={()=>setScreen("menu")} className="btn-ghost" style={{fontSize:12,padding:"6px 11px"}}>← Menu</button>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[["beginner","🌱","Beginner"],["intermediate","⚡","Intermediate"],["advanced","🏆","Advanced"]].map(([id,icon,label])=>(
            <button key={id} onClick={()=>{setLTrack(id);setLIdx(0);}} style={{fontSize:12,padding:"5px 12px",borderRadius:20,
              border:`1px solid ${lTrack===id?({beginner:C.grn,intermediate:C.amb,advanced:C.red}[id]+"55"):C.bd}`,
              background:lTrack===id?`${({beginner:C.grn,intermediate:C.amb,advanced:C.red}[id])}14`:"transparent",
              color:lTrack===id?({beginner:C.grn,intermediate:C.amb,advanced:C.red}[id]):C.t2,cursor:"pointer",
              fontWeight:lTrack===id?600:400,fontFamily:"var(--font-sans)",transition:"all .15s"
            }}>{icon} {label}</button>
          ))}
        </div>
        <div style={{flex:1,display:"flex",alignItems:"center",gap:8,justifyContent:"flex-end"}}>
          <div className="progress-track" style={{width:72}}><div className="progress-fill" style={{width:`${pct}%`}}/></div>
          <span style={{fontSize:11,color:C.acc,fontFamily:"var(--font-mono)",fontWeight:600}}>{pct}%</span>
        </div>
      </div>

      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
        {/* Board */}
        <div style={{flexShrink:0}}>
          <div style={{fontSize:11,color:C.t3,marginBottom:7,letterSpacing:".2px"}}>Interactive — try moving pieces</div>
          <Board brd={lBoard} onSq={handleLClick} selSq={lSel} legalSqs={lLegal} lastMove={null} noFlip={true} onPieceDragStart={learnDragStart}/>
          <button onClick={()=>loadLesson(curLesson)} className="btn-secondary" style={{marginTop:7,width:"100%",padding:"7px 0",fontSize:12}}>↺ Reset position</button>
        </div>

        {/* Content */}
        <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:10}}>
          {/* Nav */}
          <div style={{display:"flex",alignItems:"center",gap:8,background:C.bg3,borderRadius:"var(--r-md)",padding:"5px 8px",border:`1px solid ${C.bd}`}}>
            <button onClick={()=>setLIdx(i=>Math.max(0,i-1))} disabled={lIdx===0} style={{padding:"4px 11px",fontSize:14,background:"transparent",border:"none",cursor:lIdx===0?"default":"pointer",color:lIdx===0?C.t3:C.t1,fontFamily:"var(--font-sans)"}}>←</button>
            <span style={{flex:1,textAlign:"center",fontSize:12,color:C.t3,fontFamily:"var(--font-mono)"}}>{lIdx+1} / {trackLessons.length}</span>
            <button onClick={()=>setLIdx(i=>Math.min(trackLessons.length-1,i+1))} disabled={lIdx>=trackLessons.length-1} style={{padding:"4px 11px",fontSize:14,background:"transparent",border:"none",cursor:lIdx>=trackLessons.length-1?"default":"pointer",color:lIdx>=trackLessons.length-1?C.t3:C.t1,fontFamily:"var(--font-sans)"}}>→</button>
          </div>

          {/* Lesson card */}
          <div className="card" style={{padding:"1.1rem"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:12}}>
              <span style={{fontSize:24,lineHeight:1}}>{curLesson.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:16,fontWeight:700,color:C.t1,marginBottom:4,letterSpacing:"-.2px"}}>{curLesson.title}</div>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <span style={{fontSize:11,padding:"2px 8px",background:`${trackAccent}14`,color:trackAccent,borderRadius:20,fontWeight:600,textTransform:"capitalize"}}>{curLesson.track}</span>
                  <span style={{fontSize:11,color:C.t3,fontFamily:"var(--font-mono)"}}>Lesson {lIdx+1}</span>
                </div>
              </div>
              {doneLessons.has(curLesson.id)&&<span style={{fontSize:16,color:C.grn,flexShrink:0}}>✓</span>}
            </div>
            <p style={{fontSize:13,lineHeight:1.72,color:C.t1,margin:"0 0 12px"}}>{curLesson.body}</p>
            <div style={{fontSize:12,color:C.t2,background:C.bg2,padding:"9px 12px",borderRadius:"var(--r-md)",borderLeft:`3px solid ${trackAccent}`,lineHeight:1.6,border:`1px solid ${C.bd}`}}>
              💡 {curLesson.tip}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{display:"flex",gap:8}}>
            <button onClick={markDone} style={{flex:1,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",borderRadius:"var(--r-md)",border:`1px solid ${doneLessons.has(curLesson.id)?C.bd:C.grn}`,background:doneLessons.has(curLesson.id)?C.bg3:C.gdm,color:doneLessons.has(curLesson.id)?C.t2:C.grn,fontFamily:"var(--font-sans)",transition:"all .15s"}}>
              {doneLessons.has(curLesson.id)?"✓ Completed":"Mark Complete →"}
            </button>
            <button onClick={()=>{setGameMode("ai");setDiff(lTrack==="beginner"?0:lTrack==="intermediate"?2:3);startGame();}} className="btn-primary" style={{flex:1,padding:"10px",fontSize:13}}>Practice →</button>
          </div>

          {/* Keyboard shortcuts */}
          <div style={{display:"flex",gap:"5px 10px",flexWrap:"wrap"}}>
            {[["←→","Navigate"],["R","Reset"],["Esc","Menu"]].map(([k,label])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:4}}>
                <span className="kbd">{k}</span><span style={{fontSize:11,color:C.t3}}>{label}</span>
              </div>
            ))}
          </div>

          {/* Lesson list */}
          <div className="card" style={{padding:"0.75rem"}}>
            <div style={{fontSize:11,color:C.t3,marginBottom:8,textTransform:"uppercase",letterSpacing:".04em",fontWeight:600}}>All {lTrack} lessons</div>
            <div style={{display:"flex",flexDirection:"column",gap:1,maxHeight:180,overflowY:"auto"}}>
              {trackLessons.map((l,i)=>(
                <button key={l.id} onClick={()=>setLIdx(i)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:"var(--r-sm)",background:i===lIdx?C.bg3:"transparent",border:`1px solid ${i===lIdx?C.bds:"transparent"}`,cursor:"pointer",textAlign:"left",width:"100%",fontFamily:"var(--font-sans)",transition:"all .12s"}}>
                  <span style={{fontSize:12,width:17,flexShrink:0}}>{l.icon}</span>
                  <span style={{fontSize:13,color:i===lIdx?C.t1:C.t2,fontWeight:i===lIdx?500:400,flex:1}}>{l.title}</span>
                  {doneLessons.has(l.id)?<span style={{fontSize:12,color:C.grn}}>✓</span>:i===lIdx?<span style={{width:6,height:6,borderRadius:"50%",background:trackAccent,display:"inline-block",flexShrink:0}}/>:null}
                </button>
              ))}
            </div>
          </div>

          {/* Tutor */}
          <div className="card" style={{padding:"0.75rem"}}>
            <div style={{fontSize:13,fontWeight:600,color:C.t1,marginBottom:10}}>✨ Ask the AI Tutor</div>
            <TutorChat height={180} placeholder={`Ask about "${curLesson?.title}"…`}/>
          </div>
        </div>
      </div>
    </div>
    <BottomNav/>
  </>);
}
