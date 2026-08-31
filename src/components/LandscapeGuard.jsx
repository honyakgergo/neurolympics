import { useState, useEffect } from "react";

// Touch detection, used to pick a layout. Evaluated once per mount by the
// games, because switching board geometry mid-session would invalidate
// coordinates already held in state.
export function isTouchDevice(){
  return (navigator.maxTouchPoints||0)>0;
}
function isPortraitTouch(){
  return isTouchDevice() && window.innerHeight > window.innerWidth;
}

// Wraps the two reaction games. On touch devices held in portrait it asks the
// user to rotate; desktop browsers are never blocked, since they have a
// keyboard and a tall window is fine there.
export function LandscapeGuard({ children }) {
  const [portrait, setPortrait] = useState(isPortraitTouch());
  useEffect(() => {
    const fn = () => setPortrait(isPortraitTouch());
    window.addEventListener("resize", fn);
    window.addEventListener("orientationchange", fn);
    return () => { window.removeEventListener("resize", fn); window.removeEventListener("orientationchange", fn); };
  }, []);
  if (!portrait) return children;
  return (
    <div style={{minHeight:"100vh",background:"#080b12",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:"#e8ecf5",padding:32,textAlign:"center",gap:14}}>
      <svg width={64} height={64} viewBox="0 0 64 64">
        <rect x={5} y={12} width={40} height={28} rx={5} fill="none" stroke="#5ecef7" strokeWidth={2.5}/>
        <path d="M50 22 L59 32 L50 42" fill="none" stroke="#5ecef7" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <p style={{color:"#5ecef7",fontWeight:700,fontSize:18,margin:0}}>Rotate your phone</p>
      <p style={{color:"#a4aec4",fontSize:14,margin:0,maxWidth:320,lineHeight:1.6}}>This game runs in landscape. The left and right halves of the screen are your two buttons.</p>
    </div>
  );
}
