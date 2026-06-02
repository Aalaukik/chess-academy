import { useState, useEffect, useRef } from "react";
import { useSupabaseProgress } from "./useSupabaseProgress";
import ProfileScreen from "./ProfileScreen";
import OnlineScreen from "./OnlineScreen";
import OnlinePlayScreen from "./OnlinePlayScreen";

// ════════════════════════════════════════════════════════════════
//  1. CHESS AI — Minimax + Alpha-Beta Pruning  (unchanged logic)
// ════════════════════════════════════════════════════════════════
const PV = { p:100, n:320, b:330, r:500, q:900, k:20000 };
const PST = {
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
  {depth:1,rand:0.90,label:"Beginner",    desc:"Mostly random moves",    color:"#52C990"},
  {depth:1,rand:0.42,label:"Casual",      desc:"Basic piece awareness",  color:"#6BB5F0"},
  {depth:2,rand:0.14,label:"Intermediate",desc:"Plans 2–3 moves ahead",  color:"#D4A843"},
  {depth:3,rand:0.04,label:"Advanced",    desc:"Strong tactical play",   color:"#F08C4A"},
  {depth:4,rand:0,   label:"Master",      desc:"Full engine strength",   color:"#E85A5A"},
];
const DIFF_ELO=[800,1000,1200,1600,2000];
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
//  2. SOUND ENGINE
// ════════════════════════════════════════════════════════════════
function mkSound(){
  let ctx=null;
  const gc=()=>{if(!ctx)ctx=new(window.AudioContext||window.webkitAudioContext)();return ctx;};
  function tone(freq,dur,type="sine",vol=0.16){
    try{const c=gc(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);g.gain.setValueAtTime(vol,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);o.start(c.currentTime);o.stop(c.currentTime+dur);}catch{}
  }
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

// ════════════════════════════════════════════════════════════════
//  3. DATA
// ════════════════════════════════════════════════════════════════
const UNI={wK:"♔",wQ:"♕",wR:"♖",wB:"♗",wN:"♘",wP:"♙",bK:"♚",bQ:"♛",bR:"♜",bB:"♝",bN:"♞",bP:"♟"};

const THEMES={
  obsidian:{l:"#3D3530",d:"#1C1714",sel:"rgba(212,168,67,.85)",hint:"rgba(212,168,67,.38)",last:"rgba(212,168,67,.26)",bdr:"#4A3D30",name:"Obsidian"},
  walnut:  {l:"#F0D9B5",d:"#B58863",sel:"rgba(246,246,60,.82)",hint:"rgba(20,85,30,.52)",last:"rgba(246,246,60,.40)",bdr:"#8B6B40",name:"Walnut"},
  slate:   {l:"#DEE3E6",d:"#8CA2AD",sel:"rgba(60,180,255,.82)",hint:"rgba(0,100,220,.45)",last:"rgba(60,180,255,.35)",bdr:"#6A8A9A",name:"Slate"},
  jade:    {l:"#FFFFDD",d:"#86A666",sel:"rgba(200,245,60,.85)",hint:"rgba(50,130,20,.50)",last:"rgba(200,245,60,.40)",bdr:"#627A45",name:"Jade"},
  midnight:{l:"#4A4A6A",d:"#1E1A3A",sel:"rgba(155,205,255,.85)",hint:"rgba(100,170,255,.42)",last:"rgba(155,205,255,.32)",bdr:"#2A2460",name:"Midnight"},
  rose:    {l:"#F4DDE0",d:"#C47A85",sel:"rgba(255,230,60,.82)",hint:"rgba(180,50,60,.40)",last:"rgba(255,230,60,.38)",bdr:"#A05065",name:"Rose"},
  ocean:   {l:"#D6EEF8",d:"#2E7EA8",sel:"rgba(255,236,60,.85)",hint:"rgba(0,160,200,.50)",last:"rgba(255,236,60,.40)",bdr:"#1A5F82",name:"Ocean"},
  forest:  {l:"#E8F0D8",d:"#4A7C3F",sel:"rgba(255,240,60,.85)",hint:"rgba(30,100,20,.52)",last:"rgba(255,240,60,.38)",bdr:"#2D5A24",name:"Forest"},
};

const OPENINGS={"e4 e5":"Open Game","e4 e5 Nf3 Nc6 Bc4":"Italian Game","e4 e5 Nf3 Nc6 Bb5":"Ruy López","e4 e6":"French Defense","e4 c5":"Sicilian Defense","e4 c6":"Caro-Kann","d4 d5":"Queen's Gambit","d4 d5 c4":"Queen's Gambit","d4 Nf6":"Indian Defense","d4 Nf6 c4 g6":"King's Indian","Nf3":"Réti Opening","c4":"English Opening"};
function detectOpening(hist){const mv=hist.map(m=>m.san).join(" ");let match="";for(const[k]of Object.entries(OPENINGS))if(mv.startsWith(k)&&k.length>match.length)match=k;return match?OPENINGS[match]:(hist.length>0?"Custom Opening":"");}

const LESSONS=[
  {id:0,track:"beginner",icon:"♟",title:"The Chessboard",fen:"4k3/8/8/8/8/8/8/4K3 w - - 0 1",body:"A chessboard has 64 squares in an 8×8 grid. Files (columns) are labeled a–h left to right. Ranks (rows) are numbered 1–8 from White's side upward. The golden rule: 'light on right' — the bottom-right corner must always be a light square.",tip:"Squares are named by file + rank, e.g. e4, d5, g7. Every square has a unique name."},
  {id:1,track:"beginner",icon:"♙",title:"Pawn Power",fen:"4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1",body:"Pawns march forward — one square at a time, or two squares from their starting rank. They capture diagonally forward. A pawn reaching the 8th rank promotes to any piece (almost always a queen!). Pawns cannot retreat, so every pawn move is permanent.",tip:"En passant: if an enemy pawn moves two squares past yours on an adjacent file, you can capture it as if it moved only one square — but only immediately!"},
  {id:2,track:"beginner",icon:"♘",title:"The Knight's Dance",fen:"4k3/8/8/8/4N3/8/8/4K3 w - - 0 1",body:"Knights move in an L-shape — two squares in one direction, one perpendicular. They're the only pieces that jump over others. This makes knights especially deadly in closed positions where other pieces are blocked.",tip:"A knight in the center controls up to 8 squares. On the rim it controls only 2–4. 'A knight on the rim is dim!'"},
  {id:3,track:"beginner",icon:"♗",title:"Bishop Diagonals",fen:"4k3/8/8/8/4B3/8/8/4K3 w - - 0 1",body:"Bishops slide diagonally any number of squares and stay forever on their starting color. You have one light-squared and one dark-squared bishop. They shine in open positions with long, unobstructed diagonals.",tip:"The bishop pair — both bishops working together — is a major strategic advantage, controlling squares of both colors."},
  {id:4,track:"beginner",icon:"♖",title:"Rooks Rule Open Files",fen:"4k3/8/8/8/4R3/8/8/4K3 w - - 0 1",body:"Rooks slide horizontally or vertically any number of squares. They're most powerful on open files (no pawns blocking) and the 7th rank, where they attack the opponent's unadvanced pawns from behind. Two rooks doubled on a file are devastating.",tip:"Place rooks on open files early. Connecting your rooks (castling and clearing the back rank) is a key opening goal."},
  {id:5,track:"beginner",icon:"♕",title:"Queen Supremacy",fen:"4k3/8/8/8/4Q3/8/8/4K3 w - - 0 1",body:"The queen combines the rook and bishop — she moves any number of squares in any direction. Worth roughly 9 pawns, she's by far the most powerful piece. Losing her without compensation almost always loses the game.",tip:"Don't bring the queen out too early — she can be chased by enemy pieces and you'll lose precious tempo."},
  {id:6,track:"beginner",icon:"♔",title:"Check, Checkmate & Stalemate",fen:"4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1",body:"When the king is under direct attack it's 'check' — you must escape by moving the king, blocking the attack, or capturing the attacker. If no escape exists: checkmate — game over! If the king isn't in check but has no legal move: stalemate — a draw.",tip:"Three ways to escape check: (1) move the king, (2) block the attacker, (3) capture the attacker."},
  {id:7,track:"beginner",icon:"♙",title:"Three Opening Rules",fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",body:"Three golden principles: (1) Control the center — play 1.e4 or 1.d4. (2) Develop all pieces — get knights and bishops to active squares quickly. (3) Castle early — protect your king behind pawns.",tip:"Don't move the same piece twice in the opening unless absolutely necessary — every move should develop a new piece."},
  {id:8,track:"intermediate",icon:"♙",title:"Center Control",fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",body:"The four central squares — d4, e4, d5, e5 — are the most important battlefield. Pieces controlling the center dominate more of the board and restrict the opponent. Fight for the center from move one with pawns and pieces.",tip:"A pawn on e4 controls d5 and f5. A piece in the center has more scope than one on the edge."},
  {id:9,track:"intermediate",icon:"♞",title:"Tactics: The Fork",fen:"r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/5N2/PPPP1PPP/RNBQKBNR w KQkq - 2 3",body:"A fork attacks two or more enemy pieces simultaneously with one move — the opponent can only save one. Knights are the best forking pieces because of their unpredictable L-shape. Always scan for fork opportunities on every move!",tip:"Look for undefended pieces as fork targets. An undefended knight or bishop next to an undefended rook or queen is a fork waiting to happen."},
  {id:10,track:"intermediate",icon:"♗",title:"Tactics: The Pin",fen:"rnb1kbnr/pp1ppppp/8/q1p5/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 1 3",body:"A pin prevents a piece from moving because moving it would expose a more valuable piece behind it. An 'absolute pin' against the king means the piece literally cannot legally move.",tip:"A pinned piece cannot defend other pieces! Exploit this by attacking other targets while the pin keeps the defender stuck."},
  {id:11,track:"intermediate",icon:"♔",title:"Castling: King Safety",fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5",body:"Castling moves the king two squares toward a rook — the rook jumps over to the other side. Castle kingside (O-O) or queenside (O-O-O). Castle early to protect your king!",tip:"After castling, avoid pushing h3/g3 (or h6/g6) without good reason — those moves weaken your king's shelter."},
  {id:12,track:"intermediate",icon:"♙",title:"Discovered Attacks",fen:"rnbqk2r/ppp2ppp/3p1n2/4p3/1bB1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5",body:"A discovered attack happens when you move one piece to reveal an attack from a piece behind it. The moved piece can simultaneously attack a different target.",tip:"Scan your pieces for 'hidden attackers' — pieces that would attack a valuable target if another piece moved out of the way."},
  {id:13,track:"advanced",icon:"♙",title:"Pawn Structure",fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",body:"Pawns are permanent — they cannot retreat. Weak pawn structures haunt you all game. Doubled pawns reduce rook mobility. Isolated pawns become permanent targets. A passed pawn is a powerful long-term asset.",tip:"Think carefully before every pawn move — that decision can never be undone!"},
  {id:14,track:"advanced",icon:"♖",title:"Tactics: The Skewer",fen:"6k1/6pp/8/1b6/8/8/6PP/R5K1 w - - 0 1",body:"A skewer is the reverse of a pin — you attack a valuable piece that must move, exposing a less valuable piece behind it, which you then capture. Rooks, bishops, and queens can execute skewers.",tip:"After forcing the valuable piece to move, capture what was behind it. The 'prize' in a skewer is always the second piece."},
  {id:15,track:"advanced",icon:"♔",title:"King & Pawn Endgames",fen:"8/8/3k4/8/8/3K4/4P3/8 w - - 0 1",body:"In the endgame, the king becomes an active fighting piece! Key concepts: 'opposition' (kings facing with one square between), the 'rule of the square', and escorting pawns to promotion.",tip:"In king-and-pawn endings, getting your king in front of your own pawn (with the opposition) is usually the winning technique."},
  {id:16,track:"advanced",icon:"♗",title:"Opening Systems",fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",body:"Rather than memorizing every variation, master the principles behind openings: develop all pieces to active squares, fight for the center, castle early, then connect your rooks.",tip:"Always ask 'why?' for every opening move. Understanding the plan behind each move is far more powerful than memorizing sequences."},
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
  const[theme,setTheme]=useState("obsidian");
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

  useEffect(()=>{
    import("https://esm.sh/chess.js@1.1.0")
      .then(m=>{ChessLib.current=m.Chess;setLoaded(true);})
      .catch(()=>setLoadErr(true));
  },[]);

  useEffect(()=>{
    if(user) return;
    (async()=>{try{const r=await window.storage?.get("chess_v2");if(r?.value){const p=JSON.parse(r.value);if(p.done)setDoneLessons(new Set(p.done));if(p.solved)setSolvedPz(new Set(p.solved));if(p.streak)setStreak(p.streak);if(p.stats)setStats(p.stats);if(p.elo)setElo(p.elo);}}catch{}})();
  },[]);

  async function saveProgress(dl=doneLessons,sp=solvedPz,sk=streak,st=stats,el=elo){
    if(user) return;
    try{await window.storage?.set("chess_v2",JSON.stringify({done:[...dl],solved:[...sp],streak:sk,stats:st,elo:el}));}catch{}
  }

  const gameStartTime=useRef(null);
  const{saveGame}=useSupabaseProgress({user,setDoneLessons,setSolvedPz,setStreak,setStats,setElo,doneLessons,solvedPz,streak,stats,elo});

  function play(k){if(soundOn)SND[k]?.();}

  function calcNewElo(playerElo,opponentElo,result){
    const K=32,expected=1/(1+Math.pow(10,(opponentElo-playerElo)/400));
    return Math.round(playerElo+K*(result-expected));
  }

  function classifyMove(evalBefore,evalAfter,playerColor){
    const sign=playerColor==="w"?1:-1;
    const delta=(evalAfter-evalBefore)*sign;
    if(delta>=0)    return{label:"Best",      sym:"!",   color:"#52C990",bg:"rgba(82,201,144,.18)"};
    if(delta>=-15)  return{label:"Good",       sym:"✓",   color:"#52C990",bg:"rgba(82,201,144,.14)"};
    if(delta>=-50)  return{label:"Inaccuracy", sym:"?",   color:"#D4A843",bg:"rgba(212,168,67,.15)"};
    if(delta>=-150) return{label:"Mistake",    sym:"??",  color:"#F08C4A",bg:"rgba(240,140,74,.15)"};
    return              {label:"Blunder",    sym:"???", color:"#E85A5A",bg:"rgba(232,90,90,.15)"};
  }

  const flippedRef=useRef(flipped);
  useEffect(()=>{flippedRef.current=flipped;},[flipped]);

  function getSqFromPos(clientX,clientY,rect,fl){
    const coordOff=showCoords?18:0,borderOff=2;
    const relX=clientX-rect.left-borderOff-coordOff,relY=clientY-rect.top-borderOff;
    const ci=Math.floor(relX/SQ),ri=Math.floor(relY/SQ);
    if(ci<0||ci>7||ri<0||ri>7) return null;
    return`${String.fromCharCode(97+(fl?7-ci:ci))}${8-(fl?7-ri:ri)}`;
  }

  function startGenericDrag(e,sq,piece,dropHandler,isFlipped=false){
    if(e.touches)e.preventDefault();
    const clientX=e.touches?e.touches[0].clientX:e.clientX;
    const clientY=e.touches?e.touches[0].clientY:e.clientY;
    let el=e.target;
    while(el&&el.getAttribute?.("data-chess-board")!=="1")el=el.parentElement;
    dragRef.current={from:sq,startX:clientX,startY:clientY,moved:false,boardEl:el,dropHandler,isFlipped};
    setGhostState({x:clientX,y:clientY,pk:`${piece.color}${piece.type.toUpperCase()}`,isW:piece.color==="w"});
  }

  function playDragStart(e,sq){
    const g=gRef.current;
    if(!g||gStatus!=="playing"||aiThink||promoDialog)return;
    const piece=g.get(sq);
    const activeTurn=g.turn();
    const canDrag=gameMode==="p2p"?piece&&piece.color===activeTurn:piece&&piece.color===pCol;
    if(!canDrag)return;
    setSel(sq);setLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));
    const dropHandler=(from,to)=>{
      const g2=gRef.current;
      if(!g2||gStatus!=="playing"||aiThink){setSel(null);setLegal([]);return;}
      const turn=g2.turn();
      if(gameMode==="ai"&&turn!==pCol){setSel(null);setLegal([]);return;}
      if(!g2.moves({square:from,verbose:true}).map(m=>m.to).includes(to)){setSel(null);setLegal([]);return;}
      const p=g2.get(from);
      if(p?.type==="p"&&((turn==="w"&&to[1]==="8")||(turn==="b"&&to[1]==="1"))){preMoveEval.current=evalPos(g2);setPromoDialog({from,to});setSel(null);setLegal([]);return;}
      const eb=evalPos(g2);const r=g2.move({from,to,promotion:"q"});
      if(r){
        const badge=classifyMove(eb,evalPos(g2),turn);
        setMoveQualities(q=>[...q,badge]);setLastBadge(badge);setTimeout(()=>setLastBadge(null),2200);
        setLastMv({from:r.from,to:r.to});setSel(null);setLegal([]);setHintSq(null);
        if(r.captured)play("capture");else if(r.flags.includes("k")||r.flags.includes("q"))play("castle");else play("move");
        if(g2.inCheck())play("check");syncGame(g2);
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
      const r=g2.move({from,to,promotion:"q"});if(!r){setPzSel(null);setPzLegal([]);return;}
      setPzLastMv({from:r.from,to:r.to});setPzBoard([...g2.board()]);setPzSel(null);setPzLegal([]);
      const expected=pz.sol[pzMvIdx];
      if(r.san===expected||r.from+r.to===expected||r.from+r.to+(r.promotion||"")===expected){
        const next=pzMvIdx+1;
        if(next>=pz.sol.length){
          setPzStatus("solved");play("pzOk");
          const sk=streak+1;setStreak(sk);const ns=new Set(solvedPz);ns.add(pz.id);setSolvedPz(ns);saveProgress(undefined,ns,sk,undefined);
        }else{
          setPzMvIdx(next);setPzStatus("correct");play("move");
          if(pz.sol[next])setTimeout(()=>{const opp=g2.move(pz.sol[next]);if(opp){setPzLastMv({from:opp.from,to:opp.to});setPzBoard([...g2.board()]);setPzMvIdx(next+1);setPzStatus("idle");}},600);
        }
      }else{
        g2.undo();setPzBoard([...g2.board()]);setPzLastMv(null);setPzStatus("wrong");play("pzFail");
        const sk=0;setStreak(sk);saveProgress(undefined,undefined,sk,undefined);
      }
    },false);
  }

  function onDragMove(e){
    if(!dragRef.current)return;if(e.cancelable)e.preventDefault();
    const clientX=e.touches?e.touches[0].clientX:e.clientX;
    const clientY=e.touches?e.touches[0].clientY:e.clientY;
    if(!dragRef.current.moved){const dx=clientX-dragRef.current.startX,dy=clientY-dragRef.current.startY;if(Math.abs(dx)>5||Math.abs(dy)>5)dragRef.current.moved=true;}
    setGhostState(s=>s?{...s,x:clientX,y:clientY}:null);
  }

  function onDragEnd(e){
    if(!dragRef.current)return;
    const{from,moved,boardEl,dropHandler,isFlipped}=dragRef.current;
    dragRef.current=null;setGhostState(null);
    if(!moved)return;
    dragJustMoved.current=true;setTimeout(()=>{dragJustMoved.current=false;},150);
    const clientX=e.changedTouches?e.changedTouches[0].clientX:e.clientX;
    const clientY=e.changedTouches?e.changedTouches[0].clientY:e.clientY;
    if(!boardEl){setSel(null);setLegal([]);return;}
    const to=getSqFromPos(clientX,clientY,boardEl.getBoundingClientRect(),isFlipped);
    if(!to||to===from){setSel(null);setLegal([]);return;}
    dropHandler?.(from,to);
  }

  dragHandlersRef.current={onDragMove,onDragEnd};
  useEffect(()=>{
    const mm=(e)=>dragHandlersRef.current.onDragMove(e);
    const mu=(e)=>dragHandlersRef.current.onDragEnd(e);
    window.addEventListener("mousemove",mm);window.addEventListener("mouseup",mu);
    window.addEventListener("touchmove",mm,{passive:false});window.addEventListener("touchend",mu);
    return()=>{window.removeEventListener("mousemove",mm);window.removeEventListener("mouseup",mu);window.removeEventListener("touchmove",mm);window.removeEventListener("touchend",mu);};
  },[]);

  function computeAccuracy(q){if(!q.length)return null;const W={Best:100,Good:90,Inaccuracy:70,Mistake:40,Blunder:0};return Math.round(q.reduce((s,x)=>s+(W[x.label]??50),0)/q.length);}

  function generateShareText(){
    const acc=computeAccuracy(moveQualities);
    const iWon=winner===(pCol==="w"?"White":"Black");
    const rl=gStatus==="checkmate"?(iWon?"🏆 Victory!":"💀 Defeat"):gStatus==="draw"||gStatus==="stalemate"?"🤝 Draw":"🏳 Resigned";
    const good=moveQualities.filter(m=>m.label==="Best"||m.label==="Good").length;
    const inac=moveQualities.filter(m=>m.label==="Inaccuracy").length;
    const mist=moveQualities.filter(m=>m.label==="Mistake").length;
    const blun=moveQualities.filter(m=>m.label==="Blunder").length;
    return["♟ Chess Academy","",`${rl} vs ${DIFFS[diff].label}`,acc!=null?`Accuracy: ${acc}/100`:"",`${hist.length} moves${opening?" · "+opening:""}`,``,`✓ ${good}   ? ${inac}   ?? ${mist}   ??? ${blun}`,"","https://chess-academy.vercel.app"].join("\n");
  }

  function syncGame(g=gRef.current){
    if(!g)return;
    setBoard([...g.board()]);const h=g.history({verbose:true});setHist([...h]);setInChk(g.inCheck());setOpening(detectOpening(h));
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
    setMsgs([{role:"assistant",content:gameMode==="p2p"?`Pass-and-play started! ${p2pNames.w} (White) moves first. Good luck! ♟`:`Let's play! I'm set to ${DIFFS[diff].label} difficulty. Ask me anything about chess!`}]);
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
    const g=gRef.current;
    if(dragJustMoved.current){dragJustMoved.current=false;return;}
    if(!g||gStatus!=="playing"||aiThink||promoDialog)return;
    const activeTurn=g.turn();if(gameMode==="ai"&&activeTurn!==pCol)return;
    if(sel&&legal.includes(sq)){
      const piece=g.get(sel);
      const isPromo=piece?.type==="p"&&((activeTurn==="w"&&sq[1]==="8")||(activeTurn==="b"&&sq[1]==="1"));
      if(isPromo){preMoveEval.current=evalPos(g);setPromoDialog({from:sel,to:sq});return;}
      const eb=evalPos(g);const r=g.move({from:sel,to:sq,promotion:"q"});
      if(r){
        const badge=classifyMove(eb,evalPos(g),activeTurn);
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
    if(canSelect){setSel(sq);setLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));}
    else{setSel(null);setLegal([]);}
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
    const g=gRef.current;const resignColor=gameMode==="p2p"?(g?.turn()||"w"):pCol;
    const w=resignColor==="w"?"Black":"White";setGStatus("resign");setWinner(w);setTimerOn(false);play("over");
    if(gameMode==="ai"){const ns={...stats,l:stats.l+1};setStats(ns);saveProgress(undefined,undefined,undefined,ns);}
  }

  function showHint(){
    const g=gRef.current;if(!g||gStatus!=="playing")return;
    const mv=getAIMove(g,Math.min(diff+1,4));
    if(mv){const m=g.moves({verbose:true}).find(m=>m.san===mv);if(m)setHintSq(m.from);else{const m2=g.moves({verbose:true})[0];if(m2)setHintSq(m2.from);}}
  }

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
    if(!loaded||!lesson)return;let g;
    try{g=new ChessLib.current(lesson.fen||"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");}catch{g=new ChessLib.current();}
    lgRef.current=g;setLBoard(g.board());setLSel(null);setLLegal([]);
  }
  useEffect(()=>{if(loaded&&screen==="learn")loadLesson(curLesson);},[loaded,lIdx,lTrack,screen]);
  function handleLClick(sq){
    const g=lgRef.current;if(!g)return;
    if(lSel&&lLegal.includes(sq)){const r=g.move({from:lSel,to:sq,promotion:"q"});if(r){setLBoard([...g.board()]);setLSel(null);setLLegal([]);return;}}
    const piece=g.get(sq);if(piece){setLSel(sq);setLLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));}else{setLSel(null);setLLegal([]);}
  }
  function markDone(){const upd=new Set(doneLessons);upd.add(curLesson.id);setDoneLessons(upd);saveProgress(upd);if(lIdx<trackLessons.length-1)setLIdx(lIdx+1);}

  function loadPuzzle(puzzle){
    if(!loaded||!puzzle)return;let g;try{g=new ChessLib.current(puzzle.fen);}catch{return;}
    pzRef.current=g;setPz(puzzle);setPzBoard(g.board());setPzSel(null);setPzLegal([]);setPzLastMv(null);setPzStatus("idle");setPzMvIdx(0);setPzHint(false);
  }
  function randomPuzzle(filter=pzFilter){
    const pool=PUZZLES.filter(p=>filter==="All"||p.cat===filter);
    const unsolved=pool.filter(p=>!solvedPz.has(p.id));const src=unsolved.length?unsolved:pool;
    loadPuzzle(src[Math.floor(Math.random()*src.length)]);
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

  function handlePzClick(sq){
    const g=pzRef.current;if(!g||!pz||pzStatus==="solved"||pzStatus==="wrong")return;
    if(pzSel&&pzLegal.includes(sq)){
      const r=g.move({from:pzSel,to:sq,promotion:"q"});if(!r){setPzSel(null);setPzLegal([]);return;}
      setPzLastMv({from:r.from,to:r.to});setPzBoard([...g.board()]);setPzSel(null);setPzLegal([]);
      const expected=pz.sol[pzMvIdx];
      if(r.san===expected||r.from+r.to===expected||r.from+r.to+r.promotion===expected){
        const next=pzMvIdx+1;
        if(next>=pz.sol.length){setPzStatus("solved");play("pzOk");const sk=streak+1;setStreak(sk);const ns=new Set(solvedPz);ns.add(pz.id);setSolvedPz(ns);saveProgress(undefined,ns,sk,undefined);}
        else{setPzMvIdx(next);setPzStatus("correct");play("move");if(pz.sol[next])setTimeout(()=>{const opp=g.move(pz.sol[next]);if(opp){setPzLastMv({from:opp.from,to:opp.to});setPzBoard([...g.board()]);setPzMvIdx(next+1);setPzStatus("idle");}},600);}
      }else{g.undo();setPzBoard([...g.board()]);setPzLastMv(null);setPzStatus("wrong");play("pzFail");const sk=0;setStreak(sk);saveProgress(undefined,undefined,sk,undefined);}
      return;
    }
    const piece=g.get(sq);if(piece&&piece.color===g.turn()){setPzSel(sq);setPzLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));}else{setPzSel(null);setPzLegal([]);}
  }

  // ── AI Tutor ─────────────────────────────────────────────────
  const lastMsgTime=useRef(0);const tutorCache=useRef({});
  async function sendMsg(){
    const q=tutIn.trim();if(!q)return;
    const now=Date.now();if(now-lastMsgTime.current<3000){setMsgs(p=>[...p,{role:"assistant",content:"⏳ Please wait a moment."}]);return;}
    lastMsgTime.current=now;
    const g=screen==="puzzles"?pzRef.current:screen==="learn"?lgRef.current:gRef.current;
    const fen=g?.fen()??"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const mvs=g?.history().slice(-8).join(" ")||"none";
    const ctx=screen==="learn"?`Current lesson: "${curLesson?.title}". `:screen==="puzzles"&&pz?`Puzzle type: "${pz.cat}". `:"";
    const systemPrompt=`You are an encouraging expert chess tutor. ${ctx}FEN: ${fen}. Recent moves: ${mvs}. Be warm, concise (2-4 sentences). Use chess emojis occasionally.`;
    const cacheKey=`${q}|${fen.slice(0,20)}`;
    if(tutorCache.current[cacheKey]){setMsgs(p=>[...p,{role:"user",content:q},{role:"assistant",content:tutorCache.current[cacheKey]}]);setTutIn("");return;}
    const apiKey=import.meta.env.VITE_GROQ_KEY;
    if(!apiKey){setMsgs(p=>[...p,{role:"assistant",content:"⚠️ Tutor not configured. Add VITE_GROQ_KEY to your environment variables."}]);return;}
    const newMsgs=[...msgs,{role:"user",content:q}];setMsgs(newMsgs);setTutIn("");setTutBusy(true);
    const MODELS=["llama-3.1-8b-instant","llama3-8b-8192","gemma2-9b-it","mixtral-8x7b-32768"];
    async function callGroq(model){
      const res=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${apiKey}`},body:JSON.stringify({model,messages:[{role:"system",content:systemPrompt},...newMsgs.map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.content}))],max_tokens:400,temperature:0.7})});
      return{status:res.status,data:await res.json()};
    }
    try{
      let reply=null;let lastErr="";
      for(const model of MODELS){
        let result;try{result=await callGroq(model);}catch{lastErr="Network error";continue;}
        const{status,data}=result;
        if(status===401)throw new Error("Invalid API key.");if(status===429)throw new Error("Rate limit — wait 30s.");
        if(status===503||status===500){lastErr=`${model} unavailable`;continue;}
        if(status!==200){lastErr=data?.error?.message||`HTTP ${status}`;continue;}
        reply=data?.choices?.[0]?.message?.content;if(reply)break;
      }
      if(!reply)throw new Error(lastErr||"All models unavailable.");
      tutorCache.current[cacheKey]=reply;setMsgs(p=>[...p,{role:"assistant",content:reply}]);
    }catch(e){setMsgs(p=>[...p,{role:"assistant",content:`❌ ${e.message}`}]);}
    setTutBusy(false);
  }

  // ════════════════════════════════════════════════════════════
  //  BOARD RENDERER
  // ════════════════════════════════════════════════════════════
  function Board({brd,onSq,selSq,legalSqs=[],lastMove=null,noFlip=false,chkSq=null,hintSq2=null,sz=SQ,onPieceDragStart=null,isActive=false}){
    const t=THEMES[theme]||THEMES.obsidian;const fl=flipped&&!noFlip;
    const rows=fl?[...brd].reverse():brd;
    return(
      <div data-chess-board="1"
        style={{display:"inline-flex",flexDirection:"column",borderRadius:8,overflow:"hidden",
          boxShadow:"0 24px 72px rgba(0,0,0,.80),0 4px 16px rgba(0,0,0,.60)",
          border:`2px solid ${t.bdr}`,
          outline:isActive?"2px solid #7C6AF5":"2px solid transparent",
          outlineOffset:"3px",transition:"outline-color .4s ease",
          userSelect:"none",WebkitUserSelect:"none",boxSizing:"border-box",
        }}>
        {rows.map((rowData,ri)=>{
          const bRow=fl?7-ri:ri;const rank=8-bRow;
          const dispRow=fl?[...rowData].reverse():rowData;
          return(
            <div key={ri} style={{display:"flex"}}>
              {showCoords&&<div style={{width:18,height:sz,display:"flex",alignItems:"center",justifyContent:"center",background:"#0A0908",fontSize:9,color:"#4A4640",fontFamily:"monospace",fontWeight:600,flexShrink:0}}>{rank}</div>}
              {dispRow.map((piece,ci)=>{
                const bCol=fl?7-ci:ci;const sq=`${String.fromCharCode(97+bCol)}${rank}`;
                const isLight=(bRow+bCol)%2!==0;const isSel=selSq===sq;const isLeg=legalSqs.includes(sq);
                const isLF=lastMove?.from===sq;const isLT=lastMove?.to===sq;
                const isChk=chkSq===sq;const isHint=hintSq2===sq;
                const pk=piece?`${piece.color}${piece.type.toUpperCase()}`:null;const isW=piece?.color==="w";
                const isBeingDragged=dragRef.current?.from===sq;
                let bg=isLight?t.l:t.d;
                if(isSel)bg=t.sel;else if(isLF||isLT)bg=t.last;
                if(isChk)bg="rgba(232,90,90,.75)";
                return(
                  <div key={ci} onClick={()=>onSq(sq)} className="board-sq"
                    style={{width:sz,height:sz,background:bg,cursor:onPieceDragStart&&piece?"grab":"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center",position:"relative",
                      outline:isSel?"2.5px solid rgba(255,240,60,.95)":isHint?"2.5px solid rgba(82,201,144,.95)":"none",
                      outlineOffset:"-2.5px",boxSizing:"border-box",
                      animation:isChk?"checkPulse 1.2s ease-in-out infinite":(isLT?"sqFlash .4s ease-out":"none"),
                    }}>
                    {isLeg&&!piece&&<div style={{width:Math.round(sz*.32),height:Math.round(sz*.32),borderRadius:"50%",background:t.hint,pointerEvents:"none",animation:"hintAppear .18s ease-out"}}/>}
                    {isLeg&&piece&&<div style={{position:"absolute",inset:0,boxShadow:`inset 0 0 0 3px ${t.hint}`,pointerEvents:"none"}}/>}
                    {piece&&<span className="chess-piece"
                      onMouseDown={onPieceDragStart?(e)=>{e.stopPropagation();onPieceDragStart(e,sq);}:undefined}
                      onTouchStart={onPieceDragStart?(e)=>{e.stopPropagation();onPieceDragStart(e,sq);}:undefined}
                      style={{fontSize:Math.round(sz*.83),lineHeight:1,userSelect:"none",
                        color:isW?"#FFFFFF":"#0A0808",
                        textShadow:isW?"0 0 8px rgba(0,0,0,.95),0 2px 10px rgba(0,0,0,.9)":"0 0 4px rgba(255,255,255,.20),0 1px 6px rgba(0,0,0,.6)",
                        position:"relative",zIndex:1,opacity:isBeingDragged?0:1,
                        cursor:onPieceDragStart?"grab":"default",transition:"opacity .05s",
                        WebkitUserSelect:"none",touchAction:"none",
                      }}>{UNI[pk]}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
        {showCoords&&(
          <div style={{display:"flex",background:"#0A0908"}}>
            <div style={{width:18}}/>
            {Array.from({length:8},(_,i)=>(
              <div key={i} style={{width:sz,textAlign:"center",fontSize:9,color:"#4A4640",padding:"3px 0",fontFamily:"monospace",fontWeight:600}}>
                {String.fromCharCode(97+(fl?7-i:i))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Sub-components ──────────────────────────────────────────
  function TutorChat({height=260,placeholder="Ask your chess tutor…"}){
    const quickP=screen==="learn"?[`Explain "${curLesson?.title}"`,`Tips?`,"Idea here?"]
                :screen==="puzzles"?["Give a hint","What tactic?","Explain solution"]
                :["Best move?","My plan?","Evaluate position"];
    return(
      <div style={{display:"flex",flexDirection:"column",height}}>
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,paddingRight:4,paddingBottom:4}}>
          {msgs.length===0&&<p style={{fontSize:13,color:"#9A9288",fontStyle:"italic",margin:0}}>Ask anything about chess or the current position!</p>}
          {msgs.map((m,i)=>(
            <div key={i} className={m.role==="user"?"msg-in-right":"msg-in-left"} style={{maxWidth:"88%",alignSelf:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{fontSize:13,lineHeight:1.65,padding:"9px 13px",
                borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",
                background:m.role==="user"?"linear-gradient(135deg,#7C6AF5,#6257E0)":"#1E1B16",
                color:m.role==="user"?"#fff":"#EDE8DC",
                boxShadow:m.role==="user"?"0 4px 16px rgba(124,106,245,.30)":"0 2px 8px rgba(0,0,0,.4)",
                border:m.role==="user"?"none":"1px solid rgba(255,255,255,0.06)",
              }}>{m.content}</div>
            </div>
          ))}
          {tutBusy&&<div style={{alignSelf:"flex-start",fontSize:13,color:"#9A9288",fontStyle:"italic",padding:"7px 13px",background:"#1E1B16",borderRadius:12,border:"1px solid rgba(255,255,255,0.06)"}}>
            <span style={{animation:"pulse 1.2s ease infinite",display:"inline-block"}}>●</span> Thinking…
          </div>}
          <div ref={tutEndRef}/>
        </div>
        <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:10}}>
          <div style={{display:"flex",gap:6}}>
            <input value={tutIn} onChange={e=>setTutIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!tutBusy&&sendMsg()} placeholder={placeholder}
              style={{flex:1,fontSize:13,padding:"9px 13px",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)",background:"#1E1B16",color:"#EDE8DC",outline:"none"}}/>
            <button onClick={sendMsg} disabled={tutBusy||!tutIn.trim()}
              style={{padding:"9px 14px",background:tutBusy||!tutIn.trim()?"#272420":"linear-gradient(135deg,#7C6AF5,#6257E0)",color:"#fff",border:"none",borderRadius:10,fontSize:14,cursor:"pointer",opacity:tutBusy||!tutIn.trim()?0.4:1,boxShadow:tutBusy||!tutIn.trim()?"none":"0 4px 12px rgba(124,106,245,.30)"}}>↑</button>
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>
            {quickP.map(q=><button key={q} onClick={()=>setTutIn(q)}
              style={{fontSize:11,padding:"4px 10px",background:"#1E1B16",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,cursor:"pointer",color:"#9A9288"}}>{q}</button>)}
          </div>
        </div>
      </div>
    );
  }

  function Toggle({val,onChange}){
    return(
      <div onClick={()=>onChange(!val)} style={{width:42,height:24,borderRadius:12,background:val?"#7C6AF5":"#272420",cursor:"pointer",transition:"background .2s",position:"relative",flexShrink:0,boxShadow:val?"0 0 12px rgba(124,106,245,.22)":"none"}}>
        <div style={{position:"absolute",top:3,left:val?20:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 2px 6px rgba(0,0,0,.4)"}}/>
      </div>
    );
  }

  function Captured({history,forColor}){
    const map={};
    history.filter(m=>m.color!==forColor&&m.captured).forEach(m=>{const k=`${forColor}${m.captured.toUpperCase()}`;map[k]=(map[k]||0)+1;});
    const sorted=Object.entries(map).sort((a,b)=>PV[b[0][1].toLowerCase()]-PV[a[0][1].toLowerCase()]);
    const mat=sorted.reduce((s,[k,n])=>s+PV[k[1].toLowerCase()]*n,0);
    const opp=history.filter(m=>m.color===forColor&&m.captured).reduce((s,m)=>s+PV[m.captured],0);
    const adv=mat-opp;
    return(
      <div style={{display:"flex",alignItems:"center",gap:5,minHeight:20}}>
        <span style={{fontSize:13,letterSpacing:1,color:"#9A9288"}}>{sorted.map(([k,n])=>Array(n).fill(UNI[k]).join("")).join("")}</span>
        {adv>0&&<span style={{fontSize:11,color:"#D4A843",fontWeight:600,fontFamily:"monospace"}}>+{adv}</span>}
      </div>
    );
  }

  function PromoDlg(){
    if(!promoDialog)return null;
    const pieces=[["q","Queen"],["r","Rook"],["b","Bishop"],["n","Knight"]];
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(6px)"}}>
        <div style={{background:"#161310",borderRadius:22,padding:"1.75rem",boxShadow:"0 32px 80px rgba(0,0,0,.8)",border:"1px solid rgba(212,168,67,.22)",animation:"screenIn .2s ease"}}>
          <div style={{fontSize:15,fontWeight:600,color:"#EDE8DC",marginBottom:20,textAlign:"center",fontFamily:"'Cinzel',serif",letterSpacing:".5px"}}>Promote Pawn</div>
          <div style={{display:"flex",gap:12}}>
            {pieces.map(([pt,label])=>(
              <div key={pt} onClick={()=>doPromotion(pt)}
                style={{width:76,height:76,border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:5,transition:"all .18s",background:"#1E1B16"}}
                onMouseEnter={e=>{e.currentTarget.style.background="#272420";e.currentTarget.style.borderColor="#D4A843";e.currentTarget.style.transform="scale(1.08)";e.currentTarget.style.boxShadow="0 8px 24px rgba(212,168,67,.20)";}}
                onMouseLeave={e=>{e.currentTarget.style.background="#1E1B16";e.currentTarget.style.borderColor="rgba(255,255,255,0.06)";e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}>
                <span style={{fontSize:38,color:pCol==="w"?"#FFFFFF":"#111",textShadow:pCol==="w"?"0 0 6px #000,0 2px 8px rgba(0,0,0,.95)":"none"}}>{UNI[`${pCol}${pt.toUpperCase()}`]}</span>
                <span style={{fontSize:11,color:"#9A9288"}}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function ShareModal(){
    const[copied,setCopied]=useState(false);
    const text=generateShareText();const acc=computeAccuracy(moveQualities);const iWon=winner===(pCol==="w"?"White":"Black");
    const accColor=acc==null?"#9A9288":acc>=85?"#52C990":acc>=65?"#D4A843":"#E85A5A";
    async function copy(){try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2200);}catch{}}
    return(
      <div onClick={()=>setShareModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.84)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:"0 1rem",backdropFilter:"blur(8px)"}}>
        <div onClick={e=>e.stopPropagation()} style={{background:"#161310",borderRadius:22,padding:"1.75rem",width:"100%",maxWidth:380,boxShadow:"0 32px 80px rgba(0,0,0,.8)",border:"1px solid rgba(212,168,67,.22)",animation:"screenIn .22s ease"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
            <span style={{fontSize:16,fontWeight:600,color:"#EDE8DC",fontFamily:"'Cinzel',serif",letterSpacing:".5px"}}>♟ Share Result</span>
            <button onClick={()=>setShareModal(false)} style={{background:"#1E1B16",border:"1px solid rgba(255,255,255,0.06)",width:28,height:28,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#9A9288",fontSize:16,lineHeight:1}}>×</button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18,padding:"14px 16px",borderRadius:10,background:iWon?"rgba(82,201,144,.08)":"rgba(232,90,90,.06)",border:`1px solid ${iWon?"rgba(82,201,144,.25)":"rgba(232,90,90,.20)"}`}}>
            <span style={{fontSize:32}}>{gStatus==="checkmate"?(iWon?"🏆":"💀"):gStatus==="resign"?"🏳":"🤝"}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:600,color:"#EDE8DC"}}>{gStatus==="checkmate"?`${winner} wins!`:gStatus==="stalemate"?"Stalemate":gStatus==="resign"?"Resigned":"Draw"}</div>
              <div style={{fontSize:12,color:"#9A9288",marginTop:2}}>vs {DIFFS[diff].label} · {hist.length} moves{opening?" · "+opening:""}</div>
            </div>
            {acc!=null&&<div style={{textAlign:"center"}}><div style={{fontSize:24,fontWeight:700,color:accColor,fontFamily:"monospace"}}>{acc}</div><div style={{fontSize:10,color:"#57534C"}}>accuracy</div></div>}
          </div>
          {moveQualities.length>0&&(
            <div style={{display:"flex",gap:6,marginBottom:18}}>
              {[{sym:"!",color:"#52C990",count:moveQualities.filter(m=>m.label==="Best"||m.label==="Good").length},
                {sym:"?",color:"#D4A843",count:moveQualities.filter(m=>m.label==="Inaccuracy").length},
                {sym:"??",color:"#F08C4A",count:moveQualities.filter(m=>m.label==="Mistake").length},
                {sym:"???",color:"#E85A5A",count:moveQualities.filter(m=>m.label==="Blunder").length}].map(s=>(
                <div key={s.sym} style={{flex:1,textAlign:"center",padding:"9px 4px",borderRadius:10,background:`${s.color}12`,border:`1px solid ${s.color}30`}}>
                  <div style={{fontSize:13,fontWeight:700,color:s.color,fontFamily:"monospace"}}>{s.sym}</div>
                  <div style={{fontSize:16,fontWeight:700,color:s.color,marginTop:2}}>{s.count}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{background:"#1E1B16",borderRadius:10,padding:"10px 12px",marginBottom:16,fontFamily:"monospace",fontSize:11,lineHeight:2,whiteSpace:"pre-wrap",color:"#9A9288",border:"1px solid rgba(255,255,255,0.06)"}}>{text}</div>
          <button onClick={copy} style={{width:"100%",padding:"12px",background:copied?"#52C990":"linear-gradient(135deg,#7C6AF5,#6257E0)",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",transition:"all .25s"}}>
            {copied?"✓ Copied to clipboard!":"📋 Copy to clipboard"}
          </button>
        </div>
      </div>
    );
  }

  function GhostPiece(){
    if(!ghostState)return null;const{x,y,pk,isW}=ghostState;
    return(
      <div style={{position:"fixed",left:x-SQ*.62,top:y-SQ*.62,width:SQ*1.24,height:SQ*1.24,fontSize:Math.round(SQ*1.04),display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",zIndex:9999,opacity:.9,color:isW?"#fff":"#0A0808",textShadow:isW?"0 0 10px #000,0 3px 12px rgba(0,0,0,.95)":"0 0 4px rgba(255,255,255,.25)",transform:"scale(1.14)",userSelect:"none",filter:"drop-shadow(0 8px 18px rgba(0,0,0,.6))"}}>
        {UNI[pk]}
      </div>
    );
  }

  // ── Bottom Nav ─────────────────────────────────────────────
  const NAV_ITEMS=[{id:"menu",icon:"⌂",label:"Home"},{id:"play_setup",icon:"⚔",label:"Play"},{id:"online",icon:"🌐",label:"Online"},{id:"learn",icon:"🎓",label:"Learn"},{id:"puzzles",icon:"🧩",label:"Puzzles"},{id:"profile",icon:"👤",label:"Profile"}];
  const NAV_ACTIVE_MAP={menu:"menu",settings:"menu",play_setup:"play_setup",play:"play_setup",online:"online",online_play:"online",learn:"learn",puzzles:"puzzles",profile:"profile"};
  const NAV_SCREENS=new Set(["menu","play_setup","play","learn","puzzles","profile","settings","online","online_play"]);

  function BottomNav(){
    if(!NAV_SCREENS.has(screen)||screen==="play"||screen==="online_play")return null;
    const active=NAV_ACTIVE_MAP[screen]??"menu";
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
        <div style={{maxWidth:880,margin:"0 auto",width:"100%",display:"flex",padding:"0 4px",height:"100%",alignItems:"center"}}>
          {NAV_ITEMS.map(item=>{
            const isActive=active===item.id;
            return(
              <button key={item.id} onClick={()=>go(item.id)}
                style={{flex:1,border:"none",background:"none",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,cursor:"pointer",padding:"6px 4px",color:isActive?"#9B8DFF":"#57534C",transition:"color .18s",position:"relative",outline:"none",height:"100%"}}>
                {isActive&&<span style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:32,height:3,borderRadius:"3px 3px 0 0",background:"linear-gradient(90deg,#7C6AF5,#9B8DFF)",boxShadow:"0 0 8px rgba(124,106,245,.40)"}}/>}
                {isActive&&<span style={{position:"absolute",width:44,height:36,borderRadius:12,background:"rgba(124,106,245,.14)",top:"50%",left:"50%",transform:"translate(-50%,-58%)",pointerEvents:"none"}}/>}
                <span style={{fontSize:20,lineHeight:1,position:"relative",transform:isActive?"translateY(-1px) scale(1.1)":"none",transition:"transform .2s"}}>{item.icon}</span>
                <span style={{fontSize:10,fontWeight:isActive?600:400,letterSpacing:.2,position:"relative"}}>{item.label}</span>
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
  if(!loaded) return(
    <div style={{minHeight:500,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@keyframes chessBob{0%,100%{transform:scale(1) rotate(-6deg)}50%{transform:scale(1.12) rotate(6deg)}}`}</style>
      {loadErr
        ?<><span style={{fontSize:44}}>⚠️</span><p style={{color:"#9A9288",fontSize:14,textAlign:"center"}}>Could not load chess engine. Check connection and reload.</p></>
        :<>
          <span style={{fontSize:72,animation:"chessBob 2.2s ease-in-out infinite",display:"inline-block",filter:"drop-shadow(0 8px 24px rgba(212,168,67,.45))"}}>♟</span>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:600,fontFamily:"'Cinzel',serif",color:"#EDE8DC",letterSpacing:"1px",marginBottom:6}}>Chess Academy</div>
            <p style={{color:"#57534C",fontSize:13}}>Loading engine…</p>
          </div>
        </>}
    </div>
  );

  // ════════════════════════════════════════════════════════════
  //  MENU
  // ════════════════════════════════════════════════════════════
  if(screen==="menu"){
    const totalL=LESSONS.length;const pct=Math.round((doneLessons.size/totalL)*100);
    const totalGames=stats.w+stats.l+stats.d;const winRate=totalGames>0?Math.round((stats.w/totalGames)*100):0;
    return(<>
      <div style={{padding:"1rem 0 5.5rem"}} className="screen-enter">
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:36,filter:"drop-shadow(0 4px 12px rgba(212,168,67,.55))",animation:"float 4s ease-in-out infinite",display:"inline-block"}}>♟</span>
            <div>
              <div style={{fontSize:20,fontWeight:600,fontFamily:"'Cinzel',serif",letterSpacing:"1px",lineHeight:1.1,color:"#EDE8DC"}}>Chess<span style={{color:"#D4A843"}}> Academy</span></div>
              <div style={{fontSize:11,color:"#57534C",marginTop:2,letterSpacing:".4px"}}>Master the game of kings</div>
            </div>
          </div>
          <button onClick={()=>setScreen("profile")}
            style={{display:"flex",alignItems:"center",gap:7,fontSize:12,padding:"7px 13px",background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:10,cursor:"pointer",color:"#9A9288",transition:"all .15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(212,168,67,.30)";e.currentTarget.style.color="#EDE8DC";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(212,168,67,.10)";e.currentTarget.style.color="#9A9288";}}>
            <span>👤</span><span>{user?(user.user_metadata?.username??user.email?.split("@")[0]):"Guest"}</span>
          </button>
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
          {[{label:"Rating",val:elo,icon:"📈",color:"#9B8DFF"},{label:"Wins",val:stats.w,icon:"🏆",color:"#52C990"},{label:"Win %",val:`${winRate}%`,icon:"📊",color:"#D4A843"},{label:"Streak",val:streak,icon:"🔥",color:"#F08C4A"}].map(s=>(
            <div key={s.label} className="stat-card"
              style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:10,padding:"12px 8px",textAlign:"center",cursor:"default"}}>
              <div style={{fontSize:10,color:"#57534C",marginBottom:5}}>{s.icon} {s.label}</div>
              <div style={{fontSize:22,fontWeight:700,color:s.color,fontFamily:"monospace"}}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Primary 2-col cards */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div className="mode-card" onClick={()=>{setGameMode("ai");setScreen("play_setup");}}
            style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:16,padding:"1.25rem",cursor:"pointer",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,right:0,width:80,height:80,background:"radial-gradient(circle at top right,rgba(124,106,245,.15),transparent)",pointerEvents:"none"}}/>
            <div style={{fontSize:36,marginBottom:12}}>⚔️</div>
            <div style={{fontSize:16,fontWeight:600,color:"#EDE8DC",marginBottom:5,fontFamily:"'Cinzel',serif",letterSpacing:".3px"}}>vs AI</div>
            <div style={{fontSize:12,color:"#9A9288",marginBottom:12,lineHeight:1.5}}>5 difficulty levels · move analysis</div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:10,padding:"3px 9px",background:"rgba(124,106,245,.14)",borderRadius:20,color:"#9B8DFF",fontWeight:600}}>{DIFFS[diff].label}</span>
              <span style={{fontSize:10,color:"#57534C",fontFamily:"monospace"}}>{elo} Elo</span>
            </div>
          </div>
          <div className="mode-card" onClick={()=>setScreen("learn")}
            style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:16,padding:"1.25rem",cursor:"pointer",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,right:0,width:80,height:80,background:"radial-gradient(circle at top right,rgba(82,201,144,.12),transparent)",pointerEvents:"none"}}/>
            <div style={{fontSize:36,marginBottom:12}}>🎓</div>
            <div style={{fontSize:16,fontWeight:600,color:"#EDE8DC",marginBottom:5,fontFamily:"'Cinzel',serif",letterSpacing:".3px"}}>Learn</div>
            <div style={{fontSize:12,color:"#9A9288",marginBottom:12,lineHeight:1.5}}>{totalL} lessons · AI tutor</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{flex:1,height:4,background:"#272420",borderRadius:2,overflow:"hidden"}}>
                <div style={{width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,#52C990,#6EE6AB)",borderRadius:2,transition:"width .5s"}}/>
              </div>
              <span style={{fontSize:10,color:"#52C990",fontFamily:"monospace",fontWeight:600,whiteSpace:"nowrap"}}>{pct}%</span>
            </div>
          </div>
        </div>

        {/* Secondary cards */}
        {[
          {id:"online",emoji:"🌐",title:"Play Online",desc:"Real-time games · invite friends or quick match",badge:"Live",bc:"#7C6AF5"},
          {id:"p2p",emoji:"👥",title:"Pass & Play",desc:"2 players on one device · auto-flip board",badge:"Local",bc:"#F08C4A"},
          {id:"puzzles",emoji:"🧩",title:"Puzzle Trainer",desc:`${PUZZLES.length} tactical puzzles · ${solvedPz.size} solved`,badge:`${solvedPz.size}/${PUZZLES.length}`,bc:"#C04A90"},
        ].map(m=>(
          <div key={m.id} className="mode-card" onClick={()=>{
              if(m.id==="online")setScreen("online");
              else if(m.id==="p2p"){setGameMode("p2p");setScreen("play_setup");}
              else{randomPuzzle();setScreen("puzzles");}
            }}
            style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:16,padding:"1rem 1.25rem",cursor:"pointer",display:"flex",alignItems:"center",gap:14,marginBottom:8}}>
            <span style={{fontSize:28,flexShrink:0}}>{m.emoji}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:600,color:"#EDE8DC",fontFamily:"'Cinzel',serif",letterSpacing:".3px",marginBottom:3}}>{m.title}</div>
              <div style={{fontSize:12,color:"#9A9288"}}>{m.desc}</div>
            </div>
            <span style={{fontSize:11,padding:"3px 9px",background:`${m.bc}18`,borderRadius:20,color:m.bc,fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>{m.badge}</span>
          </div>
        ))}

        {/* Theme picker */}
        <div style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:16,padding:"1rem 1.25rem",marginTop:2}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:500,color:"#EDE8DC"}}>Board Theme</div>
            <button onClick={()=>setScreen("settings")} style={{fontSize:12,padding:"5px 11px",background:"#1E1B16",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,cursor:"pointer",color:"#9A9288"}}>⚙ Settings</button>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {Object.entries(THEMES).map(([k,t])=>(
              <div key={k} onClick={()=>setTheme(k)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",width:36,height:36,borderRadius:8,overflow:"hidden",
                  outline:theme===k?"2.5px solid #D4A843":"2px solid transparent",outlineOffset:2,
                  transition:"outline .15s,transform .15s",transform:theme===k?"scale(1.12)":"scale(1)",
                  boxShadow:theme===k?"0 0 12px rgba(212,168,67,.18)":"none"}}>
                  {[t.l,t.d,t.d,t.l].map((c,i)=><div key={i} style={{background:c}}/>)}
                </div>
                <span style={{fontSize:10,fontWeight:theme===k?600:400,color:theme===k?"#D4A843":"#57534C"}}>{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav/>
    </>);
  }

  // ════════════════════════════════════════════════════════════
  //  ONLINE / PROFILE / SETTINGS screens
  // ════════════════════════════════════════════════════════════
  if(screen==="online") return(<><OnlineScreen user={user} onBack={()=>setScreen("menu")} onJoinGame={(gameData)=>{setOnlineGameData(gameData);setScreen("online_play");}}/><BottomNav/></>);
  if(screen==="online_play"&&onlineGameData) return(
    <OnlinePlayScreen gameData={onlineGameData} user={user} onBack={()=>setScreen("online")} ChessLib={ChessLib} loaded={loaded} theme={theme} showCoords={showCoords} soundOn={soundOn}
      onStatsChange={(delta)=>{const ns={w:stats.w+(delta.wins??0),l:stats.l+(delta.losses??0),d:stats.d+(delta.draws??0)};setStats(ns);saveProgress(undefined,undefined,undefined,ns);}}
      onEloChange={(result,oppElo)=>{const K=32,expected=1/(1+Math.pow(10,(oppElo-elo)/400)),newElo=Math.round(elo+K*(result-expected));setElo(newElo);saveProgress(undefined,undefined,undefined,undefined,newElo);}}
    />
  );
  if(screen==="profile") return(<><ProfileScreen user={user} stats={stats} doneLessons={doneLessons} solvedPz={solvedPz} streak={streak} onBack={()=>setScreen("menu")} onSignOut={onSignOut}/><BottomNav/></>);

  if(screen==="settings") return(<>
    <div style={{padding:"1rem 0 5.5rem"}} className="screen-enter">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"1.5rem"}}>
        <button onClick={()=>setScreen("menu")} className="btn-ghost">← Back</button>
        <span style={{fontSize:19,fontWeight:600,color:"#EDE8DC",fontFamily:"'Cinzel',serif",letterSpacing:".5px"}}>Settings</span>
      </div>
      {[{label:"Sound Effects",sub:"Move, capture, and check sounds",val:soundOn,set:setSoundOn},{label:"Show Coordinates",sub:"File and rank labels on the board",val:showCoords,set:setShowCoords}].map(s=>(
        <div key={s.label} style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:10,padding:"14px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:"#EDE8DC"}}>{s.label}</div><div style={{fontSize:12,color:"#9A9288",marginTop:2}}>{s.sub}</div></div>
          <Toggle val={s.val} onChange={s.set}/>
        </div>
      ))}
      <div style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:10,padding:"14px 16px",marginBottom:8}}>
        <div style={{fontSize:14,fontWeight:500,color:"#EDE8DC",marginBottom:10}}>Animation Speed</div>
        <div style={{display:"flex",gap:8}}>
          {["fast","normal","slow"].map(s=>(
            <button key={s} onClick={()=>setAnimSpd(s)} style={{flex:1,padding:"8px",fontSize:13,background:animSpd===s?"#7C6AF5":"#1E1B16",color:animSpd===s?"#fff":"#9A9288",border:`1px solid ${animSpd===s?"#7C6AF5":"rgba(255,255,255,0.06)"}`,borderRadius:10,cursor:"pointer",textTransform:"capitalize",transition:"all .15s"}}>{s}</button>
          ))}
        </div>
      </div>
      <button onClick={async()=>{setDoneLessons(new Set());setStats({w:0,l:0,d:0});setSolvedPz(new Set());setStreak(0);try{await window.storage?.set("chess_v2","{}");}catch{}}}
        style={{width:"100%",padding:11,background:"transparent",color:"#E85A5A",border:"1px solid #E85A5A",borderRadius:10,fontSize:14,cursor:"pointer",marginTop:8,transition:"background .15s"}}
        onMouseEnter={e=>e.currentTarget.style.background="rgba(232,90,90,.08)"}
        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        Reset All Progress
      </button>
    </div>
    <BottomNav/>
  </>);

  // ════════════════════════════════════════════════════════════
  //  PLAY SETUP
  // ════════════════════════════════════════════════════════════
  if(screen==="play_setup") return(<>
    <div style={{padding:"1rem 0 5.5rem"}} className="screen-enter">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"1.5rem"}}>
        <button onClick={()=>{setGameMode("ai");setScreen("menu");}} className="btn-ghost">← Back</button>
        <span style={{fontSize:19,fontWeight:600,color:"#EDE8DC",fontFamily:"'Cinzel',serif",letterSpacing:".5px"}}>{gameMode==="p2p"?"👥 Pass & Play":"⚔️ New Game"}</span>
      </div>

      {/* Mode tabs */}
      <div style={{display:"flex",gap:0,marginBottom:18,background:"#1E1B16",padding:4,borderRadius:10,border:"1px solid rgba(255,255,255,0.06)"}}>
        {[["ai","⚔ vs AI"],["p2p","👥 Pass & Play"]].map(([m,label])=>(
          <button key={m} onClick={()=>setGameMode(m)} style={{flex:1,padding:"9px",fontSize:13,fontWeight:600,borderRadius:7,border:"none",background:gameMode===m?"#161310":"transparent",color:gameMode===m?"#EDE8DC":"#9A9288",cursor:"pointer",transition:"all .18s",boxShadow:gameMode===m?"0 2px 8px rgba(0,0,0,.4)":"none"}}>{label}</button>
        ))}
      </div>

      {gameMode==="ai"&&<>
        {/* Difficulty */}
        <div style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:16,padding:"1rem 1.25rem",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:500,color:"#57534C",marginBottom:12,textTransform:"uppercase",letterSpacing:".06em"}}>Difficulty</div>
          {DIFFS.map((d,i)=>(
            <div key={i} onClick={()=>setDiff(i)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:10,background:diff===i?"#1E1B16":"transparent",border:`1px solid ${diff===i?d.color+"44":"transparent"}`,cursor:"pointer",transition:"all .15s",marginBottom:i<4?4:0,boxShadow:diff===i?`0 4px 16px ${d.color}18`:"none"}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:d.color,flexShrink:0,boxShadow:`0 0 8px ${d.color}60`}}/>
              <span style={{fontSize:14,fontWeight:diff===i?600:400,color:"#EDE8DC",flex:1,fontFamily:diff===i?"'Cinzel',serif":"inherit",letterSpacing:diff===i?".3px":0}}>{d.label}</span>
              <span style={{fontSize:12,color:"#9A9288"}}>{d.desc}</span>
              <span style={{fontSize:11,color:d.color,fontWeight:700,fontFamily:"monospace",minWidth:36,textAlign:"right"}}>{DIFF_ELO[i]}</span>
              {diff===i&&<span style={{color:"#52C990",fontSize:14}}>✓</span>}
            </div>
          ))}
        </div>

        {/* Color */}
        <div style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:16,padding:"1rem 1.25rem",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:500,color:"#57534C",marginBottom:12,textTransform:"uppercase",letterSpacing:".06em"}}>Play As</div>
          <div style={{display:"flex",gap:10}}>
            {[["w","♙","White","Move first"],["b","♟","Black","AI moves first"]].map(([col,ico,label,sub])=>(
              <div key={col} onClick={()=>setPCol(col)} style={{flex:1,padding:"16px 12px",border:`1px solid ${pCol===col?"#D4A843":"rgba(212,168,67,.10)"}`,borderRadius:10,cursor:"pointer",textAlign:"center",transition:"all .18s",background:pCol===col?"rgba(212,168,67,.06)":"#1E1B16",boxShadow:pCol===col?"0 4px 20px rgba(212,168,67,.14)":"none"}}>
                <div style={{fontSize:36,marginBottom:8}}>{ico}</div>
                <div style={{fontSize:14,fontWeight:600,color:"#EDE8DC",marginBottom:2,fontFamily:"'Cinzel',serif",letterSpacing:".3px"}}>{label}</div>
                <div style={{fontSize:11,color:"#9A9288"}}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </>}

      {gameMode==="p2p"&&<>
        <div style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:16,padding:"1rem 1.25rem",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:500,color:"#57534C",marginBottom:14,textTransform:"uppercase",letterSpacing:".06em"}}>Player Names</div>
          {[["w","♙ White (moves first)"],["b","♟ Black"]].map(([col,label])=>(
            <div key={col} style={{marginBottom:10}}>
              <div style={{fontSize:12,color:"#9A9288",marginBottom:6}}>{label}</div>
              <input value={p2pNames[col]} onChange={e=>setP2pNames(n=>({...n,[col]:e.target.value}))} placeholder={col==="w"?"Player 1":"Player 2"}
                style={{width:"100%",fontSize:14,padding:"10px 13px",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)",background:"#1E1B16",color:"#EDE8DC",outline:"none",boxSizing:"border-box",transition:"border-color .15s"}}
                onFocus={e=>e.target.style.borderColor="rgba(212,168,67,.30)"}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.06)"}/>
            </div>
          ))}
        </div>
        <div style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:10,padding:"14px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:"#EDE8DC"}}>Auto-flip board</div><div style={{fontSize:12,color:"#9A9288",marginTop:2}}>Each player always sees their pieces at the bottom</div></div>
          <Toggle val={p2pFlipOnTurn} onChange={setP2pFlipOnTurn}/>
        </div>
      </>}

      {/* Time control */}
      <div style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:16,padding:"1rem 1.25rem",marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:500,color:"#57534C",textTransform:"uppercase",letterSpacing:".06em"}}>Time Control</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12,color:useTimer?"#D4A843":"#57534C",fontWeight:useTimer?600:400}}>{useTimer?"On":"Off"}</span>
            <Toggle val={useTimer} onChange={setUseTimer}/>
          </div>
        </div>
        {useTimer&&(
          <div style={{display:"flex",gap:8}}>
            {[[180,"3 min"],[300,"5 min"],[600,"10 min"],[900,"15 min"]].map(([s,label])=>(
              <button key={s} onClick={()=>setTimeCtrl(s)} style={{flex:1,padding:"9px 4px",fontSize:13,background:timeCtrl===s?"#7C6AF5":"#1E1B16",color:timeCtrl===s?"#fff":"#9A9288",border:`1px solid ${timeCtrl===s?"#7C6AF5":"rgba(255,255,255,0.06)"}`,borderRadius:10,cursor:"pointer",transition:"all .15s"}}>{label}</button>
            ))}
          </div>
        )}
      </div>

      <button onClick={startGame} className={gameMode==="p2p"?"btn-gold":"btn-primary"} style={{width:"100%",padding:13,fontSize:16,fontFamily:"'Cinzel',serif",letterSpacing:".5px"}}>
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
    const isMyTurn=g?.turn()===pCol;
    const gameOver=gStatus!=="playing"&&gStatus!=="idle";
    const iWon=winner===(pCol==="w"?"White":"Black");
    const chkSq=inChk&&g?(()=>{let k=null;g.board().forEach((row,r)=>row.forEach((p,c)=>{if(p?.type==="k"&&p.color===g.turn())k=`${String.fromCharCode(97+c)}${8-r}`;}));return k;})():null;
    const oppLabel=gameMode==="p2p"?(flipped?p2pNames.w:p2pNames.b):`AI — ${DIFFS[diff].label}`;
    const myLabel=gameMode==="p2p"?(flipped?p2pNames.b:p2pNames.w):"You";

    return(
      <div style={{padding:"0.5rem 0 1.5rem"}} className="screen-enter">
        <style>{`@keyframes checkPulse{0%,100%{background:rgba(232,90,90,.72)}50%{background:rgba(255,70,50,.92)}}`}</style>
        <PromoDlg/>{shareModal&&<ShareModal/>}

        {/* Top bar */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <button onClick={()=>{setScreen("menu");setGameMode("ai");}} className="btn-ghost" style={{padding:"6px 12px",fontSize:12}}>← Menu</button>
          <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
            {gameMode==="p2p"?<span style={{fontSize:12,color:"#F08C4A",fontWeight:600}}>👥 Pass & Play</span>:<>
              <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:DIFFS[diff].color,boxShadow:`0 0 6px ${DIFFS[diff].color}`,flexShrink:0}}/>
              <span style={{fontSize:12,color:"#9A9288"}}>{DIFFS[diff].label}</span>
            </>}
            {opening&&<span style={{fontSize:11,color:"#57534C",borderLeft:"1px solid rgba(255,255,255,0.06)",paddingLeft:7,fontStyle:"italic"}}>{opening}</span>}
          </div>
          {gameMode==="p2p"&&gStatus==="playing"&&(
            <span style={{fontSize:12,fontWeight:600,padding:"4px 10px",background:g?.turn()==="w"?"rgba(255,255,255,.06)":"rgba(0,0,0,.3)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,color:g?.turn()==="w"?"#EDE8DC":"#9A9288"}}>
              {g?.turn()==="w"?`♙ ${p2pNames.w}`:`♟ ${p2pNames.b}`}'s turn
            </span>
          )}
          {gameMode==="ai"&&aiThink&&<span style={{fontSize:12,color:"#57534C",fontStyle:"italic",animation:"pulse 1s ease infinite"}}>AI thinking…</span>}
          {inChk&&gStatus==="playing"&&<span style={{fontSize:12,color:"#E85A5A",fontWeight:700,padding:"3px 9px",background:"rgba(232,90,90,.12)",borderRadius:20}}>⚠ Check!</span>}
          <button onClick={()=>setFlipped(f=>!f)} className="btn-ghost" style={{padding:"6px 10px",fontSize:13}}>⟳</button>
        </div>

        {/* Game over banner */}
        {gameOver&&(()=>{
          const eloChange=gameMode==="ai"?(()=>{const r=gStatus==="checkmate"?(iWon?1:0):gStatus==="resign"?0:0.5;return calcNewElo(elo,DIFF_ELO[diff],r)-elo;})():null;
          const winnerName=gameMode==="p2p"?(winner==="White"?p2pNames.w:p2pNames.b):winner;
          const positive=(gStatus==="checkmate"||gStatus==="timeout")&&(iWon||gameMode==="p2p");
          return(
            <div style={{marginBottom:14,padding:"14px 18px",borderRadius:10,background:positive?"rgba(82,201,144,.08)":"rgba(232,90,90,.06)",border:`1px solid ${positive?"rgba(82,201,144,.30)":"rgba(232,90,90,.25)"}`,display:"flex",alignItems:"center",gap:14,animation:"screenIn .3s ease"}}>
              <span style={{fontSize:28}}>{gStatus==="checkmate"?"🏆":gStatus==="resign"?"🏳":gStatus==="timeout"?"⏰":"🤝"}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:600,color:"#EDE8DC",fontFamily:"'Cinzel',serif",letterSpacing:".3px"}}>
                  {gStatus==="checkmate"?`${winnerName} wins by checkmate!`:gStatus==="stalemate"?"Stalemate — draw!":gStatus==="timeout"?`${winnerName} wins on time!`:gStatus==="resign"?`${winnerName} wins — opponent resigned`:"Draw!"}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginTop:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,color:"#9A9288",fontFamily:"monospace"}}>{hist.length} moves</span>
                  {computeAccuracy(moveQualities)!=null&&(()=>{const acc=computeAccuracy(moveQualities);const c=acc>=85?"#52C990":acc>=65?"#D4A843":"#E85A5A";return<span style={{fontSize:12,fontWeight:600,color:c,fontFamily:"monospace"}}>Accuracy: {acc}/100</span>;})()}
                  {eloChange!=null&&<span style={{fontSize:12,fontWeight:600,color:eloChange>=0?"#52C990":"#E85A5A",fontFamily:"monospace"}}>{eloChange>=0?`+${eloChange}`:eloChange} Elo</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:7,flexShrink:0}}>
                {gameMode==="ai"&&<button onClick={()=>setShareModal(true)} className="btn-ghost" style={{padding:"7px 12px",fontSize:12}}>📤</button>}
                <button onClick={startGame} style={{padding:"8px 16px",background:gameMode==="p2p"?"linear-gradient(135deg,#E8C56B,#D4A843)":"linear-gradient(135deg,#7C6AF5,#6257E0)",color:gameMode==="p2p"?"#1a1400":"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer"}}>Rematch</button>
              </div>
            </div>
          );
        })()}

        {/* Move quality summary */}
        {gameOver&&moveQualities.length>0&&(
          <div style={{marginBottom:14,padding:"10px 14px",borderRadius:10,background:"#161310",border:"1px solid rgba(212,168,67,.10)"}}>
            <div style={{fontSize:11,color:"#57534C",marginBottom:8,textTransform:"uppercase",letterSpacing:".04em"}}>Your Move Quality</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[{label:"Best/Good",sym:"✓",color:"#52C990",count:moveQualities.filter(m=>m.label==="Best"||m.label==="Good").length},{label:"Inaccuracy",sym:"?",color:"#D4A843",count:moveQualities.filter(m=>m.label==="Inaccuracy").length},{label:"Mistake",sym:"??",color:"#F08C4A",count:moveQualities.filter(m=>m.label==="Mistake").length},{label:"Blunder",sym:"???",color:"#E85A5A",count:moveQualities.filter(m=>m.label==="Blunder").length}].map(s=>(
                <div key={s.label} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 11px",borderRadius:20,background:`${s.color}14`,border:`1px solid ${s.color}40`}}>
                  <span style={{fontSize:12,fontWeight:700,color:s.color,fontFamily:"monospace"}}>{s.sym}</span>
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
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6,minHeight:30,background:"#161310",borderRadius:10,padding:"5px 10px",border:"1px solid rgba(255,255,255,0.06)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:15}}>{pCol==="w"?"♟":"♙"}</span>
                <span style={{fontSize:13,color:"#9A9288",fontWeight:500}}>{oppLabel}</span>
                <Captured history={hist} forColor={pCol==="w"?"b":"w"}/>
              </div>
              {useTimer&&<div style={{fontSize:14,fontFamily:"monospace",fontWeight:700,color:!isMyTurn?"#EDE8DC":"#57534C",background:!isMyTurn&&gStatus==="playing"?"rgba(124,106,245,.14)":"transparent",padding:"3px 8px",borderRadius:6,transition:"all .3s"}}>{fmtTime(pCol==="w"?timeB:timeW)}</div>}
            </div>

            {/* Eval bar + board */}
            <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
              <div style={{width:8,height:SQ*8+(showCoords?22:0),background:"#272420",borderRadius:4,overflow:"hidden",flexShrink:0,display:"flex",flexDirection:"column-reverse",border:"1px solid rgba(255,255,255,0.06)"}}>
                <div style={{height:`${evalBar}%`,background:"linear-gradient(to top,#fff,#e0e0e0)",transition:"height .7s ease",borderRadius:4}}/>
              </div>
              <div style={{position:"relative"}}>
                <Board brd={board} onSq={handleSqClick} selSq={sel} legalSqs={legal} lastMove={lastMv} chkSq={chkSq} hintSq2={hintSq} isActive={isMyTurn&&gStatus==="playing"} onPieceDragStart={playDragStart}/>
                {lastBadge&&(
                  <div style={{position:"absolute",top:-16,right:-10,zIndex:10,background:"#161310",border:`1.5px solid ${lastBadge.color}`,borderRadius:20,padding:"4px 12px",display:"flex",alignItems:"center",gap:6,animation:"badgePop .35s cubic-bezier(.34,1.56,.64,1) forwards",boxShadow:`0 4px 16px ${lastBadge.color}40`}}>
                    <span style={{fontSize:13,fontWeight:700,color:lastBadge.color,fontFamily:"monospace"}}>{lastBadge.sym}</span>
                    <span style={{fontSize:12,fontWeight:600,color:lastBadge.color}}>{lastBadge.label}</span>
                  </div>
                )}
              </div>
            </div>

            {/* My bar */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6,minHeight:30,background:"#161310",borderRadius:10,padding:"5px 10px",border:`1px solid ${isMyTurn&&gStatus==="playing"?"rgba(212,168,67,.22)":"rgba(255,255,255,0.06)"}`,transition:"border-color .3s",boxShadow:isMyTurn&&gStatus==="playing"?"0 0 0 1px rgba(124,106,245,.14)":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:15}}>{pCol==="w"?"♙":"♟"}</span>
                <span style={{fontSize:13,color:"#EDE8DC",fontWeight:600}}>{myLabel}</span>
                <Captured history={hist} forColor={pCol}/>
                {gameMode==="ai"&&gStatus==="playing"&&isMyTurn&&!aiThink&&<span style={{fontSize:11,color:"#52C990",fontWeight:600,animation:"glow 1.5s ease infinite"}}>● Your turn</span>}
              </div>
              {useTimer&&<div style={{fontSize:14,fontFamily:"monospace",fontWeight:700,color:isMyTurn?"#EDE8DC":"#57534C",background:isMyTurn&&gStatus==="playing"?"rgba(124,106,245,.14)":"transparent",padding:"3px 8px",borderRadius:6,transition:"all .3s"}}>{fmtTime(pCol==="w"?timeW:timeB)}</div>}
            </div>
          </div>

          {/* Right panel */}
          <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:0}}>
            {/* Tab strip */}
            <div style={{display:"flex",background:"#1E1B16",borderRadius:10,padding:3,marginBottom:10,border:"1px solid rgba(255,255,255,0.06)"}}>
              {[["moves","Moves"],["tutor","✨ Tutor"]].map(([id,label])=>(
                <button key={id} onClick={()=>setPanelTab(id)} style={{flex:1,padding:"8px 0",fontSize:13,background:panelTab===id?"#161310":"transparent",border:"none",borderRadius:7,color:panelTab===id?"#EDE8DC":"#9A9288",cursor:"pointer",fontWeight:panelTab===id?600:400,transition:"all .18s",boxShadow:panelTab===id?"0 2px 8px rgba(0,0,0,.4)":"none"}}>{label}</button>
              ))}
            </div>

            {panelTab==="moves"&&(
              <div ref={moveListRef} style={{flex:1,overflowY:"auto",maxHeight:280,minHeight:100}}>
                {movePairs.length===0&&<p style={{fontSize:13,color:"#9A9288",fontStyle:"italic",margin:0,padding:"8px 4px"}}>Waiting for your first move…</p>}
                {movePairs.map((p,i)=>{
                  const wBadge=moveQualities[i*2]??null;const bBadge=moveQualities[i*2+1]??null;const isWP=pCol==="w";
                  return(
                    <div key={p.n} className="move-row" style={{display:"flex",alignItems:"center",padding:"3px 4px",gap:2}}>
                      <span style={{width:26,fontSize:11,color:"#57534C",flexShrink:0,fontFamily:"monospace",textAlign:"right",paddingRight:4}}>{p.n}.</span>
                      <span style={{flex:1,fontSize:13,fontFamily:"monospace",fontWeight:600,color:"#EDE8DC",padding:"2px 5px"}}>{p.w}</span>
                      {isWP&&wBadge&&<span title={wBadge.label} style={{fontSize:11,fontWeight:700,color:wBadge.color,marginRight:2,flexShrink:0,fontFamily:"monospace"}}>{wBadge.sym}</span>}
                      {!(isWP&&wBadge)&&<span style={{width:16,flexShrink:0}}/>}
                      <span style={{flex:1,fontSize:13,fontFamily:"monospace",color:"#9A9288",padding:"2px 5px"}}>{p.b??""}</span>
                      {!isWP&&bBadge&&<span title={bBadge.label} style={{fontSize:11,fontWeight:700,color:bBadge.color,marginRight:2,flexShrink:0,fontFamily:"monospace"}}>{bBadge.sym}</span>}
                    </div>
                  );
                })}
              </div>
            )}
            {panelTab==="tutor"&&<div style={{flex:1}}><TutorChat height={280} placeholder="Ask about this position…"/></div>}

            {/* Action buttons */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:12}}>
              {[{label:"↩ Undo",onClick:undoMove,disabled:hist.length<2||gameOver},{label:hintSq?"💡 Shown":"💡 Hint",onClick:showHint,disabled:gameOver||aiThink||gameMode==="p2p",active:!!hintSq},{label:"🏳 Resign",onClick:resign,disabled:gameOver||hist.length<2}].map(b=>(
                <button key={b.label} onClick={b.onClick} disabled={b.disabled}
                  style={{padding:"8px 0",fontSize:12,background:b.active?"rgba(124,106,245,.14)":"#1E1B16",border:`1px solid ${b.active?"#7C6AF5":"rgba(255,255,255,0.06)"}`,borderRadius:10,cursor:b.disabled?"default":"pointer",color:b.active?"#9B8DFF":b.disabled?"#57534C":"#9A9288",transition:"all .15s"}}>{b.label}</button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6}}>
              <button onClick={startGame} style={{padding:"8px 0",fontSize:12,background:"#1E1B16",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,cursor:"pointer",color:"#9A9288"}}>↺ New Game</button>
              <button onClick={()=>setScreen("play_setup")} style={{padding:"8px 0",fontSize:12,background:"#1E1B16",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,cursor:"pointer",color:"#9A9288"}}>⚙ Setup</button>
            </div>
            {/* Keyboard hints */}
            <div style={{marginTop:10,padding:"8px 10px",background:"#1E1B16",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)",display:"flex",flexWrap:"wrap",gap:"6px 12px"}}>
              {[["U","Undo"],["H","Hint"],["F","Flip"],["N","New"],["Esc","Menu"]].map(([k,label])=>(
                <div key={k} style={{display:"flex",alignItems:"center",gap:4}}>
                  <span className="kbd">{k}</span>
                  <span style={{fontSize:11,color:"#57534C"}}>{label}</span>
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
  //  PUZZLES SCREEN
  // ════════════════════════════════════════════════════════════
  if(screen==="puzzles"){
    const cats=["All",...new Set(PUZZLES.map(p=>p.cat))];
    const stCfg={
      idle:   {icon:"🧩",label:`Find the best move for ${pzRef.current?.turn()==="w"?"White":"Black"}!`,bg:"#161310",border:"rgba(212,168,67,.10)"},
      correct:{icon:"✓", label:"Good move! Keep going…",bg:"rgba(82,201,144,.08)",border:"rgba(82,201,144,.25)"},
      solved: {icon:"🎉",label:`Solved! Streak: ${streak} 🔥`,bg:"rgba(82,201,144,.10)",border:"rgba(82,201,144,.30)"},
      wrong:  {icon:"✗", label:"Wrong — try again!",bg:"rgba(232,90,90,.08)",border:"rgba(232,90,90,.28)"},
    };
    const st=stCfg[pzStatus]??stCfg.idle;
    return(<>
      <div style={{padding:"0.5rem 0 5rem"}} className="screen-enter">
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <button onClick={()=>setScreen("menu")} className="btn-ghost" style={{padding:"6px 12px",fontSize:12}}>← Menu</button>
          <span style={{fontSize:18,fontWeight:600,color:"#EDE8DC",flex:1,fontFamily:"'Cinzel',serif",letterSpacing:".5px"}}>🧩 Puzzle Trainer</span>
          <div style={{padding:"5px 12px",background:streak>0?"rgba(240,140,74,.12)":"#1E1B16",borderRadius:20,border:`1px solid ${streak>0?"rgba(240,140,74,.28)":"rgba(255,255,255,0.06)"}`,fontSize:13,color:streak>0?"#F08C4A":"#9A9288",fontWeight:600,fontFamily:"monospace"}}>
            {streak>0?<span style={{animation:"fireStreak 0.8s ease-in-out infinite",display:"inline-block",marginRight:3}}>🔥</span>:null}
            {streak>0?`${streak} streak`:"No streak"}
          </div>
        </div>

        {/* Category filter */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          {cats.map(c=>(
            <button key={c} onClick={()=>{setPzFilter(c);if(!pz)randomPuzzle(c);}}
              style={{fontSize:12,padding:"5px 12px",borderRadius:20,border:`1px solid ${pzFilter===c?"rgba(192,74,144,.50)":"rgba(255,255,255,0.06)"}`,background:pzFilter===c?"rgba(192,74,144,.12)":"transparent",color:pzFilter===c?"#C04A90":"#9A9288",cursor:"pointer",fontWeight:pzFilter===c?600:400,transition:"all .15s"}}>{c}</button>
          ))}
        </div>

        {!pz?(
          <div style={{textAlign:"center",padding:"4rem 1rem"}}>
            <div style={{fontSize:56,marginBottom:20,filter:"drop-shadow(0 8px 24px rgba(192,74,144,.3))"}}>🧩</div>
            <div style={{fontSize:18,fontWeight:600,color:"#EDE8DC",fontFamily:"'Cinzel',serif",letterSpacing:".5px",marginBottom:10}}>Ready for a Challenge?</div>
            <div style={{fontSize:14,color:"#9A9288",marginBottom:24}}>{PUZZLES.length} tactical puzzles · {solvedPz.size} solved</div>
            <button onClick={()=>randomPuzzle()} style={{padding:"12px 28px",background:"linear-gradient(135deg,#C04A90,#9A3A72)",color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'Cinzel',serif",letterSpacing:".5px",boxShadow:"0 4px 20px rgba(192,74,144,.35)"}}>
              Start Puzzle →
            </button>
          </div>
        ):(
          <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
            {/* Board col */}
            <div style={{flexShrink:0}}>
              <Board brd={pzBoard} onSq={handlePzClick} selSq={pzSel} legalSqs={pzLegal} lastMove={pzLastMv} noFlip={true} onPieceDragStart={pzDragStart}/>
              <div style={{marginTop:8,display:"flex",gap:7}}>
                <button onClick={()=>randomPuzzle()} style={{flex:1,padding:"8px",fontSize:12,background:"#1E1B16",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,cursor:"pointer",color:"#9A9288"}}>↺ Next</button>
                <button onClick={()=>setPzHint(true)} disabled={pzHint} style={{flex:1,padding:"8px",fontSize:12,background:pzHint?"rgba(212,168,67,.08)":"#1E1B16",border:`1px solid ${pzHint?"#D4A843":"rgba(255,255,255,0.06)"}`,borderRadius:10,cursor:pzHint?"default":"pointer",color:pzHint?"#D4A843":"#9A9288",opacity:pzHint?0.6:1}}>💡 Hint</button>
              </div>
            </div>

            {/* Puzzle info col */}
            <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:10}}>
              {/* Status */}
              <div style={{padding:"12px 16px",borderRadius:10,background:st.bg,border:`1px solid ${st.border}`,display:"flex",alignItems:"center",gap:10,animation:"screenIn .2s ease"}}>
                <span style={{fontSize:22,flexShrink:0}}>{st.icon}</span>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:"#EDE8DC"}}>{st.label}</div>
                  <div style={{fontSize:11,color:"#9A9288",marginTop:2,fontFamily:"monospace"}}>{pz.cat} · {"★".repeat(pz.diff)}{"☆".repeat(3-pz.diff)}</div>
                </div>
              </div>

              {/* Info card */}
              <div style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:16,padding:"1rem"}}>
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  <span style={{fontSize:11,padding:"3px 9px",background:"rgba(192,74,144,.12)",color:"#C04A90",borderRadius:20,fontWeight:600}}>{pz.cat}</span>
                  <span style={{fontSize:11,color:"#57534C",fontFamily:"monospace"}}>{Array(pz.diff).fill("★").join("")}{Array(3-pz.diff).fill("☆").join("")}</span>
                </div>
                {pzHint
                  ?<p style={{fontSize:13,color:"#9A9288",lineHeight:1.65,margin:0,borderLeft:"3px solid #D4A843",paddingLeft:10}}>💡 {pz.hint}</p>
                  :<p style={{fontSize:13,color:"#57534C",fontStyle:"italic",margin:0}}>Click Hint when you're stuck!</p>
                }
                {pzStatus==="wrong"&&<button onClick={()=>loadPuzzle(pz)} style={{marginTop:12,width:"100%",padding:"8px",fontSize:13,background:"transparent",border:"1px solid #E85A5A",color:"#E85A5A",borderRadius:10,cursor:"pointer"}}>↺ Reset Puzzle</button>}
                {pzStatus==="solved"&&<button onClick={()=>randomPuzzle()} style={{marginTop:12,width:"100%",padding:"9px",fontSize:13,background:"linear-gradient(135deg,#52C990,#3DAF7A)",color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600}}>Next Puzzle →</button>}
              </div>

              {/* Progress */}
              <div style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:10,padding:"10px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#9A9288",marginBottom:7}}>
                  <span>Puzzles solved</span>
                  <span style={{fontFamily:"monospace",color:"#EDE8DC",fontWeight:600}}>{solvedPz.size} / {PUZZLES.length}</span>
                </div>
                <div className="progress-track"><div className="progress-fill progress-fill-gold" style={{width:`${(solvedPz.size/PUZZLES.length)*100}%`}}/></div>
              </div>

              {/* Tutor */}
              <div style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:16,padding:"0.75rem"}}>
                <div style={{fontSize:13,fontWeight:500,color:"#EDE8DC",marginBottom:10}}>✨ Ask the Tutor</div>
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
  //  LEARN SCREEN
  // ════════════════════════════════════════════════════════════
  const pct=Math.round((doneLessons.size/LESSONS.length)*100);
  const trackColors={beginner:"#52C990",intermediate:"#D4A843",advanced:"#E85A5A"};
  const trackColor=trackColors[lTrack]??"#52C990";

  return(<>
    <div style={{padding:"0.5rem 0 5rem"}} className="screen-enter">
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <button onClick={()=>setScreen("menu")} className="btn-ghost" style={{padding:"6px 12px",fontSize:12}}>← Menu</button>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[["beginner","🌱 Beginner"],["intermediate","⚡ Intermediate"],["advanced","🏆 Advanced"]].map(([id,label])=>(
            <button key={id} onClick={()=>{setLTrack(id);setLIdx(0);}}
              style={{fontSize:12,padding:"5px 13px",borderRadius:20,border:`1px solid ${lTrack===id?trackColors[id]+"55":"rgba(255,255,255,0.06)"}`,background:lTrack===id?`${trackColors[id]}14`:"transparent",color:lTrack===id?trackColors[id]:"#9A9288",cursor:"pointer",fontWeight:lTrack===id?600:400,transition:"all .15s"}}>{label}</button>
          ))}
        </div>
        <div style={{flex:1,display:"flex",alignItems:"center",gap:8,justifyContent:"flex-end"}}>
          <div style={{fontSize:12,color:"#57534C",fontFamily:"monospace"}}>{pct}%</div>
          <div style={{width:80,height:4,background:"#272420",borderRadius:2,overflow:"hidden"}}>
            <div style={{width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,#7C6AF5,#9B8DFF)",borderRadius:2,transition:"width .5s"}}/>
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
        {/* Board col */}
        <div style={{flexShrink:0}}>
          <div style={{fontSize:11,color:"#57534C",marginBottom:7,letterSpacing:".3px"}}>Interactive — try moving pieces</div>
          <Board brd={lBoard} onSq={handleLClick} selSq={lSel} legalSqs={lLegal} lastMove={null} noFlip={true} onPieceDragStart={learnDragStart}/>
          <button onClick={()=>loadLesson(curLesson)} style={{marginTop:7,width:"100%",padding:"7px 0",fontSize:12,background:"#1E1B16",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,cursor:"pointer",color:"#9A9288"}}>↺ Reset position</button>
        </div>

        {/* Lesson content col */}
        <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:10}}>
          {/* Lesson nav */}
          <div style={{display:"flex",alignItems:"center",gap:8,background:"#1E1B16",borderRadius:10,padding:"6px 10px",border:"1px solid rgba(255,255,255,0.06)"}}>
            <button onClick={()=>setLIdx(i=>Math.max(0,i-1))} disabled={lIdx===0} style={{padding:"5px 12px",fontSize:14,background:"transparent",border:"none",cursor:lIdx===0?"default":"pointer",color:lIdx===0?"#57534C":"#9A9288"}}>←</button>
            <span style={{flex:1,textAlign:"center",fontSize:12,color:"#57534C",fontFamily:"monospace"}}>{lIdx+1} / {trackLessons.length}</span>
            <button onClick={()=>setLIdx(i=>Math.min(trackLessons.length-1,i+1))} disabled={lIdx>=trackLessons.length-1} style={{padding:"5px 12px",fontSize:14,background:"transparent",border:"none",cursor:lIdx>=trackLessons.length-1?"default":"pointer",color:lIdx>=trackLessons.length-1?"#57534C":"#9A9288"}}>→</button>
          </div>

          {/* Lesson card */}
          <div style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:16,padding:"1.1rem 1.25rem",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,right:0,width:100,height:100,background:`radial-gradient(circle at top right,${trackColor}15,transparent)`,pointerEvents:"none"}}/>
            <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
              <span style={{fontSize:26,lineHeight:1,filter:`drop-shadow(0 2px 8px ${trackColor}60)`}}>{curLesson.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:17,fontWeight:600,color:"#EDE8DC",fontFamily:"'Cinzel',serif",letterSpacing:".4px",lineHeight:1.2,marginBottom:5}}>{curLesson.title}</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,padding:"2px 8px",background:`${trackColor}18`,color:trackColor,borderRadius:20,fontWeight:600,textTransform:"capitalize"}}>{curLesson.track}</span>
                  <span style={{fontSize:11,color:"#57534C",fontFamily:"monospace"}}>Lesson {lIdx+1}</span>
                </div>
              </div>
              {doneLessons.has(curLesson.id)&&<span style={{fontSize:18,color:"#52C990",flexShrink:0}}>✓</span>}
            </div>
            <p style={{fontSize:13,lineHeight:1.75,color:"#EDE8DC",margin:"0 0 14px",opacity:.9}}>{curLesson.body}</p>
            <div style={{fontSize:12,color:"#9A9288",background:"#1E1B16",padding:"10px 14px",borderRadius:10,borderLeft:`3px solid ${trackColor}`,lineHeight:1.65,border:"1px solid rgba(255,255,255,0.06)"}}>
              💡 {curLesson.tip}
            </div>
          </div>

          {/* Actions */}
          <div style={{display:"flex",gap:8}}>
            <button onClick={markDone} style={{flex:1,padding:"11px",background:doneLessons.has(curLesson.id)?"#1E1B16":"linear-gradient(135deg,#52C990,#3DAF7A)",color:doneLessons.has(curLesson.id)?"#9A9288":"#fff",border:`1px solid ${doneLessons.has(curLesson.id)?"rgba(255,255,255,0.06)":"transparent"}`,borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",transition:"all .18s"}}>
              {doneLessons.has(curLesson.id)?"✓ Completed":"Mark Complete →"}
            </button>
            <button onClick={()=>{setGameMode("ai");setDiff(lTrack==="beginner"?0:lTrack==="intermediate"?2:3);startGame();}} style={{flex:1,padding:"11px",background:"linear-gradient(135deg,#7C6AF5,#6257E0)",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",boxShadow:"0 4px 16px rgba(124,106,245,.22)"}}>
              Practice →
            </button>
          </div>

          {/* Keyboard hints */}
          <div style={{display:"flex",gap:"6px 12px",flexWrap:"wrap",padding:"6px 0"}}>
            {[["←→","Navigate"],["R","Reset"],["Esc","Menu"]].map(([k,label])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:4}}>
                <span className="kbd">{k}</span>
                <span style={{fontSize:11,color:"#57534C"}}>{label}</span>
              </div>
            ))}
          </div>

          {/* Lesson list */}
          <div style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:16,padding:"0.75rem"}}>
            <div style={{fontSize:11,color:"#57534C",marginBottom:8,textTransform:"uppercase",letterSpacing:".04em"}}>All {lTrack} lessons</div>
            <div style={{display:"flex",flexDirection:"column",gap:1,maxHeight:190,overflowY:"auto"}}>
              {trackLessons.map((l,i)=>(
                <button key={l.id} onClick={()=>setLIdx(i)} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 9px",borderRadius:6,background:i===lIdx?"#1E1B16":"transparent",border:`1px solid ${i===lIdx?"rgba(255,255,255,0.06)":"transparent"}`,cursor:"pointer",textAlign:"left",width:"100%",transition:"all .12s"}}>
                  <span style={{fontSize:13,width:18,flexShrink:0}}>{l.icon}</span>
                  <span style={{fontSize:13,color:i===lIdx?"#EDE8DC":"#9A9288",fontWeight:i===lIdx?500:400,flex:1}}>{l.title}</span>
                  {doneLessons.has(l.id)?<span style={{fontSize:12,color:"#52C990"}}>✓</span>:i===lIdx?<span style={{width:6,height:6,borderRadius:"50%",background:trackColor,display:"inline-block"}}/>:null}
                </button>
              ))}
            </div>
          </div>

          {/* Tutor */}
          <div style={{background:"#161310",border:"1px solid rgba(212,168,67,.10)",borderRadius:16,padding:"0.75rem"}}>
            <div style={{fontSize:13,fontWeight:500,color:"#EDE8DC",marginBottom:10}}>✨ Ask the AI Tutor</div>
            <TutorChat height={180} placeholder={`Ask about "${curLesson?.title}"…`}/>
          </div>
        </div>
      </div>
    </div>
    <BottomNav/>
  </>);
}
