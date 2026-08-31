import { ExitBar } from "../components/GameBar.jsx";
import { BENCH, band, clamp01 } from "../lib/scoring.js";
import { LS, lsGet } from "../lib/storage.js";
import { C } from "../lib/theme.js";
import { TYPE_LABELS } from "../games/Sequences.jsx";
import BANK from "../data/scenarios.json";

// Brain map — one axis per scored game: Collect, Connect, Synchronize,
// Mental Math, Beat the Odds, Sequences, Cascade. Regimes is deliberately
// absent from the scoring, and appears only as reading progress.
function computeProfile(){
  const g1=lsGet(LS.g1),g3=lsGet(LS.g3),g4=lsGet(LS.g4),gm=lsGet(LS.math),ge=lsGet(LS.ev),gs=lsGet(LS.seq),gc=lsGet(LS.cascade);
  const regimesRead=(()=>{const v=lsGet(LS.regimes);return Array.isArray(v)?v.length:0;})();
  const last=a=>a.length?a[a.length-1]:null;
  const l1=last(g1),l3=last(g3),l4=last(g4),lm=last(gm),le=last(ge),ls=last(gs),lc=last(gc);
  const axes=[
    {key:"g1",  label:"Memory",     color:C.accent,score:l1?Math.round(l1.score/10):null},
    {key:"g3",  label:"Speed",      color:C.green, score:l3?Math.round(l3.score/10):null},
    {key:"g4",  label:"Attention",  color:C.amber, score:l4?Math.round(l4.score/10):null},
    {key:"math",label:"Arithmetic", color:C.pink,  score:lm?Math.round(lm.score/10):null},
    {key:"ev",  label:"Probability",color:C.blue,  score:le?Math.round(le.score/10):null},
    {key:"seq", label:"Patterns",   color:C.purple,score:ls?Math.round(ls.score/10):null},
    {key:"casc",label:"Branching",  color:"#f0883e",score:lc?Math.round(lc.score/10):null},
  ];
  const pct=v=>Math.round(clamp01(v)*100);
  const subs=[];
  if(l1){
    subs.push({label:"Memory span",raw:`${l1.ceiling} shapes`,score:pct(band(l1.ceiling,BENCH.g1.ceilingLo,BENCH.g1.ceilingHi))});
    subs.push({label:"Partial recall",raw:`${l1.accuracy}%`,score:pct(band(l1.accuracy,BENCH.g1.accLo,BENCH.g1.accHi))});
    if(l1.perfectRate!=null)subs.push({label:"Clean trials",raw:`${l1.perfectRate}%`,score:pct(band(l1.perfectRate,0,100))});
    subs.push({label:"Distractor filtering",raw:`${l1.distractorAcc}%`,score:pct(band(l1.distractorAcc,BENCH.g1.accLo,BENCH.g1.accHi))});
    subs.push({label:"Cognitive flexibility",raw:`${l1.dirAcc}%`,score:pct(band(l1.dirAcc,BENCH.g1.accLo,BENCH.g1.accHi))});
  }
  if(l3){
    subs.push({label:"Decision speed",raw:`${l3.avgRt}ms`,score:pct(band(l3.avgRt,BENCH.g3.rtSlow,BENCH.g3.rtFast))});
    subs.push({label:"Response accuracy",raw:`${l3.acc}%`,score:pct(band(l3.acc,0,100))});
  }
  if(l4){
    subs.push({label:"Focus under distraction",raw:`${l4.acc}%`,score:pct(band(l4.acc,0,100))});
    if(l4.avgRt)subs.push({label:"Sustained reaction",raw:`${l4.avgRt}ms`,score:pct(band(l4.avgRt,BENCH.g4.rtSlow,BENCH.g4.rtFast))});
  }
  if(lm){
    subs.push({label:"Arithmetic net",raw:`${lm.net} in 4 min`,score:pct(lm.net/BENCH.math.netElite)});
    if(lm.qpm)subs.push({label:"Arithmetic pace",raw:`${lm.qpm} Q/min`,score:pct(band(lm.qpm,2,10))});
  }
  if(le)subs.push({label:"Probability & EV",raw:`${le.net} net`,score:pct(le.net/BENCH.ev.netElite)});
  if(ls){
    subs.push({label:"Pattern recognition",raw:`${ls.net} net`,score:pct(ls.net/BENCH.seq.netElite)});
    if(ls.avgMs)subs.push({label:"Sequence pace",raw:`${(ls.avgMs/1000).toFixed(1)}s / q`,score:pct(band(ls.avgMs,BENCH.seq.msSlow,BENCH.seq.msFast))});
  }
  if(lc){
    subs.push({label:"Branch accuracy",raw:`${lc.accuracy}%`,score:pct(band(lc.accuracy,0,100))});
    subs.push({label:"Value retained",raw:`${lc.retained}%`,score:pct(band(lc.retained/100,BENCH.cascade.retLo,1))});
    if(lc.medianMs)subs.push({label:"Branch pace",raw:`${(lc.medianMs/1000).toFixed(1)}s / step`,score:pct(band(lc.medianMs,BENCH.cascade.msSlow,BENCH.cascade.msFast))});
    if(lc.trapA)subs.push({label:"Two-step traps",raw:`${lc.trapC}/${lc.trapA}`,score:pct(lc.trapC/lc.trapA)});
  }
  return{axes,subs,g1,g3,g4,gm,ge,gs,gc,ls,lc,regimesRead};
}

function SpiderChart({dims}){
  const cx=150,cy=150,r=98,n=dims.length;
  const angle=i=>(i/n)*2*Math.PI-Math.PI/2;
  const pt=(i,frac)=>[cx+r*frac*Math.cos(angle(i)),cy+r*frac*Math.sin(angle(i))];
  const rings=[0.25,0.5,0.75,1];
  const polyPts=dims.map((_,i)=>pt(i,dims[i].score/100)).map(p=>p.join(",")).join(" ");
  return(
    <svg viewBox="-30 -22 360 344" width="100%" style={{display:"block",margin:"0 auto",maxWidth:330}}>
      {rings.map(f=>(<polygon key={f} points={dims.map((_,i)=>pt(i,f).join(",")).join(" ")} fill="none" stroke={C.border} strokeWidth={1}/>))}
      {dims.map((_,i)=>(<line key={i} x1={cx} y1={cy} x2={pt(i,1)[0]} y2={pt(i,1)[1]} stroke={C.border} strokeWidth={1}/>))}
      <polygon points={polyPts} fill="#5ecef724" stroke={C.accent} strokeWidth={2} strokeLinejoin="round"/>
      {dims.map((d,i)=>(<circle key={i} cx={pt(i,d.score/100)[0]} cy={pt(i,d.score/100)[1]} r={5} fill={d.color}/>))}
      {dims.map((d,i)=>{const[lx,ly]=pt(i,1.24);return(
        <g key={i}>
          <text x={lx} y={ly} textAnchor="middle" fill={C.text} fontSize={11.5} fontWeight={700}>{d.label}</text>
          <text x={lx} y={ly+14} textAnchor="middle" fill={d.score?d.color:C.faint} fontSize={10.5} fontWeight={600}>{d.score||"—"}</text>
        </g>
      );})}
    </svg>
  );
}

function SessionChart({sessions,valueKey,label,color,invert=false}){
  const vals=(sessions||[]).map(s=>s[valueKey]).filter(v=>v!=null);
  if(vals.length<2)return(
    <div><div style={{color:C.faint,fontSize:10,letterSpacing:1.2,fontWeight:600,marginBottom:4}}>{label.toUpperCase()}</div>
    <div style={{color:C.faint,fontSize:11.5,padding:"14px 0"}}>Needs at least two sessions</div></div>
  );
  const min=Math.min(...vals),max=Math.max(...vals);
  const W=260,H=70,px=8,py=12;
  const xs=(W-px*2)/(vals.length-1);
  const ys=v=>invert?py+((v-min)/(max-min||1))*(H-py*2):H-py-((v-min)/(max-min||1))*(H-py*2);
  const pts=vals.map((v,i)=>[px+i*xs,ys(v)]);
  return(
    <div>
      <div style={{color:C.faint,fontSize:10,letterSpacing:1.2,fontWeight:600,marginBottom:4}}>{label.toUpperCase()}</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{display:"block",maxWidth:W}}>
        <polyline points={pts.map(p=>p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round"/>
        {pts.map(([x,y],i)=><circle key={i} cx={x} cy={y} r={3} fill={color}/>)}
        <text x={px} y={H-1} fill={C.muted} fontSize={9.5}>{vals[0]}</text>
        <text x={W-px} y={H-1} textAnchor="end" fill={C.muted} fontSize={9.5}>{vals[vals.length-1]}</text>
      </svg>
    </div>
  );
}

const FOCUS_TIPS={
  "Memory span":"Chunk positions into shapes or rows instead of memorising each cell.",
  "Partial recall":"Slow the encoding. A clean mental snapshot beats a rushed one.",
  "Clean trials":"You are close on most trials. Lock in the last shape before you start tapping.",
  "Distractor filtering":"Label the orange as ignore the instant it appears.",
  "Cognitive flexibility":"Commit to hunting for the single rotation before the grids show.",
  "Decision speed":"Drill the mapping until the press is automatic.",
  "Response accuracy":"Trade a few milliseconds for correctness. Wrong answers cost double.",
  "Focus under distraction":"Fixate on the centre and let the flankers blur in your periphery.",
  "Sustained reaction":"Keep fingers resting on 0 and 1 between trials.",
  "Arithmetic net":"Build accuracy first, then speed. Wrong answers subtract.",
  "Arithmetic pace":"Learn the 2×2 shortcuts, near-100 and difference of squares, to cut steps.",
  "Probability & EV":"Memorise the fraction to percent conversions and the two-dice sum table.",
  "Pattern recognition":"Take the first differences, then the second. That identifies most families instantly.",
  "Sequence pace":"Rule out ratios before reaching for quadratics.",
  "Branch accuracy":"Convert both branches to the same form before comparing, rather than computing each fully.",
  "Value retained":"Your errors are landing on the wide-margin steps. Slow down when the two options look far apart.",
  "Branch pace":"Estimate first, compute only if the estimate is close.",
  "Two-step traps":"Check the divisors of the number you would be left with, not just its size.",
};

export function BrainProfile({onBack}){
  const{axes,subs,g1,g3,g4,gm,ge,gs,gc,ls,lc,regimesRead}=computeProfile();
  const hasAnyData=[g1,g3,g4,gm,ge,gs,gc].some(a=>a.length>0);
  const dims=axes.map(a=>({...a,score:a.score==null?0:a.score}));
  const sorted=[...subs].sort((a,b)=>a.score-b.score);
  const weakest=sorted.slice(0,3);const strongest=sorted.slice(-2).reverse();
  const seqTypes=ls&&ls.types?Object.entries(ls.types).filter(([,v])=>v.a>0).sort((a,b)=>(a[1].c/a[1].a)-(b[1].c/b[1].a)):[];
  const card={background:C.surface,border:`1px solid ${C.border}`,borderRadius:15,padding:17,marginBottom:14};
  const heading=t=>(<p style={{color:C.faint,fontSize:10,letterSpacing:1.6,fontWeight:700,margin:"0 0 12px"}}>{t}</p>);

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI',sans-serif",color:C.text,padding:"18px 14px 40px"}}>
      <div style={{maxWidth:690,margin:"0 auto"}}>
        <div style={{marginBottom:20}}>
          <ExitBar title="Brain map" subtitle="LATEST SESSION PER GAME" onBack={onBack} backLabel="Hub"/>
        </div>
        {!hasAnyData?(
          <div style={{...card,padding:"44px 20px",textAlign:"center"}}><p style={{color:C.muted,fontSize:14,margin:0}}>No data yet. Play a scored game first.</p></div>
        ):(<>
          <div style={{...card,textAlign:"center"}}>
            {heading("COGNITIVE PROFILE")}
            <SpiderChart dims={dims}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(88px,1fr))",gap:8,marginTop:16}}>
              {dims.map(d=>(
                <div key={d.label} style={{background:C.dim,borderRadius:10,padding:"11px 5px"}}>
                  <div style={{color:C.faint,fontSize:8.5,letterSpacing:0.8,fontWeight:700,marginBottom:4}}>{d.label.toUpperCase()}</div>
                  <div style={{color:d.score?d.color:C.faint,fontSize:18,fontWeight:700}}>{d.score||"—"}</div>
                  <div style={{background:"#232b3d",borderRadius:3,height:4,marginTop:6}}><div style={{width:`${d.score}%`,height:"100%",background:d.color,borderRadius:3}}/></div>
                </div>
              ))}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(215px,1fr))",gap:12,marginBottom:14}}>
            <div style={{...card,marginBottom:0}}>{heading("STRONGEST")}
              {strongest.length===0?<p style={{color:C.muted,fontSize:12.5,margin:0}}>Play more</p>:strongest.map(s=>(
                <div key={s.label} style={{marginBottom:11}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:4}}>
                    <span style={{color:C.text,fontSize:13}}>{s.label}</span><span style={{color:C.green,fontSize:13,fontWeight:700}}>{s.score}</span>
                  </div>
                  <div style={{background:"#232b3d",borderRadius:3,height:4}}><div style={{width:`${s.score}%`,height:"100%",background:C.green,borderRadius:3}}/></div>
                </div>
              ))}
            </div>
            <div style={{...card,marginBottom:0}}>{heading("NEEDS WORK")}
              {weakest.length===0?<p style={{color:C.muted,fontSize:12.5,margin:0}}>Play more</p>:weakest.map(s=>(
                <div key={s.label} style={{marginBottom:11}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:4}}>
                    <span style={{color:C.text,fontSize:13}}>{s.label}</span><span style={{color:C.red,fontSize:13,fontWeight:700}}>{s.score}</span>
                  </div>
                  <div style={{background:"#232b3d",borderRadius:3,height:4}}><div style={{width:`${s.score}%`,height:"100%",background:C.red,borderRadius:3}}/></div>
                </div>
              ))}
            </div>
          </div>

          {weakest.length>0&&(
            <div style={card}>{heading("WHAT TO FOCUS ON")}
              {weakest.slice(0,2).map(s=>(
                <div key={s.label} style={{marginBottom:11,paddingBottom:11,borderBottom:`1px solid ${C.border}`}}>
                  <div style={{color:C.text,fontSize:13.5,fontWeight:700,marginBottom:5}}>{s.label} · {s.score}/100 <span style={{color:C.muted,fontWeight:400}}>({s.raw})</span></div>
                  <div style={{color:C.muted,fontSize:12.5,lineHeight:1.7}}>{FOCUS_TIPS[s.label]||"Keep practising to raise this score."}</div>
                </div>
              ))}
            </div>
          )}

          {seqTypes.length>0&&(
            <div style={card}>{heading("SEQUENCE PATTERNS · LAST SESSION")}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(215px,1fr))",gap:9}}>
                {seqTypes.map(([type,v])=>{const p=Math.round(v.c/v.a*100);return(
                  <div key={type} style={{display:"flex",alignItems:"center",gap:9}}>
                    <span style={{color:C.muted,fontSize:11.5,width:126,flexShrink:0}}>{TYPE_LABELS[type]||type}</span>
                    <div style={{flex:1,background:"#232b3d",borderRadius:3,height:5}}><div style={{width:`${p}%`,height:"100%",background:p>=60?C.purple:p>=35?C.amber:C.red,borderRadius:3}}/></div>
                    <span style={{color:C.text,fontSize:11.5,width:36,textAlign:"right"}}>{v.c}/{v.a}</span>
                  </div>
                );})}
              </div>
            </div>
          )}

          <div style={card}>{heading("ALL METRICS")}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:9}}>
              {subs.map(s=>(
                <div key={s.label} style={{display:"flex",alignItems:"center",gap:9}}>
                  <span style={{color:C.muted,fontSize:11.5,width:128,flexShrink:0}}>{s.label}</span>
                  <div style={{flex:1,background:"#232b3d",borderRadius:3,height:5}}><div style={{width:`${s.score}%`,height:"100%",background:s.score>=60?C.accent:s.score>=35?C.amber:C.red,borderRadius:3}}/></div>
                  <span style={{color:C.text,fontSize:11.5,width:62,textAlign:"right"}}>{s.raw}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={card}>{heading("PROGRESS OVER SESSIONS")}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(225px,1fr))",gap:18}}>
              <SessionChart sessions={g1} valueKey="score" label="Memory rating" color={C.accent}/>
              <SessionChart sessions={g3} valueKey="avgRt" label="Speed · avg RT ms" color={C.green} invert/>
              <SessionChart sessions={g4} valueKey="avgRt" label="Attention · avg RT ms" color={C.amber} invert/>
              <SessionChart sessions={gm} valueKey="net" label="Arithmetic net" color={C.pink}/>
              <SessionChart sessions={ge} valueKey="net" label="Probability net" color={C.blue}/>
              <SessionChart sessions={gs} valueKey="net" label="Sequences net" color={C.purple}/>
              <SessionChart sessions={gc} valueKey="retained" label="Cascade value kept %" color="#f0883e"/>
            </div>
          </div>

          <div style={card}>{heading("READING")}
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{color:C.muted,fontSize:12.5,flexShrink:0}}>Regimes</span>
              <div style={{flex:1,background:"#232b3d",borderRadius:4,height:6}}>
                <div style={{width:`${regimesRead/BANK.scenarios.length*100}%`,height:"100%",background:C.blue,borderRadius:4}}/>
              </div>
              <span style={{color:C.text,fontSize:12.5,fontWeight:700,whiteSpace:"nowrap"}}>{regimesRead} / {BANK.scenarios.length}</span>
            </div>
            <p style={{color:C.faint,fontSize:11.5,lineHeight:1.6,margin:"11px 0 0"}}>Regimes is not scored and does not feed the map. This is reading progress only.</p>
          </div>

          <div style={{...card,marginBottom:24}}>{heading("SESSION LOG")}
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
                <thead><tr>{["Date","Game","Key metric","Rating"].map(h=>(
                  <th key={h} style={{color:C.faint,fontWeight:700,textAlign:"left",padding:"5px 8px",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap",fontSize:11}}>{h}</th>
                ))}</tr></thead>
                <tbody>
                  {[
                    ...g1.map(s=>({date:s.date,game:"Collect",metric:`Ceiling ${s.ceiling} · recall ${s.accuracy}%`,score:s.score})),
                    ...g3.map(s=>({date:s.date,game:"Connect",metric:`RT ${s.avgRt}ms · acc ${s.acc}%`,score:s.score})),
                    ...g4.map(s=>({date:s.date,game:"Synchronize",metric:`RT ${s.avgRt??s.bestRt}ms · acc ${s.acc}%`,score:s.score})),
                    ...gm.map(s=>({date:s.date,game:"Mental Math",metric:`Net ${s.net} · ${s.qpm} Q/min`,score:s.score})),
                    ...ge.map(s=>({date:s.date,game:"Beat the Odds",metric:`Net ${s.net} · ${s.correct} correct`,score:s.score})),
                    ...gs.map(s=>({date:s.date,game:"Sequences",metric:`Net ${s.net} · ${s.correct} right`,score:s.score})),
                    ...gc.map(s=>({date:s.date,game:"Cascade",metric:`${s.accuracy}% best · ${s.retained}% kept`,score:s.score})),
                  ].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,26).map((r,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${C.dim}`}}>
                      <td style={{padding:"7px 8px",color:C.muted,whiteSpace:"nowrap"}}>{r.date}</td>
                      <td style={{padding:"7px 8px",color:C.text,whiteSpace:"nowrap",fontWeight:600}}>{r.game}</td>
                      <td style={{padding:"7px 8px",color:C.muted}}>{r.metric}</td>
                      <td style={{padding:"7px 8px",color:C.accent,fontWeight:700}}>{r.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>)}
      </div>
    </div>
  );
}
