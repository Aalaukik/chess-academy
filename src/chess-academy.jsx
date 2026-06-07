import { useState, useEffect, useRef } from "react";
import { useSupabaseProgress } from "./useSupabaseProgress";
import ProfileScreen from "./ProfileScreen";
import OnlineScreen from "./OnlineScreen";
import OnlinePlayScreen from "./OnlinePlayScreen";

// ════════════════════════════════════════════════════════════════
//  1. CHESS AI
// ════════════════════════════════════════════════════════════════
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
  if(chess.isCheckmate()) return chess.turn()==="w"?-99999:99999;
  if(chess.isDraw()) return 0;
  let s=0;
  chess.board().forEach((row,r)=>row.forEach((p,c)=>{
    if(!p) return;
    const tr=p.color==="w"?7-r:r;
    s+=(PV[p.type]+(PST[p.type]?.[tr]?.[c]||0))*(p.color==="w"?1:-1);
  }));
  return s;
}
function mm(chess,d,a,b,max){
  if(d===0||chess.isGameOver()) return evalPos(chess);
  let best=max?-Infinity:Infinity;
  for(const m of chess.moves()){
    chess.move(m);const v=mm(chess,d-1,a,b,!max);chess.undo();
    if(max){best=Math.max(best,v);a=Math.max(a,best);}
    else{best=Math.min(best,v);b=Math.min(b,best);}
    if(b<=a) break;
  }
  return best;
}
const DIFFS=[
  {depth:1,rand:0.90,label:"Beginner",    desc:"Mostly random moves",    color:"#4CAF82"},
  {depth:1,rand:0.42,label:"Casual",      desc:"Basic piece awareness",  color:"#6BB5F0"},
  {depth:2,rand:0.14,label:"Intermediate",desc:"Plans 2–3 moves ahead",  color:"#C8A84B"},
  {depth:3,rand:0.04,label:"Advanced",    desc:"Strong tactical play",   color:"#E08C30"},
  {depth:4,rand:0,   label:"Master",      desc:"Full engine strength",   color:"#E05555"},
];
function getAIMove(chess,di){
  const{depth,rand}=DIFFS[di];
  const moves=chess.moves();
  if(!moves.length) return null;
  if(Math.random()<rand) return moves[Math.floor(Math.random()*moves.length)];
  const isMax=chess.turn()==="w";
  let best=null,bv=isMax?-Infinity:Infinity;
  for(const m of moves){
    chess.move(m);const v=mm(chess,depth-1,-Infinity,Infinity,!isMax);chess.undo();
    if(isMax?v>bv:v<bv){bv=v;best=m;}
  }
  return best||moves[0];
}

// ════════════════════════════════════════════════════════════════
//  2. SOUND
// ════════════════════════════════════════════════════════════════
function mkSound(){
  let ctx=null;
  const gc=()=>{if(!ctx)ctx=new(window.AudioContext||window.webkitAudioContext)();return ctx;};
  function tone(freq,dur,type="sine",vol=0.16){
    try{const c=gc(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);g.gain.setValueAtTime(vol,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);o.start(c.currentTime);o.stop(c.currentTime+dur);}catch{}
  }
  return{
    move:()=>tone(440,0.08,"square",0.10),
    capture:()=>{tone(280,0.14,"sawtooth",0.14);setTimeout(()=>tone(200,0.12,"square",0.08),60);},
    check:()=>{tone(600,0.10,"square",0.20);setTimeout(()=>tone(500,0.12,"square",0.14),90);},
    castle:()=>{tone(380,0.10,"sine",0.12);setTimeout(()=>tone(480,0.10,"sine",0.12),100);},
    over:()=>[440,392,349,330].forEach((f,i)=>setTimeout(()=>tone(f,0.22,"sine",0.18),i*160)),
    win:()=>[523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.22,"sine",0.18),i*140)),
    pzOk:()=>[523,659,784].forEach((f,i)=>setTimeout(()=>tone(f,0.18,"sine",0.16),i*120)),
    pzFail:()=>tone(200,0.28,"sawtooth",0.22),
  };
}
const SND=mkSound();

// ════════════════════════════════════════════════════════════════
//  3. DATA
// ════════════════════════════════════════════════════════════════
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
function detectOpening(hist){const mv=hist.map(m=>m.san).join(" ");let match="";for(const[k,n]of Object.entries(OPENINGS))if(mv.startsWith(k)&&k.length>match.length)match=k;return match?OPENINGS[match]:(hist.length>0?"Custom Opening":"");}
const LESSONS=[
  {id:0,track:"beginner",icon:"♟",title:"The Chessboard",fen:"4k3/8/8/8/8/8/8/4K3 w - - 0 1",body:"A chessboard has 64 squares in an 8×8 grid. Files (columns) are labeled a–h left to right. Ranks (rows) are numbered 1–8 from White's side upward. The golden rule: 'light on right' — the bottom-right corner must always be a light square.",tip:"Squares are named by file + rank, e.g. e4, d5, g7. Every square has a unique name."},
  {id:1,track:"beginner",icon:"♙",title:"Pawn Power",fen:"4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1",body:"Pawns march forward — one square at a time, or two squares from their starting rank. They capture diagonally forward. A pawn reaching the 8th rank promotes to any piece (almost always a queen!). Pawns cannot retreat, so every pawn move is permanent.",tip:"En passant: if an enemy pawn moves two squares past yours on an adjacent file, you can capture it as if it moved only one square — but only immediately!"},
  {id:2,track:"beginner",icon:"♘",title:"The Knight's Dance",fen:"4k3/8/8/8/4N3/8/8/4K3 w - - 0 1",body:"Knights move in an L-shape — two squares in one direction, one perpendicular. They're the only pieces that jump over others. This makes knights especially deadly in closed positions where other pieces are blocked.",tip:"A knight in the center controls up to 8 squares. On the rim it controls only 2–4. 'A knight on the rim is dim!'"},
  {id:3,track:"beginner",icon:"♗",title:"Bishop Diagonals",fen:"4k3/8/8/8/4B3/8/8/4K3 w - - 0 1",body:"Bishops slide diagonally any number of squares and stay forever on their starting color. You have one light-squared and one dark-squared bishop. They shine in open positions with long, unobstructed diagonals.",tip:"The bishop pair — both bishops working together — is a major strategic advantage, controlling squares of both colors."},
  {id:4,track:"beginner",icon:"♖",title:"Rooks Rule Open Files",fen:"4k3/8/8/8/4R3/8/8/4K3 w - - 0 1",body:"Rooks slide horizontally or vertically any number of squares. They're most powerful on open files (no pawns blocking) and the 7th rank, where they attack the opponent's unadvanced pawns from behind.",tip:"Place rooks on open files early. Connecting your rooks (castling and clearing the back rank) is a key opening goal."},
  {id:5,track:"beginner",icon:"♕",title:"Queen Supremacy",fen:"4k3/8/8/8/4Q3/8/8/4K3 w - - 0 1",body:"The queen combines the rook and bishop — she moves any number of squares in any direction. Worth roughly 9 pawns, she's by far the most powerful piece. Losing her without compensation almost always loses the game.",tip:"Don't bring the queen out too early — she can be chased by enemy pieces and you'll lose precious tempo."},
  {id:6,track:"beginner",icon:"♔",title:"Check, Checkmate & Stalemate",fen:"4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1",body:"When the king is under direct attack it's 'check' — you must escape by moving the king, blocking the attack, or capturing the attacker. If no escape exists: checkmate — game over! Stalemate (no legal moves, not in check) is a draw.",tip:"Three ways to escape check: (1) move the king, (2) block the attacker, (3) capture the attacker."},
  {id:7,track:"beginner",icon:"♙",title:"Three Opening Rules",fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",body:"Three golden principles: (1) Control the center — play 1.e4 or 1.d4. (2) Develop all pieces — get knights and bishops to active squares quickly. (3) Castle early — protect your king behind pawns.",tip:"Don't move the same piece twice in the opening unless absolutely necessary — every move should develop a new piece."},
  {id:8,track:"intermediate",icon:"♙",title:"Center Control",fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",body:"The four central squares — d4, e4, d5, e5 — are the most important battlefield. Pieces controlling the center dominate more of the board and restrict the opponent. Fight for the center from move one with pawns and pieces.",tip:"A pawn on e4 controls d5 and f5. A piece in the center has more scope than one on the edge."},
  {id:9,track:"intermediate",icon:"♞",title:"Tactics: The Fork",fen:"r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/5N2/PPPP1PPP/RNBQKBNR w KQkq - 2 3",body:"A fork attacks two or more enemy pieces simultaneously with one move — the opponent can only save one. Knights are the best forking pieces because of their unpredictable L-shape. Always scan for fork opportunities on every move!",tip:"Look for undefended pieces as fork targets. An undefended knight or bishop next to an undefended rook or queen is a fork waiting to happen."},
  {id:10,track:"intermediate",icon:"♗",title:"Tactics: The Pin",fen:"rnb1kbnr/pp1ppppp/8/q1p5/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 1 3",body:"A pin prevents a piece from moving because moving it would expose a more valuable piece behind it. An 'absolute pin' — against the king — means the piece literally cannot legally move.",tip:"A pinned piece cannot defend other pieces! Exploit this by attacking other targets while the pin keeps the defender stuck."},
  {id:11,track:"intermediate",icon:"♔",title:"Castling: King Safety",fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5",body:"Castling moves the king two squares toward a rook — the rook jumps over to the other side. Castle kingside (O-O) or queenside (O-O-O). Castle early to protect your king!",tip:"After castling, avoid pushing h3/g3 (or h6/g6) without good reason — those moves weaken your king's shelter."},
  {id:12,track:"intermediate",icon:"♙",title:"Discovered Attacks",fen:"rnbqk2r/ppp2ppp/3p1n2/4p3/1bB1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5",body:"A discovered attack happens when you move one piece to reveal an attack from a piece behind it. The moved piece can simultaneously attack a different target. These are extremely powerful because the opponent cannot block both threats at once.",tip:"Scan your pieces for 'hidden attackers' — pieces that would attack a valuable target if another piece moved out of the way."},
  {id:13,track:"advanced",icon:"♙",title:"Pawn Structure",fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",body:"Pawns are permanent — they cannot retreat. Weak pawn structures haunt you all game. Doubled pawns reduce rook mobility. Isolated pawns become permanent targets. A passed pawn (nothing blocking it from promotion) is a powerful long-term asset.",tip:"Think carefully before every pawn move — that decision can never be undone!"},
  {id:14,track:"advanced",icon:"♖",title:"Tactics: The Skewer",fen:"6k1/6pp/8/1b6/8/8/6PP/R5K1 w - - 0 1",body:"A skewer is the reverse of a pin — you attack a valuable piece that must move, exposing a less valuable piece behind it, which you then capture. Rooks, bishops, and queens can execute skewers.",tip:"After forcing the valuable piece to move, capture what was behind it. The 'prize' in a skewer is always the second piece."},
  {id:15,track:"advanced",icon:"♔",title:"King & Pawn Endgames",fen:"8/8/3k4/8/8/3K4/4P3/8 w - - 0 1",body:"In the endgame, the king becomes an active fighting piece — march it toward the action! Key concepts: opposition, the rule of the square, and escorting pawns to promotion.",tip:"In king-and-pawn endings, getting your king in front of your own pawn (with the opposition) is usually the winning technique."},
  {id:16,track:"advanced",icon:"♗",title:"Opening Systems",fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",body:"Rather than memorizing every variation, master the principles behind openings: develop all pieces to active squares, fight for the center, castle early, then connect your rooks. Study 1–2 openings deeply with understanding.",tip:"Always ask 'why?' for every opening move. Understanding the plan behind each move is far more powerful than memorizing sequences."},
];
const PUZZLES=[
  {id:"p1",cat:"Mate in 1",diff:1,fen:"r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4",sol:["Qxf7#"],hint:"Your queen and bishop are perfectly lined up at f7 — can you deliver checkmate?"},
  {id:"p2",cat:"Mate in 1",diff:1,fen:"6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",sol:["Re8#"],hint:"The rook has a clear path to the back rank — deliver checkmate!"},
  {id:"p3",cat:"Mate in 1",diff:1,fen:"r5k1/p4ppp/8/8/8/8/PP3PPP/4R1K1 w - - 0 1",sol:["Re8#"],hint:"Aim for the 8th rank — the king has nowhere to go!"},
  {id:"p4",cat:"Mate in 1",diff:1,fen:"5k2/8/5K2/8/8/8/8/7R w - - 0 1",sol:["Rh8#"],hint:"Use your rook — the king is trapped on the edge."},
  {id:"p5",cat:"Mate in 2",diff:2,fen:"r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 4",sol:["Bxf7+","Ke7","Nd5#"],hint:"The bishop capture on f7 gives check. What follows forces mate in two?"},
  {id:"p6",cat:"Mate in 2",diff:2,fen:"6k1/pp3ppp/8/8/2r5/4R1P1/PP3P1P/6K1 w - - 0 1",sol:["Re8+","Rxe8","Rxe8#"],hint:"Force the king to the back rank with a rook check."},
  {id:"p7",cat:"Fork",diff:2,fen:"r1bqkb1r/ppp2ppp/2np1n2/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5",sol:["Nd5"],hint:"Your knight on f3 can leap to a powerful central square, attacking two pieces at once!"},
  {id:"p8",cat:"Fork",diff:2,fen:"4k3/8/8/3n4/3N4/8/8/4K3 w - - 0 1",sol:["Nc6+"],hint:"Move the knight to fork the king and the enemy knight simultaneously."},
  {id:"p9",cat:"Fork",diff:3,fen:"r2qkb1r/pp2pppp/2np1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 7",sol:["Nxc6"],hint:"The knight capture wins material by attacking multiple pieces."},
  {id:"p10",cat:"Pin",diff:2,fen:"r2qkb1r/ppp2ppp/2np1n2/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 6",sol:["Bxf7+"],hint:"The bishop on c4 eyes f7. A capture here creates a fork-pin between king and queen!"},
  {id:"p11",cat:"Pin",diff:3,fen:"rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/2N5/PPPP1PPP/R1BQK1NR w KQkq - 4 4",sol:["d3"],hint:"Solidify the center and set up a pin on the f6-knight through the bishop diagonal."},
  {id:"p12",cat:"Skewer",diff:3,fen:"6k1/6pp/8/1b6/8/8/6PP/R5K1 w - - 0 1",sol:["Ra5"],hint:"Attack the bishop — when it moves to safety, look at what's behind it!"},
  {id:"p13",cat:"Skewer",diff:3,fen:"8/8/1k6/8/1R6/8/8/6K1 w - - 0 1",sol:["Rb8+"],hint:"Give check with the rook — the king must move, revealing the piece behind."},
  {id:"p14",cat:"Back rank",diff:2,fen:"6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",sol:["Rd8#"],hint:"The black king has no flight squares! The d-file is your highway to checkmate."},
  {id:"p15",cat:"Back rank",diff:2,fen:"r5k1/5ppp/8/1Q6/8/8/5PPP/6K1 w - - 0 1",sol:["Qb8+","Rxb8","?"],hint:"Force the rook onto the 8th rank with a queen sacrifice — then mop up."},
  {id:"p16",cat:"Discovery",diff:3,fen:"r1bqk2r/ppp2ppp/3p1n2/4p3/1bB1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5",sol:["Nd5"],hint:"Move the knight to discover an attack from the bishop behind it!"},
  {id:"p17",cat:"Discovery",diff:3,fen:"rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4",sol:["Qa4+"],hint:"The queen check discovers an attack — your opponent must deal with two threats."},
  {id:"p18",cat:"Endgame",diff:3,fen:"8/8/3k4/8/8/3K4/4P3/8 w - - 0 1",sol:["e4"],hint:"Advance the pawn toward promotion. With correct king play this should win."},
  {id:"p19",cat:"Endgame",diff:3,fen:"8/8/8/3k4/8/3K4/3P4/8 w - - 0 1",sol:["Kc4"],hint:"Use the opposition — march your king in front of the pawn."},
  {id:"p20",cat:"Endgame",diff:2,fen:"7k/8/6K1/6P1/8/8/8/8 w - - 0 1",sol:["Kf7"],hint:"Position your king in front of the pawn to escort it to promotion."},
];
const SQ=46;

// ════════════════════════════════════════════════════════════════
//  4. MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export default function ChessAcademy({user=null,onSignOut}){
  const ChessLib=useRef(null);
  const [loaded,setLoaded]=useState(false);
  const [loadErr,setLoadErr]=useState(false);
  const preMoveEval=useRef(0);
  const [moveQualities,setMoveQualities]=useState([]);
  const [lastBadge,setLastBadge]=useState(null);
  const [board,setBoard]=useState([]);
  const [sel,setSel]=useState(null);
  const [legal,setLegal]=useState([]);
  const [lastMv,setLastMv]=useState(null);
  const [gStatus,setGStatus]=useState("idle");
  const [winner,setWinner]=useState(null);
  const [hist,setHist]=useState([]);
  const [inChk,setInChk]=useState(false);
  const [evalBar,setEvalBar]=useState(50);
  const [opening,setOpening]=useState("");
  const [promoDialog,setPromoDialog]=useState(null);
  const [screen,setScreen]=useState("menu");
  const [diff,setDiff]=useState(1);
  const [pCol,setPCol]=useState("w");
  const [theme,setTheme]=useState("walnut");
  const [flipped,setFlipped]=useState(false);
  const [aiThink,setAiThink]=useState(false);
  const [hintSq,setHintSq]=useState(null);
  const [panelTab,setPanelTab]=useState("moves");
  const [timeW,setTimeW]=useState(600);
  const [timeB,setTimeB]=useState(600);
  const [timerOn,setTimerOn]=useState(false);
  const [useTimer,setUseTimer]=useState(false);
  const [timeCtrl,setTimeCtrl]=useState(600);
  const timerRef=useRef(null);
  const [soundOn,setSoundOn]=useState(true);
  const [showCoords,setShowCoords]=useState(true);
  const [animSpd,setAnimSpd]=useState("normal");
  const [doneLessons,setDoneLessons]=useState(new Set());
  const [solvedPz,setSolvedPz]=useState(new Set());
  const [streak,setStreak]=useState(0);
  const [stats,setStats]=useState({w:0,l:0,d:0});
  const [elo,setElo]=useState(1200);
  const [gameMode,setGameMode]=useState("ai");
  const [p2pNames,setP2pNames]=useState({w:"White",b:"Black"});
  const [p2pFlipOnTurn,setP2pFlipOnTurn]=useState(true);
  const [onlineGameData,setOnlineGameData]=useState(null);
  const [lTrack,setLTrack]=useState("beginner");
  const [lIdx,setLIdx]=useState(0);
  const lgRef=useRef(null);
  const [lBoard,setLBoard]=useState([]);
  const [lSel,setLSel]=useState(null);
  const [lLegal,setLLegal]=useState([]);
  const [pz,setPz]=useState(null);
  const pzRef=useRef(null);
  const [pzBoard,setPzBoard]=useState([]);
  const [pzSel,setPzSel]=useState(null);
  const [pzLegal,setPzLegal]=useState([]);
  const [pzLastMv,setPzLastMv]=useState(null);
  const [pzStatus,setPzStatus]=useState("idle");
  const [pzMvIdx,setPzMvIdx]=useState(0);
  const [pzHint,setPzHint]=useState(false);
  const [pzFilter,setPzFilter]=useState("All");
  const [msgs,setMsgs]=useState([]);
  const [tutIn,setTutIn]=useState("");
  const [tutBusy,setTutBusy]=useState(false);
  const tutEndRef=useRef(null);
  const moveListRef=useRef(null);
  const gRef=useRef(null);
  const dragRef=useRef(null);
  const dragJustMoved=useRef(false);
  const dragHandlersRef=useRef({});
  const [ghostState,setGhostState]=useState(null);
  const [shareModal,setShareModal]=useState(false);
  const dlRef=useRef(doneLessons);const spRef=useRef(solvedPz);const skRef=useRef(streak);const stRef=useRef(stats);const elRef=useRef(elo);
  useEffect(()=>{dlRef.current=doneLessons;},[doneLessons]);
  useEffect(()=>{spRef.current=solvedPz;},[solvedPz]);
  useEffect(()=>{skRef.current=streak;},[streak]);
  useEffect(()=>{stRef.current=stats;},[stats]);
  useEffect(()=>{elRef.current=elo;},[elo]);

  useEffect(()=>{import("https://esm.sh/chess.js@1.1.0").then(m=>{ChessLib.current=m.Chess;setLoaded(true);}).catch(()=>setLoadErr(true));},[]);

  useEffect(()=>{
    if(user) return;
    (async()=>{try{const r=await window.storage?.get("chess_v2");if(r?.value){const p=JSON.parse(r.value);if(p.done)setDoneLessons(new Set(p.done));if(p.solved)setSolvedPz(new Set(p.solved));if(p.streak)setStreak(p.streak);if(p.stats)setStats(p.stats);if(p.elo!=null)setElo(p.elo);}}catch{}})();
  },[]);

  async function saveProgress(dl,sp,sk,st,el){
    if(user) return;
    const _dl=dl??dlRef.current,_sp=sp??spRef.current,_sk=sk??skRef.current,_st=st??stRef.current,_el=el??elRef.current;
    try{await window.storage?.set("chess_v2",JSON.stringify({done:[..._dl],solved:[..._sp],streak:_sk,stats:_st,elo:_el}));}catch{}
  }

  const gameStartTime=useRef(null);
  const{saveGame}=useSupabaseProgress({user,setDoneLessons,setSolvedPz,setStreak,setStats,setElo,doneLessons,solvedPz,streak,stats,elo});
  function play(k){if(soundOn)SND[k]?.();}
  const DIFF_ELO=[800,1000,1200,1600,2000];
  function calcNewElo(playerElo,opponentElo,result){const K=32;const expected=1/(1+Math.pow(10,(opponentElo-playerElo)/400));return Math.round(playerElo+K*(result-expected));}

  function syncGame(g=gRef.current){
    if(!g) return;
    setBoard([...g.board()]);
    const h=g.history({verbose:true});
    setHist([...h]);setInChk(g.inCheck());setOpening(detectOpening(h));
    const raw=Math.max(-15,Math.min(15,evalPos(g)/100));
    setEvalBar(Math.round(((raw+15)/30)*100));
    if(gameMode==="p2p"&&p2pFlipOnTurn&&!g.isGameOver()) setFlipped(g.turn()==="b");
    if(g.isCheckmate()){setGStatus("checkmate");setWinner(g.turn()==="w"?"Black":"White");setTimerOn(false);}
    else if(g.isStalemate()){setGStatus("stalemate");setTimerOn(false);}
    else if(g.isDraw()){setGStatus("draw");setTimerOn(false);}
    else setGStatus("playing");
  }

  function classifyMove(evalBefore,evalAfter,playerColor){
    const sign=playerColor==="w"?1:-1;
    const delta=(evalAfter-evalBefore)*sign;
    if(delta>=0)    return{label:"Best",       sym:"!",   color:"#4CAF82",bg:"rgba(76,175,130,.15)"};
    if(delta>=-15)  return{label:"Good",       sym:"✓",   color:"#4CAF82",bg:"rgba(76,175,130,.12)"};
    if(delta>=-50)  return{label:"Inaccuracy", sym:"?",   color:"#C8A84B",bg:"rgba(200,168,75,.15)"};
    if(delta>=-150) return{label:"Mistake",    sym:"??",  color:"#E08C30",bg:"rgba(224,140,48,.15)"};
    return              {label:"Blunder",      sym:"???", color:"#E05555",bg:"rgba(224,85,85,.15)"};
  }

  const flippedRef=useRef(flipped);
  useEffect(()=>{flippedRef.current=flipped;},[flipped]);

  function getSqFromPos(clientX,clientY,rect,fl){
    const coordOff=showCoords?18:0,borderOff=2;
    const relX=clientX-rect.left-borderOff-coordOff,relY=clientY-rect.top-borderOff;
    const ci=Math.floor(relX/SQ),ri=Math.floor(relY/SQ);
    if(ci<0||ci>7||ri<0||ri>7) return null;
    return `${String.fromCharCode(97+(fl?7-ci:ci))}${8-(fl?7-ri:ri)}`;
  }

  function startGenericDrag(e,sq,piece,dropHandler,isFlipped=false){
    if(e.touches) e.preventDefault();
    const clientX=e.touches?e.touches[0].clientX:e.clientX,clientY=e.touches?e.touches[0].clientY:e.clientY;
    dragRef.current={from:sq,startX:clientX,startY:clientY,moved:false,dropHandler,isFlipped};
    setGhostState({x:clientX,y:clientY,pk:`${piece.color}${piece.type.toUpperCase()}`,isW:piece.color==="w"});
  }

  function playDragStart(e,sq){
    const g=gRef.current;
    if(!g||gStatus!=="playing"||aiThink||promoDialog) return;
    const piece=g.get(sq),activeTurn=g.turn();
    const canDrag=gameMode==="p2p"?piece&&piece.color===activeTurn:piece&&piece.color===pCol;
    if(!canDrag) return;
    setSel(sq);setLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));
    const dropHandler=(from,to)=>{
      const g2=gRef.current;
      if(!g2||gStatus!=="playing"||aiThink){setSel(null);setLegal([]);return;}
      const turn=g2.turn();
      if(gameMode==="ai"&&turn!==pCol){setSel(null);setLegal([]);return;}
      const lm=g2.moves({square:from,verbose:true}).map(m=>m.to);
      if(!lm.includes(to)){setSel(null);setLegal([]);return;}
      const p=g2.get(from);
      const isPromo=p?.type==="p"&&((turn==="w"&&to[1]==="8")||(turn==="b"&&to[1]==="1"));
      if(isPromo){preMoveEval.current=evalPos(g2);setPromoDialog({from,to});setSel(null);setLegal([]);return;}
      const evalBefore=evalPos(g2);
      const r=g2.move({from,to,promotion:"q"});
      if(r){
        const badge=classifyMove(evalBefore,evalPos(g2),turn);
        setMoveQualities(q=>[...q,badge]);setLastBadge(badge);setTimeout(()=>setLastBadge(null),2200);
        setLastMv({from:r.from,to:r.to});setSel(null);setLegal([]);setHintSq(null);
        if(r.captured)play("capture");else if(r.flags.includes("k")||r.flags.includes("q"))play("castle");else play("move");
        if(g2.inCheck())play("check");
        syncGame(g2);
        if(gameMode==="ai"){const aiC=pCol==="w"?"b":"w";if(!g2.isGameOver()&&g2.turn()===aiC)setTimeout(()=>runAI(g2),300);}
      }else{setSel(null);setLegal([]);}
    };
    startGenericDrag(e,sq,piece,dropHandler,flippedRef.current);
  }

  function learnDragStart(e,sq){
    const g=lgRef.current;if(!g)return;
    const piece=g.get(sq);if(!piece)return;
    setLSel(sq);setLLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));
    startGenericDrag(e,sq,piece,(from,to)=>{
      const g2=lgRef.current;if(!g2)return;
      if(!g2.moves({square:from,verbose:true}).map(m=>m.to).includes(to)){setLSel(null);setLLegal([]);return;}
      const r=g2.move({from,to,promotion:"q"});
      if(r){setLBoard([...g2.board()]);setLSel(null);setLLegal([]);}else{setLSel(null);setLLegal([]);}
    },false);
  }

  function pzDragStart(e,sq){
    const g=pzRef.current;
    if(!g||!pz||pzStatus==="solved"||pzStatus==="wrong")return;
    const piece=g.get(sq);if(!piece||piece.color!==g.turn())return;
    setPzSel(sq);setPzLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));
    startGenericDrag(e,sq,piece,(from,to)=>{
      const g2=pzRef.current;if(!g2||!pz)return;
      if(!g2.moves({square:from,verbose:true}).map(m=>m.to).includes(to)){setPzSel(null);setPzLegal([]);return;}
      const expected=pz.sol[pzMvIdx];
      const r=g2.move({from,to,promotion:"q"});
      if(!r){setPzSel(null);setPzLegal([]);return;}
      setPzLastMv({from:r.from,to:r.to});setPzBoard([...g2.board()]);setPzSel(null);setPzLegal([]);
      if(r.san===expected||r.from+r.to===expected||r.from+r.to+(r.promotion||"")===expected){
        const next=pzMvIdx+1;
        if(next>=pz.sol.length){setPzStatus("solved");play("pzOk");const sk=streak+1;setStreak(sk);const ns=new Set(solvedPz);ns.add(pz.id);setSolvedPz(ns);saveProgress(undefined,ns,sk,undefined);}
        else{setPzMvIdx(next);setPzStatus("correct");play("move");if(pz.sol[next])setTimeout(()=>{const opp=g2.move(pz.sol[next]);if(opp){setPzLastMv({from:opp.from,to:opp.to});setPzBoard([...g2.board()]);setPzMvIdx(next+1);setPzStatus("idle");}},600);}
      }else{g2.undo();setPzBoard([...g2.board()]);setPzLastMv(null);setPzStatus("wrong");play("pzFail");const sk=0;setStreak(sk);saveProgress(undefined,undefined,sk,undefined);}
    },false);
  }

  function onDragMove(e){
    if(!dragRef.current)return;if(e.cancelable)e.preventDefault();
    const clientX=e.touches?e.touches[0].clientX:e.clientX,clientY=e.touches?e.touches[0].clientY:e.clientY;
    if(!dragRef.current.moved){const dx=clientX-dragRef.current.startX,dy=clientY-dragRef.current.startY;if(Math.abs(dx)>5||Math.abs(dy)>5)dragRef.current.moved=true;}
    setGhostState(s=>s?{...s,x:clientX,y:clientY}:null);
  }

  function onDragEnd(e){
    if(!dragRef.current)return;
    const{from,moved,dropHandler,isFlipped}=dragRef.current;
    dragRef.current=null;setGhostState(null);
    if(!moved)return;
    dragJustMoved.current=true;setTimeout(()=>{dragJustMoved.current=false;},150);
    const clientX=e.changedTouches?e.changedTouches[0].clientX:e.clientX,clientY=e.changedTouches?e.changedTouches[0].clientY:e.clientY;
    const boardEl=document.querySelector('[data-chess-board="1"]');
    if(!boardEl){setSel(null);setLegal([]);return;}
    const to=getSqFromPos(clientX,clientY,boardEl.getBoundingClientRect(),isFlipped);
    if(!to||to===from){setSel(null);setLegal([]);return;}
    dropHandler?.(from,to);
  }

  function computeAccuracy(qualities){if(!qualities.length)return null;const W={Best:100,Good:90,Inaccuracy:70,Mistake:40,Blunder:0};return Math.round(qualities.reduce((s,q)=>s+(W[q.label]??50),0)/qualities.length);}

  function generateShareText(){
    const acc=computeAccuracy(moveQualities);
    const resultLine=gStatus==="checkmate"?(winner===(pCol==="w"?"White":"Black")?"🏆 Victory!":"💀 Defeat"):gStatus==="draw"||gStatus==="stalemate"?"🤝 Draw":gStatus==="resign"?"🏳 Resigned":"⏰ Time out";
    return["♟ Chess Academy","",`${resultLine} vs ${DIFFS[diff].label}`,acc!=null?`Accuracy: ${acc}/100`:"",`${hist.length} moves${opening?" · "+opening:""}`,``,`✓ ${moveQualities.filter(m=>m.label==="Best"||m.label==="Good").length} best/good   ? ${moveQualities.filter(m=>m.label==="Inaccuracy").length} inaccurate   ?? ${moveQualities.filter(m=>m.label==="Mistake").length} mistakes   ??? ${moveQualities.filter(m=>m.label==="Blunder").length} blunders`,"","https://chess-academy.vercel.app"].join("\n");
  }

  dragHandlersRef.current={onDragMove,onDragEnd};
  useEffect(()=>{
    const mm=(e)=>dragHandlersRef.current.onDragMove(e),mu=(e)=>dragHandlersRef.current.onDragEnd(e);
    window.addEventListener("mousemove",mm);window.addEventListener("mouseup",mu);
    window.addEventListener("touchmove",mm,{passive:false});window.addEventListener("touchend",mu);
    return()=>{window.removeEventListener("mousemove",mm);window.removeEventListener("mouseup",mu);window.removeEventListener("touchmove",mm);window.removeEventListener("touchend",mu);};
  },[]);

  function startGame(){
    if(!loaded)return;
    clearInterval(timerRef.current);
    const g=new ChessLib.current();gRef.current=g;gameStartTime.current=Date.now();
    setBoard(g.board());setGStatus("playing");setWinner(null);setHist([]);setSel(null);setLegal([]);
    setLastMv(null);setInChk(false);setEvalBar(50);setHintSq(null);setAiThink(false);setOpening("");
    setMoveQualities([]);setLastBadge(null);preMoveEval.current=0;setShareModal(false);
    setTimeW(timeCtrl);setTimeB(timeCtrl);
    if(gameMode==="p2p")setFlipped(false);else setFlipped(pCol==="b");
    setMsgs([{role:"assistant",content:gameMode==="p2p"?`Pass-and-play started! ${p2pNames.w} moves first. Good luck! ♟`:`Let's play! I'm set to ${DIFFS[diff].label} difficulty. Ask me anything!`}]);
    setPanelTab("moves");setScreen("play");
    if(useTimer)setTimerOn(true);
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
    const g=gRef.current;
    if(dragJustMoved.current){dragJustMoved.current=false;return;}
    if(!g||gStatus!=="playing"||aiThink||promoDialog)return;
    const activeTurn=g.turn();
    if(gameMode==="ai"&&activeTurn!==pCol)return;
    if(sel&&legal.includes(sq)){
      const piece=g.get(sel);
      const isPromo=piece?.type==="p"&&((activeTurn==="w"&&sq[1]==="8")||(activeTurn==="b"&&sq[1]==="1"));
      if(isPromo){preMoveEval.current=evalPos(g);setPromoDialog({from:sel,to:sq});return;}
      const evalBefore=evalPos(g);const r=g.move({from:sel,to:sq,promotion:"q"});
      if(r){
        const badge=classifyMove(evalBefore,evalPos(g),activeTurn);
        setMoveQualities(q=>[...q,badge]);setLastBadge(badge);setTimeout(()=>setLastBadge(null),2200);
        setLastMv({from:r.from,to:r.to});setSel(null);setLegal([]);setHintSq(null);
        if(r.captured)play("capture");else if(r.flags.includes("k")||r.flags.includes("q"))play("castle");else play("move");
        if(g.inCheck())play("check");syncGame(g);
        if(gameMode==="ai"){const aiC=pCol==="w"?"b":"w";if(!g.isGameOver()&&g.turn()===aiC)setTimeout(()=>runAI(g),300);}
      }
      return;
    }
    const piece=g.get(sq);
    const canSelect=gameMode==="p2p"?piece&&piece.color===activeTurn:piece&&piece.color===pCol;
    if(canSelect){setSel(sq);setLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));}else{setSel(null);setLegal([]);}
  }

  function doPromotion(pt){
    if(!promoDialog)return;const g=gRef.current;
    const evalBefore=preMoveEval.current||evalPos(g);
    const r=g.move({from:promoDialog.from,to:promoDialog.to,promotion:pt});setPromoDialog(null);
    if(r){
      const badge=classifyMove(evalBefore,evalPos(g),pCol);
      setMoveQualities(q=>[...q,badge]);setLastBadge(badge);setTimeout(()=>setLastBadge(null),2200);
      setLastMv({from:r.from,to:r.to});setSel(null);setLegal([]);play("move");if(g.inCheck())play("check");syncGame(g);
      const aiC=pCol==="w"?"b":"w";if(!g.isGameOver()&&g.turn()===aiC)setTimeout(()=>runAI(g),300);
    }
  }

  function undoMove(){const g=gRef.current;if(!g||hist.length<2)return;g.undo();g.undo();syncGame(g);setSel(null);setLegal([]);setLastMv(null);setHintSq(null);setGStatus("playing");setWinner(null);}
  function resign(){const g=gRef.current;const resignColor=gameMode==="p2p"?(g?.turn()||"w"):pCol;const w=resignColor==="w"?"Black":"White";setGStatus("resign");setWinner(w);setTimerOn(false);play("over");const ns={...stats,l:stats.l+1};setStats(ns);saveProgress(undefined,undefined,undefined,ns);}
  function showHint(){const g=gRef.current;if(!g||gStatus!=="playing")return;const mv=getAIMove(g,Math.min(diff+1,4));if(mv){const m=g.moves({verbose:true}).find(m=>m.san===mv);if(m)setHintSq(m.from);else{const m2=g.moves({verbose:true})[0];if(m2)setHintSq(m2.from);}}}

  useEffect(()=>{
    if(gStatus==="checkmate"||gStatus==="stalemate"||gStatus==="draw"||gStatus==="resign"){
      const iWon=winner===(pCol==="w"?"White":"Black");
      if(gameMode==="ai"){const result=gStatus==="checkmate"?(iWon?1:0):gStatus==="resign"?0:0.5;const newElo=calcNewElo(elo,DIFF_ELO[diff],result);setElo(newElo);saveProgress(undefined,undefined,undefined,undefined,newElo);}
      const result=gStatus==="checkmate"?(iWon?"win":"loss"):gStatus==="resign"?"loss":"draw";
      const durationS=gameStartTime.current?Math.round((Date.now()-gameStartTime.current)/1000):0;
      saveGame({result,playerColor:pCol,difficulty:diff,moves:hist.map(m=>m.san),opening,durationS});
      if(gStatus==="checkmate"&&iWon){play("win");const ns={...stats,w:stats.w+1};setStats(ns);saveProgress(undefined,undefined,undefined,ns);}
      else if(gStatus==="checkmate"||gStatus==="resign"){play("over");if(gStatus!=="resign"){const ns={...stats,l:stats.l+1};setStats(ns);saveProgress(undefined,undefined,undefined,ns);}}
      else{play("over");const ns={...stats,d:stats.d+1};setStats(ns);saveProgress(undefined,undefined,undefined,ns);}
    }
  },[gStatus]);

  useEffect(()=>{
    if(!timerOn||!useTimer)return;
    timerRef.current=setInterval(()=>{
      if(gRef.current?.turn()==="w"){setTimeW(t=>{if(t<=1){clearInterval(timerRef.current);setGStatus("timeout");setWinner("Black");return 0;}return t-1;});}
      else{setTimeB(t=>{if(t<=1){clearInterval(timerRef.current);setGStatus("timeout");setWinner("White");return 0;}return t-1;});}
    },1000);
    return()=>clearInterval(timerRef.current);
  },[timerOn,useTimer]);

  useEffect(()=>{moveListRef.current?.lastElementChild?.scrollIntoView({behavior:"smooth"});},[hist]);
  useEffect(()=>{tutEndRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  function fmtTime(s){const m=Math.floor(s/60);return`${m}:${(s%60).toString().padStart(2,"0")}`;}

  const trackLessons=LESSONS.filter(l=>l.track===lTrack);
  const curLesson=trackLessons[lIdx]??LESSONS[0];
  function loadLesson(lesson){if(!loaded||!lesson)return;let g;try{g=new ChessLib.current(lesson.fen||"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");}catch{g=new ChessLib.current();}lgRef.current=g;setLBoard(g.board());setLSel(null);setLLegal([]);}
  useEffect(()=>{if(loaded&&screen==="learn")loadLesson(curLesson);},[loaded,lIdx,lTrack,screen]);
  function handleLClick(sq){const g=lgRef.current;if(!g)return;if(lSel&&lLegal.includes(sq)){const r=g.move({from:lSel,to:sq,promotion:"q"});if(r){setLBoard([...g.board()]);setLSel(null);setLLegal([]);return;}}const piece=g.get(sq);if(piece){setLSel(sq);setLLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));}else{setLSel(null);setLLegal([]);}}
  function markDone(){const upd=new Set(doneLessons);upd.add(curLesson.id);setDoneLessons(upd);saveProgress(upd);if(lIdx<trackLessons.length-1)setLIdx(lIdx+1);}
  function loadPuzzle(puzzle){if(!loaded||!puzzle)return;let g;try{g=new ChessLib.current(puzzle.fen);}catch{return;}pzRef.current=g;setPz(puzzle);setPzBoard(g.board());setPzSel(null);setPzLegal([]);setPzLastMv(null);setPzStatus("idle");setPzMvIdx(0);setPzHint(false);}
  function randomPuzzle(filter=pzFilter){const pool=PUZZLES.filter(p=>filter==="All"||p.cat===filter);const unsolved=pool.filter(p=>!solvedPz.has(p.id));const src=unsolved.length?unsolved:pool;loadPuzzle(src[Math.floor(Math.random()*src.length)]);}

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

  function handlePzClick(sq){
    const g=pzRef.current;if(!g||!pz||pzStatus==="solved"||pzStatus==="wrong")return;
    if(pzSel&&pzLegal.includes(sq)){
      const expected=pz.sol[pzMvIdx];const r=g.move({from:pzSel,to:sq,promotion:"q"});
      if(!r){setPzSel(null);setPzLegal([]);return;}
      setPzLastMv({from:r.from,to:r.to});setPzBoard([...g.board()]);setPzSel(null);setPzLegal([]);
      if(r.san===expected||r.from+r.to===expected||r.from+r.to+(r.promotion||"")===expected){
        const next=pzMvIdx+1;
        if(next>=pz.sol.length){setPzStatus("solved");play("pzOk");const sk=streak+1;setStreak(sk);const ns=new Set(solvedPz);ns.add(pz.id);setSolvedPz(ns);saveProgress(undefined,ns,sk,undefined);}
        else{setPzMvIdx(next);setPzStatus("correct");play("move");if(pz.sol[next])setTimeout(()=>{const opp=g.move(pz.sol[next]);if(opp){setPzLastMv({from:opp.from,to:opp.to});setPzBoard([...g.board()]);setPzMvIdx(next+1);setPzStatus("idle");}},600);}
      }else{g.undo();setPzBoard([...g.board()]);setPzLastMv(null);setPzStatus("wrong");play("pzFail");const sk=0;setStreak(sk);saveProgress(undefined,undefined,sk,undefined);}
      return;
    }
    const piece=g.get(sq);if(piece&&piece.color===g.turn()){setPzSel(sq);setPzLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));}else{setPzSel(null);setPzLegal([]);}
  }

  const lastMsgTime=useRef(0);const tutorCache=useRef({});
  async function sendMsg(){
    const q=tutIn.trim();if(!q)return;
    const now=Date.now();if(now-lastMsgTime.current<3000){setMsgs(p=>[...p,{role:"assistant",content:"⏳ Please wait a moment."}]);return;}
    lastMsgTime.current=now;
    const g=screen==="puzzles"?pzRef.current:screen==="learn"?lgRef.current:gRef.current;
    const fen=g?.fen()??"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const mvs=g?.history().slice(-8).join(" ")||"none";
    const ctx=screen==="learn"?`Current lesson: "${curLesson?.title}". `:screen==="puzzles"&&pz?`Puzzle type: "${pz.cat}". `:"";
    const systemPrompt=`You are an encouraging expert chess tutor. ${ctx}Position FEN: ${fen}. Recent moves: ${mvs}. Be warm, concise (2-4 sentences), use algebraic notation, give actionable advice.`;
    const cacheKey=`${q}|${fen.slice(0,20)}`;
    if(tutorCache.current[cacheKey]){setMsgs(p=>[...p,{role:"user",content:q},{role:"assistant",content:tutorCache.current[cacheKey]}]);setTutIn("");return;}
    const newMsgs=[...msgs,{role:"user",content:q}];setMsgs(newMsgs);setTutIn("");setTutBusy(true);
    const MODELS=["llama-3.1-8b-instant","llama3-8b-8192","gemma2-9b-it","mixtral-8x7b-32768"];
    try{
      let reply=null,lastErr="";
      for(const model of MODELS){
        let result;
        try{const res=await fetch("/api/groq",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model,messages:[{role:"system",content:systemPrompt},...newMsgs.map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.content}))],max_tokens:400,temperature:0.7})});result={status:res.status,data:await res.json()};}catch{lastErr="Network error";continue;}
        const{status,data}=result;
        if(status===401)throw new Error("Invalid API key.");
        if(status===429)throw new Error("Rate limit — wait 30s and try again.");
        if(status===503||status===500){lastErr=`Model ${model} unavailable`;continue;}
        if(status!==200){lastErr=data?.error?.message||`HTTP ${status}`;continue;}
        reply=data?.choices?.[0]?.message?.content;if(reply)break;
      }
      if(!reply)throw new Error(lastErr||"All models unavailable.");
      tutorCache.current[cacheKey]=reply;setMsgs(p=>[...p,{role:"assistant",content:reply}]);
    }catch(e){setMsgs(p=>[...p,{role:"assistant",content:`❌ ${e.message}`}]);}
    setTutBusy(false);
  }

  // ════════════════════════════════════════════════════════════════
  //  UI COMPONENTS
  // ════════════════════════════════════════════════════════════════
  function Board({brd,onSq,selSq,legalSqs=[],lastMove=null,noFlip=false,chkSq=null,hintSq2=null,sz=SQ,onPieceDragStart=null}){
    const t=THEMES[theme],fl=flipped&&!noFlip,rows=fl?[...brd].reverse():brd;
    const isPlayBoard=!noFlip,isMyTurnNow=gRef.current?.turn()===pCol;
    return(
      <div data-chess-board="1" style={{display:"inline-flex",flexDirection:"column",borderRadius:6,overflow:"hidden",boxShadow:"0 24px 72px rgba(0,0,0,.65),0 4px 12px rgba(0,0,0,.4)",border:`2px solid ${t.bdr}`,outline:isPlayBoard&&gStatus==="playing"?(isMyTurnNow?"2px solid rgba(200,168,75,0.65)":"2px solid rgba(200,168,75,0.12)"):"2px solid transparent",outlineOffset:"3px",transition:"outline-color .4s ease",boxSizing:"border-box",userSelect:"none",WebkitUserSelect:"none"}}>
        {rows.map((rowData,ri)=>{
          const bRow=fl?7-ri:ri,rank=8-bRow,dispRow=fl?[...rowData].reverse():rowData;
          return(
            <div key={ri} style={{display:"flex"}}>
              {showCoords&&<div style={{width:18,height:sz,display:"flex",alignItems:"center",justifyContent:"center",background:"#0A0908",fontSize:9,color:"#555",fontFamily:"monospace",fontWeight:700,flexShrink:0}}>{rank}</div>}
              {dispRow.map((piece,ci)=>{
                const bCol=fl?7-ci:ci,sq=`${String.fromCharCode(97+bCol)}${rank}`;
                const isLight=(bRow+bCol)%2!==0,isSel=selSq===sq,isLeg=legalSqs.includes(sq);
                const isLF=lastMove?.from===sq,isLT=lastMove?.to===sq,isChk=chkSq===sq,isHint=hintSq2===sq;
                const pk=piece?`${piece.color}${piece.type.toUpperCase()}`:null,isW=piece?.color==="w";
                const isBeingDragged=dragRef.current?.from===sq;
                let bg=isLight?t.l:t.d;if(isSel)bg=t.sel;else if(isLF||isLT)bg=t.last;if(isChk)bg="rgba(220,60,40,.72)";
                return(
                  <div key={ci} onClick={()=>onSq(sq)} className="board-sq" style={{width:sz,height:sz,background:bg,cursor:onPieceDragStart&&piece?"grab":"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",transition:"background .08s",outline:isSel?"2.5px solid rgba(255,255,0,.95)":isHint?"2.5px solid rgba(76,175,130,.9)":"none",outlineOffset:"-2.5px",boxSizing:"border-box",animation:isLT?"sqFlash .45s ease-out":"none"}}>
                    {isLeg&&!piece&&<div style={{width:Math.round(sz*.34),height:Math.round(sz*.34),borderRadius:"50%",background:t.hint,pointerEvents:"none"}}/>}
                    {isLeg&&piece&&<div style={{position:"absolute",inset:0,boxShadow:`inset 0 0 0 4px ${t.hint}`,pointerEvents:"none",borderRadius:2}}/>}
                    {piece&&<span className="chess-piece" onMouseDown={onPieceDragStart?(e)=>{e.stopPropagation();onPieceDragStart(e,sq);}:undefined} onTouchStart={onPieceDragStart?(e)=>{e.stopPropagation();onPieceDragStart(e,sq);}:undefined} style={{fontSize:Math.round(sz*.82),lineHeight:1,userSelect:"none",color:isW?"#fff":"#0A0808",textShadow:isW?"0 0 6px #000,0 2px 8px rgba(0,0,0,.95)":"0 0 3px rgba(255,255,255,.25),0 1px 5px rgba(0,0,0,.5)",position:"relative",zIndex:1,opacity:isBeingDragged?0:1,cursor:onPieceDragStart?"grab":"default",transition:"opacity .05s",WebkitUserSelect:"none",touchAction:"none"}}>{UNI[pk]}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
        {showCoords&&(<div style={{display:"flex",background:"#0A0908"}}><div style={{width:18}}/>{Array.from({length:8},(_,i)=>(<div key={i} style={{width:sz,textAlign:"center",fontSize:9,color:"#555",padding:"3px 0",fontFamily:"monospace",fontWeight:700}}>{String.fromCharCode(97+(fl?7-i:i))}</div>))}</div>)}
      </div>
    );
  }

  function TutorChat({height=260,placeholder="Ask your chess tutor…"}){
    const quickP=screen==="learn"?[`Explain "${curLesson?.title}"`,`Any tips?`,"What's the idea here?"]:screen==="puzzles"?["Give me a hint","What tactic is this?","Explain the solution"]:["Best move?","What's my plan?","Evaluate the position"];
    return(
      <div style={{display:"flex",flexDirection:"column",height}}>
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,paddingRight:4,paddingBottom:4}}>
          {msgs.length===0&&<p style={{fontSize:13,color:"#504C45",fontStyle:"italic",margin:0}}>Ask anything about chess or the current position!</p>}
          {msgs.map((m,i)=>(<div key={i} className={m.role==="user"?"msg-in-right":"msg-in-left"} style={{maxWidth:"88%",alignSelf:m.role==="user"?"flex-end":"flex-start"}}><div className={m.role==="user"?"tutor-msg-user":"tutor-msg-ai"} style={{fontSize:13,lineHeight:1.6,padding:"9px 13px"}}>{m.content}</div></div>))}
          {tutBusy&&<div style={{alignSelf:"flex-start",fontSize:13,color:"#8C8476",fontStyle:"italic",padding:"7px 13px",background:"rgba(255,255,255,0.04)",borderRadius:"16px 16px 16px 4px"}}>Thinking…</div>}
          <div ref={tutEndRef}/>
        </div>
        <div style={{borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:10}}>
          <div style={{display:"flex",gap:6}}>
            <input value={tutIn} onChange={e=>setTutIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!tutBusy&&sendMsg()} placeholder={placeholder} style={{flex:1,fontSize:13,padding:"9px 13px",borderRadius:100,border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.04)",color:"#EDE7D4",outline:"none",fontFamily:"var(--font-sans)",transition:"border-color .15s"}} onFocus={e=>e.target.style.borderColor="#C8A84B"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.07)"}/>
            <button onClick={sendMsg} disabled={tutBusy||!tutIn.trim()} style={{padding:"9px 16px",background:tutBusy||!tutIn.trim()?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#C8A84B,#E2C870)",color:tutBusy||!tutIn.trim()?"#504C45":"#1A1510",border:"none",borderRadius:100,fontSize:13,cursor:"pointer",fontWeight:700,fontFamily:"var(--font-sans)"}}>↑</button>
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>{quickP.map(q=>(<button key={q} onClick={()=>setTutIn(q)} style={{fontSize:11,padding:"4px 10px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:20,cursor:"pointer",color:"#8C8476",fontFamily:"var(--font-sans)"}}>{q}</button>))}</div>
        </div>
      </div>
    );
  }

  function PromoDlg(){
    if(!promoDialog)return null;
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
        <div style={{background:"#161410",borderRadius:20,padding:"1.75rem",boxShadow:"0 1px 0 rgba(200,168,75,0.1) inset,0 32px 80px rgba(0,0,0,0.7)",borderTop:"1px solid rgba(200,168,75,0.12)"}}>
          <div style={{fontSize:15,fontWeight:700,color:"#EDE7D4",marginBottom:18,textAlign:"center",fontFamily:"Cormorant,serif"}}>Promote Pawn</div>
          <div style={{display:"flex",gap:10}}>
            {[["q","Queen"],["r","Rook"],["b","Bishop"],["n","Knight"]].map(([pt,label])=>(
              <div key={pt} onClick={()=>doPromotion(pt)} style={{width:72,height:72,borderRadius:14,background:"rgba(255,255,255,0.04)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:5,transition:"background .15s,transform .15s"}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(200,168,75,0.12)";e.currentTarget.style.transform="scale(1.08)";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)";e.currentTarget.style.transform="";}}>
                <span style={{fontSize:34,color:pCol==="w"?"#fff":"#111",textShadow:pCol==="w"?"0 0 4px #000,0 1px 5px rgba(0,0,0,.9)":undefined}}>{UNI[`${pCol}${pt.toUpperCase()}`]}</span>
                <span style={{fontSize:10,color:"#8C8476"}}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function Captured({history,forColor}){
    const map={};history.filter(m=>m.color!==forColor&&m.captured).forEach(m=>{const k=`${forColor}${m.captured.toUpperCase()}`;map[k]=(map[k]||0)+1;});
    const sorted=Object.entries(map).sort((a,b)=>PV[b[0][1].toLowerCase()]-PV[a[0][1].toLowerCase()]);
    const mat=sorted.reduce((s,[k,n])=>s+PV[k[1].toLowerCase()]*n,0);
    const opp=history.filter(m=>m.color===forColor&&m.captured).reduce((s,m)=>s+PV[m.captured],0);
    const adv=mat-opp;
    return(<div style={{display:"flex",alignItems:"center",gap:4,minHeight:18}}><span style={{fontSize:13,letterSpacing:0,opacity:0.75}}>{sorted.map(([k,n])=>Array(n).fill(UNI[k]).join("")).join("")}</span>{adv>0&&<span style={{fontSize:11,color:"#4CAF82",fontWeight:700}}>+{adv}</span>}</div>);
  }

  function Toggle({val,onChange}){
    return(<div onClick={()=>onChange(!val)} style={{width:44,height:24,borderRadius:12,background:val?"linear-gradient(135deg,#C8A84B,#E2C870)":"rgba(255,255,255,0.08)",cursor:"pointer",transition:"background .2s",position:"relative",flexShrink:0,boxShadow:val?"0 2px 8px rgba(200,168,75,0.3)":"none"}}><div style={{position:"absolute",top:2,left:val?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.35)"}}/></div>);
  }

  function ShareModal(){
    const [copied,setCopied]=useState(false);
    const text=generateShareText(),acc=computeAccuracy(moveQualities),iWon=winner===(pCol==="w"?"White":"Black");
    const accColor=acc==null?"#8C8476":acc>=85?"#4CAF82":acc>=65?"#C8A84B":"#E05555";
    async function copy(){try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2200);}catch{}}
    return(
      <div onClick={()=>setShareModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.80)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:"0 1rem"}}>
        <div onClick={e=>e.stopPropagation()} style={{background:"#161410",borderRadius:20,padding:"1.75rem",width:"100%",maxWidth:360,boxShadow:"0 1px 0 rgba(200,168,75,0.1) inset,0 32px 80px rgba(0,0,0,0.7)",borderTop:"1px solid rgba(200,168,75,0.12)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
            <span style={{fontSize:16,fontWeight:700,color:"#EDE7D4",fontFamily:"Cormorant,serif"}}>♟ Share Result</span>
            <button onClick={()=>setShareModal(false)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#504C45",lineHeight:1}}>×</button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18,padding:"14px 16px",borderRadius:14,background:iWon?"rgba(76,175,130,0.08)":"rgba(224,85,85,0.06)",borderTop:`1px solid ${iWon?"rgba(76,175,130,0.2)":"rgba(224,85,85,0.15)"}`}}>
            <span style={{fontSize:30}}>{gStatus==="checkmate"?(iWon?"🏆":"💀"):gStatus==="resign"?"🏳":gStatus==="timeout"?"⏰":"🤝"}</span>
            <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:"#EDE7D4",fontFamily:"Cormorant,serif"}}>{gStatus==="checkmate"?`${winner} wins!`:gStatus==="stalemate"?"Stalemate":gStatus==="resign"?"Resigned":"Draw"}</div><div style={{fontSize:12,color:"#8C8476"}}>{DIFFS[diff].label} · {hist.length} moves{opening?" · "+opening:""}</div></div>
            {acc!=null&&<div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,color:accColor,fontFamily:"Cormorant,serif"}}>{acc}</div><div style={{fontSize:10,color:"#504C45",textTransform:"uppercase",letterSpacing:"0.06em"}}>accuracy</div></div>}
          </div>
          {moveQualities.length>0&&<div style={{display:"flex",gap:6,marginBottom:18}}>{[{sym:"✓",label:"Best/Good",color:"#4CAF82",count:moveQualities.filter(m=>m.label==="Best"||m.label==="Good").length},{sym:"?",label:"Inaccuracy",color:"#C8A84B",count:moveQualities.filter(m=>m.label==="Inaccuracy").length},{sym:"??",label:"Mistake",color:"#E08C30",count:moveQualities.filter(m=>m.label==="Mistake").length},{sym:"???",label:"Blunder",color:"#E05555",count:moveQualities.filter(m=>m.label==="Blunder").length}].map(s=>(<div key={s.sym} style={{flex:1,textAlign:"center",padding:"9px 4px",borderRadius:12,background:`${s.color}12`,outline:`1px solid ${s.color}30`}}><div style={{fontSize:12,fontWeight:700,color:s.color}}>{s.sym}</div><div style={{fontSize:16,fontWeight:700,color:s.color,fontFamily:"Cormorant,serif"}}>{s.count}</div></div>))}</div>}
          <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 12px",marginBottom:16,fontFamily:"monospace",fontSize:12,lineHeight:1.9,whiteSpace:"pre-wrap",color:"#8C8476"}}>{text}</div>
          <button onClick={copy} style={{width:"100%",padding:"12px",background:copied?"rgba(76,175,130,0.12)":"linear-gradient(135deg,#C8A84B,#E2C870)",color:copied?"#4CAF82":"#1A1510",border:copied?"1px solid rgba(76,175,130,0.3)":"none",borderRadius:100,fontSize:14,fontWeight:700,cursor:"pointer",transition:"all .25s",fontFamily:"var(--font-sans)"}}>{copied?"✓ Copied!":"📋 Copy to clipboard"}</button>
        </div>
      </div>
    );
  }

  function GhostPiece(){
    if(!ghostState)return null;
    const{x,y,pk,isW}=ghostState;
    return(<div style={{position:"fixed",left:x,top:y,fontSize:Math.round(SQ*1.15),lineHeight:1,pointerEvents:"none",zIndex:9999,opacity:0.92,color:isW?"#fff":"#0A0808",textShadow:isW?"0 0 8px #000,0 2px 10px rgba(0,0,0,.95)":"0 0 3px rgba(255,255,255,.3)",transform:"translate(-50%,-50%)",userSelect:"none",filter:"drop-shadow(0 6px 18px rgba(0,0,0,.6))"}}>{UNI[pk]}</div>);
  }

  const NAV_ITEMS=[{id:"menu",icon:"⌂",label:"Home"},{id:"play_setup",icon:"⚔",label:"Play"},{id:"online",icon:"🌐",label:"Online"},{id:"learn",icon:"🎓",label:"Learn"},{id:"puzzles",icon:"🧩",label:"Puzzles"},{id:"profile",icon:"👤",label:"Profile"}];
  const NAV_ACTIVE_MAP={menu:"menu",settings:"menu",play_setup:"play_setup",play:"play_setup",online:"online",online_play:"online",learn:"learn",puzzles:"puzzles",profile:"profile"};
  const NAV_SCREENS=new Set(["menu","play_setup","play","learn","puzzles","profile","settings","online","online_play"]);

  function BottomNav(){
    if(!NAV_SCREENS.has(screen)||screen==="play"||screen==="online_play")return null;
    const active=NAV_ACTIVE_MAP[screen]??"menu";
    function go(id){if(id==="menu")setScreen("menu");else if(id==="play_setup"){setGameMode("ai");setScreen("play_setup");}else if(id==="online")setScreen("online");else if(id==="learn")setScreen("learn");else if(id==="puzzles"){if(!pz)randomPuzzle();setScreen("puzzles");}else if(id==="profile")setScreen("profile");}
    return(
      <nav style={{position:"fixed",bottom:0,left:0,right:0,height:68,zIndex:200,background:"rgba(14,13,10,0.92)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{maxWidth:860,margin:"0 auto",width:"100%",display:"flex",height:"100%",padding:"0 8px"}}>
          {NAV_ITEMS.map(item=>{
            const isActive=active===item.id;
            return(
              <button key={item.id} onClick={()=>go(item.id)} style={{flex:1,border:"none",background:"none",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,cursor:"pointer",padding:"8px 4px",color:isActive?"#C8A84B":"#504C45",transition:"color .15s",position:"relative",outline:"none",fontFamily:"var(--font-sans)"}} onMouseEnter={e=>{if(!isActive)e.currentTarget.style.color="#8C8476";}} onMouseLeave={e=>{if(!isActive)e.currentTarget.style.color="#504C45";}}>
                {isActive&&<div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:24,height:2,borderRadius:"0 0 2px 2px",background:"#C8A84B"}}/>}
                <span style={{fontSize:21,lineHeight:1,transform:isActive?"scale(1.12)":"scale(1)",transition:"transform .18s"}}>{item.icon}</span>
                <span style={{fontSize:10,fontWeight:isActive?700:400,letterSpacing:0.2}}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  SCREENS
  // ════════════════════════════════════════════════════════════════
  if(!loaded) return(
    <div style={{minHeight:500,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,fontFamily:"var(--font-sans)"}}>
      <style>{`@keyframes bob{0%,100%{transform:scale(1) rotate(-4deg)}50%{transform:scale(1.1) rotate(4deg)}}`}</style>
      {loadErr?<><span style={{fontSize:40}}>⚠️</span><p style={{color:"#8C8476",fontSize:14}}>Could not load chess engine — check connection and reload.</p></>
      :<><span style={{fontSize:60,animation:"bob 2s ease-in-out infinite",display:"inline-block",filter:"drop-shadow(0 0 20px rgba(200,168,75,0.25))"}}>♟</span><p style={{color:"#8C8476",fontSize:14}}>Loading Chess Academy…</p></>}
    </div>
  );

  // ── MENU ──────────────────────────────────────────────────────
  if(screen==="menu"){
    const totalL=LESSONS.length,pct=Math.round((doneLessons.size/totalL)*100);
    return(<>
    <div style={{padding:"1rem 0 5.5rem",fontFamily:"var(--font-sans)"}} className="screen-enter">
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}`}</style>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
        <button onClick={()=>setScreen("profile")} style={{display:"flex",alignItems:"center",gap:7,fontSize:12,padding:"6px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:100,cursor:"pointer",color:"#8C8476",transition:"all .15s",fontFamily:"var(--font-sans)"}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.08)";e.currentTarget.style.color="#EDE7D4";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)";e.currentTarget.style.color="#8C8476";}}>
          <span>👤</span><span>{user?(user.user_metadata?.username??user.email?.split("@")[0]):"Guest"}</span>
        </button>
      </div>
      <div style={{textAlign:"center",padding:"1.25rem 0 1rem",position:"relative"}}>
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:260,height:260,background:"radial-gradient(circle,rgba(200,168,75,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{fontSize:72,lineHeight:1,marginBottom:14,animation:"float 3s ease-in-out infinite",display:"inline-block",filter:"drop-shadow(0 0 28px rgba(200,168,75,0.22))",position:"relative"}}>♟</div>
        <h1 style={{fontFamily:"Cormorant,serif",fontSize:32,fontWeight:700,color:"#EDE7D4",letterSpacing:"0.04em",marginBottom:6,lineHeight:1}}>Chess Academy</h1>
        <p style={{fontSize:14,color:"#8C8476",fontWeight:400,margin:0}}>Master the game of kings</p>
      </div>
      <div style={{display:"flex",marginBottom:"1.5rem",padding:"1.25rem 0",borderTop:"1px solid rgba(255,255,255,0.05)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
        {[{label:"Rating",val:elo,color:"#C8A84B"},{label:"Wins",val:stats.w,color:"#4CAF82"},{label:"Losses",val:stats.l,color:"#E05555"},{label:"Streak",val:streak>0?`${streak}🔥`:streak,color:"#EDE7D4"}].map((s,i,arr)=>(
          <div key={s.label} style={{textAlign:"center",flex:1,borderRight:i<arr.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
            <div style={{fontSize:26,fontWeight:700,color:s.color,fontFamily:"Cormorant,serif",lineHeight:1,marginBottom:4}}>{s.val}</div>
            <div style={{fontSize:10,color:"#504C45",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        {[{id:"play_setup",emoji:"⚔️",title:"vs AI",desc:"5 difficulty levels",accent:"#C8A84B",sub:`${DIFFS[diff].label} · ${elo} Elo`,onClick:()=>setScreen("play_setup")},{id:"learn",emoji:"🎓",title:"Learn",desc:`${totalL} interactive lessons`,accent:"#4CAF82",sub:`${pct}% complete`,onClick:()=>setScreen("learn")}].map(m=>(
          <div key={m.id} onClick={m.onClick} style={{background:"#161410",borderRadius:20,padding:"1.5rem 1.25rem",cursor:"pointer",transition:"transform .2s,box-shadow .2s",boxShadow:"0 1px 0 rgba(255,255,255,0.04) inset,0 4px 20px rgba(0,0,0,0.4)",position:"relative",overflow:"hidden"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 1px 0 rgba(255,255,255,0.06) inset,0 16px 48px rgba(0,0,0,0.58)";}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 1px 0 rgba(255,255,255,0.04) inset,0 4px 20px rgba(0,0,0,0.4)";}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${m.accent}90,${m.accent}20)`,borderRadius:"20px 20px 0 0"}}/>
            <div style={{fontSize:32,marginBottom:12}}>{m.emoji}</div>
            <div style={{fontSize:17,fontWeight:700,color:"#EDE7D4",marginBottom:5}}>{m.title}</div>
            <div style={{fontSize:12,color:"#8C8476",marginBottom:14,lineHeight:1.45}}>{m.desc}</div>
            <div style={{fontSize:11,padding:"3px 10px",background:`${m.accent}14`,color:m.accent,borderRadius:100,display:"inline-block",fontWeight:600}}>{m.sub}</div>
          </div>
        ))}
      </div>
      {[{emoji:"🌐",title:"Play Online",desc:"Real-time vs friends · invite code or quick match",badge:"Live",bc:"#4CAF82",onClick:()=>setScreen("online")},{emoji:"👥",title:"Pass & Play",desc:"2 players on one device · auto-flip board",badge:"Local",bc:"#E08C30",onClick:()=>{setGameMode("p2p");setScreen("play_setup");}},{emoji:"🧩",title:"Puzzle Trainer",desc:`${PUZZLES.length} tactical puzzles · ${solvedPz.size} solved`,badge:`${solvedPz.size}/${PUZZLES.length}`,bc:"#C04A90",onClick:()=>{randomPuzzle();setScreen("puzzles");}}].map(m=>(
        <div key={m.title} onClick={m.onClick} style={{background:"#161410",borderRadius:14,padding:"1rem 1.25rem",cursor:"pointer",transition:"transform .18s,box-shadow .18s",display:"flex",alignItems:"center",gap:14,marginBottom:8,boxShadow:"0 1px 0 rgba(255,255,255,0.03) inset,0 3px 14px rgba(0,0,0,0.32)"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 1px 0 rgba(255,255,255,0.05) inset,0 8px 28px rgba(0,0,0,0.48)";}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 1px 0 rgba(255,255,255,0.03) inset,0 3px 14px rgba(0,0,0,0.32)";}}>
          <span style={{fontSize:28,flexShrink:0}}>{m.emoji}</span>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:600,color:"#EDE7D4",marginBottom:2}}>{m.title}</div><div style={{fontSize:12,color:"#8C8476"}}>{m.desc}</div></div>
          <span style={{fontSize:11,padding:"3px 10px",background:`${m.bc}14`,color:m.bc,borderRadius:100,fontWeight:600,flexShrink:0}}>{m.badge}</span>
        </div>
      ))}
      <div style={{background:"#161410",borderRadius:14,padding:"1rem 1.25rem",boxShadow:"0 1px 0 rgba(255,255,255,0.03) inset,0 3px 14px rgba(0,0,0,0.32)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:600,color:"#EDE7D4"}}>Board Theme</div>
          <button onClick={()=>setScreen("settings")} style={{fontSize:12,padding:"5px 12px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:100,cursor:"pointer",color:"#8C8476",fontFamily:"var(--font-sans)"}}>⚙ Settings</button>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {Object.entries(THEMES).map(([k,t])=>(
            <div key={k} onClick={()=>setTheme(k)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",width:32,height:32,borderRadius:8,overflow:"hidden",outline:theme===k?"2.5px solid #C8A84B":"2.5px solid transparent",outlineOffset:2,transition:"outline .15s,transform .15s",transform:theme===k?"scale(1.12)":"scale(1)"}}>
                {[t.l,t.d,t.d,t.l].map((c,i)=><div key={i} style={{background:c}}/>)}
              </div>
              <span style={{fontSize:10,fontWeight:theme===k?700:400,color:theme===k?"#C8A84B":"#504C45"}}>{t.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    <BottomNav/>
    </>);
  }

  if(screen==="online") return(<><OnlineScreen user={user} onBack={()=>setScreen("menu")} onJoinGame={(gameData)=>{setOnlineGameData(gameData);setScreen("online_play");}}/><BottomNav/></>);
  if(screen==="online_play"&&onlineGameData) return(<OnlinePlayScreen gameData={onlineGameData} user={user} onBack={()=>setScreen("online")} ChessLib={ChessLib} loaded={loaded} theme={theme} showCoords={showCoords} soundOn={soundOn} onStatsChange={(delta)=>{const ns={w:stats.w+(delta.wins??0),l:stats.l+(delta.losses??0),d:stats.d+(delta.draws??0)};setStats(ns);saveProgress(undefined,undefined,undefined,ns);}} onEloChange={(result,oppElo)=>{const K=32,expected=1/(1+Math.pow(10,(oppElo-elo)/400)),newElo=Math.round(elo+K*(result-expected));setElo(newElo);saveProgress(undefined,undefined,undefined,undefined,newElo);}}/>);
  if(screen==="profile") return(<><ProfileScreen user={user} stats={stats} doneLessons={doneLessons} solvedPz={solvedPz} streak={streak} onBack={()=>setScreen("menu")} onSignOut={onSignOut}/><BottomNav/></>);

  // ── SETTINGS ──────────────────────────────────────────────────
  if(screen==="settings") return(<>
    <div style={{padding:"1rem 0 5.5rem",fontFamily:"var(--font-sans)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"1.75rem"}}>
        <button onClick={()=>setScreen("menu")} style={{fontSize:12,padding:"6px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:100,cursor:"pointer",color:"#8C8476",fontFamily:"var(--font-sans)"}}>← Back</button>
        <span style={{fontSize:20,fontWeight:700,color:"#EDE7D4",fontFamily:"Cormorant,serif"}}>Settings</span>
      </div>
      {[{label:"Sound Effects",sub:"Move, capture, check sounds",val:soundOn,set:setSoundOn},{label:"Show Coordinates",sub:"File and rank labels on the board",val:showCoords,set:setShowCoords}].map(s=>(
        <div key={s.label} style={{background:"#161410",borderRadius:14,padding:"16px 18px",marginBottom:8,display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 0 rgba(255,255,255,0.04) inset,0 4px 16px rgba(0,0,0,0.3)"}}>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:"#EDE7D4"}}>{s.label}</div><div style={{fontSize:12,color:"#8C8476",marginTop:2}}>{s.sub}</div></div>
          <Toggle val={s.val} onChange={s.set}/>
        </div>
      ))}
      <div style={{background:"#161410",borderRadius:14,padding:"16px 18px",marginBottom:8,boxShadow:"0 1px 0 rgba(255,255,255,0.04) inset,0 4px 16px rgba(0,0,0,0.3)"}}>
        <div style={{fontSize:14,fontWeight:600,color:"#EDE7D4",marginBottom:12}}>Animation Speed</div>
        <div style={{display:"flex",gap:6}}>
          {["fast","normal","slow"].map(s=>(<button key={s} onClick={()=>setAnimSpd(s)} style={{flex:1,padding:"9px",fontSize:13,background:animSpd===s?"rgba(200,168,75,0.12)":"rgba(255,255,255,0.04)",color:animSpd===s?"#C8A84B":"#8C8476",border:"none",borderRadius:10,cursor:"pointer",textTransform:"capitalize",outline:animSpd===s?"2px solid rgba(200,168,75,0.4)":"2px solid transparent",fontFamily:"var(--font-sans)",fontWeight:animSpd===s?700:400}}>{s}</button>))}
        </div>
      </div>
      <button onClick={async()=>{setDoneLessons(new Set());setStats({w:0,l:0,d:0});setSolvedPz(new Set());setStreak(0);try{await window.storage?.set("chess_v2","{}");}catch{}}} style={{width:"100%",padding:11,background:"rgba(224,85,85,0.08)",color:"#E05555",border:"1px solid rgba(224,85,85,0.2)",borderRadius:12,fontSize:14,cursor:"pointer",marginTop:8,fontFamily:"var(--font-sans)"}}>Reset All Progress</button>
    </div>
    <BottomNav/>
  </>);

  // ── PLAY SETUP ────────────────────────────────────────────────
  if(screen==="play_setup") return(<>
    <div style={{padding:"1rem 0 5.5rem",fontFamily:"var(--font-sans)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"1.75rem"}}>
        <button onClick={()=>{setGameMode("ai");setScreen("menu");}} style={{fontSize:12,padding:"6px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:100,cursor:"pointer",color:"#8C8476",fontFamily:"var(--font-sans)"}}>← Back</button>
        <span style={{fontSize:20,fontWeight:700,color:"#EDE7D4",fontFamily:"Cormorant,serif"}}>{gameMode==="p2p"?"👥 Pass & Play Setup":"⚔️ Game Setup"}</span>
      </div>
      <div style={{display:"flex",gap:4,marginBottom:18,background:"rgba(255,255,255,0.04)",borderRadius:12,padding:4}}>
        {[["ai","vs AI"],["p2p","Pass & Play"]].map(([m,label])=>(<button key={m} onClick={()=>setGameMode(m)} style={{flex:1,padding:"10px",fontSize:14,fontWeight:600,borderRadius:9,border:"none",background:gameMode===m?"#161410":"transparent",color:gameMode===m?"#EDE7D4":"#8C8476",cursor:"pointer",transition:"all .15s",boxShadow:gameMode===m?"0 2px 8px rgba(0,0,0,0.3)":"none",fontFamily:"var(--font-sans)"}}>{label}</button>))}
      </div>
      {gameMode==="ai"&&<>
        <div style={{background:"#161410",borderRadius:16,padding:"1.25rem 1.5rem",marginBottom:12,boxShadow:"0 1px 0 rgba(255,255,255,0.04) inset,0 4px 20px rgba(0,0,0,0.35)"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#504C45",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.07em"}}>Difficulty</div>
          {DIFFS.map((d,i)=>(<div key={i} onClick={()=>setDiff(i)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:12,background:diff===i?"rgba(200,168,75,0.07)":"rgba(255,255,255,0.02)",outline:diff===i?"2px solid rgba(200,168,75,0.4)":"2px solid transparent",cursor:"pointer",transition:"all .15s",marginBottom:i<4?4:0}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:d.color,flexShrink:0}}/><span style={{fontSize:14,fontWeight:diff===i?700:400,color:"#EDE7D4",flex:1}}>{d.label}</span><span style={{fontSize:12,color:"#8C8476"}}>{d.desc}</span><span style={{fontSize:11,color:d.color,fontWeight:600}}>{DIFF_ELO[i]}</span>{diff===i&&<span style={{color:"#C8A84B",fontSize:14}}>✓</span>}
          </div>))}
        </div>
        <div style={{background:"#161410",borderRadius:16,padding:"1.25rem 1.5rem",marginBottom:12,boxShadow:"0 1px 0 rgba(255,255,255,0.04) inset,0 4px 20px rgba(0,0,0,0.35)"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#504C45",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.07em"}}>Play As</div>
          <div style={{display:"flex",gap:10}}>
            {[["w","♙","White","Move first"],["b","♟","Black","AI moves first"]].map(([col,ico,label,sub])=>(<div key={col} onClick={()=>setPCol(col)} style={{flex:1,padding:"14px 12px",borderRadius:14,cursor:"pointer",textAlign:"center",transition:"all .15s",background:pCol===col?"rgba(200,168,75,0.08)":"rgba(255,255,255,0.03)",outline:pCol===col?"2px solid rgba(200,168,75,0.4)":"2px solid transparent"}}><div style={{fontSize:30,marginBottom:7}}>{ico}</div><div style={{fontSize:14,fontWeight:700,color:"#EDE7D4",marginBottom:3}}>{label}</div><div style={{fontSize:12,color:"#8C8476"}}>{sub}</div></div>))}
          </div>
        </div>
      </>}
      {gameMode==="p2p"&&<>
        <div style={{background:"#161410",borderRadius:16,padding:"1.25rem 1.5rem",marginBottom:12,boxShadow:"0 1px 0 rgba(255,255,255,0.04) inset,0 4px 20px rgba(0,0,0,0.35)"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#504C45",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.07em"}}>Player Names</div>
          {[["w","♙ White (moves first)"],["b","♟ Black"]].map(([col,label])=>(<div key={col} style={{marginBottom:10}}><div style={{fontSize:12,color:"#8C8476",marginBottom:5}}>{label}</div><input value={p2pNames[col]} onChange={e=>setP2pNames(n=>({...n,[col]:e.target.value}))} placeholder={col==="w"?"Player 1":"Player 2"} style={{width:"100%",fontSize:14,padding:"10px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.04)",color:"#EDE7D4",outline:"none",boxSizing:"border-box",fontFamily:"var(--font-sans)",transition:"border-color .15s"}} onFocus={e=>e.target.style.borderColor="#C8A84B"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.07)"}/></div>))}
        </div>
        <div style={{background:"#161410",borderRadius:14,padding:"14px 18px",marginBottom:12,display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 0 rgba(255,255,255,0.04) inset,0 4px 16px rgba(0,0,0,0.3)"}}>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:"#EDE7D4"}}>Auto-flip board</div><div style={{fontSize:12,color:"#8C8476",marginTop:2}}>Flip after each move so the active player faces their pieces</div></div>
          <Toggle val={p2pFlipOnTurn} onChange={setP2pFlipOnTurn}/>
        </div>
      </>}
      <div style={{background:"#161410",borderRadius:16,padding:"1.25rem 1.5rem",marginBottom:18,boxShadow:"0 1px 0 rgba(255,255,255,0.04) inset,0 4px 20px rgba(0,0,0,0.35)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#504C45",textTransform:"uppercase",letterSpacing:"0.07em"}}>Time Control</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:13,color:"#8C8476"}}>{useTimer?"On":"Off"}</span><Toggle val={useTimer} onChange={setUseTimer}/></div>
        </div>
        {useTimer&&<div style={{display:"flex",gap:6}}>{[[180,"3 min"],[300,"5 min"],[600,"10 min"],[900,"15 min"]].map(([s,label])=>(<button key={s} onClick={()=>setTimeCtrl(s)} style={{flex:1,padding:"9px 4px",fontSize:13,background:timeCtrl===s?"rgba(200,168,75,0.1)":"rgba(255,255,255,0.04)",color:timeCtrl===s?"#C8A84B":"#8C8476",border:"none",borderRadius:10,cursor:"pointer",outline:timeCtrl===s?"2px solid rgba(200,168,75,0.4)":"2px solid transparent",fontFamily:"var(--font-sans)",fontWeight:timeCtrl===s?700:400}}>{label}</button>))}</div>}
      </div>
      <button onClick={startGame} style={{width:"100%",padding:13,background:"linear-gradient(135deg,#C8A84B 0%,#E2C870 50%,#B89040 100%)",color:"#1A1510",border:"none",borderRadius:100,fontSize:16,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 24px rgba(200,168,75,0.4)",fontFamily:"var(--font-sans)",letterSpacing:"0.01em"}} onMouseEnter={e=>e.currentTarget.style.opacity=".9"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
        {gameMode==="p2p"?"Start Pass & Play →":"Start Game →"}
      </button>
    </div>
    <BottomNav/>
  </>);

  // ── PLAY ──────────────────────────────────────────────────────
  if(screen==="play"){
    const g=gRef.current;
    const movePairs=[];for(let i=0;i<hist.length;i+=2)movePairs.push({n:Math.floor(i/2)+1,w:hist[i]?.san,b:hist[i+1]?.san});
    const isMyTurn=g?.turn()===pCol,gameOver=gStatus!=="playing"&&gStatus!=="idle",iWon=winner===(pCol==="w"?"White":"Black");
    const chkSq=inChk&&g?(()=>{let k=null;g.board().forEach((row,r)=>row.forEach((p,c)=>{if(p?.type==="k"&&p.color===g.turn())k=`${String.fromCharCode(97+c)}${8-r}`;}));return k;})():null;
    return(
      <div style={{padding:"0.5rem 0 1rem",fontFamily:"var(--font-sans)"}}>
        <PromoDlg/>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,flexWrap:"wrap"}}>
          <button onClick={()=>{setScreen("menu");setGameMode("ai");}} style={{fontSize:12,padding:"6px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:100,cursor:"pointer",color:"#8C8476",fontFamily:"var(--font-sans)"}}>← Menu</button>
          <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
            {gameMode==="p2p"?<span style={{fontSize:12,color:"#E08C30",fontWeight:600}}>👥 Pass & Play</span>:<><div style={{width:8,height:8,borderRadius:"50%",background:DIFFS[diff].color,flexShrink:0}}/><span style={{fontSize:12,color:"#8C8476"}}>{DIFFS[diff].label}</span></>}
            {opening&&<span style={{fontSize:11,color:"#504C45",borderLeft:"1px solid rgba(255,255,255,0.05)",paddingLeft:6}}>{opening}</span>}
          </div>
          {gameMode==="p2p"&&gStatus==="playing"&&<span style={{fontSize:12,fontWeight:600,color:g?.turn()==="w"?"#EDE7D4":"#8C8476",padding:"3px 10px",background:"rgba(255,255,255,0.05)",borderRadius:20}}>{g?.turn()==="w"?`♙ ${p2pNames.w}`:`♟ ${p2pNames.b}`}'s turn</span>}
          {gameMode==="ai"&&aiThink&&<span style={{fontSize:12,color:"#8C8476",fontStyle:"italic"}}>AI thinking…</span>}
          {inChk&&gStatus==="playing"&&<span style={{fontSize:12,color:"#E05555",fontWeight:700}}>⚠ Check!</span>}
          <button onClick={()=>setFlipped(f=>!f)} style={{fontSize:12,padding:"6px 10px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:100,cursor:"pointer",color:"#8C8476",fontFamily:"var(--font-sans)"}}>⟳</button>
        </div>
        {gameOver&&(()=>{
          const eloChange=gameMode==="ai"?(()=>{const r=gStatus==="checkmate"?(iWon?1:0):gStatus==="resign"?0:0.5;return calcNewElo(elo,DIFF_ELO[diff],r)-elo;})():null;
          const winnerName=gameMode==="p2p"?(winner==="White"?p2pNames.w:p2pNames.b):winner;
          const isDraw=gStatus==="stalemate"||gStatus==="draw";
          return(<div style={{marginBottom:12,padding:"14px 18px",borderRadius:14,background:isDraw?"rgba(255,255,255,0.03)":iWon||gameMode==="p2p"?"rgba(76,175,130,0.09)":"rgba(224,85,85,0.08)",borderTop:`1px solid ${isDraw?"rgba(255,255,255,0.07)":iWon||gameMode==="p2p"?"rgba(76,175,130,0.25)":"rgba(224,85,85,0.2)"}`,display:"flex",alignItems:"center",gap:14}}>
            <span style={{fontSize:28}}>{gStatus==="checkmate"?"🏆":gStatus==="resign"?"🏳":gStatus==="timeout"?"⏰":"🤝"}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:700,color:"#EDE7D4",fontFamily:"Cormorant,serif"}}>{gStatus==="checkmate"?`${winnerName} wins by checkmate!`:gStatus==="stalemate"?"Stalemate — draw!":gStatus==="timeout"?`${winnerName} wins on time!`:gStatus==="resign"?`${winnerName} wins by resignation`:"Draw!"}</div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginTop:3,flexWrap:"wrap"}}>
                <span style={{fontSize:12,color:"#8C8476"}}>{hist.length} moves</span>
                {computeAccuracy(moveQualities)!=null&&(()=>{const acc=computeAccuracy(moveQualities);const c=acc>=85?"#4CAF82":acc>=65?"#C8A84B":"#E05555";return <span style={{fontSize:12,fontWeight:700,color:c}}>Accuracy: {acc}/100</span>;})()}
                {eloChange!=null&&<span style={{fontSize:12,fontWeight:700,color:eloChange>=0?"#4CAF82":"#E05555",padding:"1px 8px",background:eloChange>=0?"rgba(76,175,130,0.1)":"rgba(224,85,85,0.1)",borderRadius:20}}>{eloChange>=0?`+${eloChange}`:`${eloChange}`} Elo → {elo+(eloChange||0)}</span>}
              </div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {gameMode==="ai"&&<button onClick={()=>setShareModal(true)} style={{padding:"7px 12px",background:"rgba(255,255,255,0.05)",color:"#8C8476",border:"1px solid rgba(255,255,255,0.08)",borderRadius:100,fontSize:12,cursor:"pointer",fontFamily:"var(--font-sans)"}}>📤</button>}
              <button onClick={startGame} style={{padding:"8px 18px",background:"linear-gradient(135deg,#C8A84B,#E2C870)",color:"#1A1510",border:"none",borderRadius:100,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"var(--font-sans)"}}>Rematch</button>
            </div>
          </div>);
        })()}
        {shareModal&&<ShareModal/>}
        {gameOver&&moveQualities.length>0&&(
          <div style={{marginBottom:12,padding:"10px 14px",borderRadius:12,background:"rgba(255,255,255,0.03)"}}>
            <div style={{fontSize:11,color:"#504C45",marginBottom:8,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>Move Quality</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[{label:"Best/Good",sym:"✓",color:"#4CAF82",count:moveQualities.filter(m=>m.label==="Best"||m.label==="Good").length},{label:"Inaccuracy",sym:"?",color:"#C8A84B",count:moveQualities.filter(m=>m.label==="Inaccuracy").length},{label:"Mistake",sym:"??",color:"#E08C30",count:moveQualities.filter(m=>m.label==="Mistake").length},{label:"Blunder",sym:"???",color:"#E05555",count:moveQualities.filter(m=>m.label==="Blunder").length}].map(s=>(<div key={s.label} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,background:`${s.color}12`,outline:`1px solid ${s.color}30`}}><span style={{fontSize:12,fontWeight:700,color:s.color}}>{s.sym}</span><span style={{fontSize:12,color:s.color,fontWeight:600}}>{s.count} {s.label}</span></div>))}
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
          <div style={{flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6,minHeight:26}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14}}>{pCol==="w"?"♟":"♙"}</span><span style={{fontSize:13,color:"#8C8476",fontWeight:500}}>{gameMode==="p2p"?(flipped?p2pNames.w:p2pNames.b):`AI — ${DIFFS[diff].label}`}</span><Captured history={hist} forColor={pCol==="w"?"b":"w"}/></div>
              {useTimer&&<div style={{fontSize:16,fontFamily:"monospace",fontWeight:700,color:!isMyTurn?"#EDE7D4":"#504C45",background:!isMyTurn&&gStatus==="playing"?"rgba(200,168,75,0.1)":"transparent",padding:"3px 10px",borderRadius:8,transition:"background .3s",letterSpacing:"0.04em"}}>{fmtTime(pCol==="w"?timeB:timeW)}</div>}
            </div>
            <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
              <div style={{width:8,height:SQ*8+(showCoords?22:0),background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden",flexShrink:0,display:"flex",flexDirection:"column-reverse"}}><div style={{height:`${evalBar}%`,background:"rgba(255,255,255,0.82)",transition:"height .7s ease",borderRadius:4}}/></div>
              <div style={{position:"relative"}}>
                <Board brd={board} onSq={handleSqClick} selSq={sel} legalSqs={legal} lastMove={lastMv} chkSq={chkSq} hintSq2={hintSq} myTurn={isMyTurn} onPieceDragStart={playDragStart}/>
                {lastBadge&&<div style={{position:"absolute",top:-16,right:-8,zIndex:10,background:lastBadge.bg,borderTop:`1px solid ${lastBadge.color}55`,borderRadius:20,padding:"5px 12px",display:"flex",alignItems:"center",gap:5,animation:"badgePop .35s cubic-bezier(.34,1.56,.64,1) forwards",boxShadow:"0 4px 16px rgba(0,0,0,0.4)"}}><span style={{fontSize:13,fontWeight:700,color:lastBadge.color,letterSpacing:"-.3px"}}>{lastBadge.sym}</span><span style={{fontSize:12,fontWeight:600,color:lastBadge.color}}>{lastBadge.label}</span></div>}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6,minHeight:26}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14}}>{pCol==="w"?"♙":"♟"}</span><span style={{fontSize:13,color:"#EDE7D4",fontWeight:600}}>{gameMode==="p2p"?(flipped?p2pNames.b:p2pNames.w):"You"}</span><Captured history={hist} forColor={pCol}/>{gameMode==="ai"&&gStatus==="playing"&&isMyTurn&&!aiThink&&<span style={{fontSize:11,color:"#4CAF82",fontWeight:600}}>● Your turn</span>}</div>
              {useTimer&&<div style={{fontSize:16,fontFamily:"monospace",fontWeight:700,color:isMyTurn?"#EDE7D4":"#504C45",background:isMyTurn&&gStatus==="playing"?"rgba(200,168,75,0.1)":"transparent",padding:"3px 10px",borderRadius:8,transition:"background .3s",letterSpacing:"0.04em"}}>{fmtTime(pCol==="w"?timeW:timeB)}</div>}
            </div>
          </div>
          <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",minHeight:SQ*8+60}}>
            <div style={{display:"flex",gap:2,marginBottom:10,background:"rgba(255,255,255,0.04)",borderRadius:10,padding:3}}>
              {[["moves","Moves"],["tutor","✨ Tutor"]].map(([id,label])=>(<button key={id} onClick={()=>setPanelTab(id)} style={{flex:1,padding:"7px 0",fontSize:12,background:panelTab===id?"#161410":"transparent",color:panelTab===id?"#EDE7D4":"#8C8476",border:"none",borderRadius:8,cursor:"pointer",fontWeight:panelTab===id?700:400,boxShadow:panelTab===id?"0 2px 8px rgba(0,0,0,0.3)":"none",transition:"all .15s",fontFamily:"var(--font-sans)"}}>{label}</button>))}
            </div>
            {panelTab==="moves"&&(
              <div ref={moveListRef} style={{flex:1,overflowY:"auto",maxHeight:290}}>
                {movePairs.length===0&&<p style={{fontSize:13,color:"#504C45",fontStyle:"italic",margin:0}}>Waiting for your first move…</p>}
                {movePairs.map((p,i)=>{
                  const wBadge=moveQualities[i*2]??null,bBadge=moveQualities[i*2+1]??null,isWP=pCol==="w";
                  return(<div key={p.n} className="move-row" style={{display:"flex",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.04)",padding:"4px 0",borderRadius:4}}>
                    <span style={{width:28,fontSize:11,color:"#504C45",flexShrink:0,fontFamily:"monospace"}}>{p.n}.</span>
                    <span style={{flex:1,fontSize:13,fontFamily:"monospace",fontWeight:600,color:"#EDE7D4",padding:"2px 4px"}}>{p.w}</span>
                    {isWP&&wBadge?<span style={{fontSize:11,fontWeight:700,color:wBadge.color,marginRight:2,flexShrink:0,width:16}}>{wBadge.sym}</span>:<span style={{width:12,flexShrink:0}}/>}
                    <span style={{flex:1,fontSize:13,fontFamily:"monospace",color:"#8C8476",padding:"2px 4px"}}>{p.b??""}</span>
                    {!isWP&&bBadge&&<span style={{fontSize:11,fontWeight:700,color:bBadge.color,marginRight:2,flexShrink:0,width:16}}>{bBadge.sym}</span>}
                  </div>);
                })}
              </div>
            )}
            {panelTab==="tutor"&&<div style={{flex:1}}><TutorChat height={290} placeholder="Ask about this position…"/></div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:12}}>
              <button onClick={undoMove} disabled={hist.length<2||gameOver} style={{padding:"9px 0",fontSize:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:100,cursor:hist.length<2||gameOver?"default":"pointer",color:"#8C8476",opacity:hist.length<2||gameOver?0.35:1,fontFamily:"var(--font-sans)",fontWeight:500}}>↩ Undo</button>
              <button onClick={showHint} disabled={gameOver||aiThink||gameMode==="p2p"} style={{padding:"9px 0",fontSize:12,background:hintSq?"rgba(200,168,75,0.1)":"rgba(255,255,255,0.04)",border:`1px solid ${hintSq?"rgba(200,168,75,0.4)":"rgba(255,255,255,0.07)"}`,borderRadius:100,cursor:"pointer",color:hintSq?"#C8A84B":"#8C8476",opacity:gameOver||aiThink||gameMode==="p2p"?0.35:1,fontFamily:"var(--font-sans)",fontWeight:500}}>💡 Hint</button>
              <button onClick={resign} disabled={gameOver||hist.length<2} style={{padding:"9px 0",fontSize:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:100,cursor:"pointer",color:"#8C8476",opacity:gameOver||hist.length<2?0.35:1,fontFamily:"var(--font-sans)",fontWeight:500}}>🏳 Resign</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6}}>
              <button onClick={startGame} style={{padding:"9px 0",fontSize:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:100,cursor:"pointer",color:"#8C8476",fontFamily:"var(--font-sans)",fontWeight:500}}>↺ New Game</button>
              <button onClick={()=>setScreen("play_setup")} style={{padding:"9px 0",fontSize:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:100,cursor:"pointer",color:"#8C8476",fontFamily:"var(--font-sans)",fontWeight:500}}>⚙ Setup</button>
            </div>
            <div style={{marginTop:10,padding:"8px 10px",background:"rgba(255,255,255,0.03)",borderRadius:10,display:"flex",flexWrap:"wrap",gap:"5px 10px"}}>
              {[["U","Undo"],["H","Hint"],["F","Flip"],["N","New"],["Esc","Menu"]].map(([k,label])=>(<div key={k} style={{display:"flex",alignItems:"center",gap:4}}><span className="kbd">{k}</span><span style={{fontSize:11,color:"#504C45"}}>{label}</span></div>))}
            </div>
          </div>
        </div>
        <GhostPiece/>
      </div>
    );
  }

  // ── PUZZLES ───────────────────────────────────────────────────
  if(screen==="puzzles"){
    const cats=["All",...new Set(PUZZLES.map(p=>p.cat))];
    return(<>
    <div style={{padding:"0.5rem 0 5rem",fontFamily:"var(--font-sans)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <button onClick={()=>setScreen("menu")} style={{fontSize:12,padding:"6px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:100,cursor:"pointer",color:"#8C8476",fontFamily:"var(--font-sans)"}}>← Menu</button>
        <h1 style={{fontSize:19,fontWeight:700,color:"#EDE7D4",flex:1,fontFamily:"Cormorant,serif"}}>🧩 Puzzle Trainer</h1>
        <div style={{fontSize:13,padding:"4px 12px",background:streak>0?"rgba(224,140,48,0.1)":"rgba(255,255,255,0.04)",borderRadius:20,color:streak>0?"#E08C30":"#8C8476",fontWeight:600}}>{streak>0?`🔥 ${streak} streak`:"No streak"}</div>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
        {cats.map(c=>(<button key={c} onClick={()=>{setPzFilter(c);if(!pz)randomPuzzle(c);}} style={{fontSize:12,padding:"5px 12px",borderRadius:20,border:"none",background:pzFilter===c?"rgba(192,74,144,0.15)":"rgba(255,255,255,0.04)",color:pzFilter===c?"#C04A90":"#8C8476",cursor:"pointer",fontWeight:pzFilter===c?700:400,outline:pzFilter===c?"2px solid rgba(192,74,144,0.4)":"2px solid transparent",fontFamily:"var(--font-sans)"}}>{c}</button>))}
      </div>
      {!pz?(
        <div style={{textAlign:"center",padding:"3rem 1rem"}}>
          <div style={{fontSize:52,marginBottom:16}}>🧩</div>
          <div style={{fontSize:17,fontWeight:700,color:"#EDE7D4",marginBottom:8,fontFamily:"Cormorant,serif"}}>Ready for a puzzle?</div>
          <button onClick={()=>randomPuzzle()} style={{padding:"11px 28px",background:"linear-gradient(135deg,#C8A84B,#E2C870)",color:"#1A1510",border:"none",borderRadius:100,fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px rgba(200,168,75,0.35)",fontFamily:"var(--font-sans)"}}>Start Puzzle</button>
        </div>
      ):(
        <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
          <div style={{flexShrink:0}}>
            <Board brd={pzBoard} onSq={handlePzClick} selSq={pzSel} legalSqs={pzLegal} lastMove={pzLastMv} noFlip={true} onPieceDragStart={pzDragStart}/>
            <div style={{marginTop:8,display:"flex",gap:6}}>
              <button onClick={()=>randomPuzzle()} style={{flex:1,padding:"8px",fontSize:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:100,cursor:"pointer",color:"#8C8476",fontFamily:"var(--font-sans)"}}>↺ Next</button>
              <button onClick={()=>setPzHint(true)} disabled={pzHint} style={{flex:1,padding:"8px",fontSize:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:100,cursor:"pointer",color:"#8C8476",opacity:pzHint?0.4:1,fontFamily:"var(--font-sans)"}}>💡 Hint</button>
            </div>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{marginBottom:10,padding:"12px 16px",borderRadius:14,background:pzStatus==="solved"?"rgba(76,175,130,0.09)":pzStatus==="wrong"?"rgba(224,85,85,0.08)":"rgba(255,255,255,0.03)",borderTop:`1px solid ${pzStatus==="solved"?"rgba(76,175,130,0.25)":pzStatus==="wrong"?"rgba(224,85,85,0.2)":"rgba(255,255,255,0.06)"}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>{pzStatus==="solved"?"🎉":pzStatus==="wrong"?"❌":pzStatus==="correct"?"✓":"🧩"}</span>
                <div><div style={{fontSize:14,fontWeight:700,color:"#EDE7D4",fontFamily:"Cormorant,serif"}}>{pzStatus==="solved"?"Puzzle solved!":pzStatus==="wrong"?"Wrong — try again!":pzStatus==="correct"?"Good move! Keep going…":`${pz.cat} puzzle`}</div><div style={{fontSize:12,color:"#8C8476",marginTop:1}}>{(pzStatus==="idle"||pzStatus==="correct")&&`Find the best move for ${pzRef.current?.turn()==="w"?"White":"Black"}!`}{pzStatus==="solved"&&`Streak: ${streak} 🔥`}</div></div>
              </div>
            </div>
            <div style={{background:"#161410",borderRadius:14,padding:"1rem",marginBottom:10,boxShadow:"0 1px 0 rgba(255,255,255,0.04) inset,0 4px 16px rgba(0,0,0,0.3)"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:11,padding:"3px 9px",background:"rgba(192,74,144,0.12)",color:"#C04A90",borderRadius:100,fontWeight:700}}>{pz.cat}</span><span style={{fontSize:11,color:"#504C45"}}>{Array(pz.diff).fill("★").join("")}{Array(3-pz.diff).fill("☆").join("")}</span></div>
              {pzHint?<p style={{fontSize:13,color:"#8C8476",lineHeight:1.6,margin:0}}>💡 {pz.hint}</p>:<p style={{fontSize:13,color:"#504C45",fontStyle:"italic",margin:0}}>Click Hint if you're stuck!</p>}
              {pzStatus==="wrong"&&<button onClick={()=>loadPuzzle(pz)} style={{marginTop:10,width:"100%",padding:"8px",fontSize:13,background:"rgba(224,85,85,0.08)",border:"1px solid rgba(224,85,85,0.2)",color:"#E05555",borderRadius:100,cursor:"pointer",fontFamily:"var(--font-sans)"}}>↺ Reset Puzzle</button>}
              {pzStatus==="solved"&&<button onClick={()=>randomPuzzle()} style={{marginTop:10,width:"100%",padding:"8px",fontSize:13,background:"linear-gradient(135deg,#C8A84B,#E2C870)",color:"#1A1510",border:"none",borderRadius:100,cursor:"pointer",fontWeight:700,fontFamily:"var(--font-sans)"}}>Next Puzzle →</button>}
            </div>
            <div style={{background:"#161410",borderRadius:12,padding:"0.75rem 1rem",marginBottom:10,boxShadow:"0 1px 0 rgba(255,255,255,0.03) inset,0 3px 12px rgba(0,0,0,0.28)"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#8C8476",marginBottom:6}}><span>Puzzles solved</span><span style={{fontWeight:600,color:"#EDE7D4"}}>{solvedPz.size} / {PUZZLES.length}</span></div>
              <div style={{height:5,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${(solvedPz.size/PUZZLES.length)*100}%`,background:"linear-gradient(90deg,#C8A84B,#E2C870)",borderRadius:3,transition:"width .5s ease"}}/></div>
            </div>
            <div style={{background:"#161410",borderRadius:14,padding:"0.75rem",boxShadow:"0 1px 0 rgba(255,255,255,0.03) inset,0 3px 12px rgba(0,0,0,0.28)"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#EDE7D4",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>✨ Ask the Tutor</div>
              <TutorChat height={160} placeholder="Ask about this tactic…"/>
            </div>
          </div>
        </div>
      )}
    </div>
    <BottomNav/>
    </>);
  }

  // ── LEARN ────────────────────────────────────────────────────
  const pct=Math.round((doneLessons.size/LESSONS.length)*100);
  return(<>
    <div style={{padding:"0.5rem 0 5rem",fontFamily:"var(--font-sans)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <button onClick={()=>setScreen("menu")} style={{fontSize:12,padding:"6px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:100,cursor:"pointer",color:"#8C8476",fontFamily:"var(--font-sans)",flexShrink:0}}>← Menu</button>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {[["beginner","🌱 Beginner"],["intermediate","⚡ Intermediate"],["advanced","🏆 Advanced"]].map(([id,label])=>(<button key={id} onClick={()=>{setLTrack(id);setLIdx(0);}} style={{fontSize:12,padding:"5px 12px",borderRadius:20,border:"none",background:lTrack===id?"rgba(76,175,130,0.12)":"rgba(255,255,255,0.04)",color:lTrack===id?"#4CAF82":"#8C8476",cursor:"pointer",fontWeight:lTrack===id?700:400,outline:lTrack===id?"2px solid rgba(76,175,130,0.35)":"2px solid transparent",fontFamily:"var(--font-sans)"}}>{label}</button>))}
        </div>
        <div style={{flex:1,fontSize:12,color:"#504C45",textAlign:"right"}}>{pct}% complete</div>
      </div>
      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
        <div style={{flexShrink:0}}>
          <div style={{fontSize:11,color:"#504C45",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600}}>Interactive board</div>
          <Board brd={lBoard} onSq={handleLClick} selSq={lSel} legalSqs={lLegal} lastMove={null} noFlip={true} onPieceDragStart={learnDragStart}/>
          <button onClick={()=>loadLesson(curLesson)} style={{marginTop:7,width:"100%",padding:"7px 0",fontSize:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:100,cursor:"pointer",color:"#8C8476",fontFamily:"var(--font-sans)"}}>↺ Reset position</button>
        </div>
        <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>setLIdx(i=>Math.max(0,i-1))} disabled={lIdx===0} style={{padding:"6px 14px",fontSize:14,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:100,cursor:lIdx===0?"default":"pointer",color:"#8C8476",opacity:lIdx===0?0.3:1,fontFamily:"var(--font-sans)"}}>←</button>
            <span style={{flex:1,textAlign:"center",fontSize:12,color:"#504C45"}}>Lesson {lIdx+1} of {trackLessons.length}</span>
            <button onClick={()=>setLIdx(i=>Math.min(trackLessons.length-1,i+1))} disabled={lIdx>=trackLessons.length-1} style={{padding:"6px 14px",fontSize:14,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:100,cursor:lIdx>=trackLessons.length-1?"default":"pointer",color:"#8C8476",opacity:lIdx>=trackLessons.length-1?0.3:1,fontFamily:"var(--font-sans)"}}>→</button>
          </div>
          <div style={{display:"flex",gap:"5px 10px",flexWrap:"wrap"}}>
            {[["←→","Navigate"],["R","Reset"],["Esc","Menu"]].map(([k,label])=>(<div key={k} style={{display:"flex",alignItems:"center",gap:4}}><span className="kbd">{k}</span><span style={{fontSize:11,color:"#504C45"}}>{label}</span></div>))}
          </div>
          <div style={{background:"#161410",borderRadius:16,padding:"1.25rem 1.5rem",boxShadow:"0 1px 0 rgba(255,255,255,0.04) inset,0 8px 32px rgba(0,0,0,0.4)"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
              <span style={{fontSize:24,flexShrink:0}}>{curLesson.icon}</span>
              <div style={{flex:1}}><div style={{fontSize:17,fontWeight:700,color:"#EDE7D4",marginBottom:5,fontFamily:"Cormorant,serif"}}>{curLesson.title}</div><span style={{fontSize:11,padding:"2px 8px",background:"rgba(76,175,130,0.1)",color:"#4CAF82",borderRadius:100,fontWeight:600,textTransform:"capitalize"}}>{curLesson.track}</span></div>
              {doneLessons.has(curLesson.id)&&<span style={{fontSize:16,color:"#4CAF82",flexShrink:0}}>✓</span>}
            </div>
            <p style={{fontSize:13,lineHeight:1.72,color:"#EDE7D4",margin:"0 0 14px"}}>{curLesson.body}</p>
            <div style={{fontSize:12,color:"#8C8476",background:"rgba(255,255,255,0.03)",padding:"10px 14px",borderRadius:10,borderLeft:"3px solid rgba(76,175,130,0.4)",lineHeight:1.6}}>💡 {curLesson.tip}</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={markDone} style={{flex:1,padding:"10px",background:doneLessons.has(curLesson.id)?"rgba(255,255,255,0.04)":"linear-gradient(135deg,#C8A84B,#E2C870)",color:doneLessons.has(curLesson.id)?"#8C8476":"#1A1510",border:doneLessons.has(curLesson.id)?"1px solid rgba(255,255,255,0.07)":"none",borderRadius:100,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"var(--font-sans)",boxShadow:doneLessons.has(curLesson.id)?"none":"0 4px 16px rgba(200,168,75,0.3)"}}>{doneLessons.has(curLesson.id)?"✓ Completed":"Mark Complete →"}</button>
            <button onClick={()=>{setGameMode("ai");setDiff(lTrack==="beginner"?0:lTrack==="intermediate"?2:3);startGame();}} style={{flex:1,padding:"10px",background:"rgba(255,255,255,0.06)",color:"#EDE7D4",border:"1px solid rgba(255,255,255,0.09)",borderRadius:100,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"var(--font-sans)"}}>Practice → Play</button>
          </div>
          <div style={{background:"#161410",borderRadius:14,padding:"0.75rem",boxShadow:"0 1px 0 rgba(255,255,255,0.03) inset,0 3px 12px rgba(0,0,0,0.28)"}}>
            <div style={{fontSize:11,color:"#504C45",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>All {lTrack} lessons</div>
            <div style={{display:"flex",flexDirection:"column",gap:1,maxHeight:200,overflowY:"auto"}}>
              {trackLessons.map((l,i)=>(<button key={l.id} onClick={()=>setLIdx(i)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:10,background:i===lIdx?"rgba(200,168,75,0.08)":"transparent",border:"none",cursor:"pointer",textAlign:"left",width:"100%",fontFamily:"var(--font-sans)"}}><span style={{fontSize:12,width:18,flexShrink:0}}>{l.icon}</span><span style={{fontSize:13,color:i===lIdx?"#EDE7D4":"#8C8476",fontWeight:i===lIdx?600:400,flex:1}}>{l.title}</span>{doneLessons.has(l.id)?<span style={{fontSize:12,color:"#4CAF82"}}>✓</span>:i===lIdx?<span style={{width:6,height:6,borderRadius:"50%",background:"#C8A84B",display:"inline-block"}}/>:null}</button>))}
            </div>
          </div>
          <div style={{background:"#161410",borderRadius:14,padding:"0.75rem",boxShadow:"0 1px 0 rgba(255,255,255,0.03) inset,0 3px 12px rgba(0,0,0,0.28)"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#EDE7D4",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>✨ AI Tutor</div>
            <TutorChat height={190} placeholder={`Ask about "${curLesson?.title}"…`}/>
          </div>
        </div>
      </div>
    </div>
    <BottomNav/>
  </>);
}
