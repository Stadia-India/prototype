import {useState,useEffect} from 'react';
import {Link,Navigate,useNavigate,useOutletContext,useParams} from 'react-router-dom';
import {useLiveQuery} from 'dexie-react-hooks';
import {motion,AnimatePresence} from 'framer-motion';
import {Play,Eye,Trophy,Trash2,Check,Undo2,ArrowLeft,Download,Upload,RotateCcw,LogOut,NotebookPen,IndianRupee,Phone} from 'lucide-react';
import {db,today,thisMonth,seed,getS,payReg,payMonthly,dueState} from './db';
import {derive} from './engine';
import {useAuth,useToast,Sheet,Confirm,Avatar,Badge,Num,Empty,useLookups} from './ui';
import {Crud} from './crud';

const fmt=s=>s?new Date(s).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'';
const rs=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const nm=(lk,id)=>lk.by.players[id]?.name||'Deleted player';

/* ---------- cascades (delete rules) ---------- */
const cas={
  coaches:async r=>{await db.players.where('coachId').equals(r.id).modify({coachId:null});await db.batches.where('coachId').equals(r.id).modify({coachId:null});await db.users.filter(u=>u.role==='coach'&&u.refId===r.id).delete()},
  parents:async r=>{await db.players.where('parentId').equals(r.id).modify({parentId:null});await db.users.filter(u=>u.role==='parent'&&u.refId===r.id).delete()},
  batches:async r=>{await db.players.where('batchId').equals(r.id).modify({batchId:null})},
  players:async r=>{for(const t of['attendance','notes','payments'])await db[t].where('playerId').equals(r.id).delete();
    await db.matches.filter(m=>m.status==='scheduled'&&(m.player1Id===r.id||m.player2Id===r.id)).delete()},
};

/* ---------- Coaches / Parents / Batches ---------- */
export const Coaches=()=><Crud table="coaches" title="Coaches" login cascade={cas.coaches} defaults={{status:'Active'}}
  fields={[{k:'name',label:'Name',req:1},{k:'phone',label:'Phone',t:'tel',req:1},{k:'specialization',label:'Specialization'},{k:'experienceYears',label:'Experience (years)',t:'number'},{k:'status',label:'Status',t:'select',opts:['Active','Inactive'],req:1}]}
  render={(c,lk)=><><Avatar n={c.name} id={c.id}/><div className="grow"><b>{c.name}</b><small>{c.specialization||'—'} · {lk.players.filter(p=>p.coachId===c.id).length} players</small></div><Badge t={c.status}/></>}/>;
export const Parents=()=><Crud table="parents" title="Parents" login cascade={cas.parents}
  fields={[{k:'name',label:'Name',req:1},{k:'phone',label:'Phone',t:'tel',req:1}]}
  render={(p,lk)=><><Avatar n={p.name} id={p.id+3}/><div className="grow"><b>{p.name}</b><small>{p.phone} · बच्चे: {lk.players.filter(x=>x.parentId===p.id).map(x=>x.name.split(' ')[0]).join(', ')||'—'}</small></div></>}/>;
export const Batches=()=><Crud table="batches" title="Batches" cascade={cas.batches}
  fields={[{k:'name',label:'Batch name',req:1},{k:'coachId',label:'Coach',t:'select',opts:'coaches',req:1},{k:'days',label:'Days',t:'days',req:1},{k:'startTime',label:'Start',t:'time',req:1},{k:'endTime',label:'End',t:'time',req:1},{k:'tableNo',label:'Table no',t:'number',req:1}]}
  render={(b,lk)=><div className="grow"><b>{b.name}</b><small>{lk.by.coaches[b.coachId]?.name||'No coach'} · {b.days?.join(' ')} · {b.startTime}-{b.endTime} · Table {b.tableNo}</small><small>{lk.players.filter(p=>p.batchId===b.id).length} players</small></div>}/>;

/* ---------- Players (+ registration fee step, coach notes) ---------- */
const PF=[{k:'name',label:'Name',req:1},{k:'age',label:'Age',t:'number',req:1},{k:'level',label:'Level',t:'select',opts:['Beginner','Intermediate','Advanced'],req:1},{k:'hand',label:'Playing hand',t:'select',opts:['Right','Left']},{k:'parentId',label:'Parent',t:'select',opts:'parents'},{k:'coachId',label:'Coach',t:'select',opts:'coaches'},{k:'batchId',label:'Batch',t:'select',opts:'batches'},{k:'status',label:'Status',t:'select',opts:['Active','Inactive'],req:1}];
export function Players({coach}){
  const{u}=useAuth();const[pay,setPay]=useState(null),[note,setNote]=useState(null);
  return <><Crud table="players" title="Players" fields={PF} defaults={{level:'Beginner',hand:'Right',status:'Active'}} cascade={cas.players}
    readonly={coach} filter={coach?p=>p.coachId===u.refId:null}
    render={(p,lk)=><><Avatar n={p.name} id={p.id}/><div className="grow"><b>{p.name}</b><small>{p.age} yrs · {lk.by.coaches[p.coachId]?.name||'No coach'} · {lk.by.batches[p.batchId]?.name||'No batch'}</small></div><Badge t={p.level}/></>}
    afterAdd={async id=>{const s=await getS();const rid=await db.payments.add({playerId:id,type:'registration',amount:s.registrationFee,status:'pending'});setPay({playerId:id,row:await db.payments.get(rid)})}}
    actions={coach?p=><button className="ib" onClick={()=>setNote(p)}><NotebookPen size={16}/></button>:null}/>
    <PaySheet st={pay} close={()=>setPay(null)}/><NoteSheet p={note} close={()=>setNote(null)}/></>;
}
function NoteSheet({p,close}){
  const{u}=useAuth();const[t,setT]=useState('');
  const ns=useLiveQuery(()=>p?db.notes.where('playerId').equals(p.id).toArray():[],[p?.id])||[];
  return <Sheet open={!!p} onClose={close} title={`Notes · ${p?.name||''}`}>
    <textarea className="ta" placeholder="Skill note / feedback (parent को भी दिखेगा)" value={t} onChange={e=>setT(e.target.value)}/>
    <button className="btn" onClick={async()=>{if(!t.trim())return;await db.notes.add({playerId:p.id,coachId:u.refId,text:t.trim(),date:today()});setT('')}}>Add note</button>
    {ns.slice().reverse().map(n=><div key={n.id} className="note"><small>{n.date}</small><p>{n.text}</p><button className="ib red" onClick={()=>db.notes.delete(n.id)}><Trash2 size={14}/></button></div>)}
  </Sheet>;
}

/* ---------- Payments ---------- */
export function PaySheet({st,close,online}){
  const[mode,setMode]=useState('online'),[plan,setPlan]=useState(1),[busy,setBusy]=useState(0);
  const s=useLiveQuery(getS,[])||{};const pl=useLiveQuery(()=>st?db.players.get(st.playerId):null,[st?.playerId]);
  const reg=st?.row?.type==='registration';const amt=reg?st.row.amount:(s.monthlyFee||0)*plan;
  const go=async()=>{
    const m=online?'online':mode;if(m==='online'){setBusy(1);await new Promise(r=>setTimeout(r,1300))}
    reg?await payReg(st.row.id,m):await payMonthly(st.playerId,plan,m);
    setBusy(2);setTimeout(()=>{setBusy(0);setPlan(1);close()},1100);
  };
  return <Sheet open={!!st} onClose={busy?()=>{}:close} title={reg?'Registration Fee':'Monthly Fee'}>
    {busy===2?<motion.div className="done" initial={{scale:.3,opacity:0}} animate={{scale:1,opacity:1}}><Check size={48}/><b>Payment recorded</b></motion.div>:<>
      <p className="mut">{pl?.name}</p><div className="amt"><Num v={amt} pre="₹"/></div>
      {!reg&&<><div className="chips">{[[1,'1 Month'],[6,'6 Months'],[12,'1 Year']].map(([n,l])=><button key={n} className={plan===n?'chip on':'chip'} onClick={()=>setPlan(n)}>{l}</button>)}</div>
        <small className="mut">{plan>1?`${plan} महीने की fee एक साथ — आगे के महीने "Paid" दिखेंगे`:'हर महीने देनी होगी; चाहें तो 6 महीने / 1 साल एक साथ दें'}</small></>}
      {!online&&<div className="chips">{[['online','Online (UPI/Card)'],['offline','Offline (Cash/Desk)']].map(([k,l])=><button key={k} className={mode===k?'chip on':'chip'} onClick={()=>setMode(k)}>{l}</button>)}</div>}
      <button className="btn" disabled={busy===1} onClick={go}>{busy===1?'Processing…':(online||mode==='online')?`Pay ${rs(amt)} online`:`Received ${rs(amt)}`}</button>
      {reg&&<button className="btn ghost" onClick={close}>बाद में (Pending रहेगी)</button>}
      {(online||mode==='online')&&<small className="mut">Demo: यह simulated payment screen है, असली पैसा नहीं कटता।</small>}</>}
  </Sheet>;
}
export function Fees(){
  const[tab,setTab]=useState('pending'),[pay,setPay]=useState(null),[dl,setDl]=useState(null);
  const rows=useLiveQuery(()=>db.payments.toArray(),[])||[],lk=useLookups(),s=useLiveQuery(getS,[])||{};
  const sum=a=>a.reduce((x,r)=>x+r.amount,0),m=thisMonth();
  const coll=rows.filter(r=>r.status==='paid'&&r.paidOn?.slice(0,7)===m),pend=rows.filter(r=>r.status==='pending');
  const od=pend.filter(r=>dueState(r,s.dueDay)?.c==='coral'),on=sum(coll.filter(r=>r.mode==='online'));
  const list=rows.filter(r=>r.status===tab).sort((a,b)=>(b.paidOn||b.forMonth||'').localeCompare(a.paidOn||a.forMonth||''));
  return <div className="page"><div className="bar"><h2>Fees</h2></div>
    <div className="grid"><div className="stat v"><small>Collected (this month)</small><b><Num v={sum(coll)} pre="₹"/></b></div>
      <div className="stat"><small>Pending</small><b><Num v={sum(pend)} pre="₹"/></b></div>
      <div className="stat c"><small>Overdue</small><b><Num v={od.length}/></b></div>
      <div className="stat"><small>Online / Offline</small><b className="sm">{rs(on)} / {rs(sum(coll)-on)}</b></div></div>
    <div className="tabs">{['pending','paid'].map(t=><button key={t} className={tab===t?'on':''} onClick={()=>setTab(t)}>{t==='pending'?'Pending':'Paid'}</button>)}</div>
    <div className="list">{list.map(r=>{const d=dueState(r,s.dueDay);return <motion.div layout key={r.id} className="card row" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}}>
      <div className="grow"><b>{nm(lk,r.playerId)}</b><small>{r.type==='registration'?'Registration':r.forMonth}{r.planMonths>1?` · ${r.planMonths}-month plan`:''} · {r.mode||'—'}{r.receiptNo?` · ${r.receiptNo}`:''}</small></div>
      <div className="rt"><b>{rs(r.amount)}</b>{d?<Badge t={d.t} c={d.c}/>:<Badge t="Paid"/>}</div>
      <div className="acts">{r.status==='pending'&&<button className="ib lime" onClick={()=>setPay({playerId:r.playerId,row:r})}><IndianRupee size={16}/></button>}
        <button className="ib red" onClick={()=>setDl(r)}><Trash2 size={16}/></button></div></motion.div>})}</div>
    {!list.length&&<Empty t="कोई entry नहीं"/>}
    <PaySheet st={pay} close={()=>setPay(null)}/>
    <Confirm msg={dl&&'यह payment entry delete हो जाएगी।'} onClose={()=>setDl(null)} onYes={()=>db.payments.delete(dl.id)}/></div>;
}

/* ---------- Matches ---------- */
function MatchRow({m,lk}){
  const pts=useLiveQuery(()=>db.pointLog.where('matchId').equals(m.id).sortBy('id'),[m.id])||[];
  const gs=useLiveQuery(()=>db.games.where('matchId').equals(m.id).toArray(),[m.id])||[];
  const s=derive(pts.map(p=>p.scorer),m.bestOf);
  return <><div className="grow"><div className="vs"><b>{nm(lk,m.player1Id)}</b><span>vs</span><b>{nm(lk,m.player2Id)}</b></div>
    <small>Best of {m.bestOf} · Table {m.tableNo} · {fmt(m.scheduledAt)}</small>
    {m.status==='live'&&<div className="mini">Games {s.w[0]}-{s.w[1]} · Score {s.a}-{s.b}</div>}
    {m.status==='completed'&&<div className="mini">{gs.sort((x,y)=>x.gameNo-y.gameNo).map(g=>`${g.p1Score}-${g.p2Score}`).join(', ')}</div>}</div>
    <Badge t={m.status}/></>;
}
export function Matches({role}){
  const{u}=useAuth();const ctx=useOutletContext()||{};const[tab,setTab]=useState('scheduled');
  const mine=useLiveQuery(()=>role==='coach'?db.players.where('coachId').equals(u.refId).primaryKeys():[],[role,u.refId])||[];
  const ok=m=>role==='admin'||(role==='coach'?mine.includes(m.player1Id)||mine.includes(m.player2Id):m.player1Id===ctx.kid?.id||m.player2Id===ctx.kid?.id);
  const tabs=[['scheduled','Upcoming'],['live','Live'],['completed','Done']];
  return <Crud table="matches" title="Matches" readonly={role!=='admin'} filter={m=>m.status===tab&&ok(m)} canMod={m=>m.status==='scheduled'}
    sort={(a,b)=>tab==='completed'?b.scheduledAt.localeCompare(a.scheduledAt):a.scheduledAt.localeCompare(b.scheduledAt)}
    defaults={{bestOf:3,status:'scheduled'}} validate={v=>v.player1Id===v.player2Id?'दोनों player अलग होने चाहिए':null}
    fields={[{k:'player1Id',label:'Player 1',t:'select',opts:'players',req:1},{k:'player2Id',label:'Player 2',t:'select',opts:'players',req:1},{k:'bestOf',label:'Best of',t:'select',opts:[3,5,7],num:1,req:1},{k:'tableNo',label:'Table no',t:'number',req:1},{k:'scheduledAt',label:'Date & time',t:'datetime-local',req:1}]}
    top={<div className="tabs">{tabs.map(([k,l])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{l}</button>)}</div>}
    cascade={async m=>{await db.pointLog.where('matchId').equals(m.id).delete()}}
    render={(m,lk)=><MatchRow m={m} lk={lk}/>}
    actions={m=><>{role!=='parent'&&m.status!=='completed'&&<Link className="ib lime" to={`/score/${m.id}`}><Play size={16}/></Link>}
      {m.status!=='scheduled'&&<Link className="ib" to={`/board/${m.id}`}><Eye size={16}/></Link>}</>}/>;
}

/* ---------- Live scoring ---------- */
const Confetti=()=><div className="conf">{Array.from({length:28}).map((_,i)=><motion.i key={i} style={{left:`${(i*37)%100}%`,background:['#C6F432','#6C4DFF','#FF5C7A','#2DD4BF'][i%4]}}
  initial={{y:-20,opacity:1}} animate={{y:'100dvh',rotate:360*(i%3+1),opacity:0}} transition={{duration:2+(i%5)*.3,delay:(i%7)*.1}}/>)}</div>;
function ScoreView({m,s,n1,n2,onPoint}){
  const P=(i,n,sc)=><motion.button className={`pn ${s.server===i&&!s.done?'srv':''}`} disabled={!onPoint||s.done} onClick={()=>onPoint(i+1)} whileTap={onPoint?{scale:.97}:{}}>
    <div className="pt"><span className="nm">{n}</span>{s.server===i&&!s.done&&<motion.i layoutId="ball" className="ball"/>}</div>
    <div className="sc"><AnimatePresence mode="popLayout" initial={false}><motion.span key={sc} initial={{y:-50,opacity:0,scale:1.4}} animate={{y:0,opacity:1,scale:1}} exit={{y:50,opacity:0}}>{sc}</motion.span></AnimatePresence></div>
    <div className="gw">{Array.from({length:s.need}).map((_,k)=><i key={k} className={k<s.w[i]?'on':''}/>)}{onPoint&&!s.done&&<small>Tap = +1</small>}</div></motion.button>;
  return <div className="sv"><div className="svh">{m.status==='live'?<span className="live"><i/>LIVE</span>:<Badge t={m.status}/>}<span>Game {Math.min(s.gameNo,s.games.length+(s.done?0:1))} · Best of {m.bestOf}</span><span>Table {m.tableNo}</span></div>
    {P(0,n1,s.a)}{P(1,n2,s.b)}
    <AnimatePresence>{s.swap&&<motion.div className="swap" initial={{y:-20,opacity:0}} animate={{y:0,opacity:1}} exit={{opacity:0}}>🔄 Sides बदलिए (5 points)</motion.div>}</AnimatePresence>
    {s.done&&<><Confetti/><motion.div className="win" initial={{scale:.5,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring'}}><Trophy size={36}/><h2>{s.winner===1?n1:n2} जीते!</h2><small>{s.games.map(g=>g.join('-')).join('  ·  ')}</small></motion.div></>}</div>;
}
export function Console(){
  const{id}=useParams(),mid=+id,lk=useLookups(),toast=useToast(),nav=useNavigate();
  const m=useLiveQuery(()=>db.matches.get(mid),[mid]);
  const pts=useLiveQuery(()=>db.pointLog.where('matchId').equals(mid).sortBy('id'),[mid])||[];
  const s=derive(pts.map(p=>p.scorer),m?.bestOf||3);
  useEffect(()=>{if(m&&s.done&&m.status==='live')(async()=>{
    await db.matches.update(mid,{status:'completed',winnerId:s.winner===1?m.player1Id:m.player2Id});
    await db.games.where('matchId').equals(mid).delete();
    await db.games.bulkAdd(s.games.map((g,i)=>({matchId:mid,gameNo:i+1,p1Score:g[0],p2Score:g[1]})));toast('Match पूरा 🏆')})()},[s.done,m?.status]);
  if(!m)return <Empty t="Match नहीं मिला"/>;
  const add=async n=>{if(m.status==='scheduled')await db.matches.update(mid,{status:'live'});if(!s.done)await db.pointLog.add({matchId:mid,scorer:n,ts:Date.now()})};
  const undo=async()=>{const l=pts[pts.length-1];if(!l)return;await db.pointLog.delete(l.id);
    if(m.status==='completed'){await db.matches.update(mid,{status:'live',winnerId:null});await db.games.where('matchId').equals(mid).delete()}};
  return <div className="dark"><div className="ctl"><button className="ib" onClick={()=>nav(-1)}><ArrowLeft size={18}/></button>
    <button className="ib" onClick={undo}><Undo2 size={18}/></button><a className="btn lime sm" href={`#/board/${mid}`} target="_blank" rel="noreferrer"><Eye size={16}/> Scoreboard</a></div>
    <ScoreView m={m} s={s} n1={nm(lk,m.player1Id)} n2={nm(lk,m.player2Id)} onPoint={add}/></div>;
}
export function Board(){
  const{id}=useParams(),mid=+id,lk=useLookups();
  const m=useLiveQuery(()=>db.matches.get(mid),[mid]);const pts=useLiveQuery(()=>db.pointLog.where('matchId').equals(mid).sortBy('id'),[mid])||[];
  if(!m)return <div className="dark"><Empty t="Match नहीं मिला"/></div>;
  return <div className="dark"><ScoreView m={m} s={derive(pts.map(p=>p.scorer),m.bestOf)} n1={nm(lk,m.player1Id)} n2={nm(lk,m.player2Id)}/></div>;
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
  return <div className="page"><div className="bar"><h2>Attendance</h2></div>
    <div className="two"><select className="inp" value={bid} onChange={e=>setBid(e.target.value)}>{bs.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
      <input className="inp" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
    <button className="btn ghost" onClick={()=>setSt(Object.fromEntries(pl.map(p=>[p.id,'Present'])))}>सब Present</button>
    <div className="list">{pl.map(p=>{const v=st[p.id]||'Present';return <motion.button layout whileTap={{scale:.97}} key={p.id} className="card row tap" onClick={()=>setSt(s=>({...s,[p.id]:cyc[v]}))}>
      <Avatar n={p.name} id={p.id}/><div className="grow"><b>{p.name}</b></div><Badge t={v} c={v==='Present'?'active':v==='Absent'?'advanced':'intermediate'}/></motion.button>})}</div>
    {!pl.length&&<Empty t="इस batch में players नहीं हैं"/>}{!!pl.length&&<button className="btn" onClick={save}>Save attendance</button>}</div>;
}

/* ---------- Dashboards ---------- */
function Live({ms,lk}){const m=ms.find(x=>x.status==='live');if(!m)return null;
  return <Link to={`/board/${m.id}`} className="livebar"><span className="live"><i/>LIVE</span><b>{nm(lk,m.player1Id)} vs {nm(lk,m.player2Id)}</b><Eye size={18}/></Link>}
const DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export function Dash(){
  const{u}=useAuth(),lk=useLookups(),ms=useLiveQuery(()=>db.matches.toArray(),[])||[],pn=useLiveQuery(()=>db.payments.where('status').equals('pending').toArray(),[])||[];
  const wins={};ms.forEach(m=>m.winnerId&&(wins[m.winnerId]=(wins[m.winnerId]||0)+1));const top=Object.entries(wins).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const tb=lk.batches.filter(b=>b.days?.includes(DN[new Date().getDay()]));
  return <div className="page"><div className="hero"><small>Welcome back</small><h1>{u.role==='admin'?'Academy Overview':'Coach Dashboard'}</h1></div>
    <Live ms={ms} lk={lk}/>
    <div className="grid">{[['Players',lk.players.length],['Coaches',lk.coaches.length],['Batches',lk.batches.length],['Upcoming',ms.filter(m=>m.status!=='completed').length]].map(([l,v],i)=>
      <motion.div key={l} className={`stat ${i===0?'v':''}`} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:i*.07}}><small>{l}</small><b><Num v={v}/></b></motion.div>)}</div>
    {u.role==='admin'&&<Link to="/admin/fees" className="card pf"><IndianRupee/><div className="grow"><small>Pending fees</small><b><Num v={pn.reduce((a,r)=>a+r.amount,0)} pre="₹"/></b></div><Badge t={`${pn.length} entries`} c="amber"/></Link>}
    <h3>आज के batches</h3>{tb.map(b=><div key={b.id} className="card row"><div className="grow"><b>{b.name}</b><small>{b.startTime}-{b.endTime} · Table {b.tableNo} · {lk.by.coaches[b.coachId]?.name}</small></div></div>)}{!tb.length&&<Empty t="आज कोई batch नहीं"/>}
    {u.role==='admin'&&!!top.length&&<><h3>Leaderboard</h3>{top.map(([id,w],i)=><div key={id} className="card row"><span className="rank">{i+1}</span><div className="grow"><b>{lk.by.players[id]?.name}</b></div><Badge t={`${w} wins`} c="active"/></div>)}</>}</div>;
}
export function CoachHome(){
  const{u}=useAuth(),lk=useLookups(),ms=useLiveQuery(()=>db.matches.toArray(),[])||[];
  const mine=lk.batches.filter(b=>b.coachId===u.refId),me=lk.by.coaches[u.refId];
  return <div className="page"><div className="hero"><small>Namaste coach</small><h1>{me?.name||'Coach'}</h1></div><Live ms={ms} lk={lk}/>
    <div className="grid"><div className="stat v"><small>My players</small><b><Num v={lk.players.filter(p=>p.coachId===u.refId).length}/></b></div><div className="stat"><small>My batches</small><b><Num v={mine.length}/></b></div></div>
    <h3>Mere batches</h3>{mine.map(b=><div key={b.id} className="card row"><div className="grow"><b>{b.name}</b><small>{b.days?.join(' ')} · {b.startTime}-{b.endTime} · Table {b.tableNo}</small></div></div>)}</div>;
}
export function More({items}){return <div className="page"><div className="bar"><h2>More</h2></div><div className="grid mg">{items.map(([p,l,I],i)=><motion.div key={p} initial={{opacity:0,scale:.9}} animate={{opacity:1,scale:1}} transition={{delay:i*.05}}><Link className="stat tilec" to={`/admin/${p}`}><I/><b className="sm">{l}</b></Link></motion.div>)}</div></div>}

/* ---------- Parent ---------- */
export function PHome(){
  const{kid}=useOutletContext(),lk=useLookups(),s=useLiveQuery(getS,[])||{};
  const pay=useLiveQuery(()=>kid?db.payments.where('playerId').equals(kid.id).toArray():[],[kid?.id])||[],ms=useLiveQuery(()=>db.matches.toArray(),[])||[];
  if(!kid)return <Empty t="इस login से कोई बच्चा जुड़ा नहीं है"/>;
  const mine=ms.filter(m=>m.player1Id===kid.id||m.player2Id===kid.id),b=lk.by.batches[kid.batchId],c=lk.by.coaches[kid.coachId];
  const due=pay.map(r=>({r,d:dueState(r,s.dueDay)})).filter(x=>x.d).sort((x,y)=>(x.d.o??-99)-(y.d.o??-99))[0],next=mine.filter(m=>m.status==='scheduled').sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt))[0];
  return <div className="page"><motion.div className="hero kid" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}><Avatar n={kid.name} id={kid.id}/><div><h1>{kid.name}</h1><small>{kid.level} · {kid.age} yrs</small></div></motion.div>
    {due&&<Link to="/parent/fees" className={`notice ${due.d.c}`}><IndianRupee size={18}/><div className="grow"><b>{due.r.type==='registration'?'Registration fee':`${due.r.forMonth} fee`} · {rs(due.r.amount)}</b><small>{due.d.t}</small></div><span>Pay →</span></Link>}
    <Live ms={mine} lk={lk}/>
    <div className="card"><h3>Training</h3><p><b>{b?.name||'Batch assign नहीं'}</b></p><small className="mut">{b?`${b.days?.join(' ')} · ${b.startTime}-${b.endTime} · Table ${b.tableNo}`:''}</small>
      {c&&<div className="row"><div className="grow"><small className="mut">Coach</small><p><b>{c.name}</b></p></div><a className="ib lime" href={`tel:${c.phone}`}><Phone size={16}/></a></div>}</div>
    {next&&<div className="card"><h3>अगला match</h3><div className="row"><MatchRow m={next} lk={lk}/></div></div>}</div>;
}
export function PFees(){
  const{kid}=useOutletContext(),s=useLiveQuery(getS,[])||{},[pay,setPay]=useState(null);
  const rows=useLiveQuery(()=>kid?db.payments.where('playerId').equals(kid.id).toArray():[],[kid?.id])||[];
  if(!kid)return <Empty t="कोई बच्चा नहीं"/>;
  const pend=rows.filter(r=>r.status==='pending').sort((a,b)=>(a.forMonth||'').localeCompare(b.forMonth||'')),paid=rows.filter(r=>r.status==='paid').sort((a,b)=>b.paidOn.localeCompare(a.paidOn));
  return <div className="page"><div className="bar"><h2>Fees · {kid.name.split(' ')[0]}</h2></div>
    {pend.map(r=>{const d=dueState(r,s.dueDay);return <motion.div key={r.id} className={`notice ${d.c}`} initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}}>
      <div className="grow"><b>{r.type==='registration'?'Registration fee':r.forMonth} · {rs(r.amount)}</b><small>{d.t}</small></div>
      <button className="btn lime sm" onClick={()=>setPay({playerId:kid.id,row:r})}>Pay now</button></motion.div>})}
    {!pend.length&&<div className="card ok"><Check/> सब fees जमा हैं</div>}
    <h3>History</h3>{paid.map(r=><div key={r.id} className="card row"><div className="grow"><b>{r.type==='registration'?'Registration':r.forMonth}{r.planMonths>1?` · ${r.planMonths}-month plan`:''}</b><small>{r.paidOn} · {r.mode} · {r.receiptNo}</small></div><b>{rs(r.amount)}</b></div>)}
    <PaySheet st={pay} close={()=>setPay(null)} online/></div>;
}
export function Progress(){
  const{kid}=useOutletContext(),lk=useLookups();
  const at=useLiveQuery(()=>kid?db.attendance.where('playerId').equals(kid.id).toArray():[],[kid?.id])||[],
    ns=useLiveQuery(()=>kid?db.notes.where('playerId').equals(kid.id).toArray():[],[kid?.id])||[],
    ms=useLiveQuery(()=>db.matches.toArray(),[])||[],
    performance=useLiveQuery(()=>kid?db.performance.where('playerId').equals(kid.id).toArray():[],[kid?.id])||[];
  if(!kid)return <Empty t="कोई बच्चा नहीं"/>;
  const done=ms.filter(m=>m.status==='completed'&&(m.player1Id===kid.id||m.player2Id===kid.id)),
    w=done.filter(m=>m.winnerId===kid.id).length,
    pc=at.length?Math.round(at.filter(a=>a.status!=='Absent').length/at.length*100):0,
    latest=performance.slice().sort((a,b)=>b.date.localeCompare(a.date))[0],
    avg=r=>((Number(r.footwork)+Number(r.forehand)+Number(r.backhand)+Number(r.serve)+Number(r.fitness))/5).toFixed(1);
  return <div className="page"><div className="bar"><h2>Progress · {kid.name.split(' ')[0]}</h2></div>
    <div className="grid"><div className="stat v"><small>Attendance</small><b><Num v={pc}/>%</b></div><div className="stat"><small>Wins / Losses</small><b>{w} / {done.length-w}</b></div><div className="stat"><small>Assessments</small><b><Num v={performance.length}/></b></div></div>
    <section className="card"><div className="row"><div className="grow"><h3>Performance trend</h3><small className="mut">Your coach's skill assessments over time</small></div>{latest&&<Badge t={`${avg(latest)} / 5 latest`} c="active"/>}</div>
      <PerformanceLineChart records={performance.slice().sort((a,b)=>a.date.localeCompare(b.date))}/>
      {latest&&<><h3>Latest skill assessment</h3><div className="grid">{['footwork','forehand','backhand','serve','fitness'].map(k=><div className="stat" key={k}><small>{k[0].toUpperCase()+k.slice(1)}</small><b>{latest[k]} / 5</b></div>)}</div><small className="mut">Assessed on {latest.date}</small>{latest.notes&&<p>{latest.notes}</p>}</>}
    </section>
    <h3>Assessment history</h3>{performance.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=><div className="card" key={r.id}><div className="row"><b className="grow">{r.date}</b><Badge t={`${avg(r)} / 5`} c="active"/></div><small>{['footwork','forehand','backhand','serve','fitness'].map(k=>`${k}: ${r[k]}/5`).join(' · ')}</small>{r.notes&&<p>{r.notes}</p>}</div>)}{!performance.length&&<Empty t="Your coach has not added a performance assessment yet"/>}
    <h3>Recent attendance</h3><div className="dots">{at.slice(-14).map(a=><i key={a.id} title={a.date} className={a.status}/>)}</div>
    <h3>Coach notes</h3>{ns.slice().reverse().map(n=><div key={n.id} className="note"><small>{n.date} · {lk.by.coaches[n.coachId]?.name}</small><p>{n.text}</p></div>)}{!ns.length&&<Empty t="अभी कोई note नहीं"/>}</div>;
}

/* ---------- Settings / Login ---------- */
export function SettingsPage(){
  const s=useLiveQuery(getS,[])||{},toast=useToast(),{logout}=useAuth();const[v,setV]=useState(null),[rst,setRst]=useState(false);
  useEffect(()=>{if(!v&&s.monthlyFee!==undefined)setV(s)},[s.monthlyFee]);
  const save=async()=>{await db.settings.bulkPut(Object.entries(v).map(([key,x])=>({key,value:Number(x)})));toast('Saved ✓')};
  const exp=async()=>{const o={};for(const t of db.tables)o[t.name]=await t.toArray();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o)],{type:'application/json'}));a.download=`tt-academy-${today()}.json`;a.click()};
  const imp=async e=>{const f=e.target.files[0];if(!f)return;const o=JSON.parse(await f.text());await Promise.all(db.tables.map(t=>t.clear()));for(const t of db.tables)if(o[t.name])await t.bulkPut(o[t.name]);toast('Imported ✓')};
  return <div className="page"><div className="bar"><h2>Settings</h2></div>
    {v&&<div className="card"><h3>Fees</h3>{[['registrationFee','Registration fee (₹)'],['monthlyFee','Monthly fee (₹)'],['dueDay','Due day of month (1-28)']].map(([k,l])=><label key={k} className="fld"><span>{l}</span><input type="number" value={v[k]??''} onChange={e=>setV({...v,[k]:e.target.value})}/></label>)}<button className="btn" onClick={save}>Save fees</button></div>}
    <div className="card"><h3>Backup</h3><button className="btn ghost" onClick={exp}><Download size={16}/> Export JSON</button>
      <label className="btn ghost"><Upload size={16}/> Import JSON<input hidden type="file" accept=".json" onChange={imp}/></label>
      <button className="btn red" onClick={()=>setRst(true)}><RotateCcw size={16}/> Reset demo data</button></div>
    <button className="btn ghost" onClick={logout}><LogOut size={16}/> Logout</button>
    <Confirm msg={rst&&'सारा data हटकर demo data वापस आ जाएगा।'} onClose={()=>setRst(false)} onYes={async()=>{await seed(true);toast('Demo data reset')}}/></div>;
}
export function Login(){
  const{u,login}=useAuth();const[f,setF]=useState({u:'',p:''}),[bad,setBad]=useState(0);
  if(u)return <Navigate to={`/${u.role}`} replace/>;
  const Q=[['Admin','admin','admin123'],['Coach','coach1','coach123'],['Parent','parent1','parent123']];
  return <div className="login"><motion.form className="lbox" key={bad} animate={bad?{x:[0,-12,12,-8,8,0]}:{}} onSubmit={async e=>{e.preventDefault();if(!await login(f.u.trim(),f.p))setBad(b=>b+1)}}>
    <motion.div className="ball big" animate={{y:[0,-26,0]}} transition={{repeat:Infinity,duration:1.1,ease:'easeOut'}}/>
    <h1>TT Academy</h1><p className="mut">Table Tennis Academy Manager</p>
    <input className="inp" placeholder="Username" value={f.u} onChange={e=>setF({...f,u:e.target.value})}/>
    <input className="inp" type="password" placeholder="Password" value={f.p} onChange={e=>setF({...f,p:e.target.value})}/>
    {!!bad&&<p className="err">Username या password गलत है</p>}
    <button className="btn">Login</button>
    <div className="chips">{Q.map(([l,a,b])=><button type="button" key={l} className="chip" onClick={()=>setF({u:a,p:b})}>{l}</button>)}</div></motion.form></div>;
}


/* ---------- Performance tracking + line chart (admin + coach) ---------- */
function PerformanceLineChart({records}){
  const data=[...records].sort((a,b)=>a.date.localeCompare(b.date));
  if(!data.length)return <Empty t="Add at least one assessment to see the performance trend"/>;
  const W=720,H=250,L=42,R=18,T=18,B=42,iw=W-L-R,ih=H-T-B;
  const x=i=>L+(data.length===1?iw/2:(i/(data.length-1))*iw);
  const y=v=>T+ih-((v-1)/4)*ih;
  const points=data.map((r,i)=>`${x(i)},${y((r.footwork+r.forehand+r.backhand+r.serve+r.fitness)/5)}`).join(' ');
  return <div className="performance-chart-wrap">
    <div className="chart-legend"><span><i/> Average skill rating</span><b>{((data[data.length-1].footwork+data[data.length-1].forehand+data[data.length-1].backhand+data[data.length-1].serve+data[data.length-1].fitness)/5).toFixed(1)} / 5 latest</b></div>
    <svg className="performance-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Player average performance rating over assessment dates">
      {[1,2,3,4,5].map(v=><g key={v}><line x1={L} x2={W-R} y1={y(v)} y2={y(v)} stroke="#e9e7ef" strokeDasharray="4 5"/><text x={L-12} y={y(v)+4} textAnchor="end" fill="#777487" fontSize="11">{v}</text></g>)}
      {data.length>1&&<polyline points={points} fill="none" stroke="#ED1C2E" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>}
      {data.map((r,i)=>{const avg=(r.footwork+r.forehand+r.backhand+r.serve+r.fitness)/5;return <g key={r.id}><circle cx={x(i)} cy={y(avg)} r="5" fill="#fff" stroke="#ED1C2E" strokeWidth="3"><title>{`${r.date}: ${avg.toFixed(1)} / 5`}</title></circle><text x={x(i)} y={H-15} textAnchor="middle" fill="#777487" fontSize="10">{r.date.slice(5)}</text></g>})}
    </svg>
    <small className="mut">Average of footwork, forehand, backhand, serve and fitness (1–5). Dates shown as MM-DD.</small>
  </div>;
}
export function Performance(){
  const {u}=useAuth(),lk=useLookups(),rows=useLiveQuery(()=>db.performance.orderBy('date').toArray(),[])||[];
  const [form,setForm]=useState({playerId:'',date:today(),footwork:3,forehand:3,backhand:3,serve:3,fitness:3,notes:''});
  const [chartPlayer,setChartPlayer]=useState('all');
  const mine=rows.filter(r=>u.role==='admin'||r.coachId===u.refId);
  const visiblePlayers=lk.players.filter(p=>u.role==='admin'||p.coachId===u.refId);
  const chartRows=mine.filter(r=>chartPlayer==='all'||r.playerId===Number(chartPlayer));
  const save=async e=>{e.preventDefault();if(!form.playerId)return;await db.performance.add({...form,playerId:Number(form.playerId),coachId:u.refId,date:form.date,footwork:Number(form.footwork),forehand:Number(form.forehand),backhand:Number(form.backhand),serve:Number(form.serve),fitness:Number(form.fitness)});setForm({...form,notes:''});setChartPlayer(form.playerId)};
  const avg=r=>((r.footwork+r.forehand+r.backhand+r.serve+r.fitness)/5).toFixed(1);
  return <div className="page"><div className="bar"><h2>Player Performance</h2></div>
    <section className="card"><div className="row chart-heading"><div className="grow"><h3>Performance trend</h3><small>Track progress across assessment dates</small></div><select className="chart-select" aria-label="Choose player for chart" value={chartPlayer} onChange={e=>setChartPlayer(e.target.value)}><option value="all">All players</option>{visiblePlayers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <PerformanceLineChart records={chartRows}/></section>
    <form className="card" onSubmit={save}><h3>Record assessment</h3>
      <label className="fld"><span>Player</span><select required value={form.playerId} onChange={e=>setForm({...form,playerId:e.target.value})}><option value="">Select player</option>{visiblePlayers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="fld"><span>Assessment date</span><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
      {['footwork','forehand','backhand','serve','fitness'].map(k=><label className="fld" key={k}><span>{k[0].toUpperCase()+k.slice(1)} (1–5)</span><select value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></label>)}
      <label className="fld"><span>Coach feedback</span><textarea className="ta" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
      <button className="btn">Save performance</button></form>
    <h3>Assessment history</h3>{mine.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=><div className="card" key={r.id}><div className="row"><b className="grow">{lk.by.players[r.playerId]?.name||'Player'}</b><Badge t={`${avg(r)} / 5`} c="active"/></div><small>{r.date} · {['footwork','forehand','backhand','serve','fitness'].map(k=>`${k}: ${r[k]}`).join(' · ')}</small>{r.notes&&<p>{r.notes}</p>}<button className="ib red" onClick={()=>db.performance.delete(r.id)}>Delete</button></div>)}{!mine.length&&<Empty t="No performance assessments yet"/>}
  </div>;
}

/* ---------- Tournament management ---------- */
export function Tournaments(){
  const lk=useLookups(),rows=useLiveQuery(()=>db.tournaments.orderBy('startDate').reverse().toArray(),[])||[];
  const [f,setF]=useState({name:'',event:'Singles',category:'Open',startDate:today(),endDate:today(),venue:'',status:'Upcoming',winnerId:''});
  const save=async e=>{e.preventDefault();await db.tournaments.add({...f,winnerId:f.winnerId?Number(f.winnerId):null});setF({...f,name:'',venue:'',winnerId:''})};
  return <div className="page"><div className="bar"><h2>Tournaments</h2></div>
    <form className="card" onSubmit={save}><h3>Create tournament</h3>
      <label className="fld"><span>Tournament name</span><input required value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="Academy Championship"/></label>
      <div className="two"><label className="fld"><span>Event</span><select value={f.event} onChange={e=>setF({...f,event:e.target.value})}>{['Singles','Doubles','Mixed Doubles','Team'].map(x=><option>{x}</option>)}</select></label><label className="fld"><span>Category</span><select value={f.category} onChange={e=>setF({...f,category:e.target.value})}>{['Open','U-11','U-13','U-15','U-17','U-19','Senior'].map(x=><option>{x}</option>)}</select></label></div>
      <div className="two"><label className="fld"><span>Start date</span><input type="date" value={f.startDate} onChange={e=>setF({...f,startDate:e.target.value})}/></label><label className="fld"><span>End date</span><input type="date" value={f.endDate} onChange={e=>setF({...f,endDate:e.target.value})}/></label></div>
      <label className="fld"><span>Venue</span><input value={f.venue} onChange={e=>setF({...f,venue:e.target.value})}/></label>
      <label className="fld"><span>Status</span><select value={f.status} onChange={e=>setF({...f,status:e.target.value})}>{['Upcoming','Ongoing','Completed'].map(x=><option>{x}</option>)}</select></label>
      <label className="fld"><span>Winner (optional)</span><select value={f.winnerId} onChange={e=>setF({...f,winnerId:e.target.value})}><option value="">Not decided</option>{lk.players.map(p=><option value={p.id}>{p.name}</option>)}</select></label>
      <button className="btn">Save tournament</button></form>
    <h3>Tournament calendar</h3>{rows.map(t=><div className="card" key={t.id}><div className="row"><b className="grow">{t.name}</b><Badge t={t.status}/></div><small>{t.event} · {t.category} · {t.startDate}{t.endDate!==t.startDate?` – ${t.endDate}`:''}</small>{t.venue&&<small>Venue: {t.venue}</small>}{t.winnerId&&<p>Winner: <b>{lk.by.players[t.winnerId]?.name||'Player'}</b></p>}<div className="acts"><button className="ib" onClick={()=>db.tournaments.update(t.id,{status:t.status==='Upcoming'?'Ongoing':t.status==='Ongoing'?'Completed':'Upcoming'})}>↻</button><button className="ib red" onClick={()=>db.tournaments.delete(t.id)}>×</button></div></div>)}{!rows.length&&<Empty t="No tournaments created yet"/>}
  </div>;
}
