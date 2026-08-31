import { useState, useEffect, useRef } from "react";
import { LandscapeGuard, isTouchDevice } from "../components/LandscapeGuard.jsx";
import { GameBar } from "../components/GameBar.jsx";
import { PauseOverlay } from "../components/PauseOverlay.jsx";
import { scoreG4 } from "../lib/scoring.js";
import { LS, saveSession } from "../lib/storage.js";
import { C } from "../lib/theme.js";

// Game 4 — Synchronize (attention)
// Desktop: fixed-size board, 0 = left and 1 = right on the keyboard.
// Touch: a wide board sized for a landscape phone, tap either half.
const G4_TPB=15,G4_BATCHES=5,G4_TOTAL=G4_TPB*G4_BATCHES,G4_MAX_PTS=500,G4_MAX_RT=800;
const G4_WINDOW=1200,G4_FB_MS=500,G4_DIST_MS=300,G4_DIST_FROM=3,G4_DIST_CHANCE=0.2;

// Desktop keeps the original 640x460 board.
const GEO_DESKTOP={W:640,H:460,gap:90,arrow:48,ring:110,dist:22,fbSize:15,fbOff:52};
const GEO_MOBILE ={W:920,H:420,gap:142,arrow:76,ring:132,dist:30,fbSize:26,fbOff:64};

function Arrow4({dir,faded,size,spark}){const pts="4,4 4,34 32,20";const flip=dir==="left"?`scale(-1,1) translate(-38,0)`:"";return(<svg viewBox="0 0 38 38" width={size} height={size} style={{overflow:"visible"}}>{spark&&["0,1","1,0","0,-1","-1,0","0.7,0.7","-0.7,0.7","0.7,-0.7","-0.7,-0.7"].map((v,i)=>{const[vx,vy]=v.split(",").map(Number);return<line key={i} x1={19} y1={19} x2={19+vx*18} y2={19+vy*18} stroke="#5ecef7" strokeWidth="2.5" opacity="0.9"/>;})}<g transform={flip}><polygon points={pts} fill="#5ecef7" opacity={faded?0.32:0.95}/><polygon points="10,11 10,27 24,20" fill="white" opacity={faded?0.18:0.82}/></g></svg>);}
function GearDist4({x,y,R}){const teeth=10;const pts=Array.from({length:teeth*2},(_,i)=>{const a=(i*Math.PI)/teeth-Math.PI/2,r=i%2===0?R:R*0.72;return`${x+r*Math.cos(a)},${y+r*Math.sin(a)}`;}).join(" ");return<g><polygon points={pts} fill="#5ecef7" opacity={0.9}/><circle cx={x} cy={y} r={R*0.3} fill="white" opacity={0.85}/></g>;}
function Ring4({pct,score,lastRtPct,sz}){const r=sz*0.4,ri=sz*0.31,cx=sz/2,cy=sz/2,circ=2*Math.PI*r,circi=2*Math.PI*ri;const sw=sz*0.064;const rtColor=lastRtPct===null?"transparent":lastRtPct>0.75?C.green:lastRtPct>0.4?C.amber:C.red;return(<svg width={sz} height={sz}><circle cx={cx} cy={cy} r={r} fill="none" stroke="#232b3d" strokeWidth={sw}/><circle cx={cx} cy={cy} r={r} fill="none" stroke="#c8f700" strokeWidth={sw} strokeDasharray={`${circ*pct} ${circ}`} strokeDashoffset={circ*0.25} strokeLinecap="round"/><circle cx={cx} cy={cy} r={ri} fill="none" stroke="#161d2b" strokeWidth={sw*0.7}/>{lastRtPct!==null&&<circle cx={cx} cy={cy} r={ri} fill="none" stroke={rtColor} strokeWidth={sw*0.7} strokeDasharray={`${circi*lastRtPct} ${circi}`} strokeDashoffset={circi*0.25} strokeLinecap="round" style={{transition:"stroke-dasharray 0.2s,stroke 0.2s"}}/>}<text x={cx} y={cy+sz*0.055} textAnchor="middle" fill={C.text} fontSize={sz*0.155} fontWeight={700}>{score}</text></svg>);}

export function Game4({onBack,onFinish}){
  const mobile=useRef(isTouchDevice()).current;
  const G=useRef(mobile?GEO_MOBILE:GEO_DESKTOP).current;
  const LINE_TOP=G.H*0.2, LINE_BOT=G.H*0.78, RING_CX=G.W/2, RING_CY=G.H/2;

  const[paused,setPaused]=useState(false);const pausedRef=useRef(false);
  const[flankerL,setFlankerL]=useState("left");const[flankerR,setFlankerR]=useState("right");const[middle,setMiddle]=useState("right");
  const[lineY,setLineY]=useState(LINE_TOP);const[visible,setVisible]=useState(false);const[distractor,setDistractor]=useState(null);
  const[spark,setSpark]=useState(false);const[feedback,setFeedback]=useState(null);const[score,setScore]=useState(0);
  const[batchIdx,setBatchIdx]=useState(0);const[trialInBatch,setTrialInBatch]=useState(0);const[lastRtPct,setLastRtPct]=useState(null);
  const[batchSummary,setBatchSummary]=useState(null);
  const playing=useRef(true);const awaiting=useRef(false);const midRef=useRef("right");const trialStart=useRef(0);
  const st=useRef({score:0,batchIdx:0,trialInBatch:0,batchRts:[],batchCorrect:0,batchStats:[]});
  const tTimer=useRef(null);const aTimer=useRef(null);const handlerRef=useRef(null);

  function spawnTrial(){
    if(!playing.current)return;
    const s=st.current;
    const fl=Math.random()<0.5?"left":"right",fr=Math.random()<0.5?"left":"right",mid=Math.random()<0.5?"left":"right";
    const y=Math.random()<0.5?LINE_TOP:LINE_BOT;
    midRef.current=mid;setFlankerL(fl);setFlankerR(fr);setMiddle(mid);setLineY(y);setFeedback(null);setSpark(false);
    const useD=s.batchIdx>=G4_DIST_FROM&&Math.random()<G4_DIST_CHANCE;
    if(useD){
      const dx=Math.random()<0.5?G.W*0.15:G.W*0.85,dy=y===LINE_TOP?LINE_BOT:LINE_TOP;
      setDistractor({x:dx,y:dy});setVisible(false);clearTimeout(tTimer.current);
      tTimer.current=setTimeout(()=>{setDistractor(null);setVisible(true);trialStart.current=performance.now();awaiting.current=true;tTimer.current=setTimeout(()=>tooSlow(),G4_WINDOW);},G4_DIST_MS);
    } else {
      setDistractor(null);setVisible(true);trialStart.current=performance.now();awaiting.current=true;
      clearTimeout(tTimer.current);tTimer.current=setTimeout(()=>tooSlow(),G4_WINDOW);
    }
  }
  function tooSlow(){if(!awaiting.current)return;awaiting.current=false;setVisible(false);setLastRtPct(null);setFeedback({correct:false,pts:0,tooSlow:true});advance(false,G4_WINDOW);}

  function handleAnswer(side){
    if(!playing.current||!awaiting.current||pausedRef.current)return;
    awaiting.current=false;clearTimeout(tTimer.current);
    const rt=performance.now()-trialStart.current;
    const correct=side===midRef.current;
    setVisible(false);if(correct)setSpark(true);
    const pts=correct?Math.max(0,Math.round(G4_MAX_PTS*(1-rt/G4_MAX_RT))):0;
    setFeedback({correct,pts,rt:Math.round(rt),tooSlow:false});
    advance(correct,rt);
  }
  handlerRef.current=handleAnswer;

  function advance(correct,rt){
    const s=st.current;s.trialInBatch++;
    if(correct){
      s.batchRts.push(rt);s.batchCorrect++;
      const pts=Math.max(0,Math.round(G4_MAX_PTS*(1-rt/G4_MAX_RT)));s.score+=pts;setScore(s.score);
      setLastRtPct(Math.max(0,1-rt/G4_MAX_RT));
    } else setLastRtPct(null);
    setTrialInBatch(s.trialInBatch);
    if(s.trialInBatch>=G4_TPB){
      const avgRt=s.batchRts.length?Math.round(s.batchRts.reduce((a,b)=>a+b,0)/s.batchRts.length):null;
      const bs={avgRt,correct:s.batchCorrect,trials:G4_TPB};s.batchStats.push(bs);
      clearTimeout(tTimer.current);playing.current=false;
      if(s.batchIdx>=G4_BATCHES-1){
        const allRts=s.batchStats.flatMap(b=>b.avgRt?[b.avgRt]:[]);
        const totalCorrect=s.batchStats.reduce((a,b)=>a+b.correct,0);
        const bestRt=allRts.length?Math.min(...allRts):null;
        const avg=allRts.length?Math.round(allRts.reduce((a,b)=>a+b,0)/allRts.length):0;
        const acc=Math.round(totalCorrect/G4_TOTAL*100);
        const improvement=s.batchStats.length>=2&&s.batchStats[0].avgRt&&s.batchStats[s.batchStats.length-1].avgRt?s.batchStats[0].avgRt-s.batchStats[s.batchStats.length-1].avgRt:0;
        const rating=scoreG4({acc,avgRt:avg});
        saveSession(LS.g4,{date:new Date().toLocaleDateString(),score:rating,bestRt,avgRt:avg,acc,improvement});
        onFinish({score:rating,label:`Rating: ${rating} / 1000`,detail:`Accuracy ${acc}% · Avg RT ${avg?avg+"ms":"—"} · Best batch ${bestRt?bestRt+"ms":"—"}`,raw:{score:rating,bestRt,avgRt:avg,acc,improvement}});
        return;
      }
      setBatchSummary({...bs,batchNum:s.batchIdx+1,prev:s.batchStats[s.batchStats.length-2]||null});
    } else {
      clearTimeout(aTimer.current);
      aTimer.current=setTimeout(()=>{setSpark(false);if(playing.current)spawnTrial();},G4_FB_MS);
    }
  }

  useEffect(()=>{
    const onKey=e=>{
      if(e.key==="Escape"){pausedRef.current=!pausedRef.current;setPaused(p=>!p);return;}
      if(e.key!=="0"&&e.key!=="1")return;
      e.preventDefault();handlerRef.current(e.key==="0"?"left":"right");
    };
    window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);
  },[]);
  useEffect(()=>{setTimeout(()=>spawnTrial(),400);return()=>{playing.current=false;clearTimeout(tTimer.current);clearTimeout(aTimer.current);};},[]);

  function advanceBatch(){const s=st.current;s.batchIdx++;s.trialInBatch=0;s.batchRts=[];s.batchCorrect=0;setBatchIdx(s.batchIdx);setTrialInBatch(0);setBatchSummary(null);playing.current=true;spawnTrial();}
  const positions=[-2,-1,0,1,2].map(i=>G.W/2+i*G.gap);
  const totalProgress=(st.current.batchIdx*G4_TPB+trialInBatch)/G4_TOTAL;

  if(batchSummary){
    const faster=batchSummary.prev&&batchSummary.avgRt&&batchSummary.avgRt<batchSummary.prev.avgRt;
    const diff=batchSummary.prev&&batchSummary.avgRt&&batchSummary.prev.avgRt?Math.abs(batchSummary.avgRt-batchSummary.prev.avgRt):null;
    return(<div style={{minHeight:"100dvh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:C.text,padding:20}}>
      <div style={{maxWidth:400,width:"100%",textAlign:"center"}}>
        <h2 style={{color:C.text,fontSize:21,fontWeight:700,marginBottom:4}}>Batch {batchSummary.batchNum} complete</h2>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,margin:"16px 0 20px"}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 8px"}}><div style={{color:C.faint,fontSize:9.5,letterSpacing:1.2,fontWeight:700,marginBottom:4}}>AVG RT</div><div style={{color:C.accent,fontSize:23,fontWeight:700}}>{batchSummary.avgRt?batchSummary.avgRt+"ms":"—"}</div></div>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 8px"}}><div style={{color:C.faint,fontSize:9.5,letterSpacing:1.2,fontWeight:700,marginBottom:4}}>ACCURACY</div><div style={{color:C.green,fontSize:23,fontWeight:700}}>{Math.round(batchSummary.correct/batchSummary.trials*100)}%</div></div>
        </div>
        {batchSummary.prev&&diff&&<div style={{background:faster?"#0b1811":"#1a1013",border:`1px solid ${faster?"#2c5a3c":"#5a2f34"}`,borderRadius:12,padding:"13px",marginBottom:18}}><p style={{color:faster?C.green:C.red,fontSize:14,fontWeight:700,margin:0}}>{faster?`${diff}ms faster than last batch`:`${diff}ms slower than last batch`}</p></div>}
        <button onClick={advanceBatch} style={{background:C.accent,color:"#060a12",border:"none",borderRadius:11,padding:"0 32px",minHeight:50,fontSize:15,fontWeight:700,cursor:"pointer",touchAction:"manipulation"}}>Continue</button>
      </div>
    </div>);
  }

  const stats=[
    {label:"SCORE",value:score,color:C.accent},
    {label:"BATCH",value:`${batchIdx+1}`,sub:"/5",color:C.purple},
    {label:"TRIAL",value:`${trialInBatch}`,sub:`/${G4_TPB}`,color:C.text},
  ];
  if(!mobile)stats.push({label:"UNDER",value:`${G4_MAX_RT}ms`,color:C.amber});
  const pause=()=>{pausedRef.current=true;setPaused(true);};

  const board=(
    <svg viewBox={`0 0 ${G.W} ${G.H}`} width="100%" height={mobile?"100%":G.H}
      preserveAspectRatio="xMidYMid meet"
      style={{display:"block",background:C.bg,border:mobile?"none":`1px solid ${C.border}`,borderRadius:mobile?0:10}}>
      {distractor&&<GearDist4 x={distractor.x} y={distractor.y} R={G.dist}/>}
      {visible&&<>
        <line x1={positions[0]-G.arrow*0.6} y1={lineY} x2={positions[4]+G.arrow*0.6} y2={lineY} stroke="#5ecef7" strokeWidth={2} opacity={0.5}/>
        {positions.map((x,i)=>{const d=[flankerL,flankerL,middle,flankerR,flankerR][i];return<g key={i} transform={`translate(${x-G.arrow/2},${lineY-G.arrow/2})`}><Arrow4 dir={d} faded={i!==2} size={G.arrow} spark={i===2&&spark}/></g>;})}
      </>}
      {feedback&&<text x={G.W/2} y={lineY+(lineY<RING_CY?G.fbOff:-G.fbOff*0.8)} textAnchor="middle" fill={feedback.correct?C.green:feedback.tooSlow?C.faint:C.red} fontSize={G.fbSize} fontWeight={700}>{feedback.correct?`+${feedback.pts}  ${feedback.rt}ms`:feedback.tooSlow?"TOO SLOW":"WRONG"}</text>}
      <g transform={`translate(${RING_CX-G.ring/2},${RING_CY-G.ring/2})`}><Ring4 pct={totalProgress} score={score} lastRtPct={lastRtPct} sz={G.ring}/></g>
    </svg>
  );
  const zone=side=>({
    position:"absolute",top:0,height:"100%",width:"50%",[side]:0,
    display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:6,boxSizing:"border-box",
    cursor:mobile?"pointer":"default",touchAction:"manipulation",
    WebkitTapHighlightColor:"transparent",zIndex:2,
  });

  // ── Mobile: fill the screen.
  if(mobile)return(
    <LandscapeGuard>
      <div style={{height:"100dvh",width:"100vw",background:C.bg,display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:"'Segoe UI',sans-serif",color:C.text,userSelect:"none"}}>
        {paused&&<PauseOverlay onResume={()=>{pausedRef.current=false;setPaused(false);}} onHub={onBack}/>}
        <div style={{flexShrink:0,padding:"6px 10px"}}>
          <GameBar compact onPause={pause} stats={stats}/>
        </div>
        <div style={{flex:1,minHeight:0,position:"relative"}}>
          {board}
          <div onPointerDown={e=>{e.preventDefault();handleAnswer("left");}} style={zone("left")}>
            <span style={{color:C.faint,fontSize:13,fontWeight:700,letterSpacing:2}}>◀ LEFT</span>
          </div>
          <div onPointerDown={e=>{e.preventDefault();handleAnswer("right");}} style={zone("right")}>
            <span style={{color:C.faint,fontSize:13,fontWeight:700,letterSpacing:2}}>RIGHT ▶</span>
          </div>
        </div>
      </div>
    </LandscapeGuard>
  );

  // ── Desktop: the original fixed board, unchanged.
  return(
    <LandscapeGuard>
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:C.text,gap:14,padding:20,userSelect:"none"}}>
        {paused&&<PauseOverlay onResume={()=>{pausedRef.current=false;setPaused(false);}} onHub={onBack}/>}
        <div style={{width:G.W}}>
          <GameBar label="SYNCHRONIZE" onPause={pause} stats={stats}/>
        </div>
        <div style={{position:"relative",width:G.W}}>
          {board}
          <div onPointerDown={e=>{e.preventDefault();handleAnswer("left");}} style={zone("left")}/>
          <div onPointerDown={e=>{e.preventDefault();handleAnswer("right");}} style={zone("right")}/>
        </div>
        <p style={{color:C.muted,fontSize:12.5,margin:0,textAlign:"center"}}>
          Middle arrow only. <span style={{color:C.text,fontWeight:700}}>0</span> for left, <span style={{color:C.text,fontWeight:700}}>1</span> for right.
        </p>
      </div>
    </LandscapeGuard>
  );
}
