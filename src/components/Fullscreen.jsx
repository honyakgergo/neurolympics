import { useFullscreen } from "../lib/fullscreen.js";
import { C } from "../lib/theme.js";

function ExpandIcon({on}){
  // Four corner brackets, pointing out to enter and in to exit.
  const d=on
    ?"M6 1 V6 H1 M12 1 V6 H17 M6 17 V12 H1 M12 17 V12 H17"
    :"M1 6 V1 H6 M17 6 V1 H12 M1 12 V17 H6 M17 12 V17 H12";
  return(
    <svg width={16} height={16} viewBox="0 0 18 18" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Hidden entirely where the Fullscreen API is unavailable (iPhone Safari), so
// the UI never offers a control that cannot work.
// `variant="icon"` is the square button for the hub header; "wide" is the
// full-width row used inside the pause overlay.
export function FullscreenButton({variant="icon"}){
  const{on,toggle,supported}=useFullscreen();
  if(!supported)return null;
  const wide=variant==="wide";
  return(
    <button onClick={toggle} aria-label={on?"Exit fullscreen":"Enter fullscreen"} title={on?"Exit fullscreen":"Fullscreen"}
      onPointerEnter={e=>{e.currentTarget.style.borderColor=C.hover;e.currentTarget.style.color=C.text;}}
      onPointerLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}
      style={{display:"flex",alignItems:"center",justifyContent:"center",gap:9,background:wide?"transparent":C.surface,
        border:`1px solid ${C.border}`,color:C.muted,borderRadius:11,
        padding:wide?"0 30px":"0 14px",height:wide?50:46,minWidth:46,width:wide?"100%":undefined,
        fontSize:wide?15:13,fontWeight:wide?700:600,cursor:"pointer",flexShrink:0,
        touchAction:"manipulation",WebkitTapHighlightColor:"transparent",transition:"border-color .15s,color .15s"}}>
      <ExpandIcon on={on}/>
      {wide&&(on?"Exit fullscreen":"Fullscreen")}
    </button>
  );
}
