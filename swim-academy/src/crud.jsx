import {useState} from 'react';
import {motion,AnimatePresence} from 'framer-motion';
import {useLiveQuery} from 'dexie-react-hooks';
import {Plus,Pencil,Trash2,Search} from 'lucide-react';
import {db} from './db';
import {Sheet,Confirm,Empty,useToast,useLookups} from './ui';
import {t} from './i18n';
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// Generic Add / Edit / Delete list driven by a field config.
export function Crud({table,title,fields,defaults={},render,readonly,login,cascade,afterAdd,filter,actions,canMod=()=>true,validate,top,sort=(a,b)=>b.id-a.id}){
  const rows=useLiveQuery(()=>db[table].toArray(),[table])||[],lk=useLookups(),toast=useToast();
  const[f,setF]=useState(null),[del,setDel]=useState(null),[q,setQ]=useState(''),[err,setErr]=useState('');
  const role=table.slice(0,-1);
  const list=rows.filter(r=>(!filter||filter(r))&&JSON.stringify(r).toLowerCase().includes(q.toLowerCase())).sort(sort);
  const open=async r=>{
    setErr('');let u={};
    if(login&&r){const x=await db.users.filter(x=>x.role===role&&x.refId===r.id).first();u=x?{username:x.username,password:x.password}:{}}
    setF({id:r?.id,v:r?{...r}:{...defaults},u});
  };
  const set=(k,val)=>setF(s=>({...s,v:{...s.v,[k]:val}}));
  const opts=x=>typeof x==='string'?lk[x].map(o=>[o.id,o.name]):x.map(o=>[o,o]);
  const save=async()=>{
    const v={...f.v};
    for(const x of fields){const e=v[x.k];if(x.req&&(e===undefined||e===''||e===null||((x.t==='days'||x.t==='multi')&&!e.length)))return setErr(t('{f} is required',{f:t(x.label)}))}
    if(login&&(!f.u.username||!f.u.password))return setErr(t('Username and password are required'));
    const m=validate?.(v);if(m)return setErr(t(m));
    for(const x of fields)if(x.t!=='multi'&&(x.t==='number'||x.num||typeof x.opts==='string'))v[x.k]=(v[x.k]===''||v[x.k]==null)?null:Number(v[x.k]);
    let cur;
    if(login){
      cur=f.id?await db.users.filter(x=>x.role===role&&x.refId===f.id).first():null;
      const dup=await db.users.where('username').equals(f.u.username).first();
      if(dup&&dup.id!==cur?.id)return setErr(t('This username already exists'));
    }
    let id=f.id;if(id)await db[table].update(id,v);else id=await db[table].add(v);
    if(login)cur?await db.users.update(cur.id,f.u):await db.users.add({...f.u,role,refId:id});
    const isNew=!f.id;setF(null);toast(isNew?'Added ✓':'Updated ✓');if(isNew)afterAdd?.(id,v);
  };
  return <div className="page">
    <div className="bar"><h2>{t(title)}</h2><div className="srch"><Search size={16}/><input placeholder={t('Search')} value={q} onChange={e=>setQ(e.target.value)}/></div></div>
    {top}
    <div className="list"><AnimatePresence mode="popLayout" initial={false}>
      {list.map((r,i)=><motion.div layout key={r.id} className="card row" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:.9,x:-40}} transition={{delay:Math.min(i,8)*.04}}>
        {render(r,lk)}
        <div className="acts">{actions?.(r)}
          {!readonly&&canMod(r)&&<><button className="ib" onClick={()=>open(r)}><Pencil size={16}/></button>
          <button className="ib red" onClick={()=>setDel(r)}><Trash2 size={16}/></button></>}</div>
      </motion.div>)}
    </AnimatePresence></div>
    {!list.length&&<Empty t={readonly?'Nothing here yet':'Nothing yet. Tap + to add the first one'}/>}
    {!readonly&&<motion.button whileTap={{scale:.9}} className="fab" onClick={()=>open()}><Plus/></motion.button>}
    <Sheet open={!!f} onClose={()=>setF(null)} title={t(f?.id?'Edit {x}':'Add {x}',{x:t(title)})}>
      {f&&<>{fields.map(x=><label key={x.k} className="fld"><span>{t(x.label)}{x.req&&' *'}</span>
        {x.t==='days'||x.t==='multi'?<div className="chips">{(x.t==='days'?DAYS.map(d=>[d,d]):opts(x.opts)).map(([a,b])=><button type="button" key={a} className={f.v[x.k]?.includes(a)?'chip on':'chip'}
          onClick={()=>set(x.k,f.v[x.k]?.includes(a)?f.v[x.k].filter(y=>y!==a):[...(f.v[x.k]||[]),a])}>{t(String(b))}</button>)}</div>
        :x.t==='select'?<select value={f.v[x.k]??''} onChange={e=>set(x.k,e.target.value)}><option value="">—</option>{opts(x.opts).map(([a,b])=><option key={a} value={a}>{t(String(b))}</option>)}</select>
        :<input type={x.t||'text'} value={f.v[x.k]??''} onChange={e=>set(x.k,e.target.value)}/>}</label>)}
        {login&&<div className="two"><label className="fld"><span>{t('Login username')} *</span><input value={f.u.username||''} onChange={e=>setF(s=>({...s,u:{...s.u,username:e.target.value}}))}/></label>
          <label className="fld"><span>{t('Password')} *</span><input value={f.u.password||''} onChange={e=>setF(s=>({...s,u:{...s.u,password:e.target.value}}))}/></label></div>}
        {err&&<p className="err">{err}</p>}
        <button className="btn" onClick={save}>{t('Save')}</button></>}
    </Sheet>
    <Confirm msg={del&&'This cannot be undone. Linked data will be removed or unassigned.'} onClose={()=>setDel(null)}
      onYes={async()=>{await cascade?.(del);await db[table].delete(del.id);toast('Deleted')}}/>
  </div>;
}
