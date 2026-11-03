// Table tennis scoring: 11 pts, win by 2, serve every 2 pts (every 1 at deuce), best of N.
export function derive(seq,bestOf=3){
  const need=Math.ceil(bestOf/2);let a=0,b=0,w=[0,0],games=[];
  for(const p of seq){
    if(w[0]===need||w[1]===need)break;
    p===1?a++:b++;
    if((a>=11||b>=11)&&Math.abs(a-b)>=2){games.push([a,b]);a>b?w[0]++:w[1]++;a=b=0}
  }
  const done=w[0]===need||w[1]===need,tot=a+b,first=games.length%2;
  const server=(tot<20?first+Math.floor(tot/2):first+10+tot-20)%2;
  const decider=w[0]===need-1&&w[1]===need-1;
  return{a,b,w,need,games,done,winner:done?(w[0]>w[1]?1:2):0,server,decider,swap:decider&&!done&&Math.max(a,b)===5,gameNo:games.length+1};
}
