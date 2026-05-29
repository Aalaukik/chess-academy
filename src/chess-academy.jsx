import { useState, useEffect, useRef } from "react";
import { useSupabaseProgress } from "./useSupabaseProgress";
import ProfileScreen from "./ProfileScreen";

// ════════════════════════════════════════════════════════════════
//  1. CHESS AI — Minimax + Alpha-Beta Pruning
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

function evalPos(chess) {
  if (chess.isCheckmate()) return chess.turn()==="w" ? -99999 : 99999;
  if (chess.isDraw()) return 0;
  let s=0;
  chess.board().forEach((row,r) => row.forEach((p,c) => {
    if(!p) return;
    const tr = p.color==="w" ? 7-r : r;
    s += (PV[p.type] + (PST[p.type]?.[tr]?.[c]||0)) * (p.color==="w" ? 1 : -1);
  }));
  return s;
}

function mm(chess,d,a,b,max) {
  if(d===0||chess.isGameOver()) return evalPos(chess);
  let best = max ? -Infinity : Infinity;
  for(const m of chess.moves()){
    chess.move(m);
    const v=mm(chess,d-1,a,b,!max);
    chess.undo();
    if(max){best=Math.max(best,v);a=Math.max(a,best);}
    else{best=Math.min(best,v);b=Math.min(b,best);}
    if(b<=a) break;
  }
  return best;
}

const DIFFS=[
  {depth:1,rand:0.90,label:"Beginner",    desc:"Mostly random moves",    color:"#5CB88A"},
  {depth:1,rand:0.42,label:"Casual",      desc:"Basic piece awareness",  color:"#6BB5F0"},
  {depth:2,rand:0.14,label:"Intermediate",desc:"Plans 2–3 moves ahead",  color:"#F5C842"},
  {depth:3,rand:0.04,label:"Advanced",    desc:"Strong tactical play",   color:"#F08C4A"},
  {depth:4,rand:0,   label:"Master",      desc:"Full engine strength",   color:"#E85555"},
];

function getAIMove(chess,di){
  const {depth,rand}=DIFFS[di];
  const moves=chess.moves();
  if(!moves.length) return null;
  if(Math.random()<rand) return moves[Math.floor(Math.random()*moves.length)];
  const isMax=chess.turn()==="w";
  let best=null,bv=isMax?-Infinity:Infinity;
  for(const m of moves){
    chess.move(m);
    const v=mm(chess,depth-1,-Infinity,Infinity,!isMax);
    chess.undo();
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
    try{
      const c=gc(),o=c.createOscillator(),g=c.createGain();
      o.connect(g);g.connect(c.destination);
      o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);
      g.gain.setValueAtTime(vol,c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);
      o.start(c.currentTime);o.stop(c.currentTime+dur);
    }catch{}
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
  walnut:  {l:"#F0D9B5",d:"#B58863",sel:"rgba(246,246,60,.82)",hint:"rgba(20,85,30,.52)",last:"rgba(246,246,60,.40)",bdr:"#8B6B40",name:"Walnut"},
  slate:   {l:"#DEE3E6",d:"#8CA2AD",sel:"rgba(60,180,255,.82)",hint:"rgba(0,100,220,.45)",last:"rgba(60,180,255,.35)",bdr:"#6A8A9A",name:"Slate"},
  jade:    {l:"#FFFFDD",d:"#86A666",sel:"rgba(200,245,60,.85)",hint:"rgba(50,130,20,.50)",last:"rgba(200,245,60,.40)",bdr:"#627A45",name:"Jade"},
  midnight:{l:"#4A4A6A",d:"#1E1A3A",sel:"rgba(155,205,255,.85)",hint:"rgba(100,170,255,.42)",last:"rgba(155,205,255,.32)",bdr:"#2A2460",name:"Midnight"},
  rose:    {l:"#F4DDE0",d:"#C47A85",sel:"rgba(255,230,60,.82)",hint:"rgba(180,50,60,.40)",last:"rgba(255,230,60,.38)",bdr:"#A05065",name:"Rose"},
  ocean:   {l:"#D6EEF8",d:"#2E7EA8",sel:"rgba(255,236,60,.85)",hint:"rgba(0,160,200,.50)",last:"rgba(255,236,60,.40)",bdr:"#1A5F82",name:"Ocean"},
  forest:  {l:"#E8F0D8",d:"#4A7C3F",sel:"rgba(255,240,60,.85)",hint:"rgba(30,100,20,.52)",last:"rgba(255,240,60,.38)",bdr:"#2D5A24",name:"Forest"},
  glass:   {l:"rgba(220,230,245,.75)",d:"rgba(80,100,140,.70)",sel:"rgba(255,220,60,.88)",hint:"rgba(60,100,200,.45)",last:"rgba(255,220,60,.40)",bdr:"rgba(100,130,180,.60)",name:"Glass"},
};

const OPENINGS={
  "e4 e5":"Open Game","e4 e5 Nf3 Nc6 Bc4":"Italian Game","e4 e5 Nf3 Nc6 Bb5":"Ruy López",
  "e4 e6":"French Defense","e4 c5":"Sicilian Defense","e4 c6":"Caro-Kann",
  "d4 d5":"Queen's Gambit","d4 d5 c4":"Queen's Gambit","d4 Nf6":"Indian Defense",
  "d4 Nf6 c4 g6":"King's Indian","Nf3":"Réti Opening","c4":"English Opening",
};
function detectOpening(hist){
  const mv=hist.map(m=>m.san).join(" ");
  let match="";
  for(const[k,n]of Object.entries(OPENINGS)) if(mv.startsWith(k)&&k.length>match.length) match=k;
  return match?OPENINGS[match]:(hist.length>0?"Custom Opening":"");
}

const LESSONS=[
  {id:0,track:"beginner",icon:"♟",title:"The Chessboard",fen:"4k3/8/8/8/8/8/8/4K3 w - - 0 1",
   body:"A chessboard has 64 squares in an 8×8 grid. Files (columns) are labeled a–h left to right. Ranks (rows) are numbered 1–8 from White's side upward. The golden rule: 'light on right' — the bottom-right corner must always be a light square.",
   tip:"Squares are named by file + rank, e.g. e4, d5, g7. Every square has a unique name."},
  {id:1,track:"beginner",icon:"♙",title:"Pawn Power",fen:"4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1",
   body:"Pawns march forward — one square at a time, or two squares from their starting rank. They capture diagonally forward. A pawn reaching the 8th rank promotes to any piece (almost always a queen!). Pawns cannot retreat, so every pawn move is permanent.",
   tip:"En passant: if an enemy pawn moves two squares past yours on an adjacent file, you can capture it as if it moved only one square — but only immediately!"},
  {id:2,track:"beginner",icon:"♘",title:"The Knight's Dance",fen:"4k3/8/8/8/4N3/8/8/4K3 w - - 0 1",
   body:"Knights move in an L-shape — two squares in one direction, one perpendicular. They're the only pieces that jump over others. This makes knights especially deadly in closed positions where other pieces are blocked.",
   tip:"A knight in the center controls up to 8 squares. On the rim it controls only 2–4. 'A knight on the rim is dim!'"},
  {id:3,track:"beginner",icon:"♗",title:"Bishop Diagonals",fen:"4k3/8/8/8/4B3/8/8/4K3 w - - 0 1",
   body:"Bishops slide diagonally any number of squares and stay forever on their starting color. You have one light-squared and one dark-squared bishop. They shine in open positions with long, unobstructed diagonals.",
   tip:"The bishop pair — both bishops working together — is a major strategic advantage, controlling squares of both colors."},
  {id:4,track:"beginner",icon:"♖",title:"Rooks Rule Open Files",fen:"4k3/8/8/8/4R3/8/8/4K3 w - - 0 1",
   body:"Rooks slide horizontally or vertically any number of squares. They're most powerful on open files (no pawns blocking) and the 7th rank, where they attack the opponent's unadvanced pawns from behind. Two rooks doubled on a file are devastating.",
   tip:"Place rooks on open files early. Connecting your rooks (castling and clearing the back rank) is a key opening goal."},
  {id:5,track:"beginner",icon:"♕",title:"Queen Supremacy",fen:"4k3/8/8/8/4Q3/8/8/4K3 w - - 0 1",
   body:"The queen combines the rook and bishop — she moves any number of squares in any direction. Worth roughly 9 pawns, she's by far the most powerful piece. Losing her without compensation almost always loses the game.",
   tip:"Don't bring the queen out too early — she can be chased by enemy pieces and you'll lose precious tempo."},
  {id:6,track:"beginner",icon:"♔",title:"Check, Checkmate & Stalemate",fen:"4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1",
   body:"When the king is under direct attack it's 'check' — you must escape by moving the king, blocking the attack, or capturing the attacker. If no escape exists: checkmate — game over! If the king isn't in check but has no legal move: stalemate — a draw. Avoid stalemating a winning opponent!",
   tip:"Three ways to escape check: (1) move the king, (2) block the attacker, (3) capture the attacker."},
  {id:7,track:"beginner",icon:"♙",title:"Three Opening Rules",fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
   body:"Three golden principles: (1) Control the center — play 1.e4 or 1.d4. (2) Develop all pieces — get knights and bishops to active squares quickly. (3) Castle early — protect your king behind pawns. Follow these and you'll start any game well!",
   tip:"Don't move the same piece twice in the opening unless absolutely necessary — every move should develop a new piece."},
  {id:8,track:"intermediate",icon:"♙",title:"Center Control",fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
   body:"The four central squares — d4, e4, d5, e5 — are the most important battlefield. Pieces controlling the center dominate more of the board and restrict the opponent. Fight for the center from move one with pawns and pieces.",
   tip:"A pawn on e4 controls d5 and f5. A piece in the center has more scope than one on the edge."},
  {id:9,track:"intermediate",icon:"♞",title:"Tactics: The Fork",fen:"r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/5N2/PPPP1PPP/RNBQKBNR w KQkq - 2 3",
   body:"A fork attacks two or more enemy pieces simultaneously with one move — the opponent can only save one. Knights are the best forking pieces because of their unpredictable L-shape. Always scan for fork opportunities on every move!",
   tip:"Look for undefended pieces as fork targets. An undefended knight or bishop next to an undefended rook or queen is a fork waiting to happen."},
  {id:10,track:"intermediate",icon:"♗",title:"Tactics: The Pin",fen:"rnb1kbnr/pp1ppppp/8/q1p5/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 1 3",
   body:"A pin prevents a piece from moving because moving it would expose a more valuable piece behind it. An 'absolute pin' — against the king — means the piece literally cannot legally move. Use pins to paralyze enemy pieces, then pile on attackers.",
   tip:"A pinned piece cannot defend other pieces! Exploit this by attacking other targets while the pin keeps the defender stuck."},
  {id:11,track:"intermediate",icon:"♔",title:"Castling: King Safety",fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5",
   body:"Castling moves the king two squares toward a rook — the rook jumps over to the other side. Castle kingside (O-O) or queenside (O-O-O). Castle early to protect your king! You cannot castle if the king or rook has moved, the king is in check, or any square the king crosses is attacked.",
   tip:"After castling, avoid pushing h3/g3 (or h6/g6) without good reason — those moves weaken your king's shelter."},
  {id:12,track:"intermediate",icon:"♙",title:"Discovered Attacks",fen:"rnbqk2r/ppp2ppp/3p1n2/4p3/1bB1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5",
   body:"A discovered attack happens when you move one piece to reveal an attack from a piece behind it. The moved piece can simultaneously attack a different target — a 'double check' if the king is in check. These are extremely powerful because the opponent cannot block both threats at once.",
   tip:"Scan your pieces for 'hidden attackers' — pieces that would attack a valuable target if another piece moved out of the way."},
  {id:13,track:"advanced",icon:"♙",title:"Pawn Structure",fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
   body:"Pawns are permanent — they cannot retreat. Weak pawn structures haunt you all game. Doubled pawns (two on same file) reduce rook mobility. Isolated pawns (no friendly neighbors) become permanent targets. A passed pawn (nothing blocking it from promotion) is a powerful long-term asset.",
   tip:"Think carefully before every pawn move — that decision can never be undone!"},
  {id:14,track:"advanced",icon:"♖",title:"Tactics: The Skewer",fen:"6k1/6pp/8/1b6/8/8/6PP/R5K1 w - - 0 1",
   body:"A skewer is the reverse of a pin — you attack a valuable piece that must move, exposing a less valuable piece behind it, which you then capture. Rooks, bishops, and queens can execute skewers. Always look at what's behind the piece you're targeting.",
   tip:"After forcing the valuable piece to move, capture what was behind it. The 'prize' in a skewer is always the second piece."},
  {id:15,track:"advanced",icon:"♔",title:"King & Pawn Endgames",fen:"8/8/3k4/8/8/3K4/4P3/8 w - - 0 1",
   body:"In the endgame, the king becomes an active fighting piece — march it toward the action! Key concepts: 'opposition' (kings facing with one square between, forcing the other back), the 'rule of the square' (can your king catch a passed pawn?), and escorting pawns to promotion.",
   tip:"In king-and-pawn endings, getting your king in front of your own pawn (with the opposition) is usually the winning technique."},
  {id:16,track:"advanced",icon:"♗",title:"Opening Systems",fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
   body:"Rather than memorizing every variation, master the principles behind openings: develop all pieces to active squares, fight for the center, castle early, then connect your rooks. Study 1–2 openings deeply with understanding rather than 10 openings by rote memorization.",
   tip:"Always ask 'why?' for every opening move. Understanding the plan behind each move is far more powerful than memorizing sequences."},
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
export default function ChessAcademy({ user = null, onSignOut }) {
  const ChessLib=useRef(null);
  const [loaded,setLoaded]=useState(false);
  const [loadErr,setLoadErr]=useState(false);

  // ── Move quality badges
  const preMoveEval = useRef(0);       // eval BEFORE player's move
  const [moveQualities, setMoveQualities] = useState([]); // one entry per half-move
  const [lastBadge, setLastBadge] = useState(null); // badge shown on board after move
  const [board,setBoard]=useState([]);
  const [sel,setSel]=useState(null);
  const [legal,setLegal]=useState([]);
  const [lastMv,setLastMv]=useState(null);
  const [gStatus,setGStatus]=useState("idle"); // idle|playing|checkmate|stalemate|draw|resign|timeout
  const [winner,setWinner]=useState(null);
  const [hist,setHist]=useState([]);
  const [inChk,setInChk]=useState(false);
  const [evalBar,setEvalBar]=useState(50);
  const [opening,setOpening]=useState("");
  const [promoDialog,setPromoDialog]=useState(null);

  // ── app
  const [screen,setScreen]=useState("menu");
  const [diff,setDiff]=useState(1);
  const [pCol,setPCol]=useState("w");
  const [theme,setTheme]=useState("walnut");
  const [flipped,setFlipped]=useState(false);
  const [aiThink,setAiThink]=useState(false);
  const [hintSq,setHintSq]=useState(null);
  const [panelTab,setPanelTab]=useState("moves");

  // ── timer
  const [timeW,setTimeW]=useState(600);
  const [timeB,setTimeB]=useState(600);
  const [timerOn,setTimerOn]=useState(false);
  const [useTimer,setUseTimer]=useState(false);
  const [timeCtrl,setTimeCtrl]=useState(600);
  const timerRef=useRef(null);

  // ── settings
  const [soundOn,setSoundOn]=useState(true);
  const [showCoords,setShowCoords]=useState(true);
  const [animSpd,setAnimSpd]=useState("normal");

  // ── progress
  const [doneLessons,setDoneLessons]=useState(new Set());
  const [solvedPz,setSolvedPz]=useState(new Set());
  const [streak,setStreak]=useState(0);
  const [stats,setStats]=useState({w:0,l:0,d:0});
  const [elo,setElo]=useState(1200); // player Elo rating

  // ── pass-and-play
  const [gameMode,setGameMode]=useState("ai"); // "ai" | "p2p"
  const [p2pNames,setP2pNames]=useState({w:"White",b:"Black"});
  const [p2pFlipOnTurn,setP2pFlipOnTurn]=useState(true); // auto-flip board each turn

  // ── learn
  const [lTrack,setLTrack]=useState("beginner");
  const [lIdx,setLIdx]=useState(0);
  const lgRef=useRef(null);
  const [lBoard,setLBoard]=useState([]);
  const [lSel,setLSel]=useState(null);
  const [lLegal,setLLegal]=useState([]);

  // ── puzzles
  const [pz,setPz]=useState(null);
  const pzRef=useRef(null);
  const [pzBoard,setPzBoard]=useState([]);
  const [pzSel,setPzSel]=useState(null);
  const [pzLegal,setPzLegal]=useState([]);
  const [pzLastMv,setPzLastMv]=useState(null);
  const [pzStatus,setPzStatus]=useState("idle"); // idle|correct|wrong|solved
  const [pzMvIdx,setPzMvIdx]=useState(0);
  const [pzHint,setPzHint]=useState(false);
  const [pzFilter,setPzFilter]=useState("All");

  // ── tutor
  const [msgs,setMsgs]=useState([]);
  const [tutIn,setTutIn]=useState("");
  const [tutBusy,setTutBusy]=useState(false);
  const tutEndRef=useRef(null);
  const moveListRef=useRef(null);

  // ── Game chess instance
  const gRef=useRef(null);

  // ── Drag-and-drop
  const dragRef=useRef(null);           // {from, boardEl, noFlip}
  const dragJustMoved=useRef(false);    // absorb the click that fires after a drag
  const dragHandlersRef=useRef({});     // always-current handler refs for window listeners
  const [ghostState,setGhostState]=useState(null); // {x,y,pk,isW} — floating piece
  const playBoardRef=useRef(null);      // stable ref to the play board DOM node

  // ── Share result card
  const [shareModal,setShareModal]=useState(false);

  // ── Load chess.js
  useEffect(()=>{
    import("https://esm.sh/chess.js@1.1.0")
      .then(m=>{ChessLib.current=m.Chess;setLoaded(true);})
      .catch(()=>setLoadErr(true));
  },[]);

  // ── Load stored progress (guests use local storage, logged-in users use Supabase)
  useEffect(()=>{
    if(user) return; // Supabase hook handles this for logged-in users
    (async()=>{
      try{
        const r=await window.storage?.get("chess_v2");
        if(r?.value){
          const p=JSON.parse(r.value);
          if(p.done) setDoneLessons(new Set(p.done));
          if(p.solved) setSolvedPz(new Set(p.solved));
          if(p.streak) setStreak(p.streak);
          if(p.stats) setStats(p.stats);
          if(p.elo) setElo(p.elo);
        }
      }catch{}
    })();
  },[]);

  async function saveProgress(dl=doneLessons,sp=solvedPz,sk=streak,st=stats,el=elo){
    if(user) return;
    try{await window.storage?.set("chess_v2",JSON.stringify({done:[...dl],solved:[...sp],streak:sk,stats:st,elo:el}));}catch{}
  }

  // ── Supabase progress sync (logged-in users only)
  const gameStartTime = useRef(null);
  const { saveGame } = useSupabaseProgress({
    user,
    setDoneLessons, setSolvedPz, setStreak, setStats,
    doneLessons, solvedPz, streak, stats,
  });

  function play(k){if(soundOn) SND[k]?.();}

  // ── Elo calculation (standard K=32 formula) ────────────────────
  // diffElos: array of pseudo-Elo per difficulty [800,1000,1200,1600,2000]
  const DIFF_ELO=[800,1000,1200,1600,2000];
  function calcNewElo(playerElo, opponentElo, result){
    // result: 1=win, 0.5=draw, 0=loss
    const K=32;
    const expected=1/(1+Math.pow(10,(opponentElo-playerElo)/400));
    return Math.round(playerElo + K*(result-expected));
  }
  // ════════════════════════════════════════════════════════════════
  function syncGame(g=gRef.current){
    if(!g) return;
    setBoard([...g.board()]);
    const h=g.history({verbose:true});
    setHist([...h]);
    setInChk(g.inCheck());
    setOpening(detectOpening(h));
    const raw=Math.max(-15,Math.min(15,evalPos(g)/100));
    setEvalBar(Math.round(((raw+15)/30)*100));
    // In p2p mode, auto-flip so the active player always faces their pieces
    if(gameMode==="p2p"&&p2pFlipOnTurn&&!g.isGameOver()){
      setFlipped(g.turn()==="b");
    }
    if(g.isCheckmate()){setGStatus("checkmate");setWinner(g.turn()==="w"?"Black":"White");setTimerOn(false);}
    else if(g.isStalemate()){setGStatus("stalemate");setTimerOn(false);}
    else if(g.isDraw()){setGStatus("draw");setTimerOn(false);}
    else setGStatus("playing");
  }

  // ── Classify a move by eval delta (from the moving player's perspective)
  function classifyMove(evalBefore, evalAfter, playerColor){
    // Convert to "from mover's POV" — positive = good for mover
    const sign = playerColor === "w" ? 1 : -1;
    const before = evalBefore * sign;
    const after  = evalAfter  * sign;
    const delta  = after - before; // negative = move lost centipawns

    if(delta >= 0)        return { label:"Best",        sym:"!",   color:"#5CB88A", bg:"rgba(92,184,138,.15)"  };
    if(delta >= -15)      return { label:"Good",        sym:"✓",   color:"#5CB88A", bg:"rgba(92,184,138,.12)"  };
    if(delta >= -50)      return { label:"Inaccuracy",  sym:"?",   color:"#F5C842", bg:"rgba(245,200,66,.15)"  };
    if(delta >= -150)     return { label:"Mistake",     sym:"??",  color:"#F08C4A", bg:"rgba(240,140,74,.15)"  };
    return                       { label:"Blunder",     sym:"???", color:"#E85555", bg:"rgba(232,85,85,.15)"   };
  }

  // ── Keep flipped in a ref so drag-end closure always reads latest ─
  const flippedRef=useRef(flipped);
  useEffect(()=>{flippedRef.current=flipped;},[flipped]);

  // ── Convert mouse/touch position to board square ──────────────
  // rect is from the wrapper div (position:relative) that wraps <Board>
  // The Board renders: optional 18px coord col, then 8×SQ squares
  function getSqFromPos(clientX, clientY, rect, fl){
    const coordOff = showCoords ? 18 : 0; // coord label column inside the board
    const borderOff = 2;                   // board has a 2px border
    const relX = clientX - rect.left - borderOff - coordOff;
    const relY = clientY - rect.top  - borderOff;
    const ci = Math.floor(relX / SQ);
    const ri = Math.floor(relY / SQ);
    if(ci<0||ci>7||ri<0||ri>7) return null;
    const bCol = fl ? 7-ci : ci;
    const bRow = fl ? 7-ri : ri;
    return `${String.fromCharCode(97+bCol)}${8-bRow}`;
  }

  // ── Drag start (mousedown / touchstart on a piece) ────────────
  function startDrag(e, sq){
    const g=gRef.current;
    if(!g||gStatus!=="playing"||aiThink||promoDialog) return;
    const piece=g.get(sq);
    const activeTurn=g.turn();
    const canDrag=gameMode==="p2p"?piece&&piece.color===activeTurn:piece&&piece.color===pCol;
    if(!canDrag) return;
    // Only prevent default for touch (prevents scroll); mouse clicks still fire normally
    if(e.touches) e.preventDefault();
    const clientX=e.touches?e.touches[0].clientX:e.clientX;
    const clientY=e.touches?e.touches[0].clientY:e.clientY;
    // Store drag origin for distance check (distinguish click vs drag)
    dragRef.current={from:sq, startX:clientX, startY:clientY, moved:false};
    const pk=`${piece.color}${piece.type.toUpperCase()}`;
    setGhostState({x:clientX, y:clientY, pk, isW:piece.color==="w"});
    setSel(sq);
    setLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));
  }

  // ── Drag move ─────────────────────────────────────────────────
  function onDragMove(e){
    if(!dragRef.current) return;
    if(e.cancelable) e.preventDefault();
    const clientX=e.touches?e.touches[0].clientX:e.clientX;
    const clientY=e.touches?e.touches[0].clientY:e.clientY;
    // Mark as a real drag once cursor moves >5px
    if(!dragRef.current.moved){
      const dx=clientX-dragRef.current.startX;
      const dy=clientY-dragRef.current.startY;
      if(Math.abs(dx)>5||Math.abs(dy)>5) dragRef.current.moved=true;
    }
    setGhostState(s=>s?{...s,x:clientX,y:clientY}:null);
  }

  // ── Drag end — execute move if dropped on a legal square ──────
  function onDragEnd(e){
    if(!dragRef.current) return;
    const {from, moved}=dragRef.current;
    dragRef.current=null;
    setGhostState(null);

    // If cursor barely moved, treat as a click — let onClick handle it
    if(!moved) return;

    // Real drag: suppress the following click event
    dragJustMoved.current=true;
    setTimeout(()=>{dragJustMoved.current=false;},150);

    const clientX=e.changedTouches?e.changedTouches[0].clientX:e.clientX;
    const clientY=e.changedTouches?e.changedTouches[0].clientY:e.clientY;

    // Use the stable parent-level ref — never stale
    const boardEl=playBoardRef.current;
    if(!boardEl){setSel(null);setLegal([]);return;}
    const rect=boardEl.getBoundingClientRect();
    const fl=flippedRef.current;
    const to=getSqFromPos(clientX,clientY,rect,fl);

    if(!to||to===from){setSel(null);setLegal([]);return;}
    const g=gRef.current;
    if(!g||gStatus!=="playing"||aiThink) return;
    const activeTurn=g.turn();
    if(gameMode==="ai"&&activeTurn!==pCol){setSel(null);setLegal([]);return;}
    const legalMoves=g.moves({square:from,verbose:true}).map(m=>m.to);
    if(!legalMoves.includes(to)){setSel(null);setLegal([]);return;}

    const piece=g.get(from);
    const isPromo=piece?.type==="p"&&((activeTurn==="w"&&to[1]==="8")||(activeTurn==="b"&&to[1]==="1"));
    if(isPromo){preMoveEval.current=evalPos(g);setPromoDialog({from,to});setSel(null);setLegal([]);return;}

    const evalBefore=evalPos(g);
    const r=g.move({from,to,promotion:"q"});
    if(r){
      const evalAfter=evalPos(g);
      const badge=classifyMove(evalBefore,evalAfter,activeTurn);
      setMoveQualities(q=>[...q,badge]);
      setLastBadge(badge);
      setTimeout(()=>setLastBadge(null),2200);
      setLastMv({from:r.from,to:r.to});setSel(null);setLegal([]);setHintSq(null);
      if(r.captured) play("capture");
      else if(r.flags.includes("k")||r.flags.includes("q")) play("castle");
      else play("move");
      if(g.inCheck()) play("check");
      syncGame(g);
      if(gameMode==="ai"){
        const aiC=pCol==="w"?"b":"w";
        if(!g.isGameOver()&&g.turn()===aiC) setTimeout(()=>runAI(g),300);
      }
    } else {setSel(null);setLegal([]);}
  }

  // ── Share card helpers ────────────────────────────────────────
  function computeAccuracy(qualities){
    if(!qualities.length) return null;
    const W={Best:100,Good:90,Inaccuracy:70,Mistake:40,Blunder:0};
    return Math.round(qualities.reduce((s,q)=>s+(W[q.label]??50),0)/qualities.length);
  }

  function generateShareText(){
    const acc=computeAccuracy(moveQualities);
    const resultLine=
      gStatus==="checkmate"?(winner===(pCol==="w"?"White":"Black")?"🏆 Victory!":"💀 Defeat")
      :gStatus==="draw"||gStatus==="stalemate"?"🤝 Draw"
      :gStatus==="resign"?"🏳 Resigned"
      :gStatus==="timeout"?"⏰ Time out":"";
    const good=moveQualities.filter(m=>m.label==="Best"||m.label==="Good").length;
    const inac=moveQualities.filter(m=>m.label==="Inaccuracy").length;
    const mist=moveQualities.filter(m=>m.label==="Mistake").length;
    const blun=moveQualities.filter(m=>m.label==="Blunder").length;
    return [
      "♟ Chess Academy",
      "",
      `${resultLine} vs ${DIFFS[diff].label}`,
      acc!=null?`Accuracy: ${acc}/100`:"",
      `${hist.length} moves${opening?" · "+opening:""}`,
      "",
      `✓ ${good} best/good   ? ${inac} inaccurate   ?? ${mist} mistakes   ??? ${blun} blunders`,
      "",
      "https://chess-academy.vercel.app",
    ].filter(l=>l!==null).join("\n");
  }

  // Keep drag handlers always fresh (no stale closure in window listeners)
  dragHandlersRef.current={onDragMove,onDragEnd};

  // ── Window-level drag listeners (mounted once) ────────────────
  useEffect(()=>{
    const mm=(e)=>dragHandlersRef.current.onDragMove(e);
    const mu=(e)=>dragHandlersRef.current.onDragEnd(e);
    window.addEventListener("mousemove",mm);
    window.addEventListener("mouseup",mu);
    window.addEventListener("touchmove",mm,{passive:false});
    window.addEventListener("touchend",mu);
    return()=>{
      window.removeEventListener("mousemove",mm);
      window.removeEventListener("mouseup",mu);
      window.removeEventListener("touchmove",mm);
      window.removeEventListener("touchend",mu);
    };
  },[]);

  function startGame(){
    if(!loaded) return;
    clearInterval(timerRef.current);
    const g=new ChessLib.current();
    gRef.current=g;
    gameStartTime.current = Date.now();
    setBoard(g.board());
    setGStatus("playing");setWinner(null);setHist([]);setSel(null);setLegal([]);
    setLastMv(null);setInChk(false);setEvalBar(50);setHintSq(null);setAiThink(false);setOpening("");
    setMoveQualities([]); setLastBadge(null); preMoveEval.current=0;
    setShareModal(false);
    setTimeW(timeCtrl);setTimeB(timeCtrl);
    if(gameMode==="p2p"){
      setFlipped(false); // white always starts facing up
    } else {
      setFlipped(pCol==="b");
    }
    const intro=gameMode==="p2p"
      ?`Pass-and-play game started! ${p2pNames.w} (White) moves first. Good luck to both players! ♟`
      :`Let's play! I'm set to ${DIFFS[diff].label} difficulty ♟ Ask me anything about chess, moves, or strategy!`;
    setMsgs([{role:"assistant",content:intro}]);
    setPanelTab("moves");
    setScreen("play");
    if(useTimer) setTimerOn(true);
    if(gameMode==="ai"&&pCol==="b") setTimeout(()=>runAI(g),600);
  }

  function runAI(g=gRef.current){
    if(!g||g.isGameOver()) return;
    setAiThink(true);
    const delay=animSpd==="fast"?200:animSpd==="slow"?800:420;
    setTimeout(()=>{
      const mv=getAIMove(g,diff);
      if(mv){
        const r=g.move(mv);
        if(r){
          setLastMv({from:r.from,to:r.to});
          if(r.captured) play("capture");
          else if(r.flags.includes("k")||r.flags.includes("q")) play("castle");
          else play("move");
          if(g.inCheck()) play("check");
        }
      }
      syncGame(g);setAiThink(false);
    },delay);
  }

  function handleSqClick(sq){
    const g=gRef.current;
    if(dragJustMoved.current){dragJustMoved.current=false;return;}
    if(!g||gStatus!=="playing"||aiThink||promoDialog) return;
    // In AI mode only the player's colour moves; in p2p both colours move
    const activeTurn=g.turn();
    if(gameMode==="ai"&&activeTurn!==pCol) return;
    if(sel&&legal.includes(sq)){
      const piece=g.get(sel);
      const isPromo=piece?.type==="p"&&((activeTurn==="w"&&sq[1]==="8")||(activeTurn==="b"&&sq[1]==="1"));
      if(isPromo){
        preMoveEval.current = evalPos(g);
        setPromoDialog({from:sel,to:sq});
        return;
      }
      const evalBefore = evalPos(g);
      const r=g.move({from:sel,to:sq,promotion:"q"});
      if(r){
        const evalAfter = evalPos(g);
        const badge = classifyMove(evalBefore, evalAfter, activeTurn);
        setMoveQualities(q=>[...q, badge]);
        setLastBadge(badge);
        setTimeout(()=>setLastBadge(null), 2200);
        setLastMv({from:r.from,to:r.to});setSel(null);setLegal([]);setHintSq(null);
        if(r.captured) play("capture");
        else if(r.flags.includes("k")||r.flags.includes("q")) play("castle");
        else play("move");
        if(g.inCheck()) play("check");
        syncGame(g);
        if(gameMode==="ai"){
          const aiC=pCol==="w"?"b":"w";
          if(!g.isGameOver()&&g.turn()===aiC) setTimeout(()=>runAI(g),300);
        }
      }
      return;
    }
    const piece=g.get(sq);
    const canSelect=gameMode==="p2p"?piece&&piece.color===activeTurn:piece&&piece.color===pCol;
    if(canSelect){setSel(sq);setLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));}
    else{setSel(null);setLegal([]);}
  }

  function doPromotion(pt){
    if(!promoDialog) return;
    const g=gRef.current;
    const evalBefore = preMoveEval.current || evalPos(g);
    const r=g.move({from:promoDialog.from,to:promoDialog.to,promotion:pt});
    setPromoDialog(null);
    if(r){
      const evalAfter = evalPos(g);
      const badge = classifyMove(evalBefore, evalAfter, pCol);
      setMoveQualities(q=>[...q, badge]);
      setLastBadge(badge);
      setTimeout(()=>setLastBadge(null), 2200);
      setLastMv({from:r.from,to:r.to});setSel(null);setLegal([]);
      play("move");if(g.inCheck()) play("check");
      syncGame(g);
      const aiC=pCol==="w"?"b":"w";
      if(!g.isGameOver()&&g.turn()===aiC) setTimeout(()=>runAI(g),300);
    }
  }

  function undoMove(){
    const g=gRef.current;if(!g||hist.length<2) return;
    g.undo();g.undo();syncGame(g);
    setSel(null);setLegal([]);setLastMv(null);setHintSq(null);
    setGStatus("playing");setWinner(null);
  }

  function resign(){
    const g=gRef.current;
    // In p2p, whoever's turn it is resigns
    const resignColor=gameMode==="p2p"?(g?.turn()||"w"):pCol;
    const w=resignColor==="w"?"Black":"White";
    setGStatus("resign");setWinner(w);setTimerOn(false);
    play("over");
    if(gameMode==="ai"){
      const ns={...stats,l:stats.l+1};setStats(ns);saveProgress(undefined,undefined,undefined,ns);
    }
  }

  function showHint(){
    const g=gRef.current;if(!g||gStatus!=="playing") return;
    const mv=getAIMove(g,Math.min(diff+1,4));
    if(mv){
      const m=g.moves({verbose:true}).find(m=>m.san===mv);
      if(m) setHintSq(m.from);
      else{ const m2=g.moves({verbose:true})[0];if(m2) setHintSq(m2.from);}
    }
  }

  // ── Game-over side-effects
  useEffect(()=>{
    if(gStatus==="checkmate"||gStatus==="stalemate"||gStatus==="draw"||gStatus==="resign"){
      const iWon=winner===(pCol==="w"?"White":"Black");

      // ── Elo update (AI mode only)
      if(gameMode==="ai"){
        const result=gStatus==="checkmate"?(iWon?1:0):gStatus==="resign"?0:0.5;
        const newElo=calcNewElo(elo,DIFF_ELO[diff],result);
        setElo(newElo);
        saveProgress(undefined,undefined,undefined,undefined,newElo);
      }

      // ── Save game to Supabase
      const result = gStatus==="checkmate" ? (iWon?"win":"loss")
                   : gStatus==="resign"    ? "loss"
                   : "draw";
      const durationS = gameStartTime.current
        ? Math.round((Date.now() - gameStartTime.current) / 1000)
        : 0;
      saveGame({
        result,
        playerColor: pCol,
        difficulty:  diff,
        moves:       hist.map(m=>m.san),
        opening,
        durationS,
      });

      if(gStatus==="checkmate"&&iWon){play("win");const ns={...stats,w:stats.w+1};setStats(ns);saveProgress(undefined,undefined,undefined,ns);}
      else if(gStatus==="checkmate"||gStatus==="resign"){play("over");if(gStatus!=="resign"){const ns={...stats,l:stats.l+1};setStats(ns);saveProgress(undefined,undefined,undefined,ns);}}
      else{play("over");const ns={...stats,d:stats.d+1};setStats(ns);saveProgress(undefined,undefined,undefined,ns);}
    }
  },[gStatus]);

  // ── Timer
  useEffect(()=>{
    if(!timerOn||!useTimer) return;
    timerRef.current=setInterval(()=>{
      if(gRef.current?.turn()==="w"){
        setTimeW(t=>{if(t<=1){clearInterval(timerRef.current);setGStatus("timeout");setWinner("Black");return 0;}return t-1;});
      }else{
        setTimeB(t=>{if(t<=1){clearInterval(timerRef.current);setGStatus("timeout");setWinner("White");return 0;}return t-1;});
      }
    },1000);
    return()=>clearInterval(timerRef.current);
  },[timerOn,useTimer]);

  // ── Scroll move list
  useEffect(()=>{moveListRef.current?.lastElementChild?.scrollIntoView({behavior:"smooth"});},[hist]);

  // ── Scroll tutor
  useEffect(()=>{tutEndRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  function fmtTime(s){const m=Math.floor(s/60);return `${m}:${(s%60).toString().padStart(2,"0")}`;}

  // ════════════════════════════════════════════════════════════════
  //  LEARN LOGIC — declared early so keyboard hook can use these
  // ════════════════════════════════════════════════════════════════
  const trackLessons=LESSONS.filter(l=>l.track===lTrack);
  const curLesson=trackLessons[lIdx]??LESSONS[0];

  function loadLesson(lesson){
    if(!loaded||!lesson) return;
    // Fallback FEN in case lesson FEN is invalid
    const safeFen = lesson.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    let g;
    try{
      g=new ChessLib.current(safeFen);
    }catch(e){
      console.warn("Invalid lesson FEN, using starting position:", safeFen, e.message);
      g=new ChessLib.current(); // fallback to starting position
    }
    lgRef.current=g;setLBoard(g.board());setLSel(null);setLLegal([]);
  }
  useEffect(()=>{if(loaded&&screen==="learn") loadLesson(curLesson);},[loaded,lIdx,lTrack,screen]);

  function handleLClick(sq){
    const g=lgRef.current;if(!g) return;
    if(lSel&&lLegal.includes(sq)){
      const r=g.move({from:lSel,to:sq,promotion:"q"});
      if(r){setLBoard([...g.board()]);setLSel(null);setLLegal([]);return;}
    }
    const piece=g.get(sq);
    if(piece){setLSel(sq);setLLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));}
    else{setLSel(null);setLLegal([]);}
  }

  function markDone(){
    const upd=new Set(doneLessons);upd.add(curLesson.id);setDoneLessons(upd);saveProgress(upd);
    if(lIdx<trackLessons.length-1) setLIdx(lIdx+1);
  }

  // ════════════════════════════════════════════════════════════════
  //  PUZZLE LOGIC
  // ════════════════════════════════════════════════════════════════
  function loadPuzzle(puzzle){
    if(!loaded||!puzzle) return;
    let g;
    try{
      g=new ChessLib.current(puzzle.fen);
    }catch(e){
      console.warn("Invalid puzzle FEN:", puzzle.fen, e.message);
      return;
    }
    pzRef.current=g;setPz(puzzle);
    setPzBoard(g.board());setPzSel(null);setPzLegal([]);setPzLastMv(null);
    setPzStatus("idle");setPzMvIdx(0);setPzHint(false);
  }

  function randomPuzzle(filter=pzFilter){
    const pool=PUZZLES.filter(p=>filter==="All"||p.cat===filter);
    const unsolved=pool.filter(p=>!solvedPz.has(p.id));
    const src=unsolved.length?unsolved:pool;
    loadPuzzle(src[Math.floor(Math.random()*src.length)]);
  }

  // ── Keyboard shortcuts (placed after all referenced functions are defined)
  useEffect(()=>{
    function onKey(e){
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;
      if(screen==="play"){
        if(e.key==="u"||e.key==="U") undoMove();
        if(e.key==="h"||e.key==="H") showHint();
        if(e.key==="f"||e.key==="F") setFlipped(f=>!f);
        if(e.key==="n"||e.key==="N") startGame();
      }
      if(screen==="learn"){
        if(e.key==="ArrowRight") setLIdx(i=>Math.min(trackLessons.length-1,i+1));
        if(e.key==="ArrowLeft")  setLIdx(i=>Math.max(0,i-1));
        if(e.key==="r"||e.key==="R") loadLesson(curLesson);
      }
      if(screen==="puzzles"){
        if(e.key==="n"||e.key==="N") randomPuzzle();
        if(e.key==="h"||e.key==="H") setPzHint(true);
      }
      if(e.key==="Escape") setScreen("menu");
    }
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[screen,hist,lIdx,lTrack,pz]);

  function handlePzClick(sq){
    const g=pzRef.current;
    if(!g||!pz||pzStatus==="solved"||pzStatus==="wrong") return;
    if(pzSel&&pzLegal.includes(sq)){
      const expected=pz.sol[pzMvIdx];
      const r=g.move({from:pzSel,to:sq,promotion:"q"});
      if(!r){setPzSel(null);setPzLegal([]);return;}
      setPzLastMv({from:r.from,to:r.to});setPzBoard([...g.board()]);setPzSel(null);setPzLegal([]);
      if(r.san===expected||r.from+r.to===expected||r.from+r.to+r.promotion===expected){
        const next=pzMvIdx+1;
        if(next>=pz.sol.length){
          setPzStatus("solved");play("pzOk");
          const sk=streak+1;setStreak(sk);
          const ns=new Set(solvedPz);ns.add(pz.id);setSolvedPz(ns);
          saveProgress(undefined,ns,sk,undefined);
        } else {
          setPzMvIdx(next);setPzStatus("correct");play("move");
          if(pz.sol[next]){
            setTimeout(()=>{
              const opp=g.move(pz.sol[next]);
              if(opp){setPzLastMv({from:opp.from,to:opp.to});setPzBoard([...g.board()]);setPzMvIdx(next+1);setPzStatus("idle");}
            },600);
          }
        }
      } else {
        g.undo();setPzBoard([...g.board()]);setPzLastMv(null);
        setPzStatus("wrong");play("pzFail");
        const sk=0;setStreak(sk);saveProgress(undefined,undefined,sk,undefined);
      }
      return;
    }
    const piece=g.get(sq);
    if(piece&&piece.color===g.turn()){setPzSel(sq);setPzLegal(g.moves({square:sq,verbose:true}).map(m=>m.to));}
    else{setPzSel(null);setPzLegal([]);}
  }

  // ════════════════════════════════════════════════════════════════
  //  TUTOR
  // ════════════════════════════════════════════════════════════════
  const lastMsgTime = useRef(0);
  const tutorCache  = useRef({});   // cache identical questions → reuse answers

  async function sendMsg(){
    const q=tutIn.trim(); if(!q) return;

    // ── 3s cooldown ──────────────────────────────────────────
    const now=Date.now();
    if(now-lastMsgTime.current<3000){
      setMsgs(p=>[...p,{role:"assistant",content:"⏳ Please wait a moment before sending another message."}]);
      return;
    }
    lastMsgTime.current=now;

    // ── Build context ────────────────────────────────────────
    const g=screen==="puzzles"?pzRef.current:screen==="learn"?lgRef.current:gRef.current;
    const fen=g?.fen()??"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const mvs=g?.history().slice(-8).join(" ")||"none";
    const ctx=screen==="learn"?`Current lesson: "${curLesson?.title}". `
             :screen==="puzzles"&&pz?`Current puzzle type: "${pz.cat}". `:"";
    const systemPrompt=`You are an encouraging, expert chess tutor for Chess Academy. ${ctx}Current position FEN: ${fen}. Recent moves: ${mvs}. Be warm, concise (2-4 sentences), use algebraic notation when helpful, give concrete actionable advice. Use chess emojis occasionally.`;

    // ── Cache hit ─────────────────────────────────────────────
    const cacheKey=`${q}|${fen.slice(0,20)}`;
    if(tutorCache.current[cacheKey]){
      setMsgs(p=>[...p,{role:"user",content:q},{role:"assistant",content:tutorCache.current[cacheKey]}]);
      setTutIn(""); return;
    }

    // ── Key check ─────────────────────────────────────────────
    const apiKey=import.meta.env.VITE_GROQ_KEY;
    if(!apiKey){
      setMsgs(p=>[...p,{role:"assistant",content:"⚠️ Tutor not configured. Add VITE_GROQ_KEY to Vercel → Settings → Environment Variables. Get a free key at console.groq.com"}]);
      return;
    }

    const newMsgs=[...msgs,{role:"user",content:q}];
    setMsgs(newMsgs); setTutIn(""); setTutBusy(true);

    // ── Groq free models — try in order ───────────────────────
    const MODELS=[
      "llama-3.1-8b-instant",   // fastest, free
      "llama3-8b-8192",         // stable free model
      "gemma2-9b-it",           // Google Gemma via Groq
      "mixtral-8x7b-32768",     // Mixtral fallback
    ];

    async function callGroq(model){
      const res=await fetch("https://api.groq.com/openai/v1/chat/completions",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":`Bearer ${apiKey}`,
        },
        body:JSON.stringify({
          model,
          messages:[
            {role:"system", content:systemPrompt},
            ...newMsgs.map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.content}))
          ],
          max_tokens:400,
          temperature:0.7,
        })
      });
      return {status:res.status, data:res.ok?await res.json():await res.json()};
    }

    try{
      let reply=null; let lastErr="";
      for(const model of MODELS){
        let result;
        try{ result=await callGroq(model); }
        catch{ lastErr="Network error"; continue; }
        const {status,data}=result;
        if(status===401){throw new Error("Invalid API key. Check VITE_GROQ_KEY in Vercel → Settings → Environment Variables.");}
        if(status===429){throw new Error("Rate limit hit — wait 30 seconds and try again. (Free: 30 req/min, 14,400/day)");}
        if(status===503||status===500){lastErr=`Model ${model} unavailable`;continue;}
        if(status!==200){lastErr=data?.error?.message||`HTTP ${status}`;continue;}
        reply=data?.choices?.[0]?.message?.content;
        if(reply) break;
      }
      if(!reply) throw new Error(lastErr||"All models unavailable — try again in a moment.");
      tutorCache.current[cacheKey]=reply;
      setMsgs(p=>[...p,{role:"assistant",content:reply}]);
    }catch(e){
      setMsgs(p=>[...p,{role:"assistant",content:`❌ ${e.message}`}]);
    }
    setTutBusy(false);
  }

  // ════════════════════════════════════════════════════════════════
  //  BOARD RENDERER
  // ════════════════════════════════════════════════════════════════
  function Board({brd,onSq,selSq,legalSqs=[],lastMove=null,noFlip=false,chkSq=null,hintSq2=null,sz=SQ,onPieceDragStart=null}){
    const t=THEMES[theme];
    const fl=flipped&&!noFlip;
    const rows=fl?[...brd].reverse():brd;
    const isPlayBoard=!noFlip;
    const isMyTurnNow=gRef.current?.turn()===pCol;
    return(
      <div style={{display:"inline-flex",flexDirection:"column",borderRadius:6,overflow:"hidden",
        boxShadow:"0 20px 60px rgba(0,0,0,.55),0 3px 10px rgba(0,0,0,.4)",
        border:`2px solid ${t.bdr}`,
        outline: isPlayBoard && gStatus==="playing"
          ? isMyTurnNow ? "3px solid #534AB7" : "3px solid rgba(83,74,183,0.22)"
          : "3px solid transparent",
        outlineOffset:"2px",
        transition:"outline-color .4s ease",
        boxSizing:"border-box",
        userSelect:"none",
        WebkitUserSelect:"none"}}>
        {rows.map((rowData,ri)=>{
          const bRow=fl?7-ri:ri;const rank=8-bRow;
          const dispRow=fl?[...rowData].reverse():rowData;
          return(
            <div key={ri} style={{display:"flex"}}>
              {showCoords&&<div style={{width:18,height:sz,display:"flex",alignItems:"center",justifyContent:"center",background:"#12100E",fontSize:9,color:"#666",fontFamily:"monospace",fontWeight:700,flexShrink:0}}>{rank}</div>}
              {dispRow.map((piece,ci)=>{
                const bCol=fl?7-ci:ci;
                const sq=`${String.fromCharCode(97+bCol)}${rank}`;
                const isLight=(bRow+bCol)%2!==0;
                const isSel=selSq===sq;
                const isLeg=legalSqs.includes(sq);
                const isLF=lastMove?.from===sq;const isLT=lastMove?.to===sq;
                const isChk=chkSq===sq;const isHint=hintSq2===sq;
                const pk=piece?`${piece.color}${piece.type.toUpperCase()}`:null;
                const isW=piece?.color==="w";
                // Hide the piece being dragged from its origin square
                const isBeingDragged=dragRef.current?.from===sq;
                let bg=isLight?t.l:t.d;
                if(isSel) bg=t.sel;else if(isLF||isLT) bg=t.last;
                if(isChk) bg="rgba(220,60,40,.72)";
                const isJustMoved=isLT;
                return(
                  <div key={ci} onClick={()=>onSq(sq)}
                    className="board-sq"
                    style={{width:sz,height:sz,background:bg,cursor:piece&&piece.color===pCol?"grab":"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      position:"relative",transition:"background .08s",
                      outline:isSel?"2.5px solid rgba(255,255,0,.95)":isHint?"2.5px solid rgba(80,200,80,.95)":"none",
                      outlineOffset:"-2.5px",boxSizing:"border-box",
                      animation:isJustMoved?"sqFlash .45s ease-out":"none",
                    }}>
                    {isLeg&&!piece&&<div style={{width:Math.round(sz*.34),height:Math.round(sz*.34),borderRadius:"50%",background:t.hint,pointerEvents:"none",animation:"hintAppear .18s ease-out"}}/>}
                    {isLeg&&piece&&<div style={{position:"absolute",inset:0,boxShadow:`inset 0 0 0 4px ${t.hint}`,pointerEvents:"none",borderRadius:2}}/>}
                    {piece&&<span
                      className="chess-piece"
                      onMouseDown={onPieceDragStart?(e)=>{e.stopPropagation();onPieceDragStart(e,sq);}:undefined}
                      onTouchStart={onPieceDragStart?(e)=>{e.stopPropagation();onPieceDragStart(e,sq);}:undefined}
                      style={{
                        fontSize:Math.round(sz*.82),lineHeight:1,userSelect:"none",
                        color:isW?"#fff":"#0A0808",
                        textShadow:isW?"0 0 6px #000,0 2px 8px rgba(0,0,0,.95),0 0 2px #222":"0 0 3px rgba(255,255,255,.25),0 1px 5px rgba(0,0,0,.5)",
                        position:"relative",zIndex:1,
                        opacity:isBeingDragged?0:1,
                        cursor:piece.color===pCol?"grab":"default",
                        transition:"opacity .05s",
                        WebkitUserSelect:"none",
                        touchAction:"none",
                      }}>{UNI[pk]}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
        {showCoords&&(
          <div style={{display:"flex",background:"#12100E"}}>
            {showCoords&&<div style={{width:18}}/>}
            {Array.from({length:8},(_,i)=>(
              <div key={i} style={{width:sz,textAlign:"center",fontSize:9,color:"#666",padding:"3px 0",fontFamily:"monospace",fontWeight:700}}>
                {String.fromCharCode(97+(fl?7-i:i))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  TUTOR CHAT
  // ════════════════════════════════════════════════════════════════
  function TutorChat({height=260,placeholder="Ask your chess tutor…"}){
    const quickP=screen==="learn"?[`Explain "${curLesson?.title}"`,`Any tips for this?`,"What's the idea here?"]
                :screen==="puzzles"?["Give me a hint","What tactic is this?","Explain the solution"]
                :["Best move?","What's my plan?","Evaluate the position"];
    return(
      <div style={{display:"flex",flexDirection:"column",height}}>
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,paddingRight:4,paddingBottom:4}}>
          {msgs.length===0&&<p style={{fontSize:13,color:"var(--color-text-secondary)",fontStyle:"italic",margin:0}}>Ask anything about chess or the current position!</p>}
          {msgs.map((m,i)=>(
            <div key={i} className={m.role==="user"?"msg-in-right":"msg-in-left"} style={{maxWidth:"90%",alignSelf:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{fontSize:13,lineHeight:1.6,padding:"8px 12px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",background:m.role==="user"?"#4A43A0":"var(--color-background-secondary)",color:m.role==="user"?"#fff":"var(--color-text-primary)",boxShadow:"0 1px 3px rgba(0,0,0,.12)"}}>
                {m.content}
              </div>
            </div>
          ))}
          {tutBusy&&<div style={{alignSelf:"flex-start",fontSize:13,color:"var(--color-text-secondary)",fontStyle:"italic",padding:"6px 12px",background:"var(--color-background-secondary)",borderRadius:12}}>Thinking…</div>}
          <div ref={tutEndRef}/>
        </div>
        <div style={{borderTop:"0.5px solid var(--color-border-tertiary)",paddingTop:10}}>
          <div style={{display:"flex",gap:6}}>
            <input value={tutIn} onChange={e=>setTutIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!tutBusy&&sendMsg()} placeholder={placeholder} style={{flex:1,fontSize:13,padding:"8px 12px",borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",outline:"none"}}/>
            <button onClick={sendMsg} disabled={tutBusy||!tutIn.trim()} style={{padding:"8px 14px",background:"#4A43A0",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",fontSize:13,cursor:"pointer",opacity:tutBusy||!tutIn.trim()?0.5:1}}>↑</button>
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>
            {quickP.map(q=><button key={q} onClick={()=>setTutIn(q)} style={{fontSize:11,padding:"4px 9px",background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:20,cursor:"pointer",color:"var(--color-text-secondary)"}}>{q}</button>)}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  PROMOTION DIALOG
  // ════════════════════════════════════════════════════════════════
  function PromoDlg(){
    if(!promoDialog) return null;
    const pieces=[["q","Queen"],["r","Rook"],["b","Bishop"],["n","Knight"]];
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
        <div style={{background:"var(--color-background-primary)",borderRadius:"var(--border-radius-lg)",padding:"1.5rem",boxShadow:"0 20px 60px rgba(0,0,0,.6)",border:"0.5px solid var(--color-border-secondary)"}}>
          <div style={{fontSize:15,fontWeight:600,color:"var(--color-text-primary)",marginBottom:16,textAlign:"center"}}>Promote Pawn</div>
          <div style={{display:"flex",gap:12}}>
            {pieces.map(([pt,label])=>(
              <div key={pt} onClick={()=>doPromotion(pt)}
                style={{width:68,height:68,border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:4,transition:"background .15s,transform .15s"}}
                onMouseEnter={e=>{e.currentTarget.style.background="var(--color-background-secondary)";e.currentTarget.style.transform="scale(1.08)";}}
                onMouseLeave={e=>{e.currentTarget.style.background="";e.currentTarget.style.transform="";}}>
                <span style={{fontSize:34,color:pCol==="w"?"#fff":"#111",textShadow:pCol==="w"?"0 0 4px #000,0 1px 5px rgba(0,0,0,.9)":"none"}}>{UNI[`${pCol}${pt.toUpperCase()}`]}</span>
                <span style={{fontSize:10,color:"var(--color-text-secondary)"}}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  CAPTURED PIECES
  // ════════════════════════════════════════════════════════════════
  function Captured({history,forColor}){
    const map={};
    history.filter(m=>m.color!==forColor&&m.captured).forEach(m=>{
      const k=`${forColor}${m.captured.toUpperCase()}`;map[k]=(map[k]||0)+1;
    });
    const sorted=Object.entries(map).sort((a,b)=>PV[b[0][1].toLowerCase()]-PV[a[0][1].toLowerCase()]);
    const mat=sorted.reduce((s,[k,n])=>s+PV[k[1].toLowerCase()]*n,0);
    const opp=history.filter(m=>m.color===forColor&&m.captured).reduce((s,m)=>s+PV[m.captured],0);
    const adv=mat-opp;
    return(
      <div style={{display:"flex",alignItems:"center",gap:6,minHeight:22}}>
        <span style={{fontSize:15,letterSpacing:1}}>{sorted.map(([k,n])=>Array(n).fill(UNI[k]).join("")).join("")}</span>
        {adv>0&&<span style={{fontSize:11,color:"var(--color-text-secondary)",fontWeight:600}}>+{adv}</span>}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  TOGGLE
  // ════════════════════════════════════════════════════════════════
  function Toggle({val,onChange}){
    return(
      <div onClick={()=>onChange(!val)} style={{width:40,height:22,borderRadius:11,background:val?"#4A43A0":"var(--color-border-secondary)",cursor:"pointer",transition:"background .2s",position:"relative",flexShrink:0}}>
        <div style={{position:"absolute",top:2,left:val?20:2,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)"}}/>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  SHARE MODAL
  // ════════════════════════════════════════════════════════════════
  function ShareModal(){
    const [copied,setCopied]=useState(false);
    const text=generateShareText();
    const acc=computeAccuracy(moveQualities);
    const iWon=winner===(pCol==="w"?"White":"Black");
    const accColor=acc==null?"var(--color-text-secondary)":acc>=85?"#5CB88A":acc>=65?"#F5C842":"#E85555";

    async function copy(){
      try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2200);}
      catch{/* fallback: select all text */}
    }

    return(
      <div onClick={()=>setShareModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:"0 1rem"}}>
        <div onClick={e=>e.stopPropagation()} style={{background:"var(--color-background-primary)",borderRadius:"var(--border-radius-lg)",padding:"1.5rem",width:"100%",maxWidth:360,boxShadow:"0 24px 64px rgba(0,0,0,.65)",border:"0.5px solid var(--color-border-secondary)"}}>
          {/* Header */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <span style={{fontSize:16,fontWeight:600,color:"var(--color-text-primary)"}}>♟ Share Result</span>
            <button onClick={()=>setShareModal(false)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"var(--color-text-tertiary)",lineHeight:1}}>×</button>
          </div>

          {/* Result highlight */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,padding:"12px 14px",borderRadius:"var(--border-radius-md)",background:iWon?"rgba(92,184,138,.1)":"rgba(232,85,85,.08)",border:`0.5px solid ${iWon?"#5CB88A55":"#E8555540"}`}}>
            <span style={{fontSize:30}}>{gStatus==="checkmate"?(iWon?"🏆":"💀"):gStatus==="resign"?"🏳":gStatus==="timeout"?"⏰":"🤝"}</span>
            <div>
              <div style={{fontSize:15,fontWeight:600,color:"var(--color-text-primary)"}}>
                {gStatus==="checkmate"?`${winner} wins!`:gStatus==="stalemate"?"Stalemate":gStatus==="resign"?"Resigned":gStatus==="timeout"?"Time out":"Draw"}
              </div>
              <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>vs {DIFFS[diff].label} · {hist.length} moves{opening?" · "+opening:""}</div>
            </div>
            {acc!=null&&<div style={{marginLeft:"auto",textAlign:"center"}}>
              <div style={{fontSize:22,fontWeight:600,color:accColor}}>{acc}</div>
              <div style={{fontSize:10,color:"var(--color-text-tertiary)"}}>accuracy</div>
            </div>}
          </div>

          {/* Move quality row */}
          {moveQualities.length>0&&(
            <div style={{display:"flex",gap:6,marginBottom:16,justifyContent:"center"}}>
              {[
                {sym:"!",   label:"Best/Good",  color:"#5CB88A", count:moveQualities.filter(m=>m.label==="Best"||m.label==="Good").length},
                {sym:"?",   label:"Inaccuracy", color:"#F5C842", count:moveQualities.filter(m=>m.label==="Inaccuracy").length},
                {sym:"??",  label:"Mistake",    color:"#F08C4A", count:moveQualities.filter(m=>m.label==="Mistake").length},
                {sym:"???", label:"Blunder",    color:"#E85555", count:moveQualities.filter(m=>m.label==="Blunder").length},
              ].map(s=>(
                <div key={s.sym} title={s.label} style={{flex:1,textAlign:"center",padding:"8px 4px",borderRadius:"var(--border-radius-md)",background:`${s.color}14`,border:`0.5px solid ${s.color}44`}}>
                  <div style={{fontSize:13,fontWeight:700,color:s.color}}>{s.sym}</div>
                  <div style={{fontSize:15,fontWeight:600,color:s.color}}>{s.count}</div>
                </div>
              ))}
            </div>
          )}

          {/* Text preview */}
          <div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"10px 12px",marginBottom:14,fontFamily:"monospace",fontSize:12,lineHeight:1.9,whiteSpace:"pre-wrap",color:"var(--color-text-secondary)",border:"0.5px solid var(--color-border-tertiary)"}}>
            {text}
          </div>

          {/* Copy button */}
          <button onClick={copy} style={{width:"100%",padding:"11px",background:copied?"#5CB88A":"#4A43A0",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",fontSize:14,fontWeight:600,cursor:"pointer",transition:"background .25s"}}>
            {copied?"✓ Copied to clipboard!":"📋 Copy to clipboard"}
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  GHOST PIECE (floating piece that follows cursor during drag)
  // ════════════════════════════════════════════════════════════════
  function GhostPiece(){
    if(!ghostState) return null;
    const {x,y,pk,isW}=ghostState;
    return(
      <div style={{
        position:"fixed",
        left:x-SQ*0.6,
        top:y-SQ*0.6,
        width:SQ*1.2,
        height:SQ*1.2,
        fontSize:Math.round(SQ*1.0),
        display:"flex",alignItems:"center",justifyContent:"center",
        pointerEvents:"none",
        zIndex:9999,
        opacity:0.92,
        color:isW?"#fff":"#0A0808",
        textShadow:isW?"0 0 8px #000,0 2px 10px rgba(0,0,0,.95)":"0 0 3px rgba(255,255,255,.3)",
        transform:"scale(1.12)",
        userSelect:"none",
        WebkitUserSelect:"none",
        filter:"drop-shadow(0 6px 14px rgba(0,0,0,.55))",
      }}>
        {UNI[pk]}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  BOTTOM NAV BAR
  // ════════════════════════════════════════════════════════════════
  const NAV_ITEMS = [
    { id:"menu",       icon:"⌂",  label:"Home"    },
    { id:"play_setup", icon:"⚔",  label:"Play"    },
    { id:"learn",      icon:"🎓", label:"Learn"   },
    { id:"puzzles",    icon:"🧩", label:"Puzzles" },
    { id:"profile",    icon:"👤", label:"Profile" },
  ];
  const NAV_ACTIVE_MAP = {
    menu:"menu", settings:"menu",
    play_setup:"play_setup", play:"play_setup",
    learn:"learn",
    puzzles:"puzzles",
    profile:"profile",
  };
  const NAV_SCREENS = new Set(["menu","play_setup","play","learn","puzzles","profile","settings"]);

  function BottomNav(){
    if(!NAV_SCREENS.has(screen)) return null;
    if(screen==="play") return null;
    const active = NAV_ACTIVE_MAP[screen] ?? "menu";
    function go(id){
      if(id==="menu")         setScreen("menu");
      else if(id==="play_setup"){ setGameMode("ai"); setScreen("play_setup"); }
      else if(id==="learn")   setScreen("learn");
      else if(id==="puzzles"){ if(!pz) randomPuzzle(); setScreen("puzzles"); }
      else if(id==="profile") setScreen("profile");
    }
    return(
      <nav style={{
        position:"fixed",bottom:0,left:0,right:0,
        height:62,zIndex:200,
        background:"var(--color-background-primary)",
        borderTop:"0.5px solid var(--color-border-tertiary)",
        boxShadow:"0 -4px 24px rgba(0,0,0,.09)",
        display:"flex",alignItems:"stretch",
      }}>
        <div style={{maxWidth:860,margin:"0 auto",width:"100%",display:"flex",padding:"0 4px"}}>
          {NAV_ITEMS.map(item=>{
            const isActive = active===item.id;
            return(
              <button key={item.id} onClick={()=>go(item.id)}
                style={{
                  flex:1,border:"none",background:"none",
                  display:"flex",flexDirection:"column",
                  alignItems:"center",justifyContent:"center",
                  gap:3,cursor:"pointer",padding:"6px 4px",
                  color:isActive?"#4A43A0":"var(--color-text-tertiary)",
                  transition:"color .15s",position:"relative",outline:"none",
                }}
                onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.color="var(--color-text-secondary)"; }}
                onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.color="var(--color-text-tertiary)"; }}
              >
                {isActive&&<span style={{
                  position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",
                  width:28,height:3,borderRadius:"0 0 4px 4px",background:"#4A43A0",
                }}/>}
                {isActive&&<span style={{
                  position:"absolute",width:44,height:32,borderRadius:10,
                  background:"rgba(74,67,160,.1)",
                  top:"50%",left:"50%",transform:"translate(-50%,-58%)",
                  pointerEvents:"none",
                }}/>}
                <span style={{
                  fontSize:20,lineHeight:1,position:"relative",
                  transform:isActive?"translateY(-1px) scale(1.08)":"none",
                  transition:"transform .15s",
                }}>{item.icon}</span>
                <span style={{
                  fontSize:10,fontWeight:isActive?600:400,
                  letterSpacing:0.2,position:"relative",
                }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // ════════════════════════════════════════════════════════════════
  if(!loaded) return(
    <div style={{minHeight:500,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,fontFamily:"var(--font-sans)"}}>
      <style>{`@keyframes bob{0%,100%{transform:scale(1) rotate(-5deg)}50%{transform:scale(1.1) rotate(5deg)}}`}</style>
      {loadErr?<><span style={{fontSize:40}}>⚠️</span><p style={{color:"var(--color-text-secondary)",fontSize:14}}>Could not load chess engine — check connection and reload.</p></>
      :<><span style={{fontSize:56,animation:"bob 2s ease-in-out infinite",display:"inline-block"}}>♟</span><p style={{color:"var(--color-text-secondary)",fontSize:14}}>Loading Chess Academy…</p></>}
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  //  MENU
  // ════════════════════════════════════════════════════════════════
  if(screen==="menu"){
    const totalL=LESSONS.length;
    const pct=Math.round((doneLessons.size/totalL)*100);
    return(
      <>
      <div style={{padding:"1rem 0 5.5rem",fontFamily:"var(--font-sans)"}} className="screen-enter">
        <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
        {/* Profile button top-right */}
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
          <button onClick={()=>setScreen("profile")}
            style={{display:"flex",alignItems:"center",gap:6,fontSize:12,padding:"6px 12px",background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",color:"var(--color-text-secondary)",transition:"border-color .15s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor="#4A43A0"}
            onMouseLeave={e=>e.currentTarget.style.borderColor=""}>
            <span>👤</span>
            <span>{user ? (user.user_metadata?.username ?? user.email?.split("@")[0]) : "Guest"}</span>
          </button>
        </div>
        <div style={{textAlign:"center",marginBottom:"1.75rem"}}>
          <div style={{fontSize:62,lineHeight:1,marginBottom:10,animation:"float 3s ease-in-out infinite",display:"inline-block"}}>♟</div>
          <div style={{fontSize:27,fontWeight:600,color:"var(--color-text-primary)",marginBottom:6,letterSpacing:-.5}}>Chess Academy</div>
          <div style={{fontSize:14,color:"var(--color-text-secondary)"}}>Play, learn, and master the game of kings</div>
        </div>
        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
          {[{label:"Rating",val:elo,icon:"📈",c:"#534AB7"},{label:"Wins",val:stats.w,icon:"🏆",c:"#5CB88A"},{label:"Losses",val:stats.l,icon:"💀",c:"#E85555"},{label:"Streak",val:`${streak}🔥`,icon:"🧩",c:"#F08C4A"}].map(s=>(
            <div key={s.label} style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"10px 8px",textAlign:"center"}}>
              <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:4}}>{s.icon} {s.label}</div>
              <div style={{fontSize:20,fontWeight:600,color:s.c}}>{s.val}</div>
            </div>
          ))}
        </div>
        {/* Mode cards */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          {[{id:"play_setup",emoji:"⚔️",title:"vs AI",desc:"Challenge the AI at 5 difficulty levels",accent:"#4A43A0",sub:`${DIFFS[diff].label} · ${elo} Elo`},
            {id:"learn",emoji:"🎓",title:"Learn",desc:`${totalL} interactive lessons + AI tutor`,accent:"#0F6E56",sub:`${pct}% complete`}].map(m=>(
            <div key={m.id} onClick={()=>setScreen(m.id)}
              style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1.25rem",cursor:"pointer",transition:"border-color .18s,transform .2s,box-shadow .2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=m.accent;e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,.15)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="";e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}>
              <div style={{fontSize:32,marginBottom:10}}>{m.emoji}</div>
              <div style={{fontSize:17,fontWeight:600,color:"var(--color-text-primary)",marginBottom:4}}>{m.title}</div>
              <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:8}}>{m.desc}</div>
              <div style={{fontSize:11,padding:"3px 8px",background:"var(--color-background-secondary)",borderRadius:20,display:"inline-block",color:"var(--color-text-secondary)"}}>{m.sub}</div>
            </div>
          ))}
        </div>
        {/* Pass-and-play card */}
        <div onClick={()=>{setGameMode("p2p");setScreen("play_setup");}}
          style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem",cursor:"pointer",transition:"border-color .18s,transform .2s",display:"flex",alignItems:"center",gap:14,marginBottom:10}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="#E67E22";e.currentTarget.style.transform="translateY(-2px)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="";e.currentTarget.style.transform="";}}>
          <span style={{fontSize:32}}>👥</span>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:600,color:"var(--color-text-primary)",marginBottom:3}}>Pass & Play</div>
            <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>2 players on one device · auto-flip board each turn</div>
          </div>
          <span style={{fontSize:12,padding:"3px 9px",background:"rgba(230,126,34,.1)",color:"#E67E22",borderRadius:20,fontWeight:500}}>Local</span>
        </div>
        <div onClick={()=>{randomPuzzle();setScreen("puzzles");}}
          style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem",cursor:"pointer",transition:"border-color .18s,transform .2s",display:"flex",alignItems:"center",gap:14,marginBottom:10}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="#C04A90";e.currentTarget.style.transform="translateY(-2px)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="";e.currentTarget.style.transform="";}}>
          <span style={{fontSize:32}}>🧩</span>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:600,color:"var(--color-text-primary)",marginBottom:3}}>Puzzle Trainer</div>
            <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>{PUZZLES.length} tactical puzzles · Mate, Fork, Pin, Skewer & more</div>
          </div>
          <div style={{fontSize:13,color:"var(--color-text-secondary)"}}>{solvedPz.size}/{PUZZLES.length} solved</div>
        </div>
        {/* Theme + settings */}
        <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:500,color:"var(--color-text-primary)"}}>Board Theme</div>
            <button onClick={()=>setScreen("settings")} style={{fontSize:12,padding:"4px 10px",background:"none",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",color:"var(--color-text-secondary)"}}>⚙ Settings</button>
          </div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            {Object.entries(THEMES).map(([k,t])=>(
              <div key={k} onClick={()=>setTheme(k)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",width:34,height:34,borderRadius:6,overflow:"hidden",outline:theme===k?"3px solid #4A43A0":"2px solid transparent",outlineOffset:2,transition:"outline .15s, transform .15s",transform:theme===k?"scale(1.1)":"scale(1)"}}>
                  {[t.l,t.d,t.d,t.l].map((c,i)=><div key={i} style={{background:c}}/>)}
                </div>
                <span style={{fontSize:11,fontWeight:theme===k?600:400,color:theme===k?"#4A43A0":"var(--color-text-secondary)"}}>{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav/>
      </>
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  PROFILE
  // ════════════════════════════════════════════════════════════════
  if(screen==="profile") return(
    <>
      <ProfileScreen
        user={user}
        stats={stats}
        doneLessons={doneLessons}
        solvedPz={solvedPz}
        streak={streak}
        onBack={()=>setScreen("menu")}
        onSignOut={onSignOut}
      />
      <BottomNav/>
    </>
  );

  // ════════════════════════════════════════════════════════════════
  //  SETTINGS
  // ════════════════════════════════════════════════════════════════
  if(screen==="settings") return(
    <>
    <div style={{padding:"1rem 0 5.5rem",fontFamily:"var(--font-sans)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"1.5rem"}}>
        <button onClick={()=>setScreen("menu")} style={{fontSize:12,padding:"5px 11px",background:"none",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",color:"var(--color-text-secondary)"}}>← Back</button>
        <span style={{fontSize:19,fontWeight:600,color:"var(--color-text-primary)"}}>Settings</span>
      </div>
      {[{label:"Sound Effects",sub:"Move, capture, check sounds",val:soundOn,set:setSoundOn},{label:"Show Coordinates",sub:"File and rank labels on the board",val:showCoords,set:setShowCoords}].map(s=>(
        <div key={s.label} style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"12px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:"var(--color-text-primary)"}}>{s.label}</div><div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:2}}>{s.sub}</div></div>
          <Toggle val={s.val} onChange={s.set}/>
        </div>
      ))}
      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"12px 16px",marginBottom:8}}>
        <div style={{fontSize:14,fontWeight:500,color:"var(--color-text-primary)",marginBottom:8}}>Animation Speed</div>
        <div style={{display:"flex",gap:8}}>
          {["fast","normal","slow"].map(s=>(
            <button key={s} onClick={()=>setAnimSpd(s)} style={{flex:1,padding:"7px",fontSize:13,background:animSpd===s?"#4A43A0":"var(--color-background-secondary)",color:animSpd===s?"#fff":"var(--color-text-secondary)",border:"none",borderRadius:"var(--border-radius-md)",cursor:"pointer",textTransform:"capitalize"}}>{s}</button>
          ))}
        </div>
      </div>
      <button onClick={async()=>{setDoneLessons(new Set());setStats({w:0,l:0,d:0});setSolvedPz(new Set());setStreak(0);try{await window.storage?.set("chess_v2","{}");}catch{}}}
        style={{width:"100%",padding:10,background:"none",color:"#E85555",border:"1px solid #E85555",borderRadius:"var(--border-radius-md)",fontSize:14,cursor:"pointer",marginTop:8}}>
        Reset All Progress
      </button>
    </div>
    <BottomNav/>
    </>
  );

  // ════════════════════════════════════════════════════════════════
  //  PLAY SETUP
  // ════════════════════════════════════════════════════════════════
  if(screen==="play_setup") return(
    <>
    <div style={{padding:"1rem 0 5.5rem",fontFamily:"var(--font-sans)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"1.5rem"}}>
        <button onClick={()=>{setGameMode("ai");setScreen("menu");}} style={{fontSize:12,padding:"5px 11px",background:"none",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",color:"var(--color-text-secondary)"}}>← Back</button>
        <span style={{fontSize:19,fontWeight:600,color:"var(--color-text-primary)"}}>{gameMode==="p2p"?"👥 Pass & Play Setup":"⚔️ Game Setup"}</span>
      </div>

      {/* ── Mode tabs ── */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["ai","vs AI"],["p2p","Pass & Play"]].map(([m,label])=>(
          <button key={m} onClick={()=>setGameMode(m)} style={{flex:1,padding:"10px",fontSize:14,fontWeight:600,borderRadius:"var(--border-radius-md)",border:gameMode===m?"2px solid #4A43A0":"0.5px solid var(--color-border-tertiary)",background:gameMode===m?"rgba(74,67,160,.08)":"none",color:gameMode===m?"#4A43A0":"var(--color-text-secondary)",cursor:"pointer",transition:"all .15s"}}>
            {label}
          </button>
        ))}
      </div>

      {/* ── AI-mode only: difficulty + color ── */}
      {gameMode==="ai"&&<>
        <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>Difficulty</div>
          {DIFFS.map((d,i)=>(
            <div key={i} onClick={()=>setDiff(i)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:"var(--border-radius-md)",background:diff===i?"var(--color-background-secondary)":"transparent",border:diff===i?`1.5px solid ${d.color}`:"0.5px solid transparent",cursor:"pointer",transition:"all .15s",marginBottom:i<4?4:0}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:d.color,flexShrink:0}}/>
              <span style={{fontSize:14,fontWeight:diff===i?600:400,color:"var(--color-text-primary)",flex:1}}>{d.label}</span>
              <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{d.desc}</span>
              <span style={{fontSize:11,color:d.color,fontWeight:600}}>{DIFF_ELO[i]}</span>
              {diff===i&&<span style={{color:"var(--color-text-success)",fontSize:14}}>✓</span>}
            </div>
          ))}
        </div>
        <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>Play As</div>
          <div style={{display:"flex",gap:10}}>
            {[["w","♙","White","Move first"],["b","♟","Black","AI moves first"]].map(([col,ico,label,sub])=>(
              <div key={col} onClick={()=>setPCol(col)} style={{flex:1,padding:"14px 12px",border:pCol===col?"2px solid #4A43A0":"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",textAlign:"center",transition:"border .15s",background:pCol===col?"rgba(74,67,160,.06)":"transparent"}}>
                <div style={{fontSize:30,marginBottom:7}}>{ico}</div>
                <div style={{fontSize:14,fontWeight:600,color:"var(--color-text-primary)",marginBottom:3}}>{label}</div>
                <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </>}

      {/* ── P2P-mode only: player names + auto-flip ── */}
      {gameMode==="p2p"&&<>
        <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.06em"}}>Player Names</div>
          {[["w","♙ White (moves first)"],["b","♟ Black"]].map(([col,label])=>(
            <div key={col} style={{marginBottom:10}}>
              <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:5}}>{label}</div>
              <input value={p2pNames[col]} onChange={e=>setP2pNames(n=>({...n,[col]:e.target.value}))}
                placeholder={col==="w"?"Player 1":"Player 2"}
                style={{width:"100%",fontSize:14,padding:"9px 12px",borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-secondary)",color:"var(--color-text-primary)",outline:"none",boxSizing:"border-box"}}/>
            </div>
          ))}
        </div>
        <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:500,color:"var(--color-text-primary)"}}>Auto-flip board</div>
            <div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:2}}>Flip the board after each move so the active player faces their pieces</div>
          </div>
          <Toggle val={p2pFlipOnTurn} onChange={setP2pFlipOnTurn}/>
        </div>
      </>}

      {/* ── Shared: time control ── */}
      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Time Control</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:13,color:"var(--color-text-secondary)"}}>{useTimer?"On":"Off"}</span>
            <Toggle val={useTimer} onChange={setUseTimer}/>
          </div>
        </div>
        {useTimer&&(
          <div style={{display:"flex",gap:8}}>
            {[[180,"3 min"],[300,"5 min"],[600,"10 min"],[900,"15 min"]].map(([s,label])=>(
              <button key={s} onClick={()=>setTimeCtrl(s)} style={{flex:1,padding:"8px 4px",fontSize:13,background:timeCtrl===s?"#4A43A0":"var(--color-background-secondary)",color:timeCtrl===s?"#fff":"var(--color-text-secondary)",border:"none",borderRadius:"var(--border-radius-md)",cursor:"pointer"}}>{label}</button>
            ))}
          </div>
        )}
      </div>
      <button onClick={startGame} style={{width:"100%",padding:13,background:gameMode==="p2p"?"#E67E22":"#4A43A0",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",fontSize:16,fontWeight:600,cursor:"pointer",transition:"opacity .15s"}}
        onMouseEnter={e=>e.currentTarget.style.opacity=".88"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
        {gameMode==="p2p"?"Start Pass & Play →":"Start Game →"}
      </button>
    </div>
    <BottomNav/>
    </>
  );

  // ════════════════════════════════════════════════════════════════
  //  PLAY
  // ════════════════════════════════════════════════════════════════
  if(screen==="play"){
    const g=gRef.current;
    const movePairs=[];
    for(let i=0;i<hist.length;i+=2) movePairs.push({n:Math.floor(i/2)+1,w:hist[i]?.san,b:hist[i+1]?.san});
    const isMyTurn=g?.turn()===pCol;
    const gameOver=gStatus!=="playing"&&gStatus!=="idle";
    const iWon=winner===(pCol==="w"?"White":"Black");
    const chkSq=inChk&&g?(()=>{let k=null;g.board().forEach((row,r)=>row.forEach((p,c)=>{if(p?.type==="k"&&p.color===g.turn()) k=`${String.fromCharCode(97+c)}${8-r}`;}));return k;})():null;

    return(
      <div style={{padding:"0.5rem 0 1rem",fontFamily:"var(--font-sans)"}}>
        <PromoDlg/>
        {/* Top bar */}
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,flexWrap:"wrap"}}>
          <button onClick={()=>{setScreen("menu");setGameMode("ai");}} style={{fontSize:12,padding:"5px 10px",background:"none",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",color:"var(--color-text-secondary)"}}>← Menu</button>
          <div style={{display:"flex",alignItems:"center",gap:5,flex:1}}>
            {gameMode==="p2p"
              ?<span style={{fontSize:12,color:"#E67E22",fontWeight:600}}>👥 Pass & Play</span>
              :<><div style={{width:8,height:8,borderRadius:"50%",background:DIFFS[diff].color,flexShrink:0}}/>
                <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{DIFFS[diff].label}</span></>
            }
            {opening&&<span style={{fontSize:11,color:"var(--color-text-tertiary)",borderLeft:"0.5px solid var(--color-border-tertiary)",paddingLeft:6}}>{opening}</span>}
          </div>
          {gameMode==="p2p"&&gStatus==="playing"&&(
            <span style={{fontSize:12,fontWeight:600,color:g?.turn()==="w"?"var(--color-text-primary)":"var(--color-text-secondary)",padding:"3px 10px",background:"var(--color-background-secondary)",borderRadius:20}}>
              {g?.turn()==="w"?`♙ ${p2pNames.w}`:`♟ ${p2pNames.b}`}'s turn
            </span>
          )}
          {gameMode==="ai"&&aiThink&&<span style={{fontSize:12,color:"var(--color-text-secondary)",fontStyle:"italic"}}>AI thinking…</span>}
          {inChk&&gStatus==="playing"&&<span style={{fontSize:12,color:"#E85555",fontWeight:700}}>⚠ Check!</span>}
          <button onClick={()=>setFlipped(f=>!f)} title="Flip board" style={{fontSize:12,padding:"5px 9px",background:"none",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",color:"var(--color-text-secondary)"}}>⟳</button>
        </div>
        {/* Game over */}
        {gameOver&&(()=>{
          const eloChange=gameMode==="ai"?(()=>{
            const r=gStatus==="checkmate"?(iWon?1:0):gStatus==="resign"?0:0.5;
            return calcNewElo(elo,DIFF_ELO[diff],r)-elo;
          })():null;
          const winnerName=gameMode==="p2p"?
            (winner==="White"?p2pNames.w:p2pNames.b):winner;
          return(
          <div style={{marginBottom:12,padding:"12px 16px",borderRadius:"var(--border-radius-md)",background:gStatus==="checkmate"||gStatus==="timeout"?(iWon||gameMode==="p2p"?"rgba(92,184,138,.12)":"rgba(232,85,85,.12)"):"var(--color-background-secondary)",border:`0.5px solid ${gStatus==="checkmate"||gStatus==="timeout"?(iWon||gameMode==="p2p"?"#5CB88A":"#E85555"):"var(--color-border-tertiary)"}`,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:26}}>{gStatus==="checkmate"?"🏆":gStatus==="resign"?"🏳":gStatus==="timeout"?"⏰":"🤝"}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:600,color:"var(--color-text-primary)"}}>
                {gStatus==="checkmate"?`${winnerName} wins by checkmate!`
                :gStatus==="stalemate"?"Stalemate — draw!"
                :gStatus==="timeout"?`${winnerName} wins on time!`
                :gStatus==="resign"?`${winnerName} wins — opponent resigned`
                :"Draw!"}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginTop:2,flexWrap:"wrap"}}>
                <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{hist.length} moves</span>
                {computeAccuracy(moveQualities)!=null&&(()=>{
                  const acc=computeAccuracy(moveQualities);
                  const c=acc>=85?"#5CB88A":acc>=65?"#F5C842":"#E85555";
                  return <span style={{fontSize:12,fontWeight:600,color:c}}>Accuracy: {acc}/100</span>;
                })()}
                {eloChange!=null&&<span style={{fontSize:12,fontWeight:600,color:eloChange>=0?"#5CB88A":"#E85555"}}>
                  {eloChange>=0?`+${eloChange}`:`${eloChange}`} Elo → {elo+(eloChange||0)}
                </span>}
              </div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {gameMode==="ai"&&<button onClick={()=>setShareModal(true)} style={{padding:"7px 12px",background:"none",color:"var(--color-text-secondary)",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",fontSize:13,cursor:"pointer"}}>📤 Share</button>}
              <button onClick={startGame} style={{padding:"7px 16px",background:gameMode==="p2p"?"#E67E22":"#4A43A0",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",fontSize:13,fontWeight:500,cursor:"pointer"}}>Rematch</button>
            </div>
          </div>
          );
        })()}
        {shareModal&&<ShareModal/>}
        {/* Move quality summary — shown after game ends */}
        {gameOver && moveQualities.length>0 &&(
          <div style={{marginBottom:12,padding:"10px 14px",borderRadius:"var(--border-radius-md)",background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)"}}>
            <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:8,fontWeight:500}}>Your move quality</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[
                {label:"Best/Good", sym:"✓",  color:"#5CB88A", count: moveQualities.filter(m=>m.label==="Best"||m.label==="Good").length},
                {label:"Inaccuracy",sym:"?",   color:"#F5C842", count: moveQualities.filter(m=>m.label==="Inaccuracy").length},
                {label:"Mistake",   sym:"??",  color:"#F08C4A", count: moveQualities.filter(m=>m.label==="Mistake").length},
                {label:"Blunder",   sym:"???", color:"#E85555", count: moveQualities.filter(m=>m.label==="Blunder").length},
              ].map(s=>(
                <div key={s.label} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,background:`${s.color}18`,border:`0.5px solid ${s.color}55`}}>
                  <span style={{fontSize:12,fontWeight:700,color:s.color}}>{s.sym}</span>
                  <span style={{fontSize:12,color:s.color,fontWeight:500}}>{s.count} {s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
          {/* Board col */}
          <div style={{flexShrink:0}}>
            {/* Opponent / top player label */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5,minHeight:26}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14}}>{pCol==="w"?"♟":"♙"}</span>
                <span style={{fontSize:13,color:"var(--color-text-secondary)",fontWeight:500}}>
                  {gameMode==="p2p"?(flipped?p2pNames.w:p2pNames.b):`AI — ${DIFFS[diff].label}`}
                </span>
                <Captured history={hist} forColor={pCol==="w"?"b":"w"}/>
              </div>
              {useTimer&&<div style={{fontSize:14,fontFamily:"monospace",fontWeight:700,color:!isMyTurn?"var(--color-text-primary)":"var(--color-text-tertiary)",background:!isMyTurn&&gStatus==="playing"?"rgba(74,67,160,.12)":"transparent",padding:"3px 8px",borderRadius:"var(--border-radius-md)"}}>{fmtTime(pCol==="w"?timeB:timeW)}</div>}
            </div>
            {/* Eval + board with floating badge overlay */}
            <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
              <div style={{width:8,height:SQ*8+(showCoords?22:0),background:"var(--color-border-tertiary)",borderRadius:4,overflow:"hidden",flexShrink:0,display:"flex",flexDirection:"column-reverse"}}>
                <div style={{height:`${evalBar}%`,background:"#fff",transition:"height .7s ease",borderRadius:4}}/>
              </div>
              <div style={{position:"relative"}} ref={playBoardRef}>
                <Board brd={board} onSq={handleSqClick} selSq={sel} legalSqs={legal} lastMove={lastMv} chkSq={chkSq} hintSq2={hintSq} showGlow={true} myTurn={isMyTurn} onPieceDragStart={startDrag}/>
                {lastBadge&&(
                  <div style={{position:"absolute",top:-14,right:-10,zIndex:10,
                    background:lastBadge.bg,
                    border:`1.5px solid ${lastBadge.color}`,
                    borderRadius:20,padding:"4px 11px",
                    display:"flex",alignItems:"center",gap:5,
                    animation:"badgePop .35s cubic-bezier(.34,1.56,.64,1) forwards",
                    boxShadow:"0 4px 14px rgba(0,0,0,.28)"}}>
                    <span style={{fontSize:13,fontWeight:700,color:lastBadge.color,letterSpacing:"-.5px"}}>{lastBadge.sym}</span>
                    <span style={{fontSize:12,fontWeight:600,color:lastBadge.color}}>{lastBadge.label}</span>
                  </div>
                )}
              </div>
            </div>
            {/* Bottom player label */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:5,minHeight:26}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14}}>{pCol==="w"?"♙":"♟"}</span>
                <span style={{fontSize:13,color:"var(--color-text-primary)",fontWeight:500}}>
                  {gameMode==="p2p"?(flipped?p2pNames.b:p2pNames.w):"You"}
                </span>
                <Captured history={hist} forColor={pCol}/>
                {gameMode==="ai"&&gStatus==="playing"&&isMyTurn&&!aiThink&&<span style={{fontSize:11,color:"#5CB88A"}}>● Your turn</span>}
              </div>
              {useTimer&&<div style={{fontSize:14,fontFamily:"monospace",fontWeight:700,color:isMyTurn?"var(--color-text-primary)":"var(--color-text-tertiary)",background:isMyTurn&&gStatus==="playing"?"rgba(74,67,160,.12)":"transparent",padding:"3px 8px",borderRadius:"var(--border-radius-md)"}}>{fmtTime(pCol==="w"?timeW:timeB)}</div>}
            </div>
          </div>
          {/* Panel */}
          <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",minHeight:SQ*8+60}}>
            <div style={{display:"flex",borderBottom:"0.5px solid var(--color-border-tertiary)",marginBottom:10}}>
              {[["moves","Moves"],["tutor","✨ Tutor"]].map(([id,label])=>(
                <button key={id} onClick={()=>setPanelTab(id)} style={{flex:1,padding:"8px 0",fontSize:13,background:"none",border:"none",borderBottom:panelTab===id?"2px solid #4A43A0":"2px solid transparent",color:panelTab===id?"#4A43A0":"var(--color-text-secondary)",cursor:"pointer",fontWeight:panelTab===id?600:400}}>{label}</button>
              ))}
            </div>
            {panelTab==="moves"&&(
              <div ref={moveListRef} style={{flex:1,overflowY:"auto",maxHeight:290}}>
                {movePairs.length===0&&<p style={{fontSize:13,color:"var(--color-text-secondary)",fontStyle:"italic",margin:0}}>Waiting for your first move…</p>}
                {movePairs.map((p,i)=>{
                  // moveQualities index: only player's moves (every other half-move starting from playerColor)
                  // We store one badge per player move so index maps to move pair
                  const wBadge = moveQualities[i*2] ?? null;   // white's move quality (index even)
                  const bBadge = moveQualities[i*2+1] ?? null; // black's move quality (index odd)
                  const isWhitePlayer = pCol==="w";
                  const myBadgeW = isWhitePlayer ? wBadge : null;
                  const myBadgeB = !isWhitePlayer ? bBadge : null;
                  return(
                    <div key={p.n} className="move-row" style={{display:"flex",alignItems:"center",borderBottom:"0.5px solid var(--color-border-tertiary)",padding:"3px 0",borderRadius:3}}>
                      <span style={{width:28,fontSize:11,color:"var(--color-text-tertiary)",flexShrink:0,fontFamily:"monospace"}}>{p.n}.</span>
                      <span style={{flex:1,fontSize:13,fontFamily:"monospace",fontWeight:600,color:"var(--color-text-primary)",padding:"2px 4px"}}>{p.w}</span>
                      {myBadgeW&&<span title={myBadgeW.label} style={{fontSize:11,fontWeight:700,color:myBadgeW.color,marginRight:2,flexShrink:0}}>{myBadgeW.sym}</span>}
                      {!myBadgeW&&<span style={{width:12,flexShrink:0}}/>}
                      <span style={{flex:1,fontSize:13,fontFamily:"monospace",color:"var(--color-text-secondary)",padding:"2px 4px"}}>{p.b??""}</span>
                      {myBadgeB&&<span title={myBadgeB.label} style={{fontSize:11,fontWeight:700,color:myBadgeB.color,marginRight:2,flexShrink:0}}>{myBadgeB.sym}</span>}
                    </div>
                  );
                })}
              </div>
            )}
            {panelTab==="tutor"&&<div style={{flex:1}}><TutorChat height={290} placeholder="Ask about this position…"/></div>}
            {/* Buttons */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:12}}>
              <button onClick={undoMove} disabled={hist.length<2||gameOver} style={{padding:"8px 0",fontSize:12,background:"none",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",cursor:hist.length<2||gameOver?"default":"pointer",color:"var(--color-text-secondary)",opacity:hist.length<2||gameOver?0.35:1}}>↩ Undo</button>
              <button onClick={showHint} disabled={gameOver||aiThink||gameMode==="p2p"} style={{padding:"8px 0",fontSize:12,background:hintSq?"rgba(74,67,160,.1)":"none",border:`0.5px solid ${hintSq?"#4A43A0":"var(--color-border-secondary)"}`,borderRadius:"var(--border-radius-md)",cursor:"pointer",color:hintSq?"#4A43A0":"var(--color-text-secondary)",opacity:gameOver||aiThink||gameMode==="p2p"?0.35:1}}>💡 Hint{gameMode==="p2p"?" (AI)":" Hint"}</button>
              <button onClick={resign} disabled={gameOver||hist.length<2} style={{padding:"8px 0",fontSize:12,background:"none",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",color:"var(--color-text-secondary)",opacity:gameOver||hist.length<2?0.35:1}}>🏳 Resign</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6}}>
              <button onClick={startGame} style={{padding:"8px 0",fontSize:12,background:"none",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",color:"var(--color-text-secondary)"}}>↺ New Game</button>
              <button onClick={()=>setScreen("play_setup")} style={{padding:"8px 0",fontSize:12,background:"none",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",color:"var(--color-text-secondary)"}}>⚙ Setup</button>
            </div>
            {/* Keyboard shortcuts */}
            <div style={{marginTop:10,padding:"8px 10px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",display:"flex",flexWrap:"wrap",gap:"6px 12px"}}>
              {[["U","Undo"],["H","Hint"],["F","Flip"],["N","New"],["Esc","Menu"]].map(([k,label])=>(
                <div key={k} style={{display:"flex",alignItems:"center",gap:4}}>
                  <span className="kbd">{k}</span>
                  <span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <GhostPiece/>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  PUZZLES
  // ════════════════════════════════════════════════════════════════
  if(screen==="puzzles"){
    const cats=["All",...new Set(PUZZLES.map(p=>p.cat))];
    return(
      <>
      <div style={{padding:"0.5rem 0 5rem",fontFamily:"var(--font-sans)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <button onClick={()=>setScreen("menu")} style={{fontSize:12,padding:"5px 10px",background:"none",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",color:"var(--color-text-secondary)"}}>← Menu</button>
          <span style={{fontSize:18,fontWeight:600,color:"var(--color-text-primary)",flex:1}}>🧩 Puzzle Trainer</span>
          <div style={{fontSize:13,padding:"4px 10px",background:streak>0?"rgba(240,140,74,.12)":"var(--color-background-secondary)",borderRadius:20,color:streak>0?"#F08C4A":"var(--color-text-secondary)",fontWeight:600}}>
            {streak>0?`🔥 ${streak} streak`:"No streak"}
          </div>
        </div>
        {/* Filter */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          {cats.map(c=>(
            <button key={c} onClick={()=>{setPzFilter(c);if(!pz) randomPuzzle(c);}}
              style={{fontSize:12,padding:"5px 11px",borderRadius:20,border:pzFilter===c?"1.5px solid #C04A90":"0.5px solid var(--color-border-tertiary)",background:pzFilter===c?"rgba(192,74,144,.1)":"transparent",color:pzFilter===c?"#C04A90":"var(--color-text-secondary)",cursor:"pointer",fontWeight:pzFilter===c?600:400}}>
              {c}
            </button>
          ))}
        </div>
        {!pz?(
          <div style={{textAlign:"center",padding:"3rem 1rem"}}>
            <div style={{fontSize:48,marginBottom:16}}>🧩</div>
            <div style={{fontSize:16,fontWeight:500,color:"var(--color-text-primary)",marginBottom:8}}>Ready for a puzzle?</div>
            <button onClick={()=>randomPuzzle()} style={{padding:"10px 24px",background:"#C04A90",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",fontSize:15,fontWeight:600,cursor:"pointer"}}>Start Puzzle</button>
          </div>
        ):(
          <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
            <div style={{flexShrink:0}}>
              <Board brd={pzBoard} onSq={handlePzClick} selSq={pzSel} legalSqs={pzLegal} lastMove={pzLastMv} noFlip={true}/>
              <div style={{marginTop:8,display:"flex",gap:6}}>
                <button onClick={()=>randomPuzzle()} style={{flex:1,padding:"7px",fontSize:12,background:"none",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",color:"var(--color-text-secondary)"}}>↺ Next</button>
                <button onClick={()=>setPzHint(true)} disabled={pzHint} style={{flex:1,padding:"7px",fontSize:12,background:"none",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",color:"var(--color-text-secondary)",opacity:pzHint?0.4:1}}>💡 Hint</button>
              </div>
            </div>
            <div style={{flex:1,minWidth:0}}>
              {/* Status */}
              <div style={{marginBottom:10,padding:"10px 14px",borderRadius:"var(--border-radius-md)",background:pzStatus==="solved"?"rgba(92,184,138,.12)":pzStatus==="wrong"?"rgba(232,85,85,.12)":"var(--color-background-secondary)",border:`0.5px solid ${pzStatus==="solved"?"#5CB88A":pzStatus==="wrong"?"#E85555":"var(--color-border-tertiary)"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:18}}>{pzStatus==="solved"?"🎉":pzStatus==="wrong"?"❌":pzStatus==="correct"?"✓":"🧩"}</span>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:"var(--color-text-primary)"}}>{pzStatus==="solved"?"Puzzle solved! ":pzStatus==="wrong"?"Wrong — try again! ":pzStatus==="correct"?"Good move! Keep going…":`${pz.cat} puzzle`}</div>
                    <div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:2}}>
                      {(pzStatus==="idle"||pzStatus==="correct")&&`Find the best move for ${pzRef.current?.turn()==="w"?"White":"Black"}!`}
                      {pzStatus==="solved"&&`Streak: ${streak} 🔥`}
                    </div>
                  </div>
                </div>
              </div>
              {/* Info card */}
              <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                  <span style={{fontSize:11,padding:"3px 8px",background:"rgba(192,74,144,.1)",color:"#C04A90",borderRadius:20,fontWeight:600}}>{pz.cat}</span>
                  <span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>{Array(pz.diff).fill("★").join("")}{Array(3-pz.diff).fill("☆").join("")}</span>
                </div>
                {pzHint?<p style={{fontSize:13,color:"var(--color-text-secondary)",lineHeight:1.6,margin:0}}>💡 {pz.hint}</p>
                :<p style={{fontSize:13,color:"var(--color-text-tertiary)",fontStyle:"italic",margin:0}}>Click Hint if you're stuck!</p>}
                {pzStatus==="wrong"&&<button onClick={()=>loadPuzzle(pz)} style={{marginTop:10,width:"100%",padding:"7px",fontSize:13,background:"none",border:"0.5px solid #E85555",color:"#E85555",borderRadius:"var(--border-radius-md)",cursor:"pointer"}}>↺ Reset Puzzle</button>}
                {pzStatus==="solved"&&<button onClick={()=>randomPuzzle()} style={{marginTop:10,width:"100%",padding:"7px",fontSize:13,background:"#5CB88A",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontWeight:600}}>Next Puzzle →</button>}
              </div>
              {/* Progress */}
              <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"0.75rem 1rem",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--color-text-secondary)",marginBottom:6}}>
                  <span>Puzzles solved</span><span>{solvedPz.size} / {PUZZLES.length}</span>
                </div>
                <div style={{height:6,background:"var(--color-border-tertiary)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(solvedPz.size/PUZZLES.length)*100}%`,background:"#C04A90",borderRadius:3,transition:"width .5s ease"}}/>
                </div>
              </div>
              {/* Tutor */}
              <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"0.75rem"}}>
                <div style={{fontSize:13,fontWeight:500,color:"var(--color-text-primary)",marginBottom:8}}>✨ Ask the Tutor</div>
                <TutorChat height={160} placeholder="Ask about this tactic…"/>
              </div>
            </div>
          </div>
        )}
      </div>
      <BottomNav/>
      </>
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  LEARN
  // ════════════════════════════════════════════════════════════════
  const pct=Math.round((doneLessons.size/LESSONS.length)*100);
  return(
    <>
    <div style={{padding:"0.5rem 0 5rem",fontFamily:"var(--font-sans)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <button onClick={()=>setScreen("menu")} style={{fontSize:12,padding:"5px 10px",background:"none",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",color:"var(--color-text-secondary)",flexShrink:0}}>← Menu</button>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {[["beginner","🌱 Beginner"],["intermediate","⚡ Intermediate"],["advanced","🏆 Advanced"]].map(([id,label])=>(
            <button key={id} onClick={()=>{setLTrack(id);setLIdx(0);}} style={{fontSize:12,padding:"5px 12px",borderRadius:20,border:lTrack===id?"1.5px solid #0F6E56":"0.5px solid var(--color-border-tertiary)",background:lTrack===id?"rgba(15,110,86,.1)":"transparent",color:lTrack===id?"#0F6E56":"var(--color-text-secondary)",cursor:"pointer",fontWeight:lTrack===id?600:400}}>{label}</button>
          ))}
        </div>
        <div style={{flex:1,fontSize:12,color:"var(--color-text-secondary)",textAlign:"right"}}>{pct}% complete</div>
      </div>
      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
        {/* Board */}
        <div style={{flexShrink:0}}>
          <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:6}}>Interactive — try moving pieces</div>
          <Board brd={lBoard} onSq={handleLClick} selSq={lSel} legalSqs={lLegal} lastMove={null} noFlip={true}/>
          <button onClick={()=>loadLesson(curLesson)} style={{marginTop:7,width:"100%",padding:"6px 0",fontSize:12,background:"none",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",color:"var(--color-text-secondary)"}}>↺ Reset position</button>
        </div>
        {/* Content */}
        <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:10}}>
          {/* Nav */}
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>setLIdx(i=>Math.max(0,i-1))} disabled={lIdx===0} style={{padding:"5px 13px",fontSize:14,background:"none",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:lIdx===0?"default":"pointer",color:"var(--color-text-secondary)",opacity:lIdx===0?0.3:1}}>←</button>
            <span style={{flex:1,textAlign:"center",fontSize:12,color:"var(--color-text-secondary)"}}>Lesson {lIdx+1} of {trackLessons.length}</span>
            <button onClick={()=>setLIdx(i=>Math.min(trackLessons.length-1,i+1))} disabled={lIdx>=trackLessons.length-1} style={{padding:"5px 13px",fontSize:14,background:"none",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:lIdx>=trackLessons.length-1?"default":"pointer",color:"var(--color-text-secondary)",opacity:lIdx>=trackLessons.length-1?0.3:1}}>→</button>
          </div>
          <div style={{display:"flex",gap:"6px 12px",flexWrap:"wrap",padding:"5px 0"}}>
            {[["←→","Navigate"],["R","Reset board"],["Esc","Menu"]].map(([k,label])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:4}}>
                <span className="kbd">{k}</span>
                <span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>{label}</span>
              </div>
            ))}
          </div>
          {/* Lesson card */}
          <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
              <span style={{fontSize:22}}>{curLesson.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:16,fontWeight:600,color:"var(--color-text-primary)",marginBottom:2}}>{curLesson.title}</div>
                <span style={{fontSize:11,padding:"2px 7px",background:"rgba(15,110,86,.1)",color:"#0F6E56",borderRadius:20,fontWeight:500,textTransform:"capitalize"}}>{curLesson.track}</span>
              </div>
              {doneLessons.has(curLesson.id)&&<span title="Completed" style={{fontSize:16,color:"#5CB88A"}}>✓</span>}
            </div>
            <p style={{fontSize:13,lineHeight:1.72,color:"var(--color-text-primary)",margin:"0 0 12px"}}>{curLesson.body}</p>
            <div style={{fontSize:12,color:"var(--color-text-secondary)",background:"var(--color-background-secondary)",padding:"9px 12px",borderRadius:"var(--border-radius-md)",borderLeft:"3px solid #0F6E56",lineHeight:1.6}}>
              💡 {curLesson.tip}
            </div>
          </div>
          {/* Actions */}
          <div style={{display:"flex",gap:8}}>
            <button onClick={markDone} style={{flex:1,padding:"10px",background:doneLessons.has(curLesson.id)?"var(--color-background-secondary)":"#0F6E56",color:doneLessons.has(curLesson.id)?"var(--color-text-secondary)":"#fff",border:"none",borderRadius:"var(--border-radius-md)",fontSize:13,fontWeight:600,cursor:"pointer"}}>
              {doneLessons.has(curLesson.id)?"✓ Completed":"Mark Complete →"}
            </button>
            <button onClick={()=>{setGameMode("ai");setDiff(lTrack==="beginner"?0:lTrack==="intermediate"?2:3);startGame();}}
              style={{flex:1,padding:"10px",background:"#4A43A0",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",fontSize:13,fontWeight:600,cursor:"pointer"}}>
              Practice → Play
            </button>
          </div>
          {/* Lesson list */}
          <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"0.75rem"}}>
            <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:6}}>All {lTrack} lessons</div>
            <div style={{display:"flex",flexDirection:"column",gap:1,maxHeight:200,overflowY:"auto"}}>
              {trackLessons.map((l,i)=>(
                <button key={l.id} onClick={()=>setLIdx(i)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:"var(--border-radius-md)",background:i===lIdx?"var(--color-background-secondary)":"transparent",border:"none",cursor:"pointer",textAlign:"left",width:"100%"}}>
                  <span style={{fontSize:12,width:18,flexShrink:0}}>{l.icon}</span>
                  <span style={{fontSize:13,color:i===lIdx?"var(--color-text-primary)":"var(--color-text-secondary)",fontWeight:i===lIdx?600:400,flex:1}}>{l.title}</span>
                  {doneLessons.has(l.id)?<span style={{fontSize:12,color:"#5CB88A"}}>✓</span>:i===lIdx?<span style={{fontSize:11,color:"#0F6E56"}}>●</span>:null}
                </button>
              ))}
            </div>
          </div>
          {/* Tutor */}
          <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"0.75rem"}}>
            <div style={{fontSize:13,fontWeight:500,color:"var(--color-text-primary)",marginBottom:8}}>✨ Ask the AI Tutor</div>
            <TutorChat height={190} placeholder={`Ask about "${curLesson?.title}"…`}/>
          </div>
        </div>
      </div>
    </div>
    <BottomNav/>
    </>
  );
}
