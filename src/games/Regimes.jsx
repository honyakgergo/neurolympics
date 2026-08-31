import { useState, useMemo, useEffect } from "react";
import { Btn } from "../components/Btn.jsx";
import { ExitBar } from "../components/GameBar.jsx";
import { IconRegimes } from "../components/Icons.jsx";
import { LS, lsGet, lsSet } from "../lib/storage.js";
import { C } from "../lib/theme.js";
import BANK from "../data/scenarios.json";

// Regimes — the economics scenario bank.
//
// Deliberately unscored. Nothing here is measured, rated or fed into the Brain
// Profile; the only thing stored is which entries you have read, so the deck
// can keep dealing you new ones. Return figures are rounded ranges with a
// confidence flag, because the ranking is the reliable part.

const ALL=BANK.scenarios;
const shuffle=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;};
const readIds=()=>{const v=lsGet(LS.regimes);return Array.isArray(v)?v:[];};
const markRead=id=>{const r=readIds();if(!r.includes(id)){r.push(id);lsSet(LS.regimes,r);}};

const CONF={high:{label:"well established",color:C.green},medium:{label:"approximate",color:C.amber},low:{label:"uncertain",color:C.red}};

function Card({children,style}){
  return<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:15,padding:18,boxSizing:"border-box",width:"100%",...style}}>{children}</div>;
}
function Section({label,accent=C.faint,children}){
  return(
    <Card>
      <p style={{color:accent,fontSize:10,letterSpacing:1.6,fontWeight:700,margin:"0 0 9px"}}>{label}</p>
      <div style={{color:C.muted,fontSize:13.5,lineHeight:1.8}}>{children}</div>
    </Card>
  );
}
function TypeTag({type}){
  const hist=type==="historical";
  return(
    <span style={{color:hist?C.blue:C.purple,background:hist?"#7cb0ff18":"#b39dfb18",border:`1px solid ${hist?"#7cb0ff44":"#b39dfb44"}`,
      borderRadius:20,padding:"4px 11px",fontSize:9.5,fontWeight:700,letterSpacing:1.1,whiteSpace:"nowrap"}}>
      {hist?"HISTORICAL":"THEORY"}
    </span>
  );
}

// The full write-up, shared by play mode's reveal and browse mode's reader.
function Reveal({s,picked}){
  const win=s.options.find(o=>o.id===s.answer);
  const runner=s.options.find(o=>o.id===s.runnerUp);
  const myPick=picked?s.options.find(o=>o.id===picked):null;
  const gotIt=picked===s.answer;
  const close=picked===s.runnerUp;
  return(<>
    {picked&&(
      <Card style={{borderColor:gotIt?"#2c5a3c":close?"#5a4a2a":C.border,background:gotIt?"#0b1811":C.surface}}>
        <p style={{color:gotIt?C.green:close?C.amber:C.muted,fontSize:14.5,fontWeight:700,margin:"0 0 6px"}}>
          {gotIt?"That was the strongest option":close?"Close — that was the runner-up":"The strongest option was something else"}
        </p>
        <p style={{color:C.muted,fontSize:13,lineHeight:1.7,margin:0}}>
          You chose <span style={{color:C.text,fontWeight:700}}>{myPick?.label}</span>. The best available was <span style={{color:C.green,fontWeight:700}}>{win?.label}</span>, with <span style={{color:C.text,fontWeight:700}}>{runner?.label}</span> next.
        </p>
      </Card>
    )}

    <Card>
      <p style={{color:C.faint,fontSize:10,letterSpacing:1.6,fontWeight:700,margin:"0 0 12px"}}>WHAT EACH ONE DID · {s.era.toUpperCase()}</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {s.options.map(o=>{
          const isWin=o.id===s.answer, isRunner=o.id===s.runnerUp, mine=o.id===picked;
          const conf=CONF[o.confidence]||CONF.medium;
          return(
            <div key={o.id} style={{background:isWin?"#0d1b13":mine?"#101827":C.dim,border:`1px solid ${isWin?"#2c5a3c":mine?"#2b3a55":"transparent"}`,borderRadius:11,padding:"12px 13px"}}>
              <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap",marginBottom:5}}>
                <span style={{color:isWin?C.green:C.text,fontSize:13.5,fontWeight:700}}>{o.label}</span>
                {isWin&&<span style={{color:C.green,fontSize:9.5,fontWeight:700,letterSpacing:1}}>BEST</span>}
                {isRunner&&<span style={{color:C.amber,fontSize:9.5,fontWeight:700,letterSpacing:1}}>RUNNER-UP</span>}
                {mine&&<span style={{color:C.blue,fontSize:9.5,fontWeight:700,letterSpacing:1}}>YOUR PICK</span>}
              </div>
              <div style={{color:C.muted,fontSize:12.5,lineHeight:1.6}}>{o.move}</div>
              <div style={{color:conf.color,fontSize:10.5,marginTop:5,opacity:0.9}}>figure {conf.label}</div>
            </div>
          );
        })}
      </div>
      <p style={{color:C.faint,fontSize:11,lineHeight:1.6,margin:"13px 0 0",paddingTop:12,borderTop:`1px solid ${C.border}`}}>
        Percentages are rounded approximations. The ordering is the part to trust.
      </p>
    </Card>

    <Section label="WHY" accent={C.accent}>{s.explanation}</Section>
    <Section label="THE TAKEAWAY" accent={C.green}>{s.takeaway}</Section>
    <Section label="DOES IT REPEAT" accent={C.amber}>{s.repeatability}</Section>
  </>);
}

export function Regimes({onBack}){
  const[mode,setMode]=useState("intro");   // intro | play | browse | reader
  const[deck,setDeck]=useState([]);
  const[idx,setIdx]=useState(0);
  const[picked,setPicked]=useState(null);
  const[filter,setFilter]=useState("all");
  const[reading,setReading]=useState(null);
  const[read,setRead]=useState(readIds());

  const shell=(children,center)=>(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI',sans-serif",color:C.text,padding:"18px 14px 40px",display:"flex",justifyContent:"center",alignItems:center?"center":"flex-start"}}>
      <div style={{maxWidth:600,width:"100%",display:"flex",flexDirection:"column",gap:14,alignItems:"center"}}>{children}</div>
    </div>
  );

  function startPlay(){
    const unread=ALL.filter(s=>!read.includes(s.id));
    const pool=unread.length>=3?unread:ALL;
    setDeck(shuffle(pool));setIdx(0);setPicked(null);setMode("play");
  }
  function choose(id){
    setPicked(id);
    const s=deck[idx];
    markRead(s.id);setRead(readIds());
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function nextScenario(){
    if(idx+1>=deck.length){setMode("intro");return;}
    setIdx(idx+1);setPicked(null);
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function openReader(s){
    setReading(s);markRead(s.id);setRead(readIds());setMode("reader");
    window.scrollTo({top:0});
  }
  useEffect(()=>{setRead(readIds());},[]);

  const filtered=useMemo(()=>filter==="all"?ALL:ALL.filter(s=>s.type===filter),[filter]);

  // ── Intro ────────────────────────────────────────────────────────────────
  if(mode==="intro")return shell(<>
    <div style={{textAlign:"center"}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><IconRegimes size={58}/></div>
      <h1 style={{fontSize:23,fontWeight:700,color:C.text,margin:"0 0 5px"}}>Regimes</h1>
      <p style={{color:C.blue,fontSize:10.5,letterSpacing:1.6,fontWeight:700,margin:0}}>ECONOMIC HISTORY · UNSCORED</p>
    </div>
    <Card>
      <p style={{color:C.muted,fontSize:13.5,lineHeight:1.8,margin:0}}>
        {ALL.length} situations from the last hundred years of markets, plus the mechanisms behind them. You read what was happening, you decide where your money goes, and then you find out what actually worked and why.
      </p>
      <p style={{color:C.muted,fontSize:13.5,lineHeight:1.8,margin:"12px 0 0"}}>
        Nothing here is timed, scored or recorded in your profile. The only thing stored is which entries you have already read.
      </p>
      <div style={{display:"flex",alignItems:"center",gap:10,marginTop:16,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
        <div style={{flex:1,background:C.dim,borderRadius:4,height:6}}>
          <div style={{width:`${read.length/ALL.length*100}%`,height:"100%",background:C.blue,borderRadius:4}}/>
        </div>
        <span style={{color:C.muted,fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>{read.length} of {ALL.length} read</span>
      </div>
    </Card>
    <Btn onClick={startPlay} full>{read.length?"Continue with unread":"Start"}</Btn>
    <Btn onClick={()=>setMode("browse")} secondary full>Browse the whole bank</Btn>
    <Btn onClick={onBack} secondary full>Back to hub</Btn>
  </>);

  // ── Browse list ──────────────────────────────────────────────────────────
  if(mode==="browse")return shell(<>
    <ExitBar title="The bank" subtitle={`${ALL.length} ENTRIES`} accent={C.blue} onBack={()=>setMode("intro")} backLabel="Back"/>
    <div style={{display:"flex",gap:8,width:"100%"}}>
      {[["all","All"],["historical","Historical"],["theory","Theory"]].map(([k,label])=>(
        <button key={k} onClick={()=>setFilter(k)}
          style={{flex:1,background:filter===k?C.accent:C.surface,color:filter===k?"#060a12":C.muted,
            border:`1px solid ${filter===k?C.accent:C.border}`,borderRadius:10,minHeight:42,fontSize:12.5,fontWeight:700,
            cursor:"pointer",touchAction:"manipulation"}}>{label}</button>
      ))}
    </div>
    <div style={{width:"100%",display:"flex",flexDirection:"column",gap:9}}>
      {filtered.map(s=>(
        <div key={s.id} onClick={()=>openReader(s)}
          onPointerEnter={e=>e.currentTarget.style.borderColor=C.hover}
          onPointerLeave={e=>e.currentTarget.style.borderColor=C.border}
          style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:"14px 15px",cursor:"pointer",
            touchAction:"manipulation",WebkitTapHighlightColor:"transparent",transition:"border-color .15s"}}>
          <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:6,flexWrap:"wrap"}}>
            <TypeTag type={s.type}/>
            <span style={{color:C.faint,fontSize:11,fontWeight:600}}>{s.era}</span>
            {read.includes(s.id)&&<span style={{color:C.green,fontSize:10,fontWeight:700,letterSpacing:0.8}}>READ</span>}
          </div>
          <div style={{color:C.text,fontSize:14.5,fontWeight:700,marginBottom:4}}>{s.title}</div>
          <div style={{color:C.faint,fontSize:11.5}}>{s.tags.join(" · ")}</div>
        </div>
      ))}
    </div>
    <Btn onClick={()=>setMode("intro")} secondary full>Back</Btn>
  </>);

  // ── Reader (browse mode, answer visible) ─────────────────────────────────
  if(mode==="reader"&&reading)return shell(<>
    <ExitBar title={reading.title} subtitle={reading.era.toUpperCase()} accent={C.blue} onBack={()=>setMode("browse")} backLabel="List"/>
    <Card>
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:11,flexWrap:"wrap"}}>
        <TypeTag type={reading.type}/>
        <span style={{color:C.faint,fontSize:11.5,fontWeight:600}}>{reading.region}</span>
      </div>
      <p style={{color:C.muted,fontSize:13.5,lineHeight:1.85,margin:0}}>{reading.setup}</p>
      <p style={{color:C.text,fontSize:13.5,fontWeight:700,lineHeight:1.7,margin:"14px 0 0",paddingTop:13,borderTop:`1px solid ${C.border}`}}>{reading.question}</p>
    </Card>
    <Reveal s={reading} picked={null}/>
    <Btn onClick={()=>setMode("browse")} secondary full>Back to the list</Btn>
  </>);

  // ── Play ─────────────────────────────────────────────────────────────────
  const s=deck[idx];
  if(!s)return shell(<><Card><p style={{color:C.muted,margin:0}}>Nothing left in the deck.</p></Card><Btn onClick={()=>setMode("intro")} full>Back</Btn></>);

  return shell(<>
    <ExitBar title={`Scenario ${idx+1} of ${deck.length}`} subtitle="REGIMES" accent={C.blue} onBack={()=>setMode("intro")} backLabel="Exit"/>
    <Card>
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:11,flexWrap:"wrap"}}>
        <TypeTag type={s.type}/>
        <span style={{color:C.faint,fontSize:11.5,fontWeight:600}}>{s.era} · {s.region}</span>
      </div>
      <h2 style={{color:C.text,fontSize:19,fontWeight:700,margin:"0 0 11px",lineHeight:1.35}}>{picked?s.title:"The situation"}</h2>
      <p style={{color:C.muted,fontSize:13.5,lineHeight:1.85,margin:0}}>{s.setup}</p>
      <p style={{color:C.text,fontSize:13.5,fontWeight:700,lineHeight:1.7,margin:"14px 0 0",paddingTop:13,borderTop:`1px solid ${C.border}`}}>{s.question}</p>
    </Card>

    {!picked?(<>
      <div style={{width:"100%",display:"flex",flexDirection:"column",gap:9}}>
        {s.options.map(o=>(
          <div key={o.id} onClick={()=>choose(o.id)}
            onPointerEnter={e=>e.currentTarget.style.borderColor=C.hover}
            onPointerLeave={e=>e.currentTarget.style.borderColor=C.border}
            style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:"16px 16px",cursor:"pointer",
              minHeight:56,display:"flex",alignItems:"center",color:C.text,fontSize:14,fontWeight:600,
              touchAction:"manipulation",WebkitTapHighlightColor:"transparent",transition:"border-color .15s"}}>
            {o.label}
          </div>
        ))}
      </div>
      <p style={{color:C.faint,fontSize:11.5,textAlign:"center",margin:0}}>No clock, no score. Reason it through.</p>
    </>):(<>
      <Reveal s={s} picked={picked}/>
      <Btn onClick={nextScenario} full>{idx+1>=deck.length?"Finish":"Next scenario"}</Btn>
      <Btn onClick={()=>setMode("intro")} secondary full>Stop here</Btn>
    </>)}
  </>);
}
