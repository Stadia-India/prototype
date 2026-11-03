import {useState,useEffect} from 'react';
import {Link,Navigate,useNavigate,useOutletContext,useParams} from 'react-router-dom';
import {useLiveQuery} from 'dexie-react-hooks';
import {motion,AnimatePresence} from 'framer-motion';
import {Play,Eye,Trophy,Trash2,Check,Undo2,ArrowLeft,Download,Upload,RotateCcw,LogOut,NotebookPen,IndianRupee,Phone} from 'lucide-react';
import {db,today,thisMonth,seed,getS,payReg,payMonthly,dueState} from './db';
import {t,lang} from './i18n';
import {useAuth,useToast,Sheet,Confirm,Avatar,Badge,Num,Empty,useLookups,LangSwitch} from './ui';
import {Crud} from './crud';

const LOC={en:'en-IN',hi:'hi-IN',bn:'bn-IN',ta:'ta-IN',kn:'kn-IN'};
const fmt=s=>s?new Date(s).toLocaleString(LOC[lang()],{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'';
const fmtD=s=>s?new Date(s+'T00:00:00').toLocaleDateString(LOC[lang()],{day:'numeric',month:'short',year:'numeric'}):'';
const rs=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const nm=(lk,id)=>lk.by.players[id]?.name||t('Deleted swimmer');
const DL=ds=>(ds||[]).map(d=>t(d)).join(' ');

/* ---------- cascades (delete rules) ---------- */
const cas={
  coaches:async r=>{await db.players.where('coachId').equals(r.id).modify({coachId:null});await db.batches.where('coachId').equals(r.id).modify({coachId:null});await db.users.filter(u=>u.role==='coach'&&u.refId===r.id).delete()},
  parents:async r=>{await db.players.where('parentId').equals(r.id).modify({parentId:null});await db.users.filter(u=>u.role==='parent'&&u.refId===r.id).delete()},
  batches:async r=>{await db.players.where('batchId').equals(r.id).modify({batchId:null})},
  players:async r=>{for(const k of['attendance','notes','payments'])await db[k].where('playerId').equals(r.id).delete();
    await db.results.where('swimmerId').equals(r.id).delete();
    await db.tournaments.toCollection().modify(x=>{x.swimmerIds=(x.swimmerIds||[]).filter(i=>i!==r.id)});
    await db.races.filter(x=>x.status==='scheduled'&&x.swimmerIds?.includes(r.id)).modify(x=>{x.swimmerIds=x.swimmerIds.filter(i=>i!==r.id)})},
  tournaments:async r=>{const ids=await db.races.where('tournamentId').equals(r.id).primaryKeys();await db.results.where('raceId').anyOf(ids).delete();await db.races.bulkDelete(ids)},
};

/* ---------- Coaches / Parents / Batches ---------- */
export const Coaches=()=><Crud table="coaches" title="Coaches" login cascade={cas.coaches} defaults={{status:'Active'}}
  fields={[{k:'name',label:'Name',req:1},{k:'phone',label:'Phone',t:'tel',req:1},{k:'specialization',label:'Specialization'},{k:'experienceYears',label:'Experience (years)',t:'number'},{k:'status',label:'Status',t:'select',opts:['Active','Inactive'],req:1}]}
  render={(c,lk)=><><Avatar n={c.name} id={c.id}/><div className="grow"><b>{c.name}</b><small>{c.specialization||'—'} · {lk.players.filter(p=>p.coachId===c.id).length} {t('swimmers')}</small></div><Badge t={c.status}/></>}/>;
export const Parents=()=><Crud table="parents" title="Parents" login cascade={cas.parents}
  fields={[{k:'name',label:'Name',req:1},{k:'phone',label:'Phone',t:'tel',req:1}]}
  render={(p,lk)=><><Avatar n={p.name} id={p.id+3}/><div className="grow"><b>{p.name}</b><small>{p.phone} · {t('Children')}: {lk.players.filter(x=>x.parentId===p.id).map(x=>x.name.split(' ')[0]).join(', ')||'—'}</small></div></>}/>;
export const Batches=()=><Crud table="batches" title="Batches" cascade={cas.batches}
  fields={[{k:'name',label:'Batch name',req:1},{k:'coachId',label:'Coach',t:'select',opts:'coaches',req:1},{k:'days',label:'Days',t:'days',req:1},{k:'startTime',label:'Start',t:'time',req:1},{k:'endTime',label:'End',t:'time',req:1},{k:'lane',label:'Pool lane',t:'number',req:1}]}
  render={(b,lk)=><div className="grow"><b>{b.name}</b><small>{lk.by.coaches[b.coachId]?.name||t('No coach')} · {DL(b.days)} · {b.startTime}-{b.endTime} · {t('Lane')} {b.lane}</small><small>{lk.players.filter(p=>p.batchId===b.id).length} {t('swimmers')}</small></div>}/>;

/* ---------- Swimmers (+ registration fee step, coach notes) ---------- */
const PF=[{k:'name',label:'Name',req:1},{k:'age',label:'Age',t:'number',req:1},{k:'level',label:'Level',t:'select',opts:['Beginner','Intermediate','Advanced'],req:1},{k:'stroke',label:'Main stroke',t:'select',opts:['Freestyle','Backstroke','Breaststroke','Butterfly','Medley']},{k:'parentId',label:'Parent',t:'select',opts:'parents'},{k:'coachId',label:'Coach',t:'select',opts:'coaches'},{k:'batchId',label:'Batch',t:'select',opts:'batches'},{k:'status',label:'Status',t:'select',opts:['Active','Inactive'],req:1}];
export function Players({coach}){
  const{u}=useAuth();const[pay,setPay]=useState(null),[note,setNote]=useState(null);
  return <><Crud table="players" title="Swimmers" fields={PF} defaults={{level:'Beginner',stroke:'Freestyle',status:'Active'}} cascade={cas.players}
    readonly={coach} filter={coach?p=>p.coachId===u.refId:null}
    render={(p,lk)=><><Avatar n={p.name} id={p.id}/><div className="grow"><b>{p.name}</b><small>{p.age} {t('yrs')} · {t(p.stroke||'')} · {lk.by.coaches[p.coachId]?.name||t('No coach')} · {lk.by.batches[p.batchId]?.name||t('No batch')}</small></div><Badge t={p.level}/></>}
    afterAdd={async id=>{const s=await getS();const rid=await db.payments.add({playerId:id,type:'registration',amount:s.registrationFee,status:'pending'});setPay({playerId:id,row:await db.payments.get(rid)})}}
    actions={coach?p=><button className="ib" onClick={()=>setNote(p)}><NotebookPen size={16}/></button>:null}/>
    <PaySheet st={pay} close={()=>setPay(null)}/><NoteSheet p={note} close={()=>setNote(null)}/></>;
}
function NoteSheet({p,close}){
  const{u}=useAuth();const[txt,setTxt]=useState('');
  const ns=useLiveQuery(()=>p?db.notes.where('playerId').equals(p.id).toArray():[],[p?.id])||[];
  return <Sheet open={!!p} onClose={close} title={`${t('Notes')} · ${p?.name||''}`}>
    <textarea className="ta" placeholder={t('Skill note / feedback (visible to parent)')} value={txt} onChange={e=>setTxt(e.target.value)}/>
    <button className="btn" onClick={async()=>{if(!txt.trim())return;await db.notes.add({playerId:p.id,coachId:u.refId,text:txt.trim(),date:today()});setTxt('')}}>{t('Add note')}</button>
    {ns.slice().reverse().map(n=><div key={n.id} className="note"><small>{n.date}</small><p>{n.text}</p><button className="ib red" onClick={()=>db.notes.delete(n.id)}><Trash2 size={14}/></button></div>)}
  </Sheet>;
}

/* ---------- Payments ---------- */
export function PaySheet({st,close,online}){
  const[mode,setMode]=useState('online'),[plan,setPlan]=useState(1),[busy,setBusy]=useState(0);
  const s=useLiveQuery(getS,[])||{};const pl=useLiveQuery(()=>st?db.players.get(st.playerId):null,[st?.playerId]);
  const reg=st?.row?.type==='registration';const amt=reg?st.row.amount:(s.monthlyFee||0)*plan;const on=online||mode==='online';
  const go=async()=>{
    const m=online?'online':mode;if(m==='online'){setBusy(1);await new Promise(r=>setTimeout(r,1300))}
    reg?await payReg(st.row.id,m):await payMonthly(st.playerId,plan,m);
    setBusy(2);setTimeout(()=>{setBusy(0);setPlan(1);close()},1100);
  };
  return <Sheet open={!!st} onClose={busy?()=>{}:close} title={t(reg?'Registration Fee':'Monthly Fee')}>
    {busy===2?<motion.div className="done" initial={{scale:.3,opacity:0}} animate={{scale:1,opacity:1}}><Check size={48}/><b>{t('Payment recorded')}</b></motion.div>:<>
      <p className="mut">{pl?.name}</p><div className="amt"><Num v={amt} pre="₹"/></div>
      {!reg&&<><div className="chips">{[[1,'1 Month'],[6,'6 Months'],[12,'1 Year']].map(([n,l])=><button key={n} className={plan===n?'chip on':'chip'} onClick={()=>setPlan(n)}>{t(l)}</button>)}</div>
        <small className="mut">{plan>1?t('{n} months are paid together. Future months show as Paid.',{n:plan}):t('Fee is due every month. You can also pay 6 months or 1 year together.')}</small></>}
      {!online&&<div className="chips">{[['online','Online (UPI/Card)'],['offline','Offline (Cash/Desk)']].map(([k,l])=><button key={k} className={mode===k?'chip on':'chip'} onClick={()=>setMode(k)}>{t(l)}</button>)}</div>}
      <button className="btn" disabled={busy===1} onClick={go}>{busy===1?t('Processing…'):on?t('Pay {amt} online',{amt:rs(amt)}):t('Received {amt}',{amt:rs(amt)})}</button>
      {reg&&<button className="btn ghost" onClick={close}>{t('Later (stays Pending)')}</button>}
      {on&&<small className="mut">{t('Demo: this is a simulated payment screen. No real money is charged.')}</small>}</>}
  </Sheet>;
}
export function Fees(){
  const[tab,setTab]=useState('pending'),[pay,setPay]=useState(null),[dl,setDl]=useState(null);
  const rows=useLiveQuery(()=>db.payments.toArray(),[])||[],lk=useLookups(),s=useLiveQuery(getS,[])||{};
  const sum=a=>a.reduce((x,r)=>x+r.amount,0),m=thisMonth();
  const coll=rows.filter(r=>r.status==='paid'&&r.paidOn?.slice(0,7)===m),pend=rows.filter(r=>r.status==='pending');
  const od=pend.filter(r=>dueState(r,s.dueDay)?.c==='coral'),on=sum(coll.filter(r=>r.mode==='online'));
  const list=rows.filter(r=>r.status===tab).sort((a,b)=>(b.paidOn||b.forMonth||'').localeCompare(a.paidOn||a.forMonth||''));
  return <div className="page"><div className="bar"><h2>{t('Fees')}</h2></div>
    <div className="grid"><div className="stat v"><small>{t('Collected (this month)')}</small><b><Num v={sum(coll)} pre="₹"/></b></div>
      <div className="stat"><small>{t('Pending')}</small><b><Num v={sum(pend)} pre="₹"/></b></div>
      <div className="stat c"><small>{t('Overdue')}</small><b><Num v={od.length}/></b></div>
      <div className="stat"><small>{t('Online / Offline')}</small><b className="sm">{rs(on)} / {rs(sum(coll)-on)}</b></div></div>
    <div className="tabs">{[['pending','Pending'],['paid','Paid']].map(([k,l])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{t(l)}</button>)}</div>
    <div className="list">{list.map(r=>{const d=dueState(r,s.dueDay);return <motion.div layout key={r.id} className="card row" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}}>
      <div className="grow"><b>{nm(lk,r.playerId)}</b><small>{r.type==='registration'?t('Registration'):r.forMonth}{r.planMonths>1?` · ${t('{n}-month plan',{n:r.planMonths})}`:''} · {r.mode?t(r.mode==='online'?'Online':'Offline'):'—'}{r.receiptNo?` · ${r.receiptNo}`:''}</small></div>
      <div className="rt"><b>{rs(r.amount)}</b>{d?<Badge t={d.t} c={d.c}/>:<Badge t="Paid"/>}</div>
      <div className="acts">{r.status==='pending'&&<button className="ib lime" onClick={()=>setPay({playerId:r.playerId,row:r})}><IndianRupee size={16}/></button>}
        <button className="ib red" onClick={()=>setDl(r)}><Trash2 size={16}/></button></div></motion.div>})}</div>
    {!list.length&&<Empty t="No entries"/>}
    <PaySheet st={pay} close={()=>setPay(null)}/>
    <Confirm msg={dl&&'This payment entry will be deleted.'} onClose={()=>setDl(null)} onYes={()=>db.payments.delete(dl.id)}/></div>;
}

/* ---------- Races (events) ---------- */
export const EVENTS=['50m Freestyle','100m Freestyle','50m Backstroke','50m Breaststroke','50m Butterfly','100m Individual Medley'];
export const T=ms=>{const s=Math.floor(ms/10),c=s%100,k=Math.floor(s/100);return `${Math.floor(k/60)}:${String(k%60).padStart(2,'0')}.${String(c).padStart(2,'0')}`};
const medal=p=>['🥇','🥈','🥉'][p-1]||`#${p}`;
function RaceRow({r,lk}){
  const res=useLiveQuery(()=>db.results.where('raceId').equals(r.id).sortBy('place'),[r.id])||[];
  return <><div className="grow"><b>{r.event}</b><small>{fmt(r.scheduledAt)} · {r.swimmerIds?.length} {t('swimmers')}</small>
    <small>{r.swimmerIds?.map((id,i)=>`L${i+1} ${nm(lk,id).split(' ')[0]}`).join(' · ')}</small>
    {r.status==='completed'&&res[0]&&<div className="mini">🥇 {nm(lk,res[0].swimmerId)} · {T(res[0].timeMs)}</div>}</div><Badge t={r.status}/></>;
}
export function Races({role}){
  const{u}=useAuth();const ctx=useOutletContext()||{};const[tab,setTab]=useState('scheduled');
  const mine=useLiveQuery(()=>role==='coach'?db.players.where('coachId').equals(u.refId).primaryKeys():[],[role,u.refId])||[];
  const ok=r=>role==='admin'||(role==='coach'?r.swimmerIds?.some(id=>mine.includes(id)):r.swimmerIds?.includes(ctx.kid?.id));
  const tabs=[['scheduled','Upcoming'],['live','Live'],['completed','Done']];
  return <Crud table="races" title="Races" readonly={role!=='admin'} filter={r=>r.status===tab&&ok(r)} canMod={r=>r.status==='scheduled'}
    sort={(a,b)=>tab==='completed'?b.scheduledAt.localeCompare(a.scheduledAt):a.scheduledAt.localeCompare(b.scheduledAt)}
    defaults={{status:'scheduled'}} validate={v=>v.swimmerIds.length<2?'Select at least 2 swimmers':v.swimmerIds.length>6?'Maximum 6 swimmers per race (6 lanes)':null}
    fields={[{k:'event',label:'Event',t:'select',opts:EVENTS,req:1},{k:'swimmerIds',label:'Swimmers (lane order = selection order)',t:'multi',opts:'players',req:1},{k:'scheduledAt',label:'Date & time',t:'datetime-local',req:1}]}
    top={<div className="tabs">{tabs.map(([k,l])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{t(l)}</button>)}</div>}
    cascade={async r=>{await db.results.where('raceId').equals(r.id).delete()}}
    render={(r,lk)=><RaceRow r={r} lk={lk}/>}
    actions={r=><>{role!=='parent'&&r.status!=='completed'&&<Link className="ib lime" to={`/timer/${r.id}`}><Play size={16}/></Link>}
      {r.status!=='scheduled'&&<Link className="ib" to={`/board/${r.id}`}><Eye size={16}/></Link>}</>}/>;
}

/* ---------- Live race timer ---------- */
const Confetti=()=><div className="conf">{Array.from({length:28}).map((_,i)=><motion.i key={i} style={{left:`${(i*37)%100}%`,background:['#FFFFFF','#E6192D','#FF4D5E','#2DD4BF'][i%4]}}
  initial={{y:-20,opacity:1}} animate={{y:'100dvh',rotate:360*(i%3+1),opacity:0}} transition={{duration:2+(i%5)*.3,delay:(i%7)*.1}}/>)}</div>;
function useNow(on){const[n,setN]=useState(Date.now());useEffect(()=>{if(!on)return;const id=setInterval(()=>setN(Date.now()),50);return()=>clearInterval(id)},[on]);return n}
function RaceView({r,res,lk,onFinish}){
  const now=useNow(r.status==='live');
  const el=r.status==='scheduled'?0:r.status==='completed'?Math.max(0,...res.map(x=>x.timeMs)):now-r.startedAt;
  return <div className="sw"><div className="svh">{r.status==='live'?<span className="live"><i/>{t('LIVE')}</span>:<Badge t={r.status}/>}<span>{r.event}</span></div>
    <div className="rc">{T(el)}</div>
    <div className="lanes">{r.swimmerIds.map((id,i)=>{const d=res.find(x=>x.swimmerId===id);return <motion.div layout key={id} className={`ln ${d?'fin':''}`}>
      <span className="lno">{i+1}</span><div className="grow"><b>{nm(lk,id)}</b>{d&&<small>{T(d.timeMs)}</small>}</div>
      {d?<b className="md">{medal(d.place)}</b>:onFinish&&r.status==='live'?<button className="btn lime sm" onClick={()=>onFinish(id)}>{t('Finish')}</button>:<small>{r.status==='live'?t('Swimming…'):''}</small>}</motion.div>})}</div>
    {r.status==='completed'&&res[0]&&<><Confetti/><motion.div className="winc" initial={{scale:.6,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring'}}><Trophy size={34}/><h2>{t('{name} wins!',{name:nm(lk,res[0].swimmerId)})}</h2><small>{T(res[0].timeMs)}</small></motion.div></>}</div>;
}
export function Console(){
  const{id}=useParams(),rid=+id,lk=useLookups(),toast=useToast(),nav=useNavigate();
  const r=useLiveQuery(()=>db.races.get(rid),[rid]);
  const res=useLiveQuery(()=>db.results.where('raceId').equals(rid).sortBy('place'),[rid])||[];
  if(!r)return <div className="dark"><Empty t="Race not found"/></div>;
  const start=()=>db.races.update(rid,{status:'live',startedAt:Date.now()});
  const finish=async sid=>{if(res.find(x=>x.swimmerId===sid))return;
    await db.results.add({raceId:rid,swimmerId:sid,timeMs:Date.now()-r.startedAt,place:res.length+1});
    if(res.length+1===r.swimmerIds.length){await db.races.update(rid,{status:'completed'});toast('Race complete 🏊')}};
  const undo=async()=>{const l=res[res.length-1];if(!l)return;await db.results.delete(l.id);if(r.status==='completed')await db.races.update(rid,{status:'live'})};
  const reset=async()=>{await db.results.where('raceId').equals(rid).delete();await db.races.update(rid,{status:'scheduled',startedAt:null})};
  return <div className="dark"><div className="ctl"><button className="ib" onClick={()=>nav(-1)}><ArrowLeft size={18}/></button>
    <button className="ib" onClick={undo}><Undo2 size={18}/></button><button className="ib" onClick={reset}><RotateCcw size={18}/></button>
    <a className="btn lime sm" href={`#/board/${rid}`} target="_blank" rel="noreferrer"><Eye size={16}/> {t('Results board')}</a></div>
    <RaceView r={r} res={res} lk={lk} onFinish={finish}/>
    {r.status==='scheduled'&&<motion.button whileTap={{scale:.96}} className="btn lime go" onClick={start}><Play size={20}/> {t('START RACE')}</motion.button>}</div>;
}
export function Board(){
  const{id}=useParams(),rid=+id,lk=useLookups();
  const r=useLiveQuery(()=>db.races.get(rid),[rid]),res=useLiveQuery(()=>db.results.where('raceId').equals(rid).sortBy('place'),[rid])||[];
  if(!r)return <div className="dark"><Empty t="Race not found"/></div>;
  return <div className="dark"><RaceView r={r} res={res} lk={lk}/></div>;
}

/* ---------- Tournaments ---------- */
const tStatus=(tn,rc)=>{const d=today();if(rc.length&&rc.every(r=>r.status==='completed'))return'completed';return d<tn.startDate?'upcoming':d>tn.endDate?'completed':'ongoing'};
const lt=d=>{const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`};
function TRow({tn}){
  const rc=useLiveQuery(()=>db.races.where('tournamentId').equals(tn.id).toArray(),[tn.id])||[];
  return <><div className="grow"><b>{tn.name}</b><small>{tn.venue} · {fmtD(tn.startDate)} – {fmtD(tn.endDate)}</small>
    <small>{tn.events?.length} {t('events')} · {tn.swimmerIds?.length} {t('swimmers')} · {rc.filter(r=>r.status==='completed').length}/{rc.length} {t('races done')}</small></div><Badge t={tStatus(tn,rc)}/></>;
}
export function Tournaments({role}){
  const{u}=useAuth();const ctx=useOutletContext()||{};
  const mine=useLiveQuery(()=>role==='coach'?db.players.where('coachId').equals(u.refId).primaryKeys():[],[role,u.refId])||[];
  const ok=x=>role==='admin'||(role==='coach'?x.swimmerIds?.some(i=>mine.includes(i)):x.swimmerIds?.includes(ctx.kid?.id));
  return <Crud table="tournaments" title="Tournaments" readonly={role!=='admin'} filter={ok} cascade={cas.tournaments}
    validate={v=>v.endDate<v.startDate?'End date must be on or after the start date':v.swimmerIds.length<2?'Select at least 2 swimmers':null}
    fields={[{k:'name',label:'Tournament name',req:1},{k:'venue',label:'Venue',req:1},{k:'startDate',label:'Start date',t:'date',req:1},{k:'endDate',label:'End date',t:'date',req:1},{k:'events',label:'Events',t:'multi',opts:EVENTS,req:1},{k:'swimmerIds',label:'Participating swimmers',t:'multi',opts:'players',req:1}]}
    render={x=><TRow tn={x}/>}
    actions={x=><Link className="ib lime" to={`/${role}/tournaments/${x.id}`}><Trophy size={16}/></Link>}/>;
}
export function TournamentView({role}){
  const{id}=useParams(),tid=+id,lk=useLookups(),toast=useToast(),nav=useNavigate(),ctx=useOutletContext()||{};
  const tn=useLiveQuery(()=>db.tournaments.get(tid),[tid]);
  const races=useLiveQuery(()=>db.races.where('tournamentId').equals(tid).toArray(),[tid])||[];
  const rl=useLiveQuery(()=>db.results.toArray(),[])||[];
  if(!tn)return <div className="page"><Empty t="Tournament not found"/></div>;
  const done=new Set(races.filter(r=>r.status==='completed').map(r=>r.id)),S={};
  rl.filter(x=>done.has(x.raceId)).forEach(x=>{const s=S[x.swimmerId]||(S[x.swimmerId]={g:0,s:0,b:0,p:0});if(x.place===1){s.g++;s.p+=5}else if(x.place===2){s.s++;s.p+=3}else if(x.place===3){s.b++;s.p+=1}});
  const st=Object.entries(S).map(([k,v])=>({id:+k,...v})).sort((a,b)=>b.p-a.p||b.g-a.g||b.s-a.s||b.b-a.b);
  const missing=tn.events.filter(ev=>!races.some(r=>r.event===ev));
  const gen=async()=>{
    const base=new Date(`${tn.startDate}T09:00`);let slot=0;
    for(const ev of missing){const ids=tn.swimmerIds,h=Math.ceil(ids.length/6),size=Math.ceil(ids.length/h);
      for(let i=0;i<h;i++){await db.races.add({event:ev,swimmerIds:ids.slice(i*size,(i+1)*size),scheduledAt:lt(new Date(base.getTime()+slot*30*6e4)),status:'scheduled',tournamentId:tid,heat:i+1});slot++}}
    toast(missing.length?'Races generated ✓':'All events already have races');
  };
  return <div className="page"><div className="bar"><button className="ib" onClick={()=>nav(-1)}><ArrowLeft size={18}/></button><h2 className="grow">{tn.name}</h2><Badge t={tStatus(tn,races)}/></div>
    <div className="card"><small>{tn.venue}</small><b>{fmtD(tn.startDate)} – {fmtD(tn.endDate)}</b>
      <small>{tn.events.length} {t('events')} · {tn.swimmerIds.length} {t('swimmers')} · {done.size}/{races.length} {t('races done')}</small>
      {role==='admin'&&!!missing.length&&<button className="btn" style={{marginTop:12}} onClick={gen}>{t('Generate races')}</button>}</div>
    <h3>{t('Standings')}</h3>
    {st.map((x,i)=><motion.div key={x.id} className={`card row${x.id===ctx.kid?.id?' me':''}`} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:Math.min(i,8)*.05}}>
      <span className="rank">{i+1}</span><div className="grow"><b>{nm(lk,x.id)}</b><small>🥇 {x.g} · 🥈 {x.s} · 🥉 {x.b}</small></div><Badge t={`${x.p} ${t('Points')}`} c="active"/></motion.div>)}
    {!st.length&&<Empty t="No standings yet"/>}<small className="mut">{t('Scoring: 1st = 5, 2nd = 3, 3rd = 1 point')}</small>
    <h3>{t('Schedule')}</h3>
    {tn.events.map(ev=><div key={ev}><h4 className="evh">{ev}</h4><div className="list">{races.filter(r=>r.event===ev).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)).map(r=>
      <div key={r.id} className="card row"><span className="hn">H{r.heat||1}</span><RaceRow r={r} lk={lk}/>
        <div className="acts">{role!=='parent'&&r.status!=='completed'&&<Link className="ib lime" to={`/timer/${r.id}`}><Play size={16}/></Link>}{r.status!=='scheduled'&&<Link className="ib" to={`/board/${r.id}`}><Eye size={16}/></Link>}</div></div>)}</div>
      {!races.some(r=>r.event===ev)&&<small className="mut">{t('Nothing here yet')}</small>}</div>)}</div>;
}

/* ---------- Attendance ---------- */
export function Attendance(){
  const{u}=useAuth(),lk=useLookups(),toast=useToast();
  const bs=lk.batches.filter(b=>u.role==='admin'||b.coachId===u.refId);
  const[bid,setBid]=useState(''),[date,setDate]=useState(today()),[st,setSt]=useState({});
  useEffect(()=>{if(!bid&&bs.length)setBid(String(bs[0].id))},[bs.length]);
  useEffect(()=>{if(bid)db.attendance.where('[batchId+date]').equals([+bid,date]).toArray().then(a=>setSt(Object.fromEntries(a.map(x=>[x.playerId,x.status]))))},[bid,date]);
  const pl=lk.players.filter(p=>p.batchId===+bid&&p.status==='Active'),cyc={Present:'Absent',Absent:'Late',Late:'Present'};
  const save=async()=>{await db.attendance.where('[batchId+date]').equals([+bid,date]).delete();
    await db.attendance.bulkAdd(pl.map(p=>({batchId:+bid,date,playerId:p.id,status:st[p.id]||'Present'})));toast('Attendance saved ✓')};
  return <div className="page"><div className="bar"><h2>{t('Attendance')}</h2></div>
    <div className="two"><select className="inp" value={bid} onChange={e=>setBid(e.target.value)}>{bs.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
      <input className="inp" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
    <button className="btn ghost" onClick={()=>setSt(Object.fromEntries(pl.map(p=>[p.id,'Present'])))}>{t('Mark all present')}</button>
    <div className="list">{pl.map(p=>{const v=st[p.id]||'Present';return <motion.button layout whileTap={{scale:.97}} key={p.id} className="card row tap" onClick={()=>setSt(s=>({...s,[p.id]:cyc[v]}))}>
      <Avatar n={p.name} id={p.id}/><div className="grow"><b>{p.name}</b></div><Badge t={v} c={v==='Present'?'active':v==='Absent'?'advanced':'intermediate'}/></motion.button>})}</div>
    {!pl.length&&<Empty t="No swimmers in this batch"/>}{!!pl.length&&<button className="btn" onClick={save}>{t('Save attendance')}</button>}</div>;
}

/* ---------- Dashboards ---------- */
function Live({ms}){const m=ms.find(x=>x.status==='live');if(!m)return null;
  return <Link to={`/board/${m.id}`} className="livebar"><span className="live"><i/>{t('LIVE')}</span><b>{m.event}</b><Eye size={18}/></Link>}
const DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export function Dash(){
  const{u}=useAuth(),lk=useLookups(),ms=useLiveQuery(()=>db.races.toArray(),[])||[],rl=useLiveQuery(()=>db.results.toArray(),[])||[],pn=useLiveQuery(()=>db.payments.where('status').equals('pending').toArray(),[])||[],tns=useLiveQuery(()=>db.tournaments.toArray(),[])||[];
  const nextT=tns.filter(x=>x.endDate>=today()).sort((a,b)=>a.startDate.localeCompare(b.startDate))[0];
  const gold={};rl.filter(x=>x.place===1).forEach(x=>gold[x.swimmerId]=(gold[x.swimmerId]||0)+1);const top=Object.entries(gold).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const tb=lk.batches.filter(b=>b.days?.includes(DN[new Date().getDay()]));
  return <div className="page"><div className="hero"><small>{t('Welcome back')}</small><h1>{t('Academy Overview')}</h1></div>
    <Live ms={ms}/>
    <Link to="/admin/tournaments" className="card pf"><Trophy/><div className="grow"><small>{t('Tournaments')}</small><b className="sm">{nextT?nextT.name:t('No tournament yet')}</b>{nextT&&<small>{fmtD(nextT.startDate)} – {fmtD(nextT.endDate)}</small>}</div><Badge t={t('{n} total',{n:tns.length})} c="violet"/></Link>
    <div className="grid">{[['Swimmers',lk.players.length],['Coaches',lk.coaches.length],['Batches',lk.batches.length],['Upcoming races',ms.filter(m=>m.status!=='completed').length]].map(([l,v],i)=>
      <motion.div key={l} className={`stat ${i===0?'v':''}`} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:i*.07}}><small>{t(l)}</small><b><Num v={v}/></b></motion.div>)}</div>
    {u.role==='admin'&&<Link to="/admin/fees" className="card pf"><IndianRupee/><div className="grow"><small>{t('Pending fees')}</small><b><Num v={pn.reduce((a,r)=>a+r.amount,0)} pre="₹"/></b></div><Badge t={t('{n} entries',{n:pn.length})} c="amber"/></Link>}
    <h3>{t("Today's batches")}</h3>{tb.map(b=><div key={b.id} className="card row"><div className="grow"><b>{b.name}</b><small>{b.startTime}-{b.endTime} · {t('Lane')} {b.lane} · {lk.by.coaches[b.coachId]?.name}</small></div></div>)}{!tb.length&&<Empty t="No batch today"/>}
    {!!top.length&&<><h3>{t('Medal leaderboard')}</h3>{top.map(([id,w],i)=><div key={id} className="card row"><span className="rank">{i+1}</span><div className="grow"><b>{lk.by.players[id]?.name}</b></div><Badge t={`${w} 🥇`} c="active"/></div>)}</>}</div>;
}
export function CoachHome(){
  const{u}=useAuth(),lk=useLookups(),ms=useLiveQuery(()=>db.races.toArray(),[])||[];
  const mine=lk.batches.filter(b=>b.coachId===u.refId),me=lk.by.coaches[u.refId];
  return <div className="page"><div className="hero"><small>{t('Welcome, coach')}</small><h1>{me?.name||t('Coach')}</h1></div><Live ms={ms}/>
    <div className="grid"><div className="stat v"><small>{t('My swimmers')}</small><b><Num v={lk.players.filter(p=>p.coachId===u.refId).length}/></b></div><div className="stat"><small>{t('My batches')}</small><b><Num v={mine.length}/></b></div></div>
    <h3>{t('My batches')}</h3>{mine.map(b=><div key={b.id} className="card row"><div className="grow"><b>{b.name}</b><small>{DL(b.days)} · {b.startTime}-{b.endTime} · {t('Lane')} {b.lane}</small></div></div>)}</div>;
}
export function More({items}){return <div className="page"><div className="bar"><h2>{t('More')}</h2></div><div className="grid mg">{items.map(([p,l,I],i)=><motion.div key={p} initial={{opacity:0,scale:.9}} animate={{opacity:1,scale:1}} transition={{delay:i*.05}}><Link className="stat tilec" to={`/admin/${p}`}><I/><b className="sm">{t(l)}</b></Link></motion.div>)}</div></div>}

/* ---------- Parent ---------- */
export function PHome(){
  const{kid}=useOutletContext(),lk=useLookups(),s=useLiveQuery(getS,[])||{};
  const pay=useLiveQuery(()=>kid?db.payments.where('playerId').equals(kid.id).toArray():[],[kid?.id])||[],ms=useLiveQuery(()=>db.races.toArray(),[])||[];
  if(!kid)return <Empty t="No child is linked to this login"/>;
  const mine=ms.filter(r=>r.swimmerIds?.includes(kid.id)),b=lk.by.batches[kid.batchId],c=lk.by.coaches[kid.coachId];
  const due=pay.map(r=>({r,d:dueState(r,s.dueDay)})).filter(x=>x.d).sort((x,y)=>(x.d.o??-99)-(y.d.o??-99))[0],next=mine.filter(m=>m.status==='scheduled').sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt))[0];
  return <div className="page"><motion.div className="hero kid" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}><Avatar n={kid.name} id={kid.id}/><div><h1>{kid.name}</h1><small>{t(kid.level)} · {t(kid.stroke||'')} · {kid.age} {t('yrs')}</small></div></motion.div>
    {due&&<Link to="/parent/fees" className={`notice ${due.d.c}`}><IndianRupee size={18}/><div className="grow"><b>{due.r.type==='registration'?t('Registration fee'):t('{m} fee',{m:due.r.forMonth})} · {rs(due.r.amount)}</b><small>{due.d.t}</small></div><span>{t('Pay →')}</span></Link>}
    <Live ms={mine}/>
    <div className="card"><h3>{t('Training')}</h3><p><b>{b?.name||t('No batch assigned')}</b></p><small className="mut">{b?`${DL(b.days)} · ${b.startTime}-${b.endTime} · ${t('Lane')} ${b.lane}`:''}</small>
      {c&&<div className="row"><div className="grow"><small className="mut">{t('Coach')}</small><p><b>{c.name}</b></p></div><a className="ib lime" href={`tel:${c.phone}`}><Phone size={16}/></a></div>}</div>
    {next&&<div className="card"><h3>{t('Next race')}</h3><div className="row"><RaceRow r={next} lk={lk}/></div></div>}</div>;
}
export function PFees(){
  const{kid}=useOutletContext(),s=useLiveQuery(getS,[])||{},[pay,setPay]=useState(null);
  const rows=useLiveQuery(()=>kid?db.payments.where('playerId').equals(kid.id).toArray():[],[kid?.id])||[];
  if(!kid)return <Empty t="No child is linked to this login"/>;
  const pend=rows.filter(r=>r.status==='pending').sort((a,b)=>(a.forMonth||'').localeCompare(b.forMonth||'')),paid=rows.filter(r=>r.status==='paid').sort((a,b)=>b.paidOn.localeCompare(a.paidOn));
  return <div className="page"><div className="bar"><h2>{t('Fees')} · {kid.name.split(' ')[0]}</h2></div>
    {pend.map(r=>{const d=dueState(r,s.dueDay);return <motion.div key={r.id} className={`notice ${d.c}`} initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}}>
      <div className="grow"><b>{r.type==='registration'?t('Registration fee'):r.forMonth} · {rs(r.amount)}</b><small>{d.t}</small></div>
      <button className="btn lime sm" onClick={()=>setPay({playerId:kid.id,row:r})}>{t('Pay now')}</button></motion.div>})}
    {!pend.length&&<div className="card ok"><Check/> {t('All fees are paid')}</div>}
    <h3>{t('History')}</h3>{paid.map(r=><div key={r.id} className="card row"><div className="grow"><b>{r.type==='registration'?t('Registration'):r.forMonth}{r.planMonths>1?` · ${t('{n}-month plan',{n:r.planMonths})}`:''}</b><small>{r.paidOn} · {t(r.mode==='online'?'Online':'Offline')} · {r.receiptNo}</small></div><b>{rs(r.amount)}</b></div>)}
    <PaySheet st={pay} close={()=>setPay(null)} online/></div>;
}
export function Progress(){
  const{kid}=useOutletContext();
  const at=useLiveQuery(()=>kid?db.attendance.where('playerId').equals(kid.id).toArray():[],[kid?.id])||[],ns=useLiveQuery(()=>kid?db.notes.where('playerId').equals(kid.id).toArray():[],[kid?.id])||[];
  const rl=useLiveQuery(()=>kid?db.results.where('swimmerId').equals(kid.id).toArray():[],[kid?.id])||[],rc=useLiveQuery(()=>db.races.toArray(),[])||[],lk=useLookups();
  if(!kid)return <Empty t="No child is linked to this login"/>;
  const pc=at.length?Math.round(at.filter(a=>a.status!=='Absent').length/at.length*100):0;
  return <div className="page"><div className="bar"><h2>{t('Progress')}</h2></div>
    <div className="grid"><div className="stat v"><small>{t('Attendance')}</small><b><Num v={pc}/>%</b></div><div className="stat"><small>{t('Medals')}</small><b>{rl.filter(x=>x.place<=3).length} 🏅</b></div></div>
    <h3>{t('Race results')}</h3>{rl.slice().reverse().map(x=>{const r=rc.find(y=>y.id===x.raceId);return <div key={x.id} className="card row"><b className="md">{medal(x.place)}</b><div className="grow"><b>{r?.event}</b><small>{fmt(r?.scheduledAt)}</small></div><b>{T(x.timeMs)}</b></div>})}{!rl.length&&<Empty t="No race results yet"/>}
    <h3>{t('Recent attendance')}</h3><div className="dots">{at.slice(-14).map(a=><i key={a.id} title={a.date} className={a.status}/>)}</div>
    <h3>{t('Coach notes')}</h3>{ns.slice().reverse().map(n=><div key={n.id} className="note"><small>{n.date} · {lk.by.coaches[n.coachId]?.name}</small><p>{n.text}</p></div>)}{!ns.length&&<Empty t="No notes yet"/>}</div>;
}

/* ---------- Settings / Login ---------- */
export function SettingsPage(){
  const s=useLiveQuery(getS,[])||{},toast=useToast(),{logout}=useAuth();const[v,setV]=useState(null),[rst,setRst]=useState(false);
  useEffect(()=>{if(!v&&s.monthlyFee!==undefined)setV(s)},[s.monthlyFee]);
  const save=async()=>{await db.settings.bulkPut(Object.entries(v).map(([key,x])=>({key,value:Number(x)})));toast('Saved ✓')};
  const exp=async()=>{const o={};for(const k of db.tables)o[k.name]=await k.toArray();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o)],{type:'application/json'}));a.download=`stadia-swim-${today()}.json`;a.click()};
  const imp=async e=>{const f=e.target.files[0];if(!f)return;const o=JSON.parse(await f.text());await Promise.all(db.tables.map(k=>k.clear()));for(const k of db.tables)if(o[k.name])await k.bulkPut(o[k.name]);toast('Imported ✓')};
  return <div className="page"><div className="bar"><h2>{t('Settings')}</h2></div>
    {v&&<div className="card"><h3>{t('Fees')}</h3>{[['registrationFee','Registration fee (₹)'],['monthlyFee','Monthly fee (₹)'],['dueDay','Due day of month (1-28)']].map(([k,l])=><label key={k} className="fld"><span>{t(l)}</span><input type="number" value={v[k]??''} onChange={e=>setV({...v,[k]:e.target.value})}/></label>)}<button className="btn" onClick={save}>{t('Save fees')}</button></div>}
    <div className="card"><h3>{t('Backup')}</h3><button className="btn ghost" onClick={exp}><Download size={16}/> {t('Export JSON')}</button>
      <label className="btn ghost"><Upload size={16}/> {t('Import JSON')}<input hidden type="file" accept=".json" onChange={imp}/></label>
      <button className="btn red" onClick={()=>setRst(true)}><RotateCcw size={16}/> {t('Reset demo data')}</button></div>
    <button className="btn ghost" onClick={logout}><LogOut size={16}/> {t('Logout')}</button>
    <Confirm msg={rst&&'This will erase all data and restore the demo data.'} onClose={()=>setRst(false)} onYes={async()=>{await seed(true);toast('Demo data reset')}}/></div>;
}
export function Login(){
  const{u,login}=useAuth();const[f,setF]=useState({u:'',p:''}),[bad,setBad]=useState(0);
  if(u)return <Navigate to={`/${u.role}`} replace/>;
  const Q=[['Admin','admin','admin123'],['Coach','coach1','coach123'],['Parent','parent1','parent123']];
  return <div className="login"><LangSwitch/><motion.form className="lbox" key={bad} animate={bad?{x:[0,-12,12,-8,8,0]}:{}} onSubmit={async e=>{e.preventDefault();if(!await login(f.u.trim(),f.p))setBad(b=>b+1)}}>
    <motion.div className="ball big" animate={{y:[0,-18,0]}} transition={{repeat:Infinity,duration:1.3,ease:'easeOut'}}/>
    <h1>STADIA</h1><p className="mut">{t('Swimming Academy Manager')}</p>
    <input className="inp" placeholder={t('Username')} value={f.u} onChange={e=>setF({...f,u:e.target.value})}/>
    <input className="inp" type="password" placeholder={t('Password')} value={f.p} onChange={e=>setF({...f,p:e.target.value})}/>
    {!!bad&&<p className="err">{t('Wrong username or password')}</p>}
    <button className="btn">{t('Login')}</button>
    <div className="chips">{Q.map(([l,a,b])=><button type="button" key={l} className="chip" onClick={()=>setF({u:a,p:b})}>{t(l)}</button>)}</div></motion.form></div>;
}
