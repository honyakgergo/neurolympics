import { useState, useEffect, useRef } from "react";
import { Btn } from "../components/Btn.jsx";
import { IconOdds } from "../components/Icons.jsx";
import { BENCH, clamp01, scoreNet } from "../lib/scoring.js";
import { LS, saveSession } from "../lib/storage.js";
import { C } from "../lib/theme.js";

// Beat the Odds — probability & EV
const EV_DURATION = 240; // 4-minute rapid-fire round

function parseNum(s){
  s=String(s).trim().replace(/%/g,"").replace(/€/g,"").replace(/\s/g,"").replace(",",".");
  if(!s)return null;
  if(s.includes("/")){const[a,b]=s.split("/").map(Number);return(!isNaN(a)&&!isNaN(b)&&b!==0)?a/b:null;}
  const v=Number(s);return isNaN(v)?null:v;
}

// Beat the Odds — Optiver's rapid probability & expected-value module.
// Every answer is one unambiguous number (a tolerance absorbs rounding).
const EV_PCTS=[[5,20],[10,10],[15,20],[20,5],[25,4],[30,10],[40,5],[50,2],[60,5],[75,4],[80,5]]; // [pct, step] so pct% of (step*k) is integer
const EV_FRACS=[["1/2",50],["1/4",25],["3/4",75],["1/5",20],["2/5",40],["3/5",60],["4/5",80],["1/8",12.5],["3/8",37.5],["5/8",62.5],["7/8",87.5],["1/10",10],["3/10",30],["1/20",5],["1/16",6.25]];
const EV_ODDS=[[1,1,50],[1,3,25],[3,1,75],[1,4,20],[4,1,80],[2,3,40],[3,2,60],[1,9,10],[9,1,90]]; // [stake, profit, break-even %]
const EV_DICESUM=[[7,16.7],[6,13.9],[8,13.9],[5,11.1],[9,11.1],[4,8.3],[10,8.3],[3,5.6],[11,5.6],[2,2.8],[12,2.8]];

function genEVQ(p){
  const r=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
  const pool=[
    ["PCT",     1.2-0.4*p],
    ["COMP",    0.8-0.5*p],
    ["FRACPCT", 1.0],
    ["DIEEV",   0.7],
    ["EVBET",   0.3+0.9*p],
    ["IMPLIED", 0.3+0.8*p],
    ["DICESUM", 0.2+0.7*p],
    ["COINRUN", 0.2+0.5*p],
  ];
  const total=pool.reduce((s,[,w])=>s+Math.max(0,w),0);
  let x=Math.random()*total,cat=pool[0][0];
  for(const [c,w] of pool){ x-=Math.max(0,w); if(x<=0){cat=c;break;} }
  if(cat==="PCT"){ const [a,step]=pick(EV_PCTS); const b=step*r(2,Math.round(4+p*14)); return{q:`What is ${a}% of ${b}?`,ans:a/100*b,tol:0,fmt:"a number",cat}; }
  if(cat==="COMP"){ const x0=pick([10,15,20,25,30,35,40,60,70,75,80]); return{q:`An event happens with probability ${x0}%. What is the chance it does NOT happen?`,ans:100-x0,tol:0,fmt:"a %",cat}; }
  if(cat==="FRACPCT"){ const [f,pct]=pick(EV_FRACS); return{q:`Express ${f} as a percentage.`,ans:pct,tol:0.1,fmt:"a %",cat}; }
  if(cat==="DIEEV"){ const n=pick([4,6,8,10,12,20]); return{q:`A fair ${n}-sided die pays its face value in €. What is the expected payout?`,ans:(n+1)/2,tol:0.05,fmt:"€",cat}; }
  if(cat==="EVBET"){ const [,pct]=pick(EV_FRACS.filter(([,pc])=>pc>=20&&pc<=80)); const pr=pct/100; const W=r(2,10)*10, L=r(1,8)*10; const ans=Math.round((pr*W-(1-pr)*L)*100)/100; return{q:`You win €${W} with probability ${pct}%, otherwise you lose €${L}. What is the expected value of the bet?`,ans,tol:0.5,fmt:"€ (may be negative)",cat}; }
  if(cat==="IMPLIED"){ const [stk,prof,pct]=pick(EV_ODDS); return{q:`You risk €${stk*10} to win €${prof*10} profit. What win probability makes this break even?`,ans:pct,tol:0.6,fmt:"a %",cat}; }
  if(cat==="DICESUM"){ const [k,pct]=pick(EV_DICESUM); return{q:`Two fair dice are rolled. What is the probability the sum equals ${k}?`,ans:pct,tol:1.2,fmt:"a % (approx.)",cat}; }
  const k=r(2,4); const pct=Math.round(100/Math.pow(2,k)*100)/100; return{q:`You flip ${k} fair coins. What is the probability they ALL land heads?`,ans:pct,tol:0.2,fmt:"a %",cat};
}
const EV_CATS={PCT:"Percent of",COMP:"Complement",FRACPCT:"Fraction → %",DIEEV:"Die EV",EVBET:"Expected value",IMPLIED:"Implied prob.",DICESUM:"Dice sum",COINRUN:"Coin runs"};
const fmtAns=v=>Number.isInteger(v)?String(v):String(Math.round(v*100)/100);

export function BeatTheOdds({onBack,onFinish}){
  const[screen,setScreen]=useState("intro");
  const[question,setQuestion]=useState(null);
  const[answered,setAnswered]=useState(0);
  const[input,setInput]=useState("");
  const[timeLeft,setTimeLeft]=useState(EV_DURATION);
  const[score,setScore]=useState(0);
  const[correct,setCorrect]=useState(0);
  const[wrong,setWrong]=useState(0);
  const[feedback,setFeedback]=useState(null); // {correct, ans}
  const timerRef=useRef(null);const inputRef=useRef(null);const timeLeftRef=useRef(EV_DURATION);
  const st=useRef({correct:0,wrong:0,skipped:0,answered:0,cats:{}});

  function nextQ(){ const p=clamp01((EV_DURATION-timeLeftRef.current)/EV_DURATION); setQuestion(genEVQ(p)); setInput("");setFeedback(null); setTimeout(()=>inputRef.current?.focus(),30); }
  function startGame(){
    st.current={correct:0,wrong:0,skipped:0,answered:0,cats:{}};
    setScore(0);setCorrect(0);setWrong(0);setAnswered(0);
    timeLeftRef.current=EV_DURATION;setTimeLeft(EV_DURATION);setScreen("playing");
    timerRef.current=setInterval(()=>{timeLeftRef.current-=1;setTimeLeft(timeLeftRef.current);if(timeLeftRef.current<=0){clearInterval(timerRef.current);endGame();}},1000);
    nextQ();
  }
  function endGame(){
    clearInterval(timerRef.current);
    const s=st.current;const net=s.correct-s.wrong;const rating=scoreNet(net,BENCH.ev.netElite);
    saveSession(LS.ev,{date:new Date().toLocaleDateString(),score:rating,net,correct:s.correct,wrong:s.wrong,answered:s.answered,cats:s.cats});
    onFinish({score:rating,label:`Rating: ${rating} / 1000`,detail:`Net ${net} · ${s.correct} correct · ${s.wrong} wrong`,raw:{score:rating,net,correct:s.correct,wrong:s.wrong,cats:s.cats}});
  }
  function submitAnswer(){
    if(!question||feedback)return;
    const user=parseNum(input);if(user===null)return;
    const ok=Math.abs(user-question.ans)<=question.tol+1e-9;
    const c=st.current.cats[question.cat]||{a:0,c:0};c.a++;if(ok)c.c++;st.current.cats[question.cat]=c;
    st.current.answered++;setAnswered(st.current.answered);
    if(ok){st.current.correct++;setCorrect(st.current.correct);}else{st.current.wrong++;setWrong(st.current.wrong);}
    setScore(st.current.correct-st.current.wrong);setFeedback({correct:ok,ans:question.ans});
    setTimeout(()=>nextQ(),ok?600:1300);
  }
  function skipQ(){ if(feedback)return; st.current.skipped++; nextQ(); }
  useEffect(()=>()=>clearInterval(timerRef.current),[]);

  const wrap=ch=>(<div style={{minHeight:"100dvh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:C.text,padding:20}}><div style={{maxWidth:520,width:"100%",textAlign:"center"}}>{ch}</div></div>);

  if(screen==="intro")return wrap(<>
    <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><IconOdds size={56}/></div>
    <h1 style={{fontSize:22,fontWeight:700,color:C.text,margin:"0 0 4px"}}>Beat the Odds</h1>
    <p style={{color:C.blue,fontSize:11,letterSpacing:1.4,fontWeight:700,marginBottom:20}}>INTERVIEW PREP · OPTIVER PROBABILITY & EV</p>
    <p style={{color:C.muted,lineHeight:1.7,fontSize:13,marginBottom:18}}>Rapid probability, expected value, and fraction/percent conversion — the core of market-making math. Every answer is a single number.<br/>As many as you can in 4 minutes.</p>
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 18px",marginBottom:16,textAlign:"left"}}>
      <p style={{color:C.muted,fontSize:11,letterSpacing:1,marginBottom:8}}>SCORING</p>
      <p style={{color:C.muted,fontSize:13,lineHeight:1.9,margin:0}}>Correct <span style={{color:C.green,fontWeight:700}}>+1</span> &nbsp;·&nbsp; Wrong <span style={{color:C.red,fontWeight:700}}>−1</span> &nbsp;·&nbsp; Skip <span style={{color:C.text,fontWeight:700}}>0</span><br/>Answer in the format each question asks for, a percent, a euro amount, or a plain number.<br/>Percentages and expected values accept a small rounding tolerance.</p>
    </div>
    <Btn onClick={startGame} full>Start — 4 min</Btn>
    <Btn onClick={onBack} secondary full>Back</Btn>
  </>);

  if(screen==="playing"&&question)return(
    <div style={{minHeight:"100dvh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:C.text,padding:20,gap:18}}>
      <div style={{display:"flex",gap:22,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
        {[{label:"SCORE",value:score,color:score<0?C.red:C.accent},{label:"DONE",value:answered,color:C.text},{label:"RIGHT",value:correct,color:C.green},{label:"WRONG",value:wrong,color:C.red}].map(s=>(<div key={s.label} style={{textAlign:"center"}}><div style={{color:C.faint,fontSize:9,letterSpacing:1.2,fontWeight:600}}>{s.label}</div><div style={{color:s.color,fontWeight:700,fontSize:18}}>{s.value}</div></div>))}
        <div style={{textAlign:"center"}}><div style={{color:C.faint,fontSize:9,letterSpacing:1.2,fontWeight:600}}>TIME</div><div style={{color:timeLeft<=30?C.red:C.text,fontWeight:700,fontSize:18}}>{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,"0")}</div></div>
        <button onClick={onBack} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted,borderRadius:10,padding:"0 16px",height:44,fontSize:13,fontWeight:600,cursor:"pointer",touchAction:"manipulation"}}>Exit</button>
      </div>
      <div style={{width:"min(440px,90vw)",height:4,background:C.dim,borderRadius:2}}>
        <div style={{width:`${(timeLeft/EV_DURATION)*100}%`,height:"100%",background:timeLeft<=30?C.red:C.blue,borderRadius:2,transition:"width 1s linear"}}/>
      </div>
      <div style={{background:"#60a5fa18",color:"#60a5fa",border:"1px solid #60a5fa33",borderRadius:20,padding:"3px 14px",fontSize:10,fontWeight:600,letterSpacing:1}}>{EV_CATS[question.cat]}</div>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"26px 32px",minWidth:"min(440px,88vw)",maxWidth:520,textAlign:"center"}}>
        <div style={{fontSize:18,fontWeight:600,color:C.text,lineHeight:1.5}}>{question.q}</div>
        <div style={{marginTop:9,color:C.muted,fontSize:12}}>Answer as {question.fmt}</div>
        {feedback&&<div style={{marginTop:12,fontSize:14,fontWeight:700,color:feedback.correct?C.green:C.red}}>{feedback.correct?"Correct, +1":`Wrong, −1 · answer ${fmtAns(feedback.ans)}`}</div>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10,width:"min(340px,90vw)"}}>
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} inputMode="decimal"
          onKeyDown={e=>{if(e.key==="Enter"&&input.trim())submitAnswer();if(e.key==="Tab"){e.preventDefault();skipQ();}}}
          placeholder="Your answer…" style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"15px 18px",fontSize:22,fontWeight:700,color:C.text,width:"100%",textAlign:"center",outline:"none",boxSizing:"border-box"}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{if(input.trim())submitAnswer();}} disabled={!input.trim()} style={{flex:1,background:input.trim()?C.accent:C.dim,color:input.trim()?"#060a12":C.faint,border:"none",borderRadius:10,padding:"14px",minHeight:48,fontSize:15,fontWeight:700,cursor:input.trim()?"pointer":"not-allowed",touchAction:"manipulation"}}>Submit</button>
          <button onClick={skipQ} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,borderRadius:10,padding:"14px 18px",minHeight:48,fontSize:13,fontWeight:600,cursor:"pointer",touchAction:"manipulation"}}>Skip</button>
        </div>
      </div>
      <p style={{color:C.faint,fontSize:11.5,margin:0,textAlign:"center"}}>Enter submits · Tab skips · fractions like 1/6 accepted</p>
    </div>
  );

  return null;
}
