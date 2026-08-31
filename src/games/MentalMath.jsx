import { useState, useEffect, useRef } from "react";
import { Btn } from "../components/Btn.jsx";
import { IconMath } from "../components/Icons.jsx";
import { BENCH, clamp01, scoreNet } from "../lib/scoring.js";
import { LS, saveSession } from "../lib/storage.js";
import { C } from "../lib/theme.js";

// Mental Math — Optiver 80-in-8
const MATH_DURATION = 240; // 4-minute sprint (half of Optiver's real 80-in-8)

// Optiver-style arithmetic. Magnitudes and the hard-multiply mix ramp with the
// elapsed fraction p (0 at the start, 1 at the end).
function genMathQ(p){
  const r=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  const pool=[
    ["ADD",    1.4-0.6*p],
    ["SUB",    1.2-0.4*p],
    ["MUL1x1", 0.9-0.7*p],
    ["MUL1x2", 0.7+0.3*p],
    ["MUL2x2", 0.2+1.2*p],
    ["DIV",    0.5+0.3*p],
  ];
  const total=pool.reduce((s,[,w])=>s+Math.max(0,w),0);
  let x=Math.random()*total,cat=pool[0][0];
  for(const [c,w] of pool){ x-=Math.max(0,w); if(x<=0){cat=c;break;} }
  if(cat==="ADD"){ const hi=Math.round(90+p*900); const a=r(10,hi),b=r(10,hi); return{q:`${a} + ${b}`,ans:a+b,cat}; }
  if(cat==="SUB"){ const hi=Math.round(90+p*900); let a=r(10,hi),b=r(10,hi); if(b>a){const t=a;a=b;b=t;} return{q:`${a} − ${b}`,ans:a-b,cat}; }
  if(cat==="MUL1x1"){ const a=r(2,9),b=r(2,9); return{q:`${a} × ${b}`,ans:a*b,cat}; }
  if(cat==="MUL1x2"){ const a=r(3,9),b=r(11,99); return{q:`${a} × ${b}`,ans:a*b,cat}; }
  if(cat==="MUL2x2"){ const a=r(11,99),b=r(11,99); return{q:`${a} × ${b}`,ans:a*b,cat}; }
  // DIV — always a clean integer, built as (divisor × quotient) ÷ divisor
  const b=r(2,12),ans=r(3,Math.round(20+p*80)); return{q:`${b*ans} ÷ ${b}`,ans,cat};
}
const MATH_CATS={ADD:"Addition",SUB:"Subtraction",MUL1x1:"1×1 multiply",MUL1x2:"1×2 multiply",MUL2x2:"2×2 multiply",DIV:"Division"};

export function MentalMath({onBack,onFinish}){
  const[screen,setScreen]=useState("intro"); // intro|playing
  const[question,setQuestion]=useState(null);
  const[answered,setAnswered]=useState(0);
  const[input,setInput]=useState("");
  const[timeLeft,setTimeLeft]=useState(MATH_DURATION);
  const[score,setScore]=useState(0);
  const[correct,setCorrect]=useState(0);
  const[wrong,setWrong]=useState(0);
  const[feedback,setFeedback]=useState(null); // "correct"|"wrong"|null
  const timerRef=useRef(null);
  const inputRef=useRef(null);
  const timeLeftRef=useRef(MATH_DURATION);
  const st=useRef({correct:0,wrong:0,skipped:0,answered:0,cats:{}});

  function nextQ(){
    const p=clamp01((MATH_DURATION-timeLeftRef.current)/MATH_DURATION);
    setQuestion(genMathQ(p));setInput("");setFeedback(null);
    setTimeout(()=>inputRef.current?.focus(),30);
  }
  function startGame(){
    st.current={correct:0,wrong:0,skipped:0,answered:0,cats:{}};
    setScore(0);setCorrect(0);setWrong(0);setAnswered(0);
    timeLeftRef.current=MATH_DURATION;setTimeLeft(MATH_DURATION);setScreen("playing");
    timerRef.current=setInterval(()=>{timeLeftRef.current-=1;setTimeLeft(timeLeftRef.current);if(timeLeftRef.current<=0){clearInterval(timerRef.current);endGame();}},1000);
    nextQ();
  }
  function endGame(){
    clearInterval(timerRef.current);
    const s=st.current;const net=s.correct-s.wrong;const rating=scoreNet(net,BENCH.math.netElite);
    const qpm=Math.round(s.correct/(MATH_DURATION/60)*10)/10;
    saveSession(LS.math,{date:new Date().toLocaleDateString(),score:rating,net,correct:s.correct,wrong:s.wrong,answered:s.answered,qpm,cats:s.cats});
    onFinish({score:rating,label:`Rating: ${rating} / 1000`,detail:`Net ${net} · ${s.correct} correct · ${s.wrong} wrong · ${qpm} Q/min`,raw:{score:rating,net,correct:s.correct,wrong:s.wrong,qpm,cats:s.cats}});
  }
  function submitAnswer(){
    if(!question||feedback)return;
    const user=parseInt(String(input).trim(),10);
    if(Number.isNaN(user))return;
    const isCorrect=user===question.ans;
    const c=st.current.cats[question.cat]||{a:0,c:0};c.a++;if(isCorrect)c.c++;st.current.cats[question.cat]=c;
    st.current.answered++;setAnswered(st.current.answered);
    if(isCorrect){st.current.correct++;setCorrect(st.current.correct);}else{st.current.wrong++;setWrong(st.current.wrong);}
    setScore(st.current.correct-st.current.wrong);setFeedback(isCorrect?"correct":"wrong");
    setTimeout(()=>nextQ(),isCorrect?220:700);
  }
  function skipQ(){ if(feedback)return; st.current.skipped++; nextQ(); }
  useEffect(()=>()=>clearInterval(timerRef.current),[]);

  const wrap=ch=>(<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:C.text,padding:20}}><div style={{maxWidth:480,width:"100%",textAlign:"center"}}>{ch}</div></div>);

  if(screen==="intro")return wrap(<>
    <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><IconMath size={56}/></div>
    <h1 style={{fontSize:22,fontWeight:700,color:C.text,margin:"0 0 4px"}}>Mental Math</h1>
    <p style={{color:"#5ecef7",fontSize:11,letterSpacing:1,marginBottom:20}}>INTERVIEW PREP · OPTIVER 80-IN-8</p>
    <p style={{color:C.muted,lineHeight:1.7,fontSize:13,marginBottom:18}}>As many as you can in 4 minutes · no calculator.<br/>Add, subtract, 1×1 / 1×2 / 2×2 multiply, and divide — difficulty ramps as the clock runs, like the real screen.</p>
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 18px",marginBottom:16,textAlign:"left"}}>
      <p style={{color:C.muted,fontSize:11,letterSpacing:1,marginBottom:8}}>SCORING</p>
      <p style={{color:C.muted,fontSize:13,lineHeight:1.9,margin:0}}>Correct <span style={{color:C.green,fontWeight:700}}>+1</span> &nbsp;·&nbsp; Wrong <span style={{color:C.red,fontWeight:700}}>−1</span> &nbsp;·&nbsp; Skip <span style={{color:C.text,fontWeight:700}}>0</span><br/>Rating maps your net score, correct minus wrong, to 0 to 1000.<br/>Real 80-in-8 pace: around 40 net in 4 minutes is elite, 28 or more is a comfortable pass.</p>
    </div>
    <Btn onClick={startGame} full>Start — 4 min</Btn>
    <Btn onClick={onBack} secondary full>← Back</Btn>
  </>);

  if(screen==="playing"&&question)return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:C.text,padding:20,gap:20}}>
      <div style={{display:"flex",gap:22,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
        {[{label:"SCORE",value:score,color:score<0?C.red:C.accent},{label:"DONE",value:answered,color:C.text},{label:"RIGHT",value:correct,color:C.green},{label:"WRONG",value:wrong,color:C.red}].map(s=>(<div key={s.label} style={{textAlign:"center"}}><div style={{color:C.faint,fontSize:9,letterSpacing:1.2,fontWeight:600}}>{s.label}</div><div style={{color:s.color,fontWeight:700,fontSize:18}}>{s.value}</div></div>))}
        <div style={{textAlign:"center"}}><div style={{color:C.faint,fontSize:9,letterSpacing:1.2,fontWeight:600}}>TIME</div><div style={{color:timeLeft<=30?C.red:C.text,fontWeight:700,fontSize:18}}>{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,"0")}</div></div>
        <button onClick={onBack} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted,borderRadius:10,padding:"0 16px",height:44,fontSize:13,fontWeight:600,cursor:"pointer",touchAction:"manipulation"}}>Exit</button>
      </div>
      <div style={{width:"min(400px,90vw)",height:4,background:C.dim,borderRadius:2}}>
        <div style={{width:`${(timeLeft/MATH_DURATION)*100}%`,height:"100%",background:timeLeft<=30?C.red:C.accent,borderRadius:2,transition:"width 1s linear"}}/>
      </div>
      <div style={{background:"#5ecef718",color:"#5ecef7",border:"1px solid #5ecef733",borderRadius:20,padding:"3px 14px",fontSize:10,fontWeight:600,letterSpacing:1}}>{MATH_CATS[question.cat]}</div>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"32px 40px",minWidth:"min(340px,80vw)",textAlign:"center"}}>
        <div style={{fontSize:38,fontWeight:700,color:C.text,letterSpacing:1}}>{question.q}</div>
        {feedback&&<div style={{marginTop:12,fontSize:14,fontWeight:700,color:feedback==="correct"?C.green:C.red}}>{feedback==="correct"?"Correct, +1":`Wrong, −1 · answer ${question.ans}`}</div>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10,width:"min(340px,90vw)"}}>
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} type="number" inputMode="numeric"
          onKeyDown={e=>{if(e.key==="Enter"&&input.trim())submitAnswer();if(e.key==="Tab"){e.preventDefault();skipQ();}}}
          placeholder="Answer…" style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"15px 18px",fontSize:22,fontWeight:700,color:C.text,width:"100%",textAlign:"center",outline:"none",boxSizing:"border-box"}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{if(input.trim())submitAnswer();}} disabled={!input.trim()} style={{flex:1,background:input.trim()?"#5ecef7":"#111",color:input.trim()?"#060a12":"#333",border:"none",borderRadius:10,padding:"14px",minHeight:48,fontSize:15,fontWeight:700,cursor:input.trim()?"pointer":"not-allowed",touchAction:"manipulation"}}>Submit</button>
          <button onClick={skipQ} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,borderRadius:10,padding:"14px 18px",minHeight:48,fontSize:13,fontWeight:600,cursor:"pointer",touchAction:"manipulation"}}>Skip</button>
        </div>
      </div>
      <p style={{color:C.faint,fontSize:11.5,margin:0,textAlign:"center"}}>Enter submits · Tab skips with no penalty</p>
    </div>
  );

  return null;
}
