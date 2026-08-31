import { useState, useEffect, useRef, useCallback } from "react";
import { LandscapeGuard, isTouchDevice } from "../components/LandscapeGuard.jsx";
import { GameBar } from "../components/GameBar.jsx";
import { PauseOverlay } from "../components/PauseOverlay.jsx";
import { scoreG3 } from "../lib/scoring.js";
import { LS, saveSession } from "../lib/storage.js";
import { C } from "../lib/theme.js";

// Game 3 — Connect (control / speed)
// Desktop: fixed-size board, 0 = left and 1 = right on the keyboard.
// Touch: a wide board sized for a landscape phone, tap either half of the
// screen. Geometry is picked once at mount, because coordinates live in state.
const G3_MAX_RT=1200,G3_MAX_PTS=500,G3_FEEDBACK_MS=450,G3_VISIBLE_START=1000,G3_VISIBLE_MIN=300;

// Desktop keeps the original 520x380 board. Mobile uses a 2.2:1 board that
// matches a landscape handset, so the screen is actually filled.
const GEO_DESKTOP={W:520,H:380,R:35,left:{x:60,y:160},right:{x:460,y:160},mid:{x:260,y:100},fbSize:16,rtSize:12,keySize:11};
const GEO_MOBILE ={W:920,H:420,R:62,left:{x:150,y:250},right:{x:770,y:250},mid:{x:460,y:120},fbSize:30,rtSize:22,keySize:20};

function GearShape3({color,r=28,glow=false,pulse=false}){const teeth=11,outer=r,inner=r*0.72,cx=r,cy=r;const pts=Array.from({length:teeth*2},(_,i)=>{const a=(i*Math.PI)/teeth-Math.PI/2,rad=i%2===0?outer:inner;return`${cx+rad*Math.cos(a)},${cy+rad*Math.sin(a)}`;}).join(" ");return(<g>{glow&&<polygon points={pts} fill={color} opacity={0.2} transform={`scale(1.2) translate(${-cx*0.2},${-cy*0.2})`}/>}{pulse&&<polygon points={pts} fill={color} opacity={0.15} transform={`scale(1.4) translate(${-cx*0.4},${-cy*0.4})`}/>}<polygon points={pts} fill={color} opacity={0.95}/><circle cx={cx} cy={cy} r={r*0.3} fill="white" opacity={0.88}/></g>);}
function ConnectLine({x1,y1,x2,y2,color,progress,width}){const dx=x2-x1,dy=y2-y1,ex=x1+dx*progress,ey=y1+dy*progress;return<line x1={x1} y1={y1} x2={ex} y2={ey} stroke={color} strokeWidth={width} strokeLinecap="round" opacity={0.85}/>;}
const G3C={red:"#e74c3c",blue:"#5ecef7"};

export function Game3({onBack,onFinish}){
  const mobile=useRef(isTouchDevice()).current;
  const G=mobile?GEO_MOBILE:GEO_DESKTOP;

  const[paused,setPaused]=useState(false);const pausedRef=useRef(false);
  const[leftColor,setLeftColor]=useState("red");const[rightColor,setRightColor]=useState("blue");const[middleColor,setMiddleColor]=useState(null);
  const[feedback,setFeedback]=useState(null);const[score,setScore]=useState(0);const[timeLeft,setTimeLeft]=useState(60);const[trialNum,setTrialNum]=useState(0);const[connecting,setConnecting]=useState(null);
  const stRef=useRef({score:0,trials:0,correct:0,totalRt:0,best:9999,wrong:0});
  const timerRef=useRef(null);const trialRef=useRef(null);const animRef=useRef(null);const trialStart=useRef(null);const playing=useRef(true);const currentMiddle=useRef(null);const awaiting=useRef(false);const diffRef=useRef(1);

  const spawnTrial=useCallback((d)=>{
    if(!playing.current)return;
    const swap=Math.random()<0.5;const lc=swap?"blue":"red",rc=swap?"red":"blue",mc=Math.random()<0.5?"red":"blue";
    setLeftColor(lc);setRightColor(rc);setMiddleColor(mc);setConnecting(null);setFeedback(null);
    currentMiddle.current={lc,rc,mc};awaiting.current=true;trialStart.current=performance.now();
    const vis=Math.max(G3_VISIBLE_MIN,G3_VISIBLE_START-d*80);
    clearTimeout(trialRef.current);
    trialRef.current=setTimeout(()=>{
      if(!awaiting.current)return;awaiting.current=false;setMiddleColor(null);
      setFeedback({correct:false,pts:0,tooSlow:true});stRef.current.trials++;setTrialNum(n=>n+1);
      setTimeout(()=>{if(playing.current)spawnTrial(diffRef.current);},G3_FEEDBACK_MS);
    },vis);
  },[]);

  const handleAnswer=useCallback(side=>{
    if(!playing.current||!awaiting.current||pausedRef.current)return;
    awaiting.current=false;clearTimeout(trialRef.current);
    const rt=performance.now()-trialStart.current;
    const{rc,mc}=currentMiddle.current;
    const matchSide=mc===rc?"right":"left";
    const correct=side===matchSide;
    const pts=correct?Math.max(0,Math.round(G3_MAX_PTS*(1-rt/G3_MAX_RT))):0;
    const s=stRef.current;s.trials++;
    if(correct){s.correct++;s.totalRt+=rt;s.score+=pts;if(rt<s.best)s.best=rt;}else s.wrong++;
    setScore(s.score);setFeedback({correct,pts,rt:Math.round(rt),tooSlow:false});setMiddleColor(null);
    if(correct){let prog=0;const animate=()=>{prog=Math.min(1,prog+0.07);setConnecting({from:matchSide,progress:prog});if(prog<1)animRef.current=requestAnimationFrame(animate);};animRef.current=requestAnimationFrame(animate);}
    setTrialNum(n=>n+1);
    setTimeout(()=>{cancelAnimationFrame(animRef.current);setConnecting(null);if(playing.current)spawnTrial(diffRef.current);},G3_FEEDBACK_MS);
  },[spawnTrial]);

  useEffect(()=>{
    const onKey=e=>{
      if(e.key==="Escape"){pausedRef.current=!pausedRef.current;setPaused(p=>!p);return;}
      if(e.key!=="0"&&e.key!=="1")return;
      e.preventDefault();handleAnswer(e.key==="0"?"left":"right");
    };
    window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);
  },[handleAnswer]);

  useEffect(()=>{
    let t=60;
    timerRef.current=setInterval(()=>{
      if(pausedRef.current)return;
      t--;diffRef.current=1+((60-t)/60)*7;setTimeLeft(t);
      if(t<=0){
        playing.current=false;clearInterval(timerRef.current);clearTimeout(trialRef.current);cancelAnimationFrame(animRef.current);setMiddleColor(null);
        const s=stRef.current;
        const avgRt=s.correct>0?Math.round(s.totalRt/s.correct):0;
        const acc=s.trials>0?Math.round(s.correct/s.trials*100):0;
        const rating=scoreG3({acc,avgRt,correct:s.correct});
        saveSession(LS.g3,{date:new Date().toLocaleDateString(),score:rating,avgRt,acc,correct:s.correct,best:s.best<9999?s.best:null});
        onFinish({score:rating,label:`Rating: ${rating} / 1000`,detail:`Accuracy ${acc}% · Avg RT ${avgRt}ms · ${s.correct} correct`,raw:{score:rating,avgRt,acc,best:s.best<9999?s.best:null}});
      }
    },1000);
    setTimeout(()=>spawnTrial(1),600);
    return()=>{playing.current=false;clearInterval(timerRef.current);clearTimeout(trialRef.current);cancelAnimationFrame(animRef.current);};
  },[]);

  const connColor=connecting?(connecting.from==="right"?G3C[rightColor]:G3C[leftColor]):null;
  const connFrom=connecting?.from==="right"?G.right:G.left;
  const stats=[
    {label:"SCORE",value:score,color:C.accent},
    {label:"TIME",value:`${timeLeft}s`,color:timeLeft<=10?C.red:C.text},
    {label:"TRIAL",value:trialNum,color:C.purple},
  ];
  const pause=()=>{pausedRef.current=true;setPaused(true);};

  const board=(
    <svg viewBox={`0 0 ${G.W} ${G.H}`} width="100%" height={mobile?"100%":G.H}
      preserveAspectRatio="xMidYMid meet"
      style={{display:"block",background:C.bg,border:mobile?"none":`1px solid ${C.border}`,borderRadius:mobile?0:10,overflow:"visible"}}>
      {connecting&&connColor&&<ConnectLine x1={connFrom.x} y1={connFrom.y} x2={G.mid.x} y2={G.mid.y} color={connColor} progress={connecting.progress} width={mobile?5:3}/>}
      <g transform={`translate(${G.left.x-G.R},${G.left.y-G.R})`}><GearShape3 color={G3C[leftColor]} r={G.R} glow/></g>
      <text x={G.left.x} y={G.left.y+G.R+G.keySize+8} textAnchor="middle" fill={C.muted} fontSize={G.keySize} fontWeight="700">{mobile?"TAP LEFT":"[0]"}</text>
      <g transform={`translate(${G.right.x-G.R},${G.right.y-G.R})`}><GearShape3 color={G3C[rightColor]} r={G.R} glow/></g>
      <text x={G.right.x} y={G.right.y+G.R+G.keySize+8} textAnchor="middle" fill={C.muted} fontSize={G.keySize} fontWeight="700">{mobile?"TAP RIGHT":"[1]"}</text>
      {middleColor&&<g transform={`translate(${G.mid.x-G.R},${G.mid.y-G.R})`}><GearShape3 color={G3C[middleColor]} r={G.R} glow pulse/></g>}
      {feedback&&<g>
        <text x={G.W/2} y={G.mid.y-G.R-G.rtSize-4} textAnchor="middle" fill={feedback.correct?C.green:feedback.tooSlow?C.faint:C.red} fontSize={G.fbSize} fontWeight={700}>{feedback.correct?`+${feedback.pts}`:feedback.tooSlow?"TOO SLOW":"WRONG"}</text>
        {feedback.rt&&<text x={G.W/2} y={G.mid.y-G.R-G.rtSize-G.fbSize-8} textAnchor="middle" fill={C.muted} fontSize={G.rtSize}>{feedback.rt}ms</text>}
      </g>}
    </svg>
  );
  const zone=side=>({
    position:"absolute",top:0,height:"100%",width:"50%",[side]:0,
    cursor:mobile?"pointer":"default",touchAction:"manipulation",
    WebkitTapHighlightColor:"transparent",zIndex:2,
  });

  // ── Mobile: fill the screen. Slim bar on top, board takes everything else.
  if(mobile)return(
    <LandscapeGuard>
      <div style={{height:"100dvh",width:"100vw",background:C.bg,display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:"'Segoe UI',sans-serif",color:C.text,userSelect:"none"}}>
        {paused&&<PauseOverlay onResume={()=>{pausedRef.current=false;setPaused(false);}} onHub={onBack}/>}
        <div style={{flexShrink:0,padding:"6px 10px"}}>
          <GameBar compact onPause={pause} stats={stats}/>
        </div>
        <div style={{flex:1,minHeight:0,position:"relative"}}>
          {board}
          <div onPointerDown={e=>{e.preventDefault();handleAnswer("left");}} style={zone("left")}/>
          <div onPointerDown={e=>{e.preventDefault();handleAnswer("right");}} style={zone("right")}/>
        </div>
      </div>
    </LandscapeGuard>
  );

  // ── Desktop: the original fixed board, unchanged.
  return(
    <LandscapeGuard>
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:C.text,padding:20,gap:16,userSelect:"none"}}>
        {paused&&<PauseOverlay onResume={()=>{pausedRef.current=false;setPaused(false);}} onHub={onBack}/>}
        <div style={{width:G.W}}>
          <GameBar label="CONNECT" onPause={pause} stats={stats}/>
        </div>
        <div style={{position:"relative",width:G.W}}>
          {board}
          <div onPointerDown={e=>{e.preventDefault();handleAnswer("left");}} style={zone("left")}/>
          <div onPointerDown={e=>{e.preventDefault();handleAnswer("right");}} style={zone("right")}/>
        </div>
        <p style={{color:C.muted,fontSize:12.5,margin:0,textAlign:"center"}}>
          Match the middle gear to the side sharing its colour. <span style={{color:C.text,fontWeight:700}}>0</span> for left, <span style={{color:C.text,fontWeight:700}}>1</span> for right.
        </p>
      </div>
    </LandscapeGuard>
  );
}
