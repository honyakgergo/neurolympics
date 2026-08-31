import { useState } from "react";
import { C } from "../lib/theme.js";

// Pause overlay. Exiting is a two-step confirm, because leaving mid-run throws
// the session away and that should never happen by accident.
export function PauseOverlay({ onResume, onHub, warnOnExit=true }) {
  const[confirming,setConfirming]=useState(false);
  const btn=(primary)=>({
    background:primary?C.accent:"transparent",
    color:primary?"#060a12":C.text,
    border:primary?"none":`1px solid ${C.border}`,
    borderRadius:11,minHeight:50,padding:"0 30px",fontSize:15,fontWeight:700,
    cursor:"pointer",touchAction:"manipulation",WebkitTapHighlightColor:"transparent",width:"100%",
  });
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(4,6,11,0.88)",backdropFilter:"blur(3px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,fontFamily:"'Segoe UI',sans-serif",padding:20}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:18,padding:"30px 28px",textAlign:"center",width:"100%",maxWidth:320,boxSizing:"border-box"}}>
        {!confirming?(<>
          <p style={{color:C.faint,fontSize:10,letterSpacing:2,fontWeight:700,margin:"0 0 6px"}}>PAUSED</p>
          <p style={{color:C.text,fontSize:17,fontWeight:700,margin:"0 0 22px"}}>Session on hold</p>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button onClick={onResume} style={btn(true)}>Resume</button>
            <button onClick={()=>warnOnExit?setConfirming(true):onHub()} style={btn(false)}>Exit to hub</button>
          </div>
          <p style={{color:C.faint,fontSize:11,margin:"18px 0 0"}}>Esc also resumes</p>
        </>):(<>
          <p style={{color:C.amber,fontSize:10,letterSpacing:2,fontWeight:700,margin:"0 0 6px"}}>EXIT WITHOUT SAVING?</p>
          <p style={{color:C.text,fontSize:14,fontWeight:600,lineHeight:1.6,margin:"0 0 22px"}}>This run is unfinished, so nothing will be recorded in your profile.</p>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button onClick={onHub} style={{...btn(false),borderColor:"#5a2f34",color:C.red}}>Discard and exit</button>
            <button onClick={()=>setConfirming(false)} style={btn(true)}>Keep playing</button>
          </div>
        </>)}
      </div>
    </div>
  );
}
