import { useState, useEffect, useCallback } from "react";

// Fullscreen, mainly so the browser's address bar stops eating the top of the
// board on a phone. Android Chrome and desktop support the Fullscreen API;
// iPhone Safari does not expose it at all, which is why the button hides itself
// rather than throwing — on iOS the way to lose the browser chrome is
// "Add to Home Screen", which the web app manifest in index.html enables.
const current = () => document.fullscreenElement || document.webkitFullscreenElement || null;

export function fullscreenSupported(){
  if(typeof document==="undefined")return false;
  const d=document.documentElement;
  if(!(d.requestFullscreen||d.webkitRequestFullscreen))return false;
  const enabled=document.fullscreenEnabled??document.webkitFullscreenEnabled;
  return enabled!==false;
}

export function useFullscreen(){
  const[on,setOn]=useState(()=>!!current());
  useEffect(()=>{
    const sync=()=>setOn(!!current());
    document.addEventListener("fullscreenchange",sync);
    document.addEventListener("webkitfullscreenchange",sync);
    return()=>{
      document.removeEventListener("fullscreenchange",sync);
      document.removeEventListener("webkitfullscreenchange",sync);
    };
  },[]);
  const toggle=useCallback(async()=>{
    try{
      if(current())await(document.exitFullscreen?.()??document.webkitExitFullscreen?.());
      else{
        const d=document.documentElement;
        await(d.requestFullscreen?.({navigationUI:"hide"})??d.webkitRequestFullscreen?.());
      }
    }catch{
      // Denied, or the gesture expired. Nothing to do but leave the state alone.
    }
  },[]);
  return{on,toggle,supported:fullscreenSupported()};
}
