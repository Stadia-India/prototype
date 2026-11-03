import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {motion} from 'framer-motion';
import {Users,Swords,IndianRupee,CalendarCheck,ShieldCheck,HeartHandshake,Radio,Tv,NotebookPen,DatabaseBackup,Smartphone,Layers,ArrowRight} from 'lucide-react';
import {Num,useAuth} from './ui';
import hero from './assets/hero.svg';

// IntersectionObserver hook: flips to true the first time the element scrolls into view.
function useIn(th=.2){
  const r=useRef(null),[v,setV]=useState(false);
  useEffect(()=>{const o=new IntersectionObserver(([e])=>{if(e.isIntersecting){setV(true);o.disconnect()}},{threshold:th});o.observe(r.current);return()=>o.disconnect()},[]);
  return[r,v];
}
const Reveal=({children,d=0,className=''})=>{const[r,v]=useIn();return <div ref={r} className={`rv ${v?'in':''} ${className}`} style={{'--d':`${d}ms`}}>{children}</div>};
const Stat=({v,l,suf=''})=>{const[r,on]=useIn(.5);return <div ref={r} className="lp-stat"><b>{on?<><Num v={v}/>{suf}</>:'0'}</b><small>{l}</small></div>};

function MiniBoard(){
  const[r,on]=useIn(.4),[s,setS]=useState([0,0]);
  useEffect(()=>{if(!on)return;const id=setInterval(()=>setS(([a,b])=>{if(Math.max(a,b)>=11&&Math.abs(a-b)>=2)return[0,0];return Math.random()<.5?[a+1,b]:[a,b+1]}),900);return()=>clearInterval(id)},[on]);
  return <div ref={r} className="lp-board"><span className="live"><i/>LIVE</span>
    {[['Rohan Das',s[0]],['Ananya Mehta',s[1]]].map(([n,v])=><div key={n} className="lp-pl"><span>{n}</span><motion.b key={v} initial={{y:-24,opacity:0,scale:1.3}} animate={{y:0,opacity:1,scale:1}}>{v}</motion.b></div>)}
    <small>Tap +1 · Undo · Serve · Deuce — sab automatic</small></div>;
}

const F=[
 [ShieldCheck,'Role-based dashboards','Admin, Coach aur Parent ke alag login. Player ka login nahi, uska data sirf in teeno ko dikhta hai.'],
 [Users,'Coaches, players, parents','Add, edit, delete — sab kuch ek jagah. Search aur level badges ke saath.'],
 [Layers,'Batches & assignments','Players ko coach, batch aur parent se jodiye. Delete par jude records apne-aap clean.'],
 [CalendarCheck,'Attendance','Ek tap mein Present / Absent / Late. Parent ko attendance % dikhta hai.'],
 [Swords,'Matches & fixtures','Best of 3/5/7, table number aur time ke saath match banaiye. Upcoming, Live, Done tabs.'],
 [Radio,'Live scoring console','11 points, 2 ka lead, serve change, deuce, side change aur Undo — rules auto.'],
 [Tv,'Live scoreboard','Projector ya TV ke liye bada dark scoreboard, score turant update.'],
 [IndianRupee,'Fees & payments','Registration fee, monthly fee, 6 mahine ya 1 saal ka plan. Online ya offline, dono record.'],
 [HeartHandshake,'Parent portal','Bachche ka schedule, matches, fees, due notice aur coach ke notes — read-only.'],
 [NotebookPen,'Coach notes','Skill feedback likhiye, parent ko progress mein dikhega.'],
 [DatabaseBackup,'Offline + backup','Sab data IndexedDB mein. JSON export/import aur demo reset.'],
 [Smartphone,'Mobile-first design','Bottom nav, bottom-sheet forms, smooth animations. Desktop par sidebar.'],
];
const ROLES=[['Admin','Poori academy chalaye','Coaches, players, batches, matches, live scoring, fees aur reports.'],['Coach','Apne players sambhale','Attendance, notes aur apne players ke match ka scoring.'],['Parent','Bachche par nazar','Schedule, fees, attendance, results aur live match — sirf dekhna.']];

export default function Landing(){
  const{u}=useAuth(),[solid,setSolid]=useState(false),sen=useRef(null);
  useEffect(()=>{const o=new IntersectionObserver(([e])=>setSolid(!e.isIntersecting));o.observe(sen.current);return()=>o.disconnect()},[]);
  const go=u?`/${u.role}`:'/login';
  return <div className="lp"><div ref={sen} className="lp-sen"/>
    <nav className={`lp-nav ${solid?'solid':''}`}><div className="lp-logo"><i className="ball sm"/>STADIA Table Tennis Academy</div>
      <a href="#features" className="lp-lnk">Features</a><a href="#roles" className="lp-lnk">Roles</a>
      <Link className="btn lime sm" to={go}>{u?'Open dashboard':'Login'}</Link></nav>
    <header className="lp-hero">
      <div className="lp-copy"><motion.h1 initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:.6}}>Run your table tennis academy from one phone.</motion.h1>
        <motion.p initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:.6,delay:.12}}>Players, coaches, parents, batches, fees aur live matches — ek hi simple system mein. Offline chalta hai, mobile par best lagta hai.</motion.p>
        <motion.div className="lp-cta" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:.6,delay:.24}}>
          <Link className="btn lime" to={go}>{u?'Open dashboard':'Try the live demo'} <ArrowRight size={18}/></Link>
          <a className="btn ghostd" href="#features">See all features</a></motion.div></div>
      <motion.div className="lp-img" initial={{opacity:0,scale:.92}} animate={{opacity:1,scale:1}} transition={{duration:.7,delay:.2}}>
        <img src={hero} alt="Table tennis table, paddle and ball"/><motion.div className="lp-chip" animate={{y:[0,-8,0]}} transition={{repeat:Infinity,duration:3}}><span className="live"><i/>LIVE</span> Rohan 7 – 4 Ananya</motion.div></motion.div>
    </header>
    <section className="lp-stats"><Stat v={12} l="Core features"/><Stat v={3} l="Role logins"/><Stat v={7} l="Best-of formats up to"/><Stat v={100} l="% offline in browser" suf=""/></section>
    <section id="features" className="lp-sec"><Reveal><h2>Everything the academy needs</h2><p className="mut">Har feature demo mein asli data par chalta hai.</p></Reveal>
      <div className="lp-grid">{F.map(([I,t,d],i)=><Reveal key={t} d={(i%3)*90} className="lp-card"><div className="lp-ic"><I size={22}/></div><h3>{t}</h3><p>{d}</p></Reveal>)}</div></section>
    <section className="lp-sec lp-split"><Reveal><h2>Live scoring that follows the rules</h2><p className="mut">Coach ya admin point tap karta hai, scoreboard par score turant badalta hai. Serve, deuce aur sides ka dhyan system rakhta hai.</p><Link className="btn sm" to={go}>Score a match</Link></Reveal>
      <Reveal d={120}><MiniBoard/></Reveal></section>
    <section id="roles" className="lp-sec"><Reveal><h2>One system, three views</h2></Reveal>
      <div className="lp-grid r3">{ROLES.map(([t,s,d],i)=><Reveal key={t} d={i*110} className="lp-card"><small>{t}</small><h3>{s}</h3><p>{d}</p></Reveal>)}</div></section>
    <Reveal className="lp-end"><h2>Demo dekhne ke liye ready?</h2><p>Admin: admin / admin123 · Coach: coach1 / coach123 · Parent: parent1 / parent123</p><Link className="btn lime sm" to={go}>{u?'Open dashboard':'Login now'}</Link></Reveal>
    <footer className="lp-foot">STADIA Table Tennis Academy · Demo prototype · Data stays in your browser</footer></div>;
}
