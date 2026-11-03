import {useEffect,useState} from 'react';
import {Routes,Route,Navigate,NavLink,Outlet,useLocation} from 'react-router-dom';
import {useLiveQuery} from 'dexie-react-hooks';
import {motion} from 'framer-motion';
import {Home,Users,Swords,IndianRupee,CalendarCheck,UserCog,HeartHandshake,Layers,Settings,LayoutGrid,LogOut,TrendingUp,Trophy,Activity} from 'lucide-react';
import {db,seed,ensureDues} from './db';
import {AuthProvider,ToastProvider,useAuth,Avatar} from './ui';
import * as P from './pages';
import Landing from './Landing';
import stadiaLogo from './assets/stadia-logo.png';
import stadiaMark from './assets/stadia-mark.png';
import {Coaches,Parents,Batches} from './pages';

const NAV={
  admin:[['','Home',Home],['players','Players',Users],['matches','Matches',Swords],['performance','Performance',Activity],['tournaments','Tournaments',Trophy],['fees','Fees',IndianRupee],['attendance','Attendance',CalendarCheck],['coaches','Coaches',UserCog],['parents','Parents',HeartHandshake],['batches','Batches',Layers],['settings','Settings',Settings]],
  coach:[['','Home',Home],['players','Players',Users],['attendance','Attendance',CalendarCheck],['matches','Matches',Swords],['performance','Performance',Activity]],
  parent:[['','Home',Home],['matches','Matches',Swords],['fees','Fees',IndianRupee],['progress','Progress',TrendingUp]],
};
function Guard({roles,children}){const{u}=useAuth();if(!u)return <Navigate to="/login" replace/>;return roles.includes(u.role)?children:<Navigate to={`/${u.role}`} replace/>}
function Shell({role}){
  const{u,logout}=useAuth(),loc=useLocation(),items=NAV[role],[ki,setKi]=useState(0);
  const bottom=role==='admin'?[...items.slice(0,4),['more','More',LayoutGrid]]:items;
  const kids=useLiveQuery(()=>role==='parent'?db.players.where('parentId').equals(u.refId).toArray():[],[role,u.refId])||[],kid=kids[ki]||kids[0];
  const to=p=>`/${role}${p?'/'+p:''}`;
  return <div className="app">
    <aside className="side"><div className="logo"><img className="dashboard-mark" src={stadiaMark} alt="STADIA logo"/><span>STADIA TT</span></div>
      {items.map(([p,l,I])=><NavLink key={p} end={p===''} to={to(p)} className="sl"><I size={18}/>{l}</NavLink>)}
      <button className="sl out" onClick={logout}><LogOut size={18}/>Logout</button></aside>
    <div className="main"><header className="top"><img className="dashboard-logo" src={stadiaLogo} alt="STADIA — Make every athlete visible"/><span className="grow"/>
      {kids.length>1&&<div className="kids">{kids.map((k,i)=><button key={k.id} className={i===ki?'on':''} onClick={()=>setKi(i)}><Avatar n={k.name} id={k.id}/></button>)}</div>}
      <button className="ib" onClick={logout}><LogOut size={16}/></button></header>
      <motion.div key={loc.pathname} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.25}}><Outlet context={{kid,kids}}/></motion.div></div>
    <nav className="bottom">{bottom.map(([p,l,I])=><NavLink key={p} end={p===''} to={to(p)}>{({isActive})=><>{isActive&&<motion.i layoutId="pill" className="pill"/>}<I size={20}/><span>{l}</span></>}</NavLink>)}</nav>
  </div>;
}
export default function App(){
  const[ready,setReady]=useState(false);
  useEffect(()=>{seed().then(ensureDues).then(()=>setReady(true))},[]);
  if(!ready)return <div className="login"><div className="ball big"/></div>;
  const A=['admin'],C=['coach'],Pa=['parent'];
  return <AuthProvider><ToastProvider><Routes>
    <Route path="/" element={<Landing/>}/>
    <Route path="/login" element={<P.Login/>}/>
    <Route path="/board/:id" element={<P.Board/>}/>
    <Route path="/score/:id" element={<Guard roles={['admin','coach']}><P.Console/></Guard>}/>
    <Route path="/admin" element={<Guard roles={A}><Shell role="admin"/></Guard>}>
      <Route index element={<P.Dash/>}/><Route path="players" element={<P.Players/>}/><Route path="matches" element={<P.Matches role="admin"/>}/>
      <Route path="fees" element={<P.Fees/>}/><Route path="performance" element={<P.Performance/>}/><Route path="tournaments" element={<P.Tournaments/>}/><Route path="attendance" element={<P.Attendance/>}/><Route path="coaches" element={<Coaches/>}/>
      <Route path="parents" element={<Parents/>}/><Route path="batches" element={<Batches/>}/><Route path="settings" element={<P.SettingsPage/>}/>
      <Route path="more" element={<P.More items={NAV.admin.slice(4)}/>}/></Route>
    <Route path="/coach" element={<Guard roles={C}><Shell role="coach"/></Guard>}>
      <Route index element={<P.CoachHome/>}/><Route path="players" element={<P.Players coach/>}/><Route path="attendance" element={<P.Attendance/>}/><Route path="matches" element={<P.Matches role="coach"/>}/><Route path="performance" element={<P.Performance/>}/></Route>
    <Route path="/parent" element={<Guard roles={Pa}><Shell role="parent"/></Guard>}>
      <Route index element={<P.PHome/>}/><Route path="matches" element={<P.Matches role="parent"/>}/><Route path="fees" element={<P.PFees/>}/><Route path="progress" element={<P.Progress/>}/></Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></ToastProvider></AuthProvider>;
}
