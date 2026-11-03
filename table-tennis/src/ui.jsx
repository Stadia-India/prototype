import {createContext,useContext,useState,useEffect,useCallback} from 'react';
import {motion,AnimatePresence,animate} from 'framer-motion';
import {useLiveQuery} from 'dexie-react-hooks';
import {db} from './db';

const AC=createContext();export const useAuth=()=>useContext(AC);
export function AuthProvider({children}){
  const[u,setU]=useState(()=>JSON.parse(sessionStorage.getItem('u')||'null'));
  const login=async(un,pw)=>{
    const x=await db.users.where('username').equals(un).first();
    if(!x||x.password!==pw)return false;
    const s={id:x.id,role:x.role,refId:x.refId,username:un};
    sessionStorage.setItem('u',JSON.stringify(s));setU(s);return true;
  };
  const logout=()=>{sessionStorage.removeItem('u');setU(null)};
  return <AC.Provider value={{u,login,logout}}>{children}</AC.Provider>;
}

const TC=createContext();export const useToast=()=>useContext(TC);
export function ToastProvider({children}){
  const[t,setT]=useState(null);
  const toast=useCallback(msg=>setT({msg,k:Date.now()}),[]);
  useEffect(()=>{if(!t)return;const id=setTimeout(()=>setT(null),2600);return()=>clearTimeout(id)},[t]);
  return <TC.Provider value={toast}>{children}
    <AnimatePresence>{t&&<motion.div key={t.k} className="toast" initial={{y:80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:80,opacity:0}}>{t.msg}</motion.div>}</AnimatePresence>
  </TC.Provider>;
}

export function Sheet({open,onClose,title,children}){
  return <AnimatePresence>{open&&<motion.div className="ov" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}>
    <motion.div className="sheet" initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',damping:30,stiffness:320}} onClick={e=>e.stopPropagation()}>
      <div className="grab"/><h3>{title}</h3>{children}
    </motion.div></motion.div>}</AnimatePresence>;
}
export function Confirm({msg,onYes,onClose}){
  return <Sheet open={!!msg} onClose={onClose} title="पक्का delete करना है?">
    <p className="mut">{msg}</p>
    <div className="two"><button className="btn ghost" onClick={onClose}>Cancel</button>
    <button className="btn red" onClick={async()=>{await onYes();onClose()}}>Delete</button></div>
  </Sheet>;
}
export const Avatar=({n='?',id=0})=><div className="av" style={{background:`linear-gradient(135deg,hsl(${(id*67)%360} 80% 62%),hsl(${(id*67+55)%360} 80% 52%))`}}>{n.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>;
export const Badge=({t,c})=><span className={`bd ${(c||t).toLowerCase()}`}>{t}</span>;
export function Num({v,pre=''}){
  const[x,setX]=useState(0);
  useEffect(()=>{const c=animate(0,v||0,{duration:.8,onUpdate:n=>setX(Math.round(n))});return()=>c.stop()},[v]);
  return <>{pre}{x.toLocaleString('en-IN')}</>;
}
export const Empty=({t})=><div className="empty"><div className="ball big"/><p>{t}</p></div>;

export function useLookups(){
  const c=useLiveQuery(()=>db.coaches.toArray(),[])||[],p=useLiveQuery(()=>db.parents.toArray(),[])||[],
    b=useLiveQuery(()=>db.batches.toArray(),[])||[],pl=useLiveQuery(()=>db.players.toArray(),[])||[];
  const m=a=>Object.fromEntries(a.map(x=>[x.id,x]));
  return{coaches:c,parents:p,batches:b,players:pl,by:{coaches:m(c),parents:m(p),batches:m(b),players:m(pl)}};
}
