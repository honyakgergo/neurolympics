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
const SC1={initSquares:3,initFlashMs:1500,minFlashMs:250,stepUpFlash:160,stepDownFlash:220,correctStreak:2,distractorAt:5,seqIntervalMs:550,seqPauseMs:200,maxSquares:14,totalTrials:20,memoryTrials:10,dirTrials:10,dirBlankMs:500,dirFlashMs:1300,feedbackMs:950,holdFrac:0.6};
const CORNERS=["NE","NW","SE","SW"];
const SUBTYPES={PATTERN:"PATTERN",SEQUENTIAL:"SEQUENTIAL",DIRECTION:"DIRECTION"};
const G1P={GAME_INTRO:"GAME_INTRO",FLASH:"FLASH",SEQ_FLASH:"SEQ_FLASH",DISTRACTOR:"DISTRACTOR",RECALL:"RECALL",DIR_SHOW1:"DIR_SHOW1",DIR_BLANK:"DIR_BLANK",DIR_SHOW2:"DIR_SHOW2",DIR_RECALL:"DIR_RECALL",FEEDBACK:"FEEDBACK"};
const GRID=5,TOTAL_G1=GRID*GRID;
function pick1(n,exclude=[]){const pool=Array.from({length:TOTAL_G1},(_,i)=>i).filter(i=>!exclude.includes(i));const out=[];while(out.length<n&&pool.length){const i=Math.floor(Math.random()*pool.length);out.push(pool.splice(i,1)[0]);}return out;}
function randCorner(){return CORNERS[Math.floor(Math.random()*4)];}
function diffCorner(c){const r=CORNERS.filter(x=>x!==c);return r[Math.floor(Math.random()*3)];}
function buildTrialSeq(){const mem=Array.from({length:SC1.memoryTrials},()=>Math.random()<0.5?SUBTYPES.PATTERN:SUBTYPES.SEQUENTIAL);const dir=Array.from({length:SC1.dirTrials},()=>SUBTYPES.DIRECTION);const seq=[];for(let i=0;i<SC1.totalTrials;i++)seq.push(i%2===0?mem[Math.floor(i/2)]:dir[Math.floor(i/2)]);return seq;}

// Points for one trial. frac is the share of targets recalled (0..1), so a 4/5
// trial is worth 80% of a clean one instead of nothing.
function g1TrialPoints(frac,sq,flashMs,subtype){
  if(frac<=0)return 0;
  const basePoints=sq*10;                                                               // 3 shapes → 30, 10 → 100
  const speedBonus=Math.max(0,Math.round((SC1.initFlashMs-flashMs)/SC1.initFlashMs*50)); // 0–50 for a shorter flash
  const subtypeMultiplier=subtype===SUBTYPES.DIRECTION?1.5:subtype===SUBTYPES.SEQUENTIAL?1.2:1.0;
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
  const[flashMs,setFlashMs]=useState(SC1.initFlashMs);
  const[streak,setStreak]=useState(0);
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

  // Three-way staircase: perfect recall moves up, partial holds, a miss drops.
  function updateStair(frac,sq,fl,strk,ceil){
    let nSq=sq,nFl=fl,nStrk=strk,nCeil=ceil;
    if(frac>=1){
      nStrk=strk+1;nCeil=Math.max(ceil,sq);nFl=Math.max(SC1.minFlashMs,fl-SC1.stepUpFlash);
      if(nStrk>=SC1.correctStreak){nSq=Math.min(sq+1,SC1.maxSquares);nStrk=0;}
    } else if(frac>=SC1.holdFrac){
      nStrk=0; // close enough — same span, same flash time, try again
    } else {
      nStrk=0;nFl=Math.min(2400,fl+SC1.stepDownFlash);nSq=Math.max(SC1.initSquares,sq-1);
    }
    setNumSq(nSq);setFlashMs(nFl);setStreak(nStrk);setCeiling(nCeil);return{nSq,nFl};
  }

  const genTrial=useCallback((sq,fl,idx)=>{
    const st=idx<SC1.totalTrials?trialSeq.current[idx]:SUBTYPES.PATTERN;
    setSubtype(st);setPicks([]);setSelectedDir(-1);setSeqVisible(-1);setDistractors([]);
    if(st===SUBTYPES.DIRECTION){
      const count=Math.max(5,Math.min(6+Math.floor(sq/2),13));const cells=pick1(count);
      const g1=cells.map(()=>randCorner());const ci=Math.floor(Math.random()*count);
      const g2=g1.map((d,i)=>i===ci?diffCorner(d):d);
      setDirCells(cells);setDirGrid1(g1);setDirGrid2(g2);setChangedCell(ci);setPhase(G1P.DIR_SHOW1);clr();
      timer.current=setTimeout(()=>{setPhase(G1P.DIR_BLANK);timer.current=setTimeout(()=>{setPhase(G1P.DIR_SHOW2);timer.current=setTimeout(()=>setPhase(G1P.DIR_RECALL),SC1.dirFlashMs);},SC1.dirBlankMs);},SC1.dirFlashMs);return;
    }
    // Span is exactly the staircase value, so "SHAPES" on the HUD is what you saw.
    const tgts=pick1(Math.min(sq,TOTAL_G1-4));setTargets(tgts);
    if(st===SUBTYPES.PATTERN){
      const useD=sq>=SC1.distractorAt;const dists=useD?pick1(Math.min(6,Math.floor(sq/1.5)),tgts):[];
      setDistractors([]);setPhase(G1P.FLASH);clr();
      timer.current=setTimeout(()=>{if(useD){setDistractors(dists);setPhase(G1P.DISTRACTOR);timer.current=setTimeout(()=>{setDistractors([]);setPhase(G1P.RECALL);},650);}else setPhase(G1P.RECALL);},fl);
    } else {
      setPhase(G1P.SEQ_FLASH);let i=0;
      const next=()=>{if(i<tgts.length){setSeqVisible(i);timer.current=setTimeout(()=>{setSeqVisible(-1);timer.current=setTimeout(()=>{i++;next();},SC1.seqPauseMs);},SC1.seqIntervalMs);}else setPhase(G1P.RECALL);};next();
    }
  },[]);

  function clickCircleCell(i){
    if(phase!==G1P.RECALL||pausedRef.current)return;
    if(picks.includes(i))return;
    const np=[...picks,i];setPicks(np);
    if(np.length>=targets.length){
      const hits=np.filter(x=>targets.includes(x)).length;
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
    const pts=g1TrialPoints(frac,numSq,flashMs,subtype);
    setLastFrac(frac);setLastPts(pts);
    if(pts>0)setTotalScore(s=>s+pts);
    setPhase(G1P.FEEDBACK);
    advanceTrial(frac,pts);
  }
  function advanceTrial(frac,pts){
    const newCount=trialCount+1;setTrialCount(newCount);
    const sub=subtype,sq=numSq,fl=flashMs,strk=streak,ceil=ceiling;
    setTrialResults(prev=>{
      const r=[...prev,{trial:newCount,squares:sq,flashMs:fl,frac,correct:frac>=1,subtype:sub,pts}];
      if(newCount>=SC1.totalTrials){clr();timer.current=setTimeout(()=>finishSession(r),SC1.feedbackMs);}
      return r;
    });
    const{nSq,nFl}=updateStair(frac,sq,fl,strk,ceil);
    if(newCount<SC1.totalTrials){clr();timer.current=setTimeout(()=>genTrial(nSq,nFl,newCount),SC1.feedbackMs);}
  }
  function finishSession(results){
    const mean=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
    const perfect=results.filter(r=>r.frac>=1);
    const ceil=perfect.length?Math.max(...perfect.map(r=>r.squares)):SC1.initSquares;
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
  useEffect(()=>{if(phase===G1P.GAME_INTRO){clr();timer.current=setTimeout(()=>genTrial(SC1.initSquares,SC1.initFlashMs,0),600);}},[] );

  function getCellStyle(i,ph){
    const inTgt=targets.includes(i),inDist=distractors.includes(i),inPick=picks.includes(i);
    const isSeq=ph===G1P.SEQ_FLASH&&seqVisible>=0&&targets[seqVisible]===i;
    let bg="#0c0f1a",border="1px solid #181d2e",shape=null;
    if(ph===G1P.FLASH){if(inTgt){bg="#091828";border="1px solid #1a3a5a";shape=<GearShape color="#5ecef7" size={54} glow/>;}}
    else if(ph===G1P.SEQ_FLASH){if(isSeq){bg="#091828";border="1px solid #1a3a5a";shape=<GearShape color="#5ecef7" glow/>;}}
    else if(ph===G1P.DISTRACTOR){if(inDist){bg="#1a0a05";border="1px solid #5a2010";shape=<GearShape color="#f7874f" glow/>;}}
    // During recall every tap looks the same — no correctness leak mid-trial.
    else if(ph===G1P.RECALL){if(inPick){bg="#090f1e";border="1px solid #4f8ef7";shape=<GearShape color="#4f8ef7"/>;}}
    else if(ph===G1P.FEEDBACK){
      if(inTgt&&inPick){bg="#081a10";border="1px solid #2ecc71";shape=<GearShape color="#2ecc71"/>;}
      else if(inTgt&&!inPick){bg="#1a0808";border="1px dashed #e74c3c";shape=<GearShape color="#e74c3c"/>;}
      else if(inPick){bg="#1a0e05";border="1px solid #e67e22";shape=<GearShape color="#e67e22"/>;}
    }
    return{bg,border,shape};
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
    [G1P.FLASH]:"Memorize the pattern…",[G1P.SEQ_FLASH]:"Watch each shape…",
    [G1P.DISTRACTOR]:"Ignore orange — remember blue",
    [G1P.RECALL]:`Tap every blue position — ${remaining} tap${remaining===1?"":"s"} left`,
    [G1P.DIR_SHOW1]:"Study the directions…",[G1P.DIR_BLANK]:" ",[G1P.DIR_SHOW2]:"One changed — which?",
    [G1P.DIR_RECALL]:"Tap the triangle that rotated",[G1P.FEEDBACK]:fbText,
  };
  const isFB=phase===G1P.FEEDBACK;
  const fbColor=lastFrac>=1?C.green:lastFrac>0?C.amber:C.red;
  const memDone=trialResults.filter(r=>r.subtype!==SUBTYPES.DIRECTION).length;
  const dirDone=trialResults.filter(r=>r.subtype===SUBTYPES.DIRECTION).length;

  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:C.text,padding:14,gap:14}}>
      {paused&&<PauseOverlay onResume={()=>{pausedRef.current=false;setPaused(false);}} onHub={onBack}/>}
      <div style={{width:"min(520px,95vw)"}}>
        <GameBar label="COLLECT" onPause={togglePause} stats={[
          {label:"POINTS",value:totalScore,color:C.accent},
          {label:"MEMORY",value:memDone,sub:"/10",color:C.accent},
          {label:"DIRECTION",value:dirDone,sub:"/10",color:C.purple},
          {label:"SHAPES",value:numSq,color:C.text},
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
          const{bg,border,shape}=getCellStyle(i,phase);
          return(<div key={i} onClick={()=>clickCircleCell(i)} style={{aspectRatio:"1",minHeight:46,borderRadius:6,background:bg,border,display:"flex",alignItems:"center",justifyContent:"center",cursor:phase===G1P.RECALL?"pointer":"default",touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>{shape}</div>);
        })}
      </div>
      <p style={{color:C.faint,fontSize:11.5,margin:0,textAlign:"center"}}>Partial credit. One tap per shape, and a miss only costs that shape.</p>
    </div>
  );
}
