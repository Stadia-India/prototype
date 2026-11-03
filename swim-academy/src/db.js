import Dexie from 'dexie';
import {tr} from './i18n';
export const db=new Dexie('stadia-swim');
db.version(1).stores({
  users:'++id,username,role',coaches:'++id',parents:'++id',players:'++id,parentId,coachId,batchId',
  batches:'++id,coachId',attendance:'++id,[batchId+date],playerId',races:'++id,status',results:'++id,raceId,swimmerId',
 notes:'++id,playerId',payments:'++id,playerId,[playerId+forMonth],status',settings:'key'});
db.version(2).stores({races:'++id,status,tournamentId',tournaments:'++id,status'});
const p2=n=>String(n).padStart(2,'0');
export const today=()=>{const d=new Date();return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`};
export const thisMonth=()=>today().slice(0,7);
export const addMonths=(ym,n)=>{const[y,m]=ym.split('-').map(Number);const d=new Date(y,m-1+n,1);return `${d.getFullYear()}-${p2(d.getMonth()+1)}`};
export const getS=async()=>Object.fromEntries((await db.settings.toArray()).map(x=>[x.key,x.value]));
const rno=()=>'R'+Date.now().toString().slice(-7);

export async function payReg(id,mode){await db.payments.update(id,{mode,status:'paid',paidOn:today(),receiptNo:rno()})}
// Pays `months` monthly fees starting from the oldest pending month (1 / 6 / 12 month plans).
export async function payMonthly(playerId,months,mode){
  const s=await getS(),rc=rno();
  const rows=(await db.payments.where('playerId').equals(playerId).toArray()).filter(r=>r.type==='monthly');
  const pend=rows.filter(r=>r.status==='pending').map(r=>r.forMonth).sort();
  let fm=pend[0]||(rows.length?addMonths(rows.map(r=>r.forMonth).sort().pop(),1):thisMonth()),n=0;
  while(n<months){
    const ex=rows.find(r=>r.forMonth===fm);
    const rec={playerId,type:'monthly',forMonth:fm,amount:s.monthlyFee,mode,status:'paid',paidOn:today(),planMonths:months,receiptNo:rc};
    if(!ex)await db.payments.add(rec);else if(ex.status==='pending')await db.payments.update(ex.id,rec);else{fm=addMonths(fm,1);continue}
    n++;fm=addMonths(fm,1);
  }
}
// Creates this month's pending fee for every active player (runs on app open).
export async function ensureDues(){
  const m=thisMonth(),s=await getS();
  for(const p of(await db.players.toArray()).filter(p=>p.status==='Active')){
    if(!await db.payments.where('[playerId+forMonth]').equals([p.id,m]).count())
      await db.payments.add({playerId:p.id,type:'monthly',forMonth:m,amount:s.monthlyFee,status:'pending'});
  }
}
export function dueState(r,dd=1){
  if(r.status==='paid')return null;
  if(r.type==='registration')return{c:'coral',t:tr('Registration pending')};
  const d=new Date(`${r.forMonth}-${p2(dd)}T00:00:00`),t=new Date(`${today()}T00:00:00`),n=Math.round((d-t)/864e5);
  return n<0?{c:'coral',t:tr('Overdue · {n} days',{n:-n}),o:n}:n===0?{c:'amber',t:tr('Due today'),o:0}:n<=3?{c:'amber',t:tr('Due in {n} days',{n}),o:n}:{c:'violet',t:tr('Upcoming'),o:n};
}


// Demo race history (8 weeks) so the Performance line charts have data to show.
export async function addHistory(){
  const pl=(await db.players.toArray()).filter(p=>p.status==='Active').sort((a,b)=>a.id-b.id);
  if(pl.length<2)return;
  const EV=[['50m Freestyle',1],['100m Freestyle',2.18],['50m Backstroke',.9],['50m Butterfly',1.12]];
  const base=p=>({Beginner:43000,Intermediate:36500,Advanced:31000}[p.level]||38000)-(p.id%5)*900;
  const heats=Math.ceil(pl.length/4),size=Math.ceil(pl.length/heats),d0=new Date(`${today()}T00:00:00`);
  for(let w=8;w>=1;w--){
    const d=new Date(d0);d.setDate(d.getDate()-7*w);
    const ds=`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
    for(const ei of[0,1+w%3]){
      const[ev,f]=EV[ei];
      for(let h=0;h<heats;h++){
        const grp=pl.slice(h*size,(h+1)*size);if(grp.length<2)continue;
        const tm=grp.map(p=>({p,ms:Math.round(base(p)*f*(1-.05*(8-w)/7)*(1+Math.sin(p.id*12.9+w*78.2+ei)*.012)/10)*10})).sort((a,b)=>a.ms-b.ms);
        const rid=await db.races.add({event:ev,swimmerIds:grp.map(p=>p.id),scheduledAt:`${ds}T${h?'17:30':'17:00'}`,status:'completed',startedAt:d.getTime()});
        await db.results.bulkAdd(tm.map((x,i)=>({raceId:rid,swimmerId:x.p.id,timeMs:x.ms,place:i+1})));
      }
    }
  }
}
// Existing browsers that already hold demo data get the history once.
export async function ensureHistory(){
  if(await db.settings.get('perfHistory')||!await db.users.count())return;
  await addHistory();await db.settings.put({key:'perfHistory',value:1});
}

export async function seed(force){
  if(!force&&await db.users.count())return;
  await Promise.all(db.tables.map(t=>t.clear()));
  await db.settings.bulkPut([{key:'registrationFee',value:1000},{key:'monthlyFee',value:1500},{key:'dueDay',value:1}]);
  const C=await db.coaches.bulkAdd([
    {name:'Amit Sharma',phone:'9830011111',specialization:'Freestyle & Endurance',experienceYears:8,status:'Active'},
    {name:'Neha Roy',phone:'9830022222',specialization:'Butterfly & Turns',experienceYears:6,status:'Active'},
    {name:'Sourav Das',phone:'9830033333',specialization:'Junior Water Safety',experienceYears:4,status:'Active'}],{allKeys:true});
  const P=await db.parents.bulkAdd([
    {name:'Rajesh Mehta',phone:'9831000001'},{name:'Sunita Das',phone:'9831000002'},{name:'Vikram Nair',phone:'9831000003'},
    {name:'Pooja Singh',phone:'9831000004'},{name:'Anil Joshi',phone:'9831000005'}],{allKeys:true});
  const B=await db.batches.bulkAdd([
    {name:'Morning Beginners',coachId:C[0],days:['Mon','Wed','Fri'],startTime:'06:30',endTime:'08:00',lane:1},
    {name:'Dolphin Advanced',coachId:C[1],days:['Tue','Thu','Sat'],startTime:'17:00',endTime:'19:00',lane:2},
    {name:'Weekend Juniors',coachId:C[2],days:['Sat','Sun'],startTime:'09:00',endTime:'11:00',lane:3}],{allKeys:true});
  const pl=[['Aarav Mehta',12,'Beginner',0,0,0],['Ananya Mehta',15,'Intermediate',0,1,1],['Rohan Das',17,'Advanced',1,1,1],
    ['Ishita Nair',10,'Beginner',2,2,2],['Kabir Singh',14,'Intermediate',3,0,0],['Diya Nair',11,'Beginner',2,2,2],
    ['Arjun Singh',16,'Advanced',3,1,1],['Meera Joshi',13,'Intermediate',4,1,1]];
  const L=await db.players.bulkAdd(pl.map(([name,age,level,p,c,b],i)=>({name,age,level,stroke:['Freestyle','Backstroke','Freestyle','Breaststroke','Butterfly','Freestyle','Butterfly','Backstroke'][i],parentId:P[p],coachId:C[c],batchId:B[b],status:'Active'})),{allKeys:true});
  await db.users.bulkAdd([{username:'admin',password:'admin123',role:'admin',refId:0},
    ...C.map((id,i)=>({username:`coach${i+1}`,password:'coach123',role:'coach',refId:id})),
    ...P.map((id,i)=>({username:`parent${i+1}`,password:'parent123',role:'parent',refId:id}))]);
  const t=today(),m=thisMonth();
  const pays=[];L.forEach((id,i)=>{
    pays.push({playerId:id,type:'registration',amount:1000,mode:'offline',status:'paid',paidOn:t,receiptNo:'R100'+i});
    pays.push(i>=2&&i<5?{playerId:id,type:'monthly',forMonth:m,amount:1500,mode:'online',status:'paid',paidOn:t,planMonths:1,receiptNo:'R200'+i}
      :{playerId:id,type:'monthly',forMonth:m,amount:1500,status:'pending'});});
  pays.push({playerId:L[0],type:'monthly',forMonth:addMonths(m,-1),amount:1500,status:'pending'});
  await db.payments.bulkAdd(pays);
  const at=h=>`${t}T${h}`;
  const R=await db.races.bulkAdd([
    {event:'50m Freestyle',swimmerIds:[L[2],L[1],L[6],L[7]],scheduledAt:at('17:30'),status:'scheduled'},
    {event:'100m Freestyle',swimmerIds:[L[0],L[4],L[3],L[5]],scheduledAt:at('19:00'),status:'scheduled'},
    {event:'50m Butterfly',swimmerIds:[L[2],L[6],L[1]],scheduledAt:at('20:00'),status:'scheduled'},
    {event:'50m Backstroke',swimmerIds:[L[7],L[1],L[6]],scheduledAt:at('16:00'),status:'completed',startedAt:Date.now()-3.6e6}],{allKeys:true});
  const e=new Date();e.setDate(e.getDate()+2);
  const tid=await db.tournaments.add({name:'Stadia Inter-Club Cup',venue:'City Aquatic Centre',startDate:t,endDate:`${e.getFullYear()}-${p2(e.getMonth()+1)}-${p2(e.getDate())}`,events:['50m Freestyle','100m Freestyle','50m Butterfly','50m Backstroke'],swimmerIds:L});
  for(const id of R)await db.races.update(id,{tournamentId:tid,heat:1});
  await db.results.bulkAdd([[L[7],31420],[L[1],32180],[L[6],33950]].map(([swimmerId,timeMs],i)=>({raceId:R[3],swimmerId,timeMs,place:i+1})));
  await addHistory();await db.settings.put({key:'perfHistory',value:1});
}
