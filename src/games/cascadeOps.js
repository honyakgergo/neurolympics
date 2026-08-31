// Cascade — operation generator.
//
// Options are always built from the number you are actually holding, so a
// fraction never appears unless its denominator divides that number cleanly.
// The two branches are kept close together (a few percent apart) so both have
// to be computed properly, and never equal.

const FRACS=[[1,2],[1,3],[2,3],[1,4],[3,4],[1,5],[2,5],[3,5],[4,5],[1,6],[5,6],[3,8],[5,8],[7,8],[2,9],[4,9],[5,9],[7,9],[1,10],[3,10],[7,10],[9,10],[5,12],[7,12],[11,12],[3,2],[4,3],[5,3],[5,4],[7,4],[6,5],[7,5],[8,5],[9,5],[5,2],[7,2],[7,6],[9,8],[11,8],[9,4]];
const MULTS=[2,3,4];
const LO=8,HI=6000;

const div=(n,d)=>n%d===0;
const rnd=a=>a[Math.floor(Math.random()*a.length)];

// Candidate operations on n. `weight` only biases generation toward the more
// interesting arithmetic; it has nothing to do with scoring.
function candidates(n){
  const out=[];
  for(const[a,b] of FRACS){
    if(!div(n,b))continue;
    const v=n*a/b;
    if(v<LO||v>HI||v===n)continue;
    out.push({label:`× ${a}/${b}`,kind:"frac",value:v,weight:b>=8?3:2});
  }
  for(const m of MULTS){
    const v=n*m;
    if(v<=HI)out.push({label:m===2?"double it":`× ${m}`,kind:"mult",value:v,weight:1});
  }
  if(div(n,2)&&n/2>=LO)out.push({label:"halve it",kind:"mult",value:n/2,weight:1});
  for(const p of [10,20,25,40,60,75,80,90,110,125,150]){
    const v=n*p/100;
    if(Number.isInteger(v)&&v>=LO&&v<=HI&&v!==n)out.push({label:`${p}% of it`,kind:"pct",value:v,weight:2});
  }
  const mag=Math.max(6,Math.round(n*0.35));
  const seen=new Set();
  for(let k=0;k<12;k++){
    const step=Math.round(Math.random()*mag+3)*(Math.random()<0.35?-1:1);
    const v=n+step;
    if(v<LO||v>HI||step===0||seen.has(step))continue;
    seen.add(step);
    out.push({label:`${step>0?"+":"−"} ${Math.abs(step)}`,kind:"add",value:v,weight:1});
  }
  return out;
}

// Pick a pair whose values sit close together but are distinct. Drifting
// numbers are pulled back: too high favours shrinking ops, too low favours
// growing ones, so the chain stays computable in your head.
function pickPair(n,spread=0.14){
  const cands=candidates(n);
  if(cands.length<2)return null;
  const drift=n>2200?"shrink":n<26?"grow":"any";
  const pool=cands.filter(c=>drift==="shrink"?c.value<n:drift==="grow"?c.value>n:true);
  const usable=pool.length>=2?pool:cands;
  const bag=[];
  usable.forEach(c=>{for(let i=0;i<c.weight;i++)bag.push(c);});
  for(let attempt=0;attempt<300;attempt++){
    const a=rnd(bag),b=rnd(bag);
    if(!a||!b||a===b||a.value===b.value||a.label===b.label)continue;
    if(a.kind==="add"&&b.kind==="add"&&Math.abs(a.value-b.value)<3)continue;
    const rel=Math.abs(a.value-b.value)/Math.max(a.value,b.value);
    if(rel>spread||rel<0.012)continue;
    return Math.random()<0.5?[a,b]:[b,a];
  }
  const sorted=[...usable].sort((x,y)=>x.value-y.value);
  let best=null,bestGap=Infinity;
  for(let i=1;i<sorted.length;i++){
    const gap=sorted[i].value-sorted[i-1].value;
    if(gap>0&&gap<bestGap){bestGap=gap;best=[sorted[i-1],sorted[i]];}
  }
  return best;
}

// What the best single next move from v is worth. Used only for trap lookahead.
function ceilingNext(v){
  const p=pickPair(v);
  return p?Math.max(p[0].value,p[1].value):v;
}

// A trap step: the branch that is bigger right now leads to a worse follow-up,
// so grabbing the larger number loses over two moves.
function pickTrapPair(n){
  const cands=candidates(n).filter(c=>c.value>=LO&&c.value<=HI);
  for(let attempt=0;attempt<200;attempt++){
    const a=rnd(cands),b=rnd(cands);
    if(!a||!b||a.value===b.value)continue;
    const rel=Math.abs(a.value-b.value)/Math.max(a.value,b.value);
    if(rel>0.16||rel<0.02)continue;
    const hi=a.value>b.value?a:b, lo=a.value>b.value?b:a;
    const hiNext=ceilingNext(hi.value), loNext=ceilingNext(lo.value);
    if(loNext>hiNext*1.06){
      const opts=Math.random()<0.5?[hi,lo]:[lo,hi];
      const metrics=opts.map(o=>o===hi?hiNext:loNext);
      return{options:opts,metrics};
    }
  }
  return null;
}

// One step. `metrics` is what the step is graded on: the resulting number for a
// normal step, the best two-move outcome for a trap step. bestIndex is derived
// from metrics, never hand-set.
export function nextStep(n,{allowTrap=false}={}){
  if(allowTrap){
    const t=pickTrapPair(n);
    if(t){
      const bestIndex=t.metrics[0]>=t.metrics[1]?0:1;
      return{options:t.options,metrics:t.metrics,trap:true,bestIndex};
    }
  }
  const p=pickPair(n);
  if(!p)return null;
  const metrics=p.map(o=>o.value);
  return{options:p,metrics,trap:false,bestIndex:metrics[0]>=metrics[1]?0:1};
}
