import { useState, useEffect } from "react";
import { IconCollect, IconConnect, IconSync, IconMath, IconOdds, IconSeq, IconCascade, IconRegimes } from "./components/Icons.jsx";
import { ResultsScreen } from "./components/ResultsScreen.jsx";
import { BeatTheOdds } from "./games/BeatTheOdds.jsx";
import { Cascade } from "./games/Cascade.jsx";
import { Game1 } from "./games/Game1Collect.jsx";
import { Game3 } from "./games/Game3Connect.jsx";
import { Game4 } from "./games/Game4Synchronize.jsx";
import { MentalMath } from "./games/MentalMath.jsx";
import { Regimes } from "./games/Regimes.jsx";
import { Sequences } from "./games/Sequences.jsx";
import { LS, lsGet, resetAllData } from "./lib/storage.js";
import { C } from "./lib/theme.js";
import { BrainProfile } from "./profile/BrainProfile.jsx";
import BANK from "./data/scenarios.json";

// Hub — landing screen and view router.
const best=key=>{const h=lsGet(key);return h.length?Math.max(...h.map(x=>x.score)):null;};
const readCount=()=>{const v=lsGet(LS.regimes);return Array.isArray(v)?v.length:0;};

const SECTIONS=[
  {label:"NEUROLYMPICS",games:[
    {id:"g1",  name:"Collect",      subtitle:"Working memory",        Icon:IconCollect, lsKey:LS.g1},
    {id:"g3",  name:"Connect",      subtitle:"Control · speed",       Icon:IconConnect, lsKey:LS.g3},
    {id:"g4",  name:"Synchronize",  subtitle:"Attention",             Icon:IconSync,    lsKey:LS.g4},
  ]},
  {label:"INTERVIEW PREP",games:[
    {id:"math",name:"Mental Math",  subtitle:"Optiver 80-in-8",       Icon:IconMath,    lsKey:LS.math},
    {id:"ev",  name:"Beat the Odds",subtitle:"Probability & EV",      Icon:IconOdds,    lsKey:LS.ev},
    {id:"seq", name:"Sequences",    subtitle:"Optiver NumberLogic",   Icon:IconSeq,     lsKey:LS.seq},
    {id:"casc",name:"Cascade",      subtitle:"Branching arithmetic",  Icon:IconCascade, lsKey:LS.cascade},
  ]},
  {label:"NO CLOCK",games:[
    {id:"reg", name:"Regimes",      subtitle:"Economic history",      Icon:IconRegimes, lsKey:LS.regimes, unscored:true},
  ]},
];
const ALL_GAMES=SECTIONS.flatMap(s=>s.games);

export default function Hub(){
  const[view,setView]=useState("hub");
  const[activeGame,setActiveGame]=useState(null);
  const[lastResult,setLastResult]=useState(null);
  const[prevBest,setPrevBest]=useState(null);
  const[bests,setBests]=useState({});
  const[read,setRead]=useState(0);
  useEffect(()=>{
    const b={};ALL_GAMES.forEach(g=>{if(!g.unscored)b[g.id]=best(g.lsKey);});
    setBests(b);setRead(readCount());
  },[view]);
  function launchGame(game){setPrevBest(game.unscored?null:best(game.lsKey));setActiveGame(game);setView("game");}
  function handleFinish(result){setLastResult(result);setView("results");}
  function goHub(){setView("hub");setActiveGame(null);setLastResult(null);}
  if(view==="profile")return<BrainProfile onBack={goHub}/>;
  if(view==="game"){
    const props={onBack:goHub,onFinish:handleFinish};
    if(activeGame.id==="g1")return<Game1 {...props}/>;
    if(activeGame.id==="g3")return<Game3 {...props}/>;
    if(activeGame.id==="g4")return<Game4 {...props}/>;
    if(activeGame.id==="math")return<MentalMath {...props}/>;
    if(activeGame.id==="ev")return<BeatTheOdds {...props}/>;
    if(activeGame.id==="seq")return<Sequences {...props}/>;
    if(activeGame.id==="casc")return<Cascade {...props}/>;
    if(activeGame.id==="reg")return<Regimes onBack={goHub}/>;
  }
  if(view==="results")return<ResultsScreen game={activeGame} result={lastResult} prevBest={prevBest} onBack={goHub}/>;

  const GameCard=({g})=>{
    const b=bests[g.id];
    return(
      <div onClick={()=>launchGame(g)}
        onPointerEnter={e=>e.currentTarget.style.borderColor=C.hover}
        onPointerLeave={e=>e.currentTarget.style.borderColor=C.border}
        style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:15,padding:"15px 16px",cursor:"pointer",
          display:"flex",alignItems:"center",gap:15,minHeight:80,transition:"border-color .15s",
          touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>
        <div style={{flexShrink:0,display:"flex"}}><g.Icon/></div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:C.text,fontWeight:700,fontSize:15.5,marginBottom:3}}>{g.name}</div>
          <div style={{color:C.muted,fontSize:11.5,letterSpacing:0.3}}>{g.subtitle}</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          {g.unscored?(<>
            <div style={{color:C.faint,fontSize:9,letterSpacing:1.2,fontWeight:600,marginBottom:2}}>READ</div>
            <div style={{color:C.blue,fontWeight:700,fontSize:17}}>{read}<span style={{color:C.faint,fontSize:11}}>/{BANK.scenarios.length}</span></div>
          </>):b!==null?(<>
            <div style={{color:C.faint,fontSize:9,letterSpacing:1.2,fontWeight:600,marginBottom:2}}>BEST</div>
            <div style={{color:C.accent,fontWeight:700,fontSize:19}}>{b}</div>
          </>):(
            <div style={{color:C.faint,fontSize:11.5}}>not played</div>
          )}
        </div>
      </div>
    );
  };

  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:C.text,padding:"26px 16px"}}>
      <div style={{maxWidth:530,width:"100%"}}>
        <div style={{marginBottom:26,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div>
            <h1 style={{fontSize:25,fontWeight:700,color:C.text,margin:"0 0 4px",letterSpacing:0.2}}>NeurOlympics</h1>
            <p style={{color:C.muted,fontSize:11,margin:0,letterSpacing:1.3,fontWeight:600}}>COGNITIVE ASSESSMENT</p>
          </div>
          <button onClick={()=>setView("profile")}
            onPointerEnter={e=>{e.currentTarget.style.borderColor=C.hover;e.currentTarget.style.color=C.text;}}
            onPointerLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}
            style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted,borderRadius:11,padding:"0 18px",
              height:46,fontSize:13,fontWeight:600,cursor:"pointer",touchAction:"manipulation",whiteSpace:"nowrap",transition:"border-color .15s,color .15s"}}>
            Brain map
          </button>
        </div>
        {SECTIONS.map(sec=>(
          <div key={sec.label} style={{marginBottom:24}}>
            <p style={{color:C.faint,fontSize:9.5,letterSpacing:2,fontWeight:700,marginBottom:11}}>{sec.label}</p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {sec.games.map(g=><GameCard key={g.id} g={g}/>)}
            </div>
          </div>
        ))}
        <p style={{color:C.faint,fontSize:11.5,textAlign:"center",marginTop:4}}>Every scored game ends with a rating out of 1000</p>
        <div style={{textAlign:"center",marginTop:16}}>
          <button onClick={()=>{if(window.confirm("Reset all scores and session history? This cannot be undone.")){resetAllData();window.location.reload();}}}
            onPointerEnter={e=>e.currentTarget.style.borderColor=C.hover}
            onPointerLeave={e=>e.currentTarget.style.borderColor=C.border}
            style={{background:"transparent",border:`1px solid ${C.border}`,color:C.faint,borderRadius:10,padding:"0 18px",
              height:42,fontSize:11.5,cursor:"pointer",touchAction:"manipulation",transition:"border-color .15s"}}>Reset all data</button>
        </div>
      </div>
    </div>
  );
}
