// Every game maps raw performance onto a shared 0-1000 rating, so scores are
// comparable across games and the Brain Profile scales directly with them.
export const clamp01 = x => Math.max(0, Math.min(1, x));
export const band = (v, lo, hi) => clamp01((v - lo) / (hi - lo)); // lo->0, hi->1 (hi<lo inverts)
export const rate = parts => Math.round(1000 * clamp01(parts.reduce((s,[w,v])=>s+w*v,0)));
export const BENCH = {
  g1:  { ceilingLo:3, ceilingHi:12, accLo:40, accHi:100 },
  g3:  { rtSlow:850, rtFast:340, volLo:0, volHi:45 },
  g4:  { rtSlow:620, rtFast:300 },
  math:{ netElite:40 },
  ev:  { netElite:22 },
  seq: { netElite:11, msSlow:40000, msFast:9000 },
  cascade: { retLo:0.45, msSlow:9000, msFast:2500 },
};
export function scoreG1({ceiling,accuracy,distractorAcc,dirAcc}){const b=BENCH.g1;return rate([[0.35,band(ceiling,b.ceilingLo,b.ceilingHi)],[0.30,band(accuracy,b.accLo,b.accHi)],[0.20,band(distractorAcc,b.accLo,b.accHi)],[0.15,band(dirAcc,b.accLo,b.accHi)]]);}
export function scoreG3({acc,avgRt,correct}){const b=BENCH.g3;const speed=avgRt>0?band(avgRt,b.rtSlow,b.rtFast):0;return rate([[0.45,band(acc,0,100)],[0.40,speed],[0.15,band(correct,b.volLo,b.volHi)]]);}
export function scoreG4({acc,avgRt}){const b=BENCH.g4;const speed=avgRt>0?band(avgRt,b.rtSlow,b.rtFast):0;return rate([[0.55,band(acc,0,100)],[0.45,speed]]);}
export function scoreNet(net,elite){return Math.round(1000*clamp01(net/elite));}
// Sequences — mostly net points, with a quarter of the weight on pace so that
// solving the same set faster is worth more.
export function scoreSeq({net,avgMs}){const b=BENCH.seq;const pace=avgMs>0?band(avgMs,b.msSlow,b.msFast):0;return rate([[0.75,band(net,0,b.netElite)],[0.25,pace]]);}
// Cascade — mostly the share of perfect-play value kept, compounded across
// every step, since that already carries the magnitude of each error. Accuracy
// and pace fill in the rest.
export function scoreCascade({retained,accuracy,medianMs}){
  const b=BENCH.cascade;
  const pace=medianMs>0?band(medianMs,b.msSlow,b.msFast):0;
  return rate([[0.55,band(retained,b.retLo,1)],[0.30,clamp01(accuracy)],[0.15,pace]]);
}
