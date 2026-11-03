import Dexie from 'dexie';
export const db=new Dexie('tt-academy');
db.version(1).stores({
  users:'++id,username,role',coaches:'++id',parents:'++id',players:'++id,parentId,coachId,batchId',
  batches:'++id,coachId',attendance:'++id,[batchId+date],playerId',matches:'++id,status',games:'++id,matchId',
  pointLog:'++id,matchId',notes:'++id,playerId',payments:'++id,playerId,[playerId+forMonth],status',settings:'key'});
db.version(2).stores({users:'++id,username,role',coaches:'++id',parents:'++id',players:'++id,parentId,coachId,batchId',batches:'++id,coachId',attendance:'++id,[batchId+date],playerId',matches:'++id,status',games:'++id,matchId',pointLog:'++id,matchId',notes:'++id,playerId',payments:'++id,playerId,[playerId+forMonth],status',settings:'key',performance:'++id,playerId,date,coachId',tournaments:'++id,name,status,startDate'});
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
  if(r.type==='registration')return{c:'coral',t:'Registration pending'};
  const d=new Date(`${r.forMonth}-${p2(dd)}T00:00:00`),t=new Date(`${today()}T00:00:00`),n=Math.round((d-t)/864e5);
  return n<0?{c:'coral',t:`Overdue · ${-n} दिन`,o:n}:n===0?{c:'amber',t:'Due today',o:0}:n<=3?{c:'amber',t:`Due in ${n} दिन`,o:n}:{c:'violet',t:'Upcoming',o:n};
}

export async function seed(force){
  if(!force&&await db.users.count())return;
  await Promise.all(db.tables.map(t=>t.clear()));
  await db.settings.bulkPut([{key:'registrationFee',value:1000},{key:'monthlyFee',value:1500},{key:'dueDay',value:1}]);
  const C=await db.coaches.bulkAdd([
    {name:'Amit Sharma',phone:'9830011111',specialization:'Footwork & Defence',experienceYears:8,status:'Active'},
    {name:'Neha Roy',phone:'9830022222',specialization:'Spin & Serve',experienceYears:6,status:'Active'},
    {name:'Sourav Das',phone:'9830033333',specialization:'Junior Training',experienceYears:4,status:'Active'}],{allKeys:true});
  const P=await db.parents.bulkAdd([
    {name:'Rajesh Mehta',phone:'9831000001'},{name:'Sunita Das',phone:'9831000002'},{name:'Vikram Nair',phone:'9831000003'},
    {name:'Pooja Singh',phone:'9831000004'},{name:'Anil Joshi',phone:'9831000005'}],{allKeys:true});
  const B=await db.batches.bulkAdd([
    {name:'Morning Beginners',coachId:C[0],days:['Mon','Wed','Fri'],startTime:'06:30',endTime:'08:00',tableNo:1},
    {name:'Evening Advanced',coachId:C[1],days:['Tue','Thu','Sat'],startTime:'17:00',endTime:'19:00',tableNo:2},
    {name:'Weekend Juniors',coachId:C[2],days:['Sat','Sun'],startTime:'09:00',endTime:'11:00',tableNo:3}],{allKeys:true});
  const pl=[['Aarav Mehta',12,'Beginner',0,0,0],['Ananya Mehta',15,'Intermediate',0,1,1],['Rohan Das',17,'Advanced',1,1,1],
    ['Ishita Nair',10,'Beginner',2,2,2],['Kabir Singh',14,'Intermediate',3,0,0],['Diya Nair',11,'Beginner',2,2,2],
    ['Arjun Singh',16,'Advanced',3,1,1],['Meera Joshi',13,'Intermediate',4,1,1]];
  const L=await db.players.bulkAdd(pl.map(([name,age,level,p,c,b])=>({name,age,level,hand:'Right',parentId:P[p],coachId:C[c],batchId:B[b],status:'Active'})),{allKeys:true});
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
  const [live]=await db.matches.bulkAdd([
    {player1Id:L[2],player2Id:L[1],bestOf:3,tableNo:2,scheduledAt:at('17:30'),status:'live'},
    {player1Id:L[0],player2Id:L[4],bestOf:3,tableNo:1,scheduledAt:at('19:00'),status:'scheduled'},
    {player1Id:L[5],player2Id:L[3],bestOf:3,tableNo:3,scheduledAt:at('20:00'),status:'scheduled'},
    {player1Id:L[7],player2Id:L[6],bestOf:3,tableNo:2,scheduledAt:at('16:00'),status:'completed',winnerId:L[7]}],{allKeys:true});
  await db.pointLog.bulkAdd([1,1,2,1,2,1,1,2,1,2,1].map(s=>({matchId:live,scorer:s,ts:Date.now()})));
  await db.games.bulkAdd([[11,8],[7,11],[11,9]].map((g,i)=>({matchId:live+3,gameNo:i+1,p1Score:g[0],p2Score:g[1]})));
}
