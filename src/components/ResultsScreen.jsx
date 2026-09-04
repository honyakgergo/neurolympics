import { Btn } from "./Btn.jsx";
import { C } from "../lib/theme.js";

// Results screen shown after every scored session.
export function ResultsScreen({game,result,prevBest,onBack}){
  const improved=prevBest!==null&&result.score>prevBest;
  const diff=prevBest!==null?result.score-prevBest:null;
  return(
    <div style={{minHeight:"100dvh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:C.text,padding:20}}>
      <div style={{maxWidth:400,width:"100%",textAlign:"center"}}>
        <p style={{color:C.faint,fontSize:10,letterSpacing:2,fontWeight:700,marginBottom:8}}>{game.name.toUpperCase()}</p>
        <h2 style={{color:C.text,fontSize:23,fontWeight:700,margin:"0 0 4px"}}>Session complete</h2>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"26px 20px",margin:"20px 0"}}>
          <div style={{fontSize:44,fontWeight:700,color:C.accent,marginBottom:6,letterSpacing:-1}}>{result.score}</div>
          <div style={{color:C.muted,fontSize:13,fontWeight:600,marginBottom:10}}>{result.label}</div>
          <div style={{color:C.muted,fontSize:12.5,lineHeight:1.7}}>{result.detail}</div>
        </div>
        {prevBest!==null?(
          <div style={{background:improved?"#0c1a12":C.surface,border:`1px solid ${improved?"#2c5a3c":C.border}`,borderRadius:13,padding:"16px",marginBottom:20}}>
            <div style={{color:C.faint,fontSize:10,letterSpacing:1.5,fontWeight:700,marginBottom:6}}>PERSONAL BEST {prevBest}</div>
            <div style={{fontSize:19,fontWeight:700,color:improved?C.green:C.muted}}>
              {improved?`+${diff} above best`:diff===0?"Matched your best":`${diff} below best`}
            </div>
          </div>
        ):(
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:"16px",marginBottom:20}}>
            <div style={{color:C.muted,fontSize:12.5}}>First session. This is now your personal best.</div>
          </div>
        )}
        <Btn onClick={onBack} secondary full>Back to hub</Btn>
      </div>
    </div>
  );
}
