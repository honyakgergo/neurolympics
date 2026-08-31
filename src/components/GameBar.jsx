import { C } from "../lib/theme.js";

// One control, in the same place, in every game: Pause.
// Exiting always goes through the pause overlay, so a single stray tap can
// never throw away a run in progress.
export function GameBar({stats=[],onPause,accent=C.accent,label,compact}){
  const pad=compact?10:16, h=compact?38:44, gap=compact?12:16;
  return(
    <div style={{width:"100%",display:"flex",alignItems:"center",gap:12,flexWrap:compact?"nowrap":"wrap",justifyContent:"space-between"}}>
      <div style={{display:"flex",gap,alignItems:"center",flexWrap:compact?"nowrap":"wrap",minWidth:0,overflow:"hidden"}}>
        {label&&!compact&&<div style={{color:accent,fontSize:11,fontWeight:700,letterSpacing:1.4}}>{label}</div>}
        {stats.map(s=>(
          <div key={s.label} style={{textAlign:"center",minWidth:compact?30:38}}>
            <div style={{color:C.faint,fontSize:compact?8.5:9,letterSpacing:1.2,fontWeight:600}}>{s.label}</div>
            <div style={{color:s.color||C.text,fontWeight:700,fontSize:compact?15:17,fontVariantNumeric:"tabular-nums"}}>
              {s.value}{s.sub&&<span style={{color:C.faint,fontSize:compact?10:11,fontWeight:600}}>{s.sub}</span>}
            </div>
          </div>
        ))}
      </div>
      <button onClick={onPause} aria-label="Pause"
        onPointerEnter={e=>{e.currentTarget.style.borderColor=C.hover;e.currentTarget.style.color=C.text;}}
        onPointerLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}
        style={{display:"flex",alignItems:"center",gap:compact?0:8,background:C.surface,border:`1px solid ${C.border}`,color:C.muted,
          borderRadius:10,padding:`0 ${pad}px`,height:h,fontSize:13,fontWeight:600,cursor:"pointer",flexShrink:0,
          touchAction:"manipulation",WebkitTapHighlightColor:"transparent",transition:"border-color .15s,color .15s"}}>
        <svg width={12} height={13} viewBox="0 0 12 13" aria-hidden="true">
          <rect x={0} y={0} width={4} height={13} rx={1.4} fill="currentColor"/>
          <rect x={8} y={0} width={4} height={13} rx={1.4} fill="currentColor"/>
        </svg>
        {!compact&&"Pause"}
      </button>
    </div>
  );
}

// For screens with nothing to lose: intros, briefs, browse modes.
export function ExitBar({title,subtitle,accent=C.accent,onBack,backLabel="Hub"}){
  return(
    <div style={{width:"100%",display:"flex",alignItems:"center",gap:12,justifyContent:"space-between"}}>
      <div style={{minWidth:0}}>
        {title&&<div style={{color:C.text,fontSize:16,fontWeight:700}}>{title}</div>}
        {subtitle&&<div style={{color:accent,fontSize:10,fontWeight:700,letterSpacing:1.3,marginTop:2}}>{subtitle}</div>}
      </div>
      <button onClick={onBack}
        onPointerEnter={e=>{e.currentTarget.style.borderColor=C.hover;e.currentTarget.style.color=C.text;}}
        onPointerLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}
        style={{display:"flex",alignItems:"center",gap:8,background:C.surface,border:`1px solid ${C.border}`,color:C.muted,
          borderRadius:10,padding:"0 16px",height:44,fontSize:13,fontWeight:600,cursor:"pointer",flexShrink:0,
          touchAction:"manipulation",WebkitTapHighlightColor:"transparent",transition:"border-color .15s,color .15s"}}>
        <svg width={13} height={13} viewBox="0 0 13 13" aria-hidden="true">
          <path d="M7 1 L2 6.5 L7 12" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2.6 6.5 H12" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"/>
        </svg>
        {backLabel}
      </button>
    </div>
  );
}
