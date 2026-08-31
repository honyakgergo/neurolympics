import { useState, useEffect, useRef, useCallback } from "react";
import { LandscapeGuard } from "../components/LandscapeGuard.jsx";
import { GameBar } from "../components/GameBar.jsx";
import { PauseOverlay } from "../components/PauseOverlay.jsx";
import { scoreG3 } from "../lib/scoring.js";
import { LS, saveSession } from "../lib/storage.js";
import { C } from "../lib/theme.js";

// Game 3 — Connect (control / speed)
// Desktop: 0 = left, 1 = right. Touch: the left and right halves of the screen
// are the two buttons, so the game needs landscape.
const G3_MAX_RT=1200,G3_MAX_PTS=500,G3_FEEDBACK_MS=450,G3_VISIBLE_START=1000,G3_VISIBLE_MIN=300;
const W3=520,H3=380,R3=35;
function GearShape3({color,r=28,glow=false,pulse=false}){const teeth=11,outer=r,inner=r*0.72,cx=r,cy=r;const pts=Array.from({length:teeth*2},(_,i)=>{const a=(i*Math.PI)/teeth-Math.PI/2,rad=i%2===0?outer:inner;return`${cx+rad*Math.cos(a)},${cy+rad*Math.sin(a)}`;}).join(" ");return(<g>{glow&&<polygon points={pts} fill={color} opacity={0.2} transform={`scale(1.2) translate(${-cx*0.2},${-cy*0.2})`}/>}{pulse&&<polygon points={pts} fill={color} opacity={0.15} transform={`scale(1.4) translate(${-cx*0.4},${-cy*0.4})`}/>}<polygon points={pts} fill={color} opacity={0.95}/><circle cx={cx} cy={cy} r={r*0.3} fill="white" opacity={0.88}/></g>);}
function ConnectLine({x1,y1,x2,y2,color,progress}){const dx=x2-x1,dy=y2-y1,ex=x1+dx*progress,ey=y1+dy*progress;return<line x1={x1} y1={y1} x2={ex} y2={ey} stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.85}/>;}
const G3C={red:"#e74c3c",blue:"#5ecef7"};

export function Game3({onBack,onFinish}){
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

  // One entry point for both the keyboard and the touch zones.
  const handleAnswer=useCallback(side=>{ // side: "left" | "right"
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

  const leftPos={x:70,y:190},rightPos={x:W3-70,y:190},midPos={x:W3/2,y:110};
  const connColor=connecting?(connecting.from==="right"?G3C[rightColor]:G3C[leftColor]):null;
  const connFrom=connecting?.from==="right"?rightPos:leftPos;
  const zone=side=>({
    position:"absolute",top:0,height:"100%",width:"50%",[side==="left"?"left":"right"]:0,
    display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:10,
    background:"transparent",cursor:"pointer",touchAction:"manipulation",
    WebkitTapHighlightColor:"transparent",zIndex:2,boxSizing:"border-box",
  });

  return(
    <LandscapeGuard>
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:C.text,padding:12,gap:10,userSelect:"none"}}>
      {paused&&<PauseOverlay onResume={()=>{pausedRef.current=false;setPaused(false);}} onHub={onBack}/>}
      <div style={{width:"min(560px,96vw)"}}>
        <GameBar label="CONNECT" onPause={()=>{pausedRef.current=true;setPaused(true);}} stats={[
          {label:"SCORE",value:score,color:C.accent},
          {label:"TIME",value:`${timeLeft}s`,color:timeLeft<=10?C.red:C.text},
          {label:"TRIAL",value:trialNum,color:C.purple},
        ]}/>
      </div>

      <div style={{position:"relative",width:"min(560px,96vw)",maxWidth:`calc(64vh * ${W3} / ${H3})`}}>
        <svg viewBox={`0 0 ${W3} ${H3}`} width="100%" style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,display:"block"}}>
          <line x1={W3/2} y1={0} x2={W3/2} y2={H3} stroke={C.border} strokeWidth={1} strokeDasharray="5 6"/>
          {connecting&&connColor&&<ConnectLine x1={connFrom.x} y1={connFrom.y} x2={midPos.x} y2={midPos.y} color={connColor} progress={connecting.progress}/>}
          <g transform={`translate(${leftPos.x-R3},${leftPos.y-R3})`}><GearShape3 color={G3C[leftColor]} r={R3} glow/></g>
          <text x={leftPos.x} y={leftPos.y+R3+20} textAnchor="middle" fill={C.muted} fontSize={13} fontWeight="700">[0]</text>
          <g transform={`translate(${rightPos.x-R3},${rightPos.y-R3})`}><GearShape3 color={G3C[rightColor]} r={R3} glow/></g>
          <text x={rightPos.x} y={rightPos.y+R3+20} textAnchor="middle" fill={C.muted} fontSize={13} fontWeight="700">[1]</text>
          {middleColor&&<g transform={`translate(${midPos.x-R3},${midPos.y-R3})`}><GearShape3 color={G3C[middleColor]} r={R3} glow pulse/></g>}
          {feedback&&<g>
            <text x={W3/2} y={midPos.y-R3-14} textAnchor="middle" fill={feedback.correct?C.green:feedback.tooSlow?C.faint:C.red} fontSize={17} fontWeight={700}>{feedback.correct?`+${feedback.pts}`:feedback.tooSlow?"TOO SLOW":"WRONG"}</text>
            {feedback.rt&&<text x={W3/2} y={midPos.y-R3-34} textAnchor="middle" fill={C.muted} fontSize={13}>{feedback.rt}ms</text>}
          </g>}
        </svg>
        <div onPointerDown={e=>{e.preventDefault();handleAnswer("left");}} style={zone("left")}>
          <div style={{color:C.muted,fontSize:11.5,letterSpacing:2,fontWeight:700}}>TAP LEFT</div>
        </div>
        <div onPointerDown={e=>{e.preventDefault();handleAnswer("right");}} style={zone("right")}>
          <div style={{color:C.muted,fontSize:11.5,letterSpacing:2,fontWeight:700}}>TAP RIGHT</div>
        </div>
      </div>

      <p style={{color:C.muted,fontSize:12,margin:0,textAlign:"center",maxWidth:460}}>Match the middle gear to the side sharing its colour. Keyboard <span style={{color:C.text,fontWeight:700}}>0</span> and <span style={{color:C.text,fontWeight:700}}>1</span>, or tap either half of the board.</p>
    </div>
    </LandscapeGuard>
  );
}
