import {useState,useMemo} from 'react';
import {useOutletContext} from 'react-router-dom';
import {useLiveQuery} from 'dexie-react-hooks';
import {motion} from 'framer-motion';
import {LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer,ReferenceDot} from 'recharts';
import {db} from './db';
import {t,lang} from './i18n';
import {useAuth,Avatar,Badge,Num,Empty,useLookups} from './ui';
import {T} from './pages';

const LOC={en:'en-IN',hi:'hi-IN',bn:'bn-IN',ta:'ta-IN',kn:'kn-IN'};
const dShort=ts=>new Date(ts).toLocaleDateString(LOC[lang()],{day:'numeric',month:'short'});
const dLong=ts=>new Date(ts).toLocaleDateString(LOC[lang()],{day:'numeric',month:'short',year:'numeric'});
const ft=ms=>ms>=6e4?T(ms):(ms/1000).toFixed(1)+'s';
const day=s=>new Date(String(s).slice(0,10)+'T00:00:00').getTime();
const medal=p=>['🥇','🥈','🥉'][p-1]||`#${p}`;

/* ---------- Line chart (Recharts) ---------- */
export function LineChartR({data,name,sel,onSel}){
  const pb=data.reduce((a,p)=>p.you<a.you?p:a,data[0]),hasAvg=data.some(d=>d.avg!=null);
  const tip=({active,payload})=>active&&payload?.length?<div className="ctip"><b>{T(payload[0].payload.you)}</b><small>{dLong(payload[0].payload.ts)}</small></div>:null;
  return <ResponsiveContainer width="100%" height={280}>
    <LineChart data={data} margin={{top:18,right:14,left:0,bottom:4}} onClick={e=>e?.activeTooltipIndex!=null&&onSel(e.activeTooltipIndex)}>
      <defs><linearGradient id="lcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E6192D" stopOpacity=".25"/><stop offset="1" stopColor="#E6192D" stopOpacity="0"/></linearGradient></defs>
      <CartesianGrid stroke="#ECEAF3" vertical={false}/>
      <XAxis dataKey="x" type="number" scale="time" domain={['dataMin','dataMax']} tickFormatter={dShort} tick={{fontSize:11,fill:'#7A7799'}} tickLine={false} axisLine={false} padding={{left:10,right:10}}/>
      <YAxis reversed domain={['dataMin - 1500','dataMax + 1500']} tickFormatter={ft} tick={{fontSize:11,fill:'#7A7799'}} tickLine={false} axisLine={false} width={48} tickCount={5}/>
      <Tooltip content={tip}/>
      {hasAvg&&<Line type="monotone" dataKey="avg" name={t('Academy average')} stroke="#8d8aa8" strokeWidth={2} strokeDasharray="6 6" dot={false} isAnimationActive animationDuration={900}/>}
      <Line type="monotone" dataKey="you" name={name} stroke="#E6192D" strokeWidth={3.5} animationDuration={900}
        dot={p=><circle key={p.index} cx={p.cx} cy={p.cy} r={p.index===sel?6:4} fill={p.index===sel?'#E6192D':'#fff'} stroke={p.index===sel?'#fff':'#E6192D'} strokeWidth={2.5}/>}
        activeDot={{r:7,fill:'#E6192D',stroke:'#fff',strokeWidth:2}}/>
      <ReferenceDot x={pb.x} y={pb.you} r={10} fill="none" stroke="#2DD4BF" strokeWidth={2.5} label={{value:'PB',position:'top',fill:'#0b8c80',fontSize:11,fontWeight:800}}/>
    </LineChart>
  </ResponsiveContainer>;
}

/* ---------- Performance page (admin · coach · parent) ---------- */
export function Performance({role}){
  const{u}=useAuth(),ctx=useOutletContext()||{},lk=useLookups();
  const races=useLiveQuery(()=>db.races.toArray(),[])||[],rl=useLiveQuery(()=>db.results.toArray(),[])||[];
  const[sid,setSid]=useState(''),[evSel,setEv]=useState(''),[selI,setSelI]=useState(null);
  const list=role==='admin'?lk.players:role==='coach'?lk.players.filter(p=>p.coachId===u.refId):[];
  const rmap=useMemo(()=>Object.fromEntries(races.filter(r=>r.status==='completed').map(r=>[r.id,r])),[races]);
  const rows=useMemo(()=>rl.filter(x=>rmap[x.raceId]).map(x=>({...x,event:rmap[x.raceId].event,at:rmap[x.raceId].scheduledAt,x:day(rmap[x.raceId].scheduledAt),ts:new Date(rmap[x.raceId].scheduledAt).getTime()})),[rl,rmap]);
  const hasData=new Set(rows.map(r=>r.swimmerId));
  const sw=role==='parent'?ctx.kid:(list.find(p=>p.id===+sid)||list.find(p=>hasData.has(p.id))||list[0]);
  if(!sw)return <div className="page"><div className="bar"><h2>{t('Performance')}</h2></div><Empty t={role==='parent'?'No child is linked to this login':'Nothing here yet'}/></div>;
  const mine=rows.filter(r=>r.swimmerId===sw.id).sort((a,b)=>a.ts-b.ts);
  const cnt={};mine.forEach(r=>cnt[r.event]=(cnt[r.event]||0)+1);
  const evs=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]),ev=evs.includes(evSel)?evSel:evs[0];
  const pts=mine.filter(r=>r.event===ev),n=pts.length;
  const avg={};rows.filter(r=>r.event===ev).forEach(r=>{(avg[r.x]||(avg[r.x]=[])).push(r.timeMs)});
  const avgPts=Object.entries(avg).map(([x,a])=>({x:+x,y:a.reduce((s,v)=>s+v,0)/a.length})).sort((a,b)=>a.x-b.x);
  const first=pts[0],last=pts[n-1],best=n?Math.min(...pts.map(p=>p.timeMs)):0;
  const imp=n>1?(first.timeMs-last.timeMs)/first.timeMs*100:0;
  const sel=selI!=null&&selI<n?selI:n-1,sp=pts[sel];
  const am=Object.fromEntries(avgPts.map(p=>[p.x,p.y])),data=pts.map(p=>({x:p.x,ts:p.ts,you:p.timeMs,avg:avgPts.length>1?am[p.x]:undefined}));
  return <div className="page"><div className="bar"><h2>{t('Performance')}</h2></div>
    {role==='parent'?<motion.div className="hero kid" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}><Avatar n={sw.name} id={sw.id}/><div><h1>{sw.name}</h1><small>{t(sw.level)} · {t(sw.stroke||'')} · {sw.age} {t('yrs')}</small></div></motion.div>
    :<label className="fld"><span>{t('Select swimmer')}</span><select value={sw.id} onChange={e=>{setSid(e.target.value);setEv('');setSelI(null)}}>{list.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    {!n?<Empty t="No race results yet"/>:<>
      <div className="chips">{evs.map(e=><button key={e} className={e===ev?'chip on':'chip'} onClick={()=>{setEv(e);setSelI(null)}}>{e}</button>)}</div>
      <div className="grid">
        <div className="stat v"><small>{t('Personal best')}</small><b>{T(best)}</b></div>
        <div className="stat"><small>{t('Latest')}</small><b>{T(last.timeMs)}</b></div>
        <div className="stat"><small>{t('Races')}</small><b><Num v={n}/></b></div>
        <div className="stat"><small>{t('Improvement')}</small><b style={{color:imp>=0?'#0b8c80':'var(--coral)'}}>{imp>=0?'+':'−'}{Math.abs(imp).toFixed(1)}%</b></div></div>
      <div className="card"><div className="lgd"><span><i className="k1"/>{sw.name.split(' ')[0]}</span>{data.some(d=>d.avg!=null)&&<span><i className="k2"/>{t('Academy average')}</span>}</div>
        {n>1?<LineChartR key={`${sw.id}-${ev}`} data={data} name={sw.name.split(' ')[0]} sel={sel} onSel={setSelI}/>:<p className="mut">{t('Faster times appear higher. Tap the chart to see a race.')}</p>}
        <small className="mut">{t('Faster times appear higher. Tap the chart to see a race.')}</small>
        <div className="row seld"><b className="md">{medal(sp.place)}</b><div className="grow"><b>{T(sp.timeMs)}</b><small>{dLong(sp.ts)} · {sp.event}</small></div>{sp.timeMs===best&&<Badge t="PB" c="active"/>}</div></div>
      <h3>{t('Recent races')}</h3>
      <div className="list">{pts.slice(-6).reverse().map((p,i,a)=>{const prev=pts[n-1-i-1],d=prev?(p.timeMs-prev.timeMs)/1000:null;
        return <motion.div key={p.id} className="card row" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*.04}}><b className="md">{medal(p.place)}</b>
          <div className="grow"><b>{T(p.timeMs)}</b><small>{dLong(p.ts)}</small></div>
          {d!=null&&<Badge t={`${d<=0?'−':'+'}${Math.abs(d).toFixed(2)}s`} c={d<=0?'active':'advanced'}/>}</motion.div>})}</div></>}
  </div>;
}
