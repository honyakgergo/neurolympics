import { useState, useEffect, useRef, useCallback } from "react";
import { GameBar } from "../components/GameBar.jsx";
import { PauseOverlay } from "../components/PauseOverlay.jsx";
import { scoreG1 } from "../lib/scoring.js";
import { LS, lsGet, lsSet } from "../lib/storage.js";
import { C } from "../lib/theme.js";

// Game 1 — Collect (working memory)
//
// Scoring is partial-credit: you get one tap per target shape, and the trial is
// graded on how many of them you actually found. A single mis-tap costs you one
// slot instead of the whole trial, so the session score reflects overall recall
// rather than the one trial where you slipped.
// Two independent staircases. The memory one (span + tightness) is driven only
// by PATTERN/SEQUENTIAL trials; the direction one only by DIRECTION trials.
// They used to share a single staircase, which meant every missed triangle
// knocked the shape span back down — with triangles interleaved one-for-one,
// the span never climbed out of the floor and the memory half stayed trivial.
//
// Exposure is a per-shape budget rather than a flat number, so a 9-shape flash
// is not the same 1.5s as a 3-shape one. `tight` squeezes that budget as you
// prove you can take it, and relaxes when you cannot.
const SC1={
  initSquares:4,maxSquares:16,
  perShapeMs:250,minFlashMs:420,maxFlashMs:2600,
  initTight:1,minTight:0.45,maxTight:1.3,tightStep:0.07,tightRelax:0.12,
  correctStreak:1,
  distractorAt:4,distractorMs:700,
  seqStepMs:430,minSeqStepMs:190,seqPauseMs:150,
  initDirCells:7,minDirCells:6,maxDirCells:11,dirStreak:2,
  totalTrials:20,memoryTrials:10,dirTrials:10,
  dirBlankMs:500,dirFlashMs:1300,feedbackMs:950,holdFrac:0.6,
};
const flashFor=(sq,tight)=>Math.round(Math.min(SC1.maxFlashMs,Math.max(SC1.minFlashMs,SC1.perShapeMs*sq*tight)));
const seqStepFor=tight=>Math.round(Math.max(SC1.minSeqStepMs,SC1.seqStepMs*tight));
const CORNERS=["NE","NW","SE","SW"];
const SUBTYPES={PATTERN:"PATTERN",SEQUENTIAL:"SEQUENTIAL",DIRECTION:"DIRECTION"};
const G1P={GAME_INTRO:"GAME_INTRO",FLASH:"FLASH",SEQ_FLASH:"SEQ_FLASH",DISTRACTOR:"DISTRACTOR",RECALL:"RECALL",DIR_SHOW1:"DIR_SHOW1",DIR_BLANK:"DIR_BLANK",DIR_SHOW2:"DIR_SHOW2",DIR_RECALL:"DIR_RECALL",FEEDBACK:"FEEDBACK"};
const GRID=5,TOTAL_G1=GRID*GRID;
function pick1(n,exclude=[]){const pool=Array.from({length:TOTAL_G1},(_,i)=>i).filter(i=>!exclude.includes(i));const out=[];while(out.length<n&&pool.length){const i=Math.floor(Math.random()*pool.length);out.push(pool.splice(i,1)[0]);}return out;}
function randCorner(){return CORNERS[Math.floor(Math.random()*4)];}
function diffCorner(c){const r=CORNERS.filter(x=>x!==c);return r[Math.floor(Math.random()*3)];}
function buildTrialSeq(){const mem=Array.from({length:SC1.memoryTrials},()=>Math.random()<0.5?SUBTYPES.PATTERN:SUBTYPES.SEQUENTIAL);const dir=Array.from({length:SC1.dirTrials},()=>SUBTYPES.DIRECTION);const seq=[];for(let i=0;i<SC1.totalTrials;i++)seq.push(i%2===0?mem[Math.floor(i/2)]:dir[Math.floor(i/2)]);return seq;}

// Points for one trial. frac is the share of targets recalled (0..1), so a 4/5
// trial is worth 80% of a clean one instead of nothing. `span` is the shape
// count for memory trials and the triangle count for direction ones.
function g1TrialPoints(frac,span,tight,subtype){
  if(frac<=0)return 0;
  const basePoints=span*10;                                                                              // 4 shapes → 40, 10 → 100
  const squeeze=(SC1.initTight-tight)/(SC1.initTight-SC1.minTight);
  const speedBonus=subtype===SUBTYPES.DIRECTION?0:Math.round(Math.max(0,Math.min(1,squeeze))*60);         // 0–60 for a tighter flash
  const subtypeMultiplier=subtype===SUBTYPES.DIRECTION?1.5:subtype===SUBTYPES.SEQUENTIAL?1.35:1.0;        // order recall is worth more
  return Math.round((basePoints+speedBonus)*subtypeMultiplier*frac);
}

function GearShape({color="#5ecef7",size=44,glow=false}){const teeth=11,outer=18,inner=13,cx=20,cy=20;const pts=Array.from({length:teeth*2},(_,i)=>{const a=(i*Math.PI)/teeth-Math.PI/2,r=i%2===0?outer:inner;return`${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`;}).join(" ");return(<svg viewBox="0 0 40 40" width={size} height={size}>{glow&&<polygon points={pts} fill={color} opacity={0.25} transform="scale(1.15) translate(-3,-3)"/>}<polygon points={pts} fill={color}/><circle cx={cx} cy={cy} r={6.5} fill="white" opacity={0.92}/></svg>);}
function TriangleShape1({dir,color="#5ecef7",size=48,glow=false}){const rotate={NE:-45,NW:-135,SE:45,SW:135};const deg=rotate[dir];const pts="20,3 36,33 4,33";return(<svg viewBox="0 0 40 40" width={size} height={size}>{glow&&<polygon points={pts} fill={color} opacity={0.22} transform={`rotate(${deg},20,20) scale(1.18) translate(${-20*0.18},${-20*0.18})`}/>}<polygon points={pts} fill={color} transform={`rotate(${deg},20,20)`}/><polygon points={pts} fill="white" opacity={0.85} transform={`rotate(${deg},20,20) scale(0.48) translate(${20*1.08},${20*1.08})`}/></svg>);}

export function Game1({onBack,onFinish}){
  const[paused,setPaused]=useState(false);
  const pausedRef=useRef(false);
  const togglePause=()=>{pausedRef.current=!pausedRef.current;setPaused(pausedRef.current);};
  useEffect(()=>{const h=e=>{if(e.key==="Escape")togglePause();};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[]);
  const[phase,setPhase]=useState(G1P.GAME_INTRO);
  const[subtype,setSubtype]=useState(SUBTYPES.PATTERN);
  const[numSq,setNumSq]=useState(SC1.initSquares);
  const[tight,setTight]=useState(SC1.initTight);
  const[streak,setStreak]=useState(0);
  const[dirN,setDirN]=useState(SC1.initDirCells);
  const[dirStrk,setDirStrk]=useState(0);
  const[ceiling,setCeiling]=useState(SC1.initSquares);
  const[totalScore,setTotalScore]=useState(0);
  const[trialCount,setTrialCount]=useState(0);
  const[trialResults,setTrialResults]=useState([]);
  const[targets,setTargets]=useState([]);
  const[distractors,setDistractors]=useState([]);
  const[picks,setPicks]=useState([]);
  const[seqVisible,setSeqVisible]=useState(-1);
  const[dirCells,setDirCells]=useState([]);
  const[dirGrid1,setDirGrid1]=useState([]);
  const[dirGrid2,setDirGrid2]=useState([]);
  const[changedCell,setChangedCell]=useState(-1);
  const[selectedDir,setSelectedDir]=useState(-1);
  const[lastFrac,setLastFrac]=useState(null);
  const[lastHits,setLastHits]=useState(null);
  const[lastPts,setLastPts]=useState(0);
  const timer=useRef(null);
  const trialSeq=useRef(buildTrialSeq());
  const clr=()=>{if(timer.current)clearTimeout(timer.current);};

  // Three-way memory staircase: perfect recall moves up, partial holds, a miss
  // drops. Only PATTERN and SEQUENTIAL trials feed this.
  function updateStair(frac,sq,tg,strk,ceil){
    let nSq=sq,nTg=tg,nStrk=strk,nCeil=ceil;
    if(frac>=1){
      nStrk=strk+1;nCeil=Math.max(ceil,sq);nTg=Math.max(SC1.minTight,tg-SC1.tightStep);
      if(nStrk>=SC1.correctStreak){nSq=Math.min(sq+1,SC1.maxSquares);nStrk=0;}
    } else if(frac>=SC1.holdFrac){
      nStrk=0; // close enough — same span, same exposure, try again
    } else {
      nStrk=0;nTg=Math.min(SC1.maxTight,tg+SC1.tightRelax);nSq=Math.max(SC1.initSquares,sq-1);
    }
    setNumSq(nSq);setTight(nTg);setStreak(nStrk);setCeiling(nCeil);return{nSq,nTg};
  }
  // Direction has its own, gentler ladder so a missed triangle costs triangles
  // and nothing else.
  function updateDirStair(frac,n,strk){
    let nN=n,nStrk=strk;
    if(frac>=1){nStrk=strk+1;if(nStrk>=SC1.dirStreak){nN=Math.min(n+1,SC1.maxDirCells);nStrk=0;}}
    else{nStrk=0;nN=Math.max(SC1.minDirCells,n-1);}
    setDirN(nN);setDirStrk(nStrk);return nN;
  }

  const genTrial=useCallback((sq,tg,dn,idx)=>{
    const st=idx<SC1.totalTrials?trialSeq.current[idx]:SUBTYPES.PATTERN;
    setSubtype(st);setPicks([]);setSelectedDir(-1);setSeqVisible(-1);setDistractors([]);
    if(st===SUBTYPES.DIRECTION){
      const count=dn;const cells=pick1(count);
      const g1=cells.map(()=>randCorner());const ci=Math.floor(Math.random()*count);
      const g2=g1.map((d,i)=>i===ci?diffCorner(d):d);
      setDirCells(cells);setDirGrid1(g1);setDirGrid2(g2);setChangedCell(ci);setPhase(G1P.DIR_SHOW1);clr();
      timer.current=setTimeout(()=>{setPhase(G1P.DIR_BLANK);timer.current=setTimeout(()=>{setPhase(G1P.DIR_SHOW2);timer.current=setTimeout(()=>setPhase(G1P.DIR_RECALL),SC1.dirFlashMs);},SC1.dirBlankMs);},SC1.dirFlashMs);return;
    }
    // Span is exactly the staircase value, so "SHAPES" on the HUD is what you saw.
    const tgts=pick1(Math.min(sq,TOTAL_G1-4));setTargets(tgts);
    if(st===SUBTYPES.PATTERN){
      const useD=sq>=SC1.distractorAt;const dists=useD?pick1(Math.min(7,Math.max(3,Math.round(sq*0.7))),tgts):[];
      setDistractors([]);setPhase(G1P.FLASH);clr();
      timer.current=setTimeout(()=>{if(useD){setDistractors(dists);setPhase(G1P.DISTRACTOR);timer.current=setTimeout(()=>{setDistractors([]);setPhase(G1P.RECALL);},SC1.distractorMs);}else setPhase(G1P.RECALL);},flashFor(sq,tg));
    } else {
      setPhase(G1P.SEQ_FLASH);let i=0;const step=seqStepFor(tg);
      const next=()=>{if(i<tgts.length){setSeqVisible(i);timer.current=setTimeout(()=>{setSeqVisible(-1);timer.current=setTimeout(()=>{i++;next();},SC1.seqPauseMs);},step);}else setPhase(G1P.RECALL);};next();
    }
  },[]);

  function clickCircleCell(i){
    if(phase!==G1P.RECALL||pausedRef.current)return;
    if(picks.includes(i))return;
    const np=[...picks,i];setPicks(np);
    if(np.length>=targets.length){
      // Sequential is graded by position: the right cell in the wrong slot is
      // not a hit. Pattern stays order-free.
      const hits=subtype===SUBTYPES.SEQUENTIAL
        ? np.filter((x,k)=>targets[k]===x).length
        : np.filter(x=>targets.includes(x)).length;
      const frac=hits/targets.length;
      setLastHits({hits,total:targets.length});
      finishTrial(frac);
    }
  }
  function clickDirCell(idx){
    if(phase!==G1P.DIR_RECALL||pausedRef.current)return;
    setSelectedDir(idx);
    const frac=idx===changedCell?1:0;
    setLastHits(null);
    finishTrial(frac);
  }
  function finishTrial(frac){
    const isDirTrial=subtype===SUBTYPES.DIRECTION;
    const pts=g1TrialPoints(frac,isDirTrial?dirN:numSq,tight,subtype);
    setLastFrac(frac);setLastPts(pts);
    if(pts>0)setTotalScore(s=>s+pts);
    setPhase(G1P.FEEDBACK);
    advanceTrial(frac,pts);
  }
  function advanceTrial(frac,pts){
    const newCount=trialCount+1;setTrialCount(newCount);
    const sub=subtype,sq=numSq,tg=tight,strk=streak,ceil=ceiling;
    const isDirTrial=sub===SUBTYPES.DIRECTION;
    setTrialResults(prev=>{
      const r=[...prev,{trial:newCount,squares:isDirTrial?dirN:sq,flashMs:isDirTrial?SC1.dirFlashMs:flashFor(sq,tg),frac,correct:frac>=1,subtype:sub,pts}];
      if(newCount>=SC1.totalTrials){clr();timer.current=setTimeout(()=>finishSession(r),SC1.feedbackMs);}
      return r;
    });
    // Each subtype only moves its own ladder.
    const nDir=isDirTrial?updateDirStair(frac,dirN,dirStrk):dirN;
    const{nSq,nTg}=isDirTrial?{nSq:sq,nTg:tg}:updateStair(frac,sq,tg,strk,ceil);
    if(newCount<SC1.totalTrials){clr();timer.current=setTimeout(()=>genTrial(nSq,nTg,nDir,newCount),SC1.feedbackMs);}
  }
  function finishSession(results){
    const mean=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
    const perfect=results.filter(r=>r.frac>=1);
    // Ceiling is a memory-span figure, so direction trials must not feed it.
    const perfectMem=perfect.filter(r=>r.subtype!==SUBTYPES.DIRECTION);
    const ceil=perfectMem.length?Math.max(...perfectMem.map(r=>r.squares)):SC1.initSquares;
    // Accuracy is now mean partial recall, not the share of flawless trials.
    const acc=Math.round(mean(results.map(r=>r.frac))*100);
    const patTrials=results.filter(r=>r.subtype!==SUBTYPES.DIRECTION);
    const distractorAcc=Math.round(mean(patTrials.map(r=>r.frac))*100);
    const dirTrials=results.filter(r=>r.subtype===SUBTYPES.DIRECTION);
    const dirAcc=Math.round(mean(dirTrials.map(r=>r.frac))*100);
    const points=results.reduce((s,r)=>s+r.pts,0);
    const perfectRate=Math.round(perfect.length/results.length*100);
    const score=scoreG1({ceiling:ceil,accuracy:acc,distractorAcc,dirAcc});
    const entry={date:new Date().toLocaleDateString(),ceiling:ceil,score,points,accuracy:acc,perfectRate,distractorAcc,dirAcc,trials:results.length};
    const h=lsGet(LS.g1);h.push(entry);lsSet(LS.g1,h);
    onFinish({score,label:`Rating: ${score} / 1000`,detail:`Ceiling ${ceil} · Recall ${acc}% · Clean trials ${perfectRate}% · ${points} pts`,raw:{ceiling:ceil,score,points,accuracy:acc,perfectRate,distractorAcc,dirAcc}});
  }
  useEffect(()=>()=>clr(),[]);
  useEffect(()=>{if(phase===G1P.GAME_INTRO){clr();timer.current=setTimeout(()=>genTrial(SC1.initSquares,SC1.initTight,SC1.initDirCells,0),600);}},[] );

  // Order matters in SEQUENTIAL, so those cells carry their slot number: the tap
  // index while recalling, the correct index once the trial is graded.
  function getCellStyle(i,ph){
    const inTgt=targets.includes(i),inDist=distractors.includes(i),inPick=picks.includes(i);
    const isSeq=ph===G1P.SEQ_FLASH&&seqVisible>=0&&targets[seqVisible]===i;
    const ordered=subtype===SUBTYPES.SEQUENTIAL;
    const ti=targets.indexOf(i),pi=picks.indexOf(i);
    let bg="#0c0f1a",border="1px solid #181d2e",shape=null,label=null;
    if(ph===G1P.FLASH){if(inTgt){bg="#091828";border="1px solid #1a3a5a";shape=<GearShape color="#5ecef7" size={54} glow/>;}}
    else if(ph===G1P.SEQ_FLASH){if(isSeq){bg="#091828";border="1px solid #1a3a5a";shape=<GearShape color="#5ecef7" glow/>;}}
    else if(ph===G1P.DISTRACTOR){if(inDist){bg="#1a0a05";border="1px solid #5a2010";shape=<GearShape color="#f7874f" glow/>;}}
    // During recall every tap looks the same — no correctness leak mid-trial.
    else if(ph===G1P.RECALL){if(inPick){bg="#090f1e";border="1px solid #4f8ef7";shape=<GearShape color="#4f8ef7"/>;if(ordered)label=pi+1;}}
    else if(ph===G1P.FEEDBACK){
      const rightSlot=ordered?ti>=0&&pi===ti:inTgt&&inPick;
      if(rightSlot){bg="#081a10";border="1px solid #2ecc71";shape=<GearShape color="#2ecc71"/>;if(ordered)label=ti+1;}
      else if(inTgt){bg="#1a0808";border="1px dashed #e74c3c";shape=<GearShape color="#e74c3c"/>;if(ordered)label=ti+1;}
      else if(inPick){bg="#1a0e05";border="1px solid #e67e22";shape=<GearShape color="#e67e22"/>;if(ordered)label=pi+1;}
    }
    return{bg,border,shape,label};
  }
  const isDir=[G1P.DIR_SHOW1,G1P.DIR_BLANK,G1P.DIR_SHOW2,G1P.DIR_RECALL,G1P.FEEDBACK].includes(phase)&&subtype===SUBTYPES.DIRECTION;
  const dirMap={};dirCells.forEach((cp,idx)=>{dirMap[cp]=idx;});
  const stLabel={[SUBTYPES.PATTERN]:"Pattern Flash",[SUBTYPES.SEQUENTIAL]:"Sequential",[SUBTYPES.DIRECTION]:"Direction Change"};
  const stColor={[SUBTYPES.PATTERN]:C.accent,[SUBTYPES.SEQUENTIAL]:C.green,[SUBTYPES.DIRECTION]:C.purple};
  const remaining=Math.max(0,targets.length-picks.length);
  const fbText=lastFrac===null?"":lastFrac>=1?`✓ +${lastPts} pts`
    :lastFrac>0?`${lastHits?`${lastHits.hits}/${lastHits.total} recalled`:"Partial"} · +${lastPts} pts`
    :"✗ No points";
  const instrMap={
    [G1P.FLASH]:"Memorize the pattern…",[G1P.SEQ_FLASH]:"Watch the order…",
    [G1P.DISTRACTOR]:"Ignore orange — remember blue",
    [G1P.RECALL]:subtype===SUBTYPES.SEQUENTIAL
      ?`Tap the positions in order — ${remaining} tap${remaining===1?"":"s"} left`
      :`Tap every blue position — ${remaining} tap${remaining===1?"":"s"} left`,
    [G1P.DIR_SHOW1]:"Study the directions…",[G1P.DIR_BLANK]:" ",[G1P.DIR_SHOW2]:"One changed — which?",
    [G1P.DIR_RECALL]:"Tap the triangle that rotated",[G1P.FEEDBACK]:fbText,
  };
  const isFB=phase===G1P.FEEDBACK;
  const fbColor=lastFrac>=1?C.green:lastFrac>0?C.amber:C.red;
  const memDone=trialResults.filter(r=>r.subtype!==SUBTYPES.DIRECTION).length;
  const dirDone=trialResults.filter(r=>r.subtype===SUBTYPES.DIRECTION).length;

  return(
    <div style={{minHeight:"100dvh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:C.text,padding:14,gap:14}}>
      {paused&&<PauseOverlay onResume={()=>{pausedRef.current=false;setPaused(false);}} onHub={onBack}/>}
      <div style={{width:"min(520px,95vw)"}}>
        <GameBar label="COLLECT" onPause={togglePause} stats={[
          {label:"POINTS",value:totalScore,color:C.accent},
          {label:"MEMORY",value:memDone,sub:"/10",color:C.accent},
          {label:"DIRECTION",value:dirDone,sub:"/10",color:C.purple},
          {label:"SHAPES",value:subtype===SUBTYPES.DIRECTION?dirN:numSq,color:C.text},
          {label:"CEILING",value:ceiling,color:C.purple},
        ]}/>
      </div>
      <div style={{background:stColor[subtype]+"18",color:stColor[subtype],border:`1px solid ${stColor[subtype]}30`,borderRadius:20,padding:"4px 14px",fontSize:10,fontWeight:600,letterSpacing:0.5}}>{stLabel[subtype]}</div>
      <p style={{color:isFB?fbColor:C.text,fontSize:13,fontWeight:isFB?700:400,margin:0,minHeight:20,textAlign:"center"}}>{instrMap[phase]}</p>
      <div style={{display:"grid",gridTemplateColumns:`repeat(${GRID},1fr)`,gap:5,width:"min(520px,95vw)",border:"1.5px solid #2a4060",borderRadius:10,padding:5,background:"#080b12",boxSizing:"border-box"}}>
        {Array.from({length:TOTAL_G1},(_,i)=>{
          if(isDir){
            if(phase===G1P.DIR_BLANK)return<div key={i} style={{aspectRatio:"1",minHeight:46,borderRadius:6,background:"#0c0f1a",border:`1px solid ${C.border}`}}/>;
            const idx=dirMap[i];
            if(idx===undefined)return<div key={i} style={{aspectRatio:"1",minHeight:46,borderRadius:6,background:"#0c0f1a",border:`1px solid ${C.border}`}}/>;
            const g1d=dirGrid1[idx],g2d=dirGrid2[idx],isChanged=idx===changedCell,isSel=idx===selectedDir;
            let bg="#0c0f1a",border=`1px solid ${C.border}`,col="#5ecef7",showDir=null,glow=false;
            if(phase===G1P.DIR_SHOW1){showDir=g1d;glow=true;}
            else if(phase===G1P.DIR_SHOW2){showDir=g2d;glow=true;}
            else if(phase===G1P.DIR_RECALL){showDir=g2d;if(isSel){bg="#090f1e";border="1px solid #4f8ef7";}}
            else if(phase===G1P.FEEDBACK){showDir=g2d;if(isChanged&&isSel){bg="#081a10";border="1px solid #2ecc71";col="#2ecc71";}else if(isChanged&&!isSel){bg="#1a0808";border="1px dashed #e74c3c";col="#e74c3c";}else if(!isChanged&&isSel){bg="#1a0e05";border="1px solid #e67e22";col="#e67e22";}}
            return(<div key={i} onClick={()=>{if(phase===G1P.DIR_RECALL)clickDirCell(idx);}} style={{aspectRatio:"1",minHeight:46,borderRadius:6,background:bg,border,display:"flex",alignItems:"center",justifyContent:"center",cursor:phase===G1P.DIR_RECALL?"pointer":"default",touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>{showDir&&<TriangleShape1 dir={showDir} color={col} size={44} glow={glow}/>}</div>);
          }
          const{bg,border,shape,label}=getCellStyle(i,phase);
          return(<div key={i} onClick={()=>clickCircleCell(i)} style={{position:"relative",aspectRatio:"1",minHeight:46,borderRadius:6,background:bg,border,display:"flex",alignItems:"center",justifyContent:"center",cursor:phase===G1P.RECALL?"pointer":"default",touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>
            {shape}
            {label!==null&&<span style={{position:"absolute",fontSize:12,fontWeight:800,color:"#060a12",lineHeight:1,pointerEvents:"none",fontVariantNumeric:"tabular-nums"}}>{label}</span>}
          </div>);
        })}
      </div>
      <p style={{color:C.faint,fontSize:11.5,margin:0,textAlign:"center"}}>Partial credit. One tap per shape, and a miss only costs that shape. Sequential trials are graded on order.</p>
    </div>
  );
}
