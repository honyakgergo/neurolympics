import { useState, useEffect } from "react";

// Wraps the two reaction games. On touch devices held in portrait it asks the
// user to rotate; desktop browsers are never blocked (a tall window is fine
// there because there is a keyboard).
function isPortraitTouch(){
  const touch = (navigator.maxTouchPoints || 0) > 0;
  return touch && window.innerHeight > window.innerWidth;
}

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
    <div style={{minHeight:"100vh",background:"#080b12",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif",color:"#c8cdd8",padding:32,textAlign:"center",gap:14}}>
      <svg width={64} height={64} viewBox="0 0 64 64">
        <rect x={5} y={12} width={40} height={28} rx={5} fill="none" stroke="#5ecef7" strokeWidth={2.5}/>
        <path d="M50 22 L59 32 L50 42" fill="none" stroke="#5ecef7" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <p style={{color:"#5ecef7",fontWeight:700,fontSize:18,margin:0}}>Rotate your phone</p>
      <p style={{color:"#3a3f50",fontSize:14,margin:0}}>This game needs landscape — the left and right halves of the screen are your two buttons.</p>
    </div>
  );
}
