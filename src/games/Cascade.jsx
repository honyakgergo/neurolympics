import { useState, useEffect, useRef } from "react";
import { Btn } from "../components/Btn.jsx";
import { GameBar } from "../components/GameBar.jsx";
import { IconCascade } from "../components/Icons.jsx";
import { PauseOverlay } from "../components/PauseOverlay.jsx";
import { scoreCascade } from "../lib/scoring.js";
import { LS, saveSession } from "../lib/storage.js";
import { C } from "../lib/theme.js";
import { nextStep } from "./cascadeOps.js";

// Cascade — one running number, two branches per step, pick the better one.
// Objective is the highest final number, so every step is a comparison you have
// to actually compute. Roughly one step in five is a trap where the bigger
// number now leaves you worse off next move.

const CHAINS=5, STEPS=8, STEP_MS=10000, FLASH_MS=950, TRAP_RATE=0.22;
const STARTS=[24,32,36,40,48,60,72,80,90,120];
const median=a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);const m=s.length>>1;return s.length%2?s[m]:Math.round((s[m-1]+s[m])/2);};
const fmt=v=>Math.round(v).toLocaleString("en-US");

export function Cascade({onBack,onFinish}){
  const[screen,setScreen]=useState("intro");   // intro | play | chainEnd
  const[paused,setPaused]=useState(false);
  const[n,setN]=useState(0);
  const[step,setStep]=useState(null);
  const[chainIdx,setChainIdx]=useState(0);
  const[stepIdx,setStepIdx]=useState(0);
  const[flash,setFlash]=useState(null);        // {picked, timeout, correct}
  const[msLeft,setMsLeft]=useState(STEP_MS);
  const[chainLog,setChainLog]=useState([]);
  const[chainStart,setChainStart]=useState(0);

  const pausedRef=useRef(false);
  const tickRef=useRef(null);
  const flashRef=useRef(null);
  const deadline=useRef(0);
  const remaining=useRef(STEP_MS);
  const answering=useRef(false);
  const lastTrap=useRef(false);
  const nRef=useRef(0);
  const stepRef=useRef(null);
  const stepIdxRef=useRef(0);
  const st=useRef({retained:1,correct:0,total:0,times:[],trapA:0,trapC:0,finals:[]});

  const clear=()=>{clearInterval(tickRef.current);clearTimeout(flashRef.current);};

  function armTimer(ms){
    clearInterval(tickRef.current);
    remaining.current=ms;deadline.current=performance.now()+ms;setMsLeft(ms);
    tickRef.current=setInterval(()=>{
      if(pausedRef.current)return;
      const left=deadline.current-performance.now();
      remaining.current=left;setMsLeft(Math.max(0,left));
      if(left<=0){clearInterval(tickRef.current);commit(null);}
    },80);
  }

  function loadStep(value,idx){
    const allowTrap=!lastTrap.current&&Math.random()<TRAP_RATE;
    const s=nextStep(value,{allowTrap});
    if(!s){endChain(value);return;}
    lastTrap.current=s.trap;
    nRef.current=value;stepRef.current=s;stepIdxRef.current=idx;
    setN(value);setStep(s);setStepIdx(idx);setFlash(null);
    answering.current=true;
    armTimer(STEP_MS);
  }

  // picked === null means the clock ran out, which takes the worse branch.
  function commit(picked){
    if(!answering.current)return;
    answering.current=false;
    clearInterval(tickRef.current);
    const s=stepRef.current;
    const timeout=picked===null;
    const idx=timeout?(s.bestIndex===0?1:0):picked;
    const correct=!timeout&&idx===s.bestIndex;
    const bestMetric=s.metrics[s.bestIndex];
    const ratio=bestMetric>0?s.metrics[idx]/bestMetric:1;
    const ms=timeout?STEP_MS:STEP_MS-Math.max(0,remaining.current);

    const a=st.current;
    a.total++;a.retained*=ratio;a.times.push(ms);
    if(correct)a.correct++;
    if(s.trap){a.trapA++;if(correct)a.trapC++;}

    setFlash({picked:idx,timeout,correct});
    setChainLog(l=>[...l,{
      from:nRef.current,labels:s.options.map(o=>o.label),values:s.options.map(o=>o.value),
      picked:idx,best:s.bestIndex,trap:s.trap,timeout,ratio,
    }]);

    const value=s.options[idx].value;
    flashRef.current=setTimeout(()=>{
      if(stepIdxRef.current+1>=STEPS)endChain(value);
      else loadStep(value,stepIdxRef.current+1);
    },FLASH_MS);
  }

  function endChain(finalValue){
    clear();
    st.current.finals.push(finalValue);
    setN(finalValue);setStep(null);setScreen("chainEnd");
  }
  function startChain(i){
    const start=STARTS[Math.floor(Math.random()*STARTS.length)];
    lastTrap.current=false;
    setChainIdx(i);setChainStart(start);setChainLog([]);setScreen("play");
    loadStep(start,0);
  }
  function startSession(){
    st.current={retained:1,correct:0,total:0,times:[],trapA:0,trapC:0,finals:[]};
    startChain(0);
  }
  function nextChain(){
    if(chainIdx+1>=CHAINS){endSession();return;}
    startChain(chainIdx+1);
  }
  function endSession(){
    clear();
    const a=st.current;
    const accuracy=a.total?a.correct/a.total:0;
    const retained=a.retained;
    const medianMs=median(a.times.map(Math.round));
    const rating=scoreCascade({retained,accuracy,medianMs});
    saveSession(LS.cascade,{
      date:new Date().toLocaleDateString(),score:rating,
      retained:Math.round(retained*100),accuracy:Math.round(accuracy*100),
      medianMs,steps:a.total,trapA:a.trapA,trapC:a.trapC,
      bestFinal:a.finals.length?Math.max(...a.finals):0,
    });
    onFinish({
      score:rating,label:`Rating: ${rating} / 1000`,
      detail:`Better branch ${Math.round(accuracy*100)}% of the time · ${Math.round(retained*100)}% of perfect-play value kept · ${(medianMs/1000).toFixed(1)}s per step`,
      raw:{score:rating,retained:Math.round(retained*100),accuracy:Math.round(accuracy*100),medianMs,trapA:a.trapA,trapC:a.trapC},
    });
  }

  function togglePause(){
    if(screen!=="play"&&screen!=="chainEnd")return;
    const p=!pausedRef.current;pausedRef.current=p;setPaused(p);
    if(!p&&answering.current)armTimer(Math.max(1200,remaining.current));
  }
  useEffect(()=>{
    const h=e=>{if(e.key==="Escape"){togglePause();return;}
      if(screen!=="play"||pausedRef.current||!answering.current)return;
      if(e.key==="1"||e.key==="ArrowLeft"){e.preventDefault();commit(0);}
      if(e.key==="2"||e.key==="ArrowRight"){e.preventDefault();commit(1);}
    };
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[screen,stepIdx]);
  useEffect(()=>()=>clear(),[]);

  const shell=(children,center)=>(
    <div style={{minHeight:"100dvh",background:C.bg,fontFamily:"'Segoe UI',sans-serif",color:C.text,padding:"18px 14px 34px",display:"flex",justifyContent:"center",alignItems:center?"center":"flex-start"}}>
      <div style={{maxWidth:520,width:"100%",display:"flex",flexDirection:"column",gap:16,alignItems:"center"}}>{children}</div>
    </div>
  );
  const card={background:C.surface,border:`1px solid ${C.border}`,borderRadius:15,padding:18,boxSizing:"border-box",width:"100%"};

  // ── Intro ────────────────────────────────────────────────────────────────
  if(screen==="intro")return shell(<>
    <div style={{textAlign:"center"}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><IconCascade size={58}/></div>
      <h1 style={{fontSize:23,fontWeight:700,color:C.text,margin:"0 0 5px"}}>Cascade</h1>
      <p style={{color:C.amber,fontSize:10.5,letterSpacing:1.6,fontWeight:700,margin:0}}>BRANCHING ARITHMETIC</p>
    </div>
    <div style={card}>
      <p style={{color:C.muted,fontSize:13.5,lineHeight:1.75,margin:"0 0 14px"}}>
        You hold one number. Each step offers two operations. Pick the one that leaves you with more, and keep going.
      </p>
      <div style={{background:C.dim,borderRadius:11,padding:14,fontFamily:"monospace",fontSize:13,lineHeight:2}}>
        <div style={{color:C.faint,fontSize:11,fontFamily:"'Segoe UI',sans-serif",letterSpacing:1,marginBottom:6}}>YOU HOLD 48</div>
        <div><span style={{color:C.muted}}>× 3/8 →</span> <span style={{color:C.red,fontWeight:700}}>18</span></div>
        <div><span style={{color:C.muted}}>× 5/12 →</span> <span style={{color:C.green,fontWeight:700}}>20</span></div>
      </div>
      <p style={{color:C.muted,fontSize:13,lineHeight:1.75,margin:"14px 0 0"}}>
        Fractions always divide cleanly and the two branches always land close together, so both have to be worked out properly. {CHAINS} chains of {STEPS} steps, ten seconds each. Running out of time takes the worse branch.
      </p>
    </div>
    <div style={{...card,background:"#0b1119"}}>
      <p style={{color:C.amber,fontSize:10,letterSpacing:1.6,fontWeight:700,margin:"0 0 8px"}}>THE TRAP STEPS</p>
      <p style={{color:C.muted,fontSize:13,lineHeight:1.75,margin:0}}>
        About one step in five, the bigger number now leaves you with awkward divisors and the smaller one opens a better multiplier next move. Those are flagged in the review after each chain, never before.
      </p>
    </div>
    <div style={{...card}}>
      <p style={{color:C.faint,fontSize:10,letterSpacing:1.6,fontWeight:700,margin:"0 0 8px"}}>SCORED ON</p>
      <p style={{color:C.muted,fontSize:13,lineHeight:1.85,margin:0}}>
        How much of the perfect-play value you keep, compounded across every step, weighted heaviest. Then your better-branch rate, then pace. Keyboard: <span style={{color:C.text,fontWeight:700}}>1</span> and <span style={{color:C.text,fontWeight:700}}>2</span>, or the arrow keys.
      </p>
    </div>
    <Btn onClick={startSession} full>Start</Btn>
    <Btn onClick={onBack} secondary full>Back to hub</Btn>
  </>);

  const a=st.current;
  const accSoFar=a.total?Math.round(a.correct/a.total*100):null;

  // ── Chain review ─────────────────────────────────────────────────────────
  if(screen==="chainEnd"){
    const last=chainIdx+1>=CHAINS;
    const clean=chainLog.filter(x=>x.picked===x.best).length;
    return shell(<>
      {paused&&<PauseOverlay onResume={togglePause} onHub={onBack}/>}
      <GameBar label="CASCADE" accent={C.amber} onPause={togglePause} stats={[
        {label:"CHAIN",value:`${chainIdx+1}`,sub:`/${CHAINS}`,color:C.text},
        {label:"FINAL",value:fmt(n),color:C.amber},
        {label:"ON BEST",value:`${clean}`,sub:`/${chainLog.length}`,color:C.green},
      ]}/>
      <div style={card}>
        <p style={{color:C.faint,fontSize:10,letterSpacing:1.6,fontWeight:700,margin:"0 0 12px"}}>CHAIN {chainIdx+1} REVIEW · STARTED AT {chainStart}</p>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {chainLog.map((x,i)=>{
            const ok=x.picked===x.best;
            return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:ok?"transparent":"#1a1016",border:`1px solid ${ok?"transparent":"#4a2b34"}`,borderRadius:9,padding:"8px 10px"}}>
                <span style={{color:C.faint,fontSize:11,width:16,flexShrink:0,fontVariantNumeric:"tabular-nums"}}>{i+1}</span>
                <span style={{color:C.faint,fontSize:12,width:44,flexShrink:0,fontVariantNumeric:"tabular-nums"}}>{fmt(x.from)}</span>
                <span style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
                  {[0,1].map(k=>(
                    <span key={k} style={{fontSize:12,color:k===x.best?C.green:C.muted,fontWeight:k===x.best?700:400}}>
                      {x.labels[k]} → {fmt(x.values[k])}
                      {k===x.picked&&<span style={{color:ok?C.green:C.red,fontWeight:700}}> ← you{x.timeout?" (timed out)":""}</span>}
                    </span>
                  ))}
                </span>
                {x.trap&&<span style={{color:C.amber,fontSize:9,fontWeight:700,letterSpacing:0.6,border:`1px solid ${C.amber}55`,borderRadius:6,padding:"3px 6px",flexShrink:0}}>TRAP</span>}
              </div>
            );
          })}
        </div>
        <p style={{color:C.muted,fontSize:12,lineHeight:1.7,margin:"14px 0 0",paddingTop:12,borderTop:`1px solid ${C.border}`}}>
          Keeping {Math.round(a.retained*100)}% of perfect-play value across {a.total} steps so far.
          {a.trapA>0&&` Trap steps: ${a.trapC}/${a.trapA}.`}
        </p>
      </div>
      <Btn onClick={nextChain} full>{last?"Finish session":"Next chain"}</Btn>
    </>);
  }

  // ── Playing ──────────────────────────────────────────────────────────────
  const frac=Math.max(0,msLeft/STEP_MS);
  const urgent=frac<0.3;
  return shell(<>
    {paused&&<PauseOverlay onResume={togglePause} onHub={onBack}/>}
    <GameBar label="CASCADE" accent={C.amber} onPause={togglePause} stats={[
      {label:"CHAIN",value:`${chainIdx+1}`,sub:`/${CHAINS}`,color:C.text},
      {label:"STEP",value:`${stepIdx+1}`,sub:`/${STEPS}`,color:C.text},
      {label:"ON BEST",value:accSoFar===null?"—":`${accSoFar}%`,color:C.green},
    ]}/>

    <div style={{width:"100%",height:5,background:C.dim,borderRadius:3,overflow:"hidden"}}>
      <div style={{width:`${frac*100}%`,height:"100%",background:urgent?C.red:C.amber,borderRadius:3,transition:"width .08s linear"}}/>
    </div>

    <div style={{...card,textAlign:"center",padding:"26px 18px"}}>
      <p style={{color:C.faint,fontSize:10,letterSpacing:2,fontWeight:700,margin:"0 0 8px"}}>YOU HOLD</p>
      <div style={{fontSize:52,fontWeight:700,color:C.text,letterSpacing:-1,lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{fmt(n)}</div>
    </div>

    <div style={{width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
      {step&&step.options.map((o,i)=>{
        const isPicked=flash&&flash.picked===i;
        const isBest=flash&&step.bestIndex===i;
        const border=flash?(isBest?C.green:isPicked?C.red:C.border):C.border;
        const bg=flash?(isBest?"#0d1b13":isPicked?"#1c1014":C.surface):C.surface;
        return(
          <div key={i} onPointerDown={e=>{e.preventDefault();if(!flash&&!paused)commit(i);}}
            onPointerEnter={e=>{if(!flash)e.currentTarget.style.borderColor=C.hover;}}
            onPointerLeave={e=>{if(!flash)e.currentTarget.style.borderColor=C.border;}}
            style={{background:bg,border:`1.5px solid ${border}`,borderRadius:14,padding:"20px 12px",textAlign:"center",
              cursor:flash?"default":"pointer",touchAction:"manipulation",WebkitTapHighlightColor:"transparent",
              minHeight:104,display:"flex",flexDirection:"column",justifyContent:"center",gap:8,transition:"border-color .12s,background .12s"}}>
            <div style={{color:C.faint,fontSize:9,letterSpacing:1.4,fontWeight:700}}>{i===0?"1":"2"}</div>
            <div style={{color:C.text,fontSize:21,fontWeight:700,letterSpacing:-0.3}}>{o.label}</div>
            {flash&&<div style={{color:isBest?C.green:C.muted,fontSize:17,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{fmt(o.value)}</div>}
          </div>
        );
      })}
    </div>

    <p style={{color:flash?(flash.correct?C.green:C.red):C.faint,fontSize:13,fontWeight:flash?700:400,margin:0,minHeight:20,textAlign:"center"}}>
      {flash?(flash.timeout?"Out of time — took the worse branch":flash.correct?"Better branch":"Wrong branch"):"Which one leaves you with more?"}
    </p>
  </>);
}
