// Hub icons — one per game, drawn so the card needs no explanatory text.
const BOX = { fill:"#0e131e", stroke:"#252d42", strokeWidth:1.5 };

export function IconCollect({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52">
      <rect x={2} y={2} width={48} height={48} rx={9} {...BOX}/>
      {[[7,7],[20,7],[33,7],[7,20],[33,20],[7,33],[33,33]].map(([x,y],i)=>(
        <rect key={i} x={x} y={y} width={12} height={12} rx={3} fill="#5ecef7" opacity={0.85}/>
      ))}
      <rect x={20} y={20} width={12} height={12} rx={3} fill="#f7874f" opacity={0.75}/>
      <rect x={20} y={33} width={12} height={12} rx={3} fill="none" stroke="#5ecef7" strokeWidth={1.5} strokeDasharray="3 2" opacity={0.7}/>
    </svg>
  );
}

export function IconConnect({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52">
      <rect x={2} y={2} width={48} height={48} rx={9} {...BOX}/>
      <line x1={13} y1={30} x2={26} y2={17} stroke="#5ecef7" strokeWidth={2} opacity={0.55}/>
      <circle cx={13} cy={30} r={8} fill="#e74c3c" opacity={0.9}/>
      <circle cx={39} cy={30} r={8} fill="#5ecef7" opacity={0.9}/>
      <circle cx={26} cy={17} r={7} fill="#5ecef7" opacity={0.95}/>
      <circle cx={26} cy={17} r={2.4} fill="#0d1018"/>
    </svg>
  );
}

export function IconSync({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52">
      <rect x={2} y={2} width={48} height={48} rx={9} {...BOX}/>
      <line x1={6} y1={26} x2={46} y2={26} stroke="#5ecef7" strokeWidth={1.5} opacity={0.35}/>
      {[9,18,26,34,43].map((x,i)=>{
        const mid = i===2;
        const pts = mid ? "0,0 0,11 9,5.5" : "9,0 9,11 0,5.5";
        return <polygon key={i} points={pts} transform={`translate(${x-4.5},20.5)`} fill="#5ecef7" opacity={mid?1:0.32}/>;
      })}
    </svg>
  );
}

export function IconMath({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52">
      <rect x={2} y={2} width={48} height={48} rx={9} {...BOX}/>
      <text x={34} y={20} textAnchor="end" fill="#5ecef7" fontSize={12} fontWeight={700} fontFamily="monospace">347</text>
      <text x={34} y={32} textAnchor="end" fill="#5ecef7" fontSize={12} fontWeight={700} fontFamily="monospace">×23</text>
      <text x={13} y={32} textAnchor="middle" fill="#3a3f50" fontSize={12} fontWeight={700} fontFamily="monospace">×</text>
      <line x1={11} y1={36} x2={41} y2={36} stroke="#5ecef7" strokeWidth={1.5} opacity={0.7}/>
      <text x={34} y={47} textAnchor="end" fill="#2ecc71" fontSize={12} fontWeight={700} fontFamily="monospace">7981</text>
    </svg>
  );
}

export function IconOdds({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52">
      <rect x={2} y={2} width={48} height={48} rx={9} {...BOX}/>
      <rect x={7} y={16} width={22} height={22} rx={5} fill="none" stroke="#60a5fa" strokeWidth={1.8} opacity={0.9}/>
      {[[13,22],[23,22],[18,27],[13,32],[23,32]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r={2.1} fill="#60a5fa"/>
      ))}
      <circle cx={37} cy={30} r={10} fill="none" stroke="#5ecef7" strokeWidth={1.8} opacity={0.85}/>
      <line x1={32} y1={35} x2={42} y2={25} stroke="#5ecef7" strokeWidth={1.6}/>
      <circle cx={33.5} cy={26.5} r={2.1} fill="#5ecef7"/>
      <circle cx={40.5} cy={33.5} r={2.1} fill="#5ecef7"/>
    </svg>
  );
}

export function IconSeq({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52">
      <rect x={2} y={2} width={48} height={48} rx={9} {...BOX}/>
      {[2,3,5,8].map((n,i)=>(
        <rect key={i} x={7+i*8} y={44-n*3.6} width={6} height={n*3.6} rx={2} fill="#a78bfa" opacity={0.8}/>
      ))}
      <rect x={39} y={20} width={6} height={24} rx={2} fill="none" stroke="#a78bfa" strokeWidth={1.4} strokeDasharray="3 2" opacity={0.8}/>
      <text x={42} y={16} textAnchor="middle" fill="#a78bfa" fontSize={12} fontWeight={700}>?</text>
    </svg>
  );
}

export function IconCascade({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52">
      <rect x={2} y={2} width={48} height={48} rx={9} {...BOX}/>
      <line x1={26} y1={19} x2={15} y2={31} stroke="#3a4763" strokeWidth={1.8}/>
      <line x1={26} y1={19} x2={37} y2={31} stroke="#fbbf24" strokeWidth={1.8}/>
      <rect x={18} y={9} width={16} height={11} rx={3} fill="#1b2233" stroke="#7c86a0" strokeWidth={1.3}/>
      <text x={26} y={17.5} textAnchor="middle" fill="#e8ecf5" fontSize={8} fontWeight={700} fontFamily="monospace">48</text>
      <rect x={6} y={31} width={18} height={12} rx={3} fill="#1b2233" stroke="#3a4763" strokeWidth={1.3}/>
      <text x={15} y={40} textAnchor="middle" fill="#7c86a0" fontSize={7.5} fontWeight={700} fontFamily="monospace">×3/8</text>
      <rect x={28} y={31} width={18} height={12} rx={3} fill="#1e1a10" stroke="#fbbf24" strokeWidth={1.3}/>
      <text x={37} y={40} textAnchor="middle" fill="#fbbf24" fontSize={7} fontWeight={700} fontFamily="monospace">×5/12</text>
    </svg>
  );
}

export function IconRegimes({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52">
      <rect x={2} y={2} width={48} height={48} rx={9} {...BOX}/>
      <rect x={26} y={7} width={20} height={38} fill="#7cb0ff" opacity={0.07}/>
      <line x1={26} y1={7} x2={26} y2={45} stroke="#7cb0ff" strokeWidth={1.3} strokeDasharray="3 3" opacity={0.75}/>
      <path d="M7 34 L12 30 L17 33 L22 26 L26 29" fill="none" stroke="#7c86a0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M26 29 L31 37 L36 22 L41 26 L46 13" fill="none" stroke="#7cb0ff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={26} cy={29} r={3} fill="#7cb0ff"/>
    </svg>
  );
}
