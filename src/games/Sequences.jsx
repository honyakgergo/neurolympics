import { useState, useEffect, useRef } from "react";
import { Btn } from "../components/Btn.jsx";
import { IconSeq } from "../components/Icons.jsx";
import { BENCH, scoreSeq } from "../lib/scoring.js";
import { LS, saveSession } from "../lib/storage.js";
import { C } from "../lib/theme.js";

// Sequences — Optiver NumberLogic prep.
// +1 / -1 on easy & medium, +2 / -2 on hard, skip = 0. The rule is revealed
// after every answer so the session doubles as practice.
const SEQ_DURATION = 240; // 4 minutes
const SEQ_TOTAL = 10;

const TYPES = ["arithmetic","geometric","second_order","alternating","fibonacci","squares","mixed","polynomial"];
export const TYPE_LABELS = {
  arithmetic:"Constant step", geometric:"Constant ratio", second_order:"Growing differences",
  alternating:"Interleaved pair", fibonacci:"Sum of previous two", squares:"Square numbers",
  mixed:"Alternating operations", polynomial:"Quadratic rule",
};

function generateSequence(hard){
  const r=(min,max)=>Math.floor(Math.random()*(max-min+1))+min;
  const type=TYPES[Math.floor(Math.random()*TYPES.length)];
  let seq=[],rule="",ans=0;
  if(type==="arithmetic"){
    const start=r(1,hard?60:20),step=r(2,hard?17:8)*(Math.random()<0.3?-1:1);
    seq=Array.from({length:5},(_,i)=>start+i*step);ans=start+5*step;
    rule=`Add ${step} each step`;
  } else if(type==="geometric"){
    const start=r(1,hard?6:3),ratio=r(2,hard?4:3);
    seq=Array.from({length:5},(_,i)=>start*Math.pow(ratio,i));ans=start*Math.pow(ratio,5);
    rule=`Multiply by ${ratio} each step`;
  } else if(type==="second_order"){
    const start=r(1,10);let cur=start,diff=r(1,5);seq=[start];
    for(let i=0;i<5;i++){cur+=diff;diff+=r(1,hard?4:2);seq.push(cur);}
    ans=seq.pop();
    const diffs=seq.slice(1).map((v,i)=>v-seq[i]);
    rule=`Differences themselves grow: ${diffs.join(", ")} …`;
  } else if(type==="alternating"){
    const a=r(2,hard?40:15),b=r(2,hard?30:12),stepA=r(2,hard?9:5),stepB=r(2,hard?9:5);
    seq=Array.from({length:5},(_,i)=>i%2===0?a+Math.floor(i/2)*stepA:b+Math.floor(i/2)*stepB);
    ans=b+2*stepB;
    rule=`Two interleaved runs — positions 1,3,5 add ${stepA}; positions 2,4,6 add ${stepB}`;
  } else if(type==="fibonacci"){
    const a=r(1,hard?9:5),b=r(1,hard?9:5);seq=[a,b];
    while(seq.length<6)seq.push(seq[seq.length-1]+seq[seq.length-2]);
    ans=seq.pop();
    rule=`Each term is the sum of the previous two`;
  } else if(type==="squares"){
    const offset=r(0,hard?7:2),k=hard?r(1,3):1;
    seq=Array.from({length:5},(_,i)=>k*Math.pow(i+1,2)+offset);ans=k*36+offset;
    rule=`${k===1?"":k}n² ${offset?`+ ${offset}`:""}`.trim();
  } else if(type==="mixed"){
    const start=r(2,hard?24:10),step=r(2,hard?9:6),mult=r(2,3);
    seq=[];let cur=start;
    for(let i=0;i<5;i++){seq.push(cur);cur=i%2===0?cur+step:cur*mult;}
    ans=cur;
    rule=`Alternates: +${step}, then ×${mult}`;
  } else {
    const a=r(1,hard?4:3),b=r(0,hard?6:4);
    seq=Array.from({length:5},(_,i)=>a*(i+1)*(i+1)+b*(i+1));ans=a*36+b*6;
    rule=`${a}n² ${b?`+ ${b}n`:""}`.trim();
  }
  return{seq:seq.map(Math.round),ans:Math.round(ans),rule,type,points:hard?2:1};
}
function seqDiff(i){ return i<4?"easy":i<7?"medium":"hard"; }

export function Sequences({onBack,onFinish}){
  const[screen,setScreen]=useState("intro"); // intro|playing
  const[question,setQuestion]=useState(null);
  const[qNum,setQNum]=useState(0);
  const[input,setInput]=useState("");
  const[timeLeft,setTimeLeft]=useState(SEQ_DURATION);
  const[score,setScore]=useState(0);
  const[correct,setCorrect]=useState(0);
  const[wrong,setWrong]=useState(0);
  const[skipped,setSkipped]=useState(0);
  const[feedback,setFeedback]=useState(null);
  const timerRef=useRef(null);const inputRef=useRef(null);const qStart=useRef(0);const advTimer=useRef(null);
  const st=useRef({score:0,correct:0,wrong:0,skipped:0,times:[],types:{}});

  function nextQ(idx){
    if(idx>=SEQ_TOTAL){endGame();return;}
    setQuestion(generateSequence(seqDiff(idx)==="hard"));
    setInput("");setFeedback(null);qStart.current=performance.now();
    setTimeout(()=>inputRef.current?.focus(),40);
  }
  function startGame(){
    st.current={score:0,correct:0,wrong:0,skipped:0,times:[],types:{}};
    setScore(0);setCorrect(0);setWrong(0);setSkipped(0);setQNum(0);
    setTimeLeft(SEQ_DURATION);setScreen("playing");
    let t=SEQ_DURATION;
    timerRef.current=setInterval(()=>{t--;setTimeLeft(t);if(t<=0){clearInterval(timerRef.current);endGame();}},1000);
    nextQ(0);
  }
  function endGame(){
    clearInterval(timerRef.current);clearTimeout(advTimer.current);
    const s=st.current;
    const avgMs=s.times.length?Math.round(s.times.reduce((a,b)=>a+b,0)/s.times.length):0;
    const rating=scoreSeq({net:s.score,avgMs});
    // Weakest pattern family this session (needs at least one attempt).
    const tried=Object.entries(s.types).filter(([,v])=>v.a>0);
    const worst=tried.length?tried.sort((a,b)=>(a[1].c/a[1].a)-(b[1].c/b[1].a))[0]:null;
    saveSession(LS.seq,{date:new Date().toLocaleDateString(),score:rating,net:s.score,correct:s.correct,wrong:s.wrong,skipped:s.skipped,avgMs,types:s.types,worst:worst?worst[0]:null});
    onFinish({
      score:rating,
      label:`Rating: ${rating} / 1000`,
      detail:`Net ${s.score} · ${s.correct}✓ ${s.wrong}✗ ${s.skipped} skipped · ${(avgMs/1000).toFixed(1)}s per question${worst?` · weakest: ${TYPE_LABELS[worst[0]]}`:""}`,
      raw:{score:rating,net:s.score,correct:s.correct,wrong:s.wrong,avgMs,types:s.types},
    });
  }
  function record(isCorrect){
    const s=st.current,t=s.types[question.type]||{a:0,c:0};
    t.a++;if(isCorrect)t.c++;s.types[question.type]=t;
    s.times.push(performance.now()-qStart.current);
  }
  function submitAnswer(){
    if(!question||feedback)return;
    const user=parseInt(String(input).trim(),10);
    if(Number.isNaN(user))return;
    const isCorrect=user===question.ans;
    const pts=isCorrect?question.points:-question.points;
    record(isCorrect);
    st.current.score+=pts;setScore(st.current.score);
    if(isCorrect){st.current.correct++;setCorrect(st.current.correct);}
    else{st.current.wrong++;setWrong(st.current.wrong);}
    setFeedback({correct:isCorrect,ans:question.ans,pts});
    const next=qNum+1;setQNum(next);
    advTimer.current=setTimeout(()=>nextQ(next),isCorrect?1500:2200);
  }
  function skipQ(){
    if(!question||feedback)return;
    st.current.skipped++;setSkipped(st.current.skipped);
    setFeedback({skipped:true,ans:question.ans,pts:0});
    const next=qNum+1;setQNum(next);
    advTimer.current=setTimeout(()=>nextQ(next),1800);
  }
  useEffect(()=>()=>{clearInterval(timerRef.current);clearTimeout(advTimer.current);},[]);

  const wrap=ch=>(<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:C.text,padding:20}}><div style={{maxWidth:460,width:"100%",textAlign:"center"}}>{ch}</div></div>);

  if(screen==="intro")return wrap(<>
    <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><IconSeq size={56}/></div>
    <h1 style={{fontSize:22,fontWeight:700,color:C.text,margin:"0 0 4px"}}>Sequences</h1>
    <p style={{color:C.purple,fontSize:11,letterSpacing:1.4,fontWeight:700,marginBottom:18}}>INTERVIEW PREP · OPTIVER NUMBERLOGIC</p>
    <p style={{color:C.muted,lineHeight:1.7,fontSize:13,marginBottom:16}}>{SEQ_TOTAL} sequences · 4 minutes · find the next number.<br/>Constant steps and ratios, growing differences, interleaved runs, Fibonacci, squares and quadratics.</p>
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 18px",marginBottom:18,textAlign:"left"}}>
      <p style={{color:C.muted,fontSize:11,letterSpacing:1,marginBottom:8}}>SCORING</p>
      <p style={{color:C.muted,fontSize:13,lineHeight:1.9,margin:0}}>Easy and medium <span style={{color:C.green,fontWeight:700}}>+1</span> / <span style={{color:C.red,fontWeight:700}}>−1</span> &nbsp;·&nbsp; hard <span style={{color:C.green,fontWeight:700}}>+2</span> / <span style={{color:C.red,fontWeight:700}}>−2</span> &nbsp;·&nbsp; skip <span style={{color:C.text,fontWeight:700}}>0</span><br/>Rating is net points weighted 75%, pace 25%. {BENCH.seq.netElite} net is a clean sweep.<br/>The rule is shown after every answer, so wrong ones still teach you something.</p>
    </div>
    <Btn onClick={startGame} full>Start — 4 min</Btn>
    <Btn onClick={onBack} secondary full>← Back</Btn>
  </>);

  if(screen==="playing"&&question)return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:C.text,padding:16,gap:16}}>
      <div style={{display:"flex",gap:18,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
        {[{label:"NET",value:score,color:score<0?C.red:C.accent},{label:"Q",value:`${Math.min(qNum+1,SEQ_TOTAL)}/${SEQ_TOTAL}`,color:C.text},{label:"RIGHT",value:correct,color:C.green},{label:"WRONG",value:wrong,color:C.red},{label:"SKIP",value:skipped,color:C.muted}].map(s=>(
          <div key={s.label} style={{textAlign:"center"}}><div style={{color:C.faint,fontSize:9,letterSpacing:1.2,fontWeight:600}}>{s.label}</div><div style={{color:s.color,fontWeight:700,fontSize:18}}>{s.value}</div></div>
        ))}
        <div style={{textAlign:"center"}}><div style={{color:C.faint,fontSize:9,letterSpacing:1.2,fontWeight:600}}>TIME</div><div style={{color:timeLeft<=30?C.red:C.text,fontWeight:700,fontSize:18}}>{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,"0")}</div></div>
        <button onClick={onBack} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted,borderRadius:10,padding:"0 16px",height:44,fontSize:13,fontWeight:600,cursor:"pointer",touchAction:"manipulation"}}>Exit</button>
      </div>
      <div style={{width:"min(420px,92vw)",height:4,background:C.dim,borderRadius:2}}>
        <div style={{width:`${(timeLeft/SEQ_DURATION)*100}%`,height:"100%",background:timeLeft<=30?C.red:C.purple,borderRadius:2,transition:"width 1s linear"}}/>
      </div>
      <div style={{display:"flex",gap:8}}>
        <div style={{background:"#b39dfb1e",color:C.purple,border:"1px solid #b39dfb44",borderRadius:20,padding:"4px 15px",fontSize:10,fontWeight:700,letterSpacing:1}}>{seqDiff(qNum).toUpperCase()}</div>
        <div style={{background:question.points===2?"#fbbf241e":"#3ddc841e",color:question.points===2?C.amber:C.green,border:`1px solid ${question.points===2?"#fbbf2444":"#3ddc8444"}`,borderRadius:20,padding:"4px 15px",fontSize:10,fontWeight:700}}>±{question.points} pts</div>
      </div>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"22px 18px",textAlign:"center",width:"min(440px,94vw)",boxSizing:"border-box"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,flexWrap:"wrap"}}>
          {question.seq.map((n,i)=>(<div key={i} style={{background:C.dim,borderRadius:8,padding:"10px 12px",fontSize:20,fontWeight:700,color:C.text,minWidth:40}}>{n}</div>))}
          <div style={{background:C.raised,borderRadius:8,padding:"10px 12px",fontSize:20,fontWeight:700,color:C.purple,minWidth:40,border:`1px dashed ${C.purple}`}}>{feedback?feedback.ans:"?"}</div>
        </div>
        {feedback&&(
          <div style={{marginTop:16}}>
            {feedback.skipped
              ? <div style={{color:C.muted,fontSize:13,fontWeight:600}}>Skipped. The answer was <span style={{color:C.text,fontWeight:700}}>{feedback.ans}</span></div>
              : <div style={{color:feedback.correct?C.green:C.red,fontSize:14.5,fontWeight:700}}>{feedback.correct?`Correct, +${feedback.pts}`:`${feedback.pts} · the answer was ${feedback.ans}`}</div>}
            <div style={{marginTop:10,background:C.dim,borderRadius:9,padding:"11px 13px",textAlign:"left"}}>
              <div style={{color:C.purple,fontSize:9.5,letterSpacing:1.4,fontWeight:700,marginBottom:5}}>{TYPE_LABELS[question.type].toUpperCase()}</div>
              <div style={{color:C.text,fontSize:12.5,lineHeight:1.6}}>{question.rule}</div>
            </div>
          </div>
        )}
      </div>
      {!feedback&&(
        <div style={{display:"flex",flexDirection:"column",gap:10,width:"min(340px,90vw)"}}>
          <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} type="number" inputMode="numeric"
            onKeyDown={e=>{if(e.key==="Enter")submitAnswer();if(e.key==="Tab"){e.preventDefault();skipQ();}}}
            placeholder="Next number…"
            style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"15px 18px",fontSize:22,fontWeight:700,color:C.text,width:"100%",textAlign:"center",outline:"none",boxSizing:"border-box"}}/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={submitAnswer} disabled={!input.trim()} style={{flex:1,background:input.trim()?C.accent:C.dim,color:input.trim()?"#060a12":C.faint,border:"none",borderRadius:10,padding:"14px",minHeight:48,fontSize:15,fontWeight:700,cursor:input.trim()?"pointer":"not-allowed",touchAction:"manipulation"}}>Submit</button>
            <button onClick={skipQ} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,borderRadius:10,padding:"14px 18px",minHeight:48,fontSize:13,fontWeight:600,cursor:"pointer",touchAction:"manipulation"}}>Skip</button>
          </div>
        </div>
      )}
    </div>
  );
  return null;
}
