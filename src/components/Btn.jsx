import { C } from "../lib/theme.js";

export const Btn = ({onClick,children,secondary,small,disabled,full,danger}) => (
  <button onClick={onClick} disabled={disabled}
    onPointerEnter={e=>{if(!disabled&&secondary)e.currentTarget.style.borderColor=C.hover;}}
    onPointerLeave={e=>{if(!disabled&&secondary)e.currentTarget.style.borderColor=C.border;}}
    style={{
      background:disabled?C.dim:secondary?"transparent":danger?C.red:C.accent,
      color:disabled?C.faint:secondary?C.text:"#060a12",
      border:secondary?`1px solid ${C.border}`:"none",
      borderRadius:11,padding:small?"0 22px":"0 32px",
      minHeight:small?40:50,
      fontSize:small?13:15,fontWeight:700,cursor:disabled?"not-allowed":"pointer",margin:4,
      width:full?"100%":"auto",
      touchAction:"manipulation",WebkitTapHighlightColor:"transparent",transition:"border-color .15s",
    }}>{children}</button>
);
