const zone='Asia/Bangkok';
const day=new Intl.DateTimeFormat('th-TH',{timeZone:zone,day:'numeric',month:'short'});
const clock=new Intl.DateTimeFormat('th-TH',{timeZone:zone,hour:'2-digit',minute:'2-digit'});
const key=new Intl.DateTimeFormat('en-CA',{timeZone:zone});
export function pickupWindow(start:string|Date,end:string|Date){
  const a=new Date(start),b=new Date(end);
  if(!Number.isFinite(+a)||!Number.isFinite(+b)||b<=a)throw Error('Invalid pickup window');
  return `${day.format(a)} ${clock.format(a)}–${key.format(a)===key.format(b)?'':day.format(b)+' '}${clock.format(b)} น.`;
}
